'use strict';

const assert = require('assert');
const SCOPE = require('../lib/analytics/analytics_scope');
const VIZ = require('../lib/visualization/visualization_foundation');
const exploration = require('../lib/analytics/exploration_state');

function filter(filters) {
  return {
    schema: VIZ.FILTER_CONTEXT_SCHEMA,
    contract_version: VIZ.VERSION,
    filters
  };
}

function item(field, operator, values) {
  return { kind: 'DIMENSION', field, operator, values };
}

function widgetAction(widgetId, filterContext, scopeMode = 'INHERIT_GLOBAL', scopeSpec = null) {
  return {
    type: 'SET_WIDGET_CONTEXT',
    widget_id: widgetId,
    filter_context: filterContext,
    scope_mode: scopeMode,
    scope_spec: scopeSpec
  };
}

assert.strictEqual(exploration.assertContract(), true);
assert.strictEqual(exploration.CONTRACT.schema, 'PRH_EXPLORATION_STATE_V1');
assert.strictEqual(exploration.CONTRACT.version, '1.0.0');
assert.strictEqual(exploration.CONTRACT.upstream.visualization_foundation, 'PRH_VISUALIZATION_FOUNDATION_V1@1.0.0');
assert.strictEqual(exploration.CONTRACT.upstream.filter_context, 'PRH_FILTER_CONTEXT_V1@1.0.0');
assert.strictEqual(exploration.CONTRACT.upstream.drill_context, 'PRH_DRILL_CONTEXT_V1@1.0.0');
assert.strictEqual(exploration.CONTRACT.upstream.analytics_scope, 'PRH_ANALYTICS_SCOPE_V1@1.0.0');
assert.strictEqual(exploration.CONTRACT.upstream.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(exploration.CONTRACT.scope_composition.implicit_scope_merge, false);
assert.strictEqual(exploration.CONTRACT.url_state.private_app_only, true);
assert.strictEqual(exploration.CONTRACT.url_state.public_shareable, false);
assert.ok(Object.values(exploration.CONTRACT.authorities).every((value) => value === false));
assert.strictEqual(exploration.CONTRACT.free_only, true);

const defaultState = exploration.defaultState();
assert.strictEqual(defaultState.schema, exploration.SCHEMA);
assert.strictEqual(defaultState.global_context.scope_spec.scope_id, 'DEFAULT_ANALYSIS');
assert.strictEqual(defaultState.global_context.filter_context.filters.length, 0);
assert.deepStrictEqual(defaultState.widget_contexts, []);
assert.strictEqual(defaultState.drill_context, null);
assert.match(defaultState.state_hash, /^[0-9a-f]{64}$/);

const globalFilters = filter([
  item('account_id', 'EXCLUDE', ['acct-synth-z']),
  item('category_id', 'EXCLUDE', ['cat-synth-c']),
  item('category_id', 'INCLUDE', ['cat-synth-a', 'cat-synth-b', 'cat-synth-c'])
]);
const widgetFilters = filter([
  item('account_id', 'EXCLUDE', ['acct-synth-y']),
  item('category_id', 'INCLUDE', ['cat-synth-b', 'cat-synth-c'])
]);
const merged = exploration.mergeFilterContexts(globalFilters, widgetFilters);
assert.deepStrictEqual(merged.filters, [
  { kind: 'DIMENSION', field: 'account_id', operator: 'EXCLUDE', values: ['acct-synth-y', 'acct-synth-z'] },
  { kind: 'DIMENSION', field: 'category_id', operator: 'EXCLUDE', values: ['cat-synth-c'] },
  { kind: 'DIMENSION', field: 'category_id', operator: 'INCLUDE', values: ['cat-synth-b'] }
]);

const orderA = exploration.mergeFilterContexts(globalFilters, widgetFilters);
const orderB = exploration.mergeFilterContexts(
  filter(globalFilters.filters.slice().reverse()),
  filter(widgetFilters.filters.slice().reverse())
);
assert.deepStrictEqual(orderB, orderA);

assert.throws(() => exploration.mergeFilterContexts(
  filter([item('category_id', 'INCLUDE', ['cat-a'])]),
  filter([item('category_id', 'INCLUDE', ['cat-b'])])
), /EXPLORATION_FILTER_CONTRADICTION/);
assert.throws(() => exploration.mergeFilterContexts(
  filter([item('category_id', 'INCLUDE', ['cat-a'])]),
  filter([item('category_id', 'EXCLUDE', ['cat-a'])])
), /EXPLORATION_FILTER_CONTRADICTION/);

let session = exploration.createSession();
const initialHash = session.present.state_hash;
assert.strictEqual(session.history.length, 0);

session = exploration.dispatch(session, {
  type: 'SET_GLOBAL_CONTEXT',
  filter_context: globalFilters,
  scope_spec: SCOPE.builtInScope('DEFAULT_ANALYSIS')
});
assert.strictEqual(session.history.length, 1);
assert.notStrictEqual(session.present.state_hash, initialHash);
const afterGlobalHash = session.present.state_hash;

const noOp = exploration.dispatch(session, {
  type: 'SET_GLOBAL_CONTEXT',
  filter_context: globalFilters,
  scope_spec: SCOPE.builtInScope('DEFAULT_ANALYSIS')
});
assert.strictEqual(noOp.present.state_hash, afterGlobalHash);
assert.strictEqual(noOp.history.length, session.history.length);

session = exploration.dispatch(session, widgetAction('widget.expense', widgetFilters));
assert.strictEqual(session.history.length, 2);
let effective = exploration.effectiveWidgetContext(session.present, 'widget.expense');
assert.deepStrictEqual(effective.filter_context, merged);
assert.strictEqual(effective.scope_spec.scope_id, 'DEFAULT_ANALYSIS');
assert.strictEqual(effective.scope_source, 'GLOBAL_INHERITED');

session = exploration.dispatch(session, widgetAction(
  'widget.emergency',
  filter([]),
  'OVERRIDE',
  SCOPE.builtInScope('EMERGENCY_FUND_ONLY')
));
const emergencyEffective = exploration.effectiveWidgetContext(session.present, 'widget.emergency');
assert.strictEqual(emergencyEffective.scope_spec.scope_id, 'EMERGENCY_FUND_ONLY');
assert.strictEqual(emergencyEffective.scope_source, 'WIDGET_OVERRIDE');
assert.throws(() => exploration.normalizeWidgetContext({
  widget_id: 'widget.bad-inherit',
  filter_context: filter([]),
  scope_mode: 'INHERIT_GLOBAL',
  scope_spec: SCOPE.builtInScope('EMERGENCY_FUND_ONLY')
}), /EXPLORATION_WIDGET_INHERIT_SCOPE_MUST_BE_NULL/);
assert.throws(() => exploration.normalizeWidgetContext({
  widget_id: 'widget.bad-override',
  filter_context: filter([]),
  scope_mode: 'OVERRIDE',
  scope_spec: null
}), /EXPLORATION_WIDGET_OVERRIDE_SCOPE_REQUIRED/);

const drill = {
  schema: VIZ.DRILL_CONTEXT_SCHEMA,
  contract_version: VIZ.VERSION,
  source_widget_id: 'widget.expense',
  target: 'TRANSACTION_EXPLORER',
  filter_context: filter([
    item('category_id', 'INCLUDE', ['cat-synth-b']),
    item('account_id', 'EXCLUDE', ['acct-synth-x'])
  ])
};
session = exploration.dispatch(session, { type: 'SET_DRILL_CONTEXT', drill_context: drill });
assert.strictEqual(session.present.drill_context.target, 'TRANSACTION_EXPLORER');
const effectiveDrill = exploration.effectiveDrillContext(session.present);
assert.strictEqual(effectiveDrill.source_widget_id, 'widget.expense');
assert.deepStrictEqual(effectiveDrill.filter_context.filters, [
  { kind: 'DIMENSION', field: 'account_id', operator: 'EXCLUDE', values: ['acct-synth-x', 'acct-synth-y', 'acct-synth-z'] },
  { kind: 'DIMENSION', field: 'category_id', operator: 'EXCLUDE', values: ['cat-synth-c'] },
  { kind: 'DIMENSION', field: 'category_id', operator: 'INCLUDE', values: ['cat-synth-b'] }
]);

const beforeClear = session.present.state_hash;
session = exploration.dispatch(session, { type: 'CLEAR_DRILL_CONTEXT' });
assert.strictEqual(session.present.drill_context, null);
assert.notStrictEqual(session.present.state_hash, beforeClear);
const clearNoOp = exploration.dispatch(session, { type: 'CLEAR_DRILL_CONTEXT' });
assert.strictEqual(clearNoOp.history.length, session.history.length);
assert.strictEqual(clearNoOp.present.state_hash, session.present.state_hash);

const beforeReset = session.present;
const historyBeforeReset = session.history.length;
session = exploration.dispatch(session, { type: 'RESET' });
assert.strictEqual(session.present.state_hash, defaultState.state_hash);
assert.strictEqual(session.history.length, historyBeforeReset + 1);
session = exploration.dispatch(session, { type: 'BACK' });
assert.strictEqual(session.present.state_hash, beforeReset.state_hash);
assert.deepStrictEqual(session.present, beforeReset);

const beforeRemove = session.present.state_hash;
session = exploration.dispatch(session, { type: 'REMOVE_WIDGET_CONTEXT', widget_id: 'widget.emergency' });
assert.strictEqual(session.present.widget_contexts.some((entry) => entry.widget_id === 'widget.emergency'), false);
assert.notStrictEqual(session.present.state_hash, beforeRemove);
const removeNoOp = exploration.dispatch(session, { type: 'REMOVE_WIDGET_CONTEXT', widget_id: 'widget.missing' });
assert.strictEqual(removeNoOp.present.state_hash, session.present.state_hash);
assert.strictEqual(removeNoOp.history.length, session.history.length);

// Widget ordering and filter ordering do not affect canonical state identity.
const stateA = exploration.normalizeState({
  schema: exploration.SCHEMA,
  contract_version: exploration.VERSION,
  global_context: {
    filter_context: globalFilters,
    scope_spec: SCOPE.builtInScope('DEFAULT_ANALYSIS')
  },
  widget_contexts: [
    { widget_id: 'widget.z', filter_context: filter([]), scope_mode: 'INHERIT_GLOBAL', scope_spec: null },
    { widget_id: 'widget.a', filter_context: widgetFilters, scope_mode: 'INHERIT_GLOBAL', scope_spec: null }
  ],
  drill_context: null
});
const stateB = exploration.normalizeState({
  schema: exploration.SCHEMA,
  contract_version: exploration.VERSION,
  global_context: {
    filter_context: filter(globalFilters.filters.slice().reverse()),
    scope_spec: SCOPE.builtInScope('DEFAULT_ANALYSIS')
  },
  widget_contexts: [
    { widget_id: 'widget.a', filter_context: filter(widgetFilters.filters.slice().reverse()), scope_mode: 'INHERIT_GLOBAL', scope_spec: null },
    { widget_id: 'widget.z', filter_context: filter([]), scope_mode: 'INHERIT_GLOBAL', scope_spec: null }
  ],
  drill_context: null
});
assert.strictEqual(stateA.state_hash, stateB.state_hash);
assert.deepStrictEqual(stateA, stateB);

const encoded = exploration.encodeState(stateA);
assert(encoded.startsWith('prh1.'));
assert.strictEqual(encoded.includes('='), false);
const decoded = exploration.decodeState(encoded);
assert.deepStrictEqual(decoded, stateA);
assert.strictEqual(exploration.encodeState(decoded), encoded);
assert.strictEqual(encoded.toLowerCase().includes('amount_minor'), false);
assert.strictEqual(encoded.toLowerCase().includes('transactions'), false);

const payload = encoded.slice(exploration.URL_PREFIX.length);
const index = Math.floor(payload.length / 2);
const replacement = payload[index] === 'A' ? 'B' : 'A';
const tampered = exploration.URL_PREFIX + payload.slice(0, index) + replacement + payload.slice(index + 1);
assert.throws(() => exploration.decodeState(tampered));
assert.throws(() => exploration.decodeState('wrong.' + payload), /EXPLORATION_URL_STATE_PREFIX_INVALID/);
assert.throws(() => exploration.decodeState('prh1.bad=padding'), /EXPLORATION_URL_STATE_ENCODING_INVALID/);

assert.throws(() => exploration.normalizeState({
  ...exploration.defaultState(),
  rows: [{ amount_minor: 123 }]
}), /EXPLORATION_FINANCIAL_PAYLOAD_FORBIDDEN/);
assert.throws(() => exploration.dispatch(exploration.createSession(), {
  type: 'SET_GLOBAL_CONTEXT',
  filter_context: filter([]),
  scope_spec: SCOPE.builtInScope('DEFAULT_ANALYSIS'),
  scope_assignments: { account: [] }
}), /EXPLORATION_FINANCIAL_PAYLOAD_FORBIDDEN/);

// Valid but intentionally large configuration must fail URL size guard rather than truncate.
const largeFilters = [];
for (const field of ['account_id', 'category_id', 'member_id', 'project_id', 'type']) {
  largeFilters.push(item(field, 'EXCLUDE', Array.from({ length: 64 }, (_, i) => `${field}-synthetic-${String(i).padStart(2, '0')}-xxxxxxxxxxxxxxxx`)));
}
const largeState = exploration.normalizeState({
  schema: exploration.SCHEMA,
  contract_version: exploration.VERSION,
  global_context: { filter_context: filter(largeFilters), scope_spec: SCOPE.builtInScope('DEFAULT_ANALYSIS') },
  widget_contexts: [],
  drill_context: null
});
assert.throws(() => exploration.encodeState(largeState), /EXPLORATION_URL_STATE_TOO_LARGE/);

// History is bounded and stores canonical prior states only.
let bounded = exploration.createSession();
for (let i = 0; i < 40; i += 1) {
  bounded = exploration.dispatch(bounded, widgetAction(
    'widget.history',
    filter([item('category_id', 'INCLUDE', [`cat-history-${String(i).padStart(2, '0')}`])])
  ));
}
assert.strictEqual(bounded.history.length, exploration.CONTRACT.history.max_depth);
const lastHash = bounded.present.state_hash;
bounded = exploration.dispatch(bounded, { type: 'BACK' });
assert.strictEqual(bounded.history.length, exploration.CONTRACT.history.max_depth - 1);
assert.notStrictEqual(bounded.present.state_hash, lastHash);

const telemetry = exploration.stateTelemetry(bounded, 'BACK');
assert.deepStrictEqual(Object.keys(telemetry).sort(), exploration.CONTRACT.telemetry_allowlist.slice().sort());
assert.match(telemetry.state_hash, /^[0-9a-f]{64}$/);
const telemetryText = JSON.stringify(telemetry).toLowerCase();
for (const forbidden of ['cat-', 'acct-', 'filter_context', 'values', 'amount', 'transaction', 'dataset', 'rows']) {
  assert.strictEqual(telemetryText.includes(forbidden), false, forbidden);
}

console.log('exploration-state: PASS', {
  contract: `${exploration.SCHEMA}@${exploration.VERSION}`,
  vizFilterContextReused: true,
  vizDrillContextReused: true,
  scopeContractReused: true,
  includeComposition: 'INTERSECTION',
  excludeComposition: 'UNION',
  scopeMergeImplicit: false,
  resetBack: true,
  historyMax: exploration.CONTRACT.history.max_depth,
  urlPrivateAppOnly: exploration.CONTRACT.url_state.private_app_only,
  financialWrite: false,
  freeOnly: exploration.CONTRACT.free_only
});
