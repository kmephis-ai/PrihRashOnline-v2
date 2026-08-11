'use strict';

const crypto = require('crypto');
const CONTRACT = require('./dashboard_visual_customization.v1.json');
const FACTORY = require('./widget_factory');
const VIZ = require('../visualization/visualization_foundation');
const VIZ_REGISTRY = require('../visualization/visualization_registry_v2');
const DESIGN = require('../design/design_system.v1.json');

const SCHEMA = 'PRH_DASHBOARD_VISUAL_CUSTOMIZATION_V1';
const VERSION = '1.0.0';
const PREFERENCE_SCHEMA = 'PRH_DASHBOARD_VISUAL_PREFERENCE_V1';
const OVERRIDE_SCHEMA = 'PRH_DASHBOARD_WIDGET_VISUAL_OVERRIDE_V1';
const PLAN_SCHEMA = 'PRH_DASHBOARD_VISUAL_PLAN_V1';
const TOP_N_SCHEMA = 'PRH_DASHBOARD_TOP_N_PRESENTATION_V1';
const THEMES = Object.freeze(CONTRACT.themes.slice());
const DENSITIES = Object.freeze(CONTRACT.densities.slice());
const NUMBER_FORMATS = Object.freeze(CONTRACT.number_formats.slice());
const PALETTES = Object.freeze(Object.keys(CONTRACT.palette_registry));
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HOSTILE_KEYS = new Set([
  'css', 'style', 'styles', 'color', 'colors', 'hex', 'rgb', 'rgba', 'formatter', 'format_string',
  'function', 'javascript', 'html', 'svg', 'script', 'transaction_id', 'transaction_ids', 'amount',
  'amount_minor', 'value_minor', 'balance_minor', 'income_minor', 'expense_minor', 'cash_flow_minor',
  'filter_value', 'filter_values', 'private_label', 'private_labels'
]);

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function stableStringify(value) {
  return VIZ.stableStringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function exactKeys(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(keys.slice().sort())) fail(code);
  return value;
}

function enumValue(value, allowed, code) {
  const normalized = String(value == null ? '' : value).toUpperCase();
  if (!allowed.includes(normalized)) fail(code);
  return normalized;
}

function safeId(value, code) {
  const text = String(value == null ? '' : value).trim();
  if (!ID_RE.test(text)) fail(code);
  return text;
}

function assertNoHostilePreference(value, path = 'preference') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoHostilePreference(item, `${path}[${index}]`));
    return true;
  }
  if (!value || typeof value !== 'object') return true;
  for (const [key, child] of Object.entries(value)) {
    const normalized = String(key).toLowerCase();
    if (HOSTILE_KEYS.has(normalized)) fail('DASH085_HOSTILE_PRESENTATION_PAYLOAD', `${path}.${key}`);
    assertNoHostilePreference(child, `${path}.${key}`);
  }
  return true;
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'DASH-085' ||
      CONTRACT.preference_schema !== PREFERENCE_SCHEMA || CONTRACT.widget_override_schema !== OVERRIDE_SCHEMA ||
      CONTRACT.plan_schema !== PLAN_SCHEMA || CONTRACT.top_n_result_schema !== TOP_N_SCHEMA) {
    fail('DASH085_CONTRACT_INVALID');
  }
  FACTORY.assertContract();
  VIZ.assertContract();
  VIZ_REGISTRY.assertContract();
  if (!DESIGN || DESIGN.schema !== 'PRH_DESIGN_SYSTEM_V1' || DESIGN.version !== '1.0.0' || DESIGN.roadmap_id !== 'DESIGN-020') {
    fail('DASH085_DESIGN_CONTRACT_INVALID');
  }
  if (CONTRACT.upstream.design_system !== `${DESIGN.schema}@${DESIGN.version}` ||
      CONTRACT.upstream.widget_factory !== `${FACTORY.SCHEMA}@${FACTORY.VERSION}` ||
      CONTRACT.upstream.visualization_registry !== `${VIZ_REGISTRY.SCHEMA}@${VIZ_REGISTRY.VERSION}` ||
      CONTRACT.upstream.financial_truth_policy !== 'FIN-TRUTH-v1') {
    fail('DASH085_UPSTREAM_CONTRACT_INVALID');
  }
  const principles = CONTRACT.principles || {};
  if (principles.presentation_only !== true || principles.raw_css_allowed !== false ||
      principles.arbitrary_color_allowed !== false || principles.arbitrary_formatter_allowed !== false ||
      principles.query_mutation_allowed !== false || principles.binding_mutation_allowed !== false ||
      principles.financial_formula_allowed !== false || principles.financial_truth_owned !== false ||
      principles.top_n_changes_financial_total !== false || principles.design_tokens_required !== true ||
      principles.viz_retype_required !== true || principles.external_asset_required !== false ||
      principles.paid_dependency_required !== false || principles.free_only !== true) {
    fail('DASH085_BOUNDARY_INVALID');
  }
  if (!CONTRACT.authority || Object.values(CONTRACT.authority).some((value) => value !== false)) {
    fail('DASH085_AUTHORITY_INVALID');
  }
  if (!DESIGN.accessibility || DESIGN.accessibility.focus_visible_required !== true ||
      DESIGN.accessibility.reduced_motion_required !== true || DESIGN.accessibility.system_color_scheme_supported !== true) {
    fail('DASH085_DESIGN_ACCESSIBILITY_INVALID');
  }
  if (JSON.stringify(THEMES) !== JSON.stringify(['SYSTEM', 'LIGHT', 'DARK']) ||
      JSON.stringify(DENSITIES) !== JSON.stringify(['COMPACT', 'COMFORTABLE']) ||
      JSON.stringify(PALETTES.slice().sort()) !== JSON.stringify(['COLORBLIND', 'DEFAULT', 'MONO'])) {
    fail('DASH085_REGISTRY_INVALID');
  }
  for (const density of DENSITIES) {
    const entry = CONTRACT.density_tokens[density];
    if (!entry || !Object.prototype.hasOwnProperty.call(DESIGN.spacing_px, entry.spacing_token) ||
        !Object.prototype.hasOwnProperty.call(DESIGN.typography.size_px, entry.font_size_token) ||
        !Object.prototype.hasOwnProperty.call(DESIGN.typography.line_height, entry.line_height_token) ||
        entry.min_hit_target_px < CONTRACT.accessibility.minimum_hit_target_px) {
      fail('DASH085_DENSITY_TOKEN_INVALID');
    }
  }
  for (const [paletteId, palette] of Object.entries(CONTRACT.palette_registry)) {
    if (!Array.isArray(palette.series) || palette.series.length < 3 || palette.high_contrast_fallback !== 'MONO') {
      fail('DASH085_PALETTE_REGISTRY_INVALID');
    }
    if (paletteId === 'MONO') {
      if (palette.series.some((token) => !/^DESIGN:(text|text_secondary|text_muted)$/.test(token))) {
        fail('DASH085_MONO_PALETTE_TOKEN_INVALID');
      }
    } else if (palette.series.some((color) => !/^#[0-9a-f]{6}$/i.test(color))) {
      fail('DASH085_PALETTE_COLOR_INVALID');
    }
  }
  return true;
}

function rawFactoryPresentation(binding) {
  const presentation = binding.presentation;
  if ((binding.kind === 'KPI' || binding.kind === 'CARD') && presentation && presentation.mode === binding.kind) {
    return {
      schema: presentation.schema,
      contract_version: presentation.contract_version,
      title: presentation.title,
      show_comparison: presentation.show_comparison
    };
  }
  return presentation;
}

function normalizeBoundDescriptor(input) {
  exactKeys(input, ['schema', 'contract_version', 'widget_id', 'semantic_binding_status', 'layout_identity_authority', 'geometry_mutation', 'binding'], 'DASH085_BOUND_DESCRIPTOR_SHAPE_INVALID');
  if (input.schema !== FACTORY.BOUND_DESCRIPTOR_SCHEMA || input.contract_version !== FACTORY.VERSION ||
      input.semantic_binding_status !== 'BOUND' || input.layout_identity_authority !== false || input.geometry_mutation !== false) {
    fail('DASH085_BOUND_DESCRIPTOR_INVALID');
  }
  const binding = input.binding;
  const normalized = FACTORY.normalizeBinding({
    schema: binding.schema,
    contract_version: binding.contract_version,
    widget_id: binding.widget_id,
    kind: binding.kind,
    query: binding.query,
    presentation: rawFactoryPresentation(binding)
  });
  if (stableStringify(normalized) !== stableStringify(binding)) fail('DASH085_BINDING_DERIVED_STATE_MISMATCH');
  if (input.widget_id !== normalized.widget_id) fail('DASH085_BOUND_WIDGET_ID_MISMATCH');
  return deepFreeze({ ...input, binding: normalized });
}

function normalizeAxes(input) {
  exactKeys(input, ['x', 'y'], 'DASH085_AXES_SHAPE_INVALID');
  return deepFreeze({
    x: enumValue(input.x, CONTRACT.axis_modes, 'DASH085_AXIS_MODE_INVALID'),
    y: enumValue(input.y, CONTRACT.axis_modes, 'DASH085_AXIS_MODE_INVALID')
  });
}

function normalizeLegend(input) {
  exactKeys(input, ['mode', 'position'], 'DASH085_LEGEND_SHAPE_INVALID');
  return deepFreeze({
    mode: enumValue(input.mode, CONTRACT.legend_modes, 'DASH085_LEGEND_MODE_INVALID'),
    position: enumValue(input.position, CONTRACT.legend_positions, 'DASH085_LEGEND_POSITION_INVALID')
  });
}

function normalizeTopN(input) {
  if (input == null) return null;
  exactKeys(input, ['limit', 'other_policy'], 'DASH085_TOP_N_SHAPE_INVALID');
  if (!Number.isInteger(input.limit) || input.limit < CONTRACT.top_n.min || input.limit > CONTRACT.top_n.max) {
    fail('DASH085_TOP_N_LIMIT_INVALID');
  }
  if (String(input.other_policy || '').toUpperCase() !== CONTRACT.top_n.other_policy) {
    fail('DASH085_TOP_N_OTHER_POLICY_INVALID');
  }
  return deepFreeze({ limit: input.limit, other_policy: CONTRACT.top_n.other_policy });
}

function normalizeOverride(input) {
  assertNoHostilePreference(input, 'widget_override');
  exactKeys(input, [
    'schema', 'contract_version', 'widget_id', 'chart_type', 'axes', 'labels', 'legend',
    'stack', 'sort', 'top_n', 'number_format'
  ], 'DASH085_WIDGET_OVERRIDE_SHAPE_INVALID');
  if (input.schema !== OVERRIDE_SCHEMA || input.contract_version !== VERSION) fail('DASH085_WIDGET_OVERRIDE_VERSION_INVALID');
  const chartType = input.chart_type == null ? null : enumValue(input.chart_type, VIZ_REGISTRY.CHART_TYPES, 'DASH085_CHART_TYPE_INVALID');
  return deepFreeze({
    schema: OVERRIDE_SCHEMA,
    contract_version: VERSION,
    widget_id: safeId(input.widget_id, 'DASH085_WIDGET_ID_INVALID'),
    chart_type: chartType,
    axes: normalizeAxes(input.axes),
    labels: enumValue(input.labels, CONTRACT.label_modes, 'DASH085_LABEL_MODE_INVALID'),
    legend: normalizeLegend(input.legend),
    stack: enumValue(input.stack, CONTRACT.stack_modes, 'DASH085_STACK_MODE_INVALID'),
    sort: enumValue(input.sort, CONTRACT.sort_modes, 'DASH085_SORT_MODE_INVALID'),
    top_n: normalizeTopN(input.top_n),
    number_format: enumValue(input.number_format, NUMBER_FORMATS, 'DASH085_NUMBER_FORMAT_INVALID')
  });
}

function normalizePreference(input) {
  assertContract();
  assertNoHostilePreference(input);
  exactKeys(input, ['schema', 'contract_version', 'theme', 'palette', 'density', 'reduced_motion', 'high_contrast', 'widget_overrides'], 'DASH085_PREFERENCE_SHAPE_INVALID');
  if (input.schema !== PREFERENCE_SCHEMA || input.contract_version !== VERSION || !Array.isArray(input.widget_overrides)) {
    fail('DASH085_PREFERENCE_VERSION_INVALID');
  }
  if (typeof input.reduced_motion !== 'boolean' || typeof input.high_contrast !== 'boolean') fail('DASH085_ACCESSIBILITY_FLAG_INVALID');
  const overrides = input.widget_overrides.map(normalizeOverride).sort((a, b) => a.widget_id.localeCompare(b.widget_id));
  if (new Set(overrides.map((item) => item.widget_id)).size !== overrides.length) fail('DASH085_WIDGET_OVERRIDE_DUPLICATE');
  const body = deepFreeze({
    schema: PREFERENCE_SCHEMA,
    contract_version: VERSION,
    theme: enumValue(input.theme, THEMES, 'DASH085_THEME_INVALID'),
    palette: enumValue(input.palette, PALETTES, 'DASH085_PALETTE_INVALID'),
    density: enumValue(input.density, DENSITIES, 'DASH085_DENSITY_INVALID'),
    reduced_motion: input.reduced_motion,
    high_contrast: input.high_contrast,
    widget_overrides: Object.freeze(overrides)
  });
  return deepFreeze({ ...body, customization_hash: sha256(stableStringify(body)) });
}

function defaultOverride(widgetId) {
  return normalizeOverride({
    schema: OVERRIDE_SCHEMA,
    contract_version: VERSION,
    widget_id: widgetId,
    chart_type: null,
    axes: { x: 'AUTO', y: 'AUTO' },
    labels: 'AUTO',
    legend: { mode: 'AUTO', position: 'AUTO' },
    stack: 'NONE',
    sort: 'NONE',
    top_n: null,
    number_format: 'AUTO'
  });
}

function resolveTheme(preference, systemDark) {
  if (typeof systemDark !== 'boolean') fail('DASH085_SYSTEM_THEME_STATE_INVALID');
  const effective = preference.theme === 'SYSTEM' ? (systemDark ? 'DARK' : 'LIGHT') : preference.theme;
  return deepFreeze({
    requested: preference.theme,
    effective,
    design_theme_ref: `DESIGN:${effective.toLowerCase()}`,
    system_color_scheme_supported: DESIGN.accessibility.system_color_scheme_supported === true
  });
}

function resolvePalette(preference) {
  const requested = preference.palette;
  const effective = preference.high_contrast ? CONTRACT.palette_registry[requested].high_contrast_fallback : requested;
  const palette = CONTRACT.palette_registry[effective];
  return deepFreeze({
    requested,
    effective,
    series: Object.freeze(palette.series.slice()),
    high_contrast_fallback_applied: effective !== requested
  });
}

function resolveDensity(preference) {
  const entry = CONTRACT.density_tokens[preference.density];
  return deepFreeze({
    id: preference.density,
    spacing_ref: `DESIGN:spacing:${entry.spacing_token}`,
    font_size_ref: `DESIGN:typography:size:${entry.font_size_token}`,
    line_height_ref: `DESIGN:typography:line_height:${entry.line_height_token}`,
    min_hit_target_px: entry.min_hit_target_px,
    focus_visible_required: DESIGN.accessibility.focus_visible_required === true
  });
}

function chartWidgetFromBinding(bound) {
  return {
    schema: VIZ.WIDGET_SPEC_SCHEMA,
    contract_version: VIZ.VERSION,
    id: bound.widget_id,
    kind: 'CHART',
    query_ref: `DASH085:${bound.binding.query_hash}`,
    chart_spec: bound.binding.presentation
  };
}

function validateChartPresentation(chartSpec, override) {
  if (chartSpec.type === 'DONUT') {
    if (override.axes.x !== 'AUTO' || override.axes.y !== 'AUTO') fail('DASH085_DONUT_AXES_UNSUPPORTED');
    if (override.stack !== 'NONE') fail('DASH085_DONUT_STACK_UNSUPPORTED');
  }
  if (override.stack === 'NORMAL') {
    if (chartSpec.type !== 'BAR' || !chartSpec.encoding.series) fail('DASH085_STACK_UNSUPPORTED');
  }
  if (override.legend.mode === 'HIDE' && override.legend.position !== 'AUTO') fail('DASH085_HIDDEN_LEGEND_POSITION_INVALID');
  return true;
}

function applyToBoundWidget(preferenceInput, boundInput, options = {}) {
  const preference = normalizePreference(preferenceInput);
  const bound = normalizeBoundDescriptor(boundInput);
  if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some((key) => !['system_dark'].includes(key))) {
    fail('DASH085_PLAN_OPTIONS_INVALID');
  }
  const override = preference.widget_overrides.find((item) => item.widget_id === bound.widget_id) || defaultOverride(bound.widget_id);
  let chartSpec = null;
  let chartType = null;
  if (bound.binding.kind === 'CHART') {
    const widget = chartWidgetFromBinding(bound);
    if (override.chart_type == null || override.chart_type === bound.binding.presentation.type) {
      VIZ_REGISTRY.assertQueryCompatibility(bound.binding.presentation, bound.binding.query);
      chartSpec = bound.binding.presentation;
    } else {
      const retyped = VIZ_REGISTRY.retypeWidget(widget, override.chart_type, bound.binding.query);
      if (retyped.query_hash !== bound.binding.query_hash || retyped.query_modified !== false) fail('DASH085_RETYPE_QUERY_IDENTITY_CHANGED');
      chartSpec = retyped.widget.chart_spec;
    }
    chartType = chartSpec.type;
    validateChartPresentation(chartSpec, override);
  } else {
    if (override.chart_type != null || override.axes.x !== 'AUTO' || override.axes.y !== 'AUTO' ||
        override.labels !== 'AUTO' || override.legend.mode !== 'AUTO' || override.legend.position !== 'AUTO' ||
        override.stack !== 'NONE') {
      fail('DASH085_NON_CHART_OPTION_UNSUPPORTED');
    }
  }
  const theme = resolveTheme(preference, options.system_dark === true);
  const palette = resolvePalette(preference);
  const density = resolveDensity(preference);
  const body = deepFreeze({
    schema: PLAN_SCHEMA,
    contract_version: VERSION,
    widget_id: bound.widget_id,
    widget_kind: bound.binding.kind,
    input_binding_hash: bound.binding.binding_hash,
    query_hash: bound.binding.query_hash,
    query_modified: false,
    binding_modified: false,
    financial_truth_policy: 'FIN-TRUTH-v1',
    customization_hash: preference.customization_hash,
    theme,
    palette,
    density,
    accessibility: {
      reduced_motion: preference.reduced_motion,
      motion_duration_ref: preference.reduced_motion ? 'DESIGN:motion:reduced_motion_ms' : 'DESIGN:motion:normal_ms',
      high_contrast: preference.high_contrast,
      focus_visible_required: true,
      minimum_hit_target_px: Math.max(CONTRACT.accessibility.minimum_hit_target_px, density.min_hit_target_px)
    },
    presentation: {
      chart_type: chartType,
      chart_spec: chartSpec,
      axes: override.axes,
      labels: override.labels,
      legend: override.legend,
      stack: override.stack,
      sort: override.sort,
      top_n: override.top_n,
      number_format: { id: override.number_format, locale: 'ru-RU' }
    }
  });
  return deepFreeze({ ...body, plan_hash: sha256(stableStringify(body)) });
}

function applyTopN(rowsInput, optionsInput = {}) {
  if (!Array.isArray(rowsInput)) fail('DASH085_TOP_N_ROWS_INVALID');
  if (!optionsInput || typeof optionsInput !== 'object' || Array.isArray(optionsInput)) fail('DASH085_TOP_N_OPTIONS_INVALID');
  exactKeys(optionsInput, ['sort', 'top_n'], 'DASH085_TOP_N_OPTIONS_SHAPE_INVALID');
  const sort = enumValue(optionsInput.sort, CONTRACT.sort_modes, 'DASH085_SORT_MODE_INVALID');
  const topN = normalizeTopN(optionsInput.top_n);
  const rows = rowsInput.map((row) => {
    exactKeys(row, ['key', 'value'], 'DASH085_TOP_N_ROW_SHAPE_INVALID');
    const key = String(row.key == null ? '' : row.key).trim();
    if (!key || key === CONTRACT.top_n.other_key) fail('DASH085_TOP_N_KEY_INVALID');
    if (!Number.isSafeInteger(row.value)) fail('DASH085_TOP_N_VALUE_INVALID');
    return { key, value: row.value };
  });
  if (new Set(rows.map((row) => row.key)).size !== rows.length) fail('DASH085_TOP_N_KEY_DUPLICATE');
  const sourceTotal = rows.reduce((sum, row) => {
    const next = sum + row.value;
    if (!Number.isSafeInteger(next)) fail('DASH085_TOP_N_TOTAL_OVERFLOW');
    return next;
  }, 0);
  const ordered = rows.map((row, index) => ({ ...row, __index: index }));
  if (sort !== 'NONE') {
    ordered.sort((a, b) => {
      if (a.value !== b.value) return sort === 'ASC' ? a.value - b.value : b.value - a.value;
      return a.key.localeCompare(b.key);
    });
  }
  const limit = topN == null ? ordered.length : Math.min(topN.limit, ordered.length);
  const kept = ordered.slice(0, limit).map(({ key, value }) => ({ key, value }));
  const remainder = ordered.slice(limit).reduce((sum, row) => sum + row.value, 0);
  if (ordered.length > limit) kept.push({ key: CONTRACT.top_n.other_key, value: remainder });
  const presentedTotal = kept.reduce((sum, row) => sum + row.value, 0);
  if (CONTRACT.top_n.conservation_required === true && presentedTotal !== sourceTotal) fail('DASH085_TOP_N_CONSERVATION_FAILED');
  const body = deepFreeze({
    schema: TOP_N_SCHEMA,
    contract_version: VERSION,
    sort,
    top_n: topN,
    rows: Object.freeze(kept.map((row) => Object.freeze(row))),
    source_total: sourceTotal,
    presented_total: presentedTotal,
    conserved: presentedTotal === sourceTotal,
    financial_truth_policy: 'FIN-TRUTH-v1',
    presentation_only: true
  });
  return deepFreeze({ ...body, presentation_hash: sha256(stableStringify(body)) });
}

function telemetry(planInput, decision = 'ACCEPTED', reason = 'OK') {
  if (!planInput || planInput.schema !== PLAN_SCHEMA || planInput.contract_version !== VERSION) fail('DASH085_PLAN_INVALID');
  const output = deepFreeze({
    schema: SCHEMA,
    version: VERSION,
    theme: planInput.theme.requested,
    density: planInput.density.id,
    widget_kind: planInput.widget_kind,
    customization_hash_prefix: planInput.customization_hash.slice(0, 12),
    query_hash_prefix: planInput.query_hash.slice(0, 12),
    decision: String(decision || '').toUpperCase(),
    reason: String(reason || '').toUpperCase()
  });
  if (JSON.stringify(Object.keys(output).sort()) !== JSON.stringify(CONTRACT.telemetry_allowlist.slice().sort())) {
    fail('DASH085_TELEMETRY_SHAPE_INVALID');
  }
  return output;
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  PREFERENCE_SCHEMA,
  OVERRIDE_SCHEMA,
  PLAN_SCHEMA,
  TOP_N_SCHEMA,
  THEMES,
  DENSITIES,
  NUMBER_FORMATS,
  PALETTES,
  assertContract,
  assertNoHostilePreference,
  normalizeOverride,
  normalizePreference,
  resolveTheme,
  resolvePalette,
  resolveDensity,
  applyToBoundWidget,
  applyTopN,
  telemetry
});
