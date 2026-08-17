'use strict';

const crypto = require('crypto');
const CONTRACT = require('./exploration_state.v1.json');
const SEMANTIC = require('./semantic_registry.v1.json');
const SCOPE = require('./analytics_scope');
const VIZ = require('../visualization/visualization_foundation');

const SCHEMA = 'PRH_EXPLORATION_STATE_V1';
const VERSION = '1.0.0';
const SESSION_SCHEMA = 'PRH_EXPLORATION_SESSION_V1';
const URL_PREFIX = CONTRACT.url_state.prefix;
const WIDGET_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SCOPE_MODES = Object.freeze(CONTRACT.state.widget_scope_modes.slice());
const ACTIONS = Object.freeze(CONTRACT.actions.slice());
const FORBIDDEN_KEYS = new Set(CONTRACT.forbidden_payload_keys.map((key) => key.toLowerCase()));

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function exactKeys(value, keys, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(reason);
  return value;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function assertNoFinancialPayloadKeys(value, path = 'state') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoFinancialPayloadKeys(item, `${path}[${index}]`));
    return true;
  }
  if (!value || typeof value !== 'object') return true;
  for (const [key, child] of Object.entries(value)) {
    const normalized = String(key).toLowerCase();
    if (FORBIDDEN_KEYS.has(normalized) || normalized.endsWith('_amount') || normalized.endsWith('_amount_minor')) {
      fail(`EXPLORATION_FINANCIAL_PAYLOAD_FORBIDDEN:${path}.${key}`);
    }
    assertNoFinancialPayloadKeys(child, `${path}.${key}`);
  }
  return true;
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION ||
      CONTRACT.session_schema !== SESSION_SCHEMA || CONTRACT.roadmap_id !== 'ANL-074') {
    fail('EXPLORATION_CONTRACT_VERSION_INVALID');
  }
  if (!CONTRACT.upstream ||
      CONTRACT.upstream.visualization_foundation !== `${VIZ.FOUNDATION_SCHEMA}@${VIZ.VERSION}` ||
      CONTRACT.upstream.filter_context !== `${VIZ.FILTER_CONTEXT_SCHEMA}@${VIZ.VERSION}` ||
      CONTRACT.upstream.drill_context !== `${VIZ.DRILL_CONTEXT_SCHEMA}@${VIZ.VERSION}` ||
      CONTRACT.upstream.semantic_registry !== `${SEMANTIC.schema}@${SEMANTIC.version}` ||
      CONTRACT.upstream.analytics_scope !== `${SCOPE.SCHEMA}@${SCOPE.VERSION}` ||
      CONTRACT.upstream.financial_truth_policy !== 'FIN-TRUTH-v1') {
    fail('EXPLORATION_UPSTREAM_CONTRACT_INVALID');
  }
  if (CONTRACT.filter_composition.reuse_viz_filter_context !== true ||
      CONTRACT.filter_composition.same_field_include !== 'SET_INTERSECTION' ||
      CONTRACT.filter_composition.same_field_exclude !== 'SET_UNION' ||
      CONTRACT.filter_composition.empty_effective_include !== 'DENY_CONTRADICTION' ||
      CONTRACT.scope_composition.implicit_scope_merge !== false ||
      CONTRACT.state.history_serialized !== false ||
      CONTRACT.url_state.private_app_only !== true || CONTRACT.url_state.public_shareable !== false ||
      CONTRACT.url_state.history_included !== false || CONTRACT.url_state.analytics_results_included !== false ||
      CONTRACT.url_state.scope_assignments_included !== false) {
    fail('EXPLORATION_BOUNDARY_INVALID');
  }
  if (!CONTRACT.authorities || Object.values(CONTRACT.authorities).some((value) => value !== false) || CONTRACT.free_only !== true) {
    fail('EXPLORATION_AUTHORITY_INVALID');
  }
  return true;
}

function stripFilterContext(input) {
  const normalized = VIZ.normalizeFilterContext(input);
  return Object.freeze({
    schema: normalized.schema,
    contract_version: normalized.contract_version,
    filters: Object.freeze(normalized.filters.map((item) => Object.freeze({
      kind: item.kind,
      field: item.field,
      operator: item.operator,
      values: Object.freeze(item.values.slice())
    })))
  });
}

function emptyFilterContext() {
  return stripFilterContext({
    schema: VIZ.FILTER_CONTEXT_SCHEMA,
    contract_version: VIZ.VERSION,
    filters: []
  });
}

function stripDrillContext(input) {
  const normalized = VIZ.normalizeDrillContext(input);
  return Object.freeze({
    schema: normalized.schema,
    contract_version: normalized.contract_version,
    source_widget_id: normalized.source_widget_id,
    target: normalized.target,
    filter_context: stripFilterContext(normalized.filter_context)
  });
}

function normalizeGlobalContext(input) {
  exactKeys(input, ['filter_context', 'scope_spec'], 'EXPLORATION_GLOBAL_CONTEXT_SHAPE_INVALID');
  return Object.freeze({
    filter_context: stripFilterContext(input.filter_context),
    scope_spec: SCOPE.normalizeScopeSpec(input.scope_spec)
  });
}

function normalizeWidgetContext(input) {
  exactKeys(input, ['widget_id', 'filter_context', 'scope_mode', 'scope_spec'], 'EXPLORATION_WIDGET_CONTEXT_SHAPE_INVALID');
  const widgetId = String(input.widget_id || '').trim();
  if (!WIDGET_ID_RE.test(widgetId)) fail('EXPLORATION_WIDGET_ID_INVALID');
  const scopeMode = String(input.scope_mode || '').trim();
  if (!SCOPE_MODES.includes(scopeMode)) fail('EXPLORATION_WIDGET_SCOPE_MODE_INVALID');
  let scopeSpec = null;
  if (scopeMode === 'INHERIT_GLOBAL') {
    if (input.scope_spec != null) fail('EXPLORATION_WIDGET_INHERIT_SCOPE_MUST_BE_NULL');
  } else {
    if (input.scope_spec == null) fail('EXPLORATION_WIDGET_OVERRIDE_SCOPE_REQUIRED');
    scopeSpec = SCOPE.normalizeScopeSpec(input.scope_spec);
  }
  return Object.freeze({
    widget_id: widgetId,
    filter_context: stripFilterContext(input.filter_context),
    scope_mode: scopeMode,
    scope_spec: scopeSpec
  });
}

function stateBody(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) fail('EXPLORATION_STATE_INVALID');
  const allowed = ['schema', 'contract_version', 'global_context', 'widget_contexts', 'drill_context'];
  const withHash = [...allowed, 'state_hash'];
  const keys = Object.keys(state).sort();
  if (JSON.stringify(keys) !== JSON.stringify(allowed.slice().sort()) && JSON.stringify(keys) !== JSON.stringify(withHash.slice().sort())) {
    fail('EXPLORATION_STATE_SHAPE_INVALID');
  }
  return {
    schema: state.schema,
    contract_version: state.contract_version,
    global_context: state.global_context,
    widget_contexts: state.widget_contexts,
    drill_context: state.drill_context
  };
}

function normalizeState(input) {
  assertContract();
  assertNoFinancialPayloadKeys(input);
  const raw = stateBody(input);
  if (raw.schema !== SCHEMA || raw.contract_version !== VERSION) fail('EXPLORATION_STATE_VERSION_INVALID');
  const globalContext = normalizeGlobalContext(raw.global_context);
  if (!Array.isArray(raw.widget_contexts)) fail('EXPLORATION_WIDGET_CONTEXTS_INVALID');
  const widgets = raw.widget_contexts.map(normalizeWidgetContext).sort((a, b) => a.widget_id.localeCompare(b.widget_id));
  if (new Set(widgets.map((item) => item.widget_id)).size !== widgets.length) fail('EXPLORATION_WIDGET_CONTEXT_DUPLICATE');
  const drillContext = raw.drill_context == null ? null : stripDrillContext(raw.drill_context);
  const body = Object.freeze({
    schema: SCHEMA,
    contract_version: VERSION,
    global_context: globalContext,
    widget_contexts: Object.freeze(widgets),
    drill_context: drillContext
  });
  const stateHash = sha256(stableStringify(body));
  if (Object.prototype.hasOwnProperty.call(input, 'state_hash') && input.state_hash !== stateHash) fail('EXPLORATION_STATE_HASH_MISMATCH');
  return Object.freeze({ ...body, state_hash: stateHash });
}

function defaultState() {
  return normalizeState({
    schema: SCHEMA,
    contract_version: VERSION,
    global_context: {
      filter_context: emptyFilterContext(),
      scope_spec: SCOPE.builtInScope(CONTRACT.state.default_scope_id)
    },
    widget_contexts: [],
    drill_context: null
  });
}

function mergeFilterContexts(...inputs) {
  assertContract();
  const contexts = inputs.filter((item) => item != null).map(stripFilterContext);
  const byField = new Map();
  for (const context of contexts) {
    for (const item of context.filters) {
      if (!byField.has(item.field)) byField.set(item.field, { includes: [], excludes: new Set() });
      const entry = byField.get(item.field);
      if (item.operator === 'INCLUDE') entry.includes.push(new Set(item.values));
      else if (item.operator === 'EXCLUDE') item.values.forEach((value) => entry.excludes.add(value));
      else fail('EXPLORATION_FILTER_OPERATOR_INVALID');
    }
  }

  const filters = [];
  for (const field of Array.from(byField.keys()).sort()) {
    const entry = byField.get(field);
    let include = null;
    for (const candidate of entry.includes) {
      if (include == null) include = new Set(candidate);
      else include = new Set(Array.from(include).filter((value) => candidate.has(value)));
    }
    const excludes = Array.from(entry.excludes).sort();
    if (include != null) {
      const effective = Array.from(include).filter((value) => !entry.excludes.has(value)).sort();
      if (effective.length === 0) fail('EXPLORATION_FILTER_CONTRADICTION');
      filters.push({ kind: 'DIMENSION', field, operator: 'INCLUDE', values: effective });
    }
    if (excludes.length > 0) filters.push({ kind: 'DIMENSION', field, operator: 'EXCLUDE', values: excludes });
  }
  return stripFilterContext({
    schema: VIZ.FILTER_CONTEXT_SCHEMA,
    contract_version: VIZ.VERSION,
    filters
  });
}

function widgetContextOrDefault(state, widgetId) {
  const id = String(widgetId || '').trim();
  if (!WIDGET_ID_RE.test(id)) fail('EXPLORATION_WIDGET_ID_INVALID');
  const found = state.widget_contexts.find((item) => item.widget_id === id);
  if (found) return found;
  return Object.freeze({
    widget_id: id,
    filter_context: emptyFilterContext(),
    scope_mode: 'INHERIT_GLOBAL',
    scope_spec: null
  });
}

function effectiveWidgetContext(stateInput, widgetId) {
  const state = normalizeState(stateInput);
  const widget = widgetContextOrDefault(state, widgetId);
  const filterContext = mergeFilterContexts(state.global_context.filter_context, widget.filter_context);
  const scopeSpec = widget.scope_mode === 'OVERRIDE' ? widget.scope_spec : state.global_context.scope_spec;
  return Object.freeze({
    widget_id: widget.widget_id,
    filter_context: filterContext,
    scope_spec: scopeSpec,
    scope_source: widget.scope_mode === 'OVERRIDE' ? 'WIDGET_OVERRIDE' : 'GLOBAL_INHERITED'
  });
}

function effectiveDrillContext(stateInput) {
  const state = normalizeState(stateInput);
  if (state.drill_context == null) return null;
  const source = effectiveWidgetContext(state, state.drill_context.source_widget_id);
  const combined = mergeFilterContexts(source.filter_context, state.drill_context.filter_context);
  return stripDrillContext({
    schema: VIZ.DRILL_CONTEXT_SCHEMA,
    contract_version: VIZ.VERSION,
    source_widget_id: state.drill_context.source_widget_id,
    target: state.drill_context.target,
    filter_context: combined
  });
}

function canonicalBody(stateInput) {
  const state = normalizeState(stateInput);
  return Object.freeze({
    schema: state.schema,
    contract_version: state.contract_version,
    global_context: state.global_context,
    widget_contexts: state.widget_contexts,
    drill_context: state.drill_context
  });
}

function encodeState(stateInput) {
  const body = canonicalBody(stateInput);
  const json = stableStringify(body);
  const bytes = Buffer.byteLength(json, 'utf8');
  if (bytes > CONTRACT.url_state.max_json_bytes) fail('EXPLORATION_URL_STATE_TOO_LARGE');
  const token = URL_PREFIX + Buffer.from(json, 'utf8').toString('base64url');
  if (token.length > CONTRACT.url_state.max_encoded_chars) fail('EXPLORATION_URL_STATE_TOO_LARGE');
  return token;
}

function decodeState(tokenInput) {
  const token = String(tokenInput || '');
  if (!token.startsWith(URL_PREFIX)) fail('EXPLORATION_URL_STATE_PREFIX_INVALID');
  if (token.length > CONTRACT.url_state.max_encoded_chars) fail('EXPLORATION_URL_STATE_TOO_LARGE');
  const payload = token.slice(URL_PREFIX.length);
  if (!payload || !/^[A-Za-z0-9_-]+$/.test(payload)) fail('EXPLORATION_URL_STATE_ENCODING_INVALID');
  let json;
  try {
    const buffer = Buffer.from(payload, 'base64url');
    if (buffer.length > CONTRACT.url_state.max_json_bytes) fail('EXPLORATION_URL_STATE_TOO_LARGE');
    json = buffer.toString('utf8');
  } catch (error) {
    if (error && error.code) throw error;
    fail('EXPLORATION_URL_STATE_ENCODING_INVALID');
  }
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (_) {
    fail('EXPLORATION_URL_STATE_JSON_INVALID');
  }
  const normalized = normalizeState(parsed);
  if (encodeState(normalized) !== token) fail('EXPLORATION_URL_STATE_NON_CANONICAL');
  return normalized;
}

function createSession(initialState) {
  const present = initialState == null ? defaultState() : normalizeState(initialState);
  return Object.freeze({
    schema: SESSION_SCHEMA,
    contract_version: VERSION,
    present,
    history: Object.freeze([])
  });
}

function normalizeSession(session) {
  exactKeys(session, ['schema', 'contract_version', 'present', 'history'], 'EXPLORATION_SESSION_SHAPE_INVALID');
  if (session.schema !== SESSION_SCHEMA || session.contract_version !== VERSION) fail('EXPLORATION_SESSION_VERSION_INVALID');
  if (!Array.isArray(session.history) || session.history.length > CONTRACT.history.max_depth) fail('EXPLORATION_SESSION_HISTORY_INVALID');
  const present = normalizeState(session.present);
  const history = session.history.map(normalizeState);
  return Object.freeze({ schema: SESSION_SCHEMA, contract_version: VERSION, present, history: Object.freeze(history) });
}

function pushState(session, next) {
  if (next.state_hash === session.present.state_hash) return session;
  const history = [...session.history, session.present];
  while (history.length > CONTRACT.history.max_depth) history.shift();
  return Object.freeze({
    schema: SESSION_SCHEMA,
    contract_version: VERSION,
    present: next,
    history: Object.freeze(history)
  });
}

function replaceWidget(state, widget) {
  const widgets = state.widget_contexts.filter((item) => item.widget_id !== widget.widget_id).map((item) => ({
    widget_id: item.widget_id,
    filter_context: item.filter_context,
    scope_mode: item.scope_mode,
    scope_spec: item.scope_spec
  }));
  widgets.push(widget);
  widgets.sort((a, b) => a.widget_id.localeCompare(b.widget_id));
  return widgets;
}

function dispatch(sessionInput, action) {
  const session = normalizeSession(sessionInput);
  assertNoFinancialPayloadKeys(action, 'action');
  if (!action || typeof action !== 'object' || Array.isArray(action)) fail('EXPLORATION_ACTION_INVALID');
  const type = String(action.type || '').trim();
  if (!ACTIONS.includes(type)) fail('EXPLORATION_ACTION_UNKNOWN');

  if (type === 'BACK') {
    exactKeys(action, ['type'], 'EXPLORATION_ACTION_SHAPE_INVALID');
    if (session.history.length === 0) return session;
    const history = session.history.slice(0, -1);
    return Object.freeze({
      schema: SESSION_SCHEMA,
      contract_version: VERSION,
      present: session.history[session.history.length - 1],
      history: Object.freeze(history)
    });
  }

  let body = stateBody(session.present);
  if (type === 'RESET') {
    exactKeys(action, ['type'], 'EXPLORATION_ACTION_SHAPE_INVALID');
    return pushState(session, defaultState());
  }
  if (type === 'SET_GLOBAL_CONTEXT') {
    exactKeys(action, ['type', 'filter_context', 'scope_spec'], 'EXPLORATION_ACTION_SHAPE_INVALID');
    body = { ...body, global_context: normalizeGlobalContext({ filter_context: action.filter_context, scope_spec: action.scope_spec }) };
  } else if (type === 'SET_WIDGET_CONTEXT') {
    exactKeys(action, ['type', 'widget_id', 'filter_context', 'scope_mode', 'scope_spec'], 'EXPLORATION_ACTION_SHAPE_INVALID');
    const widget = normalizeWidgetContext({
      widget_id: action.widget_id,
      filter_context: action.filter_context,
      scope_mode: action.scope_mode,
      scope_spec: action.scope_spec
    });
    body = { ...body, widget_contexts: replaceWidget(session.present, widget) };
  } else if (type === 'REMOVE_WIDGET_CONTEXT') {
    exactKeys(action, ['type', 'widget_id'], 'EXPLORATION_ACTION_SHAPE_INVALID');
    const widgetId = String(action.widget_id || '').trim();
    if (!WIDGET_ID_RE.test(widgetId)) fail('EXPLORATION_WIDGET_ID_INVALID');
    body = { ...body, widget_contexts: session.present.widget_contexts.filter((item) => item.widget_id !== widgetId) };
  } else if (type === 'SET_DRILL_CONTEXT') {
    exactKeys(action, ['type', 'drill_context'], 'EXPLORATION_ACTION_SHAPE_INVALID');
    body = { ...body, drill_context: stripDrillContext(action.drill_context) };
  } else if (type === 'CLEAR_DRILL_CONTEXT') {
    exactKeys(action, ['type'], 'EXPLORATION_ACTION_SHAPE_INVALID');
    body = { ...body, drill_context: null };
  }

  return pushState(session, normalizeState(body));
}

function stateTelemetry(sessionInput, action, decision = 'APPLIED', reason = 'OK') {
  const session = normalizeSession(sessionInput);
  const actionId = String(action || 'NONE');
  if (actionId !== 'NONE' && !ACTIONS.includes(actionId)) fail('EXPLORATION_TELEMETRY_ACTION_INVALID');
  return Object.freeze({
    schema: SCHEMA,
    version: VERSION,
    action: actionId,
    decision: String(decision),
    reason: String(reason),
    state_hash: session.present.state_hash,
    history_depth: session.history.length,
    widget_count: session.present.widget_contexts.length,
    global_scope_id: session.present.global_context.scope_spec.scope_id,
    drill_active: session.present.drill_context != null
  });
}

assertContract();

module.exports = Object.freeze({
  SCHEMA,
  VERSION,
  SESSION_SCHEMA,
  URL_PREFIX,
  SCOPE_MODES,
  ACTIONS,
  CONTRACT,
  assertContract,
  assertNoFinancialPayloadKeys,
  emptyFilterContext,
  normalizeGlobalContext,
  normalizeWidgetContext,
  normalizeState,
  defaultState,
  mergeFilterContexts,
  effectiveWidgetContext,
  effectiveDrillContext,
  encodeState,
  decodeState,
  createSession,
  normalizeSession,
  dispatch,
  stateTelemetry
});
