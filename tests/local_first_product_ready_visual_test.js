'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { repositoryRevision } = require('../lib/repository/transaction_repository');
const { buildCandidate } = require('../tools/build-apps-script-candidate');

const ROOT = path.resolve(__dirname, '..');
const PRODUCT_CONTRACT = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/local_first/local_first_product_ready.v1.json'), 'utf8'));
const CANDIDATE_SHA = execFileSync('git', ['rev-parse', 'HEAD'], { cwd:ROOT, encoding:'utf8' }).trim();
const SOURCE_TREE_SHA = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd:ROOT, encoding:'utf8' }).trim();
const DEGRADED_OWNER_COPY = 'Обновление временно недоступно. Можно продолжать работу с последними проверенными данными.';
const EMPTY_OWNER_COPY = 'Финансовые данные ещё загружаются. Подождите немного и повторите попытку.';
assert(/^[0-9a-f]{40}$/.test(CANDIDATE_SHA));
assert(/^[0-9a-f]{40}$/.test(SOURCE_TREE_SHA));

function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}
function tx(index, overrides = {}) {
  const type = overrides.type || (index % 5 === 0 ? 'income' : 'expense');
  const categoryId = overrides.category_id || (index % 3 === 0 ? 'cat-food' : 'cat-home');
  const accountId = overrides.account_id || 'acc-main';
  const memberId = overrides.member_id === undefined ? 'member-a' : overrides.member_id;
  return {
    schema:'PRH_CANONICAL_TRANSACTION_V1', schema_version:1,
    transaction_id:`product-ready-${String(index).padStart(3,'0')}`,
    occurred_at:overrides.occurred_at || `2026-${String(((index - 1) % 6) + 1).padStart(2,'0')}-${String(((index - 1) % 27) + 1).padStart(2,'0')}T12:00:00Z`,
    type, status:'posted', amount_minor:overrides.amount_minor == null ? 10000 + index * 173 : overrides.amount_minor,
    currency:'RUB', account_id:accountId,
    destination_account_id:type === 'transfer' ? (overrides.destination_account_id || 'acc-second') : null,
    category_id:categoryId, member_id:memberId, project_id:'project-home', tags:['synthetic'],
    counterparty:`Synthetic product-ready counterparty ${index}`,
    description:`Synthetic product-ready operation ${index}`,
    reverses_transaction_id:null, adjustment_semantics:null,
    provenance:{
      source_system:'SYNTHETIC_TEST', source_container:'product-ready-e2e', source_record_id:`row-${index}`,
      source_fingerprint:overrides.source_fingerprint || fingerprint(`product-ready:${index}`),
      identity_strategy:'EXTERNAL_ID', transform_version:'E2E-LF-001-v1', source_position:null
    }
  };
}

const duplicateFingerprint = fingerprint('product-ready-duplicate-group');
const transactions = Array.from({ length:45 }, (_, index) => tx(index + 1));
transactions[4] = tx(5, { category_id:'cat-missing' });
transactions[8] = tx(9, { account_id:'acc-missing' });
transactions[12] = tx(13, { member_id:'member-missing' });
transactions[20] = tx(21, { source_fingerprint:duplicateFingerprint });
transactions[21] = tx(22, { source_fingerprint:duplicateFingerprint });
const revision = repositoryRevision(transactions);
const dimensions = [
  {dimension_key:'category|cat-home',kind:'category',dimension_id:'cat-home',label:'Дом'},
  {dimension_key:'category|cat-food',kind:'category',dimension_id:'cat-food',label:'Продукты'},
  {dimension_key:'account|acc-main',kind:'account',dimension_id:'acc-main',label:'Основной счёт'},
  {dimension_key:'account|acc-second',kind:'account',dimension_id:'acc-second',label:'Второй счёт'},
  {dimension_key:'member|member-a',kind:'member',dimension_id:'member-a',label:'Участник'},
  {dimension_key:'project|project-home',kind:'project',dimension_id:'project-home',label:'Дом'}
];
const fullEnvelope = {
  schema:'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1', version:'1.0.0', state:'FULL_BOOTSTRAP',
  revision, generation_id:revision, transactions, dimensions, aggregates:[],
  sync_journal:[{sequence:1,event:'FULL_BOOTSTRAP',revision,transaction_count:transactions.length,dimension_count:dimensions.length}],
  expected_counts:{transactions:transactions.length,dimensions:dimensions.length,aggregates:0,sync_journal:1},
  financial_write_authorized:false, canonical_mutation_performed:false
};

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'prh-product-ready-e2e-'));
const candidateDir = path.join(temp, 'candidate');
const manifest = buildCandidate({ sourceRoot:ROOT, repositoryRoot:ROOT, outRoot:candidateDir, candidateSha:CANDIDATE_SHA });
assert(manifest.localFirstBrowserRuntime, 'Product Ready E2E must use the exact packaged Local-first runtime');
const candidateRoot = path.join(candidateDir, 'files');
const shellHtml = fs.readFileSync(path.join(candidateRoot, 'LocalFirstSpaWebApp.html'), 'utf8');
const extensionHtml = fs.readFileSync(path.join(candidateRoot, 'LocalFirstDataSpaExtension.html'), 'utf8');
const planningExtensionHtml = fs.readFileSync(path.join(candidateRoot, 'LocalFirstPlanningSpaExtension.html'), 'utf8');
const visualizationExtensionHtml = fs.readFileSync(path.join(candidateRoot, 'LocalFirstVisualizationSpaExtension.html'), 'utf8');
const serviceSource = fs.readFileSync(path.join(candidateRoot, 'LocalFirstSpaService.js'), 'utf8');
assert(shellHtml.includes('data-prh-local-first-runtime="1.0.0"'));
assert(extensionHtml.includes('data-prh-local-first-data-extension="1.0.0"'));

function htmlOutput(content) {
  return {
    title:'', meta:[],
    setTitle(value){ this.title=String(value); return this; },
    addMetaTag(name,value){ this.meta.push([name,value]); return this; },
    getContent(){ return String(content); }
  };
}
function renderCandidate(params) {
  const context = vm.createContext({
    console, JSON, Object, Array, String, Number, Math, Date, RegExp, Error, encodeURIComponent,
    ScriptApp:undefined,
    HtmlService:{
      createHtmlOutputFromFile(name){
        if (name === 'LocalFirstSpaWebApp') return htmlOutput(shellHtml);
        if (name === 'LocalFirstDataSpaExtension') return htmlOutput(extensionHtml);
        if (name === 'LocalFirstPlanningSpaExtension') return htmlOutput(planningExtensionHtml);
        if (name === 'LocalFirstVisualizationSpaExtension') return htmlOutput(visualizationExtensionHtml);
        throw new Error(`unexpected candidate file ${name}`);
      },
      createHtmlOutput(content){ return htmlOutput(content); }
    }
  });
  vm.runInContext(serviceSource, context, { filename:'LocalFirstSpaService.js' });
  return context.prhLocalFirstSpaRender_(params).getContent();
}
function listen(server) {
  return new Promise((resolve,reject) => {
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>resolve(server.address()));
  });
}
function closeServer(server) { return new Promise((resolve)=>server.close(resolve)); }

function installSyncStub(page, initialMode = 'normal') {
  return page.addInitScript(({ fullEnvelope, revision, initialMode }) => {
    window.__PRODUCT_READY_SYNC_MODE__ = initialMode;
    window.__PRODUCT_READY_SYNC_CALLS__ = { full:0, delta:0, googleSheetsReads:0 };
    const runner = {
      success:null, failure:null,
      withSuccessHandler(fn){ this.success=fn; return this; },
      withFailureHandler(fn){ this.failure=fn; return this; },
      prhLocalFirstSyncBootstrapWire(request){
        window.__PRODUCT_READY_SYNC_CALLS__.full += 1;
        const fail = window.__PRODUCT_READY_SYNC_MODE__ === 'fail-all';
        const response = request && request.local_revision === revision
          ? {schema:'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1',version:'1.0.0',state:'NOOP',revision,generation_id:revision,financial_write_authorized:false,canonical_mutation_performed:false}
          : fullEnvelope;
        setTimeout(() => fail ? this.failure(new Error('PRODUCT_READY_REMOTE_DOWN')) : this.success(JSON.stringify(response)), 25);
      },
      prhLocalFirstDelta(request){
        window.__PRODUCT_READY_SYNC_CALLS__.delta += 1;
        const fail = window.__PRODUCT_READY_SYNC_MODE__ === 'fail-delta' || window.__PRODUCT_READY_SYNC_MODE__ === 'fail-all';
        const response = {
          schema:'PRH_LOCAL_FIRST_DELTA_RESPONSE_V1', version:'1.0.0', state:'NOOP',
          base_revision:request.base_revision, target_revision:request.base_revision,
          target_generation_id:request.base_revision, base_inventory_digest:request.inventory.digest,
          financial_write_authorized:false, canonical_mutation_performed:false
        };
        setTimeout(() => fail ? this.failure(new Error('PRODUCT_READY_REMOTE_DOWN')) : this.success(response), 25);
      }
    };
    Object.defineProperty(window, 'google', { value:{script:{run:runner}}, configurable:true });
  }, { fullEnvelope, revision, initialMode });
}

function metricById(report, id) {
  const metric = report.metrics.find((item) => item.metric_id === id);
  assert(metric, `missing performance metric ${id}`);
  return metric;
}
function evidenceRecord(fields) {
  const record = Object.assign({
    schema:'PRH_LOCAL_FIRST_PRODUCT_READY_E2E_EVIDENCE_V1',
    version:'1.0.0', status:'PASS', reason:null,
    candidate_sha_prefix:CANDIDATE_SHA.slice(0,12),
    source_tree_hash_prefix:SOURCE_TREE_SHA.slice(0,12),
    revision_hash_prefix:revision.slice(0,12), generation_hash_prefix:revision.slice(0,12)
  }, fields);
  const allowed = new Set(PRODUCT_CONTRACT.privacy.allowed_evidence_fields);
  for (const key of Object.keys(record)) assert(allowed.has(key), `public Product Ready evidence field is not allowlisted: ${key}`);
  return record;
}

(async () => {
  const rendered = renderCandidate({ lf_route:'home', privacy:'MASKED' });
  const storageNamespace = PRODUCT_CONTRACT.local_read_model.storage_namespace;
  assert(rendered.includes("name:'" + storageNamespace + "'"), 'trusted Product Ready boot must use canonical Local Read Model namespace');
  assert(rendered.includes("var CANONICAL_LOCAL_DB = '" + storageNamespace + "';"), 'finance startup cache must use canonical Local Read Model namespace');
  assert(rendered.includes("var STORE_NAME = '" + storageNamespace + "';"), 'performance cached-FMP probe must use canonical Local Read Model namespace');
  const server = http.createServer((request,response) => {
    response.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
    response.end(rendered);
  });
  const address = await listen(server);
  const browser = await chromium.launch({ headless:true });
  const baseUrl = `http://127.0.0.1:${address.port}/?surface=local-first&lf_route=home&privacy=MASKED`;
  const publicEvidence = [];

  async function seedVerifiedSnapshot(context) {
    const seed = await context.newPage();
    await installSyncStub(seed, 'normal');
    await seed.goto(baseUrl, { waitUntil:'load', timeout:15000 });
    await seed.waitForFunction(() => {
      const runtime=window.__PRH_LF_FINANCE_RUNTIME__;
      const state=runtime&&runtime.getState();
      return state && state.snapshot_status==='READY' && state.sync_status==='READY' && state.revision;
    }, null, { timeout:20000 });
    assert.strictEqual(await seed.evaluate(() => window.__PRH_LF_FINANCE_RUNTIME__.getState().revision), revision);
    await seed.close();
  }

  async function fullJourney(device) {
    const context = await browser.newContext({ viewport:{width:device.width,height:device.height} });
    await seedVerifiedSnapshot(context);
    const page = await context.newPage();
    await installSyncStub(page, 'normal');
    let documentLoads = 0;
    let warm = false;
    const warmRequests = [];
    const pageErrors = [];
    page.on('load', () => { documentLoads += 1; });
    page.on('request', (request) => { if (warm) warmRequests.push(request.url()); });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    try {
      await page.goto(baseUrl, { waitUntil:'load', timeout:15000 });
      await page.waitForFunction(() => {
        const runtime=window.__PRH_LF_FINANCE_RUNTIME__;
        const state=runtime&&runtime.getState();
        const calls=window.__PRODUCT_READY_SYNC_CALLS__;
        return state && state.snapshot_status==='READY' && state.sync_status==='READY' && state.view?.status==='READY' && calls?.delta>=1;
      }, null, { timeout:20000 });
      assert.strictEqual(documentLoads,1,`${device.name} cached journey must start in one document`);
      assert.strictEqual(await page.isVisible('#lf-diagnostic'),false,'developer diagnostic must not be owner-visible in Product Ready journey');
      assert.strictEqual(await page.locator('#lf-performance-report').count(),0,'performance diagnostic UI must not be owner-visible');
      warm = true;
      const baselineCalls = await page.evaluate(() => ({...window.__PRODUCT_READY_SYNC_CALLS__}));

      const initial = await page.evaluate(() => ({
        route:document.body.dataset.activeLfRoute,
        state:window.__PRH_LF_FINANCE_RUNTIME__.getState(),
        spa:window.__PRH_LF_SPA_TEST__.getState(),
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        visibleText:document.body.innerText
      }));
      assert.strictEqual(initial.route,'home');
      assert.strictEqual(initial.state.revision,revision);
      assert.strictEqual(initial.state.generation_id,revision);
      assert.strictEqual(initial.state.view.provenance.input_revision,revision);
      assert.strictEqual(initial.state.view.provenance.canonical_worker_only,true);
      assert.strictEqual(initial.state.view.provenance.ui_financial_formula_used,false);
      assert.strictEqual(initial.spa.bootCount,1);
      assert(initial.overflow<=2,`${device.name} Home overflow ${initial.overflow}px`);
      assert(/[А-Яа-яЁё]/.test(initial.visibleText),'Product Ready UI must be human-facing Russian');
      assert(!/PRH_[A-Z0-9_]+|LOCAL_FIRST_[A-Z0-9_]+|SYNTHETIC_TEST|amount_minor|transaction_id/.test(initial.visibleText),'developer-only markers leaked into Product Ready UI');

      await page.fill('#lf-filter-start','2026-02-01');
      await page.fill('#lf-filter-end','2026-06-30');
      await page.selectOption('#lf-filter-category','cat-food');
      await page.click('#lf-filter-apply');
      await page.waitForFunction(() => {
        const state=window.__PRH_LF_FINANCE_RUNTIME__.getState();
        return state.view?.status==='READY' && state.filter_context.start==='2026-02-01' && state.filter_context.category_id==='cat-food';
      });
      const sharedFilter = await page.evaluate(() => window.__PRH_LF_FINANCE_RUNTIME__.getState().filter_context);

      for (const route of ['expenses','income','cash-flow']) {
        await page.click(`[data-lf-route="${route}"]`);
        await page.waitForFunction((expected) => {
          const state=window.__PRH_LF_FINANCE_RUNTIME__.getState();
          return document.body.dataset.activeLfRoute===expected && state.route===expected && state.view?.status==='READY' && state.view.route===expected;
        }, route);
        const financeState = await page.evaluate(() => window.__PRH_LF_FINANCE_RUNTIME__.getState());
        assert.deepStrictEqual(financeState.filter_context,sharedFilter,`${device.name} FilterContext drift on ${route}`);
        assert.strictEqual(financeState.view.provenance.input_revision,revision);
        assert.strictEqual(financeState.view.provenance.ui_financial_formula_used,false);
      }
      publicEvidence.push(evidenceRecord({
        action_id:'FILTER_CONTEXT_PERSISTS_ACROSS_FINANCE_ROUTES', device_class:device.deviceClass,
        route_id:'cash-flow', runtime_state:'READY', sync_state:'READY', mandatory_network_requests:0,
        google_sheets_reads:0, document_loads:documentLoads
      }));

      await page.click('[data-lf-route="transactions"]');
      await page.waitForFunction(() => window.__PRH_LF_DATA_EXTENSION__?.getState().lastState?.route==='transactions' && window.__PRH_LF_DATA_EXTENSION__.getState().lastState.status==='READY');
      assert.strictEqual(await page.locator('.lf-data-table tbody tr').count(),20);
      await page.selectOption('#lf-tx-category','cat-food');
      await page.selectOption('#lf-tx-account','acc-main');
      await page.selectOption('#lf-tx-member','member-a');
      await page.fill('#lf-tx-start','2026-02-01');
      await page.fill('#lf-tx-end','2026-06-30');
      await page.click('#lf-tx-filter button[type="submit"]');
      await page.waitForFunction(() => window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.page===1 && new URL(location.href).searchParams.get('tx_category')==='cat-food');
      const filteredTotal = await page.evaluate(() => window.__PRH_LF_DATA_EXTENSION__.getState().lastState.total);
      assert(filteredTotal>0 && filteredTotal<transactions.length,'transaction filter must narrow verified local data');
      const detail = page.locator('[data-lf-detail]').first();
      const detailId = await detail.getAttribute('data-lf-detail');
      await detail.click();
      await page.waitForFunction((expected) => new URL(location.href).searchParams.get('tx_detail')===expected && window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.detail_open===true, detailId);
      await page.goBack();
      await page.waitForFunction(() => !new URL(location.href).searchParams.has('tx_detail') && window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.detail_open===false);
      await page.goForward();
      await page.waitForFunction((expected) => new URL(location.href).searchParams.get('tx_detail')===expected && window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.detail_open===true, detailId);
      await page.goBack();
      await page.waitForFunction(() => !new URL(location.href).searchParams.has('tx_detail'));
      publicEvidence.push(evidenceRecord({
        action_id:'TRANSACTION_FILTER_AND_DRILL', device_class:device.deviceClass,
        route_id:'transactions', runtime_state:'READY', sync_state:'READY', mandatory_network_requests:0,
        google_sheets_reads:0, document_loads:documentLoads
      }));

      await page.click('[data-lf-route="data-quality"]');
      await page.waitForFunction(() => window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.route==='data-quality' && window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.status==='READY');
      const dq = await page.evaluate(() => window.__PRH_LF_DATA_EXTENSION__.getState());
      assert.strictEqual(dq.lastState.problem_count,4);
      assert.strictEqual(dq.canonicalWrites,0);
      assert.strictEqual(dq.autofixCalls,0);
      assert.strictEqual(dq.networkCalls,0);
      assert.strictEqual(dq.googleSheetsReads,0);

      await page.goBack();
      await page.waitForFunction(() => document.body.dataset.activeLfRoute==='transactions' && window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.route==='transactions');
      await page.goForward();
      await page.waitForFunction(() => document.body.dataset.activeLfRoute==='data-quality' && window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.route==='data-quality');
      assert.strictEqual(documentLoads,1,`${device.name} Back/Forward must not reload Product Ready document`);
      publicEvidence.push(evidenceRecord({
        action_id:'BACK_FORWARD_WITHOUT_DOCUMENT_RELOAD', device_class:device.deviceClass,
        route_id:'data-quality', runtime_state:'READY', sync_state:'READY', mandatory_network_requests:0,
        google_sheets_reads:0, document_loads:documentLoads
      }));

      const callsAfterLocalJourney = await page.evaluate(() => ({...window.__PRODUCT_READY_SYNC_CALLS__}));
      assert.deepStrictEqual(callsAfterLocalJourney,baselineCalls,`${device.name} local route/filter/drill journey must not call background transport`);

      await page.click('[data-lf-route="home"]');
      await page.waitForFunction(() => window.__PRH_LF_FINANCE_RUNTIME__.getState().route==='home' && window.__PRH_LF_FINANCE_RUNTIME__.getState().view?.status==='READY');
      await page.evaluate(() => { window.__PRODUCT_READY_SYNC_MODE__='fail-delta'; });
      await page.click('#lf-sync-refresh');
      await page.waitForFunction(() => window.__PRH_LF_FINANCE_RUNTIME__.getState().sync_status==='SYNCING');
      assert.strictEqual(await page.getAttribute('#lf-sync-chip','data-state'),'SYNCING','sync loading state must be visible');
      await page.waitForFunction(() => window.__PRH_LF_FINANCE_RUNTIME__.getState().sync_status==='DEGRADED');
      const degraded = await page.evaluate(() => ({
        state:window.__PRH_LF_FINANCE_RUNTIME__.getState(),
        chip:document.getElementById('lf-sync-chip').dataset.state,
        banner:document.getElementById('lf-sync-banner').textContent,
        spa:window.__PRH_LF_SPA_TEST__.getState()
      }));
      assert.strictEqual(degraded.chip,'DEGRADED');
      assert.strictEqual(degraded.banner.trim(),DEGRADED_OWNER_COPY,'degraded state must use canonical owner-facing copy');
      assert(!/verified|revision|sync degraded|web worker|local-first/i.test(degraded.banner),'degraded owner copy must not leak implementation vocabulary');
      assert.strictEqual(degraded.state.snapshot_status,'READY');
      assert.strictEqual(degraded.state.revision,revision);
      assert.strictEqual(degraded.state.view.status,'READY');
      publicEvidence.push(evidenceRecord({
        action_id:'REMOTE_FAILURE_WITH_VERIFIED_LOCAL_DEGRADED', device_class:device.deviceClass,
        route_id:'home', runtime_state:'READY', sync_state:'DEGRADED', mandatory_network_requests:0,
        google_sheets_reads:0, document_loads:documentLoads
      }));

      await page.click('[data-lf-route="expenses"]');
      await page.waitForFunction(() => window.__PRH_LF_FINANCE_RUNTIME__.getState().route==='expenses' && window.__PRH_LF_FINANCE_RUNTIME__.getState().view?.status==='READY');
      assert.strictEqual(await page.evaluate(() => window.__PRH_LF_FINANCE_RUNTIME__.getState().revision),revision,'degraded mode must keep verified local finance readable');

      await page.click('[data-lf-route="home"]');
      await page.evaluate(() => { window.__PRODUCT_READY_SYNC_MODE__='normal'; });
      await page.click('#lf-sync-refresh');
      await page.waitForFunction(() => window.__PRH_LF_FINANCE_RUNTIME__.getState().sync_status==='SYNCING');
      await page.waitForFunction(() => window.__PRH_LF_FINANCE_RUNTIME__.getState().sync_status==='READY');
      assert.strictEqual(await page.evaluate(() => window.__PRH_LF_FINANCE_RUNTIME__.getState().revision),revision);
      publicEvidence.push(evidenceRecord({
        action_id:'REMOTE_RECOVERY_TO_VERIFIED_READY', device_class:device.deviceClass,
        route_id:'home', runtime_state:'READY', sync_state:'READY', mandatory_network_requests:0,
        google_sheets_reads:0, document_loads:documentLoads
      }));
      publicEvidence.push(evidenceRecord({
        action_id:'BACKGROUND_SYNC_REFRESH', device_class:device.deviceClass,
        route_id:'home', runtime_state:'READY', sync_state:'READY', mandatory_network_requests:0,
        google_sheets_reads:0, document_loads:documentLoads
      }));

      const perf = await page.evaluate(() => PrhLocalFirstPerformance.run());
      assert.strictEqual(perf.status,'PASS',`${device.name} Product Ready performance report failed: ${perf.reason}`);
      assert.strictEqual(perf.mandatory_network_requests,0);
      assert.strictEqual(perf.google_sheets_reads,0);
      assert.strictEqual(perf.document_loads,1);
      const metricIds = [
        'warm_route_switch_p95','filter_kpi_update_p95',device.chartMetric,'back_forward_p95','cached_first_meaningful_paint_p95'
      ];
      for (const metricId of metricIds) {
        const metric=metricById(perf,metricId);
        assert.strictEqual(metric.status,'PASS',`${device.name} ${metricId}: ${JSON.stringify(metric)}`);
        publicEvidence.push(evidenceRecord({
          action_id:`SLO_${metricId}`, device_class:device.deviceClass, route_id:'home',
          runtime_state:'READY', sync_state:'READY', sample_count:metric.sample_count,
          p95_ms:metric.p95_ms, threshold_ms:metric.threshold_ms,
          mandatory_network_requests:perf.mandatory_network_requests,
          google_sheets_reads:perf.google_sheets_reads, document_loads:perf.document_loads
        }));
      }

      await context.setOffline(true);
      await page.click('[data-lf-route="income"]');
      await page.waitForFunction(() => window.__PRH_LF_FINANCE_RUNTIME__.getState().route==='income' && window.__PRH_LF_FINANCE_RUNTIME__.getState().view?.status==='READY');
      await page.click('[data-lf-route="transactions"]');
      await page.waitForFunction(() => window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.route==='transactions' && window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.status==='READY');
      assert.strictEqual(await page.evaluate(() => window.__PRH_LF_DATA_EXTENSION__.getState().lastState.revision),revision);
      await context.setOffline(false);
      publicEvidence.push(evidenceRecord({
        action_id:'OFFLINE_LOCAL_READ_AVAILABLE', device_class:device.deviceClass,
        route_id:'transactions', runtime_state:'READY', sync_state:'READY', mandatory_network_requests:0,
        google_sheets_reads:0, document_loads:documentLoads
      }));

      const final = await page.evaluate(() => ({
        spa:window.__PRH_LF_SPA_TEST__.getState(),
        finance:window.__PRH_LF_FINANCE_RUNTIME__.getState(),
        data:window.__PRH_LF_DATA_EXTENSION__.getState(),
        calls:{...window.__PRODUCT_READY_SYNC_CALLS__},
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        visibleText:document.body.innerText
      }));
      assert.strictEqual(final.spa.bootCount,1);
      assert.strictEqual(final.spa.mandatoryNetworkCalls,0);
      assert.strictEqual(final.spa.googleSheetsReads,0);
      assert.strictEqual(final.finance.revision,revision);
      assert.strictEqual(final.data.canonicalWrites,0);
      assert.strictEqual(final.calls.googleSheetsReads,0);
      assert.strictEqual(documentLoads,1);
      assert(final.overflow<=2,`${device.name} final overflow ${final.overflow}px`);
      assert.deepStrictEqual(pageErrors,[],`${device.name} Product Ready page errors: ${pageErrors.join(' | ')}`);
      assert.deepStrictEqual(warmRequests,[],`${device.name} warm Product Ready journey emitted HTTP requests: ${warmRequests.join(' | ')}`);
      assert(!/PRH_[A-Z0-9_]+|LOCAL_FIRST_[A-Z0-9_]+|SYNTHETIC_TEST|amount_minor|transaction_id/.test(final.visibleText),'developer-only markers leaked after Product Ready journey');
      publicEvidence.push(evidenceRecord({
        action_id:'READY_LOCAL_FULL_JOURNEY', device_class:device.deviceClass,
        route_id:'transactions', runtime_state:'READY', sync_state:final.finance.sync_status,
        mandatory_network_requests:0, google_sheets_reads:0, document_loads:documentLoads
      }));
    } finally {
      await context.setOffline(false).catch(()=>{});
      await context.close().catch(()=>{});
    }
  }

  async function noActiveSnapshotFailsClosed() {
    const context = await browser.newContext({ viewport:{width:1000,height:800} });
    const page = await context.newPage();
    await installSyncStub(page,'fail-all');
    const errors=[];
    page.on('pageerror',(error)=>errors.push(error.message));
    try {
      await page.goto(baseUrl,{waitUntil:'load',timeout:15000});
      await page.waitForFunction(() => {
        const runtime=window.__PRH_LF_FINANCE_RUNTIME__;
        const state=runtime&&runtime.getState();
        return state && state.sync_status==='FAILED';
      },null,{timeout:20000});
      const failed=await page.evaluate(()=>({
        state:window.__PRH_LF_FINANCE_RUNTIME__.getState(),
        money:document.querySelectorAll('.money').length,
        chip:document.getElementById('lf-sync-chip').dataset.state,
        text:document.getElementById('lf-finance-content').textContent
      }));
      assert.strictEqual(failed.state.snapshot_status,'EMPTY');
      assert.strictEqual(failed.state.revision,null);
      assert.strictEqual(failed.state.view.status,'EMPTY');
      assert.strictEqual(failed.money,0,'no verified snapshot must not fabricate financial values');
      assert.strictEqual(failed.chip,'FAILED');
      assert.strictEqual(failed.text.trim(),EMPTY_OWNER_COPY,'no-snapshot failure must use canonical owner-facing empty copy');
      assert(!/verified|snapshot|revision|web worker|local-first/i.test(failed.text),'empty owner copy must not leak implementation vocabulary');
      assert.deepStrictEqual(errors,[],'remote bootstrap failure must be represented as UI state, not fatal page error');
      publicEvidence.push(evidenceRecord({
        action_id:'NO_ACTIVE_SNAPSHOT_FAILS_CLOSED', device_class:'DESKTOP', route_id:'home',
        runtime_state:'EMPTY', sync_state:'FAILED', mandatory_network_requests:0,
        google_sheets_reads:0, document_loads:1,
        revision_hash_prefix:null, generation_hash_prefix:null
      }));
    } finally {
      await context.close().catch(()=>{});
    }
  }

  async function staleGenerationCompletionDiscarded() {
    const context = await browser.newContext({ viewport:{width:1000,height:800} });
    await seedVerifiedSnapshot(context);
    const page = await context.newPage();
    await installSyncStub(page,'normal');
    try {
      await page.goto(baseUrl,{waitUntil:'load',timeout:15000});
      await page.waitForFunction(()=>window.__PRH_LF_FINANCE_RUNTIME__?.getState().snapshot_status==='READY',null,{timeout:20000});
      const snapshotA={status:'READY',schema:'PRH_LOCAL_READ_MODEL_V1',generation_id:'a'.repeat(64),revision:'a'.repeat(64),transactions:transactions.slice(0,2),dimensions,aggregates:[]};
      const snapshotB={status:'READY',schema:'PRH_LOCAL_READ_MODEL_V1',generation_id:'b'.repeat(64),revision:'b'.repeat(64),transactions:transactions.slice(0,3),dimensions,aggregates:[]};
      await page.evaluate(({snapshotA,snapshotB})=>{
        const originalStore=window.PrhLocalReadModelStore;
        const originalFinance=window.__PRH_LF_FINANCE_RUNTIME__;
        let calls=0,resolveFirst;
        let financeState=Object.assign({},originalFinance.getState(),{
          snapshot_status:'READY',
          generation_id:snapshotA.generation_id,
          revision:snapshotA.revision
        });
        const first=new Promise((resolve)=>{resolveFirst=resolve});
        window.__PRH_LF_FINANCE_RUNTIME__=Object.assign({},originalFinance,{getState:()=>financeState});
        window.__PRODUCT_READY_STALE__={
          calls:()=>calls,
          promoteFinanceToB:()=>{
            financeState=Object.assign({},financeState,{
              snapshot_status:'READY',
              generation_id:snapshotB.generation_id,
              revision:snapshotB.revision
            });
          },
          resolveFirst:()=>resolveFirst(snapshotA)
        };
        window.PrhLocalReadModelStore=Object.assign({},originalStore,{createStore(){return {open:async()=>({status:'OPEN'}),getActiveSnapshot:async()=>{calls+=1;return calls===1?first:snapshotB}}}});
      },{snapshotA,snapshotB});
      await page.click('[data-lf-route="transactions"]');
      await page.waitForFunction(()=>window.__PRODUCT_READY_STALE__.calls()===1);
      await page.evaluate(()=>{
        window.__PRODUCT_READY_STALE__.promoteFinanceToB();
        return window.__PRH_LF_DATA_EXTENSION__.render();
      });
      await page.waitForFunction(()=>window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.revision==='b'.repeat(64));
      await page.evaluate(()=>window.__PRODUCT_READY_STALE__.resolveFirst());
      await page.waitForTimeout(80);
      const state=await page.evaluate(()=>window.__PRH_LF_DATA_EXTENSION__.getState().lastState);
      assert.strictEqual(state.revision,'b'.repeat(64),'late old-generation completion must be discarded');
      assert.strictEqual(state.total,3);
      publicEvidence.push(evidenceRecord({
        action_id:'STALE_GENERATION_COMPLETION_DISCARDED', device_class:'DESKTOP', route_id:'transactions',
        runtime_state:'READY', sync_state:'READY', mandatory_network_requests:0,
        google_sheets_reads:0, document_loads:1,
        revision_hash_prefix:'b'.repeat(12), generation_hash_prefix:'b'.repeat(12)
      }));
    } finally {
      await context.close().catch(()=>{});
    }
  }

  try {
    await fullJourney({name:'desktop',deviceClass:'DESKTOP',width:1440,height:1000,chartMetric:'chart_repaint_desktop_p95'});
    await fullJourney({name:'mobile',deviceClass:'REPRESENTATIVE_MOBILE',width:390,height:844,chartMetric:'chart_repaint_mobile_p95'});
    await noActiveSnapshotFailsClosed();
    await staleGenerationCompletionDiscarded();

    const actionIds = new Set(publicEvidence.map((record)=>record.action_id));
    for (const required of PRODUCT_CONTRACT.required_scenarios) {
      assert(actionIds.has(required), `Product Ready machine evidence missing scenario ${required}`);
    }
    const forbidden = /amount_minor|counterparty|description|transaction_id|cat-food|acc-main|member-a|project-home|Synthetic product-ready/i;
    assert(!forbidden.test(JSON.stringify(publicEvidence)),'Product Ready public evidence leaked synthetic financial payload/labels/IDs');

    const artifactDir=path.join(ROOT,'artifacts');
    fs.mkdirSync(artifactDir,{recursive:true});
    fs.writeFileSync(path.join(artifactDir,'local-first-product-ready-e2e.json'),JSON.stringify(publicEvidence,null,2));
    console.log('local_first_product_ready_visual_test: PASS',{
      exactCandidatePrefix:CANDIDATE_SHA.slice(0,12),
      desktopRealChromium:true,
      representativeMobileRealChromium:true,
      fullJourney:true,
      degradedRecovery:true,
      offlineLocalRead:true,
      noSnapshotFailClosed:true,
      staleGenerationDiscarded:true,
      performanceContractRetained:true,
      privacySafeEvidenceRecords:publicEvidence.length
    });
  } finally {
    await browser.close().catch(()=>{});
    await closeServer(server);
    fs.rmSync(temp,{recursive:true,force:true});
  }
})().catch((error)=>{
  fs.rmSync(temp,{recursive:true,force:true});
  console.error(error.stack||error.message);
  process.exitCode=1;
});