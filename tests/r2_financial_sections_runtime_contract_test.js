'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'R2FinancialSectionsRuntimeService.js'), 'utf8');
new vm.Script(source, { filename: 'R2FinancialSectionsRuntimeService.js' });

const analyticsEngine = require('../lib/analytics/analytics_engine');
const expenseBase = require('../lib/expense/expense_analytics');
const incomeBase = require('../lib/income/income_analytics');
const cashFlowBase = require('../lib/cashflow/cash_flow_dashboard');
const googleAdapter = require('../lib/adapters/google_sheets_transaction_repository');
const singleScanRefresh = require('../lib/repository/single_scan_refresh');
const { repositoryRevision } = require('../lib/repository/transaction_repository');

function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

let ordinal = 1;
function tx(id, day, type, amount, category, account = 'ACC-1') {
  return Object.freeze({
    schema: 'PRH_CANONICAL_TRANSACTION_V1', schema_version: 1,
    transaction_id: `TX-${id}`, occurred_at: `${day}T12:00:00Z`, type, status: 'posted',
    amount_minor: amount, currency: 'RUB', account_id: account,
    destination_account_id: null, category_id: category, member_id: 'MEM-1', project_id: null,
    tags: Object.freeze([]), counterparty: null, description: null, reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: Object.freeze({
      source_system: 'SYNTHETIC', source_container: 'FIN-REC-001-test',
      source_record_id: `SRC-${id}`, source_fingerprint: fingerprint(id),
      identity_strategy: 'EXTERNAL_ID', transform_version: 'FIN-REC-001-test-v1',
      source_position: `row:${ordinal++}`
    })
  });
}

const transactions = Object.freeze([
  tx('OLD', '2025-01-01', 'expense', 99000, 'CAT-HOME'),
  tx('E1', '2026-08-10', 'expense', 30000, 'CAT-FOOD'),
  tx('E2', '2026-07-20', 'expense', 15000, 'CAT-HOME'),
  tx('I1', '2026-08-01', 'income', 120000, 'CAT-SALARY'),
  tx('I2', '2026-07-01', 'income', 20000, 'CAT-BONUS', 'ACC-2'),
  tx('PE', '2026-05-10', 'expense', 25000, 'CAT-FOOD'),
  tx('PI', '2026-05-10', 'income', 100000, 'CAT-SALARY')
]);
const revision = repositoryRevision(transactions);
const labels = {
  'ACC-1': 'Основной', 'ACC-2': 'Накопительный', 'MEM-1': 'Семья',
  'CAT-FOOD': 'Продукты', 'CAT-HOME': 'Дом', 'CAT-SALARY': 'Зарплата', 'CAT-BONUS': 'Премия'
};
const runtime = Object.freeze({ expenseAnalytics: expenseBase, incomeAnalytics: incomeBase, cashFlowDashboard: cashFlowBase });
let snapshotCalls = 0;
let analyticsCalls = 0;
let revisionOverride = null;
function snapshot() {
  snapshotCalls += 1;
  const currentRevision = revisionOverride || revision;
  return Object.freeze({
    runtime, currency: 'RUB', transactions, revision: currentRevision,
    telemetry: Object.freeze({ elapsed_ms: 7 }),
    dimensions: Object.freeze({ displayLabel(kind, id) { return labels[id] || id; } }),
    cycle: Object.freeze({
      analytics(query) { analyticsCalls += 1; return analyticsEngine.evaluateAnalytics(transactions, query); },
      getTelemetry() { return Object.freeze({ snapshot_reuse_count: analyticsCalls }); }
    })
  });
}

const context = vm.createContext({
  console, Object, Array, String, Number, Math, Date, RegExp, Error, JSON,
  prhR2CanonicalRuntime_() { return runtime; }, prhR2DataCreateSnapshot_: snapshot,
  prhPrivacyResolveMode_(value) { return String(value || 'NORMAL').trim().toUpperCase(); },
  prhR2DataBoundedReason_(error) {
    const value = String(error && (error.code || error.message) || 'R2_FIN_SECTIONS_SOURCE_UNAVAILABLE');
    return /^[A-Z][A-Z0-9_]{2,79}$/.test(value) ? value : 'R2_FIN_SECTIONS_SOURCE_UNAVAILABLE';
  }
});
vm.runInContext(source, context, { filename: 'R2FinancialSectionsRuntimeService.js' });

assert.strictEqual(context.PRH_R2_FIN_SECTIONS_RUNTIME.WRITE_AUTHORITY, false);
assert.strictEqual(context.PRH_R2_FIN_SECTIONS_RUNTIME.CANONICAL_MUTATION_AUTHORITY, false);
assert.strictEqual(context.PRH_R2_FIN_SECTIONS_RUNTIME.FREE_ONLY, true);
assert.strictEqual(context.prhR2FinancialSectionsRuntimeSmokeToken(), 'PRH_R2_FIN_SECTIONS_RUNTIME_V1|SHARED_SNAPSHOT|READ_ONLY|OK');

function fetchSection(section, filters = {}) {
  snapshotCalls = 0;
  analyticsCalls = 0;
  const view = context.prhR2FetchFinancialSectionsPayload({ privacy_mode: 'NORMAL', section, window_days: 90, filters });
  assert.strictEqual(snapshotCalls, 1);
  assert.strictEqual(analyticsCalls, 2);
  assert.strictEqual(view.state, Object.keys(filters).length ? view.state : 'READY');
  assert.strictEqual(view.telemetry.canonical_snapshot_read_count, 1);
  assert.strictEqual(view.telemetry.analytics_query_count, 2);
  assert.strictEqual(view.telemetry.analytics_runtime_authority, 'PRH_ANALYTICS_CONTRACT_V1');
  assert.strictEqual(view.telemetry.analytics_scope_days, 180);
  assert.strictEqual(view.telemetry.financial_payload_in_telemetry, false);
  return view;
}

const expenses = fetchSection('expenses');
const income = fetchSection('income');
const cashFlow = fetchSection('cash-flow');
assert.strictEqual(expenses.period.start, '2026-05-13');
assert.strictEqual(expenses.period.end, '2026-08-11');
assert.strictEqual(expenses.comparison_period.start, '2026-02-12');
assert.strictEqual(expenses.comparison_period.end, '2026-05-13');
assert.strictEqual(expenses.expenses.total_expense_minor, 45000);
assert.strictEqual(expenses.expenses.comparison_expense_minor, 25000);
assert.strictEqual(income.income.total_income_minor, 140000);
assert.strictEqual(income.income.comparison_income_minor, 100000);
assert.strictEqual(cashFlow.cash_flow.inflow_minor, 140000);
assert.strictEqual(cashFlow.cash_flow.outflow_minor, 45000);
assert.strictEqual(cashFlow.cash_flow.net_minor, 95000);
assert.strictEqual(expenses.snapshot_revision, income.snapshot_revision);
assert.strictEqual(income.snapshot_revision, cashFlow.snapshot_revision);
assert.strictEqual(expenses.expenses.total_expense_minor, cashFlow.cash_flow.outflow_minor);
assert.strictEqual(income.income.total_income_minor, cashFlow.cash_flow.inflow_minor);
assert.strictEqual(income.income.total_income_minor - expenses.expenses.total_expense_minor, cashFlow.cash_flow.net_minor);
assert(expenses.filters.options.categories.some((item) => item.label === 'Продукты'));
assert(income.income.source_mix.some((item) => item.source_label === 'Зарплата'));

const base = {
  currency: 'RUB', period: expenses.period, comparison_period: expenses.comparison_period,
  base_filter_context: { schema: 'PRH_FILTER_CONTEXT_V1', contract_version: '1.0.0', filters: [] }
};
const expBaseline = expenseBase.buildExpenseAnalytics(transactions, Object.assign({}, base, { trend_grain: 'DAY' }));
const incBaseline = incomeBase.buildIncomeAnalytics(transactions, Object.assign({}, base, { trend_grain: 'DAY' }));
const cfBaseline = cashFlowBase.buildCashFlowDashboard(transactions, Object.assign({}, base, { grain: 'DAY' }));
assert.strictEqual(expenses.expenses.total_expense_minor, expBaseline.total_expense_minor);
assert.strictEqual(income.income.total_income_minor, incBaseline.total_income_minor);
assert.strictEqual(cashFlow.cash_flow.net_minor, cfBaseline.net_minor);
assert.deepStrictEqual(Array.from(expenses.expenses.trend, (row) => row.expense_minor), expBaseline.trend.points.map((row) => row.expense_minor));
assert.deepStrictEqual(Array.from(income.income.trend, (row) => row.income_minor), incBaseline.trend.points.map((row) => row.income_minor));
assert.deepStrictEqual(Array.from(cashFlow.cash_flow.trend, (row) => row.net_minor), cfBaseline.trend.points.map((row) => row.net_minor));

assert.strictEqual(fetchSection('expenses', { account_ids: ['ACC-2'] }).expenses.total_expense_minor, 0);
assert.strictEqual(fetchSection('income', { account_ids: ['ACC-2'] }).income.total_income_minor, 20000);
assert.strictEqual(fetchSection('cash-flow', { account_ids: ['ACC-2'] }).cash_flow.net_minor, 20000);

snapshotCalls = 0;
analyticsCalls = 0;
const masked = context.prhR2FetchFinancialSectionsPayload({ privacy_mode: 'MASKED', section: 'income', window_days: 90 });
assert.strictEqual(snapshotCalls, 1);
assert.strictEqual(analyticsCalls, 0);
assert.strictEqual(masked.state, 'MASKED');
assert.strictEqual(masked.telemetry.analytics_query_count, 0);
assert(!JSON.stringify(masked).includes('Продукты'));

snapshotCalls = 0;
const demo = context.prhR2FetchFinancialSectionsPayload({ privacy_mode: 'DEMO', section: 'cash-flow', window_days: 90 });
assert.strictEqual(snapshotCalls, 0);
assert.strictEqual(demo.state, 'PRIVACY_MODE_UNAVAILABLE');

revisionOverride = 'b'.repeat(64);
analyticsCalls = 0;
const stale = context.prhR2FetchFinancialSectionsPayload({ privacy_mode: 'NORMAL', section: 'expenses', window_days: 90, expected_revision: revision });
assert.strictEqual(stale.state, 'STALE_SNAPSHOT');
assert.strictEqual(analyticsCalls, 0);
revisionOverride = null;

const headers = googleAdapter.MAPPING.required_headers.slice();
const rawRows = [];
function rawRow(id, occurredAt, type, category, sourceRow) {
  const values = {
    'ID': id, 'Дата и время': new Date(occurredAt), 'Тип': type, 'Сумма': '10.00', 'Счёт': 'Основной',
    'Счёт назначения': '', 'Категория': category, 'Наименование': id, 'Член семьи': 'Семья', 'Проект': '',
    'Теги': '', 'Комментарий': '', 'Источник': 'SYNTHETIC', 'Строка источника': String(sourceRow), 'Статус': 'posted'
  };
  return headers.map((header) => values[header]);
}
for (let i = 0; i < 1200; i += 1) {
  rawRows.push(rawRow(`OLD-${i}`, `2020-01-${String((i % 28) + 1).padStart(2, '0')}T12:00:00Z`, 'expense', 'Питание', i + 2));
}
for (let i = 0; i < 520; i += 1) {
  const date = new Date(Date.UTC(2026, 7, 10 - (i % 180), 12));
  const type = i % 3 === 0 ? 'income' : 'expense';
  rawRows.push(rawRow(`RECENT-${i}`, date.toISOString(), type, type === 'income' ? 'Зарплата' : 'Питание', i + 1202));
}
const calls = [];
function gateway(request = {}) {
  const required = request.required_headers || headers;
  const startRow = request.start_row == null ? 2 : Number(request.start_row);
  const offset = startRow - 2;
  const count = request.row_count == null ? rawRows.length - offset : Number(request.row_count);
  calls.push({ required_headers: Array.from(required), row_count: count, cell_read_count: required.length * count });
  return {
    schema: 'PRH_GOOGLE_OPERATIONS_TABLE_V1', sheet_name: '01 Операции', start_row: startRow,
    headers: Array.from(required),
    rows: rawRows.slice(offset, offset + count).map((row) => Array.from(required, (header) => row[headers.indexOf(header)])),
    read_plan: { range_read_count: count ? 1 : 0, cell_read_count: required.length * count }
  };
}
const projectionContext = vm.createContext({
  console, Object, Array, String, Number, Math, Date, RegExp, Error, JSON,
  prhR2DataRuntime_() { return Object.freeze({ googleAdapter, singleScanRefresh }); },
  prhR2FinCurrency_() { return 'RUB'; },
  prhR2FinCreateDimensionResolverState_() {
    return Object.freeze({
      resolvers: Object.freeze({
        account: (v) => v === 'Основной' ? 'ACC-MAIN' : '',
        category: (v) => v === 'Зарплата' ? 'CAT-SALARY' : v === 'Питание' ? 'CAT-FOOD' : '',
        member: (v) => v === 'Семья' ? 'MEM-FAMILY' : '', project: () => ''
      }),
      displayLabel(kind, id) { return id; }
    });
  },
  prhGoogleRepositoryReadOperationsTable_: gateway,
  prhR2DataCreateSnapshot_() { throw new Error('FULL_HISTORY_FALLBACK_MUST_NOT_RUN'); }
});
vm.runInContext(source, projectionContext, { filename: 'R2FinancialSectionsRuntimeService.js' });
const projected = projectionContext.prhR2FinSectionsCreateProjectedSource_(90);
assert.strictEqual(projected.schema, 'PRH_R2_FIN_SOURCE_PROJECTION_V1');
assert.strictEqual(projected.telemetry.source_projection, 'RECENT_DAY_WINDOW');
assert.strictEqual(projected.transactions.length, 520);
assert(projected.transactions.length > 500);
assert.deepStrictEqual(calls[0].required_headers, ['ID', 'Дата и время']);
assert.strictEqual(calls[0].row_count, rawRows.length);
assert.strictEqual(calls.slice(1).reduce((sum, call) => sum + call.row_count, 0), 520);
assert(!calls.some((call) => call.required_headers.length === headers.length && call.row_count === rawRows.length));
const projectedCells = calls.reduce((sum, call) => sum + call.cell_read_count, 0);
const fullHistoryCells = rawRows.length * headers.length;
assert(projectedCells < fullHistoryCells * 0.5);
assert.strictEqual(projected.telemetry.cell_read_count, projectedCells);
assert(!projected.transactions.some((item) => item.transaction_id.startsWith('OLD-')));
assert.strictEqual(projected.cycle.writeBatch({}).status, 'BLOCKED');

assert.doesNotMatch(source, /\.setValue\s*\(|\.setValues\s*\(|appendRow\s*\(|deleteRow\s*\(/);
assert.match(source, /prhR2FinSectionsCreateProjectedSource_/);
assert.match(source, /required_headers:\s*timelineHeaders\.slice\(\)/);
assert.match(source, /source_projection:\s*'RECENT_DAY_WINDOW'/);
assert.match(source, /source\.cycle\.analytics/);
assert.match(source, /analytics_query_count: 2/);
assert.doesNotMatch(source, /expenseAnalytics\.buildExpenseAnalytics\(/);
assert.doesNotMatch(source, /incomeAnalytics\.buildIncomeAnalytics\(/);
assert.doesNotMatch(source, /cashFlowDashboard\.buildCashFlowDashboard\(/);

console.log('r2_financial_sections_runtime_contract_test: OK', {
  canonicalAnalyticsFastPath: true,
  twoAnalyticsQueriesPerSection: true,
  specializedModuleParity: true,
  boundedHistoricalProjection: true,
  projectionOver500Rows: true,
  projectedCellReductionPct: Math.round((1 - projectedCells / fullHistoryCells) * 100),
  crossSectionFinTruthParity: true,
  staleFailClosed: true,
  zeroWrite: true
});
