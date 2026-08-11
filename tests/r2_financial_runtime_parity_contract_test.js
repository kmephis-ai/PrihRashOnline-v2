'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { evaluateKpis } = require('../lib/finance/kpi_dictionary');
const googleAdapter = require('../lib/adapters/google_sheets_transaction_repository');
const {
  GENERATED_RUNTIME_BUNDLE,
  RUNTIME_SCHEMA,
  ENTRY_MODULES,
  buildRuntimeBundleSource
} = require('../tools/build-apps-script-runtime-bundle');

const root = path.join(__dirname, '..');
const bridgeSource = fs.readFileSync(path.join(root, 'R2FinancialRuntimeService.js'), 'utf8');
new vm.Script(bridgeSource, { filename: 'R2FinancialRuntimeService.js' });

const headers = googleAdapter.MAPPING.required_headers.slice();
function record(values) {
  const row = {};
  headers.forEach((header) => { row[header] = ''; });
  Object.assign(row, values);
  return row;
}

const records = [
  record({ ID: 'SYN-PREV-001', 'Дата и время': '2026-01-15T10:00:00Z', 'Тип': 'доход', 'Сумма': '50.00', 'Счёт': 'SYN-A', 'Категория': 'SYN-INCOME', 'Статус': 'posted', 'Источник': 'SYNTHETIC', 'Строка источника': '1' }),
  record({ ID: 'SYN-INC-001', 'Дата и время': '2026-02-05T10:00:00Z', 'Тип': 'доход', 'Сумма': '100.00', 'Счёт': 'SYN-A', 'Категория': 'SYN-INCOME', 'Статус': 'проведено', 'Источник': 'SYNTHETIC', 'Строка источника': '2' }),
  record({ ID: 'SYN-EXP-001', 'Дата и время': '2026-02-06T10:00:00Z', 'Тип': 'расход', 'Сумма': '30.00', 'Счёт': 'SYN-A', 'Категория': 'SYN-FOOD', 'Статус': 'Перенесено', 'Источник': 'SYNTHETIC', 'Строка источника': '3' }),
  record({ ID: 'SYN-REF-001', 'Дата и время': '2026-02-07T10:00:00Z', 'Тип': 'возврат', 'Сумма': '5.00', 'Счёт': 'SYN-A', 'Категория': 'SYN-FOOD', 'Статус': 'posted', 'Источник': 'SYNTHETIC', 'Строка источника': '4' }),
  record({ ID: 'SYN-TRF-001', 'Дата и время': '2026-02-08T10:00:00Z', 'Тип': 'перевод', 'Сумма': '20.00', 'Счёт': 'SYN-A', 'Счёт назначения': 'SYN-B', 'Категория': 'SYN-TRANSFER', 'Статус': 'posted', 'Источник': 'SYNTHETIC', 'Строка источника': '5' }),
  record({ ID: 'SYN-PEND-001', 'Дата и время': '2026-02-09T10:00:00Z', 'Тип': 'доход', 'Сумма': '999.00', 'Счёт': 'SYN-A', 'Категория': 'SYN-INCOME', 'Статус': 'pending', 'Источник': 'SYNTHETIC', 'Строка источника': '6' }),
  record({ ID: 'SYN-ADJ-001', 'Дата и время': '2026-02-10T10:00:00Z', 'Тип': 'корректировка', 'Сумма': '0.00', 'Счёт': 'SYN-A', 'Категория': 'SYN-ADJUST', 'Статус': 'posted', 'Источник': 'SYNTHETIC', 'Строка источника': '7' })
];

function projectedSnapshot(request) {
  const required = Array.from(request.required_headers || headers);
  const rows = records.map((item) => required.map((header) => item[header]));
  return {
    schema: 'PRH_GOOGLE_OPERATIONS_TABLE_V1',
    gateway_version: '1.1.0',
    mapping_version: '1.0.0',
    sheet_name: '01 Операции',
    start_row: 2,
    headers: required,
    rows
  };
}

function digestBytes(value) {
  return Array.from(crypto.createHash('sha256').update(String(value), 'utf8').digest())
    .map((byte) => byte > 127 ? byte - 256 : byte);
}

const context = vm.createContext({
  console,
  Buffer,
  getSettingsMap_() { return { currency: 'RUB' }; },
  prhGoogleRepositoryReadOperationsTable_: projectedSnapshot,
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest(algorithm, value, charset) {
      assert.strictEqual(algorithm, 'SHA_256');
      assert.strictEqual(charset, 'UTF_8');
      return digestBytes(value);
    },
    formatDate(date, zone, pattern) {
      assert.strictEqual(zone, 'UTC');
      assert.strictEqual(pattern, 'yyyy-MM-dd');
      return new Date(date).toISOString().slice(0, 10);
    }
  }
});

const bundleSource = buildRuntimeBundleSource(root);
new vm.Script(bundleSource, { filename: GENERATED_RUNTIME_BUNDLE });
vm.runInContext(bundleSource, context, { filename: GENERATED_RUNTIME_BUNDLE });
vm.runInContext(bridgeSource, context, { filename: 'R2FinancialRuntimeService.js' });

assert.strictEqual(context.PRH_R2_CANONICAL_RUNTIME.schema, RUNTIME_SCHEMA);
assert.strictEqual(context.PRH_R2_CANONICAL_RUNTIME.generated_from_canonical_lib, true);
assert.strictEqual(context.PRH_R2_CANONICAL_RUNTIME.financial_formula_copy, false);
assert.deepStrictEqual(Object.keys(ENTRY_MODULES).sort(), ['financialReconciliation', 'googleAdapter', 'home', 'kpiDictionary']);
assert.strictEqual(context.PRH_R2_FIN_RUNTIME.SCHEMA, 'PRH_R2_FIN_RUNTIME_BRIDGE_V1');
assert.strictEqual(context.PRH_R2_FIN_RUNTIME.FINANCIAL_FORMULA_COPY, false);
assert.strictEqual(context.PRH_R2_FIN_RUNTIME.UI_FINANCIAL_FORMULA_AUTHORITY, false);
assert.strictEqual(context.PRH_R2_FIN_RUNTIME.WRITE_AUTHORITY, false);
assert.strictEqual(context.PRH_R2_FIN_RUNTIME.FREE_ONLY, true);

const runtimeSource = context.prhR2FinReadTransactions_();
assert.strictEqual(runtimeSource.currency, 'RUB');
assert.strictEqual(runtimeSource.transactions.length, records.length);
assert.strictEqual(runtimeSource.transactions.find((tx) => tx.transaction_id === 'SYN-EXP-001').status, 'posted');
const period = context.prhR2FinLatestMonthPeriod_(runtimeSource.transactions);
assert.deepStrictEqual(JSON.parse(JSON.stringify(period)), {
  start: '2026-02-01', end: '2026-03-01', partial: false
});

const canonical = evaluateKpis(Array.from(runtimeSource.transactions).map((tx) => ({ ...tx })), {
  currency: 'RUB',
  period: { start: period.start, end: period.end, partial: false }
});
const home = context.prhR2BuildFinancialHomeRuntime_();
assert.strictEqual(home.schema, 'PRH_FINANCIAL_HOME_VIEW_V1');
assert.strictEqual(home.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(home.kpi_dictionary_version, '1.0.0');
assert.strictEqual(home.cards.INCOME.value_minor, canonical.income_minor);
assert.strictEqual(home.cards.EXPENSE.value_minor, canonical.expense_minor);
assert.strictEqual(home.cards.CASH_FLOW.value_minor, canonical.cash_flow_minor);
assert.strictEqual(home.cards.SAVINGS.value_minor, canonical.savings_minor);
assert.strictEqual(home.cards.BUDGET.state, 'NOT_CONFIGURED');
assert.strictEqual(home.cards.LIQUIDITY.cash_flow_proxy_used, false);
assert.strictEqual(home.provenance.financial_values, 'FIN010_EVALUATE_KPIS_RESULT');
assert.strictEqual(home.provenance.runtime_bridge, 'GENERATED_CANONICAL_LIB_BUNDLE');
assert.strictEqual(home.provenance.generated_from_canonical_lib, true);
assert.strictEqual(home.provenance.financial_formula_copy, false);
assert.strictEqual(home.provenance.legacy_total_cells_used, false);
assert.deepStrictEqual(JSON.parse(JSON.stringify(home.visual_data.expense_mix)), [['SYN-FOOD', 2500]]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(home.visual_data.cash_flow_minor)), [7500]);

// Fail-closed adapter/config boundaries remain outside financial semantics.
const badCurrencyContext = vm.createContext({
  console,
  Buffer,
  PRH_R2_CANONICAL_RUNTIME: context.PRH_R2_CANONICAL_RUNTIME,
  getSettingsMap_: () => ({ currency: '' }),
  prhGoogleRepositoryReadOperationsTable_: projectedSnapshot,
  Utilities: context.Utilities
});
vm.runInContext(bridgeSource, badCurrencyContext, { filename: 'R2FinancialRuntimeService.js' });
assert.throws(() => badCurrencyContext.prhR2FinCurrency_(), /R2_RUNTIME_CURRENCY_SETTING_REQUIRED/);

assert.doesNotMatch(bridgeSource, /prhR2FinAggregate_/);
assert.doesNotMatch(bridgeSource, /income_minor\s*\+=|gross_expense_minor\s*\+=|refund_minor\s*\+=|cash_flow_minor\s*=\s*.*income/i);
assert.doesNotMatch(bridgeSource, /setValue\s*\(|setValues\s*\(|appendRow\s*\(|deleteRow\s*\(|insertRow/);
assert.match(bridgeSource, /runtime\.home\.buildFinancialHome/);
assert.match(bridgeSource, /runtime\.googleAdapter\.createGoogleSheetsTransactionRepository/);
assert.match(bridgeSource, /runtime\.financialReconciliation\.aggregateTransactions/);
assert.match(bundleSource, /Generated by trusted candidate packager from canonical lib sources/);
assert.match(bundleSource, /lib\/finance\/kpi_dictionary\.js/);
assert.match(bundleSource, /lib\/home\/financial_home\.js/);
assert.match(bundleSource, /lib\/adapters\/google_sheets_transaction_repository\.js/);

console.log('r2_financial_runtime_parity_contract_test: OK', {
  policy: 'FIN-TRUTH-v1',
  kpiDictionary: '1.0.0',
  generatedCanonicalBundle: true,
  duplicateFinancialFormula: false,
  canonicalGoogleAdapter: true,
  refundParity: true,
  transferNeutral: true,
  pendingExcluded: true,
  writeAuthority: false,
  publicFixture: 'SYNTHETIC_ONLY'
});
