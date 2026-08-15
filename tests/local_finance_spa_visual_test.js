'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');
const { repositoryRevision } = require('../lib/repository/transaction_repository');
const { buildCandidate } = require('../tools/build-apps-script-candidate');

const ROOT = path.resolve(__dirname, '..');
const CANDIDATE_SHA = '2'.repeat(40);

function fingerprint(value) { return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex'); }
function tx(index, overrides = {}) {
  const type = overrides.type || 'expense';
  return {
    schema: 'PRH_CANONICAL_TRANSACTION_V1', schema_version: 1,
    transaction_id: `visual-fin-${String(index).padStart(3, '0')}`,
    occurred_at: overrides.occurred_at || '2026-01-10T12:00:00Z',
    type, status: 'posted', amount_minor: overrides.amount_minor == null ? 10000 : overrides.amount_minor,
    currency: 'RUB', account_id: 'acc-main', destination_account_id: type === 'transfer' ? 'acc-second' : null,
    category_id: overrides.category_id || (type === 'income' ? 'cat-salary' : 'cat-home'),
    member_id: 'member-a', project_id: 'project-home', tags: ['synthetic'], counterparty: null,
    description: `Synthetic visual ${index}`, reverses_transaction_id: type === 'refund' ? 'visual-fin-002' : null,
    adjustment_semantics: type === 'refund' ? 'expense_reduction' : null,
    provenance: {
      source_system: 'SYNTHETIC_TEST', source_container: 'fin-lf-visual', source_record_id: `row-${index}`,
      source_fingerprint: fingerprint(`visual:${index}`), identity_strategy: 'EXTERNAL_ID',
      transform_version: 'FIN-LF-VIS-v1', source_position: null
    }
  };
}
const transactions = [
  tx(1,{type:'income',amount_minor:180000,occurred_at:'2026-01-05T10:00:00Z',category_id:'cat-salary'}),
  tx(2,{type:'expense',amount_minor:42000,occurred_at:'2026-01-09T10:00:00Z',category_id:'cat-home'}),
  tx(3,{type:'expense',amount_minor:26000,occurred_at:'2026-02-08T10:00:00Z',category_id:'cat-food'}),
  tx(4,{type:'income',amount_minor:45000,occurred_at:'2026-02-20T10:00:00Z',category_id:'cat-bonus'}),
  tx(5,{type:'refund',amount_minor:4000,occurred_at:'2026-02-22T10:00:00Z',category_id:'cat-food'}),
  tx(6,{type:'expense',amount_minor:31000,occurred_at:'2026-03-10T10:00:00Z',category_id:'cat-home'}),
  tx(7,{type:'income',amount_minor:170000,occurred_at:'2026-03-25T10:00:00Z',category_id:'cat-salary'}),
  tx(8,{type:'expense',amount_minor:19000,occurred_at:'2026-04-04T10:00:00Z',category_id:'cat-fun'}),
  tx(9,{type:'expense',amount_minor:24000,occurred_at:'2026-04-14T10:00:00Z',category_id:'cat-food'}),
  tx(10,{type:'income',amount_minor:35000,occurred_at:'2026-04-29T10:00:00Z',category_id:'cat-bonus'})
];
const revision = repositoryRevision(transactions);
const dimensions = [
  { dimension_key:'category|cat-salary', kind:'category', dimension_id:'cat-salary', label:'Зарплата' },
  { dimension_key:'category|cat-bonus', kind:'category', dimension_id:'cat-bonus', label:'Премия' },
  { dimension_key:'category|cat-home', kind:'category', dimension_id:'cat-home', label:'Дом' },
  { dimension_key:'category|cat-food', kind:'category', dimension_id:'cat-food', label:'Продукты' },
  { dimension_key:'category|cat-fun', kind:'category', dimension_id:'cat-fun', label:'Отдых' }
];
const fullEnvelope = {
  schema:'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1', version:'1.0.0', state:'FULL_BOOTSTRAP',
  revision, generation_id:revision, transactions, dimensions, aggregates:[],
  sync_journal:[{sequence:1,event:'FULL_BOOTSTRAP',revision,transaction_count:transactions.length,dimension_count:dimensions.length}],
  expected_counts:{transactions:transactions.length,dimensions:dimensions.length,aggregates:0,sync_journal:1},
  financial_write_authorized:false, canonical_mutation_performed:false
};

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'prh-fin-lf-visual-'));
const candidateDir = path.join(temp, 'candidate');
const manifest = buildCandidate({ sourceRoot: ROOT, repositoryRoot: ROOT, outRoot: candidateDir, candidateSha: CANDIDATE_SHA });
assert(manifest.localFirstBrowserRuntime, 'visual test must use exact candidate with injected Local-first runtime');
const candidateHtml = fs.readFileSync(path.join(candidateDir, 'files', 'LocalFirstSpaWebApp.html'), 'utf8');
assert(candidateHtml.includes('data-prh-local-first-runtime="1.0.0"'));

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
    response.end(candidateHtml);
  });
  const address = await listen(server);
  const browser = await chromium.launch({ headless:true });

  async function scenario(viewport, privacy) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const requests = [];
    let measureWarm = false;
    page.on('request', (request) => { if (measureWarm) requests.push(request.url()); });
    await page.addInitScript(({ fullEnvelope, revision }) => {
      const runner = {
        success:null, failure:null,
        withSuccessHandler(fn){ this.success=fn; return this; },
        withFailureHandler(fn){ this.failure=fn; return this; },
        prhLocalFirstSyncBootstrap(request){
          const response = request && request.local_revision === revision
            ? { schema:'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1',version:'1.0.0',state:'NOOP',revision,generation_id:revision,financial_write_authorized:false,canonical_mutation_performed:false }
            : fullEnvelope;
          queueMicrotask(() => this.success(response));
        },
        prhLocalFirstDelta(request){
          const response = { schema:'PRH_LOCAL_FIRST_DELTA_RESPONSE_V1',version:'1.0.0',state:'NOOP',base_revision:request.base_revision,target_revision:request.base_revision,target_generation_id:request.base_revision,base_inventory_digest:request.inventory.digest,financial_write_authorized:false,canonical_mutation_performed:false };
          queueMicrotask(() => this.success(response));
        }
      };
      Object.defineProperty(window,'google',{value:{script:{run:runner}},configurable:true});
    }, { fullEnvelope, revision });

    const url = `http://127.0.0.1:${address.port}/?surface=local-first&lf_route=home&privacy=${privacy}&lf_diag=1`;
    await page.goto(url, { waitUntil:'load', timeout:15000 });
    await page.waitForFunction(() => window.__PRH_LF_FINANCE_RUNTIME__ && window.__PRH_LF_FINANCE_RUNTIME__.getState().view && window.__PRH_LF_FINANCE_RUNTIME__.getState().view.status === 'READY', null, { timeout:20000 });
    await page.waitForSelector('#lf-finance-content .kpi');
    assert.strictEqual(await page.isVisible('#lf-diagnostic'),true,'exact candidate diagnostic must be visible in diagnostic mode');
    measureWarm = true;

    const home = await page.evaluate(() => ({
      route:document.body.dataset.activeLfRoute,
      title:document.getElementById('lf-title').textContent,
      revision:document.getElementById('lf-revision-chip').textContent,
      toolbarHidden:document.getElementById('lf-finance-toolbar').hidden,
      contentHidden:document.getElementById('lf-finance-content').hidden,
      money:Array.from(document.querySelectorAll('.money')).map((node)=>node.textContent),
      runtime:window.__PRH_LF_FINANCE_RUNTIME__.getState(),
      width:{scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}
    }));
    assert.strictEqual(home.route,'home');
    assert.strictEqual(home.title,'Главная');
    assert.strictEqual(home.toolbarHidden,false);
    assert.strictEqual(home.contentHidden,false);
    assert(home.revision.includes(revision.slice(0,12)));
    assert.strictEqual(home.runtime.revision,revision);
    assert.strictEqual(home.runtime.view.provenance.canonical_worker_only,true);
    assert(home.width.scroll <= home.width.client + 2, `home overflow at ${viewport.width}px`);
    if (privacy === 'NORMAL') assert(home.money.some((value)=>/₽|руб|RUB/i.test(value)), 'NORMAL must show formatted synthetic money');
    else assert(home.money.length > 0 && home.money.every((value)=>value === '••••••'), `${privacy} must mask all financial values`);

    for (const route of ['expenses','income','cash-flow','home']) {
      await page.click(`[data-lf-route="${route}"]`);
      await page.waitForFunction((expected) => {
        const rt=window.__PRH_LF_FINANCE_RUNTIME__;
        const state=rt&&rt.getState();
        return document.body.dataset.activeLfRoute===expected && state && state.route===expected && state.view && state.view.status==='READY' && state.view.route===expected;
      }, route);
      const state=await page.evaluate(()=>window.__PRH_LF_FINANCE_RUNTIME__.getState());
      assert.strictEqual(state.revision,revision);
      assert.strictEqual(state.generation_id,revision);
      assert.strictEqual(state.view.provenance.input_revision,revision);
      assert.strictEqual(state.view.provenance.ui_financial_formula_used,false);
    }

    await page.fill('#lf-filter-start','2026-02-01');
    await page.fill('#lf-filter-end','2026-05-01');
    await page.selectOption('#lf-filter-category','cat-food');
    await page.click('#lf-filter-apply');
    await page.waitForFunction(() => {
      const state=window.__PRH_LF_FINANCE_RUNTIME__.getState();
      return state.view && state.view.status==='READY' && state.filter_context.start==='2026-02-01' && state.filter_context.category_id==='cat-food';
    });
    const filteredHome=await page.evaluate(()=>window.__PRH_LF_FINANCE_RUNTIME__.getState());
    assert.strictEqual(filteredHome.revision,revision);
    assert.strictEqual(filteredHome.filter_context.end,'2026-05-01');
    assert.strictEqual(filteredHome.filter_context.category_id,'cat-food');

    await page.click('[data-lf-route="expenses"]');
    await page.waitForFunction(() => {
      const state=window.__PRH_LF_FINANCE_RUNTIME__.getState();
      return state.route==='expenses' && state.view && state.view.status==='READY';
    });
    const filteredExpenses=await page.evaluate(()=>window.__PRH_LF_FINANCE_RUNTIME__.getState());
    assert.deepStrictEqual(filteredExpenses.filter_context,filteredHome.filter_context,'FilterContext must persist across route navigation');
    assert.strictEqual(filteredExpenses.view.results.breakdown.rows.length,1);
    assert.strictEqual(filteredExpenses.view.results.breakdown.rows[0].dimensions.category_id,'cat-food');

    await page.goBack();
    await page.waitForFunction(() => {
      const runtime=window.__PRH_LF_FINANCE_RUNTIME__;
      const state=runtime&&runtime.getState();
      return document.body.dataset.activeLfRoute==='home' &&
        state && state.route==='home' && state.view && state.view.status==='READY' && state.view.route==='home' &&
        document.querySelectorAll('#lf-finance-content .kpi').length>=4;
    });
    const afterBack=await page.evaluate(()=>window.__PRH_LF_FINANCE_RUNTIME__.getState());
    assert.deepStrictEqual(afterBack.filter_context,filteredHome.filter_context,'FilterContext must persist through Back navigation');
    assert.strictEqual(afterBack.revision,revision,'Back-rendered Home must remain bound to the same verified revision');
    assert.strictEqual(afterBack.view.provenance.input_revision,revision,'Back-rendered DOM must be produced from the same canonical Worker revision');

    // The Product diagnostic is only valid when every sample waits for the
    // canonical Worker READY view and two animation frames. This proves the
    // metric cannot regress to shell/title-only timing.
    const diagnostic=await page.evaluate(()=>window.__PRH_LF_SPA_TEST__.runDiagnostic());
    assert.strictEqual(diagnostic.schema,'PRH_LF_ROUTE_TO_PAINT_DIAGNOSTIC_V1');
    assert.strictEqual(diagnostic.sampleCount,10);
    assert.strictEqual(diagnostic.financeReadyFrames,10);
    assert.strictEqual(diagnostic.mandatoryNetworkCalls,0);
    assert.strictEqual(diagnostic.googleSheetsReads,0);
    assert(Number.isFinite(diagnostic.p95Ms) && diagnostic.p95Ms>=0,'finance-ready diagnostic p95 must be finite');
    await page.waitForFunction(()=>{
      const state=window.__PRH_LF_FINANCE_RUNTIME__.getState();
      return document.body.dataset.activeLfRoute==='home' && state.view && state.view.status==='READY' && state.view.route==='home';
    });

    const finalLayout=await page.evaluate(()=>({
      scroll:document.documentElement.scrollWidth,
      client:document.documentElement.clientWidth,
      toolbar:getComputedStyle(document.getElementById('lf-finance-toolbar')).display,
      kpiCount:document.querySelectorAll('#lf-finance-content .kpi').length,
      active:document.body.dataset.activeLfRoute,
      financeRoute:window.__PRH_LF_FINANCE_RUNTIME__.getState().view?.route||''
    }));
    assert(finalLayout.scroll <= finalLayout.client + 2, `final overflow at ${viewport.width}px`);
    assert.notStrictEqual(finalLayout.toolbar,'none');
    assert(finalLayout.kpiCount>=4,'Diagnostic-restored Home must contain the four canonical KPI cards');
    assert.strictEqual(finalLayout.active,'home');
    assert.strictEqual(finalLayout.financeRoute,'home');
    assert.deepStrictEqual(requests,[],`warm route/filter/diagnostic navigation emitted HTTP requests: ${requests.join(' | ')}`);
    const spaCounters=await page.evaluate(()=>window.__PRH_LF_SPA_TEST__.getState());
    assert.strictEqual(spaCounters.mandatoryNetworkCalls,0);
    assert.strictEqual(spaCounters.googleSheetsReads,0);
    assert.strictEqual(spaCounters.lastDiagnostic.financeReadyFrames,10);

    await context.close();
    return {
      viewport,
      privacy,
      warmRequests:requests.length,
      revisionPrefix:revision.slice(0,12),
      diagnosticSamples:diagnostic.sampleCount,
      diagnosticFinanceReadyFrames:diagnostic.financeReadyFrames,
      diagnosticP95Ms:Number(diagnostic.p95Ms.toFixed(3))
    };
  }

  try {
    const desktop=await scenario({width:1440,height:1000},'NORMAL');
    const mobile=await scenario({width:390,height:844},'MASKED');
    console.log('local_finance_spa_visual_test: PASS',{desktop,mobile,exactCandidateRuntime:true,financeReadyDiagnostic:true});
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
