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
const { repositoryRevision } = require('../lib/repository/transaction_repository');

const buildCalls = { expenses: 0, income: 0, cashFlow: 0 };
const runtime = Object.freeze({
  expenseAnalytics: Object.assign({}, expenseBase, {
    buildExpenseAnalytics() {
      buildCalls.expenses += 1;
      return expenseBase.buildExpenseAnalytics.apply(expenseBase, arguments);
    }
  }),
  incomeAnalytics: Object.assign({}, incomeBase, {
    buildIncomeAnalytics() {
      buildCalls.income += 1;
      return incomeBase.buildIncomeAnalytics.apply(incomeBase, arguments);
    }
  }),
  cashFlowDashboard: Object.assign({}, cashFlowBase, {
    buildCashFlowDashboard() {
      buildCalls.cashFlow += 1;
      return cashFlowBase.buildCashFlowDashboard.apply(cashFlowBase, arguments);
    }
  })
});

function resetBuildCalls() {
  buildCalls.expenses = 0;
  buildCalls.income = 0;
  buildCalls.cashFlow = 0;
}

let rowOrdinal = 1;
function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function tx(id, day, type, amount, category, account = 'ACC-1', member = 'MEM-1') {
  const ordinal = rowOrdinal++;
  return Object.freeze({
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: id,
    occurred_at: `${day}T12:00:00Z`,
    type,
    status: 'posted',
    amount_minor: amount,
    currency: 'RUB',
    account_id: account,
    destination_account_id: type === 'transfer' ? 'ACC-2' : null,
    category_id: category,
    member_id: member,
    project_id: null,
    tags: Object.freeze([]),
    counterparty: null,
    description: null,
    reverses_transaction_id: null,
    adjustment_semantics: type === 'refund' ? 'expense_reduction' : null,
    provenance: Object.freeze({
      source_system: 'SYNTHETIC',
      source_container: 'FIN-REC-001-test',
      source_record_id: `SRC-${id}`,
      source_fingerprint: fingerprint(`SRC-${id}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'FIN-REC-001-test-v1',
      source_position: `row:${ordinal + 1}`
    })
  });
}

const transactions = Object.freeze([
  tx('OLD-OUTSIDE', '2025-01-01', 'expense', 99000, 'CAT-HOME'),
  tx('CUR-EXP-1', '2026-08-10', 'expense', 30000, 'CAT-FOOD'),
  tx('CUR-EXP-2', '2026-07-20', 'expense', 15000, 'CAT-HOME'),
  tx('CUR-INC-1', '2026-08-01', 'income', 120000, 'CAT-SALARY'),
  tx('CUR-INC-2', '2026-07-01', 'income', 20000, 'CAT-BONUS', 'ACC-2'),
  tx('PREV-EXP-1', '2026-05-10', 'expense', 25000, 'CAT-FOOD'),
  tx('PREV-INC-1', '2026-05-10', 'income', 100000, 'CAT-SALARY')
]);

const labels = {
  'ACC-1': 'Основной',
  'ACC-2': 'Накопительный',
  'MEM-1': 'Семья',
  'CAT-FOOD': 'Продукты',
  'CAT-HOME': 'Дом',
  'CAT-SALARY': 'Зарплата',
  'CAT-BONUS': 'Премия'
};

let snapshotCalls = 0;
let analyticsCalls = 0;
const canonicalRevision = repositoryRevision(transactions);
let revisionOverride = null;

function snapshot() {
  snapshotCalls += 1;
  const revision = revisionOverride || canonicalRevision;
  return Object.freeze({
    runtime,
    currency: 'RUB',
    transactions,
    revision,
    telemetry: Object.freeze({ elapsed_ms: 7 }),
    dimensions: Object.freeze({
      displayLabel(kind, id) {
        if (!labels[id]) throw new Error(`LABEL_MISSING:${kind}:${id}`);
        return labels[id];
      }
    }),
    cycle: Object.freeze({
      analytics(query) {
        analyticsCalls += 1;
        return analyticsEngine.evaluateAnalytics(transactions, query);
      },
      getTelemetry() {
        return Object.freeze({ snapshot_reuse_count: analyticsCalls });
      }
    })
  });
}

const context = vm.createContext({
  console,
  Object,
  Array,
  String,
  Number,
  Math,
  Date,
  RegExp,
  Error,
  JSON,
  prhR2CanonicalRuntime_() { return runtime; },
  prhR2DataCreateSnapshot_: snapshot,
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
  resetBuildCalls();
  const view = context.prhR2FetchFinancialSectionsPayload({
    privacy_mode: 'NORMAL',
    section,
    window_days: 90,
    filters
  });
  assert.strictEqual(snapshotCalls, 1, `${section} must read one canonical snapshot`);
  assert.strictEqual(analyticsCalls, 2, `${section} must use two bounded canonical analytics queries`);
  assert.deepStrictEqual(buildCalls, { expenses: 0, income: 0, cashFlow: 0 }, 'runtime fast path must not call O(days*N) specialized builders');
  assert.strictEqual(view.section, section);
  assert.strictEqual(view.telemetry.canonical_snapshot_read_count, 1);
  assert.strictEqual(view.telemetry.analytics_build_count, 1);
  assert.strictEqual(view.telemetry.analytics_query_count, 2);
  assert.strictEqual(view.telemetry.analytics_section, section);
  assert.strictEqual(view.telemetry.analytics_runtime_authority, 'PRH_ANALYTICS_CONTRACT_V1');
  assert.strictEqual(view.telemetry.analytics_scope_days, 180);
  if (Object.keys(filters).length === 0) assert.strictEqual(view.telemetry.analytics_input_record_count, 6);
  assert(view.telemetry.analytics_input_record_count <= view.telemetry.filtered_record_count);
  assert.strictEqual(view.telemetry.snapshot_elapsed_ms, 7);
  assert(view.telemetry.analytics_elapsed_ms >= 0);
  assert(view.telemetry.total_elapsed_ms >= 0);
  assert.strictEqual(view.telemetry.financial_payload_in_telemetry, false);
  return view;
}

const expensesView = fetchSection('expenses');
assert.strictEqual(expensesView.schema, 'PRH_R2_PRIVATE_FINANCIAL_SECTIONS_VIEW_V1');
assert.strictEqual(expensesView.state, 'READY');
assert.strictEqual(expensesView.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(expensesView.financial_write_authorized, false);
assert.strictEqual(expensesView.canonical_mutation_performed, false);
assert.strictEqual(expensesView.period.end, '2026-08-11');
assert.strictEqual(expensesView.period.start, '2026-05-13');
assert.strictEqual(expensesView.comparison_period.end, expensesView.period.start);
assert.strictEqual(expensesView.comparison_period.start, '2026-02-12');
assert.strictEqual(expensesView.expenses.trend.length, 90);
assert.strictEqual(expensesView.expenses.total_expense_minor, 45000);
assert.strictEqual(expensesView.expenses.comparison_expense_minor, 25000);
assert.strictEqual(expensesView.income, null);
assert.strictEqual(expensesView.cash_flow, null);
assert(expensesView.filters.options.categories.some((item) => item.label === 'Продукты'));
assert(expensesView.expenses.category_mix.some((item) => item.category_label === 'Продукты'));

const incomeView = fetchSection('income');
assert.strictEqual(incomeView.expenses, null);
assert.strictEqual(incomeView.income.trend.length, 90);
assert.strictEqual(incomeView.income.total_income_minor, 140000);
assert.strictEqual(incomeView.income.comparison_income_minor, 100000);
assert.strictEqual(incomeView.cash_flow, null);
assert(incomeView.income.source_mix.some((item) => item.source_label === 'Зарплата'));

const cashFlowView = fetchSection('cash-flow');
assert.strictEqual(cashFlowView.expenses, null);
assert.strictEqual(cashFlowView.income, null);
assert.strictEqual(cashFlowView.cash_flow.trend.length, 90);
assert.strictEqual(cashFlowView.cash_flow.inflow_minor, 140000);
assert.strictEqual(cashFlowView.cash_flow.outflow_minor, 45000);
assert.strictEqual(cashFlowView.cash_flow.net_minor, 95000);
assert.strictEqual(cashFlowView.snapshot_revision, canonicalRevision);
assert.strictEqual(expensesView.snapshot_revision, incomeView.snapshot_revision);
assert.strictEqual(incomeView.snapshot_revision, cashFlowView.snapshot_revision);
assert.strictEqual(expensesView.expenses.total_expense_minor, cashFlowView.cash_flow.outflow_minor);
assert.strictEqual(incomeView.income.total_income_minor, cashFlowView.cash_flow.inflow_minor);
assert.strictEqual(incomeView.income.total_income_minor - expensesView.expenses.total_expense_minor, cashFlowView.cash_flow.net_minor);

// Numeric parity against the previously used specialized canonical modules.
const baseOptions = {
  currency: 'RUB',
  period: expensesView.period,
  comparison_period: expensesView.comparison_period,
  base_filter_context: { schema: 'PRH_FILTER_CONTEXT_V1', contract_version: '1.0.0', filters: [] }
};
const baselineExpense = expenseBase.buildExpenseAnalytics(transactions, Object.assign({}, baseOptions, { trend_grain: 'DAY' }));
const baselineIncome = incomeBase.buildIncomeAnalytics(transactions, Object.assign({}, baseOptions, { trend_grain: 'DAY' }));
const baselineCashFlow = cashFlowBase.buildCashFlowDashboard(transactions, Object.assign({}, baseOptions, { grain: 'DAY' }));
assert.strictEqual(expensesView.expenses.total_expense_minor, baselineExpense.total_expense_minor);
assert.strictEqual(expensesView.expenses.comparison_expense_minor, baselineExpense.comparison_expense_minor);
assert.deepStrictEqual(
  Array.from(expensesView.expenses.trend, (row) => row.expense_minor),
  baselineExpense.trend.points.map((row) => row.expense_minor)
);
assert.strictEqual(incomeView.income.total_income_minor, baselineIncome.total_income_minor);
assert.strictEqual(incomeView.income.comparison_income_minor, baselineIncome.comparison_income_minor);
assert.deepStrictEqual(
  Array.from(incomeView.income.trend, (row) => row.income_minor),
  baselineIncome.trend.points.map((row) => row.income_minor)
);
assert.strictEqual(cashFlowView.cash_flow.inflow_minor, baselineCashFlow.inflow_minor);
assert.strictEqual(cashFlowView.cash_flow.outflow_minor, baselineCashFlow.outflow_minor);
assert.strictEqual(cashFlowView.cash_flow.net_minor, baselineCashFlow.net_minor);
assert.deepStrictEqual(
  Array.from(cashFlowView.cash_flow.trend, (row) => row.net_minor),
  baselineCashFlow.trend.points.map((row) => row.net_minor)
);

const filteredExpenses = fetchSection('expenses', { account_ids: ['ACC-2'] });
assert.strictEqual(filteredExpenses.expenses.total_expense_minor, 0);
const filteredIncome = fetchSection('income', { account_ids: ['ACC-2'] });
assert.strictEqual(filteredIncome.income.total_income_minor, 20000);
const filteredCashFlow = fetchSection('cash-flow', { account_ids: ['ACC-2'] });
assert.strictEqual(filteredCashFlow.cash_flow.net_minor, 20000);

snapshotCalls = 0;
analyticsCalls = 0;
resetBuildCalls();
const masked = context.prhR2FetchFinancialSectionsPayload({ privacy_mode: 'MASKED', section: 'income', window_days: 90 });
assert.strictEqual(snapshotCalls, 1);
assert.strictEqual(analyticsCalls, 0);
assert.deepStrictEqual(buildCalls, { expenses: 0, income: 0, cashFlow: 0 });
assert.strictEqual(masked.state, 'MASKED');
assert.strictEqual(masked.section, 'income');
assert.strictEqual(masked.telemetry.analytics_build_count, 0);
assert.strictEqual(masked.telemetry.analytics_query_count, 0);
assert.strictEqual(masked.telemetry.snapshot_elapsed_ms, 7);
assert.strictEqual(Object.prototype.hasOwnProperty.call(masked, 'expenses'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(masked, 'filters'), false);
assert(!JSON.stringify(masked).includes('Продукты'));
assert(!JSON.stringify(masked).includes('120000'));

snapshotCalls = 0;
const demo = context.prhR2FetchFinancialSectionsPayload({ privacy_mode: 'DEMO', section: 'cash-flow', window_days: 90 });
assert.strictEqual(snapshotCalls, 0);
assert.strictEqual(demo.state, 'PRIVACY_MODE_UNAVAILABLE');
assert.strictEqual(demo.section, 'cash-flow');
assert.strictEqual(demo.financial_write_authorized, false);

revisionOverride = 'b'.repeat(64);
analyticsCalls = 0;
const stale = context.prhR2FetchFinancialSectionsPayload({
  privacy_mode: 'NORMAL',
  section: 'expenses',
  window_days: 90,
  expected_revision: canonicalRevision
});
assert.strictEqual(stale.state, 'STALE_SNAPSHOT');
assert.strictEqual(stale.section, 'expenses');
assert.strictEqual(stale.snapshot_revision, revisionOverride);
assert.strictEqual(analyticsCalls, 0);
revisionOverride = null;

const invalidWindow = context.prhR2FetchFinancialSectionsPayload({ privacy_mode: 'NORMAL', section: 'expenses', window_days: 7 });
assert.strictEqual(invalidWindow.state, 'SOURCE_UNAVAILABLE');
assert.strictEqual(invalidWindow.financial_write_authorized, false);
const invalidSection = context.prhR2FetchFinancialSectionsPayload({ privacy_mode: 'NORMAL', section: 'budget', window_days: 90 });
assert.strictEqual(invalidSection.state, 'SOURCE_UNAVAILABLE');
assert.strictEqual(invalidSection.reason_code, 'R2_FIN_SECTIONS_SECTION_INVALID');

assert.doesNotMatch(source, /\.setValue\s*\(|\.setValues\s*\(|appendRow\s*\(|deleteRow\s*\(/);
assert.match(source, /prhR2DataCreateSnapshot_/);
assert.match(source, /source\.cycle\.analytics/);
assert.match(source, /PRH_ANALYTICS_CONTRACT_V1/);
assert.match(source, /analytics_query_count: 2/);
assert.doesNotMatch(source, /expenseAnalytics\.buildExpenseAnalytics\(/);
assert.doesNotMatch(source, /incomeAnalytics\.buildIncomeAnalytics\(/);
assert.doesNotMatch(source, /cashFlowDashboard\.buildCashFlowDashboard\(/);

console.log('r2_financial_sections_runtime_contract_test: OK', {
  oneSnapshotPerSection: true,
  canonicalAnalyticsFastPath: true,
  twoAnalyticsQueriesPerSection: true,
  noPerDayFullInputRescan: true,
  specializedModuleParity: true,
  equalWindowComparison: true,
  crossSectionFinTruthParity: true,
  filterState: true,
  maskedNoAnalyticsBuild: true,
  staleFailClosed: true,
  timingTelemetry: true,
  zeroWrite: true
});
