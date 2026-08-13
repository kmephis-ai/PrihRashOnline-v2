/**
 * FIN-REC-001 read-only private Expenses / Income / Cash Flow runtime bridge.
 *
 * Each request is built from one immutable canonical snapshot, one bounded
 * period/filter state and exactly one selected canonical FIN module. This
 * bridge owns no financial formulas and has no write authority.
 */
var PRH_R2_FIN_SECTIONS_RUNTIME = Object.freeze({
  SCHEMA: 'PRH_R2_PRIVATE_FINANCIAL_SECTIONS_VIEW_V1',
  VERSION: '1.0.0',
  FINANCIAL_TRUTH_POLICY: 'FIN-TRUTH-v1',
  FILTER_CONTEXT_SCHEMA: 'PRH_FILTER_CONTEXT_V1',
  FILTER_CONTEXT_VERSION: '1.0.0',
  DEFAULT_WINDOW_DAYS: 90,
  ALLOWED_WINDOW_DAYS: Object.freeze([30, 90, 180, 365]),
  ALLOWED_SECTIONS: Object.freeze(['expenses', 'income', 'cash-flow']),
  MAX_FILTER_VALUES: 16,
  WRITE_AUTHORITY: false,
  CANONICAL_MUTATION_AUTHORITY: false,
  FREE_ONLY: true
});

function prhR2FinSectionsFail_(reason) {
  var error = new Error(reason);
  error.code = reason;
  throw error;
}

function prhR2FinSectionsRuntime_() {
  var runtime = prhR2CanonicalRuntime_();
  if (!runtime.expenseAnalytics || !runtime.incomeAnalytics || !runtime.cashFlowDashboard ||
      typeof runtime.expenseAnalytics.buildExpenseAnalytics !== 'function' ||
      typeof runtime.incomeAnalytics.buildIncomeAnalytics !== 'function' ||
      typeof runtime.cashFlowDashboard.buildCashFlowDashboard !== 'function') {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_RUNTIME_MODULE_MISSING');
  }
  return runtime;
}

function prhR2FinSectionsPrivacyMode_(value) {
  var mode = typeof prhPrivacyResolveMode_ === 'function'
    ? prhPrivacyResolveMode_(value)
    : String(value || 'NORMAL').trim().toUpperCase();
  if (['NORMAL', 'MASKED', 'DEMO', 'ZEN'].indexOf(mode) < 0) prhR2FinSectionsFail_('R2_FIN_SECTIONS_PRIVACY_MODE_INVALID');
  return mode;
}

function prhR2FinSectionsWindowDays_(value) {
  var days = value == null || value === '' ? PRH_R2_FIN_SECTIONS_RUNTIME.DEFAULT_WINDOW_DAYS : Number(value);
  if (PRH_R2_FIN_SECTIONS_RUNTIME.ALLOWED_WINDOW_DAYS.indexOf(days) < 0) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_WINDOW_INVALID');
  }
  return days;
}

function prhR2FinSectionsSection_(value) {
  var section = String(value || 'expenses').trim().toLowerCase();
  if (PRH_R2_FIN_SECTIONS_RUNTIME.ALLOWED_SECTIONS.indexOf(section) < 0) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_SECTION_INVALID');
  }
  return section;
}

function prhR2FinSectionsIds_(value) {
  var source = Array.isArray(value) ? value : [];
  if (source.length > PRH_R2_FIN_SECTIONS_RUNTIME.MAX_FILTER_VALUES) prhR2FinSectionsFail_('R2_FIN_SECTIONS_FILTER_LIMIT');
  var seen = {};
  return source.map(function(item) { return String(item || '').trim(); }).filter(function(item) {
    if (!item || item.length > 160 || seen[item]) return false;
    seen[item] = true;
    return true;
  }).sort();
}

function prhR2FinSectionsRequest_(request) {
  var input = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
  var filters = input.filters && typeof input.filters === 'object' && !Array.isArray(input.filters) ? input.filters : {};
  return Object.freeze({
    privacy_mode: prhR2FinSectionsPrivacyMode_(input.privacy_mode),
    section: prhR2FinSectionsSection_(input.section),
    window_days: prhR2FinSectionsWindowDays_(input.window_days),
    expected_revision: String(input.expected_revision || '').trim().toLowerCase(),
    filters: Object.freeze({
      account_ids: Object.freeze(prhR2FinSectionsIds_(filters.account_ids)),
      category_ids: Object.freeze(prhR2FinSectionsIds_(filters.category_ids)),
      member_ids: Object.freeze(prhR2FinSectionsIds_(filters.member_ids))
    })
  });
}

function prhR2FinSectionsIsoDay_(date) {
  return date.toISOString().slice(0, 10);
}

function prhR2FinSectionsAddDays_(isoDay, days) {
  var date = new Date(String(isoDay) + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || prhR2FinSectionsIsoDay_(date) !== isoDay) prhR2FinSectionsFail_('R2_FIN_SECTIONS_DATE_INVALID');
  date.setUTCDate(date.getUTCDate() + days);
  return prhR2FinSectionsIsoDay_(date);
}

function prhR2FinSectionsPeriod_(transactions, windowDays) {
  var latest = '';
  transactions.forEach(function(tx) {
    var day = String(tx && tx.occurred_at || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) prhR2FinSectionsFail_('R2_FIN_SECTIONS_TRANSACTION_DATE_INVALID');
    if (!latest || day > latest) latest = day;
  });
  if (!latest) return null;
  var end = prhR2FinSectionsAddDays_(latest, 1);
  var start = prhR2FinSectionsAddDays_(end, -windowDays);
  var comparisonEnd = start;
  var comparisonStart = prhR2FinSectionsAddDays_(comparisonEnd, -windowDays);
  return Object.freeze({
    current: Object.freeze({ start: start, end: end, partial: false }),
    comparison: Object.freeze({ start: comparisonStart, end: comparisonEnd, partial: false }),
    window_days: windowDays
  });
}

function prhR2FinSectionsFilterContext_(filters) {
  var definitions = [
    ['account_id', filters.account_ids],
    ['category_id', filters.category_ids],
    ['member_id', filters.member_ids]
  ];
  return Object.freeze({
    schema: PRH_R2_FIN_SECTIONS_RUNTIME.FILTER_CONTEXT_SCHEMA,
    contract_version: PRH_R2_FIN_SECTIONS_RUNTIME.FILTER_CONTEXT_VERSION,
    filters: Object.freeze(definitions.filter(function(item) { return item[1].length > 0; }).map(function(item) {
      return Object.freeze({ kind: 'DIMENSION', field: item[0], operator: 'INCLUDE', values: Object.freeze(item[1].slice()) });
    }))
  });
}

function prhR2FinSectionsApplyFilters_(transactions, filters) {
  function matches(value, allowed) { return !allowed.length || allowed.indexOf(String(value || '')) >= 0; }
  return transactions.filter(function(tx) {
    return matches(tx.account_id, filters.account_ids) &&
      matches(tx.category_id, filters.category_ids) &&
      matches(tx.member_id, filters.member_ids);
  });
}

function prhR2FinSectionsLabel_(source, kind, id, fallback) {
  if (id == null || id === '') return fallback || 'Без значения';
  try { return source.dimensions.displayLabel(kind, id); } catch (error) { return fallback || 'Без значения'; }
}

function prhR2FinSectionsOptions_(source, kind, field) {
  var seen = {};
  source.transactions.forEach(function(tx) {
    var id = tx[field];
    if (id == null || id === '' || seen[id]) return;
    seen[id] = true;
  });
  return Object.freeze(Object.keys(seen).map(function(id) {
    return Object.freeze({ value: id, label: prhR2FinSectionsLabel_(source, kind, id, 'Без значения') });
  }).sort(function(left, right) { return left.label.localeCompare(right.label, 'ru'); }));
}

function prhR2FinSectionsExpenseView_(source, view) {
  return Object.freeze({
    total_expense_minor: view.total_expense_minor,
    comparison_expense_minor: view.comparison_expense_minor,
    delta_minor: view.delta_minor,
    trend: Object.freeze(view.trend.points.map(function(point) {
      return Object.freeze({ time_bucket: point.time_bucket, expense_minor: point.expense_minor });
    })),
    category_mix: Object.freeze(view.category_mix.rows.map(function(row) {
      return Object.freeze({ category_id: row.category_id, category_label: prhR2FinSectionsLabel_(source, 'category', row.category_id, 'Без категории'), expense_minor: row.expense_minor });
    })),
    drivers: Object.freeze(view.drivers.rows.map(function(row) {
      return Object.freeze({ category_id: row.category_id, category_label: prhR2FinSectionsLabel_(source, 'category', row.category_id, 'Без категории'), delta_minor: row.delta_minor });
    }))
  });
}

function prhR2FinSectionsIncomeView_(source, view) {
  return Object.freeze({
    total_income_minor: view.total_income_minor,
    comparison_income_minor: view.comparison_income_minor,
    delta_minor: view.delta_minor,
    stability: Object.freeze({ state: view.stability.state, stability_score: view.stability.stability_score }),
    trend: Object.freeze(view.trend.points.map(function(point) {
      return Object.freeze({ time_bucket: point.time_bucket, income_minor: point.income_minor });
    })),
    source_mix: Object.freeze(view.source_mix.rows.map(function(row) {
      return Object.freeze({ source_id: row.source_id, source_label: prhR2FinSectionsLabel_(source, 'category', row.source_id, 'Без категории'), income_minor: row.income_minor });
    })),
    source_deltas: Object.freeze(view.source_deltas.rows.map(function(row) {
      return Object.freeze({ source_id: row.source_id, source_label: prhR2FinSectionsLabel_(source, 'category', row.source_id, 'Без категории'), delta_minor: row.delta_minor });
    }))
  });
}

function prhR2FinSectionsCashFlowView_(view) {
  return Object.freeze({
    inflow_minor: view.inflow_minor,
    outflow_minor: view.outflow_minor,
    net_minor: view.net_minor,
    comparison: Object.freeze({
      inflow_minor: view.comparison.inflow_minor,
      outflow_minor: view.comparison.outflow_minor,
      net_minor: view.comparison.net_minor,
      inflow_delta_minor: view.comparison.inflow_delta_minor,
      outflow_delta_minor: view.comparison.outflow_delta_minor,
      net_delta_minor: view.comparison.net_delta_minor
    }),
    trend: Object.freeze(view.trend.points.map(function(point) {
      return Object.freeze({ time_bucket: point.time_bucket, inflow_minor: point.inflow_minor, outflow_minor: point.outflow_minor, net_minor: point.net_minor });
    })),
    liquidity_state: view.liquidity_state,
    account_balance_authority: false
  });
}

function prhR2BuildFinancialSectionsView_(request) {
  var normalized = prhR2FinSectionsRequest_(request);
  if (normalized.privacy_mode === 'DEMO' || normalized.privacy_mode === 'ZEN') {
    return Object.freeze({
      schema: PRH_R2_FIN_SECTIONS_RUNTIME.SCHEMA,
      version: PRH_R2_FIN_SECTIONS_RUNTIME.VERSION,
      state: 'PRIVACY_MODE_UNAVAILABLE',
      privacy_mode: normalized.privacy_mode,
      section: normalized.section,
      retryable: false,
      reason_code: 'R2_FIN_SECTIONS_PRIVATE_ROUTE_REQUIRES_NORMAL_OR_MASKED',
      financial_write_authorized: false,
      canonical_mutation_performed: false
    });
  }
  var source = prhR2DataCreateSnapshot_();
  if (normalized.expected_revision) {
    if (!/^[0-9a-f]{64}$/.test(normalized.expected_revision)) prhR2FinSectionsFail_('R2_FIN_SECTIONS_EXPECTED_REVISION_INVALID');
    if (normalized.expected_revision !== source.revision) {
      return Object.freeze({
        schema: PRH_R2_FIN_SECTIONS_RUNTIME.SCHEMA,
        version: PRH_R2_FIN_SECTIONS_RUNTIME.VERSION,
        state: 'STALE_SNAPSHOT',
        privacy_mode: normalized.privacy_mode,
        section: normalized.section,
        snapshot_revision: source.revision,
        snapshot_revision_prefix: source.revision.slice(0, 12),
        retryable: true,
        reason_code: 'R2_FIN_SECTIONS_SNAPSHOT_REVISION_CHANGED',
        financial_write_authorized: false,
        canonical_mutation_performed: false
      });
    }
  }
  if (!source.transactions.length) {
    return Object.freeze({
      schema: PRH_R2_FIN_SECTIONS_RUNTIME.SCHEMA,
      version: PRH_R2_FIN_SECTIONS_RUNTIME.VERSION,
      state: 'EMPTY',
      privacy_mode: normalized.privacy_mode,
      section: normalized.section,
      snapshot_revision: source.revision,
      snapshot_revision_prefix: source.revision.slice(0, 12),
      window_days: normalized.window_days,
      retryable: true,
      reason_code: null,
      financial_write_authorized: false,
      canonical_mutation_performed: false
    });
  }
  if (normalized.privacy_mode === 'MASKED') {
    return Object.freeze({
      schema: PRH_R2_FIN_SECTIONS_RUNTIME.SCHEMA,
      version: PRH_R2_FIN_SECTIONS_RUNTIME.VERSION,
      state: 'MASKED',
      privacy_mode: 'MASKED',
      section: normalized.section,
      snapshot_revision: source.revision,
      snapshot_revision_prefix: source.revision.slice(0, 12),
      window_days: normalized.window_days,
      retryable: true,
      reason_code: null,
      financial_write_authorized: false,
      canonical_mutation_performed: false,
      telemetry: Object.freeze({ canonical_snapshot_read_count: 1, analytics_build_count: 0, analytics_section: normalized.section, financial_payload_in_telemetry: false })
    });
  }
  var runtime = prhR2FinSectionsRuntime_();
  var period = prhR2FinSectionsPeriod_(source.transactions, normalized.window_days);
  var filtered = prhR2FinSectionsApplyFilters_(source.transactions, normalized.filters);
  var filterContext = prhR2FinSectionsFilterContext_(normalized.filters);
  var common = {
    currency: source.currency,
    period: period.current,
    comparison_period: period.comparison,
    base_filter_context: filterContext
  };
  var expense = null;
  var income = null;
  var cashFlow = null;
  if (normalized.section === 'expenses') {
    expense = runtime.expenseAnalytics.buildExpenseAnalytics(filtered, Object.assign({}, common, { trend_grain: 'DAY' }));
    if (expense.financial_truth_policy !== PRH_R2_FIN_SECTIONS_RUNTIME.FINANCIAL_TRUTH_POLICY) {
      prhR2FinSectionsFail_('R2_FIN_SECTIONS_FINANCIAL_POLICY_MISMATCH');
    }
  } else if (normalized.section === 'income') {
    income = runtime.incomeAnalytics.buildIncomeAnalytics(filtered, Object.assign({}, common, { trend_grain: 'DAY' }));
    if (income.financial_truth_policy !== PRH_R2_FIN_SECTIONS_RUNTIME.FINANCIAL_TRUTH_POLICY) {
      prhR2FinSectionsFail_('R2_FIN_SECTIONS_FINANCIAL_POLICY_MISMATCH');
    }
  } else {
    cashFlow = runtime.cashFlowDashboard.buildCashFlowDashboard(filtered, Object.assign({}, common, { grain: 'DAY' }));
    if (cashFlow.financial_truth_policy !== PRH_R2_FIN_SECTIONS_RUNTIME.FINANCIAL_TRUTH_POLICY) {
      prhR2FinSectionsFail_('R2_FIN_SECTIONS_FINANCIAL_POLICY_MISMATCH');
    }
  }
  return Object.freeze({
    schema: PRH_R2_FIN_SECTIONS_RUNTIME.SCHEMA,
    version: PRH_R2_FIN_SECTIONS_RUNTIME.VERSION,
    state: filtered.length ? 'READY' : 'EMPTY_FILTER_RESULT',
    privacy_mode: normalized.privacy_mode,
    section: normalized.section,
    currency: source.currency,
    financial_truth_policy: PRH_R2_FIN_SECTIONS_RUNTIME.FINANCIAL_TRUTH_POLICY,
    snapshot_revision: source.revision,
    snapshot_revision_prefix: source.revision.slice(0, 12),
    period: period.current,
    comparison_period: period.comparison,
    window_days: period.window_days,
    filters: Object.freeze({
      selected: normalized.filters,
      options: Object.freeze({
        accounts: prhR2FinSectionsOptions_(source, 'account', 'account_id'),
        categories: prhR2FinSectionsOptions_(source, 'category', 'category_id'),
        members: prhR2FinSectionsOptions_(source, 'member', 'member_id')
      })
    }),
    expenses: expense ? prhR2FinSectionsExpenseView_(source, expense) : null,
    income: income ? prhR2FinSectionsIncomeView_(source, income) : null,
    cash_flow: cashFlow ? prhR2FinSectionsCashFlowView_(cashFlow) : null,
    retryable: true,
    reason_code: null,
    financial_write_authorized: false,
    canonical_mutation_performed: false,
    telemetry: Object.freeze({
      canonical_snapshot_read_count: 1,
      snapshot_reuse_count: source.cycle && typeof source.cycle.getTelemetry === 'function' ? source.cycle.getTelemetry().snapshot_reuse_count : 0,
      filtered_record_count: filtered.length,
      analytics_build_count: 1,
      analytics_section: normalized.section,
      revision_hash_prefix: source.revision.slice(0, 12),
      financial_payload_in_telemetry: false
    })
  });
}

function prhR2FinSectionsFailureEnvelope_(request, error) {
  var reason = typeof prhR2DataBoundedReason_ === 'function'
    ? prhR2DataBoundedReason_(error)
    : 'R2_FIN_SECTIONS_SOURCE_UNAVAILABLE';
  var section = 'expenses';
  try { section = prhR2FinSectionsSection_(request && request.section); } catch (_) {}
  return Object.freeze({
    schema: PRH_R2_FIN_SECTIONS_RUNTIME.SCHEMA,
    version: PRH_R2_FIN_SECTIONS_RUNTIME.VERSION,
    state: 'SOURCE_UNAVAILABLE',
    privacy_mode: prhR2FinSectionsPrivacyMode_(request && request.privacy_mode),
    section: section,
    retryable: true,
    reason_code: reason,
    financial_write_authorized: false,
    canonical_mutation_performed: false
  });
}

function prhR2FetchFinancialSectionsPayload(request) {
  try {
    return prhR2BuildFinancialSectionsView_(request || {});
  } catch (error) {
    return prhR2FinSectionsFailureEnvelope_(request || {}, error);
  }
}

function prhR2FinancialSectionsRuntimeSmokeToken() {
  if (PRH_R2_FIN_SECTIONS_RUNTIME.WRITE_AUTHORITY !== false ||
      PRH_R2_FIN_SECTIONS_RUNTIME.CANONICAL_MUTATION_AUTHORITY !== false ||
      PRH_R2_FIN_SECTIONS_RUNTIME.FREE_ONLY !== true) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_RUNTIME_POLICY_INVALID');
  }
  prhR2FinSectionsRuntime_();
  return 'PRH_R2_FIN_SECTIONS_RUNTIME_V1|SHARED_SNAPSHOT|READ_ONLY|OK';
}