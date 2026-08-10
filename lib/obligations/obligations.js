'use strict';

const crypto = require('crypto');
const CONTRACT = require('./obligations.v1.json');
const CANONICAL = require('../domain/canonical_transaction.v1.schema.json');
const DESIGN = require('../design/design_system.v1.json');

const CONTRACT_SCHEMA = 'PRH_OBLIGATIONS_V1';
const VERSION = '1.0.0';
const PLAN_SCHEMA = 'PRH_OBLIGATION_PLAN_V1';
const OCCURRENCE_SCHEMA = 'PRH_OBLIGATION_OCCURRENCE_V1';
const VIEW_SCHEMA = 'PRH_OBLIGATIONS_VIEW_V1';
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const PLAN_ID_RE = /^[A-Za-z0-9._:-]{1,80}$/;
const DIRECTIONS = new Set(CONTRACT.planning.directions);
const RECURRENCE = new Set(CONTRACT.recurrence.supported);

function fail(reason) { const error = new Error(reason); error.code = reason; throw error; }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out,key)=>(out[key]=stable(value[key]),out),{}); return value; }
function sha256(value) { return crypto.createHash('sha256').update(String(value),'utf8').digest('hex'); }
function toDate(day, reason='OBL_DATE_INVALID') { if (!ISO_DAY_RE.test(String(day||''))) fail(reason); const d=new Date(`${day}T00:00:00Z`); if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==day) fail(reason); return d; }
function isoDay(date) { return date.toISOString().slice(0,10); }
function dayNumber(day) { return Math.floor(toDate(day).getTime()/86400000); }
function daysBetween(a,b) { return dayNumber(b)-dayNumber(a); }
function addDays(day,count) { const d=toDate(day); d.setUTCDate(d.getUTCDate()+count); return isoDay(d); }
function daysInMonth(year,month0) { return new Date(Date.UTC(year,month0+1,0)).getUTCDate(); }
function monthIndex(day) { const d=toDate(day); return d.getUTCFullYear()*12+d.getUTCMonth(); }
function clampedMonthDate(anchorDay,targetMonthIndex) { const anchor=toDate(anchorDay); const year=Math.floor(targetMonthIndex/12); const month=targetMonthIndex%12; const day=Math.min(anchor.getUTCDate(),daysInMonth(year,month)); return isoDay(new Date(Date.UTC(year,month,day))); }
function safeMinor(value, reason='OBL_AMOUNT_INVALID') { if (!Number.isSafeInteger(value) || value<0) fail(reason); return value; }

function assertContract() {
  if (CONTRACT.schema!==CONTRACT_SCHEMA || CONTRACT.version!==VERSION || CONTRACT.roadmap_id!=='OBL-020') fail('OBL_CONTRACT_VERSION_INVALID');
  if (CONTRACT.upstream.canonical_transaction!==CANONICAL.$id && CONTRACT.upstream.canonical_transaction!==CANONICAL.title) {
    if (CONTRACT.upstream.canonical_transaction!=='PRH_CANONICAL_TRANSACTION_V1') fail('OBL_CANONICAL_CONTRACT_INVALID');
  }
  if (CONTRACT.upstream.design_system!==`${DESIGN.schema}@${DESIGN.version}`) fail('OBL_DESIGN_CONTRACT_INVALID');
  if (CONTRACT.window.max_days!==366 || CONTRACT.window.upcoming_days!==30 || CONTRACT.window.max_occurrences!==256) fail('OBL_WINDOW_POLICY_INVALID');
  if (CONTRACT.recurrence.monthly_day_policy!=='CLAMP_TO_LAST_DAY' || CONTRACT.completion.fuzzy_transaction_matching!==false || CONTRACT.completion.auto_transaction_creation!==false) fail('OBL_RECURRENCE_POLICY_INVALID');
  if (CONTRACT.planning.amount_is_financial_truth!==false || CONTRACT.planning.forecast_is_financial_truth!==false || CONTRACT.planning.mixed_currency_view!=='FAIL_CLOSED') fail('OBL_PLANNING_POLICY_INVALID');
  if (CONTRACT.cost.mode!=='FREE_ONLY' || CONTRACT.cost.external_provider_required!==false || Object.values(CONTRACT.authority).some(Boolean)) fail('OBL_AUTHORITY_INVALID');
  return true;
}

function recurrenceAnchor(recurrence) { return recurrence.kind==='ONCE'?recurrence.due_date:recurrence.anchor_date; }

function normalizeRecurrence(input) {
  if (!input || typeof input!=='object' || Array.isArray(input)) fail('OBL_RECURRENCE_INVALID');
  const kind=String(input.kind||'').toUpperCase(); if (!RECURRENCE.has(kind)) fail('OBL_RECURRENCE_KIND_UNSUPPORTED');
  if (kind==='ONCE') {
    if (Object.keys(input).some(k=>!['kind','due_date'].includes(k))) fail('OBL_RECURRENCE_INVALID');
    const due=String(input.due_date||''); toDate(due,'OBL_DUE_DATE_INVALID');
    return Object.freeze({kind,due_date:due});
  }
  if (kind==='WEEKLY') {
    if (Object.keys(input).some(k=>!['kind','anchor_date','interval_weeks'].includes(k))) fail('OBL_RECURRENCE_INVALID');
    const anchor=String(input.anchor_date||''); toDate(anchor,'OBL_ANCHOR_DATE_INVALID');
    const interval=Number(input.interval_weeks); if (!Number.isInteger(interval) || interval<CONTRACT.recurrence.weekly_interval_min || interval>CONTRACT.recurrence.weekly_interval_max) fail('OBL_WEEKLY_INTERVAL_INVALID');
    return Object.freeze({kind,anchor_date:anchor,interval_weeks:interval});
  }
  if (Object.keys(input).some(k=>!['kind','anchor_date','interval_months','month_day_policy'].includes(k))) fail('OBL_RECURRENCE_INVALID');
  const anchor=String(input.anchor_date||''); toDate(anchor,'OBL_ANCHOR_DATE_INVALID');
  const interval=Number(input.interval_months); if (!Number.isInteger(interval) || interval<CONTRACT.recurrence.monthly_interval_min || interval>CONTRACT.recurrence.monthly_interval_max) fail('OBL_MONTHLY_INTERVAL_INVALID');
  if (input.month_day_policy!==CONTRACT.recurrence.monthly_day_policy) fail('OBL_MONTH_DAY_POLICY_INVALID');
  return Object.freeze({kind,anchor_date:anchor,interval_months:interval,month_day_policy:CONTRACT.recurrence.monthly_day_policy});
}

function recurrenceMatches(recurrence, dueDate) {
  toDate(dueDate,'OBL_COMPLETED_DATE_INVALID');
  const anchor=recurrenceAnchor(recurrence);
  if (dueDate<anchor) return false;
  if (recurrence.kind==='ONCE') return dueDate===recurrence.due_date;
  if (recurrence.kind==='WEEKLY') return daysBetween(anchor,dueDate)%(recurrence.interval_weeks*7)===0;
  const diff=monthIndex(dueDate)-monthIndex(anchor); if (diff<0 || diff%recurrence.interval_months!==0) return false;
  return clampedMonthDate(anchor,monthIndex(dueDate))===dueDate;
}

function normalizePlan(input) {
  if (!input || typeof input!=='object' || Array.isArray(input)) fail('OBL_PLAN_INVALID');
  const allowed=['schema','version','plan_id','label','direction','amount_minor','currency','enabled','active_end_exclusive','recurrence','completed_due_dates'];
  if (Object.keys(input).some(k=>!allowed.includes(k))) fail('OBL_PLAN_INVALID');
  if (input.schema!==PLAN_SCHEMA || input.version!==VERSION) fail('OBL_PLAN_SCHEMA_INVALID');
  const planId=String(input.plan_id||''); if (!PLAN_ID_RE.test(planId)) fail('OBL_PLAN_ID_INVALID');
  const label=String(input.label||'').trim(); if (!label || label.length>120) fail('OBL_LABEL_INVALID');
  const direction=String(input.direction||'').toUpperCase(); if (!DIRECTIONS.has(direction)) fail('OBL_DIRECTION_INVALID');
  const amount=safeMinor(input.amount_minor);
  const currency=String(input.currency||'').toUpperCase(); if (!CURRENCY_RE.test(currency)) fail('OBL_CURRENCY_INVALID');
  if (typeof input.enabled!=='boolean') fail('OBL_ENABLED_INVALID');
  const recurrence=normalizeRecurrence(input.recurrence);
  let activeEnd=null;
  if (input.active_end_exclusive!=null) { activeEnd=String(input.active_end_exclusive); toDate(activeEnd,'OBL_ACTIVE_END_INVALID'); if (activeEnd<=recurrenceAnchor(recurrence)) fail('OBL_ACTIVE_END_INVALID'); }
  const completed=Array.isArray(input.completed_due_dates)?input.completed_due_dates.slice():[];
  if (completed.length>256 || new Set(completed).size!==completed.length) fail('OBL_COMPLETED_DATES_INVALID');
  completed.forEach(day=>{ if (!recurrenceMatches(recurrence,day)) fail('OBL_COMPLETED_DATE_NOT_OCCURRENCE'); if (activeEnd && day>=activeEnd) fail('OBL_COMPLETED_DATE_OUTSIDE_ACTIVE_RANGE'); });
  completed.sort();
  return Object.freeze({schema:PLAN_SCHEMA,version:VERSION,plan_id:planId,label,direction,amount_minor:amount,currency,enabled:input.enabled,active_end_exclusive:activeEnd,recurrence,completed_due_dates:Object.freeze(completed)});
}

function normalizeWindow(options={}) {
  const start=String(options.window_start||''); const asOf=String(options.as_of||''); const end=String(options.window_end||'');
  toDate(start,'OBL_WINDOW_START_INVALID'); toDate(asOf,'OBL_AS_OF_INVALID'); toDate(end,'OBL_WINDOW_END_INVALID');
  if (start>asOf || asOf>=end || start>=end) fail('OBL_WINDOW_INVALID');
  const span=daysBetween(start,end); if (span<=0 || span>CONTRACT.window.max_days) fail('OBL_WINDOW_TOO_LARGE');
  return Object.freeze({start,as_of:asOf,end,day_count:span,upcoming_days:CONTRACT.window.upcoming_days});
}

function firstWeeklyIndex(anchor,start,stepDays) { const diff=daysBetween(anchor,start); if (diff<=0) return 0; return Math.ceil(diff/stepDays); }
function firstMonthlyIndex(anchor,start,interval) {
  const diff=Math.max(0,monthIndex(start)-monthIndex(anchor)); let index=Math.floor(diff/interval); let due=clampedMonthDate(anchor,monthIndex(anchor)+index*interval); if (due<start) index+=1; return index;
}

function dueDatesInWindow(plan, window) {
  if (!plan.enabled) return Object.freeze([]);
  const completed=new Set(plan.completed_due_dates); const dates=[]; const rec=plan.recurrence; const activeEnd=plan.active_end_exclusive;
  function accept(day) { if (day<window.start || day>=window.end) return; if (activeEnd && day>=activeEnd) return; if (!completed.has(day)) dates.push(day); }
  if (rec.kind==='ONCE') accept(rec.due_date);
  else if (rec.kind==='WEEKLY') {
    const step=rec.interval_weeks*7; let i=firstWeeklyIndex(rec.anchor_date,window.start,step);
    while (dates.length<=CONTRACT.window.max_occurrences) { const due=addDays(rec.anchor_date,i*step); if (due>=window.end || (activeEnd&&due>=activeEnd)) break; accept(due); i+=1; }
  } else {
    let i=firstMonthlyIndex(rec.anchor_date,window.start,rec.interval_months);
    while (dates.length<=CONTRACT.window.max_occurrences) { const due=clampedMonthDate(rec.anchor_date,monthIndex(rec.anchor_date)+i*rec.interval_months); if (due>=window.end || (activeEnd&&due>=activeEnd)) break; accept(due); i+=1; }
  }
  if (dates.length>CONTRACT.window.max_occurrences) fail('OBL_OCCURRENCE_LIMIT_EXCEEDED');
  return Object.freeze(dates.sort());
}

function classifyState(dueDate, window) {
  if (dueDate<window.as_of) return 'OVERDUE';
  if (dueDate===window.as_of) return 'DUE';
  return daysBetween(window.as_of,dueDate)<=window.upcoming_days?'UPCOMING':'FORECAST';
}
function occurrenceId(planId,dueDate) { return sha256(`${OCCURRENCE_SCHEMA}|${planId}|${dueDate}`); }

function buildObligations(plansInput, options={}) {
  assertContract(); if (!Array.isArray(plansInput)) fail('OBL_PLANS_INVALID'); if (plansInput.length>128) fail('OBL_PLAN_LIMIT_EXCEEDED');
  const plans=plansInput.map(normalizePlan); const ids=plans.map(p=>p.plan_id); if (new Set(ids).size!==ids.length) fail('OBL_PLAN_ID_DUPLICATE'); const window=normalizeWindow(options);
  const occurrences=[];
  for (const plan of plans) {
    for (const due of dueDatesInWindow(plan,window)) {
      occurrences.push(Object.freeze({schema:OCCURRENCE_SCHEMA,contract_version:VERSION,occurrence_id:occurrenceId(plan.plan_id,due),plan_id:plan.plan_id,label:plan.label,direction:plan.direction,amount_minor:plan.amount_minor,currency:plan.currency,due_date:due,state:classifyState(due,window),planning_only:true,canonical_transaction_created:false}));
      if (occurrences.length>CONTRACT.window.max_occurrences) fail('OBL_OCCURRENCE_LIMIT_EXCEEDED');
    }
  }
  occurrences.sort((a,b)=>a.due_date.localeCompare(b.due_date)||a.direction.localeCompare(b.direction)||a.plan_id.localeCompare(b.plan_id));
  const currencies=[...new Set(occurrences.map(o=>o.currency))].sort(); if (currencies.length>1) fail('OBL_MIXED_CURRENCY_UNSUPPORTED');
  const stateCounts={OVERDUE:0,DUE:0,UPCOMING:0,FORECAST:0}; const planningTotals={INFLOW:0,OUTFLOW:0};
  for (const item of occurrences) { stateCounts[item.state]+=1; planningTotals[item.direction]+=item.amount_minor; if (!Number.isSafeInteger(planningTotals[item.direction])) fail('OBL_PLANNING_TOTAL_OVERFLOW'); }
  const queryHash=sha256(JSON.stringify(stable({window,plans:plans.map(p=>({plan_id:p.plan_id,direction:p.direction,currency:p.currency,enabled:p.enabled,active_end_exclusive:p.active_end_exclusive,recurrence:p.recurrence,completed_due_dates:p.completed_due_dates}))})));
  return Object.freeze({schema:VIEW_SCHEMA,contract_version:VERSION,window,currency:currencies[0]||null,occurrences:Object.freeze(occurrences),state_counts:Object.freeze(stateCounts),planning_totals_minor:Object.freeze(planningTotals),planning_only:true,financial_truth:false,canonical_transaction_created:false,telemetry:Object.freeze({schema:CONTRACT_SCHEMA,version:VERSION,query_hash:queryHash,plan_count:plans.length,occurrence_count:occurrences.length,state_count:Object.freeze({...stateCounts}),status:'OK',reason_code:null}),provenance:Object.freeze({recurrence:'PRH_OBLIGATIONS_V1',completion:'EXPLICIT_COMPLETED_DUE_DATES',transaction_matching:'NONE',auto_transaction_creation:false})});
}

assertContract();
module.exports=Object.freeze({CONTRACT,CONTRACT_SCHEMA,VERSION,PLAN_SCHEMA,OCCURRENCE_SCHEMA,VIEW_SCHEMA,assertContract,normalizeRecurrence,recurrenceMatches,normalizePlan,normalizeWindow,dueDatesInWindow,classifyState,occurrenceId,buildObligations});
