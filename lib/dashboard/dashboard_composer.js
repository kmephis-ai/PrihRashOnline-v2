'use strict';

const CONTRACT = require('./dashboard_composer.v1.json');

const SCHEMA = 'PRH_DASHBOARD_COMPOSER_V1';
const VERSION = '1.0.0';
const SPEC_SCHEMA = 'PRH_DASHBOARD_SPEC_V1';
const WIDGET_SCHEMA = 'PRH_DASHBOARD_PLACEHOLDER_WIDGET_V1';
const TELEMETRY_SCHEMA = 'PRH_DASHBOARD_COMPOSER_TELEMETRY_V1';
const GRID = CONTRACT.grid;
const FORBIDDEN = CONTRACT.forbidden_payload_key_patterns.map((value) => String(value).toLowerCase());

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function clone(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(clone);
  const output = {};
  for (const key of Object.keys(value)) output[key] = clone(value[key]);
  return output;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function fnv1a32(text) {
  let hash = 0x811c9dc5;
  const value = String(text);
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'DASH-080') {
    fail('DASH080_CONTRACT_INVALID');
  }
  if (CONTRACT.persistence !== 'SESSION_ONLY' || CONTRACT.widget_semantic_binding_status !== 'UNBOUND' || CONTRACT.free_only !== true) {
    fail('DASH080_BOUNDARY_INVALID');
  }
  if (Object.values(CONTRACT.authority || {}).some((value) => value !== false)) fail('DASH080_AUTHORITY_INVALID');
  if (GRID.desktop.columns !== 12 || GRID.tablet.columns !== 6 || GRID.mobile.columns !== 1) fail('DASH080_GRID_INVALID');
  return true;
}

function assertPlainObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
}

function assertNoForbiddenPayload(value, path = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenPayload(item, path.concat(String(index))));
    return true;
  }
  if (!value || typeof value !== 'object') return true;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (FORBIDDEN.some((pattern) => normalized.includes(pattern))) fail('DASH080_FORBIDDEN_PAYLOAD_KEY', path.concat(key).join('.'));
    assertNoForbiddenPayload(child, path.concat(key));
  }
  return true;
}

function integer(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeGeometry(input = {}) {
  assertPlainObject(input, 'DASH080_GEOMETRY_INVALID');
  const allowed = new Set(CONTRACT.allowed_geometry_fields);
  for (const key of Object.keys(input)) if (!allowed.has(key)) fail('DASH080_GEOMETRY_FIELD_INVALID', key);
  return {
    x: Math.max(0, integer(input.x, 0)),
    y: Math.max(0, integer(input.y, 0)),
    w: clamp(integer(input.w, GRID.default_width), GRID.min_width, GRID.max_width),
    h: clamp(integer(input.h, GRID.default_height), GRID.min_height, GRID.max_height)
  };
}

function normalizeWidget(widget) {
  assertPlainObject(widget, 'DASH080_WIDGET_INVALID');
  const allowed = new Set(CONTRACT.allowed_widget_fields);
  for (const key of Object.keys(widget)) if (!allowed.has(key)) fail('DASH080_WIDGET_FIELD_INVALID', key);
  const id = String(widget.id || '').trim();
  if (!/^w-[0-9]{4}$/.test(id)) fail('DASH080_WIDGET_ID_INVALID', id);
  const title = String(widget.title || '').trim();
  if (!title || title.length > 80) fail('DASH080_WIDGET_TITLE_INVALID', id);
  if (widget.schema != null && widget.schema !== WIDGET_SCHEMA) fail('DASH080_WIDGET_SCHEMA_INVALID', id);
  if (widget.semantic_binding_status != null && widget.semantic_binding_status !== 'UNBOUND') fail('DASH080_WIDGET_BOUND_BEFORE_DASH081', id);
  assertNoForbiddenPayload(widget);
  return {
    schema: WIDGET_SCHEMA,
    id,
    title,
    semantic_binding_status: 'UNBOUND',
    geometry: normalizeGeometry(widget.geometry || {})
  };
}

function cellKey(x, y) {
  return `${x}:${y}`;
}

function fits(occupied, geometry, columns, maxRows) {
  if (geometry.x < 0 || geometry.y < 0 || geometry.w < 1 || geometry.h < 1) return false;
  if (geometry.x + geometry.w > columns || geometry.y + geometry.h > maxRows) return false;
  for (let y = geometry.y; y < geometry.y + geometry.h; y += 1) {
    for (let x = geometry.x; x < geometry.x + geometry.w; x += 1) {
      if (occupied.has(cellKey(x, y))) return false;
    }
  }
  return true;
}

function occupy(occupied, geometry) {
  for (let y = geometry.y; y < geometry.y + geometry.h; y += 1) {
    for (let x = geometry.x; x < geometry.x + geometry.w; x += 1) occupied.add(cellKey(x, y));
  }
}

function firstFit(occupied, width, height, columns, maxRows) {
  for (let y = 0; y <= maxRows - height; y += 1) {
    for (let x = 0; x <= columns - width; x += 1) {
      const candidate = { x, y, w: width, h: height };
      if (fits(occupied, candidate, columns, maxRows)) return candidate;
    }
  }
  fail('DASH080_GRID_CAPACITY_EXHAUSTED');
}

function repairDesktop(widgets) {
  const columns = GRID.desktop.columns;
  const maxRows = GRID.desktop.max_rows;
  const requested = widgets.map(normalizeWidget).sort((a, b) =>
    a.geometry.y - b.geometry.y || a.geometry.x - b.geometry.x || a.id.localeCompare(b.id)
  );
  const ids = new Set();
  for (const widget of requested) {
    if (ids.has(widget.id)) fail('DASH080_WIDGET_ID_DUPLICATE', widget.id);
    ids.add(widget.id);
  }
  const occupied = new Set();
  const output = [];
  for (const widget of requested) {
    const geometry = {
      x: widget.geometry.x,
      y: widget.geometry.y,
      w: Math.min(widget.geometry.w, columns),
      h: widget.geometry.h
    };
    const placed = fits(occupied, geometry, columns, maxRows)
      ? geometry
      : firstFit(occupied, geometry.w, geometry.h, columns, maxRows);
    occupy(occupied, placed);
    output.push({ ...widget, geometry: placed });
  }
  return output.sort((a, b) => a.geometry.y - b.geometry.y || a.geometry.x - b.geometry.x || a.id.localeCompare(b.id));
}

function canonicalSpec(input = {}) {
  assertContract();
  assertPlainObject(input, 'DASH080_SPEC_INVALID');
  const allowed = new Set(['schema', 'version', 'id', 'title', 'widgets', 'layout_identity']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) fail('DASH080_SPEC_FIELD_INVALID', key);
  assertNoForbiddenPayload(input);
  if (input.schema != null && input.schema !== SPEC_SCHEMA) fail('DASH080_SPEC_SCHEMA_INVALID');
  if (input.version != null && input.version !== VERSION) fail('DASH080_SPEC_VERSION_INVALID');
  const id = String(input.id || 'dashboard-session').trim();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) fail('DASH080_SPEC_ID_INVALID');
  const title = String(input.title || 'Новый дашборд').trim();
  if (!title || title.length > 100) fail('DASH080_SPEC_TITLE_INVALID');
  const widgets = Array.isArray(input.widgets) ? input.widgets : [];
  if (widgets.length > GRID.max_widgets) fail('DASH080_WIDGET_LIMIT_EXCEEDED');
  const repaired = repairDesktop(widgets);
  const base = { schema: SPEC_SCHEMA, version: VERSION, id, title, widgets: repaired };
  const layout_identity = fnv1a32(stableStringify(base));
  return deepFreeze({ ...base, layout_identity });
}

function defaultSpec() {
  return canonicalSpec({
    schema: SPEC_SCHEMA,
    version: VERSION,
    id: 'dashboard-session',
    title: 'Мой дашборд',
    widgets: [
      { schema: WIDGET_SCHEMA, id: 'w-0001', title: 'Пустой виджет 1', semantic_binding_status: 'UNBOUND', geometry: { x: 0, y: 0, w: 4, h: 2 } },
      { schema: WIDGET_SCHEMA, id: 'w-0002', title: 'Пустой виджет 2', semantic_binding_status: 'UNBOUND', geometry: { x: 4, y: 0, w: 4, h: 2 } }
    ]
  });
}

function nextWidgetId(widgets) {
  let max = 0;
  for (const widget of widgets) {
    const match = /^w-([0-9]{4})$/.exec(widget.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  const next = max + 1;
  if (next > 9999) fail('DASH080_WIDGET_ID_SPACE_EXHAUSTED');
  return `w-${String(next).padStart(4, '0')}`;
}

function requireWidget(spec, widgetId) {
  const index = spec.widgets.findIndex((widget) => widget.id === widgetId);
  if (index < 0) fail('DASH080_WIDGET_NOT_FOUND', widgetId);
  return index;
}

function maxBottom(widgets) {
  return widgets.reduce((value, widget) => Math.max(value, widget.geometry.y + widget.geometry.h), 0);
}

function validateOperation(operation, type) {
  const allowedByType = {
    ADD: new Set(['type', 'title']),
    MOVE: new Set(['type', 'widget_id', 'dx', 'dy']),
    RESIZE: new Set(['type', 'widget_id', 'dw', 'dh']),
    DUPLICATE: new Set(['type', 'widget_id']),
    REMOVE: new Set(['type', 'widget_id']),
    RESET: new Set(['type'])
  };
  const allowed = allowedByType[type];
  if (!allowed) fail('DASH080_OPERATION_UNSUPPORTED', type);
  for (const key of Object.keys(operation)) {
    if (!allowed.has(key)) {
      const normalized = key.toLowerCase();
      if (FORBIDDEN.some((pattern) => normalized.includes(pattern))) fail('DASH080_FORBIDDEN_PAYLOAD_KEY', `operation.${key}`);
      fail('DASH080_OPERATION_FIELD_INVALID', key);
    }
  }
}

function applyOperation(inputSpec, operation) {
  assertPlainObject(operation, 'DASH080_OPERATION_INVALID');
  const before = canonicalSpec(inputSpec);
  const type = String(operation.type || '').trim().toUpperCase();
  if (!CONTRACT.operations.includes(type)) fail('DASH080_OPERATION_UNSUPPORTED', type);
  validateOperation(operation, type);
  if (type === 'RESET') return defaultSpec();

  const draft = clone(before);
  delete draft.layout_identity;
  if (type === 'ADD') {
    if (draft.widgets.length >= GRID.max_widgets) fail('DASH080_WIDGET_LIMIT_EXCEEDED');
    const id = nextWidgetId(draft.widgets);
    draft.widgets.push({
      schema: WIDGET_SCHEMA,
      id,
      title: String(operation.title || `Пустой виджет ${Number(id.slice(2))}`).slice(0, 80),
      semantic_binding_status: 'UNBOUND',
      geometry: { x: 0, y: maxBottom(draft.widgets), w: GRID.default_width, h: GRID.default_height }
    });
    return canonicalSpec(draft);
  }

  const widgetId = String(operation.widget_id || '').trim();
  const index = requireWidget(before, widgetId);
  if (type === 'REMOVE') {
    draft.widgets.splice(index, 1);
    return canonicalSpec(draft);
  }
  if (type === 'DUPLICATE') {
    if (draft.widgets.length >= GRID.max_widgets) fail('DASH080_WIDGET_LIMIT_EXCEEDED');
    const source = draft.widgets[index];
    const id = nextWidgetId(draft.widgets);
    draft.widgets.push({
      schema: WIDGET_SCHEMA,
      id,
      title: `${source.title} копия`.slice(0, 80),
      semantic_binding_status: 'UNBOUND',
      geometry: { ...source.geometry, x: source.geometry.x + 1, y: source.geometry.y + 1 }
    });
    return canonicalSpec(draft);
  }
  if (type === 'MOVE') {
    const dx = clamp(integer(operation.dx, 0), -12, 12);
    const dy = clamp(integer(operation.dy, 0), -48, 48);
    draft.widgets[index].geometry.x = Math.max(0, draft.widgets[index].geometry.x + dx);
    draft.widgets[index].geometry.y = Math.max(0, draft.widgets[index].geometry.y + dy);
    return canonicalSpec(draft);
  }
  if (type === 'RESIZE') {
    const dw = clamp(integer(operation.dw, 0), -12, 12);
    const dh = clamp(integer(operation.dh, 0), -6, 6);
    draft.widgets[index].geometry.w = clamp(draft.widgets[index].geometry.w + dw, GRID.min_width, GRID.max_width);
    draft.widgets[index].geometry.h = clamp(draft.widgets[index].geometry.h + dh, GRID.min_height, GRID.max_height);
    return canonicalSpec(draft);
  }
  fail('DASH080_OPERATION_UNSUPPORTED', type);
}

function repack(widgets, columns, maxRows, widthFn) {
  const occupied = new Set();
  return widgets.map((widget) => {
    const width = clamp(widthFn(widget.geometry.w), 1, columns);
    const height = widget.geometry.h;
    const geometry = firstFit(occupied, width, height, columns, maxRows);
    occupy(occupied, geometry);
    return { ...clone(widget), geometry };
  });
}

function responsiveLayout(inputSpec, viewportClass) {
  const spec = canonicalSpec(inputSpec);
  const viewport = String(viewportClass || '').trim().toUpperCase();
  if (viewport === 'DESKTOP') return deepFreeze({ viewport_class: 'DESKTOP', columns: GRID.desktop.columns, widgets: clone(spec.widgets) });
  if (viewport === 'TABLET') {
    return deepFreeze({
      viewport_class: 'TABLET',
      columns: GRID.tablet.columns,
      widgets: repack(spec.widgets, GRID.tablet.columns, GRID.tablet.max_rows, (width) => Math.ceil(width / 2))
    });
  }
  if (viewport === 'MOBILE') {
    let y = 0;
    const widgets = spec.widgets.map((widget) => {
      const result = { ...clone(widget), geometry: { x: 0, y, w: 1, h: widget.geometry.h } };
      y += widget.geometry.h;
      return result;
    });
    if (y > GRID.mobile.max_rows) fail('DASH080_MOBILE_CAPACITY_EXHAUSTED');
    return deepFreeze({ viewport_class: 'MOBILE', columns: 1, widgets });
  }
  fail('DASH080_VIEWPORT_INVALID', viewport);
}

function viewportClass(width) {
  const numeric = Number(width);
  if (!Number.isFinite(numeric) || numeric < 320) fail('DASH080_VIEWPORT_WIDTH_INVALID');
  if (numeric <= CONTRACT.responsive.mobile_max_px) return 'MOBILE';
  if (numeric <= CONTRACT.responsive.tablet_max_px) return 'TABLET';
  return 'DESKTOP';
}

function telemetry(spec, { action = 'VIEW', viewport_class = 'DESKTOP', decision = 'ALLOW', reason = 'OK' } = {}) {
  const canonical = canonicalSpec(spec);
  const output = deepFreeze({
    schema: TELEMETRY_SCHEMA,
    version: VERSION,
    action: String(action).trim().toUpperCase(),
    widget_count: canonical.widgets.length,
    layout_hash_prefix: canonical.layout_identity.slice(0, 8),
    viewport_class: String(viewport_class).trim().toUpperCase(),
    decision: String(decision).trim().toUpperCase(),
    reason: String(reason).trim().toUpperCase()
  });
  if (stableStringify(Object.keys(output).sort()) !== stableStringify(CONTRACT.telemetry_allowlist.slice().sort())) fail('DASH080_TELEMETRY_SHAPE_INVALID');
  return output;
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  SPEC_SCHEMA,
  WIDGET_SCHEMA,
  TELEMETRY_SCHEMA,
  assertContract,
  stableStringify,
  fnv1a32,
  assertNoForbiddenPayload,
  canonicalSpec,
  defaultSpec,
  applyOperation,
  responsiveLayout,
  viewportClass,
  telemetry
});
