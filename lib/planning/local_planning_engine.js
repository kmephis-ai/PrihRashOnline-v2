'use strict';

const CONTRACT = require('./local_planning_engine.v1.json');
const budget = require('../budget/budget_control');
const obligations = require('../obligations/obligations');
const balance = require('../balance/balance_reconciliation');

const SCHEMA = 'PRH_LOCAL_PLANNING_ENGINE_V1';
const VERSION = '1.0.0';
const SOURCE_SCHEMA = 'PRH_LOCAL_PLANNING_SOURCE_V1';
const QUERY_SCHEMA = 'PRH_LOCAL_PLANNING_QUERY_V1';
const RESULT_SCHEMA = 'PRH_LOCAL_PLANNING_RESULT_V1';
const ROUTES = Object.freeze(['budget', 'obligations', 'liquidity']);
const HEX64 = /^[0-9a-f]{64}$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Z]{3}$/;

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function isoDate(day, code) { const text=String(day||''); if(!ISO_DAY.test(text)) fail(code); const d=new Date(text+'T00:00:00Z'); if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==text) fail(code); return text; }
function addDays(day, count) { const d=new Date(isoDate(day,'PLAN_QUERY_AS_OF_INVALID')+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+count); return d.toISOString().slice(0,10); }
function monthWindow(day) { const d=new Date(isoDate(day,'PLAN_QUERY_AS_OF_INVALID')+'T00:00:00Z'); const start=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)); const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)); return Object.freeze({start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)}); }
function safeMinor(value, code) { if(!Number.isSafeInteger(value)) fail(code); return value; }
function hex(value, code) { const text=String(value||'').toLowerCase(); if(!HEX64.test(text)) fail(code); return text; }

function assertContract() {
  if(CONTRACT.schema!==SCHEMA||CONTRACT.version!==VERSION||CONTRACT.roadmap_id!=='PLAN-REC-001'||CONTRACT.owner_attestation!=='APPROVED') fail('PLAN_ENGINE_CONTRACT_INVALID');
  if(CONTRACT.authorities.cash_flow_as_balance_proxy!==false||CONTRACT.authorities.financial_write!==false||CONTRACT.authorities.auto_transaction_creation!==false||CONTRACT.authorities.recurrence_inference!==false) fail('PLAN_ENGINE_AUTHORITY_INVALID');
  budget.assertContract(); obligations.assertContract(); balance.assertContract();
  return true;
}

function normalizeQuery(input) {
  if(!input||typeof input!=='object'||Array.isArray(input)) fail('PLAN_QUERY_INVALID');
  const allowed=['schema','version','route','as_of','window_end'];
  if(Object.keys(input).some((key)=>!allowed.includes(key))) fail('PLAN_QUERY_INVALID');
  if(input.schema!==QUERY_SCHEMA||input.version!==VERSION) fail('PLAN_QUERY_SCHEMA_INVALID');
  const route=String(input.route||''); if(!ROUTES.includes(route)) fail('PLAN_QUERY_ROUTE_INVALID');
  const asOf=isoDate(input.as_of,'PLAN_QUERY_AS_OF_INVALID');
  let windowEnd=input.window_end==null?'':String(input.window_end);
  if(windowEnd) isoDate(windowEnd,'PLAN_QUERY_WINDOW_END_INVALID');
  if(!windowEnd) windowEnd=addDays(asOf,CONTRACT.query.window_days_default);
  const span=Math.round((Date.parse(windowEnd+'T00:00:00Z')-Date.parse(asOf+'T00:00:00Z'))/86400000);
  if(span<=0||span>CONTRACT.query.window_days_max) fail('PLAN_QUERY_WINDOW_INVALID');
  return Object.freeze({schema:QUERY_SCHEMA,version:VERSION,route,as_of:asOf,window_end:windowEnd});
}

function normalizeSource(input) {
  if(!input||typeof input!=='object'||Array.isArray(input)||input.schema!==SOURCE_SCHEMA||input.version!==VERSION) fail('PLAN_SOURCE_INVALID');
  const canonicalRevision=hex(input.canonical_revision,'PLAN_SOURCE_CANONICAL_REVISION_INVALID');
  const planningRevision=hex(input.planning_revision,'PLAN_SOURCE_REVISION_INVALID');
  const currency=String(input.currency||'').toUpperCase(); if(!CURRENCY.test(currency)) fail('PLAN_SOURCE_CURRENCY_INVALID');
  for(const key of ['budget','recurring','commitments','liquidity']) if(!input[key]||typeof input[key]!=='object'||Array.isArray(input[key])) fail('PLAN_SOURCE_SECTION_INVALID');
  if(!Array.isArray(input.budget.plans)||!Array.isArray(input.recurring.plans)||!Array.isArray(input.commitments.items)||!Array.isArray(input.liquidity.observations)) fail('PLAN_SOURCE_COLLECTION_INVALID');
  return Object.freeze({
    schema:SOURCE_SCHEMA,version:VERSION,canonical_revision:canonicalRevision,planning_revision:planningRevision,currency,
    budget:input.budget,recurring:input.recurring,commitments:input.commitments,liquidity:input.liquidity
  });
}

function budgetResult(transactions, source, query) {
  const window=monthWindow(query.as_of);
  const candidates=source.budget.plans.filter((plan)=>plan&&plan.currency===source.currency&&plan.period&&plan.period.start===window.start&&plan.period.end===window.end);
  if(source.budget.state!=='READY'&&candidates.length===0) return Object.freeze({status:source.budget.state||'NOT_CONFIGURED',reason:source.budget.reason||null,period:window,view:null});
  if(candidates.length===0) return Object.freeze({status:'NOT_CONFIGURED',reason:'BUDGET_EXPLICIT_PERIOD_TOTAL_MISSING',period:window,view:null});
  if(candidates.length!==1) return Object.freeze({status:'UNAVAILABLE',reason:'BUDGET_EXPLICIT_PERIOD_TOTAL_AMBIGUOUS',period:window,view:null});
  const plan=Object.assign({},candidates[0]);
  const next=addDays(query.as_of,1);
  plan.as_of_exclusive=next>window.end?window.end:next;
  if(plan.as_of_exclusive<=window.start) plan.as_of_exclusive=addDays(window.start,1);
  const view=budget.buildBudgetControl(transactions,plan);
  return Object.freeze({status:'READY',reason:null,period:window,view});
}

function commitmentItems(source, query) {
  return Object.freeze(source.commitments.items.filter((item)=>item&&item.currency===source.currency&&item.due_date>=query.as_of&&item.due_date<query.window_end).slice().sort((a,b)=>a.due_date.localeCompare(b.due_date)||String(a.commitment_id).localeCompare(String(b.commitment_id))));
}

function obligationsResult(source, query) {
  let recurringView=null;
  let recurringStatus=source.recurring.state||'EMPTY';
  let recurringReason=source.recurring.reason||null;
  if(source.recurring.plans.length||recurringStatus==='READY') {
    recurringView=obligations.buildObligations(source.recurring.plans,{window_start:query.as_of,as_of:query.as_of,window_end:query.window_end});
    recurringStatus='READY'; recurringReason=null;
  }
  const commitments=commitmentItems(source,query);
  return Object.freeze({
    status:(recurringStatus==='SOURCE_UNAVAILABLE'&&source.commitments.state==='SOURCE_UNAVAILABLE')?'UNAVAILABLE':'READY',
    reason:recurringStatus==='SOURCE_UNAVAILABLE'?recurringReason:null,
    recurring_status:recurringStatus,
    recurring_reason:recurringReason,
    recurring:recurringView,
    commitments,
    commitment_state:source.commitments.state||'EMPTY',
    commitment_reason:source.commitments.reason||null,
    commitment_recurrence_inferred:false,
    canonical_transaction_created:false
  });
}

function liquidityResult(transactions, source) {
  if(source.liquidity.state!=='READY') return Object.freeze({status:source.liquidity.state||'SETUP_REQUIRED',reason:source.liquidity.reason||null,observed_total_minor:null,currency:source.currency,accounts:Object.freeze([]),coverage_scope:'OBSERVED_ACCOUNTS_ONLY',cash_flow_proxy_used:false});
  const groups=new Map();
  source.liquidity.observations.forEach((raw)=>{
    const obs=balance.normalizeObservation(raw);
    if(obs.currency!==source.currency) return;
    if(!groups.has(obs.account_id)) groups.set(obs.account_id,[]);
    groups.get(obs.account_id).push(obs);
  });
  const accounts=[]; let total=0;
  for(const [accountId,items] of groups.entries()) {
    items.sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at)||a.observation_id.localeCompare(b.observation_id));
    const latest=items[items.length-1]; total+=latest.balance_minor; safeMinor(total,'PLAN_LIQUIDITY_TOTAL_OVERFLOW');
    let reconciliation=null;
    if(items.length>=2) reconciliation=balance.reconcileBalance({anchor:items[items.length-2],target:latest,transactions});
    accounts.push(Object.freeze({account_id:accountId,latest_observation:latest,reconciliation,observation_count:items.length}));
  }
  accounts.sort((a,b)=>a.account_id.localeCompare(b.account_id));
  return Object.freeze({status:accounts.length?'READY':'EMPTY',reason:accounts.length?null:'BALANCE_OBSERVATION_EMPTY',observed_total_minor:accounts.length?total:null,currency:source.currency,accounts:Object.freeze(accounts),coverage_scope:'OBSERVED_ACCOUNTS_ONLY',cash_flow_proxy_used:false,missing_observation_is_zero:false});
}

function evaluatePlanning(transactions, sourceInput, queryInput) {
  assertContract();
  if(!Array.isArray(transactions)) fail('PLAN_TRANSACTIONS_INVALID');
  const source=normalizeSource(sourceInput); const query=normalizeQuery(queryInput);
  let payload;
  if(query.route==='budget') payload=budgetResult(transactions,source,query);
  else if(query.route==='obligations') payload=obligationsResult(source,query);
  else payload=liquidityResult(transactions,source,query);
  return Object.freeze({
    schema:RESULT_SCHEMA,version:VERSION,route:query.route,canonical_revision:source.canonical_revision,planning_revision:source.planning_revision,currency:source.currency,payload,
    provenance:Object.freeze({financial_truth_policy:'FIN-TRUTH-v1',budget:'BUD-020',obligations:'OBL-020',balance:'BAL-030',cash_flow_as_balance_proxy:false,financial_write:false,auto_transaction_creation:false})
  });
}

assertContract();
module.exports=Object.freeze({CONTRACT,SCHEMA,VERSION,SOURCE_SCHEMA,QUERY_SCHEMA,RESULT_SCHEMA,ROUTES,assertContract,normalizeQuery,normalizeSource,evaluatePlanning});
