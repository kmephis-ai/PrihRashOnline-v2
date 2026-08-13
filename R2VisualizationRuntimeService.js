var PRH_R2_VISUAL_RUNTIME = Object.freeze({
  SCHEMA: 'PRH_R2_HOUSEHOLD_VISUAL_RUNTIME_V1',
  VERSION: '1.1.0',
  PAYLOAD_SCHEMA: 'PRH_R2_HOUSEHOLD_VISUAL_PAYLOAD_V1',
  FINANCIAL_TRUTH_POLICY: 'FIN-TRUTH-v1',
  PERIOD_COUNT: 6,
  RENDERER: 'ECHARTS_6',
  READY: 'READY',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  WRITE_AUTHORITY: false,
  FINANCIAL_FORMULA_COPY: false,
  UI_FINANCIAL_FORMULA_AUTHORITY: false,
  UI_CHART_OPTION_AUTHORITY: false,
  FREE_ONLY: true
});

function prhR2VisualFail_(code) {
  var error = new Error(String(code || 'R2_VISUAL_RUNTIME_ERROR'));
  error.code = String(code || 'R2_VISUAL_RUNTIME_ERROR');
  throw error;
}

function prhR2VisualAssertRuntime_(runtime) {
  if (!runtime || !runtime.recentMonthsProjection ||
      runtime.recentMonthsProjection.SCHEMA !== 'PRH_GOOGLE_RECENT_MONTHS_SNAPSHOT_V1' ||
      runtime.recentMonthsProjection.DEFAULT_PERIOD_COUNT !== PRH_R2_VISUAL_RUNTIME.PERIOD_COUNT ||
      !runtime.kpiDictionary || typeof runtime.kpiDictionary.evaluateKpis !== 'function' ||
      !runtime.home || typeof runtime.home.buildFinancialHome !== 'function' ||
      typeof runtime.home.compileHouseholdCashFlowChart !== 'function' ||
      typeof runtime.home.compileHouseholdExpenseMixChart !== 'function' ||
      !runtime.financialReconciliation || typeof runtime.financialReconciliation.aggregateTransactions !== 'function') {
    prhR2VisualFail_('R2_VISUAL_RUNTIME_CANONICAL_MODULES_REQUIRED');
  }
  return true;
}

function prhR2VisualGateway_() {
  if (typeof prhGoogleRepositoryReadOperationsTable_ !== 'function') {
    prhR2VisualFail_('R2_VISUAL_RUNTIME_GOOGLE_GATEWAY_REQUIRED');
  }
  var calls = 0;
  return Object.freeze({
    readOperationsTable: function(request) {
      calls += 1;
      return prhGoogleRepositoryReadOperationsTable_(request || {});
    },
    calls: function() { return calls; }
  });
}

function prhR2VisualPeriodResult_(runtime, entry, currency) {
  var result = runtime.kpiDictionary.evaluateKpis(entry.items, {
    currency: currency,
    period: entry.period
  });
  if (!result || result.financial_truth_policy !== PRH_R2_VISUAL_RUNTIME.FINANCIAL_TRUTH_POLICY ||
      !Number.isSafeInteger(result.cash_flow_minor)) {
    prhR2VisualFail_('R2_VISUAL_RUNTIME_FIN010_RESULT_INVALID');
  }
  return Object.freeze({
    period: entry.period,
    cash_flow_minor: result.cash_flow_minor
  });
}

function prhR2VisualLatestExpenseMix_(runtime, latestEntry, dimensions, currency) {
  var homeView = runtime.home.buildFinancialHome(latestEntry.items, {
    currency: currency,
    period: latestEntry.period
  });
  if (!homeView || homeView.financial_truth_policy !== PRH_R2_VISUAL_RUNTIME.FINANCIAL_TRUTH_POLICY) {
    prhR2VisualFail_('R2_VISUAL_RUNTIME_HOME_VIEW_INVALID');
  }
  var source = Object.freeze({
    transactions: latestEntry.items,
    dimensions: dimensions
  });
  var visualData = prhR2FinVisualData_(runtime, source, homeView);
  if (!visualData || !Array.isArray(visualData.expense_mix)) {
    prhR2VisualFail_('R2_VISUAL_RUNTIME_EXPENSE_MIX_INVALID');
  }
  return Object.freeze({
    home_view: homeView,
    expense_mix: visualData.expense_mix
  });
}

function prhR2VisualAssertCompiledChart_(chart, expectedSeriesType) {
  if (!chart || chart.renderer !== PRH_R2_VISUAL_RUNTIME.RENDERER || !chart.option ||
      !chart.option.aria || chart.option.aria.enabled !== true || !Array.isArray(chart.option.series) ||
      chart.option.series.length !== 1 || chart.option.series[0].type !== expectedSeriesType) {
    prhR2VisualFail_('R2_VISUAL_RUNTIME_COMPILED_CHART_INVALID');
  }
  return chart;
}

function prhR2VisualCompileCharts_(runtime, status, periodResults, expenseMix) {
  var cashFlow = null;
  if (status === PRH_R2_VISUAL_RUNTIME.READY) {
    cashFlow = prhR2VisualAssertCompiledChart_(
      runtime.home.compileHouseholdCashFlowChart(periodResults),
      'line'
    );
  }
  var expense = null;
  if (Array.isArray(expenseMix) && expenseMix.length) {
    expense = prhR2VisualAssertCompiledChart_(
      runtime.home.compileHouseholdExpenseMixChart(expenseMix),
      'pie'
    );
  }
  return Object.freeze({
    cash_flow: cashFlow,
    expense_mix: expense
  });
}

function prhR2BuildFinancialHomeVisualRuntime_() {
  var started = Date.now();
  var runtime = prhR2CanonicalRuntime_();
  prhR2VisualAssertRuntime_(runtime);
  var currency = prhR2FinCurrency_();
  var dimensions = prhR2FinCreateDimensionResolverState_();
  var gateway = prhR2VisualGateway_();
  var recent = runtime.recentMonthsProjection.readRecentCalendarMonths(gateway, {
    default_currency: currency,
    resolvers: dimensions.resolvers
  }, PRH_R2_VISUAL_RUNTIME.PERIOD_COUNT);

  if (!recent || recent.schema !== runtime.recentMonthsProjection.SCHEMA ||
      recent.requested_period_count !== PRH_R2_VISUAL_RUNTIME.PERIOD_COUNT ||
      !Array.isArray(recent.periods)) {
    prhR2VisualFail_('R2_VISUAL_RUNTIME_RECENT_PERIODS_INVALID');
  }

  var periodResults = recent.periods.map(function(entry) {
    return prhR2VisualPeriodResult_(runtime, entry, currency);
  });
  var latestDetails = null;
  if (recent.periods.length) {
    latestDetails = prhR2VisualLatestExpenseMix_(
      runtime,
      recent.periods[recent.periods.length - 1],
      dimensions,
      currency
    );
  }

  var status = recent.complete === true
    ? PRH_R2_VISUAL_RUNTIME.READY
    : PRH_R2_VISUAL_RUNTIME.INSUFFICIENT_DATA;
  if (status === PRH_R2_VISUAL_RUNTIME.READY && periodResults.length < PRH_R2_VISUAL_RUNTIME.PERIOD_COUNT) {
    prhR2VisualFail_('R2_VISUAL_RUNTIME_READY_PERIOD_COUNT_INVALID');
  }

  var expenseMix = latestDetails ? latestDetails.expense_mix : Object.freeze([]);
  var charts = prhR2VisualCompileCharts_(runtime, status, periodResults, expenseMix);
  var result = Object.freeze({
    schema: PRH_R2_VISUAL_RUNTIME.PAYLOAD_SCHEMA,
    contract_version: PRH_R2_VISUAL_RUNTIME.VERSION,
    status: status,
    currency: currency,
    requested_period_count: recent.requested_period_count,
    available_period_count: recent.available_period_count,
    observed_period_count: recent.observed_period_count,
    cash_flow_periods: Object.freeze(periodResults),
    expense_mix: expenseMix,
    charts: charts,
    latest_period: latestDetails ? latestDetails.home_view.period : null,
    provenance: Object.freeze({
      financial_truth_policy: PRH_R2_VISUAL_RUNTIME.FINANCIAL_TRUTH_POLICY,
      financial_authority: 'FIN010_EVALUATE_KPIS',
      period_source: 'PRH_GOOGLE_RECENT_MONTHS_SNAPSHOT_V1',
      latest_expense_source: 'CANONICAL_HOME_VISUAL_DATA',
      chart_spec_authority: 'CANONICAL_HOME_WIDGET_SPECS',
      chart_compiler: 'HOUSEHOLD_VISUAL_PROJECTION_TO_ECHARTS_6',
      renderer: PRH_R2_VISUAL_RUNTIME.RENDERER,
      gateway_call_count: gateway.calls(),
      full_history_canonical_scan_used: false,
      repeated_repository_query_used: false,
      synthetic_zero_fill_used: false,
      financial_formula_copy: false,
      ui_financial_formula_authority: false,
      ui_chart_option_authority: false,
      write_authority: false,
      free_only: true,
      build_ms: Date.now() - started
    })
  });
  return result;
}

var PRH_R2_VISUAL_PRESENTATION = Object.freeze({
  SCHEMA: 'PRH_R2_HOUSEHOLD_VISUAL_PRESENTATION_V1',
  VERSION: '1.0.0',
  NORMAL: 'NORMAL',
  MASKED: 'MASKED',
  REDACTED: 'REDACTED',
  CHART_OPTION_AUTHORITY: 'SERVER_ONLY',
  WRITE_AUTHORITY: false,
  FREE_ONLY: true
});

function prhR2VisualPresentation_(mode, payload) {
  var normalizedMode = String(mode || '').trim().toUpperCase();
  if (normalizedMode !== PRH_R2_VISUAL_PRESENTATION.NORMAL &&
      normalizedMode !== PRH_R2_VISUAL_PRESENTATION.MASKED) {
    prhR2VisualFail_('R2_VISUAL_PRESENTATION_MODE_FORBIDDEN');
  }

  if (normalizedMode === PRH_R2_VISUAL_PRESENTATION.MASKED) {
    return Object.freeze({
      schema: PRH_R2_VISUAL_PRESENTATION.SCHEMA,
      contract_version: PRH_R2_VISUAL_PRESENTATION.VERSION,
      mode: PRH_R2_VISUAL_PRESENTATION.MASKED,
      status: PRH_R2_VISUAL_PRESENTATION.REDACTED,
      currency: null,
      requested_period_count: PRH_R2_VISUAL_RUNTIME.PERIOD_COUNT,
      available_period_count: null,
      observed_period_count: null,
      cash_flow_periods: Object.freeze([]),
      expense_mix: Object.freeze([]),
      charts: Object.freeze({ cash_flow: null, expense_mix: null }),
      latest_period: null,
      privacy: Object.freeze({
        values_redacted: true,
        chart_options_redacted: true,
        private_visual_runtime_read: false
      }),
      provenance: Object.freeze({
        renderer: PRH_R2_VISUAL_RUNTIME.RENDERER,
        chart_option_authority: PRH_R2_VISUAL_PRESENTATION.CHART_OPTION_AUTHORITY,
        ui_chart_option_authority: false,
        write_authority: false,
        free_only: true
      })
    });
  }

  if (!payload || payload.schema !== PRH_R2_VISUAL_RUNTIME.PAYLOAD_SCHEMA ||
      payload.contract_version !== PRH_R2_VISUAL_RUNTIME.VERSION || !payload.charts) {
    prhR2VisualFail_('R2_VISUAL_PRESENTATION_PAYLOAD_INVALID');
  }
  return Object.freeze({
    schema: PRH_R2_VISUAL_PRESENTATION.SCHEMA,
    contract_version: PRH_R2_VISUAL_PRESENTATION.VERSION,
    mode: PRH_R2_VISUAL_PRESENTATION.NORMAL,
    status: payload.status,
    currency: payload.currency,
    requested_period_count: payload.requested_period_count,
    available_period_count: payload.available_period_count,
    observed_period_count: payload.observed_period_count,
    cash_flow_periods: payload.cash_flow_periods,
    expense_mix: payload.expense_mix,
    charts: payload.charts,
    latest_period: payload.latest_period,
    privacy: Object.freeze({
      values_redacted: false,
      chart_options_redacted: false,
      private_visual_runtime_read: true
    }),
    provenance: Object.freeze({
      financial_truth_policy: payload.provenance.financial_truth_policy,
      financial_authority: payload.provenance.financial_authority,
      chart_spec_authority: payload.provenance.chart_spec_authority,
      chart_compiler: payload.provenance.chart_compiler,
      renderer: payload.provenance.renderer,
      chart_option_authority: PRH_R2_VISUAL_PRESENTATION.CHART_OPTION_AUTHORITY,
      ui_chart_option_authority: false,
      write_authority: false,
      free_only: true
    })
  });
}

function prhR2FetchFinancialHomeVisualPayload(privacyMode) {
  if (typeof prhPrivacyResolveMode_ !== 'function') {
    prhR2VisualFail_('R2_VISUAL_PRIVACY_RUNTIME_REQUIRED');
  }
  var mode = prhPrivacyResolveMode_(privacyMode);
  if (mode !== PRH_R2_VISUAL_PRESENTATION.NORMAL && mode !== PRH_R2_VISUAL_PRESENTATION.MASKED) {
    prhR2VisualFail_('R2_VISUAL_ASYNC_MODE_FORBIDDEN');
  }
  if (mode === PRH_R2_VISUAL_PRESENTATION.MASKED) {
    return prhR2VisualPresentation_(mode, null);
  }
  var buildPresentation = function() {
    return prhR2VisualPresentation_(mode, prhR2BuildFinancialHomeVisualRuntime_());
  };
  if (typeof prhPerfRecGetOrBuildVisual_ === 'function') {
    return prhPerfRecGetOrBuildVisual_(buildPresentation);
  }
  return buildPresentation();
}
