/**
 * FIN-REC-001 read-only private Expenses / Income / Cash Flow runtime bridge.
 *
 * Performance recovery v3:
 * - one immutable canonical snapshot per request;
 * - two bounded canonical analytics queries per visible section;
 * - daily trend is grouped once by PRH_ANALYTICS_CONTRACT_V1 instead of
 *   re-scanning the same transaction set once per day bucket;
 * - comparison/category rows are computed by the same canonical analytics
 *   authority, so the Web App still owns no financial formulas;
 * - zero financial write / canonical mutation authority.
 */
var PRH_R2_FIN_SECTIONS_RUNTIME = Object.freeze({
  SCHEMA: 'PRH_R2_PRIVATE_FINANCIAL_SECTIONS_VIEW_V1',
  VERSION: '1.0.0',
  FINANCIAL_TRUTH_POLICY: 'FIN-TRUTH-v1',
  ANALYTICS_QUERY_SCHEMA: 'PRH_ANALYTICS_QUERY_V1',
  ANALYTICS_RESULT_SCHEMA: 'PRH_ANALYTICS_RESULT_V1',
  ANALYTICS_CONTRACT_VERSION: '1.0.0',
  FILTER_CONTEXT_SCHEMA: 'PRH_FILTER_CONTEXT_V1',
  FILTER_CONTEXT_VERSION: '1.0.0',
  DEFAULT_WINDOW_DAYS: 90,
  ALLOWED_WINDOW_DAYS: Object.freeze([30, 90, 180, 365]),
  ALLOWED_SECTIONS: Object.freeze(['expenses', 'income', 'cash-flow']),
  MAX_FILTER_VALUES: 16,
  ANALYTICS_MAX_ROWS: 5000,
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
  if (['NORMAL', 'MASKED', 'DEMO', 'ZEN'].indexOf(mode) < 0) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_PRIVACY_MODE_INVALID');
  }
  return mode;
}

function prhR2FinSectionsWindowDays_(value) {
  var days = value == null || value === ''
    ? PRH_R2_FIN_SECTIONS_RUNTIME.DEFAULT_WINDOW_DAYS
    : Number(value);
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
  if (source.length > PRH_R2_FIN_SECTIONS_RUNTIME.MAX_FILTER_VALUES) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_FILTER_LIMIT');
  }
  var seen = {};
  return source.map(function(item) {
    return String(item || '').trim();
  }).filter(function(item) {
    if (!item || item.length > 160 || seen[item]) return false;
    seen[item] = true;
    return true;
  }).sort();
}

function prhR2FinSectionsRequest_(request) {
  var input = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
  var filters = input.filters && typeof input.filters === 'object' && !Array.isArray(input.filters)
    ? input.filters
    : {};
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
  if (!Number.isFinite(date.getTime()) || prhR2FinSectionsIsoDay_(date) !== isoDay) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_DATE_INVALID');
  }
  date.setUTCDate(date.getUTCDate() + days);
  return prhR2FinSectionsIsoDay_(date);
}

function prhR2FinSectionsPeriod_(transactions, windowDays) {
  var latest = '';
  transactions.forEach(function(tx) {
    var day = String(tx && tx.occurred_at || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      prhR2FinSectionsFail_('R2_FIN_SECTIONS_TRANSACTION_DATE_INVALID');
    }
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
    filters: Object.freeze(definitions.filter(function(item) {
      return item[1].length > 0;
    }).map(function(item) {
      return Object.freeze({
        kind: 'DIMENSION',
        field: item[0],
        operator: 'INCLUDE',
        values: Object.freeze(item[1].slice())
      });
    }))
  });
}

function prhR2FinSectionsAnalyticsFilters_(filters) {
  var definitions = [
    ['account_id', filters.account_ids],
    ['category_id', filters.category_ids],
    ['member_id', filters.member_ids]
  ];
  return Object.freeze(definitions.filter(function(item) {
    return item[1].length > 0;
  }).map(function(item) {
    return Object.freeze({
      field: item[0],
      operator: 'IN',
      values: Object.freeze(item[1].slice())
    });
  }));
}

function prhR2FinSectionsApplyFilters_(transactions, filters) {
  function matches(value, allowed) {
    return !allowed.length || allowed.indexOf(String(value || '')) >= 0;
  }
  return transactions.filter(function(tx) {
    return matches(tx.account_id, filters.account_ids) &&
      matches(tx.category_id, filters.category_ids) &&
      matches(tx.member_id, filters.member_ids);
  });
}

function prhR2FinSectionsScopeAnalyticsInputs_(transactions, period) {
  var start = period.comparison.start;
  var end = period.current.end;
  return transactions.filter(function(tx) {
    var day = String(tx && tx.occurred_at || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      prhR2FinSectionsFail_('R2_FIN_SECTIONS_TRANSACTION_DATE_INVALID');
    }
    return day >= start && day < end;
  });
}

function prhR2FinSectionsLabel_(source, kind, id, fallback) {
  if (id == null || id === '') return fallback || 'Без значения';
  try {
    return source.dimensions.displayLabel(kind, id);
  } catch (error) {
    return fallback || 'Без значения';
  }
}

function prhR2FinSectionsOptions_(source, kind, field) {
  var seen = {};
  source.transactions.forEach(function(tx) {
    var id = tx[field];
    if (id == null || id === '' || seen[id]) return;
    seen[id] = true;
  });
  return Object.freeze(Object.keys(seen).map(function(id) {
    return Object.freeze({
      value: id,
      label: prhR2FinSectionsLabel_(source, kind, id, 'Без значения')
    });
  }).sort(function(left, right) {
    return left.label.localeCompare(right.label, 'ru');
  }));
}

function prhR2FinSectionsAnalyticsQuery_(source, period, filters, measures, dimensions, grain, comparisonMode) {
  return Object.freeze({
    schema: PRH_R2_FIN_SECTIONS_RUNTIME.ANALYTICS_QUERY_SCHEMA,
    contract_version: PRH_R2_FIN_SECTIONS_RUNTIME.ANALYTICS_CONTRACT_VERSION,
    currency: source.currency,
    measures: Object.freeze(measures.slice()),
    dimensions: Object.freeze(dimensions.slice()),
    filters: prhR2FinSectionsAnalyticsFilters_(filters),
    time_range: Object.freeze({ start: period.current.start, end: period.current.end }),
    grain: grain,
    comparison: Object.freeze({ mode: comparisonMode || 'NONE' }),
    sort: Object.freeze([]),
    parameters: Object.freeze({}),
    limit: PRH_R2_FIN_SECTIONS_RUNTIME.ANALYTICS_MAX_ROWS
  });
}

function prhR2FinSectionsRunAnalytics_(source, query) {
  if (!source.cycle || typeof source.cycle.analytics !== 'function') {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_ANALYTICS_CAPABILITY_MISSING');
  }
  var result = source.cycle.analytics(query);
  if (!result || result.schema !== PRH_R2_FIN_SECTIONS_RUNTIME.ANALYTICS_RESULT_SCHEMA ||
      result.contract_version !== PRH_R2_FIN_SECTIONS_RUNTIME.ANALYTICS_CONTRACT_VERSION ||
      !result.provenance || result.provenance.input_revision !== source.revision ||
      result.provenance.financial_truth_policy !== PRH_R2_FIN_SECTIONS_RUNTIME.FINANCIAL_TRUTH_POLICY) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_ANALYTICS_RESULT_INVALID');
  }
  if (result.truncated === true) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_ANALYTICS_RESULT_TRUNCATED');
  }
  return result;
}

function prhR2FinSectionsMeasure_(row, measure, comparison) {
  var source = comparison ? row && row.comparison_measures : row && row.measures;
  var value = source && source[measure];
  if (!Number.isSafeInteger(value)) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_ANALYTICS_MEASURE_INVALID');
  }
  return value;
}

function prhR2FinSectionsAssertComparison_(result, expected) {
  var actual = result && result.comparison && result.comparison.time_range;
  if (!actual || actual.start !== expected.start || actual.end !== expected.end) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_COMPARISON_PERIOD_MISMATCH');
  }
}

function prhR2FinSectionsDailySeries_(result, period, measures) {
  var byDay = {};
  result.rows.forEach(function(row) {
    var day = row && row.dimensions && String(row.dimensions.time_bucket || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || byDay[day]) {
      prhR2FinSectionsFail_('R2_FIN_SECTIONS_DAILY_ANALYTICS_ROW_INVALID');
    }
    var values = {};
    measures.forEach(function(measure) {
      values[measure] = prhR2FinSectionsMeasure_(row, measure, false);
    });
    byDay[day] = Object.freeze(values);
  });

  var rows = [];
  var cursor = period.current.start;
  while (cursor < period.current.end) {
    var existing = byDay[cursor] || null;
    var values = {};
    measures.forEach(function(measure) {
      values[measure] = existing ? existing[measure] : 0;
    });
    rows.push(Object.freeze({ time_bucket: cursor, values: Object.freeze(values) }));
    cursor = prhR2FinSectionsAddDays_(cursor, 1);
  }
  return Object.freeze(rows);
}

function prhR2FinSectionsCategoryComparisonRows_(result, measure) {
  return Object.freeze(result.rows.map(function(row) {
    var categoryId = row && row.dimensions && String(row.dimensions.category_id || '').trim();
    if (!categoryId) prhR2FinSectionsFail_('R2_FIN_SECTIONS_CATEGORY_ANALYTICS_ROW_INVALID');
    return Object.freeze({
      category_id: categoryId,
      current_minor: prhR2FinSectionsMeasure_(row, measure, false),
      comparison_minor: prhR2FinSectionsMeasure_(row, measure, true)
    });
  }));
}

function prhR2FinSectionsSum_(rows, selector) {
  return rows.reduce(function(sum, row) {
    var value = selector(row);
    if (!Number.isSafeInteger(value) || !Number.isSafeInteger(sum + value)) {
      prhR2FinSectionsFail_('R2_FIN_SECTIONS_SUM_RANGE_INVALID');
    }
    return sum + value;
  }, 0);
}

function prhR2FinSectionsExpenseFastView_(source, period, filters) {
  var trendResult = prhR2FinSectionsRunAnalytics_(source, prhR2FinSectionsAnalyticsQuery_(
    source, period, filters, ['EXPENSE'], [], 'DAY', 'NONE'
  ));
  var categoryResult = prhR2FinSectionsRunAnalytics_(source, prhR2FinSectionsAnalyticsQuery_(
    source, period, filters, ['EXPENSE'], ['category_id'], 'NONE', 'PREVIOUS_PERIOD'
  ));
  prhR2FinSectionsAssertComparison_(categoryResult, period.comparison);

  var daily = prhR2FinSectionsDailySeries_(trendResult, period, ['EXPENSE']);
  var categories = prhR2FinSectionsCategoryComparisonRows_(categoryResult, 'EXPENSE');
  categories.forEach(function(row) {
    if (row.current_minor < 0 || row.comparison_minor < 0) {
      prhR2FinSectionsFail_('R2_FIN_SECTIONS_EXPENSE_CATEGORY_NEGATIVE_UNSUPPORTED');
    }
  });

  var currentTotal = prhR2FinSectionsSum_(daily, function(row) { return row.values.EXPENSE; });
  var categoryCurrentTotal = prhR2FinSectionsSum_(categories, function(row) { return row.current_minor; });
  var comparisonTotal = prhR2FinSectionsSum_(categories, function(row) { return row.comparison_minor; });
  if (categoryCurrentTotal !== currentTotal) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_EXPENSE_CATEGORY_PARITY_FAILED');
  }
  var delta = currentTotal - comparisonTotal;
  if (!Number.isSafeInteger(delta)) prhR2FinSectionsFail_('R2_FIN_SECTIONS_SUM_RANGE_INVALID');

  var drivers = categories.map(function(row) {
    return Object.freeze({
      category_id: row.category_id,
      current_minor: row.current_minor,
      comparison_minor: row.comparison_minor,
      delta_minor: row.current_minor - row.comparison_minor
    });
  });
  if (prhR2FinSectionsSum_(drivers, function(row) { return row.delta_minor; }) !== delta) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_EXPENSE_DRIVER_PARITY_FAILED');
  }

  return Object.freeze({
    total_expense_minor: currentTotal,
    comparison_expense_minor: comparisonTotal,
    delta_minor: delta,
    trend: Object.freeze(daily.map(function(row) {
      return Object.freeze({ time_bucket: row.time_bucket, expense_minor: row.values.EXPENSE });
    })),
    category_mix: Object.freeze(categories.filter(function(row) {
      return row.current_minor !== 0;
    }).sort(function(left, right) {
      return right.current_minor - left.current_minor || left.category_id.localeCompare(right.category_id);
    }).map(function(row) {
      return Object.freeze({
        category_id: row.category_id,
        category_label: prhR2FinSectionsLabel_(source, 'category', row.category_id, 'Без категории'),
        expense_minor: row.current_minor
      });
    })),
    drivers: Object.freeze(drivers.filter(function(row) {
      return row.delta_minor !== 0;
    }).sort(function(left, right) {
      return Math.abs(right.delta_minor) - Math.abs(left.delta_minor) || left.category_id.localeCompare(right.category_id);
    }).map(function(row) {
      return Object.freeze({
        category_id: row.category_id,
        category_label: prhR2FinSectionsLabel_(source, 'category', row.category_id, 'Без категории'),
        delta_minor: row.delta_minor
      });
    }))
  });
}

function prhR2FinSectionsIncomeStability_(daily) {
  var values = daily.map(function(row) { return row.values.INCOME; });
  if (!values.length) prhR2FinSectionsFail_('R2_FIN_SECTIONS_INCOME_STABILITY_EMPTY');
  var sum = values.reduce(function(total, value) { return total + value; }, 0);
  var mean = sum / values.length;
  var variance = values.reduce(function(total, value) {
    return total + Math.pow(value - mean, 2);
  }, 0) / values.length;
  var stddev = Math.sqrt(variance);
  if (![mean, variance, stddev].every(Number.isFinite)) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_INCOME_STABILITY_INVALID');
  }
  if (mean === 0) {
    return Object.freeze({ state: 'NO_INCOME', stability_score: null });
  }
  var cv = stddev / Math.abs(mean);
  return Object.freeze({
    state: 'READY',
    stability_score: Math.round(100 - Math.min(100, cv * 100))
  });
}

function prhR2FinSectionsIncomeFastView_(source, period, filters) {
  var trendResult = prhR2FinSectionsRunAnalytics_(source, prhR2FinSectionsAnalyticsQuery_(
    source, period, filters, ['INCOME'], [], 'DAY', 'NONE'
  ));
  var categoryResult = prhR2FinSectionsRunAnalytics_(source, prhR2FinSectionsAnalyticsQuery_(
    source, period, filters, ['INCOME'], ['category_id'], 'NONE', 'PREVIOUS_PERIOD'
  ));
  prhR2FinSectionsAssertComparison_(categoryResult, period.comparison);

  var daily = prhR2FinSectionsDailySeries_(trendResult, period, ['INCOME']);
  var categories = prhR2FinSectionsCategoryComparisonRows_(categoryResult, 'INCOME');
  var currentTotal = prhR2FinSectionsSum_(daily, function(row) { return row.values.INCOME; });
  var categoryCurrentTotal = prhR2FinSectionsSum_(categories, function(row) { return row.current_minor; });
  var comparisonTotal = prhR2FinSectionsSum_(categories, function(row) { return row.comparison_minor; });
  if (categoryCurrentTotal !== currentTotal) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_INCOME_CATEGORY_PARITY_FAILED');
  }
  var delta = currentTotal - comparisonTotal;
  if (!Number.isSafeInteger(delta)) prhR2FinSectionsFail_('R2_FIN_SECTIONS_SUM_RANGE_INVALID');

  var deltas = categories.map(function(row) {
    return Object.freeze({
      source_id: row.category_id,
      current_minor: row.current_minor,
      comparison_minor: row.comparison_minor,
      delta_minor: row.current_minor - row.comparison_minor
    });
  });
  if (prhR2FinSectionsSum_(deltas, function(row) { return row.delta_minor; }) !== delta) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_INCOME_DRIVER_PARITY_FAILED');
  }

  return Object.freeze({
    total_income_minor: currentTotal,
    comparison_income_minor: comparisonTotal,
    delta_minor: delta,
    stability: prhR2FinSectionsIncomeStability_(daily),
    trend: Object.freeze(daily.map(function(row) {
      return Object.freeze({ time_bucket: row.time_bucket, income_minor: row.values.INCOME });
    })),
    source_mix: Object.freeze(categories.filter(function(row) {
      return row.current_minor !== 0;
    }).sort(function(left, right) {
      return right.current_minor - left.current_minor || left.category_id.localeCompare(right.category_id);
    }).map(function(row) {
      return Object.freeze({
        source_id: row.category_id,
        source_label: prhR2FinSectionsLabel_(source, 'category', row.category_id, 'Без категории'),
        income_minor: row.current_minor
      });
    })),
    source_deltas: Object.freeze(deltas.filter(function(row) {
      return row.delta_minor !== 0;
    }).sort(function(left, right) {
      return Math.abs(right.delta_minor) - Math.abs(left.delta_minor) || left.source_id.localeCompare(right.source_id);
    }).map(function(row) {
      return Object.freeze({
        source_id: row.source_id,
        source_label: prhR2FinSectionsLabel_(source, 'category', row.source_id, 'Без категории'),
        delta_minor: row.delta_minor
      });
    }))
  });
}

function prhR2FinSectionsCashFlowFastView_(source, period, filters) {
  var measures = ['INCOME', 'EXPENSE', 'CASH_FLOW'];
  var trendResult = prhR2FinSectionsRunAnalytics_(source, prhR2FinSectionsAnalyticsQuery_(
    source, period, filters, measures, [], 'DAY', 'NONE'
  ));
  var scalarResult = prhR2FinSectionsRunAnalytics_(source, prhR2FinSectionsAnalyticsQuery_(
    source, period, filters, measures, [], 'NONE', 'PREVIOUS_PERIOD'
  ));
  prhR2FinSectionsAssertComparison_(scalarResult, period.comparison);
  if (!Array.isArray(scalarResult.rows) || scalarResult.rows.length !== 1) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_CASH_FLOW_SCALAR_INVALID');
  }

  var scalar = scalarResult.rows[0];
  var current = {
    inflow_minor: prhR2FinSectionsMeasure_(scalar, 'INCOME', false),
    outflow_minor: prhR2FinSectionsMeasure_(scalar, 'EXPENSE', false),
    net_minor: prhR2FinSectionsMeasure_(scalar, 'CASH_FLOW', false)
  };
  var previous = {
    inflow_minor: prhR2FinSectionsMeasure_(scalar, 'INCOME', true),
    outflow_minor: prhR2FinSectionsMeasure_(scalar, 'EXPENSE', true),
    net_minor: prhR2FinSectionsMeasure_(scalar, 'CASH_FLOW', true)
  };
  if (current.inflow_minor - current.outflow_minor !== current.net_minor ||
      previous.inflow_minor - previous.outflow_minor !== previous.net_minor) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_CASH_FLOW_IDENTITY_FAILED');
  }

  var daily = prhR2FinSectionsDailySeries_(trendResult, period, measures);
  daily.forEach(function(row) {
    if (row.values.INCOME - row.values.EXPENSE !== row.values.CASH_FLOW) {
      prhR2FinSectionsFail_('R2_FIN_SECTIONS_CASH_FLOW_DAILY_IDENTITY_FAILED');
    }
  });
  var inflowSum = prhR2FinSectionsSum_(daily, function(row) { return row.values.INCOME; });
  var outflowSum = prhR2FinSectionsSum_(daily, function(row) { return row.values.EXPENSE; });
  var netSum = prhR2FinSectionsSum_(daily, function(row) { return row.values.CASH_FLOW; });
  if (inflowSum !== current.inflow_minor || outflowSum !== current.outflow_minor || netSum !== current.net_minor) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_CASH_FLOW_TREND_PARITY_FAILED');
  }

  var inflowDelta = current.inflow_minor - previous.inflow_minor;
  var outflowDelta = current.outflow_minor - previous.outflow_minor;
  var netDelta = current.net_minor - previous.net_minor;
  if (inflowDelta - outflowDelta !== netDelta) {
    prhR2FinSectionsFail_('R2_FIN_SECTIONS_CASH_FLOW_DELTA_IDENTITY_FAILED');
  }

  return Object.freeze({
    inflow_minor: current.inflow_minor,
    outflow_minor: current.outflow_minor,
    net_minor: current.net_minor,
    comparison: Object.freeze({
      inflow_minor: previous.inflow_minor,
      outflow_minor: previous.outflow_minor,
      net_minor: previous.net_minor,
      inflow_delta_minor: inflowDelta,
      outflow_delta_minor: outflowDelta,
      net_delta_minor: netDelta
    }),
    trend: Object.freeze(daily.map(function(row) {
      return Object.freeze({
        time_bucket: row.time_bucket,
        inflow_minor: row.values.INCOME,
        outflow_minor: row.values.EXPENSE,
        net_minor: row.values.CASH_FLOW
      });
    })),
    liquidity_state: 'NOT_A_BALANCE_METRIC',
    account_balance_authority: false
  });
}

function prhR2BuildFinancialSectionsView_(request) {
  var started = Date.now();
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

  prhR2FinSectionsRuntime_();
  var source = prhR2DataCreateSnapshot_();
  var snapshotMs = source.telemetry && Number.isFinite(Number(source.telemetry.elapsed_ms))
    ? Math.max(0, Number(source.telemetry.elapsed_ms))
    : Math.max(0, Date.now() - started);

  if (normalized.expected_revision) {
    if (!/^[0-9a-f]{64}$/.test(normalized.expected_revision)) {
      prhR2FinSectionsFail_('R2_FIN_SECTIONS_EXPECTED_REVISION_INVALID');
    }
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
      telemetry: Object.freeze({
        canonical_snapshot_read_count: 1,
        analytics_build_count: 0,
        analytics_query_count: 0,
        analytics_section: normalized.section,
        snapshot_elapsed_ms: snapshotMs,
        financial_payload_in_telemetry: false
      })
    });
  }

  var period = prhR2FinSectionsPeriod_(source.transactions, normalized.window_days);
  var filtered = prhR2FinSectionsApplyFilters_(source.transactions, normalized.filters);
  var scoped = prhR2FinSectionsScopeAnalyticsInputs_(filtered, period);
  var filterContext = prhR2FinSectionsFilterContext_(normalized.filters);
  var expense = null;
  var income = null;
  var cashFlow = null;
  var analyticsStarted = Date.now();

  if (normalized.section === 'expenses') {
    expense = prhR2FinSectionsExpenseFastView_(source, period, normalized.filters);
  } else if (normalized.section === 'income') {
    income = prhR2FinSectionsIncomeFastView_(source, period, normalized.filters);
  } else {
    cashFlow = prhR2FinSectionsCashFlowFastView_(source, period, normalized.filters);
  }
  var analyticsMs = Math.max(0, Date.now() - analyticsStarted);
  var cycleTelemetry = source.cycle && typeof source.cycle.getTelemetry === 'function'
    ? source.cycle.getTelemetry()
    : {};

  return Object.freeze({
    schema: PRH_R2_FIN_SECTIONS_RUNTIME.SCHEMA,
    version: PRH_R2_FIN_SECTIONS_RUNTIME.VERSION,
    state: scoped.length ? 'READY' : 'EMPTY_FILTER_RESULT',
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
      context: filterContext,
      options: Object.freeze({
        accounts: prhR2FinSectionsOptions_(source, 'account', 'account_id'),
        categories: prhR2FinSectionsOptions_(source, 'category', 'category_id'),
        members: prhR2FinSectionsOptions_(source, 'member', 'member_id')
      })
    }),
    expenses: expense,
    income: income,
    cash_flow: cashFlow,
    retryable: true,
    reason_code: null,
    financial_write_authorized: false,
    canonical_mutation_performed: false,
    telemetry: Object.freeze({
      canonical_snapshot_read_count: 1,
      snapshot_reuse_count: Number(cycleTelemetry.snapshot_reuse_count || 0),
      filtered_record_count: filtered.length,
      analytics_input_record_count: scoped.length,
      analytics_scope_days: normalized.window_days * 2,
      analytics_build_count: 1,
      analytics_query_count: 2,
      analytics_section: normalized.section,
      analytics_runtime_authority: 'PRH_ANALYTICS_CONTRACT_V1',
      snapshot_elapsed_ms: snapshotMs,
      analytics_elapsed_ms: analyticsMs,
      total_elapsed_ms: Math.max(0, Date.now() - started),
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
  try {
    section = prhR2FinSectionsSection_(request && request.section);
  } catch (_) {}
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
