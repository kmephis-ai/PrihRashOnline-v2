'use strict';

const assert = require('assert');
const crypto = require('crypto');
const DRILL = require('../lib/dashboard/dashboard_drill');
const FACTORY = require('../lib/dashboard/widget_factory');
const COMPOSER = require('../lib/dashboard/dashboard_composer');
const ANALYTICS = require('../lib/analytics/analytics_engine');
const EXPLORATION = require('../lib/analytics/exploration_state');
const VIZ = require('../lib/visualization/visualization_foundation');
const KPI = require('../lib/finance/kpi_dictionary');
const { normalizeCanonicalTransaction } = require('../lib/domain/canonical_transaction');

DRILL.assertContract();
assert.strictEqual(DRILL.CONTRACT.schema, 'PRH_DASHBOARD_DRILL_V1');
assert.strictEqual(DRILL.CONTRACT.version, '1.0.0');
assert.strictEqual(DRILL.CONTRACT.roadmap_id, 'DASH-083');
assert.deepStrictEqual(DRILL.CONTRACT.time_hierarchy.levels, ['YEAR', 'QUARTER', 'MONTH', 'DAY']);
assert(Object.values(DRILL.CONTRACT.authority).every((value) => value === false));
assert.strictEqual(DRILL.CONTRACT.principles.reconciliation_uses_kpi_authority, true);
assert.strictEqual(DRILL.CONTRACT.principles.free_only, true);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function tx(index, overrides = {}) {
  return normalizeCanonicalTransaction({
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: `SYN-D83-${String(index).padStart(4, '0')}`,
    occurred_at: `2026-01-${String(10 + index).padStart(2, '0')}T12:00:00Z`,
    type: 'expense',
    status: 'posted',
    amount_minor: 1000,
    currency: 'RUB',
    account_id: 'SYN-ACC-A',
    destination_account_id: null,
    category_id: 'SYN-CAT-FOOD',
    member_id: 'SYN-MEMBER-A',
    project_id: 'SYN-PROJECT-HOME',
    tags: ['synthetic'],
    counterparty: 'Synthetic merchant',
    description: 'Synthetic DASH-083 transaction',
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC',
      source_container: 'fixture:dashboard_drill',
      source_record_id: `record-${index}`,
      source_fingerprint: sha256(`dashboard-drill:${index}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYNTHETIC-DASH-083-v1',
      source_position: null
    },
    ...overrides
  });
}

const transactions = [
  tx(1, { amount_minor: 2000 }),
  tx(2, { amount_minor: 3000 }),
  tx(3, { type: 'income', amount_minor: 9000, category_id: 'SYN-CAT-SALARY' }),
  tx(4, { account_id: 'SYN-ACC-B', amount_minor: 7000, category_id: 'SYN-CAT-HOME' }),
  tx(5, { status: 'pending', amount_minor: 50000 }),
  tx(6, { occurred_at: '2026-02-15T12:00:00Z', amount_minor: 4000, category_id: 'SYN-CAT-HOME' })
];

const hierarchyRegistry = DRILL.normalizeHierarchyRegistry({
  schema: DRILL.HIERARCHY_SCHEMA,
  contract_version: DRILL.VERSION,
  hierarchies: [
    {
      id: 'CATEGORY',
      dimension: 'category_id',
      levels: ['GROUP', 'CATEGORY'],
      nodes: [
        { node_id: 'SYN-CAT-GROUP-EXPENSE', level: 'GROUP', parent_id: null },
        { node_id: 'SYN-CAT-GROUP-INCOME', level: 'GROUP', parent_id: null },
        { node_id: 'SYN-CAT-FOOD', level: 'CATEGORY', parent_id: 'SYN-CAT-GROUP-EXPENSE' },
        { node_id: 'SYN-CAT-HOME', level: 'CATEGORY', parent_id: 'SYN-CAT-GROUP-EXPENSE' },
        { node_id: 'SYN-CAT-SALARY', level: 'CATEGORY', parent_id: 'SYN-CAT-GROUP-INCOME' }
      ]
    },
    {
      id: 'ACCOUNT',
      dimension: 'account_id',
      levels: ['GROUP', 'ACCOUNT'],
      nodes: [
        { node_id: 'SYN-ACC-GROUP-MAIN', level: 'GROUP', parent_id: null },
        { node_id: 'SYN-ACC-A', level: 'ACCOUNT', parent_id: 'SYN-ACC-GROUP-MAIN' },
        { node_id: 'SYN-ACC-B', level: 'ACCOUNT', parent_id: 'SYN-ACC-GROUP-MAIN' }
      ]
    }
  ]
});
const hierarchyReordered = DRILL.normalizeHierarchyRegistry({
  schema: DRILL.HIERARCHY_SCHEMA,
  contract_version: DRILL.VERSION,
  hierarchies: [
    {
      id: 'ACCOUNT', dimension: 'account_id', levels: ['GROUP', 'ACCOUNT'],
      nodes: [
        { node_id: 'SYN-ACC-B', level: 'ACCOUNT', parent_id: 'SYN-ACC-GROUP-MAIN' },
        { node_id: 'SYN-ACC-GROUP-MAIN', level: 'GROUP', parent_id: null },
        { node_id: 'SYN-ACC-A', level: 'ACCOUNT', parent_id: 'SYN-ACC-GROUP-MAIN' }
      ]
    },
    {
      id: 'CATEGORY', dimension: 'category_id', levels: ['GROUP', 'CATEGORY'],
      nodes: [
        { node_id: 'SYN-CAT-HOME', level: 'CATEGORY', parent_id: 'SYN-CAT-GROUP-EXPENSE' },
        { node_id: 'SYN-CAT-SALARY', level: 'CATEGORY', parent_id: 'SYN-CAT-GROUP-INCOME' },
        { node_id: 'SYN-CAT-GROUP-INCOME', level: 'GROUP', parent_id: null },
        { node_id: 'SYN-CAT-FOOD', level: 'CATEGORY', parent_id: 'SYN-CAT-GROUP-EXPENSE' },
        { node_id: 'SYN-CAT-GROUP-EXPENSE', level: 'GROUP', parent_id: null }
      ]
    }
  ]
});
assert.strictEqual(hierarchyRegistry.registry_hash, hierarchyReordered.registry_hash);
assert.throws(() => DRILL.normalizeHierarchyRegistry({
  schema: DRILL.HIERARCHY_SCHEMA,
  contract_version: DRILL.VERSION,
  hierarchies: [{ id: 'CATEGORY', dimension: 'category_id', levels: ['GROUP', 'CATEGORY'], nodes: [
    { node_id: 'SYN-X', level: 'CATEGORY', parent_id: null }
  ] }]
}), /DASH083_HIERARCHY_PARENT_REQUIRED/);

function query(overrides = {}) {
  return {
    schema: ANALYTICS.QUERY_SCHEMA,
    contract_version: ANALYTICS.CONTRACT_VERSION,
    currency: 'RUB',
    measures: ['EXPENSE'],
    dimensions: [],
    filters: [],
    time_range: { start: '2026-01-01', end: '2027-01-01' },
    grain: 'YEAR',
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 5000,
    ...overrides
  };
}

function chartBinding(widgetId, q, dimension, measure = 'EXPENSE') {
  const spec = dimension === 'time_bucket'
    ? {
        schema: VIZ.CHART_SPEC_SCHEMA, contract_version: VIZ.VERSION, id: `${widgetId}-chart`, type: 'LINE', title: 'Synthetic time',
        encoding: { x: { kind: 'DIMENSION', id: 'time_bucket' }, y: { kind: 'MEASURE', id: measure } },
        presentation: { legend: true, stacked: false, smooth: false, show_labels: false }, interactions: { filter: true, drill: true }
      }
    : {
        schema: VIZ.CHART_SPEC_SCHEMA, contract_version: VIZ.VERSION, id: `${widgetId}-chart`, type: 'BAR', title: 'Synthetic dimension',
        encoding: { x: { kind: 'DIMENSION', id: dimension }, y: { kind: 'MEASURE', id: measure } },
        presentation: { legend: true, stacked: false, smooth: false, show_labels: false }, interactions: { filter: true, drill: true }
      };
  return FACTORY.bindPlaceholder({
    schema: COMPOSER.WIDGET_SCHEMA,
    id: widgetId,
    title: `Synthetic ${widgetId}`,
    semantic_binding_status: 'UNBOUND',
    geometry: { x: 0, y: 0, w: 4, h: 2 }
  }, {
    schema: FACTORY.BINDING_SCHEMA,
    contract_version: FACTORY.VERSION,
    widget_id: widgetId,
    kind: 'CHART',
    query: q,
    presentation: spec
  });
}

function action(actionId, widgetId, hierarchyId, fromLevel, toLevel, selectionId, measureId) {
  return {
    schema: DRILL.ACTION_SCHEMA,
    contract_version: DRILL.VERSION,
    action: actionId,
    source_widget_id: widgetId,
    hierarchy_id: hierarchyId,
    from_level: fromLevel,
    to_level: toLevel,
    selection_id: selectionId,
    measure_id: measureId
  };
}

function systemAction(actionId) {
  return action(actionId, null, null, null, null, null, null);
}

// Time hierarchy adds QUARTER as navigation window without inventing a new AnalyticsQuery grain.
const timeBound = chartBinding('w-0101', query(), 'time_bucket');
let timeSession = DRILL.createSession();
timeSession = DRILL.dispatch(timeSession, timeBound, hierarchyRegistry, action('DOWN', 'w-0101', 'TIME', 'YEAR', 'QUARTER', '2026', 'EXPENSE'));
assert.strictEqual(timeSession.present.level, 'QUARTER');
assert.deepStrictEqual(timeSession.present.time_window, { start: '2026-01-01', end: '2027-01-01' });
timeSession = DRILL.dispatch(timeSession, timeBound, hierarchyRegistry, action('DOWN', 'w-0101', 'TIME', 'QUARTER', 'MONTH', '2026-Q1', 'EXPENSE'));
assert.strictEqual(timeSession.present.level, 'MONTH');
assert.deepStrictEqual(timeSession.present.time_window, { start: '2026-01-01', end: '2026-04-01' });
timeSession = DRILL.dispatch(timeSession, timeBound, hierarchyRegistry, action('DOWN', 'w-0101', 'TIME', 'MONTH', 'DAY', '2026-01', 'EXPENSE'));
assert.strictEqual(timeSession.present.level, 'DAY');
assert.deepStrictEqual(timeSession.present.time_window, { start: '2026-01-01', end: '2026-02-01' });
timeSession = DRILL.dispatch(timeSession, timeBound, hierarchyRegistry, action('THROUGH', 'w-0101', 'TIME', 'DAY', null, '2026-01-11', 'EXPENSE'));
assert.deepStrictEqual(timeSession.present.time_window, { start: '2026-01-11', end: '2026-01-12' });
const timeRequest = DRILL.buildDrillThroughRequest(timeSession, timeBound);
assert.strictEqual(timeRequest.tx_query.date_from, '2026-01-11');
assert.strictEqual(timeRequest.tx_query.date_to, '2026-01-12');
assert.strictEqual(timeRequest.measure_id, 'EXPENSE');
assert(!JSON.stringify(timeRequest.tx_query).includes('amount_minor'));
assert.throws(() => DRILL.dispatch(DRILL.createSession(), timeBound, hierarchyRegistry,
  action('DOWN', 'w-0101', 'TIME', 'YEAR', 'MONTH', '2026', 'EXPENSE')), /DASH083_HIERARCHY_TRANSITION_INVALID/);

// Category hierarchy is runtime ID-only; selected group narrows descendants, leaf reaches TX-020.
const categoryBound = chartBinding('w-0102', query({
  dimensions: ['category_id'], grain: 'NONE', measures: ['EXPENSE'],
  filters: [{ field: 'member_id', operator: 'IN', values: ['SYN-MEMBER-A'] }]
}), 'category_id');
let categoryExploration = EXPLORATION.createSession();
categoryExploration = EXPLORATION.dispatch(categoryExploration, {
  type: 'SET_GLOBAL_CONTEXT',
  filter_context: { schema: VIZ.FILTER_CONTEXT_SCHEMA, contract_version: VIZ.VERSION, filters: [
    { kind: 'DIMENSION', field: 'project_id', operator: 'INCLUDE', values: ['SYN-PROJECT-HOME'] }
  ] },
  scope_spec: categoryExploration.present.global_context.scope_spec
});
let categorySession = DRILL.createSession(categoryExploration);
const beforeGlobal = JSON.stringify(categorySession.exploration_session.present.global_context);
const beforeWidgets = JSON.stringify(categorySession.exploration_session.present.widget_contexts);
categorySession = DRILL.dispatch(categorySession, categoryBound, hierarchyRegistry,
  action('DOWN', 'w-0102', 'CATEGORY', 'GROUP', 'CATEGORY', 'SYN-CAT-GROUP-EXPENSE', 'EXPENSE'));
assert.strictEqual(JSON.stringify(categorySession.exploration_session.present.global_context), beforeGlobal);
assert.strictEqual(JSON.stringify(categorySession.exploration_session.present.widget_contexts), beforeWidgets);
categorySession = DRILL.dispatch(categorySession, categoryBound, hierarchyRegistry,
  action('THROUGH', 'w-0102', 'CATEGORY', 'CATEGORY', null, 'SYN-CAT-FOOD', 'EXPENSE'));
const categoryRequest = DRILL.buildDrillThroughRequest(categorySession, categoryBound);
assert.deepStrictEqual(categoryRequest.tx_query.category_ids, ['SYN-CAT-FOOD']);
assert.deepStrictEqual(categoryRequest.tx_query.member_ids, ['SYN-MEMBER-A']);
assert.strictEqual(categoryRequest.scope_spec.scope_id, categorySession.exploration_session.present.global_context.scope_spec.scope_id);
const categoryExpected = KPI.evaluateKpi('EXPENSE', transactions.filter((item) =>
  item.category_id === 'SYN-CAT-FOOD' && item.member_id === 'SYN-MEMBER-A' && item.project_id === 'SYN-PROJECT-HOME'
), { currency: 'RUB' }).value_minor;
const categoryReceipt = DRILL.reconcileDrillThrough(transactions, null, categoryRequest, categoryExpected);
assert.strictEqual(categoryReceipt.status, 'PASS');
assert.strictEqual(categoryReceipt.rows_reconciled, true);
assert.strictEqual(categoryReceipt.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(categoryReceipt.financial_write_authorized, false);
assert(categoryReceipt.explorer_result.rows.every((row) => row.category_id === 'SYN-CAT-FOOD'));
const mismatch = DRILL.reconcileDrillThrough(transactions, null, categoryRequest, categoryExpected + 1);
assert.strictEqual(mismatch.status, 'MISMATCH');
assert.strictEqual(mismatch.rows_reconciled, false);
assert.strictEqual(mismatch.explorer_result, null);
assert.strictEqual(mismatch.reason, 'DASH083_TOTAL_RECONCILIATION_MISMATCH');

// Account hierarchy reconciliation delegates INCOME/EXPENSE/CASH_FLOW to KPI authority.
function accountRequestFor(measureId) {
  const q = query({ dimensions: ['account_id'], grain: 'NONE', measures: [measureId], filters: [] });
  const bound = chartBinding(`w-${measureId === 'INCOME' ? '0201' : measureId === 'EXPENSE' ? '0202' : '0203'}`, q, 'account_id', measureId);
  let session = DRILL.createSession();
  session = DRILL.dispatch(session, bound, hierarchyRegistry,
    action('DOWN', bound.widget_id, 'ACCOUNT', 'GROUP', 'ACCOUNT', 'SYN-ACC-GROUP-MAIN', measureId));
  session = DRILL.dispatch(session, bound, hierarchyRegistry,
    action('THROUGH', bound.widget_id, 'ACCOUNT', 'ACCOUNT', null, 'SYN-ACC-A', measureId));
  return { bound, session, request: DRILL.buildDrillThroughRequest(session, bound) };
}
for (const measureId of ['INCOME', 'EXPENSE', 'CASH_FLOW']) {
  const { request } = accountRequestFor(measureId);
  const expected = KPI.evaluateKpi(measureId, transactions.filter((item) => item.account_id === 'SYN-ACC-A'), {
    currency: 'RUB', period: { start: '2026-01-01', end: '2027-01-01' }
  }).value_minor;
  const receipt = DRILL.reconcileDrillThrough(transactions, null, request, expected);
  assert.strictEqual(receipt.status, 'PASS', measureId);
  assert.strictEqual(receipt.measure_id, measureId);
}

// BACK/RESET mirror ANL-074 history and restore drill metadata deterministically.
const savedHash = categorySession.present.drill_hash;
const reset = DRILL.dispatch(categorySession, null, null, systemAction('RESET'));
assert.strictEqual(reset.present, null);
const restored = DRILL.dispatch(reset, null, null, systemAction('BACK'));
assert.strictEqual(restored.present.drill_hash, savedHash);
assert.strictEqual(restored.exploration_session.present.state_hash, categorySession.exploration_session.present.state_hash);

// Fail-closed validation and privacy-safe telemetry.
assert.throws(() => DRILL.dispatch(DRILL.createSession(), categoryBound, hierarchyRegistry,
  action('DOWN', 'w-0102', 'ACCOUNT', 'GROUP', 'ACCOUNT', 'SYN-ACC-GROUP-MAIN', 'EXPENSE')), /DASH083_SOURCE_DIMENSION_NOT_BOUND/);
assert.throws(() => DRILL.dispatch(DRILL.createSession(), categoryBound, hierarchyRegistry,
  action('DOWN', 'w-0102', 'CATEGORY', 'GROUP', 'CATEGORY', 'SYN-CAT-FOOD', 'EXPENSE')), /DASH083_INITIAL_HIERARCHY_SELECTION_INVALID/);
assert.throws(() => DRILL.normalizeAction(action('DOWN', 'w-0102', 'CATEGORY', 'GROUP', 'CATEGORY', 'SYN-CAT-GROUP-EXPENSE', 'BUDGET_VARIANCE')), /DASH083_MEASURE_UNSUPPORTED/);

const telemetry = DRILL.telemetry('RECONCILE', categoryReceipt);
assert.deepStrictEqual(Object.keys(telemetry).sort(), DRILL.CONTRACT.telemetry_allowlist.slice().sort());
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['SYN-CAT-FOOD', 'SYN-ACC-A', 'SYN-MEMBER-A', 'amount_minor', String(categoryExpected), 'RUB']) {
  assert(!telemetryText.includes(forbidden), `telemetry leak: ${forbidden}`);
}

console.log('dashboard_drill_through_contract_test: OK', {
  contract: `${DRILL.SCHEMA}@${DRILL.VERSION}`,
  timeLevels: DRILL.CONTRACT.time_hierarchy.levels,
  measures: DRILL.CONTRACT.supported_reconciliation_measures,
  txAuthority: false,
  financialTruthAuthority: false,
  publicEvidence: DRILL.CONTRACT.privacy.public_evidence,
  freeOnly: true
});
