'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');
const performanceNode = require('../pwa/local_first_performance');
const { ALLOWED_BROWSER_MODULES } = require('../tools/build-local-first-browser-runtime');

const ROOT = path.resolve(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/local_first/local_first_performance.v1.json'), 'utf8'));
const runtimeContract = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/local_first/local_first_runtime.v1.json'), 'utf8'));
const marker = JSON.parse(fs.readFileSync(path.join(ROOT, 'local-first-browser-runtime.json'), 'utf8'));
const markerContract = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/local_first/local_first_browser_runtime_marker.v1.json'), 'utf8'));
const storeSource = fs.readFileSync(path.join(ROOT, 'pwa/local_read_model_store.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const performanceSource = fs.readFileSync(path.join(ROOT, 'pwa/local_first_performance.js'), 'utf8').replace(/<\/script/gi, '<\\/script');

assert.strictEqual(contract.schema, 'PRH_LOCAL_FIRST_PERFORMANCE_CONTRACT_V1');
assert.strictEqual(contract.version, '1.0.0');
assert.strictEqual(contract.roadmap_id, 'PERF-LF-001');
assert.strictEqual(contract.clock, 'PERFORMANCE_NOW_MONOTONIC');
assert.strictEqual(contract.aggregation, 'NEAREST_RANK_P95');
assert.strictEqual(contract.measurement_domains.cold_bootstrap, 'SEPARATE_NOT_WARM_SLO');
assert.strictEqual(contract.warm_invariants.mandatory_network_requests, 0);
assert.strictEqual(contract.warm_invariants.google_sheets_reads, 0);
assert.strictEqual(contract.warm_invariants.server_document_reload, 0);
assert.strictEqual(performanceNode.storeName, 'prihrash-local-first-v1', 'performance probe must use the canonical owner Local Read Model DB');

for (const [metricId, spec] of Object.entries(contract.metrics)) {
  assert.strictEqual(runtimeContract.product_slo_targets_ms[metricId], spec.threshold_ms, `${metricId} threshold drift`);
  assert.strictEqual(performanceNode.targets[metricId].threshold_ms, spec.threshold_ms, `${metricId} browser threshold drift`);
  assert.strictEqual(performanceNode.targets[metricId].min_samples, spec.min_samples, `${metricId} browser sample floor drift`);
}
assert.deepStrictEqual(performanceNode.routes, contract.metrics.warm_route_switch_p95.routes);
assert(marker.modules.includes('pwa/local_first_performance.js'), 'enabled runtime marker must package performance module');
assert(markerContract.allowed_browser_modules.includes('pwa/local_first_performance.js'), 'marker contract must allow performance module');
assert(ALLOWED_BROWSER_MODULES.includes('pwa/local_first_performance.js'), 'trusted packager must allow performance module');

assert.strictEqual(performanceNode.percentile95(Array.from({ length: 20 }, (_, index) => index + 1)), 19, 'nearest-rank p95 drift');
assert.strictEqual(performanceNode.evaluateMetric('warm_route_switch_p95', Array(10).fill(99), 'DESKTOP').status, 'PASS');
assert.strictEqual(performanceNode.evaluateMetric('warm_route_switch_p95', Array(10).fill(101), 'DESKTOP').status, 'FAIL');
assert.strictEqual(performanceNode.evaluateMetric('warm_route_switch_p95', Array(9).fill(20), 'DESKTOP').reason, 'PERF_LF_INSUFFICIENT_SAMPLES');
assert.strictEqual(performanceNode.evaluateMetric('warm_route_switch_p95', [1,2,3,4,5,6,7,8,9,-1], 'DESKTOP').reason, 'PERF_LF_INVALID_MEASUREMENT');

const runtimeSha = 'a'.repeat(64);
const revisionPrefix = 'b'.repeat(12);
const harness = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body data-active-lf-route="home">
<span id="lf-sync-chip" data-state="READY">READY</span>
<main id="lf-main">
  <section id="lf-finance-toolbar"><button id="lf-filter-apply" type="button">Применить</button></section>
  <section id="lf-finance-content"><div class="kpi-grid"><div class="kpi">KPI</div></div><div class="series"><div class="series-bar"></div></div></section>
  <section id="lf-preview-grid" hidden></section>
</main>
<script>${storeSource}</script>
<script data-prh-local-first-runtime="1.0.0" data-runtime-sha256="${runtimeSha}">${performanceSource}</script>
<script>
(function(){
  'use strict';
  const financeRoutes=['home','expenses','income','cash-flow'];
  const content=document.getElementById('lf-finance-content');
  const toolbar=document.getElementById('lf-finance-toolbar');
  const grid=document.getElementById('lf-preview-grid');
  window.__PRH_LF_SPA_RUNTIME__={schema:'PRH_LOCAL_FIRST_SPA_RUNTIME_V1',bootCount:1,mandatoryNetworkCalls:0,googleSheetsReads:0,backgroundSyncCalls:0,financeRevisionPrefix:'${revisionPrefix}'};
  window.__PRH_LF_DATA_RUNTIME__={schema:'PRH_LOCAL_FIRST_DATA_RUNTIME_V1',networkCalls:0,googleSheetsReads:0,canonicalWrites:0};
  window.__PRH_LF_DATA_EXTENSION__={schema:'PRH_LOCAL_FIRST_DATA_EXTENSION_V1',getState:function(){return {networkCalls:0,googleSheetsReads:0,canonicalWrites:0}}};
  function safeRoute(){const value=String(new URL(location.href).searchParams.get('lf_route')||'home');return ['home','transactions','expenses','income','cash-flow','data-quality'].includes(value)?value:'home'}
  function financeFrame(route){return '<div class="kpi-grid"><div class="kpi">KPI '+route+'</div></div><div class="panel"><div class="series"><div class="series-bar"></div></div><div class="bars"><div class="bar-row"></div></div></div>'}
  function render(route){
    document.body.dataset.activeLfRoute=route;
    if(financeRoutes.includes(route)){
      toolbar.hidden=false;content.hidden=false;grid.hidden=true;delete grid.dataset.lfDataRoute;content.innerHTML=financeFrame(route);
    }else{
      toolbar.hidden=true;content.hidden=true;grid.hidden=false;grid.dataset.lfDataRoute=route;grid.innerHTML='<div class="lf-data-shell"><div class="lf-data-status" data-state="READY">READY</div></div>';
    }
  }
  window.__PRH_LF_SPA_TEST__={
    navigate:function(route,options){const opts=options||{};if(opts.history!==false){const url=new URL(location.href);url.searchParams.set('lf_route',route);history.pushState({prhLfRoute:route},'',url.pathname+url.search+url.hash)}render(route);return route},
    getState:function(){return window.__PRH_LF_SPA_RUNTIME__}
  };
  window.addEventListener('popstate',function(){render(safeRoute())});
  document.getElementById('lf-filter-apply').addEventListener('click',function(){setTimeout(function(){content.innerHTML=financeFrame('home')},2)});
  render(safeRoute());
})();
</script>
</body></html>`;

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
}
function closeServer(server) { return new Promise((resolve) => server.close(resolve)); }

(async () => {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store' });
    response.end(harness);
  });
  const address = await listen(server);
  const browser = await chromium.launch({ headless:true });
  const context = await browser.newContext();
  const baseUrl = `http://127.0.0.1:${address.port}/?lf_diag=1&lf_route=home`;
  const revision = 'c'.repeat(64);
  try {
    const seed = await context.newPage();
    await seed.goto(baseUrl, { waitUntil:'load' });
    await seed.waitForFunction(() => !!window.PrhLocalReadModelStore && !!window.PrhLocalFirstPerformance);
    await seed.waitForTimeout(80);
    const seedStatus = await seed.evaluate(async (revision) => {
      const store=PrhLocalReadModelStore.createStore({indexedDB,IDBKeyRange,name:'prihrash-local-first-v1'});
      await store.wipe();
      await store.beginGeneration({generationId:revision,revision});
      await store.writeGenerationChunk({generationId:revision,revision,transactions:[],dimensions:[],aggregates:[],sync_journal:[]});
      await store.finalizeGeneration({generationId:revision,revision,expectedCounts:{transactions:0,dimensions:0,aggregates:0,sync_journal:0}});
      const status=await store.status();
      store.close();
      return status;
    }, revision);
    assert.strictEqual(seedStatus.status, 'READY', 'synthetic cached Local Read Model must be READY before benchmark pages');
    await seed.close();

    const evidence = [];
    for (const viewport of [
      { name:'desktop', width:1440, height:900, chart:'chart_repaint_desktop_p95', counterpart:'chart_repaint_mobile_p95' },
      { name:'mobile', width:390, height:844, chart:'chart_repaint_mobile_p95', counterpart:'chart_repaint_desktop_p95' }
    ]) {
      const page = await context.newPage();
      await page.setViewportSize({ width:viewport.width, height:viewport.height });
      const warmRequests = [];
      let warmPhase = false;
      page.on('request', (request) => { if (warmPhase) warmRequests.push(request.url()); });
      try {
        await page.goto(baseUrl, { waitUntil:'load', timeout:15000 });
        await page.waitForFunction(() => !!window.PrhLocalFirstPerformance && !!window.__PRH_LF_SPA_TEST__ && !!document.getElementById('lf-performance-report'));
        warmPhase = true;
        const report = await page.evaluate(() => PrhLocalFirstPerformance.run());
        assert.strictEqual(report.schema, 'PRH_LOCAL_FIRST_PERFORMANCE_V1');
        assert.strictEqual(report.status, 'PASS', `${viewport.name} report failed: ${report.reason}`);
        assert.strictEqual(report.reason, null);
        assert.strictEqual(report.mandatory_network_requests, 0);
        assert.strictEqual(report.google_sheets_reads, 0);
        assert.strictEqual(report.observed_resource_requests, 0);
        assert.strictEqual(report.document_loads, 1);
        assert.strictEqual(report.runtime_state, 'READY');
        assert.strictEqual(report.cold_bootstrap_included, false);
        assert.strictEqual(report.financial_payload_in_report, false);
        assert.strictEqual(report.provenance.runtime_sha256_prefix, runtimeSha.slice(0,12));
        assert.strictEqual(report.provenance.revision_hash_prefix, revisionPrefix);
        assert.strictEqual(report.provenance.candidate_sha_prefix, null);
        assert.strictEqual(report.provenance.source_tree_hash_prefix, null);
        assert.deepStrictEqual(warmRequests, [], `${viewport.name} warm benchmark emitted browser requests: ${warmRequests.join(' | ')}`);

        const byId = Object.fromEntries(report.metrics.map((metric) => [metric.metric_id, metric]));
        for (const metricId of ['warm_route_switch_p95','filter_kpi_update_p95','back_forward_p95','cached_first_meaningful_paint_p95',viewport.chart]) {
          assert.strictEqual(byId[metricId].status, 'PASS', `${viewport.name} ${metricId}: ${JSON.stringify(byId[metricId])}`);
          assert(byId[metricId].p95_ms <= byId[metricId].threshold_ms, `${viewport.name} ${metricId} threshold exceeded`);
        }
        assert.strictEqual(byId[viewport.counterpart].status, 'BLOCKED');
        assert.strictEqual(byId[viewport.counterpart].reason, 'PERF_LF_DEVICE_CLASS_NOT_MEASURED');
        assert.strictEqual(byId.warm_route_switch_p95.sample_count, 12);
        assert.strictEqual(byId.filter_kpi_update_p95.sample_count, 10);
        assert.strictEqual(byId[viewport.chart].sample_count, 10);
        assert.strictEqual(byId.back_forward_p95.sample_count, 10);
        assert.strictEqual(byId.cached_first_meaningful_paint_p95.sample_count, 1);

        const ui = await page.evaluate(() => ({
          status:document.getElementById('lf-performance-report') ? 'VISIBLE' : 'MISSING',
          rowCount:document.querySelectorAll('#lf-perf-body tr').length,
          text:document.getElementById('lf-performance-report').textContent,
          last:window.__PRH_LF_SPA_RUNTIME__.lastPerformanceReport
        }));
        assert.strictEqual(ui.status, 'VISIBLE');
        assert.strictEqual(ui.rowCount, 0, 'programmatic run must not fabricate a rendered owner report without explicit render action');
        assert.strictEqual(ui.last.status, 'PASS');
        assert(!/amount_minor|transaction_id|counterparty|PUBLIC_SYNTHETIC|SYN-TX-/i.test(JSON.stringify(report)), 'performance evidence leaked financial payload vocabulary');
        evidence.push({
          viewport:viewport.name,
          deviceClass:report.device_class,
          routeP95Ms:byId.warm_route_switch_p95.p95_ms,
          filterKpiP95Ms:byId.filter_kpi_update_p95.p95_ms,
          chartMetric:viewport.chart,
          chartP95Ms:byId[viewport.chart].p95_ms,
          backForwardP95Ms:byId.back_forward_p95.p95_ms,
          cachedFmpP95Ms:byId.cached_first_meaningful_paint_p95.p95_ms,
          warmNetworkRequests:report.mandatory_network_requests,
          googleSheetsReads:report.google_sheets_reads,
          documentLoads:report.document_loads
        });
      } finally {
        await page.close().catch(() => {});
      }
    }

    assert(evidence.some((item) => item.deviceClass === 'DESKTOP'));
    assert(evidence.some((item) => item.deviceClass === 'REPRESENTATIVE_MOBILE'));
    console.log('local_first_performance_runtime_test: PASS', {
      exactSixSloContract:true,
      deterministicNearestRankP95:true,
      insufficientSamplesFailClosed:true,
      desktopRealChromium:true,
      representativeMobileRealChromium:true,
      cachedActiveVerifiedSnapshot:true,
      zeroWarmNetwork:true,
      zeroGoogleSheetsReads:true,
      singleDocumentHistory:true,
      privacySafeReport:true,
      evidence
    });
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await closeServer(server);
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});