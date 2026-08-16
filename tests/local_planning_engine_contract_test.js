'use strict';
const assert=require('assert');
const crypto=require('crypto');
const engine=require('../lib/planning/local_planning_engine');
const {SCHEMA_ID}=require('../lib/domain/canonical_transaction');
function sha(v){return crypto.createHash('sha256').update(String(v)).digest('hex')}
function tx(id,date,type,amount,account='acc-main'){return {schema:SCHEMA_ID,schema_version:1,transaction_id:id,occurred_at:date+'T12:00:00Z',type,status:'posted',amount_minor:amount,currency:'RUB',account_id:account,destination_account_id:null,category_id:'cat-main',member_id:null,project_id:null,tags:['synthetic'],counterparty:null,description:'Synthetic planning fixture',reverses_transaction_id:null,adjustment_semantics:null,provenance:{source_system:'SYNTHETIC_TEST',source_container:'fixture:planning',source_record_id:id,source_fingerprint:sha(id),identity_strategy:'EXTERNAL_ID',transform_version:'SYN-PLAN-v1',source_position:null}}}
function obs(id,at,balance){return {schema:'PRH_BALANCE_OBSERVATION_V1',version:'1.0.0',observation_id:id,account_id:'acc-main',currency:'RUB',observed_at:at,balance_minor:balance,provenance:{source_system:'SYNTHETIC_TEST',source_record_id:'record:'+id,source_fingerprint:sha('obs:'+id),capture_method:'SYNTHETIC_TEST',transform_version:'SYN-PLAN-v1'}}}
const rev='a'.repeat(64),planRev='b'.repeat(64);
const source={schema:'PRH_LOCAL_PLANNING_SOURCE_V1',version:'1.0.0',canonical_revision:rev,planning_revision:planRev,currency:'RUB',budget:{state:'READY',reason:null,plans:[{schema:'PRH_BUDGET_PLAN_V1',version:'1.0.0',scope_id:'TOTAL_EXPENSE_LINEAR_PERIOD_V1',currency:'RUB',period:{start:'2026-08-01',end:'2026-09-01',partial:false},budget_minor:100000}]},recurring:{state:'READY',reason:null,plans:[{schema:'PRH_OBLIGATION_PLAN_V1',version:'1.0.0',plan_id:'REG-1',label:'Synthetic recurring',direction:'OUTFLOW',amount_minor:10000,currency:'RUB',enabled:true,active_end_exclusive:null,recurrence:{kind:'MONTHLY',anchor_date:'2026-08-20',interval_months:1,month_day_policy:'CLAMP_TO_LAST_DAY'},completed_due_dates:[]}]},commitments:{state:'READY',reason:null,items:[{commitment_id:'OBL-1',label:'Synthetic dated commitment',due_date:'2026-08-25',payment_minor:5000,currency:'RUB',recurrence_inferred:false,canonical_transaction_created:false}]},liquidity:{state:'READY',reason:null,observations:[obs('BAL-1','2026-08-01T00:00:00Z',100000),obs('BAL-2','2026-08-16T23:59:59Z',92000)]}};
const transactions=[tx('EXP-1','2026-08-05','expense',20000),tx('INC-1','2026-08-10','income',12000)];
assert.strictEqual(engine.assertContract(),true);
assert.strictEqual(engine.CONTRACT.authorities.cash_flow_as_balance_proxy,false);
const q=(route)=>({schema:'PRH_LOCAL_PLANNING_QUERY_V1',version:'1.0.0',route,as_of:'2026-08-16',window_end:'2026-11-14'});
const b=engine.evaluatePlanning(transactions,source,q('budget'));
assert.strictEqual(b.schema,'PRH_LOCAL_PLANNING_RESULT_V1');assert.strictEqual(b.payload.status,'READY');assert.strictEqual(b.payload.view.plan.budget_minor,100000);assert.strictEqual(b.payload.view.fact_expense_minor,20000);assert.strictEqual(b.payload.view.account_balance_authority,false);
const o=engine.evaluatePlanning(transactions,source,q('obligations'));
assert.strictEqual(o.payload.status,'READY');assert(o.payload.recurring.occurrences.length>=1);assert.strictEqual(o.payload.commitments.length,1);assert.strictEqual(o.payload.commitment_recurrence_inferred,false);assert.strictEqual(o.payload.canonical_transaction_created,false);
const l=engine.evaluatePlanning(transactions,source,q('liquidity'));
assert.strictEqual(l.payload.status,'READY');assert.strictEqual(l.payload.observed_total_minor,92000);assert.strictEqual(l.payload.cash_flow_proxy_used,false);assert.strictEqual(l.payload.missing_observation_is_zero,false);assert.strictEqual(l.payload.accounts[0].reconciliation.state,'MATCH');
const missing=JSON.parse(JSON.stringify(source));missing.liquidity={state:'SETUP_REQUIRED',reason:'BALANCE_OBSERVATION_SHEET_MISSING',observations:[]};
const lm=engine.evaluatePlanning(transactions,missing,q('liquidity'));assert.strictEqual(lm.payload.status,'SETUP_REQUIRED');assert.strictEqual(lm.payload.observed_total_minor,null);assert.strictEqual(lm.payload.cash_flow_proxy_used,false);
const noBudget=JSON.parse(JSON.stringify(source));noBudget.budget={state:'NOT_CONFIGURED',reason:'BUDGET_EXPLICIT_TOTAL_NOT_CONFIGURED',plans:[]};assert.strictEqual(engine.evaluatePlanning(transactions,noBudget,q('budget')).payload.status,'NOT_CONFIGURED');
const ambiguous=JSON.parse(JSON.stringify(source));ambiguous.budget.plans.push({...ambiguous.budget.plans[0]});assert.strictEqual(engine.evaluatePlanning(transactions,ambiguous,q('budget')).payload.reason,'BUDGET_EXPLICIT_PERIOD_TOTAL_AMBIGUOUS');
assert.throws(()=>engine.evaluatePlanning(transactions,{...source,canonical_revision:'bad'},q('budget')),/PLAN_SOURCE_CANONICAL_REVISION_INVALID/);
console.log('local_planning_engine_contract_test: PASS',{ownerAuthority:true,budgetFinTruth:true,recurrenceInference:false,cashFlowBalanceProxy:false,writeAuthority:false});
