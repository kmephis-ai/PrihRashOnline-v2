'use strict';

const crypto = require('crypto');
const CONTRACT = require('./income_analytics.v1.json');
const { DICTIONARY, evaluateKpis, normalizePeriod, assertComparablePeriods } = require('../finance/kpi_dictionary');
const { aggregateTransactions, normalizeTransaction } = require('../finance/financial_reconciliation');
const ANALYTICS = require('../analytics/analytics_contract.v1.json');
const viz = require('../visualization/visualization_foundation');
const explorer = require('../explorer/transaction_explorer');

const CONTRACT_SCHEMA = 'PRH_INCOME_ANALYTICS_V1';
const VERSION = '1.0.0';
const VIEW_SCHEMA = 'PRH_INCOME_ANALYTICS_VIEW_V1';
const DRILL_SCHEMA = 'PRH_INCOME_DRILL_ENVELOPE_V1';
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const GRAINS = new Set(CONTRACT.period.supported_trend_grains);

function fail(reason) { const error = new Error(reason); error.code = reason; throw error; }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.keys(value).sort().reduce((o,k)=>(o[k]=stable(value[k]),o),{}); return value; }
function sha256(value) { return crypto.createHash('sha256').update(String(value),'utf8').digest('hex'); }
function toDate(day, reason='INC_DATE_INVALID') { if (!ISO_DAY_RE.test(String(day||''))) fail(reason); const d=new Date(`${day}T00:00:00Z`); if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==day) fail(reason); return d; }
function isoDay(d) { return d.toISOString().slice(0,10); }
function addDays(day,n) { const d=toDate(day); d.setUTCDate(d.getUTCDate()+n); return isoDay(d); }
function addMonths(day,n) { const d=toDate(day); if (d.getUTCDate()!==1) fail('INC_TREND_MONTH_ALIGNMENT_REQUIRED'); d.setUTCMonth(d.getUTCMonth()+n); return isoDay(d); }
function addYears(day,n) { const d=toDate(day); if (d.getUTCMonth()!==0 || d.getUTCDate()!==1) fail('INC_TREND_YEAR_ALIGNMENT_REQUIRED'); d.setUTCFullYear(d.getUTCFullYear()+n); return isoDay(d); }

function assertContract() {
  if (CONTRACT.schema!==CONTRACT_SCHEMA || CONTRACT.version!==VERSION || CONTRACT.roadmap_id!=='INC-020') fail('INC_CONTRACT_VERSION_INVALID');
  if (CONTRACT.upstream.financial_truth!==DICTIONARY.financial_truth_policy || CONTRACT.upstream.kpi_dictionary!==`${DICTIONARY.schema}@${DICTIONARY.version}` || CONTRACT.upstream.analytics!==`${ANALYTICS.schema}@${ANALYTICS.version}` || CONTRACT.upstream.visualization!==`${viz.FOUNDATION_SCHEMA}@${viz.VERSION}` || CONTRACT.upstream.transaction_explorer!==`${explorer.CONTRACT.schema}@${explorer.CONTRACT.version}`) fail('INC_UPSTREAM_CONTRACT_INVALID');
  if (CONTRACT.measure!=='INCOME' || CONTRACT.source_dimension!=='category_id' || CONTRACT.source_mix.financial_semantics_source!=='FIN-010' || CONTRACT.source_mix.partition_must_equal_total!==true) fail('INC_FINANCIAL_AUTHORITY_INVALID');
  if (CONTRACT.period.comparison!=='EXPLICIT_EQUAL_DAY_WINDOWS_ONLY' || CONTRACT.period.implicit_proration!==false) fail('INC_COMPARISON_POLICY_INVALID');
  if (CONTRACT.stability.financial_formula_authority!==false || CONTRACT.drill.target!=='TRANSACTION_EXPLORER' || CONTRACT.drill.navigation_financial_payload!==false) fail('INC_DERIVED_POLICY_INVALID');
  if (CONTRACT.cost.mode!=='FREE_ONLY' || CONTRACT.cost.external_provider_required!==false || Object.values(CONTRACT.authority).some(Boolean)) fail('INC_AUTHORITY_INVALID');
  return true;
}

function explicitPeriod(input, reason) { if (!input) fail(reason); const p=normalizePeriod(input); if (p.kind!=='EXPLICIT_WINDOW') fail(reason); return p; }
function clonePeriod(p) { return Object.freeze({kind:p.kind,start:p.start,end:p.end,partial:p.partial===true,day_count:p.day_count,proration:p.proration}); }

function trendWindows(period, grain) {
  grain=String(grain||'MONTH').toUpperCase(); if (!GRAINS.has(grain)) fail('INC_TREND_GRAIN_UNSUPPORTED');
  if (grain==='MONTH') { if (toDate(period.start).getUTCDate()!==1 || toDate(period.end).getUTCDate()!==1) fail('INC_TREND_MONTH_ALIGNMENT_REQUIRED'); }
  if (grain==='YEAR') { for (const day of [period.start,period.end]) { const d=toDate(day); if (d.getUTCMonth()!==0 || d.getUTCDate()!==1) fail('INC_TREND_YEAR_ALIGNMENT_REQUIRED'); } }
  const limit=grain==='DAY'?400:grain==='MONTH'?120:20; const windows=[]; let cursor=period.start;
  while (cursor<period.end) { if (windows.length>=limit) fail('INC_TREND_BUCKET_LIMIT_EXCEEDED'); const candidate=grain==='DAY'?addDays(cursor,1):grain==='MONTH'?addMonths(cursor,1):addYears(cursor,1); const end=candidate>period.end?period.end:candidate; if (end<=cursor) fail('INC_TREND_WINDOW_INVALID'); windows.push(Object.freeze({start:cursor,end})); cursor=end; }
  if (!windows.length) fail('INC_TREND_EMPTY'); return Object.freeze(windows);
}
function bucketLabel(w,g) { return g==='DAY'?w.start:g==='MONTH'?w.start.slice(0,7):w.start.slice(0,4); }
function buildTrend(inputs,currency,period,grain) { const windows=trendWindows(period,grain); const points=windows.map(w=>{const k=evaluateKpis(inputs,{currency,period:{start:w.start,end:w.end,partial:false}}); return Object.freeze({time_bucket:bucketLabel(w,grain),start:w.start,end:w.end,income_minor:k.income_minor});}); return Object.freeze({grain,points:Object.freeze(points),sum_minor:points.reduce((s,p)=>s+p.income_minor,0),evaluation_count:points.length}); }

function scoped(inputs, period) { if (!Array.isArray(inputs)) fail('INC_TRANSACTIONS_INVALID'); return inputs.filter(raw=>{const tx=normalizeTransaction(raw); const day=tx.occurred_at.slice(0,10); return day>=period.start && day<period.end;}); }
function sourceMix(inputs, period, expectedTotal) {
  const groups=new Map();
  for (const raw of scoped(inputs,period)) { const tx=normalizeTransaction(raw); const source=String(tx.category_id||CONTRACT.unknown_source_label); if (!groups.has(source)) groups.set(source,[]); groups.get(source).push(raw); }
  const all=[...groups.entries()].map(([source,rows])=>Object.freeze({source_id:source,income_minor:aggregateTransactions(rows).income_minor}));
  const nonZero=all.filter(r=>r.income_minor!==0).sort((a,b)=>b.income_minor-a.income_minor||a.source_id.localeCompare(b.source_id));
  if (nonZero.some(r=>r.income_minor<0)) fail('INC_SOURCE_NEGATIVE_UNSUPPORTED');
  const sum=all.reduce((s,r)=>s+r.income_minor,0); if (sum!==expectedTotal) fail('INC_SOURCE_PARTITION_MISMATCH');
  return Object.freeze({rows:Object.freeze(nonZero),total_minor:sum,residual_minor:expectedTotal-sum,zero_source_count:all.length-nonZero.length});
}
function sourceDeltas(current, previous, expectedDelta) { const a=new Map(current.rows.map(r=>[r.source_id,r.income_minor])); const b=new Map(previous.rows.map(r=>[r.source_id,r.income_minor])); const ids=[...new Set([...a.keys(),...b.keys()])].sort(); const rows=ids.map(id=>Object.freeze({source_id:id,current_income_minor:a.get(id)||0,comparison_income_minor:b.get(id)||0,delta_minor:(a.get(id)||0)-(b.get(id)||0)})); const sum=rows.reduce((s,r)=>s+r.delta_minor,0); if (sum!==expectedDelta) fail('INC_SOURCE_DELTA_CONSERVATION_FAILED'); return Object.freeze({rows:Object.freeze(rows.filter(r=>r.delta_minor!==0).sort((x,y)=>Math.abs(y.delta_minor)-Math.abs(x.delta_minor)||x.source_id.localeCompare(y.source_id))),delta_minor:sum,zero_source_count:rows.filter(r=>r.delta_minor===0).length}); }

function stabilityFromTrend(trend) {
  const values=trend.points.map(p=>p.income_minor); if (!values.length) fail('INC_STABILITY_EMPTY');
  const sum=values.reduce((s,v)=>s+v,0); const mean=sum/values.length;
  const variance=values.reduce((s,v)=>s+Math.pow(v-mean,2),0)/values.length;
  const stddev=Math.sqrt(variance);
  if (![mean,variance,stddev].every(Number.isFinite)) fail('INC_STABILITY_NUMERIC_INVALID');
  if (mean===0) return Object.freeze({state:'NO_INCOME',bucket_count:values.length,mean_minor:0,variance_minor2:variance,stddev_minor:stddev,coefficient_of_variation:null,stability_score:null});
  const cv=stddev/Math.abs(mean); const score=Math.round(100-Math.min(100,cv*100));
  return Object.freeze({state:'READY',bucket_count:values.length,mean_minor:mean,variance_minor2:variance,stddev_minor:stddev,coefficient_of_variation:cv,stability_score:score});
}

function widgetSpecs() { return Object.freeze([
  ['income-trend','LINE','Динамика доходов','time_bucket','income-trend-query'],
  ['income-source-mix','DONUT','Источники доходов','category_id','income-source-query'],
  ['income-source-compare','BAR','Доходы по источникам','category_id','income-source-compare-query']
].map(([id,type,title,dimension,query])=>viz.normalizeWidgetSpec({schema:viz.WIDGET_SPEC_SCHEMA,contract_version:viz.VERSION,id,kind:'CHART',query_ref:query,chart_spec:{schema:viz.CHART_SPEC_SCHEMA,contract_version:viz.VERSION,id:`${id}-chart`,type,title,encoding:type==='DONUT'?{category:{kind:'DIMENSION',id:dimension},value:{kind:'MEASURE',id:'INCOME'}}:{x:{kind:'DIMENSION',id:dimension},y:{kind:'MEASURE',id:'INCOME'}},presentation:{legend:type==='DONUT',smooth:type==='LINE',show_labels:false},interactions:{filter:true,drill:true}}}))); }
function renderDatasets(trend,mix) { return Object.freeze({trend:Object.freeze({schema:viz.RENDER_DATASET_SCHEMA,contract_version:viz.VERSION,rows:Object.freeze(trend.points.map(p=>Object.freeze({dimensions:Object.freeze({time_bucket:p.time_bucket}),measures:Object.freeze({INCOME:p.income_minor})})))}),source_mix:Object.freeze({schema:viz.RENDER_DATASET_SCHEMA,contract_version:viz.VERSION,rows:Object.freeze(mix.rows.map(r=>Object.freeze({dimensions:Object.freeze({category_id:r.source_id}),measures:Object.freeze({INCOME:r.income_minor})})))}),source_compare:Object.freeze({schema:viz.RENDER_DATASET_SCHEMA,contract_version:viz.VERSION,rows:Object.freeze(mix.rows.map(r=>Object.freeze({dimensions:Object.freeze({category_id:r.source_id}),measures:Object.freeze({INCOME:r.income_minor})})))})}); }
function filterContext(input) { const n=viz.normalizeFilterContext(input||{schema:viz.FILTER_CONTEXT_SCHEMA,contract_version:viz.VERSION,filters:[]}); return Object.freeze({schema:n.schema,contract_version:n.contract_version,filters:Object.freeze(n.filters.map(f=>Object.freeze({kind:f.kind,field:f.field,operator:f.operator,values:Object.freeze(f.values.slice())}))),context_hash:n.context_hash}); }

function buildIncomeAnalytics(inputs, options={}) {
  assertContract(); const period=explicitPeriod(options.period,'INC_PRIMARY_PERIOD_REQUIRED'); const comparison=explicitPeriod(options.comparison_period,'INC_COMPARISON_PERIOD_REQUIRED'); assertComparablePeriods(options.period,options.comparison_period); const currency=String(options.currency||'').toUpperCase(); const grain=String(options.trend_grain||'MONTH').toUpperCase();
  const primary=evaluateKpis(inputs,{currency,period:options.period}); const previous=evaluateKpis(inputs,{currency,period:options.comparison_period}); if (primary.currency!==previous.currency) fail('INC_COMPARISON_CURRENCY_MISMATCH');
  const trend=buildTrend(inputs,currency,period,grain); if (trend.sum_minor!==primary.income_minor) fail('INC_TREND_TOTAL_PARITY_FAILED');
  const mix=sourceMix(inputs,period,primary.income_minor); const previousMix=sourceMix(inputs,comparison,previous.income_minor); const delta=primary.income_minor-previous.income_minor; const deltas=sourceDeltas(mix,previousMix,delta); const stability=stabilityFromTrend(trend); const context=filterContext(options.base_filter_context); const widgets=widgetSpecs();
  const queryHash=sha256(JSON.stringify(stable({currency,period:clonePeriod(period),comparison_period:clonePeriod(comparison),trend_grain:grain,context_hash:context.context_hash})));
  return Object.freeze({schema:VIEW_SCHEMA,contract_version:VERSION,currency,financial_truth_policy:primary.financial_truth_policy,kpi_dictionary_version:primary.dictionary_version,period:clonePeriod(period),comparison_period:clonePeriod(comparison),total_income_minor:primary.income_minor,comparison_income_minor:previous.income_minor,delta_minor:delta,trend,source_mix:mix,source_deltas:deltas,stability,filter_context:context,widgets,render_datasets:renderDatasets(trend,mix),telemetry:Object.freeze({schema:CONTRACT_SCHEMA,version:VERSION,query_hash:queryHash,context_hash:context.context_hash,bucket_count:trend.points.length,source_count:mix.rows.length,stability_state:stability.state,status:'OK',reason_code:null}),provenance:Object.freeze({primary_total:'FIN010_EVALUATE_KPIS',comparison_total:'FIN010_EVALUATE_KPIS',trend_bucket_totals:'FIN010_EVALUATE_KPIS',source_partition:'FIN_TRUTH_AGGREGATE_PER_CANONICAL_CATEGORY',stability_input:'FIN_BACKED_TREND_BUCKET_TOTALS',financial_formula_in_ui:false})});
}

function buildIncomeDrill(view, options={}) {
  assertContract(); if (!view || view.schema!==VIEW_SCHEMA || view.contract_version!==VERSION) fail('INC_DRILL_VIEW_INVALID'); const widgetId=String(options.widget_id||'income-source-mix'); if (!view.widgets.find(w=>w.id===widgetId)) fail('INC_DRILL_WIDGET_UNKNOWN'); const filters=view.filter_context.filters.map(f=>({kind:f.kind,field:f.field,operator:f.operator,values:f.values.slice()}));
  if (options.source_id!=null) { const source=String(options.source_id).trim(); if (!source) fail('INC_DRILL_SOURCE_INVALID'); const existing=filters.find(f=>f.field==='category_id'); if (existing) { if (existing.operator!=='INCLUDE') fail('INC_DRILL_FILTER_OPERATOR_UNSUPPORTED'); existing.values=[...new Set([...existing.values,source])].sort(); } else filters.push({kind:'DIMENSION',field:'category_id',operator:'INCLUDE',values:[source]}); }
  const context=viz.normalizeFilterContext({schema:viz.FILTER_CONTEXT_SCHEMA,contract_version:viz.VERSION,filters}); const drill=viz.normalizeDrillContext({schema:viz.DRILL_CONTEXT_SCHEMA,contract_version:viz.VERSION,source_widget_id:widgetId,target:'TRANSACTION_EXPLORER',filter_context:{schema:context.schema,contract_version:context.contract_version,filters:context.filters.map(f=>({kind:f.kind,field:f.field,operator:f.operator,values:f.values.slice()}))}});
  const query={date_from:view.period.start,date_to:view.period.end,offset:0,limit:50}; const map={account_id:'account_ids',category_id:'category_ids',member_id:'member_ids'}; for (const f of context.filters) { if (f.operator!=='INCLUDE' || !map[f.field]) fail('INC_DRILL_FILTER_UNSUPPORTED'); query[map[f.field]]=f.values.slice(); }
  return Object.freeze({schema:DRILL_SCHEMA,contract_version:VERSION,period:clonePeriod(view.period),drill_context:drill,explorer_query:explorer.normalizeQuery(query),financial_payload:false});
}

assertContract();
module.exports=Object.freeze({CONTRACT,CONTRACT_SCHEMA,VERSION,VIEW_SCHEMA,DRILL_SCHEMA,assertContract,trendWindows,stabilityFromTrend,widgetSpecs,buildIncomeAnalytics,buildIncomeDrill});
