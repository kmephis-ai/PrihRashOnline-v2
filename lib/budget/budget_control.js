'use strict';

const crypto = require('crypto');
const CONTRACT = require('./budget_control.v1.json');
const EXPENSE = require('../expense/expense_analytics.v1.json');
const VIZ_CONTRACT = require('../visualization/visualization_foundation.v1.json');
const { DICTIONARY, evaluateKpis, normalizePeriod } = require('../finance/kpi_dictionary');
const viz = require('../visualization/visualization_foundation');
const explorer = require('../explorer/transaction_explorer');

const CONTRACT_SCHEMA = 'PRH_BUDGET_CONTROL_V1';
const VERSION = '1.0.0';
const PLAN_SCHEMA = 'PRH_BUDGET_PLAN_V1';
const VIEW_SCHEMA = 'PRH_BUDGET_CONTROL_VIEW_V1';
const DRILL_SCHEMA = 'PRH_BUDGET_DRILL_ENVELOPE_V1';
const SCOPE_ID = 'TOTAL_EXPENSE_LINEAR_PERIOD_V1';
const CURRENCY_RE = /^[A-Z]{3}$/;
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(reason) { const error = new Error(reason); error.code = reason; throw error; }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out,key)=>(out[key]=stable(value[key]),out),{}); return value; }
function sha256(value) { return crypto.createHash('sha256').update(String(value),'utf8').digest('hex'); }
function toDate(day, reason='BUD_DATE_INVALID') { if (!ISO_DAY_RE.test(String(day||''))) fail(reason); const d=new Date(`${day}T00:00:00Z`); if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==day) fail(reason); return d; }
function dayNumber(day) { return Math.floor(toDate(day).getTime()/86400000); }
function safeInteger(value, reason) { if (!Number.isSafeInteger(value)) fail(reason); return value; }
function nonNegativeMinor(value, reason) { safeInteger(value,reason); if (value<0) fail(reason); return value; }

function roundHalfUpPositiveRatio(value, multiplier, denominator, reason='BUD_RATIO_INVALID') {
  nonNegativeMinor(value, reason); safeInteger(multiplier, reason); safeInteger(denominator, reason); if (multiplier<0 || denominator<=0) fail(reason);
  const n=BigInt(value)*BigInt(multiplier); const d=BigInt(denominator); const rounded=(n*2n+d)/(2n*d); const out=Number(rounded); if (!Number.isSafeInteger(out)) fail('BUD_RATIO_OVERFLOW'); return out;
}

function assertContract() {
  if (CONTRACT.schema!==CONTRACT_SCHEMA || CONTRACT.version!==VERSION || CONTRACT.roadmap_id!=='BUD-020') fail('BUD_CONTRACT_VERSION_INVALID');
  if (CONTRACT.upstream.financial_truth!==DICTIONARY.financial_truth_policy || CONTRACT.upstream.kpi_dictionary!==`${DICTIONARY.schema}@${DICTIONARY.version}` || CONTRACT.upstream.expense_analytics!==`${EXPENSE.schema}@${EXPENSE.version}` || CONTRACT.upstream.visualization!==`${VIZ_CONTRACT.schema}@${VIZ_CONTRACT.version}` || CONTRACT.upstream.transaction_explorer!==`${explorer.CONTRACT.schema}@${explorer.CONTRACT.version}`) fail('BUD_UPSTREAM_CONTRACT_INVALID');
  if (CONTRACT.schemas.plan!==PLAN_SCHEMA || CONTRACT.schemas.view!==VIEW_SCHEMA || CONTRACT.schemas.drill_envelope!==DRILL_SCHEMA) fail('BUD_SCHEMA_POLICY_INVALID');
  if (CONTRACT.scope.id!==SCOPE_ID || CONTRACT.scope.measure!=='EXPENSE' || CONTRACT.scope.implicit_proration!==false || CONTRACT.scope.category_allocation!==false || CONTRACT.scope.persistence!==false) fail('BUD_SCOPE_POLICY_INVALID');
  if (CONTRACT.alert_policy.id!=='BUDGET_ALERT_V1' || CONTRACT.alert_policy.at_risk_utilization_basis_points!==9500) fail('BUD_ALERT_POLICY_INVALID');
  if (!CONTRACT.invariants.fact_from_fin010 || !CONTRACT.invariants.elapsed_variance_from_fin010 || CONTRACT.invariants.projection_is_financial_truth!==false || CONTRACT.invariants.run_rate_is_financial_truth!==false || CONTRACT.invariants.liquidity_or_balance_authority!==false) fail('BUD_INVARIANT_POLICY_INVALID');
  if (CONTRACT.drill.target!=='TRANSACTION_EXPLORER' || CONTRACT.drill.navigation_financial_payload!==false || CONTRACT.drill.types.includes('transfer')) fail('BUD_DRILL_POLICY_INVALID');
  if (CONTRACT.cost.mode!=='FREE_ONLY' || CONTRACT.cost.external_provider_required!==false || Object.values(CONTRACT.authority).some(Boolean)) fail('BUD_AUTHORITY_INVALID');
  return true;
}

function normalizePlan(input) {
  if (!input || typeof input!=='object' || Array.isArray(input)) fail('BUD_PLAN_INVALID');
  const allowed=['schema','version','scope_id','currency','period','as_of_exclusive','budget_minor'];
  if (Object.keys(input).some(key=>!allowed.includes(key))) fail('BUD_PLAN_INVALID');
  if (input.schema!==PLAN_SCHEMA || input.version!==VERSION || input.scope_id!==SCOPE_ID) fail('BUD_PLAN_SCHEMA_INVALID');
  const currency=String(input.currency||'').toUpperCase(); if (!CURRENCY_RE.test(currency)) fail('BUD_PLAN_CURRENCY_INVALID');
  const period=normalizePeriod(input.period); if (period.kind!=='EXPLICIT_WINDOW') fail('BUD_PLAN_PERIOD_REQUIRED');
  const asOf=String(input.as_of_exclusive||''); toDate(asOf,'BUD_AS_OF_INVALID');
  if (asOf<=period.start || asOf>period.end) fail('BUD_AS_OF_OUT_OF_RANGE');
  const budgetMinor=nonNegativeMinor(input.budget_minor,'BUD_PLAN_AMOUNT_INVALID');
  const elapsedDays=dayNumber(asOf)-dayNumber(period.start); const totalDays=period.day_count; if (elapsedDays<=0 || elapsedDays>totalDays) fail('BUD_ELAPSED_DAYS_INVALID');
  const elapsedBudgetMinor=roundHalfUpPositiveRatio(budgetMinor,elapsedDays,totalDays,'BUD_ELAPSED_BUDGET_INVALID');
  return Object.freeze({schema:PLAN_SCHEMA,version:VERSION,scope_id:SCOPE_ID,currency,period:Object.freeze({start:period.start,end:period.end,partial:false}),as_of_exclusive:asOf,budget_minor:budgetMinor,total_days:totalDays,elapsed_days:elapsedDays,elapsed_budget_minor:elapsedBudgetMinor,rounding:'ROUND_HALF_UP_POSITIVE'});
}

function alertState(finVariance, utilizationBp) {
  safeInteger(finVariance,'BUD_VARIANCE_INVALID');
  if (finVariance<0) return 'OVER_BUDGET';
  if (utilizationBp!=null && utilizationBp>=CONTRACT.alert_policy.at_risk_utilization_basis_points) return 'AT_RISK';
  return 'ON_TRACK';
}
function widgetSpecs() { return Object.freeze([
  ['budget-fact','BAR','Расходы к текущей дате','EXPENSE','budget-fact-query'],
  ['budget-variance','BAR','Отклонение от elapsed budget','BUDGET_VARIANCE','budget-variance-query']
].map(([id,type,title,measure,queryRef])=>viz.normalizeWidgetSpec({schema:viz.WIDGET_SPEC_SCHEMA,contract_version:viz.VERSION,id,kind:'CHART',query_ref:queryRef,chart_spec:{schema:viz.CHART_SPEC_SCHEMA,contract_version:viz.VERSION,id:`${id}-chart`,type,title,encoding:{x:{kind:'DIMENSION',id:'time_bucket'},y:{kind:'MEASURE',id:measure}},presentation:{legend:false,show_labels:false},interactions:{filter:true,drill:true}}})));
}
function dataset(label,measure,value) { return Object.freeze({schema:viz.RENDER_DATASET_SCHEMA,contract_version:viz.VERSION,rows:Object.freeze([Object.freeze({dimensions:Object.freeze({time_bucket:label}),measures:Object.freeze({[measure]:value})})])}); }
function filterContext(input) { const n=viz.normalizeFilterContext(input||{schema:viz.FILTER_CONTEXT_SCHEMA,contract_version:viz.VERSION,filters:[]}); return Object.freeze({schema:n.schema,contract_version:n.contract_version,filters:Object.freeze(n.filters.map(f=>Object.freeze({kind:f.kind,field:f.field,operator:f.operator,values:Object.freeze(f.values.slice())}))),context_hash:n.context_hash}); }

function buildBudgetControl(inputs, planInput, options={}) {
  assertContract(); const plan=normalizePlan(planInput); const elapsedPeriod={start:plan.period.start,end:plan.as_of_exclusive,partial:false};
  const fin=evaluateKpis(inputs,{currency:plan.currency,period:elapsedPeriod,budget_minor:plan.elapsed_budget_minor});
  if (fin.budget_variance_minor!==plan.elapsed_budget_minor-fin.expense_minor) fail('BUD_FIN_VARIANCE_PARITY_FAILED');
  if (fin.expense_minor<0) fail('BUD_NEGATIVE_FACT_UNSUPPORTED');
  const projectedExpense=roundHalfUpPositiveRatio(fin.expense_minor,plan.total_days,plan.elapsed_days,'BUD_PROJECTION_INVALID');
  const projectedVariance=plan.budget_minor-projectedExpense; safeInteger(projectedVariance,'BUD_PROJECTED_VARIANCE_INVALID');
  let utilizationBp=null;
  if (plan.budget_minor===0) { if (projectedExpense>0 && fin.budget_variance_minor>=0) fail('BUD_ZERO_BUDGET_STATE_INVALID'); }
  else utilizationBp=roundHalfUpPositiveRatio(projectedExpense,10000,plan.budget_minor,'BUD_UTILIZATION_INVALID');
  const state=alertState(fin.budget_variance_minor,utilizationBp); const context=filterContext(options.base_filter_context); const widgets=widgetSpecs();
  const queryHash=sha256(JSON.stringify(stable({scope_id:plan.scope_id,currency:plan.currency,period:plan.period,as_of_exclusive:plan.as_of_exclusive,context_hash:context.context_hash})));
  return Object.freeze({schema:VIEW_SCHEMA,contract_version:VERSION,financial_truth_policy:fin.financial_truth_policy,kpi_dictionary_version:fin.dictionary_version,plan,elapsed_period:Object.freeze(elapsedPeriod),fact_expense_minor:fin.expense_minor,elapsed_budget_variance_minor:fin.budget_variance_minor,run_rate_projection_minor:projectedExpense,projected_variance_minor:projectedVariance,projected_utilization_basis_points:utilizationBp,alert_state:state,liquidity_state:'NOT_A_BALANCE_METRIC',account_balance_authority:false,filter_context:context,widgets,render_datasets:Object.freeze({fact:dataset('ELAPSED','EXPENSE',fin.expense_minor),variance:dataset('ELAPSED','BUDGET_VARIANCE',fin.budget_variance_minor)}),telemetry:Object.freeze({schema:CONTRACT_SCHEMA,version:VERSION,query_hash:queryHash,context_hash:context.context_hash,total_days:plan.total_days,elapsed_days:plan.elapsed_days,alert_state:state,status:'OK',reason_code:null}),provenance:Object.freeze({fact:'FIN010_EXPENSE',elapsed_variance:'FIN010_BUDGET_VARIANCE',elapsed_budget_scope:SCOPE_ID,projection:'DERIVED_RUN_RATE_NOT_FIN_TRUTH',financial_formula_in_ui:false})});
}

function buildBudgetDrill(view,options={}) {
  assertContract(); if (!view || view.schema!==VIEW_SCHEMA || view.contract_version!==VERSION) fail('BUD_DRILL_VIEW_INVALID'); const widgetId=String(options.widget_id||'budget-variance'); if (!view.widgets.find(w=>w.id===widgetId)) fail('BUD_DRILL_WIDGET_UNKNOWN'); const filters=view.filter_context.filters.map(f=>({kind:f.kind,field:f.field,operator:f.operator,values:f.values.slice()})); filters.push({kind:'DIMENSION',field:'type',operator:'INCLUDE',values:CONTRACT.drill.types.slice()}); const context=viz.normalizeFilterContext({schema:viz.FILTER_CONTEXT_SCHEMA,contract_version:viz.VERSION,filters}); const drill=viz.normalizeDrillContext({schema:viz.DRILL_CONTEXT_SCHEMA,contract_version:viz.VERSION,source_widget_id:widgetId,target:'TRANSACTION_EXPLORER',filter_context:{schema:context.schema,contract_version:context.contract_version,filters:context.filters.map(f=>({kind:f.kind,field:f.field,operator:f.operator,values:f.values.slice()}))}});
  const query={date_from:view.elapsed_period.start,date_to:view.elapsed_period.end,types:CONTRACT.drill.types.slice(),offset:0,limit:50}; const map={account_id:'account_ids',category_id:'category_ids',member_id:'member_ids'}; for (const f of view.filter_context.filters) { if (f.operator!=='INCLUDE' || !map[f.field]) fail('BUD_DRILL_FILTER_UNSUPPORTED'); query[map[f.field]]=f.values.slice(); }
  return Object.freeze({schema:DRILL_SCHEMA,contract_version:VERSION,alert_state:view.alert_state,period:Object.freeze({start:view.elapsed_period.start,end:view.elapsed_period.end}),drill_context:drill,explorer_query:explorer.normalizeQuery(query),financial_payload:false,budget_payload:false,liquidity_or_balance_payload:false});
}

assertContract();
module.exports=Object.freeze({CONTRACT,CONTRACT_SCHEMA,VERSION,PLAN_SCHEMA,VIEW_SCHEMA,DRILL_SCHEMA,SCOPE_ID,assertContract,roundHalfUpPositiveRatio,normalizePlan,alertState,widgetSpecs,buildBudgetControl,buildBudgetDrill});
