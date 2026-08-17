(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PrhLocalVisualizationAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SCHEMA = 'PRH_LOCAL_VISUALIZATION_ADAPTER_V1';
  var VERSION = '1.0.0';
  var CHART_SPEC_SCHEMA = 'PRH_LOCAL_VISUAL_CHART_SPEC_V1';
  var TOP_N = 7;
  var FIN_TRUTH = 'FIN-TRUTH-v1';
  var ROUTES = Object.freeze(['home', 'expenses', 'income', 'cash-flow']);

  function fail(code) {
    var error = new Error(code);
    error.code = code;
    throw error;
  }

  function safeInteger(value) {
    if (!Number.isSafeInteger(value)) fail('VIZ_MEASURE_NOT_SAFE_INTEGER');
    return value;
  }

  function rowMeasure(row, measure) {
    if (!row || !row.measures || !Object.prototype.hasOwnProperty.call(row.measures, measure)) {
      fail('VIZ_MEASURE_MISSING');
    }
    return safeInteger(row.measures[measure]);
  }

  function assertAuthoritativeView(view) {
    if (!view || view.status !== 'READY' || ROUTES.indexOf(String(view.route || '')) < 0) {
      fail('VIZ_VIEW_NOT_READY');
    }
    var provenance = view.provenance || {};
    if (provenance.financial_truth_policy !== FIN_TRUTH ||
        provenance.canonical_worker_only !== true ||
        provenance.ui_financial_formula_used !== false ||
        String(provenance.input_revision || '') !== String(view.revision || '')) {
      fail('VIZ_VIEW_PROVENANCE_INVALID');
    }
    if (!view.results || typeof view.results !== 'object' || Array.isArray(view.results)) {
      fail('VIZ_VIEW_RESULTS_INVALID');
    }
    return view;
  }

  function categoryLabel(labels, row) {
    var id = String(row && row.dimensions && row.dimensions.category_id || '');
    if (!id) return 'Без категории';
    var label = labels && labels['category|' + id];
    return String(label || id);
  }

  function categoryComposition(rows, measure, labels, topN) {
    var source = Array.isArray(rows) ? rows : [];
    var limit = Number.isInteger(topN) && topN > 0 ? topN : TOP_N;
    if (!source.length) {
      return Object.freeze({ status: 'EMPTY', categories: Object.freeze([]), values: Object.freeze([]), total: 0, grouped: false });
    }
    var categories = [];
    var values = [];
    var total = 0;
    var remainder = 0;
    source.forEach(function (row, index) {
      var value = rowMeasure(row, measure);
      total = safeInteger(total + value);
      if (index < limit) {
        categories.push(categoryLabel(labels, row));
        values.push(value);
      } else {
        remainder = safeInteger(remainder + value);
      }
    });
    if (source.length > limit) {
      categories.push('Прочее');
      values.push(remainder);
    }
    var renderedTotal = values.reduce(function (sum, value) { return safeInteger(sum + value); }, 0);
    if (renderedTotal !== total) fail('VIZ_TOP_N_CONSERVATION_FAILED');
    return Object.freeze({
      status: 'READY',
      categories: Object.freeze(categories),
      values: Object.freeze(values),
      total: total,
      grouped: source.length > limit
    });
  }

  function timeSeries(rows, measures) {
    var source = Array.isArray(rows) ? rows : [];
    var wanted = Array.isArray(measures) ? measures.slice() : [];
    if (!wanted.length) fail('VIZ_SERIES_MEASURES_REQUIRED');
    if (source.length < 2) {
      return Object.freeze({ status: 'INSUFFICIENT_DATA', buckets: Object.freeze([]), series: Object.freeze([]) });
    }
    var buckets = source.map(function (row) {
      var bucket = String(row && row.dimensions && row.dimensions.time_bucket || '').trim();
      if (!bucket) fail('VIZ_TIME_BUCKET_MISSING');
      return bucket;
    });
    var series = wanted.map(function (measure) {
      return Object.freeze({
        measure: measure,
        values: Object.freeze(source.map(function (row) { return rowMeasure(row, measure); }))
      });
    });
    return Object.freeze({ status: 'READY', buckets: Object.freeze(buckets), series: Object.freeze(series) });
  }

  function baseSpec(view, kind, title) {
    return {
      schema: CHART_SPEC_SCHEMA,
      version: VERSION,
      authority: 'DISPLAY_ONLY',
      financial_truth_policy: FIN_TRUTH,
      source_revision: String(view.revision || ''),
      route: view.route,
      kind: kind,
      title: title
    };
  }

  function chartSpecFromView(input) {
    var view = assertAuthoritativeView(input);
    if (view.route === 'home') {
      var trendRows = view.results.trend && view.results.trend.rows;
      var homeSeries = timeSeries(trendRows, ['CASH_FLOW']);
      if (homeSeries.status !== 'READY') {
        return Object.freeze(Object.assign(baseSpec(view, 'TIME_SERIES', 'Динамика денежного потока'), {
          status: 'INSUFFICIENT_DATA',
          message: 'Для графика динамики пока недостаточно периодов.'
        }));
      }
      return Object.freeze(Object.assign(baseSpec(view, 'TIME_SERIES', 'Динамика денежного потока'), {
        status: 'READY',
        buckets: homeSeries.buckets,
        series: homeSeries.series
      }));
    }

    if (view.route === 'cash-flow') {
      var flowRows = view.results.series && view.results.series.rows;
      var flowSeries = timeSeries(flowRows, ['INCOME', 'EXPENSE', 'CASH_FLOW']);
      if (flowSeries.status !== 'READY') {
        return Object.freeze(Object.assign(baseSpec(view, 'TIME_SERIES', 'Денежный поток по месяцам'), {
          status: 'INSUFFICIENT_DATA',
          message: 'Для помесячного графика пока недостаточно периодов.'
        }));
      }
      return Object.freeze(Object.assign(baseSpec(view, 'TIME_SERIES', 'Денежный поток по месяцам'), {
        status: 'READY',
        buckets: flowSeries.buckets,
        series: flowSeries.series
      }));
    }

    var measure = view.route === 'expenses' ? 'EXPENSE' : 'INCOME';
    var title = view.route === 'expenses' ? 'Структура расходов' : 'Структура доходов';
    var breakdownRows = view.results.breakdown && view.results.breakdown.rows;
    var composition = categoryComposition(breakdownRows, measure, view.labels || {}, TOP_N);
    if (composition.status !== 'READY') {
      return Object.freeze(Object.assign(baseSpec(view, 'CATEGORY_BAR', title), {
        status: 'EMPTY',
        message: 'Для выбранных фильтров нет данных для графика.'
      }));
    }
    return Object.freeze(Object.assign(baseSpec(view, 'CATEGORY_BAR', title), {
      status: 'READY',
      measure: measure,
      categories: composition.categories,
      values: composition.values,
      grouped_other: composition.grouped,
      presentation_total: composition.total
    }));
  }

  return Object.freeze({
    schema: SCHEMA,
    version: VERSION,
    chartSpecSchema: CHART_SPEC_SCHEMA,
    topN: TOP_N,
    routes: ROUTES,
    assertAuthoritativeView: assertAuthoritativeView,
    categoryComposition: categoryComposition,
    timeSeries: timeSeries,
    chartSpecFromView: chartSpecFromView
  });
});
