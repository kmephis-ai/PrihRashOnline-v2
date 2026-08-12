'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const googleAdapter = require('../lib/adapters/google_sheets_transaction_repository');
const { buildRuntimeBundleSource, GENERATED_RUNTIME_BUNDLE } = require('../tools/build-apps-script-runtime-bundle');

const root = path.join(__dirname, '..');
const finBridgeSource = fs.readFileSync(path.join(root, 'R2FinancialRuntimeService.js'), 'utf8');
const visualBridgeSource = fs.readFileSync(path.join(root, 'R2VisualizationRuntimeService.js'), 'utf8');
new vm.Script(visualBridgeSource, { filename: 'R2VisualizationRuntimeService.js' });

const headers = googleAdapter.MAPPING.required_headers.slice();

function record(values) {
  const row = {};
  headers.forEach((header) => { row[header] = ''; });
  Object.assign(row, values);
  return row;
}

function syntheticRecords() {
  return [
    record({ ID: 'SYN-VIZ-01', 'Дата и время': '2026-01-10T12:00:00Z', 'Тип': 'доход', 'Сумма': '1000.00', 'Счёт': 'СИН Счёт', 'Категория': 'СИН Доход', 'Статус': 'posted', 'Источник': 'SYNTHETIC', 'Строка источника': '1' }),
    record({ ID: 'SYN-VIZ-02', 'Дата и время': '2026-02-10T12:00:00Z', 'Тип': 'расход', 'Сумма': '100.00', 'Счёт': 'СИН Счёт', 'Категория': 'СИН Питание', 'Статус': 'posted', 'Источник': 'SYNTHETIC', 'Строка источника': '2' }),
    record({ ID: 'SYN-VIZ-03', 'Дата и время': '2026-03-10T12:00:00Z', 'Тип': 'доход', 'Сумма': '1100.00', 'Счёт': 'СИН Счёт', 'Категория': 'СИН Доход', 'Статус': 'posted', 'Источник': 'SYNTHETIC', 'Строка источника': '3' }),
    record({ ID: 'SYN-VIZ-04', 'Дата и время': '2026-04-10T12:00:00Z', 'Тип': 'расход', 'Сумма': '120.00', 'Счёт': 'СИН Счёт', 'Категория': 'СИН Питание', 'Статус': 'posted', 'Источник': 'SYNTHETIC', 'Строка источника': '4' }),
    record({ ID: 'SYN-VIZ-05', 'Дата и время': '2026-05-10T12:00:00Z', 'Тип': 'доход', 'Сумма': '1200.00', 'Счёт': 'СИН Счёт', 'Категория': 'СИН Доход', 'Статус': 'posted', 'Источник': 'SYNTHETIC', 'Строка источника': '5' }),
    record({ ID: 'SYN-VIZ-06', 'Дата и время': '2026-06-10T12:00:00Z', 'Тип': 'расход', 'Сумма': '140.00', 'Счёт': 'СИН Счёт', 'Категория': 'СИН Питание', 'Статус': 'posted', 'Источник': 'SYNTHETIC', 'Строка источника': '6' }),
    record({ ID: 'SYN-VIZ-07', 'Дата и время': '2026-07-10T12:00:00Z', 'Тип': 'доход', 'Сумма': '1300.00', 'Счёт': 'СИН Счёт', 'Категория': 'СИН Доход', 'Статус': 'posted', 'Источник': 'SYNTHETIC', 'Строка источника': '7' }),
    record({ ID: 'SYN-VIZ-08', 'Дата и время': '2026-08-10T12:00:00Z', 'Тип': 'расход', 'Сумма': '160.00', 'Счёт': 'СИН Счёт', 'Категория': 'СИН Питание', 'Статус': 'posted', 'Источник': 'SYNTHETIC', 'Строка источника': '8' })
  ];
}

function digestBytes(value) {
  return Array.from(crypto.createHash('sha256').update(String(value), 'utf8').digest())
    .map((byte) => byte > 127 ? byte - 256 : byte);
}

function utilities() {
  return {
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
  };
}

function createContext(records) {
  let gatewayCalls = 0;
  let gatewayCells = 0;
  function projectedSnapshot(request = {}) {
    gatewayCalls += 1;
    const required = Array.from(request.required_headers || headers);
    const startRow = request.start_row == null ? 2 : Number(request.start_row);
    const startIndex = startRow - 2;
    const available = Math.max(0, records.length - startIndex);
    const rowCount = request.row_count == null ? available : Math.min(available, Number(request.row_count));
    const selectedRecords = records.slice(startIndex, startIndex + rowCount);
    const rows = selectedRecords.map((item) => required.map((header) => item[header]));
    gatewayCells += required.length * rows.length;
    return {
      schema: 'PRH_GOOGLE_OPERATIONS_TABLE_V1',
      gateway_version: '1.1.0',
      mapping_version: '1.0.0',
      sheet_name: '01 Операции',
      start_row: startRow,
      headers: required,
      rows
    };
  }

  const context = vm.createContext({
    console,
    Buffer,
    getSettingsMap_: () => ({ currency: 'RUB' }),
    prhGoogleRepositoryReadOperationsTable_: projectedSnapshot,
    Utilities: utilities()
  });
  const bundleSource = buildRuntimeBundleSource(root);
  vm.runInContext(bundleSource, context, { filename: GENERATED_RUNTIME_BUNDLE });
  vm.runInContext(finBridgeSource, context, { filename: 'R2FinancialRuntimeService.js' });
  vm.runInContext(visualBridgeSource, context, { filename: 'R2VisualizationRuntimeService.js' });
  return { context, gatewayCalls: () => gatewayCalls, gatewayCells: () => gatewayCells };
}

assert.doesNotMatch(finBridgeSource, /prhR2BuildFinancialHomeVisualRuntime_/,
  'primary Home KPI bridge must not call the async chart payload');
assert.doesNotMatch(finBridgeSource, /recentMonthsProjection/,
  'primary Home KPI bridge must remain on its bounded latest-month path');
assert.doesNotMatch(visualBridgeSource, /income_minor\s*[-+*/]=|expense_minor\s*[-+*/]=|cash_flow_minor\s*=/,
  'visual runtime must not implement financial formulas');
assert.doesNotMatch(visualBridgeSource, /setValue\s*\(|setValues\s*\(|appendRow\s*\(|deleteRow\s*\(|insertRow/,
  'visual runtime must remain read-only');
assert.doesNotMatch(visualBridgeSource, /series\s*:|xAxis\s*:|yAxis\s*:|radius\s*:/,
  'visual runtime must not construct ECharts options itself');
assert.match(visualBridgeSource, /runtime\.kpiDictionary\.evaluateKpis/,
  'each period must use canonical FIN-010 evaluation');
assert.match(visualBridgeSource, /runtime\.recentMonthsProjection\.readRecentCalendarMonths/);
assert.match(visualBridgeSource, /runtime\.home\.compileHouseholdCashFlowChart/,
  'cash-flow option must compile through canonical Home ChartSpec');
assert.match(visualBridgeSource, /runtime\.home\.compileHouseholdExpenseMixChart/,
  'expense option must compile through canonical Home ChartSpec');

const readyHarness = createContext(syntheticRecords());
const ready = readyHarness.context.prhR2BuildFinancialHomeVisualRuntime_();
assert.strictEqual(readyHarness.context.PRH_R2_VISUAL_RUNTIME.SCHEMA, 'PRH_R2_HOUSEHOLD_VISUAL_RUNTIME_V1');
assert.strictEqual(readyHarness.context.PRH_R2_VISUAL_RUNTIME.VERSION, '1.1.0');
assert.strictEqual(readyHarness.context.PRH_R2_VISUAL_RUNTIME.PERIOD_COUNT, 6);
assert.strictEqual(readyHarness.context.PRH_R2_VISUAL_RUNTIME.RENDERER, 'ECHARTS_6');
assert.strictEqual(readyHarness.context.PRH_R2_VISUAL_RUNTIME.WRITE_AUTHORITY, false);
assert.strictEqual(readyHarness.context.PRH_R2_VISUAL_RUNTIME.FINANCIAL_FORMULA_COPY, false);
assert.strictEqual(readyHarness.context.PRH_R2_VISUAL_RUNTIME.UI_CHART_OPTION_AUTHORITY, false);
assert.strictEqual(typeof readyHarness.context.PRH_R2_CANONICAL_RUNTIME.home.compileHouseholdCashFlowChart, 'function');
assert.strictEqual(typeof readyHarness.context.PRH_R2_CANONICAL_RUNTIME.home.compileHouseholdExpenseMixChart, 'function');
assert.strictEqual(ready.schema, 'PRH_R2_HOUSEHOLD_VISUAL_PAYLOAD_V1');
assert.strictEqual(ready.contract_version, '1.1.0');
assert.strictEqual(ready.status, 'READY');
assert.strictEqual(ready.requested_period_count, 6);
assert.strictEqual(ready.available_period_count, 6);
assert.strictEqual(ready.observed_period_count, 8);
assert.deepStrictEqual(JSON.parse(JSON.stringify(ready.cash_flow_periods.map((entry) => entry.period.start))), [
  '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01'
]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(ready.cash_flow_periods.map((entry) => entry.cash_flow_minor))), [
  110000, -12000, 120000, -14000, 130000, -16000
]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(ready.expense_mix)), [['СИН Питание', 16000]]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(ready.latest_period)), {
  kind: 'EXPLICIT_WINDOW',
  start: '2026-08-01',
  end: '2026-09-01',
  partial: false,
  day_count: 31,
  proration: 'NONE'
});
assert.strictEqual(ready.charts.cash_flow.renderer, 'ECHARTS_6');
assert.strictEqual(ready.charts.cash_flow.option.aria.enabled, true);
assert.strictEqual(ready.charts.cash_flow.option.title.text, 'Денежный поток');
assert.strictEqual(ready.charts.cash_flow.option.series[0].type, 'line');
assert.deepStrictEqual(JSON.parse(JSON.stringify(ready.charts.cash_flow.option.xAxis.data)), [
  '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'
]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(ready.charts.cash_flow.option.series[0].data)), [
  110000, -12000, 120000, -14000, 130000, -16000
]);
assert.strictEqual(ready.charts.expense_mix.renderer, 'ECHARTS_6');
assert.strictEqual(ready.charts.expense_mix.option.aria.enabled, true);
assert.strictEqual(ready.charts.expense_mix.option.title.text, 'Структура расходов');
assert.strictEqual(ready.charts.expense_mix.option.series[0].type, 'pie');
assert.deepStrictEqual(JSON.parse(JSON.stringify(ready.charts.expense_mix.option.series[0].data)), [
  { name: 'СИН Питание', value: 16000 }
]);
assert.strictEqual(readyHarness.gatewayCalls(), 2,
  'async visual payload must use one timeline scan plus one bounded canonical read');
assert.strictEqual(ready.provenance.gateway_call_count, 2);
assert.strictEqual(ready.provenance.full_history_canonical_scan_used, false);
assert.strictEqual(ready.provenance.repeated_repository_query_used, false);
assert.strictEqual(ready.provenance.synthetic_zero_fill_used, false);
assert.strictEqual(ready.provenance.financial_authority, 'FIN010_EVALUATE_KPIS');
assert.strictEqual(ready.provenance.chart_spec_authority, 'CANONICAL_HOME_WIDGET_SPECS');
assert.strictEqual(ready.provenance.chart_compiler, 'HOUSEHOLD_VISUAL_PROJECTION_TO_ECHARTS_6');
assert.strictEqual(ready.provenance.renderer, 'ECHARTS_6');
assert.strictEqual(ready.provenance.ui_chart_option_authority, false);
assert.strictEqual(ready.provenance.write_authority, false);
assert(readyHarness.gatewayCells() < headers.length * syntheticRecords().length + headers.length * 6,
  'bounded projection must read fewer cells than a full canonical history plus six-period read');

const sparseHarness = createContext(syntheticRecords().slice(0, 3));
const sparse = sparseHarness.context.prhR2BuildFinancialHomeVisualRuntime_();
assert.strictEqual(sparse.status, 'INSUFFICIENT_DATA');
assert.strictEqual(sparse.requested_period_count, 6);
assert.strictEqual(sparse.available_period_count, 3);
assert.strictEqual(sparse.cash_flow_periods.length, 3);
assert.deepStrictEqual(JSON.parse(JSON.stringify(sparse.cash_flow_periods.map((entry) => entry.cash_flow_minor))), [
  100000, -10000, 110000
]);
assert.strictEqual(sparse.charts.cash_flow, null,
  'insufficient history must not masquerade as a six-period chart');
assert.strictEqual(sparse.charts.expense_mix, null,
  'empty latest-period expense mix must not render a decorative donut');
assert.strictEqual(sparse.provenance.synthetic_zero_fill_used, false);
assert.strictEqual(sparseHarness.gatewayCalls(), 2);

console.log('r2_household_chart_payload_runtime_contract_test: OK', {
  asyncFromPrimaryHome: true,
  fin010PerPeriod: true,
  readyPeriods: ready.available_period_count,
  renderer: ready.charts.cash_flow.renderer,
  serverCompiledOptions: true,
  uiChartOptionAuthority: false,
  insufficientDataExplicit: sparse.status,
  boundedGatewayCalls: readyHarness.gatewayCalls(),
  repeatedRepositoryQuery: false,
  syntheticZeroFill: false,
  financialFormulaCopy: false,
  writeAuthority: false,
  freeOnly: true
});