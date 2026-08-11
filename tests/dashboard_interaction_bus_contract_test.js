'use strict';

const assert = require('assert');
const BUS = require('../lib/dashboard/dashboard_interaction_bus');
const FACTORY = require('../lib/dashboard/widget_factory');
const COMPOSER = require('../lib/dashboard/dashboard_composer');
const ANALYTICS = require('../lib/analytics/analytics_engine');
const EXPLORATION = require('../lib/analytics/exploration_state');
const VIZ = require('../lib/visualization/visualization_foundation');

BUS.assertContract();
assert.strictEqual(BUS.CONTRACT.schema, 'PRH_DASHBOARD_INTERACTION_BUS_V1');
assert.strictEqual(BUS.CONTRACT.version, '1.0.0');
assert.strictEqual(BUS.CONTRACT.roadmap_id, 'DASH-082');
assert.deepStrictEqual(BUS.EVENT_TYPES.slice().sort(), ['BACK', 'BRUSH', 'CLICK', 'RESET', 'SELECTION']);
assert(Object.values(BUS.CONTRACT.authority).every((value) => value === false));
assert.strictEqual(BUS.CONTRACT.principles.shared_context_target, 'GLOBAL_FILTER_CONTEXT_ONLY');
assert.strictEqual(BUS.CONTRACT.principles.public_financial_evidence, 'SYNTHETIC_ONLY');
assert.strictEqual(BUS.CONTRACT.principles.free_only, true);

function baseQuery(overrides = {}) {
  return {
    schema: ANALYTICS.QUERY_SCHEMA,
    contract_version: ANALYTICS.CONTRACT_VERSION,
    currency: 'RUB',
    measures: ['EXPENSE'],
    dimensions: [],
    filters: [],
    time_range: null,
    grain: 'NONE',
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 5000,
    ...overrides
  };
}

function chartSpec(id, type, encoding, filter = true) {
  return {
    schema: VIZ.CHART_SPEC_SCHEMA,
    contract_version: VIZ.VERSION,
    id,
    type,
    title: `Synthetic ${id}`,
    encoding,
    presentation: { legend: true, stacked: false, smooth: false, show_labels: false },
    interactions: { filter, drill: true }
  };
}

function rawBinding(widgetId, kind, query, presentation) {
  return {
    schema: FACTORY.BINDING_SCHEMA,
    contract_version: FACTORY.VERSION,
    widget_id: widgetId,
    kind,
    query,
    presentation
  };
}

function placeholder(id) {
  return {
    schema: COMPOSER.WIDGET_SCHEMA,
    id,
    title: `Synthetic ${id}`,
    semantic_binding_status: 'UNBOUND',
    geometry: { x: 0, y: 0, w: 4, h: 2 }
  };
}

function bind(widgetId, kind, query, presentation) {
  return FACTORY.bindPlaceholder(placeholder(widgetId), rawBinding(widgetId, kind, query, presentation));
}

function event(type, source, operation, field, operator, values, origin = null, hop = 0) {
  return {
    schema: BUS.EVENT_SCHEMA,
    contract_version: BUS.VERSION,
    type,
    source_widget_id: source,
    operation,
    field,
    operator,
    values,
    origin_event_id: origin,
    hop
  };
}

function systemEvent(type) {
  return event(type, null, null, null, null, [], null, 0);
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error && error.code === code, `expected ${code}`);
}

const categoryChart = bind(
  'w-0001',
  'CHART',
  baseQuery({ dimensions: ['category_id'] }),
  chartSpec('category-chart', 'DONUT', {
    category: { kind: 'DIMENSION', id: 'category_id' },
    value: { kind: 'MEASURE', id: 'EXPENSE' }
  })
);

const memberTable = bind(
  'w-0002',
  'TABLE',
  baseQuery({ dimensions: ['member_id'] }),
  {
    schema: FACTORY.TABLE_PRESENTATION_SCHEMA,
    contract_version: FACTORY.VERSION,
    title: 'Synthetic members',
    columns: [
      { kind: 'DIMENSION', id: 'member_id' },
      { kind: 'MEASURE', id: 'EXPENSE' }
    ]
  }
);

const timeChart = bind(
  'w-0003',
  'CHART',
  baseQuery({ time_range: { start: '2026-01-01', end: '2026-07-01' }, grain: 'MONTH' }),
  chartSpec('time-chart', 'LINE', {
    x: { kind: 'DIMENSION', id: 'time_bucket' },
    y: { kind: 'MEASURE', id: 'EXPENSE' }
  })
);

const kpi = bind(
  'w-0004',
  'KPI',
  baseQuery(),
  {
    schema: FACTORY.VALUE_PRESENTATION_SCHEMA,
    contract_version: FACTORY.VERSION,
    title: 'Synthetic KPI',
    show_comparison: false
  }
);

const disabledChart = bind(
  'w-0005',
  'CHART',
  baseQuery({ dimensions: ['account_id'] }),
  chartSpec('disabled-chart', 'BAR', {
    x: { kind: 'DIMENSION', id: 'account_id' },
    y: { kind: 'MEASURE', id: 'EXPENSE' }
  }, false)
);

const registry = BUS.createRegistry([timeChart, categoryChart, kpi, memberTable, disabledChart]);
const reorderedRegistry = BUS.createRegistry([disabledChart, memberTable, categoryChart, timeChart, kpi]);
assert.strictEqual(registry.registry_hash, reorderedRegistry.registry_hash);
assert.deepStrictEqual(registry.widgets.map((item) => item.widget_id), ['w-0001', 'w-0002', 'w-0003', 'w-0004', 'w-0005']);
assert.deepStrictEqual(BUS.widgetCapability(categoryChart).allowed_fields, ['category_id']);
assert.deepStrictEqual(BUS.widgetCapability(timeChart).allowed_fields, ['time_bucket']);
assert.strictEqual(BUS.widgetCapability(timeChart).brush_enabled, true);
assert.deepStrictEqual(BUS.widgetCapability(kpi).allowed_fields, []);
assert.deepStrictEqual(BUS.widgetCapability(disabledChart).allowed_fields, []);

// Start with unrelated global filter + widget context + drill context to prove cross-filter isolation.
let exploration = EXPLORATION.createSession();
exploration = EXPLORATION.dispatch(exploration, {
  type: 'SET_GLOBAL_CONTEXT',
  filter_context: {
    schema: VIZ.FILTER_CONTEXT_SCHEMA,
    contract_version: VIZ.VERSION,
    filters: [{ kind: 'DIMENSION', field: 'account_id', operator: 'INCLUDE', values: ['synthetic-account-a'] }]
  },
  scope_spec: exploration.present.global_context.scope_spec
});
exploration = EXPLORATION.dispatch(exploration, {
  type: 'SET_WIDGET_CONTEXT',
  widget_id: 'w-0002',
  filter_context: {
    schema: VIZ.FILTER_CONTEXT_SCHEMA,
    contract_version: VIZ.VERSION,
    filters: [{ kind: 'DIMENSION', field: 'project_id', operator: 'EXCLUDE', values: ['synthetic-project-x'] }]
  },
  scope_mode: 'INHERIT_GLOBAL',
  scope_spec: null
});
exploration = EXPLORATION.dispatch(exploration, {
  type: 'SET_DRILL_CONTEXT',
  drill_context: {
    schema: VIZ.DRILL_CONTEXT_SCHEMA,
    contract_version: VIZ.VERSION,
    source_widget_id: 'w-0002',
    target: 'DETAILS',
    filter_context: {
      schema: VIZ.FILTER_CONTEXT_SCHEMA,
      contract_version: VIZ.VERSION,
      filters: [{ kind: 'DIMENSION', field: 'member_id', operator: 'INCLUDE', values: ['synthetic-member-a'] }]
    }
  }
});

let session = BUS.createSession(exploration);
const initialWidgetContexts = JSON.stringify(session.exploration_session.present.widget_contexts);
const initialDrill = JSON.stringify(session.exploration_session.present.drill_context);
const initialScope = JSON.stringify(session.exploration_session.present.global_context.scope_spec);

const clickInput = event('CLICK', 'w-0001', 'SET', 'category_id', 'INCLUDE', ['synthetic-food']);
const clickNormalized = BUS.normalizeEvent(clickInput);
const clickReordered = BUS.normalizeEvent({
  hop: 0,
  values: ['synthetic-food'],
  operator: 'INCLUDE',
  field: 'category_id',
  operation: 'SET',
  source_widget_id: 'w-0001',
  type: 'CLICK',
  origin_event_id: null,
  contract_version: BUS.VERSION,
  schema: BUS.EVENT_SCHEMA
});
assert.strictEqual(clickNormalized.event_id, clickReordered.event_id);

let clickResult = BUS.dispatch(session, registry, clickInput);
assert.strictEqual(clickResult.decision, 'APPLIED');
assert.strictEqual(clickResult.reason, 'OK');
assert.deepStrictEqual(clickResult.affected_widget_ids, ['w-0002', 'w-0003', 'w-0004', 'w-0005']);
let globalFilters = clickResult.session.exploration_session.present.global_context.filter_context.filters;
assert.deepStrictEqual(globalFilters.map((item) => item.field).sort(), ['account_id', 'category_id']);
assert.deepStrictEqual(globalFilters.find((item) => item.field === 'category_id').values, ['synthetic-food']);
assert.strictEqual(JSON.stringify(clickResult.session.exploration_session.present.widget_contexts), initialWidgetContexts);
assert.strictEqual(JSON.stringify(clickResult.session.exploration_session.present.drill_context), initialDrill);
assert.strictEqual(JSON.stringify(clickResult.session.exploration_session.present.global_context.scope_spec), initialScope);
session = clickResult.session;

// Multi-select replaces only same field and preserves unrelated global filters.
const selection = BUS.dispatch(session, registry, event(
  'SELECTION', 'w-0001', 'SET', 'category_id', 'INCLUDE', ['synthetic-home', 'synthetic-food']
));
globalFilters = selection.session.exploration_session.present.global_context.filter_context.filters;
assert.deepStrictEqual(globalFilters.find((item) => item.field === 'category_id').values, ['synthetic-food', 'synthetic-home']);
assert.deepStrictEqual(globalFilters.find((item) => item.field === 'account_id').values, ['synthetic-account-a']);
session = selection.session;

// Clear removes only selected field.
const cleared = BUS.dispatch(session, registry, event('SELECTION', 'w-0001', 'CLEAR', 'category_id', null, []));
globalFilters = cleared.session.exploration_session.present.global_context.filter_context.filters;
assert.deepStrictEqual(globalFilters.map((item) => item.field), ['account_id']);
session = cleared.session;

// Brush only accepts bound time_bucket and keeps unrelated filters.
const brushed = BUS.dispatch(session, registry, event(
  'BRUSH', 'w-0003', 'SET', 'time_bucket', 'INCLUDE', ['2026-02-01', '2026-01-01']
));
globalFilters = brushed.session.exploration_session.present.global_context.filter_context.filters;
assert.deepStrictEqual(globalFilters.find((item) => item.field === 'time_bucket').values, ['2026-01-01', '2026-02-01']);
assert.deepStrictEqual(globalFilters.find((item) => item.field === 'account_id').values, ['synthetic-account-a']);
assert(!brushed.affected_widget_ids.includes('w-0003'));
assert(brushed.affected_widget_ids.includes('w-0001'));
session = brushed.session;

// A programmatic re-emission retains origin and is ignored before any state mutation: no feedback loop.
const propagated = BUS.propagateEvent(brushed.event, 'w-0002');
const propagatedRaw = {
  schema: propagated.schema,
  contract_version: propagated.contract_version,
  type: propagated.type,
  source_widget_id: propagated.source_widget_id,
  operation: propagated.operation,
  field: propagated.field,
  operator: propagated.operator,
  values: propagated.values.slice(),
  origin_event_id: propagated.origin_event_id,
  hop: propagated.hop
};
const replay = BUS.dispatch(session, registry, propagatedRaw);
assert.strictEqual(replay.decision, 'IGNORED');
assert.strictEqual(replay.reason, 'DASH082_EVENT_ORIGIN_REPLAY');
assert.strictEqual(replay.session.session_hash, session.session_hash);
assert.strictEqual(replay.session.exploration_session.present.state_hash, session.exploration_session.present.state_hash);
assert.deepStrictEqual(replay.affected_widget_ids, []);
expectCode(() => BUS.propagateEvent(propagated, 'w-0001'), 'DASH082_EVENT_HOP_LIMIT_EXCEEDED');

// RESET/BACK delegate to ANL-074 and restore exact prior present/history semantics.
const beforeResetExploration = session.exploration_session;
const resetResult = BUS.dispatch(session, registry, systemEvent('RESET'));
assert.strictEqual(resetResult.session.exploration_session.present.state_hash, EXPLORATION.defaultState().state_hash);
assert.deepStrictEqual(resetResult.affected_widget_ids, registry.widgets.map((item) => item.widget_id));
const backResult = BUS.dispatch(resetResult.session, registry, systemEvent('BACK'));
assert.strictEqual(backResult.session.exploration_session.present.state_hash, beforeResetExploration.present.state_hash);
assert.strictEqual(
  JSON.stringify(backResult.session.exploration_session.history),
  JSON.stringify(beforeResetExploration.history)
);

// Deterministic replay of the same sequence from the same initial state.
let deterministicA = BUS.createSession(exploration);
let deterministicB = BUS.createSession(exploration);
for (const nextEvent of [
  clickInput,
  event('SELECTION', 'w-0001', 'SET', 'category_id', 'INCLUDE', ['synthetic-home', 'synthetic-food']),
  event('SELECTION', 'w-0001', 'CLEAR', 'category_id', null, []),
  event('BRUSH', 'w-0003', 'SET', 'time_bucket', 'INCLUDE', ['2026-02-01', '2026-01-01'])
]) {
  deterministicA = BUS.dispatch(deterministicA, registry, nextEvent).session;
  deterministicB = BUS.dispatch(deterministicB, reorderedRegistry, { ...nextEvent }).session;
}
assert.strictEqual(deterministicA.session_hash, deterministicB.session_hash);
assert.strictEqual(deterministicA.exploration_session.present.state_hash, deterministicB.exploration_session.present.state_hash);

// Fail-closed source/capability/binding validation.
expectCode(
  () => BUS.dispatch(BUS.createSession(), registry, event('CLICK', 'w-9999', 'SET', 'category_id', 'INCLUDE', ['synthetic-x'])),
  'DASH082_SOURCE_WIDGET_UNKNOWN'
);
expectCode(
  () => BUS.dispatch(BUS.createSession(), registry, event('CLICK', 'w-0004', 'SET', 'category_id', 'INCLUDE', ['synthetic-x'])),
  'DASH082_SOURCE_FIELD_NOT_BOUND'
);
expectCode(
  () => BUS.dispatch(BUS.createSession(), registry, event('CLICK', 'w-0005', 'SET', 'account_id', 'INCLUDE', ['synthetic-x'])),
  'DASH082_CHART_FILTER_INTERACTION_DISABLED'
);
expectCode(
  () => BUS.dispatch(BUS.createSession(), registry, event('BRUSH', 'w-0001', 'SET', 'category_id', 'INCLUDE', ['synthetic-x'])),
  'DASH082_BRUSH_FILTER_INVALID'
);
expectCode(
  () => BUS.dispatch(BUS.createSession(), registry, event('SELECTION', 'w-0001', 'SET', 'member_id', 'INCLUDE', ['synthetic-x'])),
  'DASH082_SOURCE_FIELD_NOT_BOUND'
);
expectCode(
  () => BUS.createRegistry([{ ...categoryChart, semantic_binding_status: 'UNBOUND' }]),
  'DASH082_BOUND_DESCRIPTOR_INVALID'
);
expectCode(
  () => BUS.normalizeEvent({ ...clickInput, amount_minor: 12345 }),
  'DASH082_FINANCIAL_PAYLOAD_FORBIDDEN'
);
expectCode(
  () => BUS.normalizeEvent(event('CLICK', 'w-0001', 'SET', 'category_id', 'INCLUDE', ['a', 'b'])),
  'DASH082_FILTER_VALUES_INVALID'
);

const telemetry = BUS.telemetry(brushed);
assert.deepStrictEqual(Object.keys(telemetry).sort(), BUS.CONTRACT.telemetry_allowlist.slice().sort());
assert.strictEqual(telemetry.event_type, 'BRUSH');
assert.strictEqual(telemetry.affected_widget_count, registry.widgets.length - 1);
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['synthetic-account-a', 'synthetic-food', '2026-01-01', 'category_id', 'time_bucket', 'RUB', 'EXPENSE']) {
  assert(!telemetryText.includes(forbidden), `telemetry leak: ${forbidden}`);
}

console.log('dashboard_interaction_bus_contract_test: OK', {
  contract: `${BUS.SCHEMA}@${BUS.VERSION}`,
  eventTypes: BUS.EVENT_TYPES,
  globalFilterOnly: true,
  loopPrevention: BUS.CONTRACT.principles.loop_prevention,
  publicEvidence: 'SYNTHETIC_ONLY',
  freeOnly: true
});
