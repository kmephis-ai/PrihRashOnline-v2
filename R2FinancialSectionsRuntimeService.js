var PRH_R2_FIN_SECTIONS_RUNTIME = Object.freeze({
  SCHEMA: 'PRH_R2_PRIVATE_FINANCIAL_SECTIONS_VIEW_V1',
  VERSION: '1.0.0',
  FINANCIAL_TRUTH_POLICY: 'FIN-TRUTH-v1',
  WRITE_AUTHORITY: false,
  CANONICAL_MUTATION_AUTHORITY: false,
  FREE_ONLY: true,
  WINDOW_DAYS: Object.freeze([30, 90, 180, 365]),
  SECTIONS: Object.freeze(['expenses', 'income', 'cash-flow'])
});

function prhR2FinSectionsFail_(reason) {
  var error = new Error(reason);
  error.code = reason;
  throw error;
}

function prhR2FinSectionsRuntime_() {
  var runtime = typeof prhR2CanonicalRuntime_ === 'function' ? prhR2CanonicalRuntime_() : null;
  if (!runtime || !runtime.expenseAnalytics || !runtime.incomeAnalytics || !runtime.cashFlowDashboard) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_RUNTIME_UNAVAILABLE');
  }
  return runtime;
}

function prhR2FinSectionsPrivacyMode_(value) {
  if (typeof prhPrivacyResolveMode_ === 'function') return prhPrivacyResolveMode_(value);
  var mode = String(value || 'NORMAL').trim().toUpperCase();
  return mode || 'NORMAL';
}

function prhR2FinSectionsSection_(value) {
  var section = String(value || 'expenses').trim().toLowerCase();
  if (PRH_R2_FIN_SECTIONS_RUNTIME.SECTIONS.indexOf(section) < 0) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_SECTION_UNSUPPORTED');
  }
  return section;
}

function prhR2FinSectionsWindowDays_(value) {
  var parsed = Number(value || 90);
  if (PRH_R2_FIN_SECTIONS_RUNTIME.WINDOW_DAYS.indexOf(parsed) < 0) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_WINDOW_UNSUPPORTED');
  }
  return parsed;
}

function prhR2FinSectionsStringArray_(value, maxItems) {
  if (value === undefined || value === null || value === '') return Object.freeze([]);
  if (!Array.isArray(value)) prhR2FinSectionsFail_('R2_FIN_SECTIONS_FILTER_INVALID');
  if (value.length > maxItems) prhR2FinSectionsFail_('R2_FIN_SECTIONS_FILTER_LIMIT_EXCEEDED');
  var seen = {};
  var result = [];
  value.forEach(function(item) {
    var normalized = String(item || '').trim();
    if (!normalized || normalized.length > 160) prhR2FinSectionsFail_('R2_FIN_SECTIONS_FILTER_INVALID');
    if (!seen[normalized]) {
      seen[normalized] = true;
      result.push(normalized);
    }
  });
  result.sort();
  return Object.freeze(result);
}

function prhR2FinSectionsRequest_(request) {
  var input = request || {};
  var filters = input.filters || {};
  return Object.freeze({
    privacy_mode: prhR2FinSectionsPrivacyMode_(input.privacy_mode),
    section: prhR2FinSectionsSection_(input.section),
    window_days: prhR2FinSectionsWindowDays_(input.window_days),
    expected_revision: input.expected_revision ? String(input.expected_revision).trim() : '',
    filters: Object.freeze({
      account_ids: prhR2FinSectionsStringArray_(filters.account_ids, 20),
      category_ids: prhR2FinSectionsStringArray_(filters.category_ids, 40),
      member_ids: prhR2FinSectionsStringArray_(filters.member_ids, 20)
    })
  });
}

function prhR2FinSectionsDate_(isoDay) {
  var value = String(isoDay || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) prhR2FinSectionsFail_('R2_FIN_SECTIONS_DATE_INVALID');
  var date = new Date(value + 'T00:00:00Z');
  if (!isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_DATE_INVALID');
  }
  return date;
}

function prhR2FinSectionsAddDays_(isoDay, days) {
  var date = prhR2FinSectionsDate_(isoDay);
  date.setUTCDate(date.getUTCDate() + Number(days));
  return date.toISOString().slice(0, 10);
}

function prhR2FinSectionsLatestDay_(transactions) {
  var latest = '';
  (transactions || []).forEach(function(transaction) {
    var day = String(transaction && transaction.occurred_at || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day > latest) latest = day;
  });
  if (!latest) prhR2FinSectionsFail_('R2_FIN_SECTIONS_EMPTY_SOURCE');
  return latest;
}

function prhR2FinSectionsPeriod_(transactions, windowDays) {
  var latest = prhR2FinSectionsLatestDay_(transactions);
  var currentEnd = prhR2FinSectionsAddDays_(latest, 1);
  var currentStart = prhR2FinSectionsAddDays_(currentEnd, -windowDays);
  var comparisonEnd = currentStart;
  var comparisonStart = prhR2FinSectionsAddDays_(comparisonEnd, -windowDays);
  return Object.freeze({
    current: Object.freeze({ start: currentStart, end: currentEnd, partial: false }),
    comparison: Object.freeze({ start: comparisonStart, end: comparisonEnd, partial: false }),
    window_days: windowDays
  });
}

function prhR2FinSectionsApplyFilters_(transactions, filters) {
  return Object.freeze((transactions || []).filter(function(transaction) {
    if (filters.account_ids.length && filters.account_ids.indexOf(String(transaction.account_id || '')) < 0) return false;
    if (filters.category_ids.length && filters.category_ids.indexOf(String(transaction.category_id || '')) < 0) return false;
    if (filters.member_ids.length && filters.member_ids.indexOf(String(transaction.member_id || '')) < 0) return false;
    return true;
  }));
}

function prhR2FinSectionsFilterContext_(filters) {
  var rows = [];
  filters.account_ids.forEach(function(value) { rows.push({ kind: 'MEMBER', field: 'account_id', operator: 'IN', values: [value] }); });
  filters.category_ids.forEach(function(value) { rows.push({ kind: 'MEMBER', field: 'category_id', operator: 'IN', values: [value] }); });
  filters.member_ids.forEach(function(value) { rows.push({ kind: 'MEMBER', field: 'member_id', operator: 'IN', values: [value] }); });
  return Object.freeze({ schema: 'PRH_FILTER_CONTEXT_V1', contract_version: '1.0.0', filters: Object.freeze(rows) });
}

function prhR2FinSectionsLabel_(source, kind, id) {
  if (!id) return 'Без категории';
  try {
    return source.dimensions.displayLabel(kind, id);
  } catch (_) {
    return String(id);
  }
}

function prhR2FinSectionsOptions_(source, kind, key) {
  var seen = {};
  var rows = [];
  (source.transactions || []).forEach(function(transaction) {
    var id = transaction && transaction[key];
    if (!id) return;
    id = String(id);
    if (seen[id]) return;
    seen[id] = true;
    rows.push(Object.freeze({ id: id, label: prhR2FinSectionsLabel_(source, kind, id) }));
  });
  rows.sort(function(a, b) { return a.label.localeCompare(b.label); });
  return Object.freeze(rows);
}

function prhR2FinSectionsExpenseView_(source, expense) {
  return Object.freeze({
    total_expense_minor: expense.total_expense_minor,
    comparison_expense_minor: expense.comparison_expense_minor,
    delta_minor: expense.delta_minor,
    trend: Object.freeze(expense.trend.points.map(function(point) {
      return Object.freeze({ day: point.time_bucket, value_minor: point.expense_minor });
    })),
    category_mix: Object.freeze(expense.category_mix.rows.map(function(row) {
      return Object.freeze({
        category_id: row.category_id,
        category_label: prhR2FinSectionsLabel_(source, 'category', row.category_id),
        value_minor: row.expense_minor
      });
    })),
    drivers: Object.freeze(expense.drivers.rows.map(function(row) {
      return Object.freeze({
        category_id: row.category_id,
        category_label: prhR2FinSectionsLabel_(source, 'category', row.category_id),
        current_minor: row.current_expense_minor,
        comparison_minor: row.comparison_expense_minor,
        delta_minor: row.delta_minor
      });
    }))
  });
}

function prhR2FinSectionsIncomeView_(source, income) {
  return Object.freeze({
    total_income_minor: income.total_income_minor,
    comparison_income_minor: income.comparison_income_minor,
    delta_minor: income.delta_minor,
    trend: Object.freeze(income.trend.points.map(function(point) {
      return Object.freeze({ day: point.time_bucket, value_minor: point.income_minor });
    })),
    source_mix: Object.freeze(income.source_mix.rows.map(function(row) {
      return Object.freeze({
        source_id: row.category_id,
        source_label: prhR2FinSectionsLabel_(source, 'category', row.category_id),
        value_minor: row.income_minor
      });
    }))
  });
}

function prhR2FinSectionsCashFlowView_(cashFlow) {
  return Object.freeze({
    inflow_minor: cashFlow.inflow_minor,
    outflow_minor: cashFlow.outflow_minor,
    net_minor: cashFlow.net_minor,
    comparison_inflow_minor: cashFlow.comparison_inflow_minor,
    comparison_outflow_minor: cashFlow.comparison_outflow_minor,
    comparison_net_minor: cashFlow.comparison_net_minor,
    delta_net_minor: cashFlow.delta_net_minor,
    trend: Object.freeze(cashFlow.trend.points.map(function(point) {
      return Object.freeze({
        day: point.time_bucket,
        inflow_minor: point.inflow_minor,
        outflow_minor: point.outflow_minor,
        net_minor: point.net_minor
      });
    }))
  });
}

function prhR2BuildFinancialSectionsView_(request) {
  var normalized = prhR2FinSectionsRequest_(request);
  if (normalized.privacy_mode === 'DEMO') {
    return Object.freeze({
      schema: PRH_R2_FIN_SECTIONS_RUNTIME.SCHEMA,
      version: PRH_R2_FIN_SECTIONS_RUNTIME.VERSION,
      state: 'PRIVACY_MODE_UNAVAILABLE',
      privacy_mode: normalized.privacy_mode,
      section: normalized.section,
      retryable: false,
      reason_code: 'PRIVATE_FINANCIAL_SECTIONS_DEMO_DISABLED',
      financial_write_authorized: false,
      canonical_mutation_performed: false
    });
  }
  var source = prhR2DataCreateSnapshot_();
  if (!source || !Array.isArray(source.transactions) || !source.revision || !source.currency || !source.dimensions) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_SOURCE_UNAVAILABLE');
  }
  if (normalized.expected_revision && normalized.expected_revision !== source.revision) {
    return Object.freeze({
      schema: PRH_R2_FIN_SECTIONS_RUNTIME.SCHEMA,
      version: PRH_R2_FIN_SECTIONS_RUNTIME.VERSION,
      state: 'STALE_SNAPSHOT',
      privacy_mode: normalized.privacy_mode,
      section: normalized.section,
      snapshot_revision: source.revision,
      snapshot_revision_prefix: source.revision.slice(0, 12),
      retryable: true,
      reason_code: 'R2_FIN_SECTIONS_STALE_SNAPSHOT',
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
