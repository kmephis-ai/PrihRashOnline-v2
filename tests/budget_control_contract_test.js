'use strict';

const assert = require('assert');
const CONTRACT = require('../lib/budget/budget_control.v1.json');
const budget = require('../lib/budget/budget_control');
const { evaluateKpis } = require('../lib/finance/kpi_dictionary');
const viz = require('../lib/visualization/visualization_foundation');

function expectCode(fn, prefix) { let thrown=null; try{fn();}catch(error){thrown=error;} assert(thrown,`Expected ${prefix}`); assert(String(thrown.code||thrown.message).startsWith(prefix),`Expected ${prefix}, got ${thrown.code||thrown.message}`); }
function tx(id,date,type,amount,category,extra={}) { return {transaction_id:id,occurred_at:`${date}T12:00:00Z`,type,status:'posted',amount_minor:amount,currency:extra.currency||'RUB',account_id:extra.account_id||'SYN-ACCOUNT',destination_account_id:type==='transfer'?(extra.destination_account_id||'SYN-SAVINGS'):null,category_id:category||'SYN-OTHER',member_id:'SYN-MEMBER',project_id:null,tags:['SYNTHETIC'],counterparty:'SYN-COUNTERPARTY',description:'Synthetic budget fixture',reverses_transaction_id:null,adjustment_semantics:extra.adjustment_semantics||null}; }
function plan(budgetMinor=100000,asOf='2026-02-01') { return {schema:'PRH_BUDGET_PLAN_V1',version:'1.0.0',scope_id:'TOTAL_EXPENSE_LINEAR_PERIOD_V1',currency:'RUB',period:{start:'2026-01-01',end:'2026-03-01',partial:false},as_of_exclusive:asOf,budget_minor:budgetMinor}; }
function inputsForNetExpense(expenseMinor) { return [tx('SYN-EXP','2026-01-10','expense',expenseMinor+5000,'SYN-HOME'),tx('SYN-REFUND','2026-01-15','refund',5000,'SYN-HOME',{adjustment_semantics:'expense_reduction'}),tx('SYN-TRANSFER','2026-01-20','transfer',999999,'SYN-TRANSFER'),tx('SYN-FUTURE','2026-02-10','expense',90000,'SYN-FUTURE')]; }

assert.strictEqual(CONTRACT.schema,'PRH_BUDGET_CONTROL_V1');
assert.strictEqual(CONTRACT.scope.id,'TOTAL_EXPENSE_LINEAR_PERIOD_V1');
assert.strictEqual(CONTRACT.scope.implicit_proration,false);
assert.strictEqual(CONTRACT.scope.category_allocation,false);
assert.strictEqual(CONTRACT.scope.persistence,false);
assert.strictEqual(CONTRACT.alert_policy.at_risk_utilization_basis_points,9500);
assert.strictEqual(CONTRACT.invariants.fact_from_fin010,true);
assert.strictEqual(CONTRACT.invariants.elapsed_variance_from_fin010,true);
assert.strictEqual(CONTRACT.invariants.projection_is_financial_truth,false);
assert.strictEqual(CONTRACT.invariants.run_rate_is_financial_truth,false);
assert.strictEqual(CONTRACT.invariants.liquidity_or_balance_authority,false);
assert.strictEqual(CONTRACT.cost.mode,'FREE_ONLY');
assert(Object.values(CONTRACT.authority).every(v=>v===false));

const normalized=budget.normalizePlan(plan());
assert.strictEqual(normalized.total_days,59);
assert.strictEqual(normalized.elapsed_days,31);
assert.strictEqual(normalized.elapsed_budget_minor,52542);
assert.strictEqual(budget.roundHalfUpPositiveRatio(100000,31,59),52542);
assert.strictEqual(budget.roundHalfUpPositiveRatio(50000,59,31),95161);

const AT_RISK_INPUTS=inputsForNetExpense(50000);
const view=budget.buildBudgetControl(AT_RISK_INPUTS,plan(),{base_filter_context:{schema:viz.FILTER_CONTEXT_SCHEMA,contract_version:viz.VERSION,filters:[{kind:'DIMENSION',field:'account_id',operator:'INCLUDE',values:['SYN-ACCOUNT']}]}});
const fin=evaluateKpis(AT_RISK_INPUTS,{currency:'RUB',period:{start:'2026-01-01',end:'2026-02-01',partial:false},budget_minor:52542});
assert.strictEqual(view.fact_expense_minor,fin.expense_minor);
assert.strictEqual(view.fact_expense_minor,50000);
assert.strictEqual(view.elapsed_budget_variance_minor,fin.budget_variance_minor);
assert.strictEqual(view.elapsed_budget_variance_minor,2542);
assert.strictEqual(view.run_rate_projection_minor,95161);
assert.strictEqual(view.projected_variance_minor,4839);
assert.strictEqual(view.projected_utilization_basis_points,9516);
assert.strictEqual(view.alert_state,'AT_RISK');
assert.strictEqual(view.liquidity_state,'NOT_A_BALANCE_METRIC');
assert.strictEqual(view.account_balance_authority,false);

const onTrack=budget.buildBudgetControl(inputsForNetExpense(40000),plan());
assert.strictEqual(onTrack.alert_state,'ON_TRACK');
assert(onTrack.elapsed_budget_variance_minor>0);
assert(onTrack.projected_utilization_basis_points<9500);
const over=budget.buildBudgetControl(inputsForNetExpense(53000),plan());
assert.strictEqual(over.alert_state,'OVER_BUDGET');
assert(over.elapsed_budget_variance_minor<0);

assert.deepStrictEqual(view.widgets.map(w=>[w.id,w.chart_spec.type,w.chart_spec.encoding.y.id]),[['budget-fact','BAR','EXPENSE'],['budget-variance','BAR','BUDGET_VARIANCE']]);
const specText=JSON.stringify(view.widgets); for(const forbidden of ['budget_minor','fact_expense_minor','elapsed_budget_variance_minor','run_rate_projection_minor','rows']) assert(!specText.includes(forbidden));
const factOption=viz.compileEChartsOption(view.widgets[0].chart_spec,view.render_datasets.fact); const varianceOption=viz.compileEChartsOption(view.widgets[1].chart_spec,view.render_datasets.variance); assert(factOption.option.series.every(s=>s.type==='bar')); assert(varianceOption.option.series.every(s=>s.type==='bar'));

const drill=budget.buildBudgetDrill(view,{widget_id:'budget-variance'});
assert.strictEqual(drill.schema,'PRH_BUDGET_DRILL_ENVELOPE_V1');
assert.strictEqual(drill.alert_state,'AT_RISK');
assert.strictEqual(drill.drill_context.target,'TRANSACTION_EXPLORER');
assert.deepStrictEqual(drill.explorer_query.account_ids,['SYN-ACCOUNT']);
assert.deepStrictEqual(drill.explorer_query.types,['expense','refund']);
assert.strictEqual(drill.explorer_query.date_from,'2026-01-01');
assert.strictEqual(drill.explorer_query.date_to,'2026-02-01');
const drillText=JSON.stringify(drill); for(const forbidden of ['amount_minor','budget_minor','expense_minor','variance_minor','projection_minor','balance_minor']) assert(!drillText.includes(forbidden));

assert(/^[0-9a-f]{64}$/.test(view.telemetry.query_hash)); assert(/^[0-9a-f]{64}$/.test(view.telemetry.context_hash));
assert.deepStrictEqual(Object.keys(view.telemetry).sort(),['schema','version','query_hash','context_hash','total_days','elapsed_days','alert_state','status','reason_code'].sort());
const telemetryText=JSON.stringify(view.telemetry); for(const forbidden of ['100000','52542','50000','95161','SYN-ACCOUNT']) assert(!telemetryText.includes(forbidden));

const zeroPlan=budget.buildBudgetControl([],plan(0)); assert.strictEqual(zeroPlan.alert_state,'ON_TRACK'); assert.strictEqual(zeroPlan.projected_utilization_basis_points,null);
expectCode(()=>budget.normalizePlan({...plan(),as_of_exclusive:'2026-01-01'}),'BUD_AS_OF_OUT_OF_RANGE');
expectCode(()=>budget.normalizePlan({...plan(),budget_minor:-1}),'BUD_PLAN_AMOUNT_INVALID');
expectCode(()=>budget.normalizePlan({...plan(),unexpected:true}),'BUD_PLAN_INVALID');
expectCode(()=>budget.buildBudgetControl([tx('SYN-USD','2026-01-10','expense',1000,'SYN-HOME',{currency:'USD'})],plan()),'KPI_MIXED_CURRENCY_UNSUPPORTED');
expectCode(()=>budget.buildBudgetControl([tx('SYN-REFUND-ONLY','2026-01-10','refund',5000,'SYN-HOME',{adjustment_semantics:'expense_reduction'})],plan()),'BUD_NEGATIVE_FACT_UNSUPPORTED');
expectCode(()=>budget.buildBudgetDrill(view,{widget_id:'missing'}),'BUD_DRILL_WIDGET_UNKNOWN');

console.log('budget_control_contract_test: OK',{contract:`${CONTRACT.schema}@${CONTRACT.version}`,scope:normalized.scope_id,finParity:true,elapsedBudget:normalized.elapsed_budget_minor,alertStates:['ON_TRACK','AT_RISK','OVER_BUDGET'],projectionFinancialTruth:false,drillTarget:drill.drill_context.target,configurationOnlySpecs:true,publicTelemetryPayload:false,freeOnly:true,financialWriteAuthority:false});
