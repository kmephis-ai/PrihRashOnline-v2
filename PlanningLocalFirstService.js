/**
 * PLAN-REC-001 read-only planning source adapter for Local-first Product Ready.
 *
 * Owner-approved authority:
 * - 03 Бюджеты / Базовый / explicit period total rows only;
 * - 04 Регулярные / lossless recurrence only;
 * - 05 Обязательства / explicitly dated commitment payments only;
 * - 06 Баланс / explicit balance observations only.
 *
 * This service never creates financial transactions, never writes financial
 * source data, never infers a balance from Cash Flow and never invents a
 * recurrence cadence. Household values remain private runtime payload.
 */
var PRH_PLANNING_LOCAL_FIRST = Object.freeze({
  SCHEMA: 'PRH_PLANNING_LOCAL_FIRST_SYNC_V1',
  VERSION: '1.0.0',
  SOURCE_SCHEMA: 'PRH_LOCAL_PLANNING_SOURCE_V1',
  RESPONSE_SCHEMA: 'PRH_LOCAL_PLANNING_SYNC_RESPONSE_V1',
  BUDGET_SHEET: '03 Бюджеты',
  RECURRING_SHEET: '04 Регулярные',
  COMMITMENTS_SHEET: '05 Обязательства',
  BALANCE_SHEET: '06 Баланс',
  BUDGET_SCENARIO: 'Базовый',
  MAX_ROWS_PER_SOURCE: 2000,
  WRITE_AUTHORITY: false,
  AUTO_TRANSACTION_CREATION: false,
  CASH_FLOW_BALANCE_PROXY: false,
  FREE_ONLY: true,
  BALANCE_HEADERS: Object.freeze(['ID', 'Дата и время', 'Счёт', 'Валюта', 'Остаток', 'Метод', 'Комментарий'])
});

function prhPlanningFail_(reason) {
  var error = new Error(reason);
  error.code = reason;
  throw error;
}

function prhPlanningSafeReason_(error, fallback) {
  var value = String(error && (error.code || error.message) || fallback || 'PLANNING_SOURCE_UNAVAILABLE');
  var colon = value.indexOf(':');
  if (colon >= 0) value = value.slice(0, colon);
  return /^[A-Z][A-Z0-9_]{2,95}$/.test(value) ? value : (fallback || 'PLANNING_SOURCE_UNAVAILABLE');
}

function prhPlanningNormalizeRequest_(request) {
  var input = request == null ? {} : request;
  if (!input || typeof input !== 'object' || Array.isArray(input)) prhPlanningFail_('PLANNING_SYNC_REQUEST_INVALID');
  Object.keys(input).forEach(function(key) {
    if (['local_planning_revision', 'expected_canonical_revision'].indexOf(key) < 0) prhPlanningFail_('PLANNING_SYNC_REQUEST_FIELD_UNKNOWN');
  });
  function optionalHex(value, reason) {
    var text = String(value || '').trim().toLowerCase();
    if (text && !/^[0-9a-f]{64}$/.test(text)) prhPlanningFail_(reason);
    return text;
  }
  return Object.freeze({
    local_planning_revision: optionalHex(input.local_planning_revision, 'PLANNING_SYNC_LOCAL_REVISION_INVALID'),
    expected_canonical_revision: optionalHex(input.expected_canonical_revision, 'PLANNING_SYNC_CANONICAL_REVISION_INVALID')
  });
}

function prhPlanningTrim_(value) {
  return String(value == null ? '' : value).trim();
}

function prhPlanningSheetTimeZone_() {
  try {
    var book = getBook_();
    if (book && typeof book.getSpreadsheetTimeZone === 'function') return String(book.getSpreadsheetTimeZone() || 'Etc/UTC');
  } catch (error) {}
  return 'Etc/UTC';
}

function prhPlanningIsoDay_(value, reason) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    if (typeof Utilities !== 'undefined' && Utilities && typeof Utilities.formatDate === 'function') {
      return Utilities.formatDate(value, prhPlanningSheetTimeZone_(), 'yyyy-MM-dd');
    }
    return value.toISOString().slice(0, 10);
  }
  var text = prhPlanningTrim_(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) prhPlanningFail_(reason || 'PLANNING_DATE_INVALID');
  var parsed = new Date(text + 'T00:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) prhPlanningFail_(reason || 'PLANNING_DATE_INVALID');
  return text;
}

function prhPlanningInstant_(value, reason) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  var text = prhPlanningTrim_(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(text) || !Number.isFinite(Date.parse(text))) {
    prhPlanningFail_(reason || 'PLANNING_INSTANT_INVALID');
  }
  return text;
}

function prhPlanningAddDays_(day, count) {
  var parsed = new Date(prhPlanningIsoDay_(day, 'PLANNING_DATE_INVALID') + 'T00:00:00Z');
  parsed.setUTCDate(parsed.getUTCDate() + count);
  return parsed.toISOString().slice(0, 10);
}

function prhPlanningMonthPeriod_(value) {
  var text;
  if (value instanceof Date && Number.isFinite(value.getTime())) text = prhPlanningIsoDay_(value, 'PLANNING_BUDGET_PERIOD_INVALID').slice(0, 7);
  else text = prhPlanningTrim_(value);
  var match = /^(\d{4})-(\d{2})$/.exec(text);
  if (!match) {
    var alt = /^(\d{2})\.(\d{4})$/.exec(text);
    if (alt) match = [text, alt[2], alt[1]];
  }
  if (!match) {
    var day = /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
    if (day) match = [text, day.slice(0, 4), day.slice(5, 7)];
  }
  if (!match) prhPlanningFail_('PLANNING_BUDGET_PERIOD_UNSUPPORTED');
  var year = Number(match[1]);
  var month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) prhPlanningFail_('PLANNING_BUDGET_PERIOD_INVALID');
  var start = String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-01';
  var endDate = new Date(Date.UTC(year, month, 1));
  return Object.freeze({ start: start, end: endDate.toISOString().slice(0, 10), partial: false });
}

function prhPlanningMoneyMinor_(value, reason, allowNegative) {
  var number;
  if (typeof value === 'number') number = value;
  else {
    var text = prhPlanningTrim_(value).replace(/\s+/g, '').replace(',', '.');
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) prhPlanningFail_(reason || 'PLANNING_MONEY_INVALID');
    number = Number(text);
  }
  if (!Number.isFinite(number)) prhPlanningFail_(reason || 'PLANNING_MONEY_INVALID');
  var minor = Math.round(number * 100);
  if (!Number.isSafeInteger(minor) || Math.abs(number - minor / 100) > 1e-7 || (!allowNegative && minor < 0)) prhPlanningFail_(reason || 'PLANNING_MONEY_INVALID');
  return minor;
}

function prhPlanningBoolean_(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value === '') return false;
  var text = prhPlanningTrim_(value).toLowerCase();
  if (['true', 'да', 'истина', '1', 'активно'].indexOf(text) >= 0) return true;
  if (['false', 'нет', 'ложь', '0', 'неактивно'].indexOf(text) >= 0) return false;
  prhPlanningFail_('PLANNING_BOOLEAN_INVALID');
}

function prhPlanningReadTable_(name) {
  var book = getBook_();
  var sheet = book.getSheetByName(name);
  if (!sheet) return Object.freeze({ state: 'MISSING', name: name, headers: Object.freeze([]), rows: Object.freeze([]) });
  var lastRow = Math.max(1, Number(sheet.getLastRow() || 0));
  var lastColumn = Math.max(1, Number(sheet.getLastColumn() || 0));
  if (lastRow - 1 > PRH_PLANNING_LOCAL_FIRST.MAX_ROWS_PER_SOURCE) prhPlanningFail_('PLANNING_SOURCE_ROW_LIMIT_EXCEEDED');
  var values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  var headers = (values[0] || []).map(prhPlanningTrim_);
  if (!headers.length || headers.some(function(header) { return !header; }) || new Set(headers).size !== headers.length) prhPlanningFail_('PLANNING_SOURCE_HEADERS_INVALID');
  return Object.freeze({ state: 'READY', name: name, headers: Object.freeze(headers), rows: Object.freeze(values.slice(1)) });
}

function prhPlanningHeaderIndex_(table, required) {
  var index = {};
  table.headers.forEach(function(header, position) { index[header] = position; });
  required.forEach(function(header) { if (!Object.prototype.hasOwnProperty.call(index, header)) prhPlanningFail_('PLANNING_SOURCE_REQUIRED_HEADER_MISSING'); });
  return index;
}

function prhPlanningCell_(row, index, name) {
  return row[index[name]];
}

function prhPlanningCurrency_() {
  var currency = prhR2FinCurrency_();
  if (!/^[A-Z]{3}$/.test(currency)) prhPlanningFail_('PLANNING_CURRENCY_INVALID');
  return currency;
}

function prhPlanningBudgetSection_(currency) {
  var table;
  try { table = prhPlanningReadTable_(PRH_PLANNING_LOCAL_FIRST.BUDGET_SHEET); }
  catch (error) { return Object.freeze({ state: 'SOURCE_UNAVAILABLE', reason: prhPlanningSafeReason_(error, 'BUDGET_SOURCE_UNAVAILABLE'), plans: Object.freeze([]), unsupported_count: 0 }); }
  if (table.state === 'MISSING') return Object.freeze({ state: 'SOURCE_UNAVAILABLE', reason: 'BUDGET_SHEET_MISSING', plans: Object.freeze([]), unsupported_count: 0 });
  var index;
  try { index = prhPlanningHeaderIndex_(table, ['Период','Сценарий','Категория','Подкатегория','Проект','План']); }
  catch (error) { return Object.freeze({ state: 'SOURCE_SCHEMA_UNSUPPORTED', reason: 'BUDGET_SOURCE_SCHEMA_UNSUPPORTED', plans: Object.freeze([]), unsupported_count: table.rows.length }); }
  var plans = [];
  var unsupported = 0;
  table.rows.forEach(function(row) {
    var hasContent = row.some(function(value) { return prhPlanningTrim_(value) !== ''; });
    if (!hasContent) return;
    if (prhPlanningTrim_(prhPlanningCell_(row,index,'Сценарий')) !== PRH_PLANNING_LOCAL_FIRST.BUDGET_SCENARIO) return;
    if (prhPlanningTrim_(prhPlanningCell_(row,index,'Категория')) || prhPlanningTrim_(prhPlanningCell_(row,index,'Подкатегория')) || prhPlanningTrim_(prhPlanningCell_(row,index,'Проект'))) return;
    try {
      var period = prhPlanningMonthPeriod_(prhPlanningCell_(row,index,'Период'));
      var amount = prhPlanningMoneyMinor_(prhPlanningCell_(row,index,'План'), 'PLANNING_BUDGET_AMOUNT_INVALID', false);
      plans.push(Object.freeze({
        schema: 'PRH_BUDGET_PLAN_V1', version: '1.0.0', scope_id: 'TOTAL_EXPENSE_LINEAR_PERIOD_V1',
        currency: currency, period: period, budget_minor: amount
      }));
    } catch (error) { unsupported += 1; }
  });
  plans.sort(function(a,b) { return a.period.start.localeCompare(b.period.start); });
  return Object.freeze({ state: plans.length ? 'READY' : 'NOT_CONFIGURED', reason: plans.length ? null : 'BUDGET_EXPLICIT_TOTAL_NOT_CONFIGURED', plans: Object.freeze(plans), unsupported_count: unsupported });
}

function prhPlanningRecurringRecurrence_(periodicity, nextDate) {
  var period = prhPlanningTrim_(periodicity);
  var day = prhPlanningIsoDay_(nextDate, 'PLANNING_RECURRING_NEXT_DATE_INVALID');
  if (period === 'Разово') return Object.freeze({ kind: 'ONCE', due_date: day });
  if (period === 'Еженедельно') return Object.freeze({ kind: 'WEEKLY', anchor_date: day, interval_weeks: 1 });
  var months = { 'Ежемесячно': 1, 'Ежеквартально': 3, 'Ежегодно': 12 }[period];
  if (months) return Object.freeze({ kind: 'MONTHLY', anchor_date: day, interval_months: months, month_day_policy: 'CLAMP_TO_LAST_DAY' });
  prhPlanningFail_('PLANNING_RECURRING_PERIODICITY_UNSUPPORTED');
}

function prhPlanningRecurringSection_(currency) {
  var table;
  try { table = prhPlanningReadTable_(PRH_PLANNING_LOCAL_FIRST.RECURRING_SHEET); }
  catch (error) { return Object.freeze({ state:'SOURCE_UNAVAILABLE', reason:prhPlanningSafeReason_(error,'RECURRING_SOURCE_UNAVAILABLE'), plans:Object.freeze([]), unsupported_count:0 }); }
  if (table.state === 'MISSING') return Object.freeze({ state:'SOURCE_UNAVAILABLE', reason:'RECURRING_SHEET_MISSING', plans:Object.freeze([]), unsupported_count:0 });
  var index;
  try { index = prhPlanningHeaderIndex_(table,['ID','Активно','Наименование','Тип','Сумма','Периодичность','Следующая дата','Дата окончания']); }
  catch (error) { return Object.freeze({ state:'SOURCE_SCHEMA_UNSUPPORTED', reason:'RECURRING_SOURCE_SCHEMA_UNSUPPORTED', plans:Object.freeze([]), unsupported_count:table.rows.length }); }
  var plans=[]; var unsupported=0;
  table.rows.forEach(function(row) {
    if (!row.some(function(value){return prhPlanningTrim_(value)!=='';})) return;
    try {
      var id=prhPlanningTrim_(prhPlanningCell_(row,index,'ID'));
      if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(id)) prhPlanningFail_('PLANNING_RECURRING_ID_INVALID');
      var type=prhPlanningTrim_(prhPlanningCell_(row,index,'Тип'));
      var direction=type==='Доход'?'INFLOW':(type==='Расход'?'OUTFLOW':'');
      if(!direction) prhPlanningFail_('PLANNING_RECURRING_TYPE_UNSUPPORTED');
      var label=prhPlanningTrim_(prhPlanningCell_(row,index,'Наименование'));
      if(!label||label.length>120) prhPlanningFail_('PLANNING_RECURRING_LABEL_INVALID');
      var recurrence=prhPlanningRecurringRecurrence_(prhPlanningCell_(row,index,'Периодичность'),prhPlanningCell_(row,index,'Следующая дата'));
      var activeEnd=null;
      var rawEnd=prhPlanningCell_(row,index,'Дата окончания');
      if(prhPlanningTrim_(rawEnd)!=='') activeEnd=prhPlanningAddDays_(prhPlanningIsoDay_(rawEnd,'PLANNING_RECURRING_END_INVALID'),1);
      plans.push(Object.freeze({schema:'PRH_OBLIGATION_PLAN_V1',version:'1.0.0',plan_id:id,label:label,direction:direction,amount_minor:prhPlanningMoneyMinor_(prhPlanningCell_(row,index,'Сумма'),'PLANNING_RECURRING_AMOUNT_INVALID',false),currency:currency,enabled:prhPlanningBoolean_(prhPlanningCell_(row,index,'Активно')),active_end_exclusive:activeEnd,recurrence:recurrence,completed_due_dates:Object.freeze([])}));
    } catch(error) { unsupported+=1; }
  });
  plans.sort(function(a,b){return a.plan_id.localeCompare(b.plan_id);});
  return Object.freeze({state:plans.length?'READY':'EMPTY',reason:null,plans:Object.freeze(plans),unsupported_count:unsupported});
}

function prhPlanningCommitmentsSection_(currency) {
  var table;
  try { table=prhPlanningReadTable_(PRH_PLANNING_LOCAL_FIRST.COMMITMENTS_SHEET); }
  catch(error){return Object.freeze({state:'SOURCE_UNAVAILABLE',reason:prhPlanningSafeReason_(error,'COMMITMENT_SOURCE_UNAVAILABLE'),items:Object.freeze([]),unsupported_count:0});}
  if(table.state==='MISSING')return Object.freeze({state:'SOURCE_UNAVAILABLE',reason:'COMMITMENTS_SHEET_MISSING',items:Object.freeze([]),unsupported_count:0});
  var index;
  try{index=prhPlanningHeaderIndex_(table,['ID','Наименование','Обязательный платёж','Дата платежа']);}
  catch(error){return Object.freeze({state:'SOURCE_SCHEMA_UNSUPPORTED',reason:'COMMITMENTS_SOURCE_SCHEMA_UNSUPPORTED',items:Object.freeze([]),unsupported_count:table.rows.length});}
  var items=[];var unsupported=0;
  table.rows.forEach(function(row){
    if(!row.some(function(value){return prhPlanningTrim_(value)!=='';}))return;
    try{
      var id=prhPlanningTrim_(prhPlanningCell_(row,index,'ID'));if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(id))prhPlanningFail_('PLANNING_COMMITMENT_ID_INVALID');
      var label=prhPlanningTrim_(prhPlanningCell_(row,index,'Наименование'));if(!label||label.length>120)prhPlanningFail_('PLANNING_COMMITMENT_LABEL_INVALID');
      var rawDate=prhPlanningCell_(row,index,'Дата платежа');var rawAmount=prhPlanningCell_(row,index,'Обязательный платёж');
      if(prhPlanningTrim_(rawDate)===''||prhPlanningTrim_(rawAmount)==='')prhPlanningFail_('PLANNING_COMMITMENT_EXPLICIT_PAYMENT_REQUIRED');
      items.push(Object.freeze({commitment_id:id,label:label,due_date:prhPlanningIsoDay_(rawDate,'PLANNING_COMMITMENT_DATE_INVALID'),payment_minor:prhPlanningMoneyMinor_(rawAmount,'PLANNING_COMMITMENT_AMOUNT_INVALID',false),currency:currency,recurrence_inferred:false,canonical_transaction_created:false}));
    }catch(error){unsupported+=1;}
  });
  items.sort(function(a,b){return a.due_date.localeCompare(b.due_date)||a.commitment_id.localeCompare(b.commitment_id);});
  return Object.freeze({state:items.length?'READY':'EMPTY',reason:null,items:Object.freeze(items),unsupported_count:unsupported});
}

function prhPlanningBalanceCaptureMethod_(value) {
  var text=prhPlanningTrim_(value);
  if(text==='MANUAL_DECLARED'||text==='Ручной')return 'MANUAL_DECLARED';
  if(text==='STATEMENT_DECLARED'||text==='Выписка')return 'STATEMENT_DECLARED';
  prhPlanningFail_('PLANNING_BALANCE_CAPTURE_METHOD_UNSUPPORTED');
}

function prhPlanningLiquiditySection_(currency, canonicalSnapshot) {
  var table;
  try{table=prhPlanningReadTable_(PRH_PLANNING_LOCAL_FIRST.BALANCE_SHEET);}
  catch(error){return Object.freeze({state:'SOURCE_UNAVAILABLE',reason:prhPlanningSafeReason_(error,'BALANCE_SOURCE_UNAVAILABLE'),observations:Object.freeze([]),unsupported_count:0,expected_headers:PRH_PLANNING_LOCAL_FIRST.BALANCE_HEADERS});}
  if(table.state==='MISSING')return Object.freeze({state:'SETUP_REQUIRED',reason:'BALANCE_OBSERVATION_SHEET_MISSING',observations:Object.freeze([]),unsupported_count:0,expected_headers:PRH_PLANNING_LOCAL_FIRST.BALANCE_HEADERS});
  var index;
  try{index=prhPlanningHeaderIndex_(table,PRH_PLANNING_LOCAL_FIRST.BALANCE_HEADERS);}
  catch(error){return Object.freeze({state:'SOURCE_SCHEMA_UNSUPPORTED',reason:'BALANCE_SOURCE_SCHEMA_UNSUPPORTED',observations:Object.freeze([]),unsupported_count:table.rows.length,expected_headers:PRH_PLANNING_LOCAL_FIRST.BALANCE_HEADERS});}
  if(!canonicalSnapshot||!canonicalSnapshot.dimensions||!canonicalSnapshot.dimensions.resolvers||typeof canonicalSnapshot.dimensions.resolvers.account!=='function')prhPlanningFail_('PLANNING_BALANCE_ACCOUNT_RESOLVER_UNAVAILABLE');
  var observations=[];var unsupported=0;
  table.rows.forEach(function(row){
    if(!row.some(function(value){return prhPlanningTrim_(value)!=='';}))return;
    try{
      var id=prhPlanningTrim_(prhPlanningCell_(row,index,'ID'));if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id))prhPlanningFail_('PLANNING_BALANCE_ID_INVALID');
      var accountLabel=prhPlanningTrim_(prhPlanningCell_(row,index,'Счёт'));if(!accountLabel)prhPlanningFail_('PLANNING_BALANCE_ACCOUNT_REQUIRED');
      var rowCurrency=prhPlanningTrim_(prhPlanningCell_(row,index,'Валюта')).toUpperCase();if(rowCurrency!==currency)prhPlanningFail_('PLANNING_BALANCE_CURRENCY_MISMATCH');
      var observedAt=prhPlanningInstant_(prhPlanningCell_(row,index,'Дата и время'),'PLANNING_BALANCE_TIME_INVALID');
      var amount=prhPlanningMoneyMinor_(prhPlanningCell_(row,index,'Остаток'),'PLANNING_BALANCE_AMOUNT_INVALID',true);
      var method=prhPlanningBalanceCaptureMethod_(prhPlanningCell_(row,index,'Метод'));
      var accountId=canonicalSnapshot.dimensions.resolvers.account(accountLabel);
      var fingerprint=prhR2FinSha256Hex_(['PRH_BALANCE_OBSERVATION_SOURCE_V1',id,observedAt,accountId,rowCurrency,String(amount),method].join('|'));
      observations.push(Object.freeze({schema:'PRH_BALANCE_OBSERVATION_V1',version:'1.0.0',observation_id:id,account_id:accountId,currency:rowCurrency,observed_at:observedAt,balance_minor:amount,provenance:Object.freeze({source_system:'GOOGLE_SHEETS',source_record_id:id,source_fingerprint:fingerprint,capture_method:method,transform_version:'PLAN-REC-001-v1'})}));
    }catch(error){unsupported+=1;}
  });
  observations.sort(function(a,b){return a.observed_at.localeCompare(b.observed_at)||a.observation_id.localeCompare(b.observation_id);});
  return Object.freeze({state:observations.length?'READY':'EMPTY',reason:observations.length?null:'BALANCE_OBSERVATION_EMPTY',observations:Object.freeze(observations),unsupported_count:unsupported,expected_headers:PRH_PLANNING_LOCAL_FIRST.BALANCE_HEADERS});
}

function prhPlanningStable_(value) {
  if (Array.isArray(value)) return value.map(prhPlanningStable_);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce(function(out,key){out[key]=prhPlanningStable_(value[key]);return out;},{});
  return value;
}

function prhPlanningCreateSourceSnapshot_() {
  var canonical = prhR2DataCreateSnapshot_();
  if (!canonical || !Array.isArray(canonical.transactions) || !/^[0-9a-f]{64}$/.test(String(canonical.revision || ''))) prhPlanningFail_('PLANNING_CANONICAL_SNAPSHOT_INVALID');
  var currency = prhPlanningCurrency_();
  var sections = {
    budget: prhPlanningBudgetSection_(currency),
    recurring: prhPlanningRecurringSection_(currency),
    commitments: prhPlanningCommitmentsSection_(currency),
    liquidity: prhPlanningLiquiditySection_(currency, canonical)
  };
  var revisionMaterial = JSON.stringify(prhPlanningStable_({currency:currency,budget:sections.budget,recurring:sections.recurring,commitments:sections.commitments,liquidity:sections.liquidity}));
  var planningRevision = prhR2FinSha256Hex_('PRH_LOCAL_PLANNING_SOURCE_V1|' + revisionMaterial);
  return Object.freeze({schema:PRH_PLANNING_LOCAL_FIRST.SOURCE_SCHEMA,version:PRH_PLANNING_LOCAL_FIRST.VERSION,canonical_revision:String(canonical.revision).toLowerCase(),planning_revision:planningRevision,currency:currency,budget:sections.budget,recurring:sections.recurring,commitments:sections.commitments,liquidity:sections.liquidity});
}

function prhPlanningLocalFirstBootstrap(request) {
  var started=Date.now();
  var normalized=prhPlanningNormalizeRequest_(request);
  var source=prhPlanningCreateSourceSnapshot_();
  var samePlanning=normalized.local_planning_revision&&normalized.local_planning_revision===source.planning_revision;
  var sameCanonical=!normalized.expected_canonical_revision||normalized.expected_canonical_revision===source.canonical_revision;
  if(samePlanning&&sameCanonical){
    return Object.freeze({schema:PRH_PLANNING_LOCAL_FIRST.RESPONSE_SCHEMA,version:PRH_PLANNING_LOCAL_FIRST.VERSION,state:'NOOP',canonical_revision:source.canonical_revision,planning_revision:source.planning_revision,financial_write_authorized:false,canonical_mutation_performed:false,auto_transaction_creation:false,cash_flow_balance_proxy_used:false,telemetry:Object.freeze({status:'NOOP',duration_ms:Math.max(0,Date.now()-started),private_payload_in_telemetry:false})});
  }
  return Object.freeze({schema:PRH_PLANNING_LOCAL_FIRST.RESPONSE_SCHEMA,version:PRH_PLANNING_LOCAL_FIRST.VERSION,state:'FULL_SNAPSHOT',canonical_revision:source.canonical_revision,planning_revision:source.planning_revision,source:source,financial_write_authorized:false,canonical_mutation_performed:false,auto_transaction_creation:false,cash_flow_balance_proxy_used:false,telemetry:Object.freeze({status:'FULL_SNAPSHOT',duration_ms:Math.max(0,Date.now()-started),budget_state:source.budget.state,recurring_state:source.recurring.state,commitments_state:source.commitments.state,liquidity_state:source.liquidity.state,private_payload_in_telemetry:false})});
}

function prhPlanningLocalFirstBootstrapWire(request) {
  var result=prhPlanningLocalFirstBootstrap(request);
  var wire=JSON.stringify(result);
  if(!wire||wire.length>5000000)prhPlanningFail_('PLANNING_SYNC_WIRE_INVALID');
  return wire;
}

function prhPlanningLocalFirstHealthToken() {
  var source=prhPlanningCreateSourceSnapshot_();
  if(!source||source.schema!==PRH_PLANNING_LOCAL_FIRST.SOURCE_SCHEMA||!/^[0-9a-f]{64}$/.test(source.planning_revision)||!/^[0-9a-f]{64}$/.test(source.canonical_revision))prhPlanningFail_('PLANNING_HEALTH_INVALID');
  return 'PRH_PLANNING_LF_V1|OWNER_AUTHORITY|READ_ONLY|NO_CASHFLOW_BALANCE_PROXY|OK';
}
