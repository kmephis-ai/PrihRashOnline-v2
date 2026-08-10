'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { evaluateKpis } = require('../lib/finance/kpi_dictionary');
const googleAdapter = require('../lib/adapters/google_sheets_transaction_repository');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'R2FinancialRuntimeService.js'), 'utf8');
new vm.Script(source, { filename: 'R2FinancialRuntimeService.js' });

const headers = ['ID', 'Дата и время', 'Тип', 'Сумма', 'Счёт', 'Счёт назначения', 'Категория', 'Статус'];
const rows = [
  ['SYN-PREV-001', '2026-01-15T10:00:00Z', 'доход', '50.00', 'SYN-A', '', 'SYN-INCOME', 'posted'],
  ['SYN-INC-001', '2026-02-05T10:00:00Z', 'доход', '100.00', 'SYN-A', '', 'SYN-INCOME', 'проведено'],
  ['SYN-EXP-001', '2026-02-06T10:00:00Z', 'расход', '30.00', 'SYN-A', '', 'SYN-FOOD', 'Перенесено'],
  ['SYN-REF-001', '2026-02-07T10:00:00Z', 'возврат', '5.00', 'SYN-A', '', 'SYN-FOOD', 'posted'],
  ['SYN-TRF-001', '2026-02-08T10:00:00Z', 'перевод', '20.00', 'SYN-A', 'SYN-B', 'SYN-TRANSFER', 'posted'],
  ['SYN-PEND-001', '2026-02-09T10:00:00Z', 'доход', '999.00', 'SYN-A', '', 'SYN-INCOME', 'pending'],
  ['SYN-ADJ-001', '2026-02-10T10:00:00Z', 'корректировка', '0.00', 'SYN-A', '', 'SYN-ADJUST', 'posted']
];

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
  getSettingsMap_() { return { currency: 'RUB' }; },
  prhGoogleRepositoryReadOperationsTable_(request) {
    assert.deepStrictEqual(Array.from(request.required_headers), headers);
    return { schema: 'PRH_GOOGLE_OPERATIONS_TABLE_V1', sheet_name: '01 Операции', headers, rows, start_row: 2 };
  },
  Utilities: {
    formatDate(date, zone, pattern) {
      assert.strictEqual(zone, 'UTC');
      assert.strictEqual(pattern, 'yyyy-MM-dd');
      return new Date(date).toISOString().slice(0, 10);
    }
  }
});
vm.runInContext(source, context, { filename: 'R2FinancialRuntimeService.js' });

assert.strictEqual(context.PRH_R2_FIN_RUNTIME.SCHEMA, 'PRH_R2_FIN_RUNTIME_ADAPTER_V1');
assert.strictEqual(context.PRH_R2_FIN_RUNTIME.FINANCIAL_TRUTH_POLICY, 'FIN-TRUTH-v1');
assert.strictEqual(context.PRH_R2_FIN_RUNTIME.WRITE_AUTHORITY, false);
assert.strictEqual(context.PRH_R2_FIN_RUNTIME.UI_FINANCIAL_FORMULA_AUTHORITY, false);
assert.strictEqual(context.PRH_R2_FIN_RUNTIME.FREE_ONLY, true);

// Mapping parity with the canonical Google adapter, including the MIG-010 materialized target marker.
for (const value of ['доход', 'расход', 'перевод', 'возврат', 'корректировка', 'income', 'expense']) {
  assert.strictEqual(context.prhR2FinType_(value), googleAdapter.normalizeType(value));
}
for (const value of ['', 'проведено', 'оплачено', 'Перенесено', 'posted', 'pending', 'отменено']) {
  assert.strictEqual(context.prhR2FinStatus_(value), googleAdapter.normalizeStatus(value));
}
assert.strictEqual(googleAdapter.normalizeStatus('Перенесено'), 'posted');
for (const value of ['0', '1', '10.25', '123456.78']) {
  assert.strictEqual(context.prhR2FinMajorToMinor_(value), googleAdapter.majorToMinorExact(value));
}

const runtimeSource = context.prhR2FinReadTransactions_();
assert.strictEqual(runtimeSource.transactions.find((tx) => tx.transaction_id === 'SYN-EXP-001').status, 'posted');
const period = context.prhR2FinLatestMonthPeriod_(runtimeSource.transactions);
assert.deepStrictEqual(JSON.parse(JSON.stringify(period)), {
  kind: 'EXPLICIT_WINDOW', start: '2026-02-01', end: '2026-03-01', partial: false, day_count: 28, proration: 'NONE'
});

const canonical = evaluateKpis(Array.from(runtimeSource.transactions).map((tx) => ({ ...tx })), {
  currency: 'RUB',
  period: { start: '2026-02-01', end: '2026-03-01', partial: false }
});
const runtime = context.prhR2FinAggregate_(runtimeSource.transactions, 'RUB', period);
assert.strictEqual(runtime.income_minor, canonical.income_minor);
assert.strictEqual(runtime.expense_minor, canonical.expense_minor);
assert.strictEqual(runtime.cash_flow_minor, canonical.cash_flow_minor);
assert.strictEqual(runtime.savings_minor, canonical.savings_minor);
assert.strictEqual(runtime.gross_expense_minor, canonical.gross_expense_minor);
assert.strictEqual(runtime.refund_minor, canonical.refund_minor);
assert.strictEqual(runtime.transfer_minor, canonical.transfer_minor);
assert.strictEqual(runtime.included_count, canonical.included_count);
assert.strictEqual(runtime.excluded_status_count, canonical.excluded_status_count);
assert.strictEqual(runtime.income_minor, 10000);
assert.strictEqual(runtime.expense_minor, 2500);
assert.strictEqual(runtime.cash_flow_minor, 7500);
assert.strictEqual(runtime.transfer_minor, 2000);

const home = context.prhR2FinBuildHomeView_(runtimeSource);
assert.strictEqual(home.schema, 'PRH_FINANCIAL_HOME_VIEW_V1');
assert.strictEqual(home.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(home.cards.INCOME.value_minor, canonical.income_minor);
assert.strictEqual(home.cards.EXPENSE.value_minor, canonical.expense_minor);
assert.strictEqual(home.cards.CASH_FLOW.value_minor, canonical.cash_flow_minor);
assert.strictEqual(home.cards.SAVINGS.value_minor, canonical.savings_minor);
assert.strictEqual(home.cards.BUDGET.state, 'NOT_CONFIGURED');
assert.strictEqual(home.cards.LIQUIDITY.cash_flow_proxy_used, false);
assert.strictEqual(home.provenance.financial_values, 'FIN010_PARITY_GUARDED_RUNTIME_ADAPTER');
assert.strictEqual(home.provenance.ui_financial_formula_used, false);
assert.strictEqual(home.provenance.legacy_total_cells_used, false);
assert.deepStrictEqual(JSON.parse(JSON.stringify(home.visual_data.expense_mix)), [['SYN-FOOD', 2500]]);

// Fail-closed adversarial boundaries.
assert.throws(() => context.prhR2FinMajorToMinor_('1.234'), /R2_FIN_AMOUNT_PRECISION_INVALID/);
assert.throws(() => context.prhR2FinType_('mystery'), /R2_FIN_TYPE_UNMAPPED/);
assert.throws(() => context.prhR2FinStatus_('mystery'), /R2_FIN_STATUS_UNMAPPED/);
const badCurrencyContext = vm.createContext({ ...context, getSettingsMap_: () => ({ currency: '' }) });
vm.runInContext(source, badCurrencyContext, { filename: 'R2FinancialRuntimeService.js' });
assert.throws(() => badCurrencyContext.prhR2FinCurrency_(), /R2_RUNTIME_CURRENCY_SETTING_REQUIRED/);

assert.doesNotMatch(source, /setValue\s*\(|setValues\s*\(|appendRow\s*\(|deleteRow\s*\(|insertRow/);
assert.doesNotMatch(source, /GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED\s*=|financial_write\s*:\s*true/i);
assert.match(source, /FIN010_PARITY_GUARDED_RUNTIME_ADAPTER/);
assert.match(source, /prhGoogleRepositoryReadOperationsTable_/);
assert.match(source, /getSettingsMap_/);

console.log('r2_financial_runtime_parity_contract_test: OK', {
  policy: 'FIN-TRUTH-v1',
  kpiDictionary: '1.0.0',
  exactMoney: true,
  migratedStatusParity: true,
  refundParity: true,
  transferNeutral: true,
  pendingExcluded: true,
  writeAuthority: false,
  publicFixture: 'SYNTHETIC_ONLY'
});
