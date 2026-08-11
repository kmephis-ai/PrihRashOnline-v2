'use strict';

const crypto = require('crypto');
const CONTRACT = require('./dashboard_interaction_bus.v1.json');
const FACTORY = require('./widget_factory');
const EXPLORATION = require('../analytics/exploration_state');
const VIZ = require('../visualization/visualization_foundation');

const SCHEMA = 'PRH_DASHBOARD_INTERACTION_BUS_V1';
const VERSION = '1.0.0';
const REGISTRY_SCHEMA = 'PRH_DASHBOARD_INTERACTION_REGISTRY_V1';
const EVENT_SCHEMA = 'PRH_DASHBOARD_INTERACTION_EVENT_V1';
const SESSION_SCHEMA = 'PRH_DASHBOARD_INTERACTION_SESSION_V1';
const RESULT_SCHEMA = 'PRH_DASHBOARD_INTERACTION_RESULT_V1';
const EVENT_TYPES = Object.freeze(CONTRACT.event_types.slice());
const OPERATIONS = Object.freeze(CONTRACT.selection_operations.slice());
const FILTER_OPERATORS = Object.freeze(CONTRACT.filter_operators.slice());
const DIMENSIONS = Object.freeze(VIZ.CONTRACT.encoding_registry.dimension_ids.slice());
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const FORBIDDEN_KEYS = new Set([
  'analytics_result', 'analytics_results', 'dataset', 'data', 'rows', 'points', 'transactions',
  'transaction_rows', 'records', 'result', 'results', 'financial_values', 'amount', 'amount_minor',
  'balance_minor', 'income_minor', 'expense_minor', 'cash_flow_minor', 'savings_minor',
  'budget_variance_minor', 'gross_expense_minor', 'refund_minor', 'transfer_minor'
]);

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
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

function exactKeys(value, allowed, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(allowed.slice().sort())) fail(reason);
  return value;
}

function safeId(value, reason) {
  const text = String(value == null ? '' : value).trim();
  if (!ID_RE.test(text)) fail(reason);
  return text;
}

function assertNoFinancialPayload(value, path = 'interaction') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoFinancialPayload(item, `${path}[${index}]`));
    return true;
  }
  if (!value || typeof value !== 'object') return true;
  for (const [key, child] of Object.entries(value)) {
    const normalized = String(key).toLowerCase();
    if (FORBIDDEN_KEYS.has(normalized) || normalized.endsWith('_amount') || normalized.endsWith('_amount_minor')) {
      fail('DASH082_FINANCIAL_PAYLOAD_FORBIDDEN', `${path}.${key}`);
    }
    assertNoFinancialPayload(child, `${path}.${key}`);
  }
  return true;
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'DASH-082' ||
      CONTRACT.registry_schema !== REGISTRY_SCHEMA || CONTRACT.event_schema !== EVENT_SCHEMA ||
      CONTRACT.session_schema !== SESSION_SCHEMA || CONTRACT.result_schema !== RESULT_SCHEMA) {
    fail('DASH082_CONTRACT_INVALID');
  }
  FACTORY.assertContract();
  EXPLORATION.assertContract();
  VIZ.assertContract();
  const upstream = CONTRACT.upstream || {};
  if (upstream.widget_factory !== `${FACTORY.SCHEMA}@${FACTORY.VERSION}` ||
      upstream.exploration_state !== `${EXPLORATION.SCHEMA}@${EXPLORATION.VERSION}` ||
      upstream.filter_context !== `${VIZ.FILTER_CONTEXT_SCHEMA}@${VIZ.VERSION}` ||
      upstream.financial_truth_policy !== 'FIN-TRUTH-v1') fail('DASH082_UPSTREAM_CONTRACT_INVALID');
  const p = CONTRACT.principles || {};
  if (p.configuration_only !== true || p.shared_context_target !== 'GLOBAL_FILTER_CONTEXT_ONLY' ||
      p.widget_context_mutation_allowed !== false || p.drill_context_mutation_allowed !== false ||
      p.scope_mutation_allowed !== false || p.binding_mutation_allowed !== false || p.layout_mutation_allowed !== false ||
      p.query_execution_authority !== false || p.query_mutation_allowed !== false || p.financial_payload_allowed !== false ||
      p.event_replay_mutates_state !== false || p.loop_prevention !== 'ORIGIN_DEDUP_PLUS_MAX_HOP' ||
      p.public_financial_evidence !== 'SYNTHETIC_ONLY' || p.free_only !== true) fail('DASH082_BOUNDARY_INVALID');
  if (!CONTRACT.authority || Object.values(CONTRACT.authority).some((value) => value !== false)) fail('DASH082_AUTHORITY_INVALID');
  return true;
}

function normalizeFactoryBinding(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('DASH082_BINDING_INVALID');
  const baseKeys = ['schema', 'contract_version', 'widget_id', 'kind', 'query', 'presentation'];
  const normalizedKeys = baseKeys.concat(['query_hash', 'query_modified', 'financial_truth_policy', 'binding_hash']);
  const keys = Object.keys(input).sort();
  const isBase = JSON.stringify(keys) === JSON.stringify(baseKeys.slice().sort());
  const isNormalized = JSON.stringify(keys) === JSON.stringify(normalizedKeys.slice().sort());
  if (!isBase && !isNormalized) fail('DASH082_BINDING_SHAPE_INVALID');
  const normalized = FACTORY.normalizeBinding(Object.fromEntries(baseKeys.map((key) => [key, input[key]])));
  if (isNormalized && stableStringify(normalized) !== stableStringify(input)) fail('DASH082_BINDING_DERIVED_STATE_MISMATCH');
  return normalized;
}

function normalizeBoundDescriptor(input) {
  assertNoFinancialPayload(input, 'bound_descriptor');
  exactKeys(input, ['schema', 'contract_version', 'widget_id', 'semantic_binding_status', 'layout_identity_authority', 'geometry_mutation', 'binding'], 'DASH082_BOUND_DESCRIPTOR_SHAPE_INVALID');
  if (input.schema !== FACTORY.BOUND_DESCRIPTOR_SCHEMA || input.contract_version !== FACTORY.VERSION ||
      input.semantic_binding_status !== 'BOUND' || input.layout_identity_authority !== false || input.geometry_mutation !== false) {
    fail('DASH082_BOUND_DESCRIPTOR_INVALID');
  }
  const widgetId = safeId(input.widget_id, 'DASH082_WIDGET_ID_INVALID');
  const binding = normalizeFactoryBinding(input.binding);
  if (binding.widget_id !== widgetId) fail('DASH082_BOUND_DESCRIPTOR_ID_MISMATCH');
  return deepFreeze({
    schema: FACTORY.BOUND_DESCRIPTOR_SCHEMA,
    contract_version: FACTORY.VERSION,
    widget_id: widgetId,
    semantic_binding_status: 'BOUND',
    layout_identity_authority: false,
    geometry_mutation: false,
    binding
  });
}

function effectiveDimensions(binding) {
  const dimensions = binding.query.dimensions.slice();
  if (binding.query.grain !== 'NONE') dimensions.push('time_bucket');
  return Array.from(new Set(dimensions)).sort();
}

function widgetCapability(descriptor) {
  const binding = descriptor.binding;
  const dimensions = effectiveDimensions(binding);
  const chartDisabled = binding.kind === 'CHART' && binding.presentation.interactions.filter !== true;
  return deepFreeze({
    widget_id: descriptor.widget_id,
    kind: binding.kind,
    allowed_fields: chartDisabled ? [] : dimensions,
    brush_enabled: !chartDisabled && dimensions.includes(CONTRACT.interaction_rules.brush_field)
  });
}

function createRegistry(inputs) {
  assertContract();
  if (!Array.isArray(inputs) || inputs.length < 1) fail('DASH082_REGISTRY_WIDGETS_INVALID');
  const widgets = inputs.map(normalizeBoundDescriptor).sort((a, b) => a.widget_id.localeCompare(b.widget_id));
  if (new Set(widgets.map((item) => item.widget_id)).size !== widgets.length) fail('DASH082_REGISTRY_WIDGET_DUPLICATE');
  const body = deepFreeze({ schema: REGISTRY_SCHEMA, contract_version: VERSION, widgets });
  return deepFreeze({ ...body, registry_hash: sha256(stableStringify(body)) });
}

function normalizeRegistry(input) {
  exactKeys(input, ['schema', 'contract_version', 'widgets', 'registry_hash'], 'DASH082_REGISTRY_SHAPE_INVALID');
  if (input.schema !== REGISTRY_SCHEMA || input.contract_version !== VERSION || !Array.isArray(input.widgets)) fail('DASH082_REGISTRY_VERSION_INVALID');
  assertNoFinancialPayload(input, 'registry');
  const normalized = createRegistry(input.widgets);
  if (input.registry_hash !== normalized.registry_hash) fail('DASH082_REGISTRY_HASH_MISMATCH');
  return normalized;
}

function normalizeValues(values, max) {
  if (!Array.isArray(values) || values.length < 1 || values.length > max) fail('DASH082_FILTER_VALUES_INVALID');
  const normalized = values.map((value) => {
    const text = String(value == null ? '' : value).trim();
    if (!text || text.length > 128) fail('DASH082_FILTER_VALUES_INVALID');
    return text;
  }).sort();
  if (new Set(normalized).size !== normalized.length) fail('DASH082_FILTER_VALUES_INVALID');
  return Object.freeze(normalized);
}

function normalizeEvent(input) {
  assertContract();
  assertNoFinancialPayload(input, 'event');
  exactKeys(input, ['schema', 'contract_version', 'type', 'source_widget_id', 'operation', 'field', 'operator', 'values', 'origin_event_id', 'hop'], 'DASH082_EVENT_SHAPE_INVALID');
  if (input.schema !== EVENT_SCHEMA || input.contract_version !== VERSION) fail('DASH082_EVENT_VERSION_INVALID');
  const type = String(input.type || '').toUpperCase();
  if (!EVENT_TYPES.includes(type)) fail('DASH082_EVENT_TYPE_INVALID');
  if (!Number.isInteger(input.hop) || input.hop < 0) fail('DASH082_EVENT_HOP_INVALID');
  if (input.hop > CONTRACT.interaction_rules.max_hop) fail('DASH082_EVENT_HOP_LIMIT_EXCEEDED');
  let origin = input.origin_event_id == null ? null : String(input.origin_event_id).toLowerCase();
  if (origin != null && !HASH_RE.test(origin)) fail('DASH082_EVENT_ORIGIN_INVALID');

  const system = type === 'RESET' || type === 'BACK';
  let source = null;
  let operation = null;
  let field = null;
  let operator = null;
  let values = Object.freeze([]);
  if (system) {
    if (input.source_widget_id != null || input.operation != null || input.field != null || input.operator != null ||
        !Array.isArray(input.values) || input.values.length !== 0 || input.hop !== 0 || origin != null) fail('DASH082_SYSTEM_EVENT_SHAPE_INVALID');
  } else {
    source = safeId(input.source_widget_id, 'DASH082_SOURCE_WIDGET_INVALID');
    operation = String(input.operation || '').toUpperCase();
    if (!OPERATIONS.includes(operation)) fail('DASH082_SELECTION_OPERATION_INVALID');
    field = String(input.field || '');
    if (!DIMENSIONS.includes(field)) fail('DASH082_FILTER_FIELD_UNSUPPORTED');
    if (operation === 'CLEAR') {
      if (type === 'CLICK' || input.operator != null || !Array.isArray(input.values) || input.values.length !== 0) fail('DASH082_CLEAR_EVENT_SHAPE_INVALID');
    } else {
      operator = String(input.operator || '').toUpperCase();
      if (!FILTER_OPERATORS.includes(operator)) fail('DASH082_FILTER_OPERATOR_UNSUPPORTED');
      const max = type === 'CLICK' ? CONTRACT.interaction_rules.click_max_values :
        type === 'BRUSH' ? CONTRACT.interaction_rules.brush_max_values : CONTRACT.interaction_rules.selection_max_values;
      values = normalizeValues(input.values, max);
      if (type === 'BRUSH' && (field !== CONTRACT.interaction_rules.brush_field || operator !== 'INCLUDE')) fail('DASH082_BRUSH_FILTER_INVALID');
    }
  }

  const hashBody = {
    schema: EVENT_SCHEMA,
    contract_version: VERSION,
    type,
    source_widget_id: source,
    operation,
    field,
    operator,
    values,
    origin_event_id: origin,
    hop: input.hop
  };
  const eventId = sha256(stableStringify(hashBody));
  if (origin == null) origin = eventId;
  if (input.hop === 0 && origin !== eventId) fail('DASH082_ROOT_EVENT_ORIGIN_INVALID');
  if (input.hop > 0 && origin === eventId) fail('DASH082_PROPAGATED_EVENT_ORIGIN_INVALID');
  return deepFreeze({ ...hashBody, origin_event_id: origin, event_id: eventId });
}

function sessionBody(explorationSession, processed) {
  return { schema: SESSION_SCHEMA, contract_version: VERSION, exploration_session: explorationSession, processed_origin_ids: processed };
}

function createSession(initialExplorationSession) {
  const exploration = initialExplorationSession == null ? EXPLORATION.createSession() : EXPLORATION.normalizeSession(initialExplorationSession);
  const body = deepFreeze(sessionBody(exploration, Object.freeze([])));
  return deepFreeze({ ...body, session_hash: sha256(stableStringify(body)) });
}

function normalizeSession(input) {
  assertContract();
  assertNoFinancialPayload(input, 'session');
  exactKeys(input, ['schema', 'contract_version', 'exploration_session', 'processed_origin_ids', 'session_hash'], 'DASH082_SESSION_SHAPE_INVALID');
  if (input.schema !== SESSION_SCHEMA || input.contract_version !== VERSION || !Array.isArray(input.processed_origin_ids) ||
      input.processed_origin_ids.length > CONTRACT.interaction_rules.processed_origin_limit) fail('DASH082_SESSION_VERSION_INVALID');
  const processed = input.processed_origin_ids.map((value) => String(value).toLowerCase());
  if (processed.some((value) => !HASH_RE.test(value)) || new Set(processed).size !== processed.length) fail('DASH082_SESSION_ORIGIN_INVALID');
  const exploration = EXPLORATION.normalizeSession(input.exploration_session);
  const body = deepFreeze(sessionBody(exploration, Object.freeze(processed)));
  const hash = sha256(stableStringify(body));
  if (input.session_hash !== hash) fail('DASH082_SESSION_HASH_MISMATCH');
  return deepFreeze({ ...body, session_hash: hash });
}

function registryWidget(registry, widgetId) {
  const found = registry.widgets.find((item) => item.widget_id === widgetId);
  if (!found) fail('DASH082_SOURCE_WIDGET_UNKNOWN');
  return found;
}

function assertSourceCapability(registry, event) {
  const descriptor = registryWidget(registry, event.source_widget_id);
  if (descriptor.binding.kind === 'CHART' && descriptor.binding.presentation.interactions.filter !== true) {
    fail('DASH082_CHART_FILTER_INTERACTION_DISABLED');
  }
  const capability = widgetCapability(descriptor);
  if (!capability.allowed_fields.includes(event.field)) fail('DASH082_SOURCE_FIELD_NOT_BOUND');
  if (event.type === 'BRUSH' && capability.brush_enabled !== true) fail('DASH082_BRUSH_NOT_BOUND');
  return descriptor;
}

function nextGlobalFilterContext(explorationSession, event) {
  const filters = explorationSession.present.global_context.filter_context.filters
    .filter((item) => item.field !== event.field)
    .map((item) => ({ kind: item.kind, field: item.field, operator: item.operator, values: item.values.slice() }));
  if (event.operation === 'SET') filters.push({ kind: 'DIMENSION', field: event.field, operator: event.operator, values: event.values.slice() });
  return VIZ.normalizeFilterContext({ schema: VIZ.FILTER_CONTEXT_SCHEMA, contract_version: VIZ.VERSION, filters });
}

function applyEvent(explorationSession, event) {
  if (event.type === 'RESET') return EXPLORATION.dispatch(explorationSession, { type: 'RESET' });
  if (event.type === 'BACK') return EXPLORATION.dispatch(explorationSession, { type: 'BACK' });
  const before = explorationSession.present;
  const next = EXPLORATION.dispatch(explorationSession, {
    type: 'SET_GLOBAL_CONTEXT',
    filter_context: nextGlobalFilterContext(explorationSession, event),
    scope_spec: before.global_context.scope_spec
  });
  if (stableStringify(next.present.widget_contexts) !== stableStringify(before.widget_contexts)) fail('DASH082_WIDGET_CONTEXT_MUTATION_DETECTED');
  if (stableStringify(next.present.drill_context) !== stableStringify(before.drill_context)) fail('DASH082_DRILL_CONTEXT_MUTATION_DETECTED');
  if (stableStringify(next.present.global_context.scope_spec) !== stableStringify(before.global_context.scope_spec)) fail('DASH082_SCOPE_MUTATION_DETECTED');
  return next;
}

function nextProcessed(current, origin) {
  const output = current.filter((item) => item !== origin).concat(origin);
  while (output.length > CONTRACT.interaction_rules.processed_origin_limit) output.shift();
  return Object.freeze(output);
}

function result(session, event, affected, decision, reason) {
  return deepFreeze({
    schema: RESULT_SCHEMA,
    contract_version: VERSION,
    session,
    event,
    affected_widget_ids: Object.freeze(affected.slice().sort()),
    decision,
    reason
  });
}

function dispatch(sessionInput, registryInput, eventInput) {
  const session = normalizeSession(sessionInput);
  const registry = normalizeRegistry(registryInput);
  const event = normalizeEvent(eventInput);
  if (session.processed_origin_ids.includes(event.origin_event_id)) return result(session, event, [], 'IGNORED', 'DASH082_EVENT_ORIGIN_REPLAY');
  if (event.type !== 'RESET' && event.type !== 'BACK') assertSourceCapability(registry, event);
  const exploration = applyEvent(session.exploration_session, event);
  const body = deepFreeze(sessionBody(exploration, nextProcessed(session.processed_origin_ids, event.origin_event_id)));
  const nextSession = deepFreeze({ ...body, session_hash: sha256(stableStringify(body)) });
  const affected = (event.type === 'RESET' || event.type === 'BACK')
    ? registry.widgets.map((item) => item.widget_id)
    : registry.widgets.map((item) => item.widget_id).filter((id) => id !== event.source_widget_id);
  const decision = exploration.present.state_hash === session.exploration_session.present.state_hash ? 'NOOP' : 'APPLIED';
  return result(nextSession, event, affected, decision, decision === 'NOOP' ? 'STATE_UNCHANGED' : 'OK');
}

function propagateEvent(previous, sourceWidgetId) {
  if (!previous || previous.schema !== EVENT_SCHEMA || previous.contract_version !== VERSION || !HASH_RE.test(previous.event_id || '')) {
    fail('DASH082_PROPAGATION_SOURCE_EVENT_INVALID');
  }
  if (previous.type === 'RESET' || previous.type === 'BACK') fail('DASH082_SYSTEM_EVENT_PROPAGATION_FORBIDDEN');
  return normalizeEvent({
    schema: EVENT_SCHEMA,
    contract_version: VERSION,
    type: previous.type,
    source_widget_id: safeId(sourceWidgetId, 'DASH082_SOURCE_WIDGET_INVALID'),
    operation: previous.operation,
    field: previous.field,
    operator: previous.operator,
    values: previous.values.slice(),
    origin_event_id: previous.origin_event_id,
    hop: previous.hop + 1
  });
}

function telemetry(resultInput) {
  if (!resultInput || resultInput.schema !== RESULT_SCHEMA || resultInput.contract_version !== VERSION) fail('DASH082_TELEMETRY_INPUT_INVALID');
  const event = resultInput.event;
  const output = Object.freeze({
    schema: SCHEMA,
    version: VERSION,
    event_type: event.type,
    source_widget_hash_prefix: event.source_widget_id == null ? '' : sha256(event.source_widget_id).slice(0, 12),
    origin_hash_prefix: event.origin_event_id.slice(0, 12),
    state_hash_prefix: resultInput.session.exploration_session.present.state_hash.slice(0, 12),
    affected_widget_count: resultInput.affected_widget_ids.length,
    decision: resultInput.decision,
    reason: resultInput.reason
  });
  if (JSON.stringify(Object.keys(output).sort()) !== JSON.stringify(CONTRACT.telemetry_allowlist.slice().sort())) fail('DASH082_TELEMETRY_SHAPE_INVALID');
  return output;
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  REGISTRY_SCHEMA,
  EVENT_SCHEMA,
  SESSION_SCHEMA,
  RESULT_SCHEMA,
  EVENT_TYPES,
  OPERATIONS,
  FILTER_OPERATORS,
  assertContract,
  assertNoFinancialPayload,
  createRegistry,
  normalizeRegistry,
  widgetCapability,
  normalizeEvent,
  createSession,
  normalizeSession,
  dispatch,
  propagateEvent,
  telemetry
});
