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
const CANDIDATE_SHA = '7'.repeat(40);
function sha(value){return crypto.createHash('sha256').update(String(value),'utf8').digest('hex');}
function isoDay(d){return d.toISOString().slice(0,10);}
const now = new Date();
const year = now.getUTCFullYear();
const month = now.getUTCMonth();
const monthStart = new Date(Date.UTC(year,month,1));
const nextMonth = new Date(Date.UTC(year,month+1,1));
const asOf = isoDay(now);
const due = new Date(Date.UTC(year,month,Math.min(25,new Date(Date.UTC(year,month+1,0)).getUTCDate())));
if (due < now) due.setUTCMonth(due.getUTCMonth()+1);
const dueDay = isoDay(due);
const nextDue = new Date(due); nextDue.setUTCDate(nextDue.getUTCDate()+5);
const windowDue = isoDay(nextDue);

function tx(id,day,type,amount){return {
  schema:'PRH_CANONICAL_TRANSACTION_V1',schema_version:1,transaction_id:id,occurred_at:day+'T12:00:00Z',
  type,status:'posted',amount_minor:amount,currency:'RUB',account_id:'acc-main',destination_account_id:null,
  category_id:'cat-home',member_id:'member-a',project_id:'project-home',tags:['synthetic'],counterparty:null,
  description:'Synthetic planning Product Ready fixture',reverses_transaction_id:null,adjustment_semantics:null,
  provenance:{source_system:'SYNTHETIC_TEST',source_container:'planning-product-ready',source_record_id:id,source_fingerprint:sha(id),identity_strategy:'EXTERNAL_ID',transform_version:'PLAN-REC-001-E2E-v1',source_position:null}
};}
const txDay = isoDay(new Date(Date.UTC(year,month,Math.max(1,Math.min(now.getUTCDate(),10)))));
const transactions=[tx('plan-expense-1',txDay,'expense',20000),tx('plan-income-1',txDay,'income',10000)];
const revision=repositoryRevision(transactions);
const dimensions=[
  {dimension_key:'category|cat-home',kind:'category',dimension_id:'cat-home',label:'Дом'},
  {dimension_key:'account|acc-main',kind:'account',dimension_id:'acc-main',label:'Основной счёт'},
  {dimension_key:'member|member-a',kind:'member',dimension_id:'member-a',label:'Участник'},
  {dimension_key:'project|project-home',kind:'project',dimension_id:'project-home',label:'Дом'}
];
const fullEnvelope={schema:'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1',version:'1.0.0',state:'FULL_BOOTSTRAP',revision,generation_id:revision,transactions,dimensions,aggregates:[],sync_journal:[{sequence:1,event:'FULL_BOOTSTRAP',revision,transaction_count:transactions.length,dimension_count:dimensions.length}],expected_counts:{transactions:transactions.length,dimensions:dimensions.length,aggregates:0,sync_journal:1},financial_write_authorized:false,canonical_mutation_performed:false};
function observation(id,at,balance){return {schema:'PRH_BALANCE_OBSERVATION_V1',version:'1.0.0',observation_id:id,account_id:'acc-main',currency:'RUB',observed_at:at,balance_minor:balance,provenance:{source_system:'SYNTHETIC_TEST',source_record_id:id,source_fingerprint:sha('obs:'+id),capture_method:'SYNTHETIC_TEST',transform_version:'PLAN-REC-001-E2E-v1'}};}
const planningRevision=sha('planning-product-ready:'+revision+':'+asOf);
const planningSource={schema:'PRH_LOCAL_PLANNING_SOURCE_V1',version:'1.0.0',canonical_revision:revision,planning_revision:planningRevision,currency:'RUB',
  budget:{state:'READY',reason:null,plans:[{schema:'PRH_BUDGET_PLAN_V1',version:'1.0.0',scope_id:'TOTAL_EXPENSE_LINEAR_PERIOD_V1',currency:'RUB',period:{start:isoDay(monthStart),end:isoDay(nextMonth),partial:false},budget_minor:100000}]},
  recurring:{state:'READY',reason:null,plans:[{schema:'PRH_OBLIGATION_PLAN_V1',version:'1.0.0',plan_id:'REG-1',label:'Плановый платёж',direction:'OUTFLOW',amount_minor:12000,currency:'RUB',enabled:true,active_end_exclusive:null,recurrence:{kind:'ONCE',due_date:dueDay},completed_due_dates:[]}]},
  commitments:{state:'READY',reason:null,items:[{commitment_id:'COM-1',label:'Отдельное обязательство',due_date:windowDue,payment_minor:5000,currency:'RUB',recurrence_inferred:false,canonical_transaction_created:false}]},
  liquidity:{state:'READY',reason:null,observations:[observation('BAL-1',isoDay(monthStart)+'T00:00:00Z',100000),observation('BAL-2',asOf+'T23:59:59Z',90000)]}
};
const planningFull={schema:'PRH_LOCAL_PLANNING_SYNC_RESPONSE_V1',version:'1.0.0',state:'FULL_SNAPSHOT',canonical_revision:revision,planning_revision:planningRevision,source:planningSource,financial_write_authorized:false,canonical_mutation_performed:false,auto_transaction_creation:false,cash_flow_balance_proxy_used:false,telemetry:{status:'FULL_SNAPSHOT',private_payload_in_telemetry:false}};

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'prh-plan-product-ready-'));
const candidateDir=path.join(temp,'candidate');
const manifest=buildCandidate({sourceRoot:ROOT,repositoryRoot:ROOT,outRoot:candidateDir,candidateSha:CANDIDATE_SHA});
assert(manifest.localFirstBrowserRuntime);
const candidateRoot=path.join(candidateDir,'files');
const shellHtml=fs.readFileSync(path.join(candidateRoot,'LocalFirstSpaWebApp.html'),'utf8');
const dataExtension=fs.readFileSync(path.join(candidateRoot,'LocalFirstDataSpaExtension.html'),'utf8');
const planningExtension=fs.readFileSync(path.join(candidateRoot,'LocalFirstPlanningSpaExtension.html'),'utf8');
const visualizationExtension=fs.readFileSync(path.join(candidateRoot,'LocalFirstVisualizationSpaExtension.html'),'utf8');
const serviceSource=fs.readFileSync(path.join(candidateRoot,'LocalFirstSpaService.js'),'utf8');
assert(planningExtension.includes('data-prh-local-first-planning-extension="1.0.0"'));
assert(visualizationExtension.includes('id="prh-local-first-visualization-extension"'));
assert(shellHtml.includes('data-lf-route="budget"')&&shellHtml.includes('data-lf-route="obligations"')&&shellHtml.includes('data-lf-route="liquidity"'));
function output(content){return {setTitle(){return this},addMetaTag(){return this},getContent(){return String(content)}};}
function render(params){const context=vm.createContext({console,JSON,Object,Array,String,Number,Math,Date,RegExp,Error,encodeURIComponent,ScriptApp:undefined,HtmlService:{createHtmlOutputFromFile(name){if(name==='LocalFirstSpaWebApp')return output(shellHtml);if(name==='LocalFirstDataSpaExtension')return output(dataExtension);if(name==='LocalFirstPlanningSpaExtension')return output(planningExtension);if(name==='LocalFirstVisualizationSpaExtension')return output(visualizationExtension);throw new Error('unexpected '+name)},createHtmlOutput(content){return output(content)}}});vm.runInContext(serviceSource,context,{filename:'LocalFirstSpaService.js'});return context.prhLocalFirstSpaRender_(params).getContent();}
function listen(server){return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(server.address()))})}
function close(server){return new Promise((resolve)=>server.close(resolve))}

async function installStub(page){return page.addInitScript(({fullEnvelope,revision,planningFull,planningRevision})=>{
  window.__PLAN_REC_CALLS__={financeFull:0,financeDelta:0,planning:0,googleSheetsReads:0};
  function chain(){return {success:null,failure:null,withSuccessHandler(fn){this.success=fn;return this},withFailureHandler(fn){this.failure=fn;return this},
    prhLocalFirstSyncBootstrapWire(request){window.__PLAN_REC_CALLS__.financeFull+=1;const r=request&&request.local_revision===revision?{schema:'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1',version:'1.0.0',state:'NOOP',revision,generation_id:revision,financial_write_authorized:false,canonical_mutation_performed:false}:fullEnvelope;queueMicrotask(()=>this.success(JSON.stringify(r)))},
    prhLocalFirstDelta(request){window.__PLAN_REC_CALLS__.financeDelta+=1;const r={schema:'PRH_LOCAL_FIRST_DELTA_RESPONSE_V1',version:'1.0.0',state:'NOOP',base_revision:request.base_revision,target_revision:request.base_revision,target_generation_id:request.base_revision,base_inventory_digest:request.inventory.digest,financial_write_authorized:false,canonical_mutation_performed:false};queueMicrotask(()=>this.success(r))},
    prhPlanningLocalFirstBootstrapWire(request){window.__PLAN_REC_CALLS__.planning+=1;window.__PLAN_REC_CALLS__.googleSheetsReads+=1;const r=request&&request.local_planning_revision===planningRevision?{schema:'PRH_LOCAL_PLANNING_SYNC_RESPONSE_V1',version:'1.0.0',state:'NOOP',canonical_revision:revision,planning_revision:planningRevision,financial_write_authorized:false,canonical_mutation_performed:false,auto_transaction_creation:false,cash_flow_balance_proxy_used:false,telemetry:{status:'NOOP'}}:planningFull;queueMicrotask(()=>this.success(JSON.stringify(r)))}
  }}
  Object.defineProperty(window,'google',{value:{script:{get run(){return chain()}}},configurable:true});
},{fullEnvelope,revision,planningFull,planningRevision});}

(async()=>{
 const server=http.createServer((req,res)=>{
  const requestUrl=new URL(req.url,'http://127.0.0.1');
  const html=render({
   lf_route:requestUrl.searchParams.get('lf_route')||'home',
   privacy:requestUrl.searchParams.get('privacy')||'NORMAL',
   lf_diag:requestUrl.searchParams.get('lf_diag')||''
  });
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
  res.end(html);
 });
 const address=await listen(server);const browser=await chromium.launch({headless:true});
 try{
  for(const device of [{name:'desktop',width:1440,height:1000,privacy:'NORMAL'},{name:'mobile',width:390,height:844,privacy:'MASKED'}]){
   const context=await browser.newContext({viewport:{width:device.width,height:device.height}});const page=await context.newPage();await installStub(page);const errors=[];let warm=false;const warmRequests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(warm)warmRequests.push(r.url())});
   await page.goto(`http://127.0.0.1:${address.port}/?surface=local-first&lf_route=home&privacy=${device.privacy}`,{waitUntil:'load',timeout:15000});
   assert.strictEqual(new URL(page.url()).searchParams.get('privacy'),device.privacy,`${device.name}: server bootstrap changed requested privacy mode`);
   await page.waitForFunction(()=>window.__PRH_LF_FINANCE_RUNTIME__?.getState().snapshot_status==='READY'&&window.__PRH_LF_FINANCE_RUNTIME__.getState().sync_status==='READY',null,{timeout:20000});
   const beforePlanning=await page.evaluate(()=>({...window.__PLAN_REC_CALLS__}));
   assert.strictEqual(beforePlanning.planning,0,`${device.name}: normal finance boot must not prefetch planning`);
   await page.click('[data-lf-route="budget"]');
   await page.waitForFunction(()=>window.__PRH_LF_PLANNING_RUNTIME__?.getState().view?.status==='READY'&&window.__PRH_LF_PLANNING_RUNTIME__.getState().route==='budget',null,{timeout:20000});
   const budget=await page.evaluate(()=>({state:window.__PRH_LF_PLANNING_RUNTIME__.getState(),text:document.getElementById('lf-preview-grid').innerText,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,calls:{...window.__PLAN_REC_CALLS__}}));
   assert.strictEqual(budget.state.canonical_revision,revision);assert.strictEqual(budget.state.planning_revision,planningRevision);assert(/Бюджет месяца/.test(budget.text));assert(/Фактические расходы берутся из проверенных операций/.test(budget.text));assert(!/FIN-TRUTH/.test(budget.text),`${device.name}: ordinary planning UI leaked developer marker`);assert(budget.overflow<=2,`${device.name}: budget overflow`);assert.strictEqual(budget.calls.planning,1);assert.strictEqual(budget.calls.googleSheetsReads,1);
   if(device.privacy==='MASKED')assert(budget.text.includes('••••••'),'MASKED planning UI must hide money');else assert(!budget.text.includes('••••••'),'NORMAL planning UI must show money');
   const baselineCalls=budget.calls;warm=true;
   for(const route of ['obligations','liquidity','budget']){await page.click(`[data-lf-route="${route}"]`);await page.waitForFunction((route)=>window.__PRH_LF_PLANNING_RUNTIME__?.getState().route===route&&window.__PRH_LF_PLANNING_RUNTIME__.getState().view?.status==='READY',route,{timeout:10000});}
   const afterWarm=await page.evaluate(()=>({calls:{...window.__PLAN_REC_CALLS__},text:document.body.innerText,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,planning:window.__PRH_LF_PLANNING_RUNTIME__.getState()}));
   assert.strictEqual(afterWarm.calls.planning,baselineCalls.planning,`${device.name}: warm planning route invoked remote sync`);assert.strictEqual(afterWarm.calls.googleSheetsReads,baselineCalls.googleSheetsReads,`${device.name}: warm planning route read Sheets`);assert(afterWarm.overflow<=2,`${device.name}: planning overflow`);assert.strictEqual(afterWarm.planning.view.result.provenance.financial_write,false);assert.strictEqual(afterWarm.planning.view.result.provenance.cash_flow_as_balance_proxy,false);
   await page.click('[data-lf-route="liquidity"]');await page.waitForFunction(()=>window.__PRH_LF_PLANNING_RUNTIME__?.getState().route==='liquidity'&&window.__PRH_LF_PLANNING_RUNTIME__.getState().view?.status==='READY');const liquidityText=await page.locator('#lf-preview-grid').innerText();assert(/Cash Flow как остаток\s*Нет/.test(liquidityText));assert(/Только счета с явными наблюдениями/.test(liquidityText));
   await page.click('[data-lf-route="obligations"]');await page.waitForFunction(()=>window.__PRH_LF_PLANNING_RUNTIME__?.getState().route==='obligations'&&window.__PRH_LF_PLANNING_RUNTIME__.getState().view?.status==='READY');const obligationsText=await page.locator('#lf-preview-grid').innerText();assert(/не создают операции автоматически/.test(obligationsText));assert(/периодичность не предполагается/.test(obligationsText));if(device.privacy==='MASKED'){assert(!obligationsText.includes('Плановый платёж'),'MASKED planning UI must hide recurring private label');assert(!obligationsText.includes('Отдельное обязательство'),'MASKED planning UI must hide commitment private label');assert(obligationsText.includes('Скрыто'),'MASKED planning UI must render privacy-safe label placeholder');}
   assert.deepStrictEqual(errors,[],`${device.name}: page errors ${errors.join(' | ')}`);assert.deepStrictEqual(warmRequests,[],`${device.name}: warm HTTP requests ${warmRequests.join(' | ')}`);
   await context.close();
  }
  console.log('local_first_planning_product_ready_visual_test: PASS',{desktop:true,representativeMobile:true,configuredBudget:true,configuredObligations:true,configuredLiquidity:true,warmPlanningNetwork:0,warmGoogleSheetsReads:0,financialWrite:false,cashFlowBalanceProxy:false});
 }finally{await browser.close().catch(()=>{});await close(server);fs.rmSync(temp,{recursive:true,force:true});}
})().catch((error)=>{fs.rmSync(temp,{recursive:true,force:true});console.error(error.stack||error.message);process.exitCode=1;});
