'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const adapter = require('../pwa/local_visualization_adapter');

const root = path.resolve(__dirname, '..');
const extension = fs.readFileSync(path.join(root, 'LocalFirstVisualizationSpaExtension.html'), 'utf8');
const service = fs.readFileSync(path.join(root, 'LocalFirstSpaService.js'), 'utf8');
const runtimeMarker = JSON.parse(fs.readFileSync(path.join(root, 'local-first-browser-runtime.json'), 'utf8'));
const vendor = JSON.parse(fs.readFileSync(path.join(root, 'echarts-vendor.json'), 'utf8'));

assert.strictEqual(adapter.schema, 'PRH_LOCAL_VISUALIZATION_ADAPTER_V1');
assert.strictEqual(adapter.version, '1.0.0');
assert.strictEqual(adapter.chartSpecSchema, 'PRH_LOCAL_VISUAL_CHART_SPEC_V1');
assert.strictEqual(adapter.topN, 7);

assert.strictEqual(vendor.schema, 'PRH_ECHARTS_VENDOR_LOCK_V1');
assert.strictEqual(vendor.version, '1.0.0');
assert.strictEqual(vendor.enabled, true);
assert.strictEqual(vendor.vendor, 'Apache ECharts');
assert.strictEqual(vendor.package, 'echarts');
assert.strictEqual(vendor.package_version, '6.1.0');
assert.strictEqual(vendor.distribution_path, 'dist/echarts.simple.min.js');
assert.strictEqual(vendor.git_blob_sha1, 'bce369777512967b396793bf4a382a1d617fdb52');
assert.strictEqual(vendor.byte_size, 500315);
assert.strictEqual(vendor.delivery, 'LOCAL_ONLY');
assert.strictEqual(vendor.runtime_network_required, false);
assert.strictEqual(vendor.external_cdn_required, false);
assert.strictEqual(vendor.cost_class, 'FREE_ONLY');

assert(runtimeMarker.modules.includes('pwa/local_visualization_adapter.js'));
assert.strictEqual(runtimeMarker.target_html, 'LocalFirstSpaWebApp.html');
assert.strictEqual(runtimeMarker.runtime_network_required_for_warm_route, false);
assert.strictEqual(runtimeMarker.external_cdn_required, false);

assert(extension.includes('data-prh-local-first-visualization-extension="1.0.0"'));
assert(extension.includes('window.__PRH_LF_FINANCE_RUNTIME__'));
assert(extension.includes('PrhLocalVisualizationAdapter'));
assert(extension.includes('finance.getState'));
assert(extension.includes('MutationObserver'));
assert(extension.includes('График скрыт в режиме приватности'));
assert(extension.includes('Текстовое представление исходных показателей сохранено ниже'));
assert(!/\bfetch\s*\(/.test(extension));
assert(!/XMLHttpRequest\s*\(/.test(extension));
assert(!/google\.script\.run/.test(extension));
assert(!/https?:\/\//i.test(extension));

assert(service.includes("VISUALIZATION_EXTENSION_FILE: 'LocalFirstVisualizationSpaExtension'"));
assert(service.includes('prhLocalFirstSpaInjectVisualizationExtension_'));
assert(service.includes('data-prh-local-first-visualization-extension="1.0.0"'));
assert(service.includes('prhLocalFirstSpaInjectPlanningExtension_(html);'));
assert(service.includes('prhLocalFirstSpaInjectVisualizationExtension_(html);'));

function readyView(route, results, labels) {
  const revision = 'a'.repeat(64);
  return Object.freeze({
    status: 'READY',
    route,
    revision,
    filter_context: Object.freeze({ currency: 'RUB' }),
    labels: Object.freeze(labels || {}),
    results: Object.freeze(results),
    provenance: Object.freeze({
      financial_truth_policy: 'FIN-TRUTH-v1',
      canonical_worker_only: true,
      ui_financial_formula_used: false,
      input_revision: revision
    })
  });
}

const categoryRows = Array.from({ length: 9 }, (_, index) => Object.freeze({
  dimensions: Object.freeze({ category_id: `CAT-${index + 1}` }),
  measures: Object.freeze({ EXPENSE: (index + 1) * 100 })
}));
const labels = {};
categoryRows.forEach((row, index) => { labels[`category|${row.dimensions.category_id}`] = `Категория ${index + 1}`; });

const expenseSpec = adapter.chartSpecFromView(readyView('expenses', {
  breakdown: Object.freeze({ rows: Object.freeze(categoryRows) })
}, labels));
assert.strictEqual(expenseSpec.status, 'READY');
assert.strictEqual(expenseSpec.kind, 'CATEGORY_BAR');
assert.strictEqual(expenseSpec.authority, 'DISPLAY_ONLY');
assert.strictEqual(expenseSpec.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(expenseSpec.categories.length, 8, 'Top-7 + Прочее expected');
assert.strictEqual(expenseSpec.categories[7], 'Прочее');
assert.strictEqual(expenseSpec.values[7], 1700, 'Прочее must conserve rows 8+9 exactly');
assert.strictEqual(expenseSpec.presentation_total, categoryRows.reduce((sum, row) => sum + row.measures.EXPENSE, 0));
assert.strictEqual(expenseSpec.values.reduce((sum, value) => sum + value, 0), expenseSpec.presentation_total);

const homeInsufficient = adapter.chartSpecFromView(readyView('home', {
  trend: Object.freeze({ rows: Object.freeze([
    Object.freeze({ dimensions: Object.freeze({ time_bucket: '2026-01' }), measures: Object.freeze({ CASH_FLOW: 100 }) })
  ]) })
}));
assert.strictEqual(homeInsufficient.status, 'INSUFFICIENT_DATA');
assert(homeInsufficient.message.includes('недостаточно'));

const flowSpec = adapter.chartSpecFromView(readyView('cash-flow', {
  total: Object.freeze({ rows: Object.freeze([]) }),
  series: Object.freeze({ rows: Object.freeze([
    Object.freeze({ dimensions: Object.freeze({ time_bucket: '2026-01' }), measures: Object.freeze({ INCOME: 1000, EXPENSE: 700, CASH_FLOW: 300 }) }),
    Object.freeze({ dimensions: Object.freeze({ time_bucket: '2026-02' }), measures: Object.freeze({ INCOME: 1200, EXPENSE: 800, CASH_FLOW: 400 }) })
  ]) })
}));
assert.strictEqual(flowSpec.status, 'READY');
assert.deepStrictEqual(flowSpec.buckets, ['2026-01', '2026-02']);
assert.deepStrictEqual(flowSpec.series.map((item) => item.measure), ['INCOME', 'EXPENSE', 'CASH_FLOW']);
assert.deepStrictEqual(flowSpec.series[2].values, [300, 400]);

assert.throws(() => adapter.chartSpecFromView(Object.assign({}, readyView('home', { trend: { rows: [] } }), {
  provenance: { financial_truth_policy: 'OTHER', canonical_worker_only: true, ui_financial_formula_used: false, input_revision: 'a'.repeat(64) }
})), /VIZ_VIEW_PROVENANCE_INVALID/);

assert.throws(() => adapter.categoryComposition([
  { dimensions: { category_id: 'CAT-X' }, measures: { EXPENSE: 1.25 } }
], 'EXPENSE', {}, 7), /VIZ_MEASURE_NOT_SAFE_INTEGER/);

console.log('local_first_visualization_contract_test: OK', {
  renderer: 'Apache ECharts 6.1.0',
  delivery: 'LOCAL_ONLY',
  authority: 'DISPLAY_ONLY_FIN_TRUTH_BOUND',
  topN: adapter.topN,
  semanticFallback: true,
  privacyFailClosed: true,
  warmNetworkRequired: false,
  externalCdnRequired: false
});
