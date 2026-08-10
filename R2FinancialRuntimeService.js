/**
 * UI-MIG-020 read-only runtime projection for the canonical Financial Home.
 *
 * This is not a new financial authority. Machine contract tests compare its
 * outputs with `FIN-TRUTH-v1` / `PRH_KPI_DICTIONARY_V1@1.0.0` over synthetic
 * adversarial fixtures before any candidate can be deployed.
 *
 * Runtime authority:
 * - read existing `01 Операции` through GoogleTransactionRepositoryGateway;
 * - read explicit currency from existing `09 Настройки`;
 * - never write financial data;
 * - never use legacy total cells as truth.
 */
var PRH_R2_FIN_RUNTIME = Object.freeze({
  SCHEMA: 'PRH_R2_FIN_RUNTIME_ADAPTER_V1',
  VERSION: '1.0.0',
  FINANCIAL_TRUTH_POLICY: 'FIN-TRUTH-v1',
  KPI_DICTIONARY_VERSION: '1.0.0',
  HOME_VIEW_SCHEMA: 'PRH_FINANCIAL_HOME_VIEW_V1',
  INCLUDED_STATUS: 'posted',
  WRITE_AUTHORITY: false,
  UI_FINANCIAL_FORMULA_AUTHORITY: false,
  FREE_ONLY: true
});

function prhR2FinFail_(reason) {
  var error = new Error(reason);
  error.code = reason;
  throw error;
}

function prhR2FinType_(value) {
  var key = String(value == null ? '' : value).trim().toLowerCase();
  var map = {
    'доход': 'income', 'income': 'income',
    'расход': 'expense', 'expense': 'expense',
    'перевод': 'transfer', 'transfer': 'transfer',
    'возврат': 'refund', 'refund': 'refund',
    'корректировка': 'adjustment', 'adjustment': 'adjustment'
  };
  if (!Object.prototype.hasOwnProperty.call(map, key)) prhR2FinFail_('R2_FIN_TYPE_UNMAPPED');
  return map[key];
}

function prhR2FinStatus_(value) {
  var key = String(value == null ? '' : value).trim().toLowerCase();
  var map = {
    '': 'posted', 'проведено': 'posted', 'оплачено': 'posted', 'ok': 'posted', 'posted': 'posted',
    'ожидает': 'pending', 'черновик': 'pending', 'pending': 'pending',
    'отменено': 'void', 'void': 'void'
  };
  if (!Object.prototype.hasOwnProperty.call(map, key)) prhR2FinFail_('R2_FIN_STATUS_UNMAPPED');
  return map[key];
}

function prhR2FinMajorToMinor_(value) {
  if (typeof value !== 'number' && typeof value !== 'string') prhR2FinFail_('R2_FIN_AMOUNT_INVALID');
  var text = String(value).trim().replace(',', '.');
  var match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) prhR2FinFail_('R2_FIN_AMOUNT_PRECISION_INVALID');
  var whole = Number(match[1]);
  var fraction = String(match[2] || '').padEnd(2, '0');
  if (!Number.isSafeInteger(whole)) prhR2FinFail_('R2_FIN_AMOUNT_RANGE_INVALID');
  var minor = whole * 100 + Number(fraction || 0);
  if (!Number.isSafeInteger(minor)) prhR2FinFail_('R2_FIN_AMOUNT_RANGE_INVALID');
  return minor;
}

function prhR2FinRfc3339_(value) {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) prhR2FinFail_('R2_FIN_OCCURRED_AT_INVALID');
    return value.toISOString();
  }
  var text = String(value == null ? '' : value).trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(text) || !Number.isFinite(Date.parse(text))) {
    prhR2FinFail_('R2_FIN_OCCURRED_AT_INVALID');
  }
  return text;
}

function prhR2FinCurrency_() {
  var settings = getSettingsMap_();
  var currency = String(settings.currency || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) prhR2FinFail_('R2_RUNTIME_CURRENCY_SETTING_REQUIRED');
  return currency;
}

function prhR2FinHeaderIndex_(headers, required) {
  if (!Array.isArray(headers)) prhR2FinFail_('R2_FIN_HEADERS_INVALID');
  var normalized = headers.map(function(value) { return String(value == null ? '' : value).trim(); });
  var index = {};
  required.forEach(function(header) {
    var position = normalized.indexOf(header);
    if (position < 0) prhR2FinFail_('R2_FIN_REQUIRED_HEADER_MISSING');
    index[header] = position;
  });
  return index;
}

function prhR2FinReadTransactions_() {
  var required = ['ID', 'Дата и время', 'Тип', 'Сумма', 'Счёт', 'Счёт назначения', 'Категория', 'Статус'];
  var snapshot = prhGoogleRepositoryReadOperationsTable_({ required_headers: required });
  if (!snapshot || snapshot.schema !== 'PRH_GOOGLE_OPERATIONS_TABLE_V1') prhR2FinFail_('R2_FIN_GATEWAY_SNAPSHOT_INVALID');
  var index = prhR2FinHeaderIndex_(snapshot.headers, required);
  var currency = prhR2FinCurrency_();
  var seen = {};
  var transactions = [];
  snapshot.rows.forEach(function(row) {
    var id = String(row[index.ID] || '').trim();
    if (!id) return;
    if (seen[id]) prhR2FinFail_('R2_FIN_TRANSACTION_ID_DUPLICATE');
    seen[id] = true;
    var type = prhR2FinType_(row[index['Тип']]);
    var account = String(row[index['Счёт']] || '').trim();
    var destination = String(row[index['Счёт назначения']] || '').trim();
    if (!account) prhR2FinFail_('R2_FIN_ACCOUNT_REQUIRED');
    if (type === 'transfer' && (!destination || destination === account)) prhR2FinFail_('R2_FIN_TRANSFER_ACCOUNTS_INVALID');
    var category = String(row[index['Категория']] || '').trim() || 'UNCLASSIFIED';
    var amountMinor = prhR2FinMajorToMinor_(row[index['Сумма']]);
    if (type === 'adjustment' && amountMinor !== 0) prhR2FinFail_('R2_FIN_NONZERO_ADJUSTMENT_UNSUPPORTED');
    transactions.push(Object.freeze({
      transaction_id: id,
      occurred_at: prhR2FinRfc3339_(row[index['Дата и время']]),
      type: type,
      status: prhR2FinStatus_(row[index['Статус']]),
      amount_minor: amountMinor,
      currency: currency,
      account_id: account,
      destination_account_id: type === 'transfer' ? destination : null,
      category_id: category,
      reverses_transaction_id: null,
      adjustment_semantics: type === 'refund' ? 'expense_reduction' : null
    }));
  });
  if (!transactions.length) prhR2FinFail_('R2_RUNTIME_NO_TRANSACTIONS');
  return Object.freeze({ currency: currency, transactions: Object.freeze(transactions) });
}

function prhR2FinIsoDay_(date) {
  return Utilities.formatDate(date, 'UTC', 'yyyy-MM-dd');
}

function prhR2FinLatestMonthPeriod_(transactions) {
  var latest = null;
  transactions.forEach(function(tx) {
    var date = new Date(tx.occurred_at);
    if (!Number.isFinite(date.getTime())) prhR2FinFail_('R2_RUNTIME_TRANSACTION_DATE_INVALID');
    if (!latest || date > latest) latest = date;
  });
  if (!latest) prhR2FinFail_('R2_RUNTIME_PERIOD_UNAVAILABLE');
  var start = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), 1));
  var end = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() + 1, 1));
  return Object.freeze({
    kind: 'EXPLICIT_WINDOW',
    start: prhR2FinIsoDay_(start),
    end: prhR2FinIsoDay_(end),
    partial: false,
    day_count: Math.round((end.getTime() - start.getTime()) / 86400000),
    proration: 'NONE'
  });
}

function prhR2FinInPeriod_(tx, period) {
  var day = tx.occurred_at.slice(0, 10);
  return day >= period.start && day < period.end;
}

function prhR2FinAggregate_(transactions, currency, period) {
  if (!Array.isArray(transactions)) prhR2FinFail_('R2_FIN_TRANSACTIONS_INVALID');
  if (!/^[A-Z]{3}$/.test(String(currency || ''))) prhR2FinFail_('R2_FIN_CURRENCY_INVALID');
  var result = {
    policy_version: PRH_R2_FIN_RUNTIME.FINANCIAL_TRUTH_POLICY,
    included_count: 0,
    excluded_status_count: 0,
    income_minor: 0,
    gross_expense_minor: 0,
    refund_minor: 0,
    expense_minor: 0,
    cash_flow_minor: 0,
    savings_minor: 0,
    transfer_minor: 0,
    expense_by_category_minor: {}
  };
  transactions.forEach(function(tx) {
    if (!prhR2FinInPeriod_(tx, period)) return;
    if (tx.status !== PRH_R2_FIN_RUNTIME.INCLUDED_STATUS) {
      result.excluded_status_count += 1;
      return;
    }
    if (tx.currency !== currency) prhR2FinFail_('R2_FIN_MIXED_CURRENCY_UNSUPPORTED');
    result.included_count += 1;
    if (tx.type === 'income') {
      result.income_minor += tx.amount_minor;
    } else if (tx.type === 'expense') {
      result.gross_expense_minor += tx.amount_minor;
      result.expense_by_category_minor[tx.category_id] = (result.expense_by_category_minor[tx.category_id] || 0) + tx.amount_minor;
    } else if (tx.type === 'refund') {
      result.refund_minor += tx.amount_minor;
      result.expense_by_category_minor[tx.category_id] = (result.expense_by_category_minor[tx.category_id] || 0) - tx.amount_minor;
    } else if (tx.type === 'transfer') {
      result.transfer_minor += tx.amount_minor;
    } else if (tx.type === 'adjustment') {
      if (tx.amount_minor !== 0) prhR2FinFail_('R2_FIN_NONZERO_ADJUSTMENT_UNSUPPORTED');
    } else {
      prhR2FinFail_('R2_FIN_TYPE_UNSUPPORTED');
    }
  });
  result.expense_minor = result.gross_expense_minor - result.refund_minor;
  result.cash_flow_minor = result.income_minor - result.expense_minor;
  result.savings_minor = result.cash_flow_minor;
  ['income_minor','gross_expense_minor','refund_minor','expense_minor','cash_flow_minor','savings_minor','transfer_minor'].forEach(function(field) {
    if (!Number.isSafeInteger(result[field])) prhR2FinFail_('R2_FIN_SAFE_INTEGER_OVERFLOW');
  });
  return Object.freeze(result);
}

function prhR2FinDrill_(sourceWidgetId, target, period) {
  return Object.freeze({
    schema: 'PRH_HOME_DRILL_ENVELOPE_V1',
    period: Object.freeze({
      kind: period.kind, start: period.start, end: period.end,
      partial: period.partial, day_count: period.day_count, proration: period.proration
    }),
    drill_context: Object.freeze({
      schema: 'PRH_DRILL_CONTEXT_V1',
      contract_version: '1.0.0',
      source_widget_id: sourceWidgetId,
      target: target,
      filter_context: Object.freeze({
        schema: 'PRH_FILTER_CONTEXT_V1', contract_version: '1.0.0', filters: Object.freeze([])
      }),
      context_hash: 'UI-MIG-020-RUNTIME-EMPTY-FILTER'
    })
  });
}

function prhR2FinHomeCard_(id, kpiId, valueMinor, currency, period) {
  return Object.freeze({
    id: id,
    state: 'READY',
    source_kpi: kpiId,
    value_minor: valueMinor,
    currency: currency,
    drill: prhR2FinDrill_('home-card-' + id.toLowerCase(), 'TRANSACTION_EXPLORER', period)
  });
}

function prhR2FinBuildHomeView_(source) {
  var period = prhR2FinLatestMonthPeriod_(source.transactions);
  var report = prhR2FinAggregate_(source.transactions, source.currency, period);
  var alerts = [];
  if (report.cash_flow_minor < 0) {
    alerts.push(Object.freeze({ code: 'NEGATIVE_CASH_FLOW', severity: 'WARNING', source_kpi: 'CASH_FLOW', source_capability: null, drill: prhR2FinDrill_('home-alert-negative-cash-flow', 'TRANSACTION_EXPLORER', period) }));
  }
  alerts.push(Object.freeze({ code: 'BUDGET_NOT_CONFIGURED', severity: 'INFO', source_kpi: null, source_capability: 'BUDGET', drill: prhR2FinDrill_('home-alert-budget-not-configured', 'DETAILS', period) }));
  alerts.push(Object.freeze({ code: 'LIQUIDITY_RUNTIME_BINDING_UNAVAILABLE', severity: 'INFO', source_kpi: null, source_capability: 'LIQUIDITY', drill: prhR2FinDrill_('home-alert-liquidity-runtime-binding', 'DETAILS', period) }));
  var expenseMix = Object.keys(report.expense_by_category_minor)
    .map(function(category) { return [category, report.expense_by_category_minor[category]]; })
    .filter(function(row) { return row[1] !== 0; })
    .sort(function(left, right) { return right[1] - left[1] || left[0].localeCompare(right[0]); });
  var cards = Object.freeze({
    INCOME: prhR2FinHomeCard_('INCOME', 'INCOME', report.income_minor, source.currency, period),
    EXPENSE: prhR2FinHomeCard_('EXPENSE', 'EXPENSE', report.expense_minor, source.currency, period),
    CASH_FLOW: prhR2FinHomeCard_('CASH_FLOW', 'CASH_FLOW', report.cash_flow_minor, source.currency, period),
    SAVINGS: prhR2FinHomeCard_('SAVINGS', 'SAVINGS', report.savings_minor, source.currency, period),
    BUDGET: Object.freeze({ id: 'BUDGET', state: 'NOT_CONFIGURED', source_kpi: 'BUDGET_VARIANCE', budget_minor: null, expense_minor: report.expense_minor, variance_minor: null, currency: source.currency, reason: 'EXPLICIT_BUDGET_RUNTIME_BINDING_REQUIRED', drill: prhR2FinDrill_('home-card-budget', 'DETAILS', period) }),
    LIQUIDITY: Object.freeze({ id: 'LIQUIDITY', state: 'UNAVAILABLE_PENDING_BALANCE_SOURCE', value_minor: null, currency: source.currency, source: null, reason: 'BAL_RUNTIME_BINDING_NOT_PROVEN', future_dependency: 'BAL-030', cash_flow_proxy_used: false, drill: prhR2FinDrill_('home-card-liquidity', 'DETAILS', period) }),
    ALERTS: Object.freeze({ id: 'ALERTS', state: 'READY', count: alerts.length, highest_severity: report.cash_flow_minor < 0 ? 'WARNING' : 'INFO', drill: prhR2FinDrill_('home-card-alerts', 'DETAILS', period) })
  });
  return Object.freeze({
    schema: PRH_R2_FIN_RUNTIME.HOME_VIEW_SCHEMA,
    contract_version: '1.0.0',
    currency: source.currency,
    period: period,
    financial_truth_policy: PRH_R2_FIN_RUNTIME.FINANCIAL_TRUTH_POLICY,
    kpi_dictionary_version: PRH_R2_FIN_RUNTIME.KPI_DICTIONARY_VERSION,
    filter_context: Object.freeze({ schema: 'PRH_FILTER_CONTEXT_V1', contract_version: '1.0.0', filters: Object.freeze([]), context_hash: 'UI-MIG-020-RUNTIME-EMPTY-FILTER' }),
    cards: cards,
    alerts: Object.freeze(alerts),
    widgets: Object.freeze([]),
    visual_data: Object.freeze({ cash_flow_minor: Object.freeze([report.cash_flow_minor]), expense_mix: Object.freeze(expenseMix) }),
    provenance: Object.freeze({
      financial_values: 'FIN010_PARITY_GUARDED_RUNTIME_ADAPTER',
      kpi_evaluation_count: 1,
      ui_financial_formula_used: false,
      liquidity_proxy_used: false,
      legacy_total_cells_used: false,
      parity_gate: 'R2 Financial runtime parity'
    })
  });
}

function prhR2BuildFinancialHomeRuntime_() {
  return prhR2FinBuildHomeView_(prhR2FinReadTransactions_());
}
