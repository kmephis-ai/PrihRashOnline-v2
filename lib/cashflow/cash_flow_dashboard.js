'use strict';

const crypto = require('crypto');
const CONTRACT = require('./cash_flow_dashboard.v1.json');
const HOME = require('../home/financial_home.v1.json');
const { DICTIONARY, evaluateKpis, normalizePeriod, assertComparablePeriods } = require('../finance/kpi_dictionary');
const VIZ_CONTRACT = require('../visualization/visualization_foundation.v1.json');
const viz = require('../visualization/visualization_foundation');
const explorer = require('../explorer/transaction_explorer');

const CONTRACT_SCHEMA = 'PRH_CASH_FLOW_DASHBOARD_V1';
const VERSION = '1.0.0';
const VIEW_SCHEMA = 'PRH_CASH_FLOW_VIEW_V1';
const DRILL_SCHEMA = 'PRH_CASH_FLOW_DRILL_ENVELOPE_V1';
const GRAINS = new Set(CONTRACT.period.supported_grains);
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(reason) { const error = new Error(reason); error.code = reason; throw error; }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out,key)=>(out[key]=stable(value[key]),out),{}); return value; }
function sha256(value) { return crypto.createHash('sha256').update(String(value),'utf8').digest('hex'); }
function toDate(day, reason='CF_DATE_INVALID') { if (!ISO_DAY_RE.test(String(day||''))) fail(reason); const d=new Date(`${day}T00:00:00Z`); if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==day) fail(reason); return d; }
function isoDay(d) { return d.toISOString().slice(0,10); }
function addDays(day,n) { const d=toDate(day); d.setUTCDate(d.getUTCDate()+n); return isoDay(d); }
function addMonths(day,n) { const d=toDate(day); if (d.getUTCDate()!==1) fail('CF_TREND_MONTH_ALIGNMENT_REQUIRED'); d.setUTCMonth(d.getUTCMonth()+n); return isoDay(d); }
function addYears(day,n) { const d=toDate(day); if (d.getUTCMonth()!==0 || d.getUTCDate()!==1) fail('CF_TREND_YEAR_ALIGNMENT_REQUIRED'); d.setUTCFullYear(d.getUTCFullYear()+n); return isoDay(d); }

function assertContract() {
  if (CONTRACT.schema!==CONTRACT_SCHEMA || CONTRACT.version!==VERSION || CONTRACT.roadmap_id!=='CF-020') fail('CF_CONTRACT_VERSION_INVALID');
  if (CONTRACT.upstream.financial_truth!==DICTIONARY.financial_truth_policy || CONTRACT.upstream.kpi_dictionary!==`${DICTIONARY.schema}@${DICTIONARY.version}` || CONTRACT.upstream.financial_home!==`${HOME.schema}@${HOME.version}` || CONTRACT.upstream.visualization!==`${VIZ_CONTRACT.schema}@${VIZ_CONTRACT.version}` || CONTRACT.upstream.transaction_explorer!==`${explorer.CONTRACT.schema}@${explorer.CONTRACT.version}`) fail('CF_UPSTREAM_CONTRACT_INVALID');
  if (CONTRACT.measures.inflow!=='INCOME' || CONTRACT.measures.outflow!=='EXPENSE' || CONTRACT.measures.net!=='CASH_FLOW') fail('CF_MEASURE_POLICY_INVALID');
  if (!CONTRACT.invariants.net_equals_inflow_minus_outflow || !CONTRACT.invariants.transfer_neutral || CONTRACT.invariants.liquidity_or_balance_authority!==false || !CONTRACT.invariants.bucket_totals_equal_period_totals) fail('CF_INVARIANT_POLICY_INVALID');
  if (CONTRACT.period.comparison!=='EXPLICIT_EQUAL_DAY_WINDOWS_ONLY' || CONTRACT.period.implicit_proration!==false) fail('CF_COMPARISON_POLICY_INVALID');
  if (CONTRACT.drill.target!=='TRANSACTION_EXPLORER' || CONTRACT.drill.transfer_included!==false || CONTRACT.drill.navigation_financial_payload!==false) fail('CF_DRILL_POLICY_INVALID');
  if (CONTRACT.cost.mode!=='FREE_ONLY' || CONTRACT.cost.external_provider_required!==false || Object.values(CONTRACT.authority).some(Boolean)) fail('CF_AUTHORITY_INVALID');
  return true;
}
function explicitPeriod(input, reason) { if (!input) fail(reason); const p=normalizePeriod(input); if (p.kind!=='EXPLICIT_WINDOW') fail(reason); return p; }
function clonePeriod(p) { return Object.freeze({kind:p.kind,start:p.start,end:p.end,partial:p.partial===true,day_count:p.day_count,proration:p.proration}); }
function assertPoint(point) { if (point.inflow_minor-point.outflow_minor!==point.net_minor) fail('CF_NET_IDENTITY_FAILED'); return point; }

function trendWindows(period, grain) {
  grain=String(grain||'MONTH').toUpperCase(); if (!GRAINS.has(grain)) fail('CF_TREND_GRAIN_UNSUPPORTED');
  if (grain==='MONTH' && (toDate(period.start).getUTCDate()!==1 || toDate(period.end).getUTCDate()!==1)) fail('CF_TREND_MONTH_ALIGNMENT_REQUIRED');
  if (grain==='YEAR') for (const day of [period.start,period.end]) { const d=toDate(day); if (d.getUTCMonth()!==0 || d.getUTCDate()!==1) fail('CF_TREND_YEAR_ALIGNMENT_REQUIRED'); }
  const limit=grain==='DAY'?400:grain==='MONTH'?120:20; const windows=[]; let cursor=period.start;
  while (cursor<period.end) { if (windows.length>=limit) fail('CF_TREND_BUCKET_LIMIT_EXCEEDED'); const candidate=grain==='DAY'?addDays(cursor,1):grain==='MONTH'?addMonths(cursor,1):addYears(cursor,1); const end=candidate>period.end?period.end:candidate; if (end<=cursor) fail('CF_TREND_WINDOW_INVALID'); windows.push(Object.freeze({start:cursor,end})); cursor=end; }
  if (!windows.length) fail('CF_TREND_EMPTY'); return Object.freeze(windows);
}
function bucketLabel(w,g) { return g==='DAY'?w.start:g==='MONTH'?w.start.slice(0,7):w.start.slice(0,4); }
function finPoint(inputs,currency,period,label) { const k=evaluateKpis(inputs,{currency,period:{start:period.start,end:period.end,partial:false}}); return Object.freeze(assertPoint({time_bucket:label,start:period.start,end:period.end,inflow_minor:k.income_minor,outflow_minor:k.expense_minor,net_minor:k.cash_flow_minor})); }
function buildTrend(inputs,currency,period,grain) { const points=trendWindows(period,grain).map(w=>finPoint(inputs,currency,w,bucketLabel(w,grain))); return Object.freeze({grain,points:Object.freeze(points),inflow_sum_minor:points.reduce((s,p)=>s+p.inflow_minor,0),outflow_sum_minor:points.reduce((s,p)=>s+p.outflow_minor,0),net_sum_minor:points.reduce((s,p)=>s+p.net_minor,0),evaluation_count:points.length}); }
function comparison(primary,previous) { const result=Object.freeze({inflow_delta_minor:primary.income_minor-previous.income_minor,outflow_delta_minor:primary.expense_minor-previous.expense_minor,net_delta_minor:primary.cash_flow_minor-previous.cash_flow_minor}); if (result.inflow_delta_minor-result.outflow_delta_minor!==result.net_delta_minor) fail('CF_COMPARISON_DELTA_IDENTITY_FAILED'); return result; }

function widgetSpecs() {
  const defs=[
    ['cash-flow-net-trend','LINE','Чистый денежный поток','CASH_FLOW','cash-flow-net-trend-query'],
    ['cash-flow-inflow-trend','BAR','Приток','INCOME','cash-flow-inflow-trend-query'],
    ['cash-flow-outflow-trend','BAR','Отток','EXPENSE','cash-flow-outflow-trend-query'],
    ['cash-flow-compare','BAR','Сравнение net cash flow','CASH_FLOW','cash-flow-compare-query']
  ];
  return Object.freeze(defs.map(([id,type,title,measure,queryRef])=>viz.normalizeWidgetSpec({schema:viz.WIDGET_SPEC_SCHEMA,contract_version:viz.VERSION,id,kind:'CHART',query_ref:queryRef,chart_spec:{schema:viz.CHART_SPEC_SCHEMA,contract_version:viz.VERSION,id:`${id}-chart`,type,title,encoding:{x:{kind:'DIMENSION',id:'time_bucket'},y:{kind:'MEASURE',id:measure}},presentation:{legend:false,smooth:type==='LINE',show_labels:false},interactions:{filter:true,drill:true}}})));
}
function dataset(rows, measure, selector) { return Object.freeze({schema:viz.RENDER_DATASET_SCHEMA,contract_version:viz.VERSION,rows:Object.freeze(rows.map(row=>Object.freeze({dimensions:Object.freeze({time_bucket:row.time_bucket}),measures:Object.freeze({[measure]:selector(row)})})))}); }
function renderDatasets(trend,primary,previous) { const compareRows=[Object.freeze({time_bucket:'CURRENT',net_minor:primary.cash_flow_minor}),Object.freeze({time_bucket:'COMPARISON',net_minor:previous.cash_flow_minor})]; return Object.freeze({net:dataset(trend.points,'CASH_FLOW',r=>r.net_minor),inflow:dataset(trend.points,'INCOME',r=>r.inflow_minor),outflow:dataset(trend.points,'EXPENSE',r=>r.outflow_minor),compare:dataset(compareRows,'CASH_FLOW',r=>r.net_minor)}); }
function filterContext(input) { const n=viz.normalizeFilterContext(input||{schema:viz.FILTER_CONTEXT_SCHEMA,contract_version:viz.VERSION,filters:[]}); return Object.freeze({schema:n.schema,contract_version:n.contract_version,filters:Object.freeze(n.filters.map(f=>Object.freeze({kind:f.kind,field:f.field,operator:f.operator,values:Object.freeze(f.values.slice())}))),context_hash:n.context_hash}); }

function buildCashFlowDashboard(inputs,options={}) {
  assertContract(); const period=explicitPeriod(options.period,'CF_PRIMARY_PERIOD_REQUIRED'); const previousPeriod=explicitPeriod(options.comparison_period,'CF_COMPARISON_PERIOD_REQUIRED'); assertComparablePeriods(options.period,options.comparison_period); const currency=String(options.currency||'').toUpperCase(); const grain=String(options.grain||'MONTH').toUpperCase();
  const primary=evaluateKpis(inputs,{currency,period:options.period}); const previous=evaluateKpis(inputs,{currency,period:options.comparison_period}); if (primary.currency!==previous.currency) fail('CF_COMPARISON_CURRENCY_MISMATCH'); assertPoint({inflow_minor:primary.income_minor,outflow_minor:primary.expense_minor,net_minor:primary.cash_flow_minor}); assertPoint({inflow_minor:previous.income_minor,outflow_minor:previous.expense_minor,net_minor:previous.cash_flow_minor});
  const trend=buildTrend(inputs,currency,period,grain); if (trend.inflow_sum_minor!==primary.income_minor || trend.outflow_sum_minor!==primary.expense_minor || trend.net_sum_minor!==primary.cash_flow_minor) fail('CF_TREND_TOTAL_PARITY_FAILED');
  const deltas=comparison(primary,previous); const context=filterContext(options.base_filter_context); const widgets=widgetSpecs(); const queryHash=sha256(JSON.stringify(stable({currency,period:clonePeriod(period),comparison_period:clonePeriod(previousPeriod),grain,context_hash:context.context_hash})));
  return Object.freeze({schema:VIEW_SCHEMA,contract_version:VERSION,currency,financial_truth_policy:primary.financial_truth_policy,kpi_dictionary_version:primary.dictionary_version,period:clonePeriod(period),comparison_period:clonePeriod(previousPeriod),inflow_minor:primary.income_minor,outflow_minor:primary.expense_minor,net_minor:primary.cash_flow_minor,comparison:Object.freeze({inflow_minor:previous.income_minor,outflow_minor:previous.expense_minor,net_minor:previous.cash_flow_minor,...deltas}),trend,liquidity_state:'NOT_A_BALANCE_METRIC',account_balance_authority:false,filter_context:context,widgets,render_datasets:renderDatasets(trend,primary,previous),telemetry:Object.freeze({schema:CONTRACT_SCHEMA,version:VERSION,query_hash:queryHash,context_hash:context.context_hash,bucket_count:trend.points.length,status:'OK',reason_code:null}),provenance:Object.freeze({inflow:'FIN010_INCOME',outflow:'FIN010_EXPENSE',net:'FIN010_CASH_FLOW',trend_buckets:'FIN010_EVALUATE_KPIS',transfer_neutral:true,liquidity_proxy:false,financial_formula_in_ui:false})});
}

function buildCashFlowDrill(view,options={}) {
  assertContract(); if (!view || view.schema!==VIEW_SCHEMA || view.contract_version!==VERSION) fail('CF_DRILL_VIEW_INVALID'); const component=String(options.component||'NET').toUpperCase(); const types=CONTRACT.drill.component_types[component]; if (!types) fail('CF_DRILL_COMPONENT_UNKNOWN'); if (types.includes('transfer')) fail('CF_DRILL_TRANSFER_FORBIDDEN'); const widgetId=String(options.widget_id||'cash-flow-net-trend'); if (!view.widgets.find(w=>w.id===widgetId)) fail('CF_DRILL_WIDGET_UNKNOWN');
  const filters=view.filter_context.filters.map(f=>({kind:f.kind,field:f.field,operator:f.operator,values:f.values.slice()})); filters.push({kind:'DIMENSION',field:'type',operator:'INCLUDE',values:types.slice()}); const context=viz.normalizeFilterContext({schema:viz.FILTER_CONTEXT_SCHEMA,contract_version:viz.VERSION,filters}); const drill=viz.normalizeDrillContext({schema:viz.DRILL_CONTEXT_SCHEMA,contract_version:viz.VERSION,source_widget_id:widgetId,target:'TRANSACTION_EXPLORER',filter_context:{schema:context.schema,contract_version:context.contract_version,filters:context.filters.map(f=>({kind:f.kind,field:f.field,operator:f.operator,values:f.values.slice()}))}});
  const query={date_from:view.period.start,date_to:view.period.end,types:types.slice(),offset:0,limit:50}; const map={account_id:'account_ids',category_id:'category_ids',member_id:'member_ids'}; for (const f of view.filter_context.filters) { if (f.operator!=='INCLUDE' || !map[f.field]) fail('CF_DRILL_FILTER_UNSUPPORTED'); query[map[f.field]]=f.values.slice(); }
  return Object.freeze({schema:DRILL_SCHEMA,contract_version:VERSION,component,period:clonePeriod(view.period),drill_context:drill,explorer_query:explorer.normalizeQuery(query),financial_payload:false,liquidity_or_balance_payload:false});
}

assertContract();
module.exports=Object.freeze({CONTRACT,CONTRACT_SCHEMA,VERSION,VIEW_SCHEMA,DRILL_SCHEMA,assertContract,trendWindows,widgetSpecs,buildCashFlowDashboard,buildCashFlowDrill});
