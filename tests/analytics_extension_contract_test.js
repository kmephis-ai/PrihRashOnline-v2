'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  CONTRACT,
  QUERY_SCHEMA,
  RESULT_SCHEMA,
  normalizeAnalyticsQuery,
  analyticsQueryHash,
  previousPeriod,
  evaluateAnalytics
} = require('../lib/analytics/analytics_engine');
const { evaluateKpis } = require('../lib/finance/kpi_dictionary');

function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function tx(index, overrides = {}) {
  const type = overrides.type || 'expense';
  const base = {
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: `syn-tx-${String(index).padStart(5, '0')}`,
    occurred_at: overrides.occurred_at || '2026-01-15T12:00:00Z',
    type,
    status: overrides.status || 'posted',
    amount_minor: overrides.amount_minor == null ? 1000 : overrides.amount_minor,
    currency: overrides.currency || 'RUB',
    account_id: overrides.account_id || 'acc-main',
    destination_account_id: type === 'transfer' ? (overrides.destination_account_id || 'acc-second') : null,
    category_id: overrides.category_id || (type === 'income' ? 'cat-income' : 'cat-home'),
    member_id: overrides.member_id == null ? 'member-a' : overrides.member_id,
    project_id: overrides.project_id == null ? 'project-home' : overrides.project_id,
    tags: overrides.tags || ['synthetic'],
    counterparty: null,
    description: `Synthetic transaction ${index}`,
    reverses_transaction_id: null,
    adjustment_semantics: type === 'refund' ? 'expense_reduction' : null,
    provenance: {
      source_system: 'SYNTHETIC_TEST',
      source_container: 'analytics-fixture',
      source_record_id: `record-${String(index).padStart(5, '0')}`,
      source_fingerprint: fingerprint(`analytics:${index}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYN-ANL-010-v1',
      source_position: null
    }
  };
  return Object.freeze({ ...base, ...overrides, destination_account_id: type === 'transfer' ? base.destination_account_id : null,
    adjustment_semantics: type === 'refund' ? 'expense_reduction' : null });
}

function query(overrides = {}) {
  return {
    schema: QUERY_SCHEMA,
    contract_version: '1.0.0',
    currency: 'RUB',
    measures: ['INCOME', 'EXPENSE', 'CASH_FLOW', 'SAVINGS', 'GROSS_EXPENSE', 'REFUND', 'TRANSFER'],
    dimensions: [],
    filters: [],
    time_range: { start: '2026-01-01', end: '2026-03-01' },
    grain: 'NONE',
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 5000,
    ...overrides
  };
}

const fixture = [
  tx(1, { type: 'income', amount_minor: 100000, occurred_at: '2026-01-05T10:00:00Z', category_id: 'cat-salary' }),
  tx(2, { type: 'expense', amount_minor: 25000, occurred_at: '2026-01-10T10:00:00Z', category_id: 'cat-home' }),
  tx(3, { type: 'refund', amount_minor: 5000, occurred_at: '2026-01-12T10:00:00Z', category_id: 'cat-home' }),
  tx(4, { type: 'transfer', amount_minor: 30000, occurred_at: '2026-01-15T10:00:00Z', category_id: 'cat-transfer' }),
  tx(5, { type: 'expense', amount_minor: 12000, occurred_at: '2026-02-03T10:00:00Z', category_id: 'cat-food', member_id: 'member-b' }),
  tx(6, { type: 'income', amount_minor: 40000, occurred_at: '2025-12-15T10:00:00Z', category_id: 'cat-bonus' }),
  tx(7, { type: 'expense', amount_minor: 9000, occurred_at: '2025-12-20T10:00:00Z', category_id: 'cat-home' }),
  tx(8, { type: 'expense', amount_minor: 7777, occurred_at: '2026-01-20T10:00:00Z', category_id: 'cat-hidden', status: 'pending' })
];

assert.strictEqual(CONTRACT.schema, 'PRH_ANALYTICS_CONTRACT_V1');
assert.strictEqual(CONTRACT.version, '1.0.0');
assert.strictEqual(CONTRACT.renderer_neutral, true);
assert.strictEqual(CONTRACT.storage_neutral, true);
assert.strictEqual(CONTRACT.authorities.financial_write, false);
assert.strictEqual(CONTRACT.financial_truth_policy, 'FIN-TRUTH-v1');

const normalized = normalizeAnalyticsQuery(query());
assert.strictEqual(normalized.schema, QUERY_SCHEMA);
assert.strictEqual(normalized.currency, 'RUB');
assert.deepStrictEqual(normalized.filters, []);
assert.strictEqual(analyticsQueryHash(query()), analyticsQueryHash({ ...query(), filters: [] }));
assert(/^[0-9a-f]{64}$/.test(analyticsQueryHash(query())));

const result = evaluateAnalytics(fixture, query());
assert.strictEqual(result.schema, RESULT_SCHEMA);
assert.strictEqual(result.total_rows, 1);
assert.strictEqual(result.truncated, false);
assert.strictEqual(result.provenance.canonical_schema, 'PRH_CANONICAL_TRANSACTION_V1');
assert.strictEqual(result.provenance.kpi_dictionary_version, '1.0.0');
assert.strictEqual(result.provenance.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(result.provenance.legacy_total_cells_used, false);
assert.strictEqual(result.provenance.ui_logic_used, false);
assert.strictEqual(result.provenance.query_hash, result.query_hash);
assert(/^[0-9a-f]{64}$/.test(result.provenance.input_revision));

const direct = evaluateKpis(fixture, {
  currency: 'RUB',
  period: { start: '2026-01-01', end: '2026-03-01' }
});
const row = result.rows[0].measures;
assert.deepStrictEqual(row, {
  INCOME: direct.income_minor,
  EXPENSE: direct.expense_minor,
  CASH_FLOW: direct.cash_flow_minor,
  SAVINGS: direct.savings_minor,
  GROSS_EXPENSE: direct.gross_expense_minor,
  REFUND: direct.refund_minor,
  TRANSFER: direct.transfer_minor
});

const budget = evaluateAnalytics(fixture, query({
  measures: ['BUDGET_VARIANCE'],
  parameters: { budget_minor: 50000 }
}));
const budgetDirect = evaluateKpis(fixture, {
  currency: 'RUB',
  period: { start: '2026-01-01', end: '2026-03-01' },
  budget_minor: 50000
});
assert.strictEqual(budget.rows[0].measures.BUDGET_VARIANCE, budgetDirect.budget_variance_minor);

const grouped = evaluateAnalytics(fixture, query({
  measures: ['EXPENSE', 'REFUND'],
  dimensions: ['category_id'],
  sort: [{ kind: 'MEASURE', key: 'EXPENSE', direction: 'DESC' }]
}));
assert(grouped.rows.length >= 2);
for (const groupedRow of grouped.rows) {
  const category = groupedRow.dimensions.category_id;
  const directCategory = evaluateKpis(fixture.filter((item) => item.category_id === category), {
    currency: 'RUB',
    period: { start: '2026-01-01', end: '2026-03-01' }
  });
  assert.strictEqual(groupedRow.measures.EXPENSE, directCategory.expense_minor);
  assert.strictEqual(groupedRow.measures.REFUND, directCategory.refund_minor);
}

const monthly = evaluateAnalytics(fixture, query({
  measures: ['INCOME', 'EXPENSE'],
  grain: 'MONTH',
  sort: [{ kind: 'DIMENSION', key: 'time_bucket', direction: 'ASC' }]
}));
assert.deepStrictEqual(monthly.rows.map((item) => item.dimensions.time_bucket), ['2026-01', '2026-02']);

const filtered = evaluateAnalytics(fixture, query({
  measures: ['EXPENSE'],
  filters: [
    { field: 'category_id', operator: 'IN', values: ['cat-home', 'cat-food'] },
    { field: 'status', operator: 'EQ', values: ['posted'] }
  ]
}));
assert.strictEqual(filtered.rows[0].measures.EXPENSE, direct.expense_minor);

const comparison = evaluateAnalytics(fixture, query({
  measures: ['INCOME', 'EXPENSE'],
  time_range: { start: '2026-01-01', end: '2026-02-01' },
  comparison: { mode: 'PREVIOUS_PERIOD' }
}));
assert.deepStrictEqual(comparison.comparison.time_range, previousPeriod({ start: '2026-01-01', end: '2026-02-01' }));
const previousDirect = evaluateKpis(fixture, {
  currency: 'RUB',
  period: comparison.comparison.time_range
});
assert.strictEqual(comparison.rows[0].comparison_measures.INCOME, previousDirect.income_minor);
assert.strictEqual(comparison.rows[0].comparison_measures.EXPENSE, previousDirect.expense_minor);

assert.throws(() => normalizeAnalyticsQuery(query({ measures: ['UNKNOWN'] })), /ANALYTICS_MEASURES_INVALID/);
assert.throws(() => normalizeAnalyticsQuery(query({ grain: 'MONTH', time_range: null })), /ANALYTICS_GRAIN_REQUIRES_TIME_RANGE/);
assert.throws(() => normalizeAnalyticsQuery(query({ comparison: { mode: 'PREVIOUS_PERIOD' }, time_range: null })), /ANALYTICS_COMPARISON_REQUIRES_TIME_RANGE/);
assert.throws(() => normalizeAnalyticsQuery(query({ measures: ['BUDGET_VARIANCE'], dimensions: ['category_id'], parameters: { budget_minor: 1000 } })), /ANALYTICS_BUDGET_GROUPING_UNSUPPORTED/);
assert.throws(() => normalizeAnalyticsQuery(query({ measures: ['EXPENSE'], parameters: { budget_minor: 1000 } })), /ANALYTICS_BUDGET_WITHOUT_MEASURE/);
assert.throws(() => normalizeAnalyticsQuery({ ...query(), privatePayload: true }), /ANALYTICS_QUERY_SHAPE_INVALID/);
assert.throws(() => normalizeAnalyticsQuery(query({ sort: [{ kind: 'MEASURE', key: 'INCOME', direction: 'SIDEWAYS' }] })), /ANALYTICS_SORT_INVALID/);

// Deterministic synthetic property sweep: no UI/storage semantics and KPI parity for ungrouped queries.
let state = 0x1a2b3c4d;
function random() {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state / 0x100000000;
}
const types = ['income', 'expense', 'refund', 'transfer'];
for (let iteration = 0; iteration < 80; iteration += 1) {
  const synthetic = [];
  const count = 8 + Math.floor(random() * 24);
  for (let index = 0; index < count; index += 1) {
    const type = types[Math.floor(random() * types.length)];
    const month = random() < 0.5 ? '01' : '02';
    const day = String(1 + Math.floor(random() * 20)).padStart(2, '0');
    synthetic.push(tx(1000 + iteration * 100 + index, {
      type,
      amount_minor: Math.floor(random() * 100000),
      occurred_at: `2026-${month}-${day}T09:00:00Z`,
      category_id: `cat-${1 + Math.floor(random() * 4)}`,
      member_id: `member-${1 + Math.floor(random() * 3)}`
    }));
  }
  const analytics = evaluateAnalytics(synthetic, query());
  const expected = evaluateKpis(synthetic, {
    currency: 'RUB',
    period: { start: '2026-01-01', end: '2026-03-01' }
  });
  assert.strictEqual(analytics.rows[0].measures.INCOME, expected.income_minor);
  assert.strictEqual(analytics.rows[0].measures.EXPENSE, expected.expense_minor);
  assert.strictEqual(analytics.rows[0].measures.CASH_FLOW, expected.cash_flow_minor);
  assert.strictEqual(analytics.rows[0].measures.REFUND, expected.refund_minor);
  assert.strictEqual(analytics.rows[0].measures.TRANSFER, expected.transfer_minor);
}

const engineSource = fs.readFileSync(path.join(__dirname, '..', 'lib/analytics/analytics_engine.js'), 'utf8');
assert(!/SpreadsheetApp|HtmlService|DocumentApp|UrlFetchApp|fetch\s*\(|XMLHttpRequest|\bdocument\.|\bwindow\./.test(engineSource));
assert(!/writeBatch|setValues|appendRow|financial_write_authority\s*[:=]\s*true/.test(engineSource));

console.log('analytics_extension_contract_test: OK', {
  schema: CONTRACT.schema,
  version: CONTRACT.version,
  querySchema: QUERY_SCHEMA,
  resultSchema: RESULT_SCHEMA,
  rendererNeutral: true,
  storageNeutral: true,
  kpiParity: true,
  deterministicQueryIdentity: true,
  comparison: 'PREVIOUS_PERIOD',
  propertyIterations: 80,
  financialWriteAuthority: false
});
