'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');
const { repositoryRevision } = require('../lib/repository/transaction_repository');
const { buildCandidate } = require('../tools/build-apps-script-candidate');

const ROOT = path.resolve(__dirname, '..');
const CANDIDATE_SHA = '3'.repeat(40);

function fingerprint(value) { return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex'); }
function tx(index, overrides = {}) {
  const type = overrides.type || (index % 5 === 0 ? 'income' : 'expense');
  const categoryId = overrides.category_id || (index % 3 === 0 ? 'cat-food' : 'cat-home');
  const accountId = overrides.account_id || 'acc-main';
  const memberId = overrides.member_id === undefined ? 'member-a' : overrides.member_id;
  return {
    schema:'PRH_CANONICAL_TRANSACTION_V1', schema_version:1,
    transaction_id:`data-lf-${String(index).padStart(3,'0')}`,
    occurred_at:overrides.occurred_at || `2026-${String(((index - 1) % 6) + 1).padStart(2,'0')}-${String(((index - 1) % 27) + 1).padStart(2,'0')}T12:00:00Z`,
    type, status:'posted', amount_minor:overrides.amount_minor == null ? 10000 + index * 137 : overrides.amount_minor,
    currency:'RUB', account_id:accountId,
    destination_account_id:type === 'transfer' ? (overrides.destination_account_id || 'acc-second') : null,
    category_id:categoryId, member_id:memberId, project_id:'project-home', tags:['synthetic'],
    counterparty:`Synthetic counterparty ${index}`, description:`Synthetic DATA-LF operation ${index}`,
    reverses_transaction_id:null, adjustment_semantics:null,
    provenance:{
      source_system:'SYNTHETIC_TEST', source_container:'data-lf-visual', source_record_id:`row-${index}`,
      source_fingerprint:overrides.source_fingerprint || fingerprint(`data-lf:${index}`), identity_strategy:'EXTERNAL_ID',
      transform_version:'DATA-LF-VIS-v1', source_position:null
    }
  };
}

const duplicateFingerprint = fingerprint('data-lf-duplicate-group');
const transactions = Array.from({length:45}, (_,i) => tx(i + 1));
transactions[4] = tx(5,{category_id:'cat-missing'});
transactions[8] = tx(9,{account_id:'acc-missing'});
transactions[12] = tx(13,{member_id:'member-missing'});
transactions[20] = tx(21,{source_fingerprint:duplicateFingerprint});
transactions[21] = tx(22,{source_fingerprint:duplicateFingerprint});
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
  schema:'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1',version:'1.0.0',state:'FULL_BOOTSTRAP',
  revision,generation_id:revision,transactions,dimensions,aggregates:[],
  sync_journal:[{sequence:1,event:'FULL_BOOTSTRAP',revision,transaction_count:transactions.length,dimension_count:dimensions.length}],
  expected_counts:{transactions:transactions.length,dimensions:dimensions.length,aggregates:0,sync_journal:1},
  financial_write_authorized:false,canonical_mutation_performed:false
};

const temp = fs.mkdtempSync(path.join(os.tmpdir(),'prh-data-lf-visual-'));
const candidateDir = path.join(temp,'candidate');
const manifest = buildCandidate({sourceRoot:ROOT,repositoryRoot:ROOT,outRoot:candidateDir,candidateSha:CANDIDATE_SHA});
assert(manifest.localFirstBrowserRuntime,'DATA visual test must use exact candidate with injected Local-first browser runtime');
const candidateRoot = path.join(candidateDir,'files');
const shellHtml = fs.readFileSync(path.join(candidateRoot,'LocalFirstSpaWebApp.html'),'utf8');
const extensionHtml = fs.readFileSync(path.join(candidateRoot,'LocalFirstDataSpaExtension.html'),'utf8');
const planningExtensionHtml = fs.readFileSync(path.join(candidateRoot,'LocalFirstPlanningSpaExtension.html'),'utf8');
const serviceSource = fs.readFileSync(path.join(candidateRoot,'LocalFirstSpaService.js'),'utf8');
assert(shellHtml.includes('data-prh-local-first-runtime="1.0.0"'));
assert(extensionHtml.includes('data-prh-local-first-data-extension="1.0.0"'));

function htmlOutput(content){return {title:'',meta:[],setTitle(value){this.title=String(value);return this;},addMetaTag(name,value){this.meta.push([name,value]);return this;},getContent(){return String(content);}}}
function renderCandidate(params){
  const context=vm.createContext({console,JSON,Object,Array,String,Number,Math,Date,RegExp,Error,encodeURIComponent,ScriptApp:undefined,HtmlService:{
    createHtmlOutputFromFile(name){if(name==='LocalFirstSpaWebApp')return htmlOutput(shellHtml);if(name==='LocalFirstDataSpaExtension')return htmlOutput(extensionHtml);if(name==='LocalFirstPlanningSpaExtension')return htmlOutput(planningExtensionHtml);throw new Error(`unexpected candidate file ${name}`)},
    createHtmlOutput(content){return htmlOutput(content)}
  }});
  vm.runInContext(serviceSource,context,{filename:'LocalFirstSpaService.js'});
  return context.prhLocalFirstSpaRender_(params).getContent();
}
function listen(server){return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(server.address()))})}
function closeServer(server){return new Promise((resolve)=>server.close(resolve))}

function installSyncStub(page){
  return page.addInitScript(({fullEnvelope,revision})=>{
    window.__DATA_LF_SYNC_CALLS__={full:0,delta:0};
    const runner={success:null,failure:null,
      withSuccessHandler(fn){this.success=fn;return this;},
      withFailureHandler(fn){this.failure=fn;return this;},
      prhLocalFirstSyncBootstrapWire(request){
        window.__DATA_LF_SYNC_CALLS__.full+=1;
        const response=request&&request.local_revision===revision
          ? {schema:'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1',version:'1.0.0',state:'NOOP',revision,generation_id:revision,financial_write_authorized:false,canonical_mutation_performed:false}
          : fullEnvelope;
        queueMicrotask(()=>this.success(JSON.stringify(response)));
      },
      prhLocalFirstDelta(request){
        window.__DATA_LF_SYNC_CALLS__.delta+=1;
        const response={schema:'PRH_LOCAL_FIRST_DELTA_RESPONSE_V1',version:'1.0.0',state:'NOOP',base_revision:request.base_revision,target_revision:request.base_revision,target_generation_id:request.base_revision,base_inventory_digest:request.inventory.digest,financial_write_authorized:false,canonical_mutation_performed:false};
        queueMicrotask(()=>this.success(response));
      }
    };
    Object.defineProperty(window,'google',{value:{script:{run:runner}},configurable:true});
  },{fullEnvelope,revision});
}

(async()=>{
  const pagesByPrivacy={
    normal:renderCandidate({lf_route:'home',privacy:'NORMAL',lf_diag:'1'}),
    invalid:renderCandidate({lf_route:'home',privacy:'unexpected',lf_diag:'1'})
  };
  const server=http.createServer((request,response)=>{
    const body=new URL(request.url,'http://127.0.0.1').searchParams.get('case')==='invalid'?pagesByPrivacy.invalid:pagesByPrivacy.normal;
    response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});response.end(body);
  });
  const address=await listen(server);
  const browser=await chromium.launch({headless:true});
  const artifactDir=path.join(ROOT,'artifacts');fs.mkdirSync(artifactDir,{recursive:true});
  const evidence=[];

  async function scenario(name,viewport,invalidPrivacy){
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    await installSyncStub(page);
    const requests=[];let warm=false;const errors=[];
    page.on('request',(request)=>{if(warm)requests.push(request.url())});
    page.on('pageerror',(error)=>errors.push(error.message));
    const url=`http://127.0.0.1:${address.port}/?case=${invalidPrivacy?'invalid':'normal'}`;
    await page.goto(url,{waitUntil:'load',timeout:15000});
    await page.waitForFunction(()=>window.__PRH_LF_FINANCE_RUNTIME__&&window.__PRH_LF_FINANCE_RUNTIME__.getState().snapshot_status==='READY',null,{timeout:20000});
    const baselineCalls=await page.evaluate(()=>({...window.__DATA_LF_SYNC_CALLS__}));
    warm=true;

    await page.click('[data-lf-route="transactions"]');
    await page.waitForFunction(()=>window.__PRH_LF_DATA_EXTENSION__&&window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.route==='transactions'&&window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.status==='READY');
    let state=await page.evaluate(()=>({data:window.__PRH_LF_DATA_EXTENSION__.getState(),privacy:new URL(location.href).searchParams.get('privacy'),rows:document.querySelectorAll('.lf-data-table tbody tr').length,amounts:Array.from(document.querySelectorAll('.lf-data-amount')).slice(1).map(n=>n.textContent.trim()),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
    assert.strictEqual(state.data.lastState.revision,revision);
    assert.strictEqual(state.data.lastState.generation_id,revision);
    assert.strictEqual(state.data.lastState.total,45);
    assert.strictEqual(state.data.lastState.page,1);
    assert.strictEqual(state.rows,20,'page 1 must contain exactly 20 operations');
    assert(state.overflow<=2,`${name} transactions overflow ${state.overflow}`);
    if(invalidPrivacy){assert.strictEqual(state.privacy,'MASKED');assert(state.amounts.length>0&&state.amounts.every((v)=>v==='••••••'),'invalid privacy must fail closed to masked values');}
    else {assert.strictEqual(state.privacy,null,'canonical NORMAL privacy is intentionally omitted from history URL');assert(state.amounts.some((v)=>/₽|руб|RUB/i.test(v)),'NORMAL must show formatted synthetic money');}

    await page.click('#lf-tx-next');
    await page.waitForFunction(()=>window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.page===2);
    assert.strictEqual(await page.locator('.lf-data-table tbody tr').count(),20,'page 2 must contain exactly 20 operations');
    assert.strictEqual(new URL(await page.url()).searchParams.get('tx_page'),'2');

    await page.selectOption('#lf-tx-category','cat-food');
    await page.selectOption('#lf-tx-account','acc-main');
    await page.selectOption('#lf-tx-member','member-a');
    await page.fill('#lf-tx-start','2026-02-01');
    await page.fill('#lf-tx-end','2026-06-01');
    await page.click('#lf-tx-filter button[type="submit"]');
    await page.waitForFunction(()=>window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.page===1&&new URL(location.href).searchParams.get('tx_category')==='cat-food');
    const filtered=await page.evaluate(()=>({state:window.__PRH_LF_DATA_EXTENSION__.getState().lastState,url:location.href,rows:document.querySelectorAll('.lf-data-table tbody tr').length}));
    assert(filtered.state.total>0&&filtered.state.total<45,'filters must narrow the local list');
    assert(filtered.rows<=20);
    const parsed=new URL(filtered.url);
    const allowed=new Set(['case','surface','lf_route','privacy','lf_diag','tx_page','tx_start','tx_end','tx_category','tx_account','tx_member','tx_detail']);
    for(const key of parsed.searchParams.keys())assert(allowed.has(key),`unexpected history/query key ${key}`);
    assert(!/Synthetic DATA-LF|amount_minor|counterparty|description/i.test(parsed.search),'financial payload leaked into history');

    const detailButton=page.locator('[data-lf-detail]').first();
    const detailId=await detailButton.getAttribute('data-lf-detail');
    await detailButton.click();
    await page.waitForFunction((expected)=>new URL(location.href).searchParams.get('tx_detail')===expected&&!!document.querySelector('.lf-data-detail')&&window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.detail_open===true,detailId);
    assert.strictEqual(await page.locator('.lf-data-detail').count(),1);
    await page.goBack();
    await page.waitForFunction(()=>!new URL(location.href).searchParams.has('tx_detail')&&!document.querySelector('.lf-data-detail')&&window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.detail_open===false);
    assert.strictEqual(await page.locator('.lf-data-detail').count(),0,'Back must close detail without document reload');
    await page.goForward();
    await page.waitForFunction((expected)=>new URL(location.href).searchParams.get('tx_detail')===expected&&!!document.querySelector('.lf-data-detail')&&window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.detail_open===true,detailId);
    assert.strictEqual(await page.locator('.lf-data-detail').count(),1,'Forward must restore detail');

    await page.click('[data-lf-route="data-quality"]');
    await page.waitForFunction(()=>window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.route==='data-quality'&&window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.status==='READY');
    const dq=await page.evaluate(()=>({state:window.__PRH_LF_DATA_EXTENSION__.getState(),counts:Array.from(document.querySelectorAll('.lf-dq-count')).map(n=>Number(n.textContent)),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,calls:{...window.__DATA_LF_SYNC_CALLS__}}));
    assert.strictEqual(dq.state.lastState.problem_count,4,'DQ must find four meaningful projection/referential signals');
    assert.deepStrictEqual(dq.counts,[1,1,1,1]);
    assert.strictEqual(dq.state.canonicalWrites,0);
    assert.strictEqual(dq.state.autofixCalls,0);
    assert.strictEqual(dq.state.googleSheetsReads,0);
    assert.strictEqual(dq.state.networkCalls,0);
    assert.deepStrictEqual(dq.calls,baselineCalls,'warm Data navigation/filter/page/detail/DQ must not call google.script.run');
    assert.deepStrictEqual(requests,[],`warm Data interactions emitted HTTP requests: ${requests.join(' | ')}`);
    assert.deepStrictEqual(errors,[],`${name} page errors: ${errors.join(' | ')}`);
    assert(dq.overflow<=2,`${name} DQ overflow ${dq.overflow}`);

    const screenshot=path.join(artifactDir,`local-first-data-${name}.png`);await page.screenshot({path:screenshot,fullPage:true});
    evidence.push({name,viewport,privacy:state.privacy,revisionPrefix:revision.slice(0,12),transactions:45,pageSize:20,filteredTotal:filtered.state.total,dqProblemCount:dq.state.lastState.problem_count,warmHttpRequests:requests.length,warmGoogleScriptRunDelta:(dq.calls.full+dq.calls.delta)-(baselineCalls.full+baselineCalls.delta),canonicalWrites:dq.state.canonicalWrites,autofixCalls:dq.state.autofixCalls,responsiveOverflowPx:dq.overflow});
    await context.close();
  }

  async function staleGenerationScenario(){
    const context=await browser.newContext({viewport:{width:1000,height:800}});const page=await context.newPage();await installSyncStub(page);
    await page.goto(`http://127.0.0.1:${address.port}/?case=normal`,{waitUntil:'load',timeout:15000});
    await page.waitForFunction(()=>window.__PRH_LF_FINANCE_RUNTIME__&&window.__PRH_LF_FINANCE_RUNTIME__.getState().snapshot_status==='READY',null,{timeout:20000});
    const snapshotA={status:'READY',schema:'PRH_LOCAL_READ_MODEL_V1',generation_id:'a'.repeat(64),revision:'a'.repeat(64),transactions:transactions.slice(0,2),dimensions,aggregates:[]};
    const snapshotB={status:'READY',schema:'PRH_LOCAL_READ_MODEL_V1',generation_id:'b'.repeat(64),revision:'b'.repeat(64),transactions:transactions.slice(0,3),dimensions,aggregates:[]};
    await page.evaluate(({snapshotA,snapshotB})=>{
      const original=window.PrhLocalReadModelStore;let calls=0,resolveFirst;
      const first=new Promise((resolve)=>{resolveFirst=resolve});
      window.__DATA_LF_STALE_TEST__={calls:()=>calls,resolveFirst:()=>resolveFirst(snapshotA)};
      window.PrhLocalReadModelStore=Object.assign({},original,{createStore(){return {open:async()=>({status:'OPEN'}),getActiveSnapshot:async()=>{calls+=1;return calls===1?first:snapshotB}}}});
    },{snapshotA,snapshotB});
    await page.click('[data-lf-route="transactions"]');
    await page.waitForFunction(()=>window.__DATA_LF_STALE_TEST__.calls()===1);
    await page.evaluate(()=>window.__PRH_LF_DATA_EXTENSION__.render());
    await page.waitForFunction(()=>window.__PRH_LF_DATA_EXTENSION__.getState().lastState?.revision==='b'.repeat(64));
    await page.evaluate(()=>window.__DATA_LF_STALE_TEST__.resolveFirst());
    await page.waitForTimeout(80);
    const state=await page.evaluate(()=>window.__PRH_LF_DATA_EXTENSION__.getState().lastState);
    assert.strictEqual(state.revision,'b'.repeat(64),'late old-generation render must be discarded');
    assert.strictEqual(state.total,3);
    evidence.push({name:'stale-generation-race',oldRevisionPrefix:'a'.repeat(12),winningRevisionPrefix:'b'.repeat(12),staleCommitDiscarded:true});
    await context.close();
  }

  try{
    await scenario('desktop',{width:1440,height:1000},false);
    await scenario('mobile',{width:390,height:844},true);
    await staleGenerationScenario();
    fs.writeFileSync(path.join(artifactDir,'local-first-data-visual.json'),JSON.stringify({schema:'PRH_LOCAL_FIRST_DATA_VISUAL_EVIDENCE_V1',privacy_class:'SYNTHETIC_ONLY',candidateSha:CANDIDATE_SHA,exactCandidate:true,realChromium:true,realIndexedDB:true,sameVerifiedSnapshotAsFinance:true,zeroWarmNetwork:true,canonicalWrite:false,autofix:false,staleGenerationCommit:false,evidence},null,2));
    console.log('local_first_data_spa_visual_test: PASS',{revisionPrefix:revision.slice(0,12),transactions:transactions.length,desktopAndMobile:true,realIndexedDB:true,filters:true,pagination:true,detail:true,backForward:true,privacyFailClosed:true,dqSignals:4,zeroWarmNetwork:true,staleGenerationDiscarded:true});
  } finally {
    await browser.close().catch(()=>{});await closeServer(server);fs.rmSync(temp,{recursive:true,force:true});
  }
})().catch((error)=>{fs.rmSync(temp,{recursive:true,force:true});console.error(error.stack||error.message);process.exitCode=1;});