'use strict';

const CONTRACT = require('./analytics_studio_shell.v1.json');
const DESIGN = require('../design/design_system.v1.json');
const ANALYTICS = require('../analytics/analytics_engine');
const EXPLORATION = require('../analytics/exploration_state');
const VIZ = require('../visualization/visualization_registry_v2');

const SCHEMA = 'PRH_ANALYTICS_STUDIO_SHELL_V1';
const VERSION = '1.0.0';
const PREFERENCE_SCHEMA = 'PRH_ANALYTICS_STUDIO_MODE_PREFERENCE_V1';
const STATE_SCHEMA = 'PRH_ANALYTICS_STUDIO_STATE_V1';
const TELEMETRY_SCHEMA = 'PRH_ANALYTICS_STUDIO_TELEMETRY_V1';
const MODES = Object.freeze(Object.keys(CONTRACT.modes));
const FORBIDDEN_KEYS = Object.freeze([
  'amount', 'amount_minor', 'value', 'value_minor', 'transaction', 'transactions', 'rows', 'dataset',
  'query', 'analytics_query', 'filters', 'filter_context', 'account', 'account_id', 'category', 'category_id',
  'member', 'member_id', 'project', 'project_id', 'token', 'credential', 'runtime_locator'
]);

function fail(reason, detail) {
  const error = new Error(detail ? `${reason}:${detail}` : reason);
  error.code = reason;
  throw error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function exactKeys(value, allowed, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length) fail(reason, extra.join(','));
}

function assertNoPayload(value, path = 'studio') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPayload(item, `${path}[${index}]`));
    return true;
  }
  if (!value || typeof value !== 'object') return true;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (FORBIDDEN_KEYS.includes(normalized) || normalized.endsWith('_amount') || normalized.endsWith('_amount_minor')) {
      fail('STUDIO080_FORBIDDEN_PAYLOAD_KEY', `${path}.${key}`);
    }
    assertNoPayload(child, `${path}.${key}`);
  }
  return true;
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'STUDIO-080') {
    fail('STUDIO080_CONTRACT_VERSION_INVALID');
  }
  if (CONTRACT.schemas.preference !== PREFERENCE_SCHEMA || CONTRACT.schemas.state !== STATE_SCHEMA || CONTRACT.schemas.telemetry !== TELEMETRY_SCHEMA) {
    fail('STUDIO080_SCHEMA_CONTRACT_INVALID');
  }
  if (DESIGN.schema !== 'PRH_DESIGN_SYSTEM_V1' || DESIGN.version !== '1.0.0') fail('STUDIO080_DESIGN_UPSTREAM_INVALID');
  ANALYTICS.assertContract();
  EXPLORATION.assertContract();
  VIZ.assertContract();
  const upstream = CONTRACT.upstream || {};
  if (upstream.design_system !== `${DESIGN.schema}@${DESIGN.version}` ||
      upstream.analytics_contract !== 'PRH_ANALYTICS_CONTRACT_V1@1.0.0' ||
      upstream.exploration_state !== `${EXPLORATION.SCHEMA}@${EXPLORATION.VERSION}` ||
      upstream.visualization_registry !== `${VIZ.SCHEMA}@${VIZ.VERSION}` ||
      upstream.financial_truth_policy !== 'FIN-TRUTH-v1') {
    fail('STUDIO080_UPSTREAM_CONTRACT_INVALID');
  }
  if (CONTRACT.default_mode !== 'DAILY' || JSON.stringify(MODES) !== JSON.stringify(['DAILY', 'EXPLORE', 'STUDIO'])) {
    fail('STUDIO080_MODE_CONTRACT_INVALID');
  }
  const ranks = MODES.map((mode) => CONTRACT.modes[mode].rank);
  if (JSON.stringify(ranks) !== JSON.stringify([0, 1, 2])) fail('STUDIO080_MODE_RANK_INVALID');
  let previous = new Set();
  for (const mode of MODES) {
    const current = new Set(CONTRACT.modes[mode].capabilities || []);
    for (const capability of previous) if (!current.has(capability)) fail('STUDIO080_CAPABILITY_MONOTONICITY_INVALID', `${mode}:${capability}`);
    previous = current;
  }
  if (CONTRACT.modes.DAILY.surface !== 'home' || CONTRACT.modes.EXPLORE.surface !== 'studio' || CONTRACT.modes.STUDIO.surface !== 'studio') {
    fail('STUDIO080_SURFACE_MAPPING_INVALID');
  }
  if (CONTRACT.preference.url_override_priority !== true || CONTRACT.preference.invalid_explicit_mode_behavior !== 'DAILY_FAIL_SAFE' ||
      CONTRACT.preference.financial_payload_allowed !== false || CONTRACT.preference.query_payload_allowed !== false ||
      CONTRACT.preference.filter_payload_allowed !== false || CONTRACT.preference.private_identifier_allowed !== false) {
    fail('STUDIO080_PREFERENCE_BOUNDARY_INVALID');
  }
  if (CONTRACT.responsive.mobile_max_width_px !== DESIGN.breakpoints_px.mobile_max ||
      CONTRACT.responsive.tablet_max_width_px !== DESIGN.breakpoints_px.tablet_max) {
    fail('STUDIO080_BREAKPOINT_UPSTREAM_INVALID');
  }
  if (Object.values(CONTRACT.authority || {}).some((value) => value !== false)) fail('STUDIO080_AUTHORITY_INVALID');
  const runtime = CONTRACT.runtime || {};
  if (runtime.private_exposure !== 'MYSELF' || runtime.studio_financial_runtime_fetch !== false ||
      runtime.synthetic_financial_preview_allowed !== false || runtime.default_route_changes !== false ||
      runtime.paid_dependency_required !== false || runtime.free_only !== true) {
    fail('STUDIO080_RUNTIME_BOUNDARY_INVALID');
  }
  return true;
}

function normalizeMode(value, { failSafe = false } = {}) {
  const mode = String(value == null ? '' : value).trim().toUpperCase();
  if (MODES.includes(mode)) return mode;
  if (failSafe) return CONTRACT.default_mode;
  fail('STUDIO080_MODE_INVALID');
}

function normalizePreference(input = {}) {
  assertContract();
  assertNoPayload(input, 'preference');
  exactKeys(input, ['schema', 'version', 'mode'], 'STUDIO080_PREFERENCE_SHAPE_INVALID');
  if (input.schema != null && input.schema !== PREFERENCE_SCHEMA) fail('STUDIO080_PREFERENCE_SCHEMA_INVALID');
  if (input.version != null && input.version !== VERSION) fail('STUDIO080_PREFERENCE_VERSION_INVALID');
  return deepFreeze({
    schema: PREFERENCE_SCHEMA,
    version: VERSION,
    mode: normalizeMode(input.mode == null ? CONTRACT.default_mode : input.mode)
  });
}

function safeStoredPreference(input) {
  try {
    return normalizePreference(input || {});
  } catch (error) {
    return normalizePreference({ mode: CONTRACT.default_mode });
  }
}

function resolveMode({ url_mode = null, stored_preference = null } = {}) {
  assertContract();
  const explicit = String(url_mode == null ? '' : url_mode).trim();
  if (explicit) {
    const valid = MODES.includes(explicit.toUpperCase());
    return deepFreeze({
      mode: valid ? explicit.toUpperCase() : CONTRACT.default_mode,
      source: valid ? 'URL' : 'URL_FAIL_SAFE',
      explicit_invalid: !valid
    });
  }
  const preference = safeStoredPreference(stored_preference || {});
  return deepFreeze({ mode: preference.mode, source: stored_preference ? 'PREFERENCE' : 'DEFAULT', explicit_invalid: false });
}

function transitionMode(currentInput, targetInput, source = 'USER') {
  assertContract();
  const current = normalizeMode(currentInput, { failSafe: true });
  const target = normalizeMode(targetInput);
  return deepFreeze({
    schema: STATE_SCHEMA,
    version: VERSION,
    mode: target,
    previous_mode: current,
    source: String(source || 'USER').trim().toUpperCase(),
    changed: target !== current,
    reversible: true,
    surface: CONTRACT.modes[target].surface,
    query_execution: false,
    financial_write: false
  });
}

function viewportClass(widthPx) {
  const width = Number(widthPx);
  const policy = CONTRACT.responsive;
  if (!Number.isInteger(width) || width < policy.minimum_width_px || width > policy.maximum_tested_width_px) {
    fail('STUDIO080_VIEWPORT_WIDTH_INVALID');
  }
  if (width <= policy.mobile_max_width_px) return 'MOBILE';
  if (width <= policy.tablet_max_width_px) return 'TABLET';
  return 'DESKTOP';
}

function shellDescriptor(modeInput) {
  assertContract();
  const mode = normalizeMode(modeInput, { failSafe: true });
  const spec = CONTRACT.modes[mode];
  const future = (spec.capabilities || [])
    .filter((capability) => Object.prototype.hasOwnProperty.call(CONTRACT.future_affordances, capability))
    .map((capability) => ({ capability, ...CONTRACT.future_affordances[capability] }));
  return deepFreeze({
    schema: STATE_SCHEMA,
    version: VERSION,
    mode,
    surface: spec.surface,
    label: spec.label,
    title: spec.title,
    description: spec.description,
    capabilities: spec.capabilities.slice(),
    future_affordances: future,
    financial_truth_policy: 'FIN-TRUTH-v1',
    query_execution: false,
    query_mutation: false,
    financial_write: false
  });
}

function modeHref(modeInput) {
  const mode = normalizeMode(modeInput);
  if (mode === 'DAILY') return '?surface=home&mode=daily';
  return `?surface=studio&mode=${mode.toLowerCase()}`;
}

function telemetry({ mode, previous_mode = null, source = 'DEFAULT', viewport_class = 'DESKTOP', decision = 'ALLOW', reason = 'OK' } = {}) {
  assertContract();
  const output = deepFreeze({
    schema: TELEMETRY_SCHEMA,
    version: VERSION,
    mode: normalizeMode(mode, { failSafe: true }),
    previous_mode: previous_mode == null ? null : normalizeMode(previous_mode, { failSafe: true }),
    source: String(source || '').trim().toUpperCase(),
    viewport_class: String(viewport_class || '').trim().toUpperCase(),
    decision: String(decision || '').trim().toUpperCase(),
    reason: String(reason || '').trim().toUpperCase()
  });
  if (JSON.stringify(Object.keys(output).sort()) !== JSON.stringify(CONTRACT.telemetry_allowlist.slice().sort())) {
    fail('STUDIO080_TELEMETRY_SHAPE_INVALID');
  }
  assertNoPayload(output, 'telemetry');
  return output;
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  PREFERENCE_SCHEMA,
  STATE_SCHEMA,
  TELEMETRY_SCHEMA,
  MODES,
  assertContract,
  assertNoPayload,
  normalizeMode,
  normalizePreference,
  resolveMode,
  transitionMode,
  viewportClass,
  shellDescriptor,
  modeHref,
  telemetry
});
