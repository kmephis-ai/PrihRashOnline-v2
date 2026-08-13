'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'R2FinancialSectionsRuntimeService.js'), 'utf8');
new vm.Script(source, { filename: 'R2FinancialSectionsRuntimeService.js' });

const runtime = Object.freeze({
  expenseAnalytics: require('../lib/expense/expense_analytics'),
  incomeAnalytics: require('../lib/income/income_analytics'),
  cashFlowDashboard: require('../lib/cashflow/cash_flow_dashboard')
});

function tx(id, day, type, amount, category, account = 'ACC-1', member = 'MEM-1') {
  return Object.freeze({
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
    tags: [],
    counterparty: null,
    description: null,
    reverses_transaction_id: null,
    adjustment_semantics: null
  });
}

const transactions = Object.freeze([
  tx('CUR-EXP-1', '2026-08-10', 'expense', 30000, 'CAT-FOOD'),
  tx('CUR-EXP-2', '2026-07-20', 'expense', 15000, 'CAT-HOME'),
  tx('CUR-INC-1', '2026-08-01', 'income', 120000, 'CAT-SALARY'),
  tx('CUR-INC-2', '2026-07-01', 'income', 20000, 'CAT-BONUS', 'ACC-2'),
  tx('PREV-EXP-1', '2026-05-10', 'expense', 25000, 'CAT-FOOD'),
  tx('PREV-INC-1', '2026-05-15', 'income', 100000, 'CAT-SALARY')
]);

const labels = {
  'ACC-1': 'Основной', 'ACC-2': 'Накопительный', 'MEM-1': 'Семья',
  'CAT-FOOD': 'Продукты', 'CAT-HOME': 'Дом', 'CAT-SALARY': 'Зарплата', 'CAT-BONUS': 'Премия'
};
let snapshotCalls = 0;
let revision = 'a'.repeat(64);

function snapshot() {
  snapshotCalls += 1;
  return Object.freeze({
    runtime,
    currency: 'RUB',
    transactions,
    revision,
    dimensions: Object.freeze({
      displayLabel(kind, id) {
        if (!labels[id]) throw new Error(`LABEL_MISSING:${kind}:${id}`);
        return labels[id];
      }
    }),
    cycle: Object.freeze({ getTelemetry() { return Object.freeze({ snapshot_reuse_count: 0 }); } })
  });
}

const context = vm.createContext({
  console, Object, Array, String, Number, Math, Date, RegExp, Error, JSON,
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

snapshotCalls = 0;
const view = context.prhR2FetchFinancialSectionsPayload({ privacy_mode: 'NORMAL', window_days: 90, filters: {} });
assert.strictEqual(snapshotCalls, 1, 'all three financial sections must reuse one canonical snapshot');
assert.strictEqual(view.schema, 'PRH_R2_PRIVATE_FINANCIAL_SECTIONS_VIEW_V1');
assert.strictEqual(view.state, 'READY');
assert.strictEqual(view.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(view.financial_write_authorized, false);
assert.strictEqual(view.canonical_mutation_performed, false);
assert.strictEqual(view.period.end, '2026-08-11');
assert.strictEqual(view.period.start, '2026-05-13');
assert.strictEqual(view.comparison_period.end, view.period.start);
assert.strictEqual(view.comparison_period.start, '2026-02-12');
assert.strictEqual(view.expenses.total_expense_minor, view.cash_flow.outflow_minor);
assert.strictEqual(view.income.total_income_minor, view.cash_flow.inflow_minor);
assert.strictEqual(view.income.total_income_minor - view.expenses.total_expense_minor, view.cash_flow.net_minor);
assert.strictEqual(view.expenses.trend.length, 90);
assert.strictEqual(view.income.trend.length, 90);
assert.strictEqual(view.cash_flow.trend.length, 90);
assert(view.filters.options.categories.some((item) => item.label === 'Продукты'));
assert(view.expenses.category_mix.some((item) => item.category_label === 'Продукты'));
assert(view.income.source_mix.some((item) => item.source_label === 'Зарплата'));
assert.strictEqual(view.telemetry.canonical_snapshot_read_count, 1);
assert.strictEqual(view.telemetry.financial_payload_in_telemetry, false);

snapshotCalls = 0;
const filtered = context.prhR2FetchFinancialSectionsPayload({ privacy_mode: 'NORMAL', window_days: 90, filters: { account_ids: ['ACC-2'] } });
assert.strictEqual(snapshotCalls, 1);
assert.strictEqual(filtered.state, 'READY');
assert.strictEqual(filtered.income.total_income_minor, 20000);
assert.strictEqual(filtered.expenses.total_expense_minor, 0);
assert.strictEqual(filtered.cash_flow.net_minor, 20000);

snapshotCalls = 0;
const masked = context.prhR2FetchFinancialSectionsPayload({ privacy_mode: 'MASKED', window_days: 90 });
assert.strictEqual(snapshotCalls, 1);
assert.strictEqual(masked.state, 'MASKED');
assert.strictEqual(Object.prototype.hasOwnProperty.call(masked, 'expenses'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(masked, 'filters'), false);
assert(!JSON.stringify(masked).includes('Продукты'));
assert(!JSON.stringify(masked).includes('120000'));

const demo = context.prhR2FetchFinancialSectionsPayload({ privacy_mode: 'DEMO', window_days: 90 });
assert.strictEqual(demo.state, 'PRIVACY_MODE_UNAVAILABLE');
assert.strictEqual(demo.financial_write_authorized, false);

const oldRevision = revision;
revision = 'b'.repeat(64);
const stale = context.prhR2FetchFinancialSectionsPayload({ privacy_mode: 'NORMAL', window_days: 90, expected_revision: oldRevision });
assert.strictEqual(stale.state, 'STALE_SNAPSHOT');
assert.strictEqual(stale.snapshot_revision, revision);
revision = oldRevision;

const invalidWindow = context.prhR2FetchFinancialSectionsPayload({ privacy_mode: 'NORMAL', window_days: 7 });
assert.strictEqual(invalidWindow.state, 'SOURCE_UNAVAILABLE');
assert.strictEqual(invalidWindow.financial_write_authorized, false);

assert.doesNotMatch(source, /\.setValue\s*\(|\.setValues\s*\(|appendRow\s*\(|deleteRow\s*\(/);
assert.match(source, /prhR2DataCreateSnapshot_/);
assert.match(source, /expenseAnalytics\.buildExpenseAnalytics/);
assert.match(source, /incomeAnalytics\.buildIncomeAnalytics/);
assert.match(source, /cashFlowDashboard\.buildCashFlowDashboard/);

console.log('r2_financial_sections_runtime_contract_test: OK', {
  oneSnapshotThreeSections: true,
  equalWindowComparison: true,
  finTruthParity: true,
  filterState: true,
  maskedNoFinancialPayload: true,
  staleFailClosed: true,
  zeroWrite: true
});
