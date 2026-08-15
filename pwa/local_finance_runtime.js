(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PrhLocalFinanceRuntime = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var SCHEMA = 'PRH_LOCAL_FINANCE_RUNTIME_V1';
  var VERSION = '1.0.0';
  var FILTER_SCHEMA = 'PRH_LOCAL_FINANCE_FILTER_CONTEXT_V1';
  var WORKER_SCHEMA = 'PRH_LOCAL_ANALYTICS_WORKER_V1';
  var WORKER_VERSION = '1.0.0';
  var ANALYTICS_QUERY_SCHEMA = 'PRH_ANALYTICS_QUERY_V1';
  var ANALYTICS_VERSION = '1.0.0';
  var ROUTES = Object.freeze(['home', 'expenses', 'income', 'cash-flow']);
  var HEX64 = /^[0-9a-f]{64}$/;
  var ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  var REQUEST_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
  var FILTER_FIELDS = Object.freeze(['account_id', 'category_id', 'member_id', 'project_id']);

  function fail(code, detail) {
    var error = new Error(detail ? code + ':' + detail : code);
    error.code = code;
    return error;
  }

  function safeReason(error, fallback) {
    var value = String(error && (error.code || error.message) || fallback || 'LOCAL_FINANCE_RUNTIME_FAILED');
    var colon = value.indexOf(':');
    if (colon >= 0) value = value.slice(0, colon);
    return /^[A-Z][A-Z0-9_]{2,95}$/.test(value) ? value : (fallback || 'LOCAL_FINANCE_RUNTIME_FAILED');
  }

  function hex64(value, code) {
    var text = String(value || '').trim().toLowerCase();
    if (!HEX64.test(text)) throw fail(code || 'LOCAL_FINANCE_REVISION_INVALID');
    return text;
  }

  function isoDay(value, code) {
    if (value == null || value === '') return null;
    var text = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw fail(code || 'LOCAL_FINANCE_DATE_INVALID');
    var parsed = new Date(text + 'T00:00:00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) throw fail(code || 'LOCAL_FINANCE_DATE_INVALID');
    return text;
  }

  function normalizeFilterContext(input) {
    input = input || {};
    var currency = String(input.currency || '').trim().toUpperCase();
    if (currency && !/^[A-Z]{3}$/.test(currency)) throw fail('LOCAL_FINANCE_CURRENCY_INVALID');
    var start = isoDay(input.start, 'LOCAL_FINANCE_FILTER_START_INVALID');
    var end = isoDay(input.end, 'LOCAL_FINANCE_FILTER_END_INVALID');
    if ((start && !end) || (!start && end) || (start && start >= end)) throw fail('LOCAL_FINANCE_FILTER_RANGE_INVALID');
    var normalized = {
      schema: FILTER_SCHEMA,
      contract_version: VERSION,
      currency: currency,
      start: start,
      end: end
    };
    FILTER_FIELDS.forEach(function (field) {
      var raw = input[field];
      if (raw == null || raw === '') normalized[field] = null;
      else {
        var text = String(raw).trim();
        if (!ID_RE.test(text)) throw fail('LOCAL_FINANCE_FILTER_ID_INVALID', field);
        normalized[field] = text;
      }
    });
    return Object.freeze(normalized);
  }

  function emptyFilterContext() {
    return normalizeFilterContext({});
  }

  function availableCurrencies(snapshot) {
    var set = new Set();
    (snapshot.transactions || []).forEach(function (tx) {
      if (tx && /^[A-Z]{3}$/.test(String(tx.currency || ''))) set.add(String(tx.currency));
    });
    return Object.freeze(Array.from(set).sort());
  }

  function defaultCurrency(snapshot) {
    var currencies = availableCurrencies(snapshot);
    if (currencies.indexOf('RUB') >= 0) return 'RUB';
    return currencies.length ? currencies[0] : '';
  }

  function fullDataTimeRange(snapshot, currency) {
    var days = (snapshot.transactions || [])
      .filter(function (tx) { return !currency || tx.currency === currency; })
      .map(function (tx) { return String(tx.occurred_at || '').slice(0, 10); })
      .filter(function (day) { return /^\d{4}-\d{2}-\d{2}$/.test(day); })
      .sort();
    if (!days.length) return null;
    var last = new Date(days[days.length - 1] + 'T00:00:00Z');
    last.setUTCDate(last.getUTCDate() + 1);
    return Object.freeze({ start: days[0], end: last.toISOString().slice(0, 10) });
  }

  function effectiveTimeRange(snapshot, context, requireRange) {
    if (context.start && context.end) return Object.freeze({ start: context.start, end: context.end });
    return requireRange ? fullDataTimeRange(snapshot, context.currency) : null;
  }

  function analyticsFilters(context) {
    var filters = [];
    FILTER_FIELDS.forEach(function (field) {
      if (!context[field]) return;
      filters.push(Object.freeze({ field: field, operator: 'EQ', values: Object.freeze([context[field]]) }));
    });
    return Object.freeze(filters);
  }

  function analyticsQuery(snapshot, contextInput, options) {
    var context = normalizeFilterContext(contextInput);
    var optionsSafe = options || {};
    var currency = context.currency || defaultCurrency(snapshot);
    if (!currency) throw fail('LOCAL_FINANCE_NO_CURRENCY_AVAILABLE');
    var grain = String(optionsSafe.grain || 'NONE');
    var dimensions = Array.isArray(optionsSafe.dimensions) ? optionsSafe.dimensions.slice() : [];
    var measures = Array.isArray(optionsSafe.measures) ? optionsSafe.measures.slice() : [];
    if (!measures.length) throw fail('LOCAL_FINANCE_QUERY_MEASURES_REQUIRED');
    var range = effectiveTimeRange(snapshot, Object.assign({}, context, { currency: currency }), grain !== 'NONE');
    return Object.freeze({
      schema: ANALYTICS_QUERY_SCHEMA,
      contract_version: ANALYTICS_VERSION,
      currency: currency,
      measures: Object.freeze(measures),
      dimensions: Object.freeze(dimensions),
      filters: analyticsFilters(context),
      time_range: range,
      grain: grain,
      comparison: Object.freeze({ mode: 'NONE' }),
      sort: Object.freeze(Array.isArray(optionsSafe.sort) ? optionsSafe.sort.slice() : []),
      parameters: Object.freeze({}),
      limit: Number.isInteger(optionsSafe.limit) ? optionsSafe.limit : 200
    });
  }

  function routeQueries(route, snapshot, context) {
    if (ROUTES.indexOf(route) < 0) throw fail('LOCAL_FINANCE_ROUTE_INVALID');
    if (route === 'home') {
      return Object.freeze([
        Object.freeze({ key: 'totals', query: analyticsQuery(snapshot, context, { measures: ['INCOME', 'EXPENSE', 'CASH_FLOW', 'SAVINGS'] }) }),
        Object.freeze({ key: 'trend', query: analyticsQuery(snapshot, context, { measures: ['CASH_FLOW'], grain: 'MONTH', sort: [{ kind: 'DIMENSION', key: 'time_bucket', direction: 'ASC' }] }) })
      ]);
    }
    if (route === 'expenses') {
      return Object.freeze([
        Object.freeze({ key: 'total', query: analyticsQuery(snapshot, context, { measures: ['EXPENSE'] }) }),
        Object.freeze({ key: 'breakdown', query: analyticsQuery(snapshot, context, { measures: ['EXPENSE'], dimensions: ['category_id'], sort: [{ kind: 'MEASURE', key: 'EXPENSE', direction: 'DESC' }] }) })
      ]);
    }
    if (route === 'income') {
      return Object.freeze([
        Object.freeze({ key: 'total', query: analyticsQuery(snapshot, context, { measures: ['INCOME'] }) }),
        Object.freeze({ key: 'breakdown', query: analyticsQuery(snapshot, context, { measures: ['INCOME'], dimensions: ['category_id'], sort: [{ kind: 'MEASURE', key: 'INCOME', direction: 'DESC' }] }) })
      ]);
    }
    return Object.freeze([
      Object.freeze({ key: 'total', query: analyticsQuery(snapshot, context, { measures: ['INCOME', 'EXPENSE', 'CASH_FLOW'] }) }),
      Object.freeze({ key: 'series', query: analyticsQuery(snapshot, context, { measures: ['INCOME', 'EXPENSE', 'CASH_FLOW'], grain: 'MONTH', sort: [{ kind: 'DIMENSION', key: 'time_bucket', direction: 'ASC' }] }) })
    ]);
  }

  function dimensionLabels(snapshot) {
    var labels = Object.create(null);
    (snapshot.dimensions || []).forEach(function (row) {
      if (row && row.dimension_key && row.label) labels[String(row.dimension_key)] = String(row.label);
    });
    return labels;
  }

  function assertAnalyticsResult(result, snapshot) {
    if (!result || result.schema !== 'PRH_ANALYTICS_RESULT_V1' || result.contract_version !== ANALYTICS_VERSION ||
        !result.provenance || result.provenance.financial_truth_policy !== 'FIN-TRUTH-v1') {
      throw fail('LOCAL_FINANCE_ANALYTICS_RESULT_INVALID');
    }
    if (String(result.provenance.input_revision || '') !== String(snapshot.revision || '')) {
      throw fail('LOCAL_FINANCE_RESULT_REVISION_MISMATCH');
    }
    return result;
  }

  function createWorkerClient(options) {
    options = options || {};
    var WorkerCtor = options.Worker || (root && root.Worker);
    var BlobCtor = options.Blob || (root && root.Blob);
    var URLApi = options.URL || (root && root.URL);
    var bundleSource = String(options.bundleSource || '');
    if (!WorkerCtor || !BlobCtor || !URLApi || typeof URLApi.createObjectURL !== 'function' || !bundleSource) {
      throw fail('LOCAL_FINANCE_WORKER_RUNTIME_UNAVAILABLE');
    }
    var blob = new BlobCtor([bundleSource], { type: 'text/javascript' });
    var blobUrl = URLApi.createObjectURL(blob);
    var worker = new WorkerCtor(blobUrl);
    var pending = new Map();
    var readyResolve;
    var readyReject;
    var ready = new Promise(function (resolve, reject) { readyResolve = resolve; readyReject = reject; });
    var current = null;
    var sequence = 0;
    var disposed = false;

    function rejectAll(reason) {
      pending.forEach(function (entry) { entry.reject(fail(reason)); });
      pending.clear();
    }

    worker.onmessage = function (event) {
      var message = event && event.data;
      if (!message || typeof message !== 'object') return;
      if (message.type === 'READY') {
        if (message.schema === WORKER_SCHEMA && message.version === WORKER_VERSION) readyResolve(true);
        else readyReject(fail('LOCAL_FINANCE_WORKER_CONTRACT_MISMATCH'));
        return;
      }
      var requestId = String(message.request_id || '');
      var entry = pending.get(requestId);
      if (!entry) return;
      if (message.type === 'ANALYTICS_RESULT') {
        pending.delete(requestId);
        entry.resolve(message);
      } else if (message.type === 'STALE_DISCARDED') {
        pending.delete(requestId);
        entry.reject(fail('LOCAL_FINANCE_WORKER_STALE_DISCARDED'));
      } else if (message.type === 'ERROR') {
        pending.delete(requestId);
        entry.reject(fail(String(message.reason || 'LOCAL_FINANCE_WORKER_ERROR')));
      }
    };
    worker.onerror = function () {
      readyReject(fail('LOCAL_FINANCE_WORKER_BOOT_FAILED'));
      rejectAll('LOCAL_FINANCE_WORKER_FAILED');
    };
    worker.postMessage({ type: 'INIT' });

    async function bind(snapshot) {
      await ready;
      if (disposed) throw fail('LOCAL_FINANCE_WORKER_DISPOSED');
      var generationId = hex64(snapshot.generation_id, 'LOCAL_FINANCE_GENERATION_INVALID');
      var revision = hex64(snapshot.revision, 'LOCAL_FINANCE_REVISION_INVALID');
      if (generationId !== revision) throw fail('LOCAL_FINANCE_GENERATION_REVISION_MISMATCH');
      if (current && (current.generation_id !== generationId || current.revision !== revision)) {
        worker.postMessage({ type: 'CANCEL_GENERATION', generation_id: current.generation_id });
        rejectAll('LOCAL_FINANCE_WORKER_STALE_DISCARDED');
      }
      if (!current || current.generation_id !== generationId || current.revision !== revision) {
        worker.postMessage({ type: 'SET_REVISION', generation_id: generationId, revision: revision });
        current = Object.freeze({ generation_id: generationId, revision: revision });
      }
      return current;
    }

    async function query(snapshot, querySpec) {
      await bind(snapshot);
      sequence += 1;
      var requestId = 'fin-' + sequence + '-' + snapshot.revision.slice(0, 12);
      if (!REQUEST_RE.test(requestId)) throw fail('LOCAL_FINANCE_REQUEST_ID_INVALID');
      return new Promise(function (resolve, reject) {
        pending.set(requestId, { resolve: resolve, reject: reject });
        worker.postMessage({
          type: 'ANALYTICS_QUERY',
          request_id: requestId,
          generation_id: snapshot.generation_id,
          revision: snapshot.revision,
          transactions: snapshot.transactions,
          query: querySpec
        });
      });
    }

    function dispose() {
      disposed = true;
      rejectAll('LOCAL_FINANCE_WORKER_DISPOSED');
      try { worker.terminate(); } catch (error) { void error; }
      try { URLApi.revokeObjectURL(blobUrl); } catch (error) { void error; }
    }

    return Object.freeze({ ready: ready, bind: bind, query: query, dispose: dispose });
  }

  function createRuntime(options) {
    options = options || {};
    var store = options.store;
    var workerClient = options.workerClient;
    var fullSync = options.fullSyncCoordinator || null;
    var deltaSync = options.deltaCoordinator || null;
    var onState = typeof options.onState === 'function' ? options.onState : function () {};
    if (!store || typeof store.getActiveSnapshot !== 'function' || typeof store.status !== 'function') throw fail('LOCAL_FINANCE_STORE_INVALID');
    if (!workerClient || typeof workerClient.query !== 'function' || typeof workerClient.bind !== 'function') throw fail('LOCAL_FINANCE_WORKER_CLIENT_INVALID');

    var state = {
      snapshot: null,
      route: 'home',
      filter_context: emptyFilterContext(),
      render_epoch: 0,
      sync_status: 'IDLE',
      degraded_reason: null,
      last_view: null
    };

    function publicState() {
      return Object.freeze({
        schema: SCHEMA,
        version: VERSION,
        route: state.route,
        filter_context: state.filter_context,
        snapshot_status: state.snapshot ? 'READY' : 'EMPTY',
        generation_id: state.snapshot ? state.snapshot.generation_id : null,
        revision: state.snapshot ? state.snapshot.revision : null,
        revision_prefix: state.snapshot ? state.snapshot.revision.slice(0, 12) : null,
        currencies: state.snapshot ? availableCurrencies(state.snapshot) : Object.freeze([]),
        sync_status: state.sync_status,
        degraded_reason: state.degraded_reason,
        view: state.last_view
      });
    }

    function emit() {
      onState(publicState());
    }

    function invalidateStaleSnapshotAfterFailedSync(reason) {
      state.render_epoch += 1;
      state.snapshot = null;
      state.last_view = Object.freeze({
        status: 'EMPTY',
        route: state.route,
        reason: reason || 'VERIFIED_LOCAL_SNAPSHOT_LOST_AFTER_SYNC_FAILURE'
      });
    }

    async function loadVerifiedSnapshot() {
      var snapshot = await store.getActiveSnapshot({ includeJournal: false });
      if (snapshot && snapshot.status === 'READY') {
        hex64(snapshot.revision, 'LOCAL_FINANCE_SNAPSHOT_REVISION_INVALID');
        hex64(snapshot.generation_id, 'LOCAL_FINANCE_SNAPSHOT_GENERATION_INVALID');
        if (snapshot.revision !== snapshot.generation_id) throw fail('LOCAL_FINANCE_SNAPSHOT_BINDING_INVALID');
        state.snapshot = snapshot;
        if (!state.filter_context.currency) {
          state.filter_context = normalizeFilterContext(Object.assign({}, state.filter_context, { currency: defaultCurrency(snapshot) }));
        }
        await workerClient.bind(snapshot);
        return snapshot;
      }
      state.snapshot = null;
      return null;
    }

    async function renderCurrent() {
      var epoch = ++state.render_epoch;
      if (!state.snapshot) {
        state.last_view = Object.freeze({ status: 'EMPTY', route: state.route, reason: 'VERIFIED_LOCAL_SNAPSHOT_REQUIRED' });
        emit();
        return state.last_view;
      }
      state.last_view = Object.freeze({ status: 'LOADING', route: state.route });
      emit();
      var specs = routeQueries(state.route, state.snapshot, state.filter_context);
      try {
        var results = await Promise.all(specs.map(async function (spec) {
          var envelope = await workerClient.query(state.snapshot, spec.query);
          return Object.freeze({ key: spec.key, result: assertAnalyticsResult(envelope.result, state.snapshot) });
        }));
        if (epoch !== state.render_epoch) return Object.freeze({ status: 'STALE_DISCARDED', route: state.route });
        var byKey = {};
        results.forEach(function (entry) { byKey[entry.key] = entry.result; });
        state.last_view = Object.freeze({
          status: 'READY',
          route: state.route,
          generation_id: state.snapshot.generation_id,
          revision: state.snapshot.revision,
          filter_context: state.filter_context,
          labels: Object.freeze(dimensionLabels(state.snapshot)),
          results: Object.freeze(byKey),
          provenance: Object.freeze({
            financial_truth_policy: 'FIN-TRUTH-v1',
            canonical_worker_only: true,
            ui_financial_formula_used: false,
            input_revision: state.snapshot.revision
          })
        });
        emit();
        return state.last_view;
      } catch (error) {
        if (epoch !== state.render_epoch || safeReason(error) === 'LOCAL_FINANCE_WORKER_STALE_DISCARDED') {
          return Object.freeze({ status: 'STALE_DISCARDED', route: state.route });
        }
        state.last_view = Object.freeze({ status: 'ERROR', route: state.route, reason: safeReason(error, 'LOCAL_FINANCE_RENDER_FAILED') });
        emit();
        return state.last_view;
      }
    }

    async function setRoute(route) {
      var normalized = String(route || '').trim().toLowerCase();
      if (ROUTES.indexOf(normalized) < 0) throw fail('LOCAL_FINANCE_ROUTE_INVALID');
      state.route = normalized;
      return renderCurrent();
    }

    async function setFilterContext(context) {
      state.filter_context = normalizeFilterContext(context);
      state.render_epoch += 1;
      return renderCurrent();
    }

    async function refreshAfterSync(forceRender) {
      var oldRevision = state.snapshot && state.snapshot.revision;
      var previousView = state.last_view;
      var next = await loadVerifiedSnapshot();
      var recoveredFromError = previousView && previousView.status === 'ERROR';
      if (next && (forceRender === true || next.revision !== oldRevision || recoveredFromError)) {
        state.render_epoch += 1;
        return renderCurrent();
      }
      emit();
      return state.last_view;
    }

    async function backgroundSync() {
      if (!state.snapshot && fullSync) {
        state.sync_status = 'SYNCING';
        state.degraded_reason = null;
        emit();
        var cold = await fullSync.sync();
        if (cold && (cold.status === 'UPDATED' || cold.status === 'NOOP')) {
          state.sync_status = 'READY';
          await refreshAfterSync(cold.status === 'UPDATED');
          return cold;
        }
        state.sync_status = cold && cold.status === 'DEGRADED' ? 'DEGRADED' : 'FAILED';
        state.degraded_reason = cold && cold.reason || 'LOCAL_FINANCE_COLD_BOOTSTRAP_FAILED';
        emit();
        return cold;
      }
      if (!state.snapshot || !deltaSync) return null;
      state.sync_status = 'SYNCING';
      state.degraded_reason = null;
      emit();
      var result = await deltaSync.sync();
      if (result && ['UPDATED_DELTA', 'FULL_REBUILT', 'ALREADY_APPLIED', 'NOOP'].indexOf(result.status) >= 0) {
        state.sync_status = 'READY';
        await refreshAfterSync(result.status === 'FULL_REBUILT' || result.status === 'UPDATED_DELTA');
      } else if (result && result.status === 'DEGRADED') {
        state.sync_status = 'DEGRADED';
        state.degraded_reason = result.reason || 'LOCAL_FINANCE_SYNC_DEGRADED';
        emit();
      } else if (result) {
        state.sync_status = 'FAILED';
        state.degraded_reason = result.reason || 'LOCAL_FINANCE_SYNC_FAILED';
        if (!result.active) invalidateStaleSnapshotAfterFailedSync(state.degraded_reason);
        emit();
      }
      return result;
    }

    async function start(route) {
      if (route && ROUTES.indexOf(route) >= 0) state.route = route;
      state.sync_status = 'LOCAL_OPENING';
      emit();
      await loadVerifiedSnapshot();
      state.sync_status = state.snapshot ? 'READY' : 'EMPTY';
      await renderCurrent();
      Promise.resolve().then(backgroundSync).catch(function (error) {
        state.sync_status = state.snapshot ? 'DEGRADED' : 'FAILED';
        state.degraded_reason = safeReason(error, 'LOCAL_FINANCE_BACKGROUND_SYNC_FAILED');
        emit();
      });
      return publicState();
    }

    return Object.freeze({
      start: start,
      setRoute: setRoute,
      setFilterContext: setFilterContext,
      backgroundSync: backgroundSync,
      renderCurrent: renderCurrent,
      getState: publicState,
      normalizeFilterContext: normalizeFilterContext
    });
  }

  return Object.freeze({
    schema: SCHEMA,
    version: VERSION,
    filterSchema: FILTER_SCHEMA,
    routes: ROUTES,
    emptyFilterContext: emptyFilterContext,
    normalizeFilterContext: normalizeFilterContext,
    availableCurrencies: availableCurrencies,
    fullDataTimeRange: fullDataTimeRange,
    analyticsQuery: analyticsQuery,
    routeQueries: routeQueries,
    createWorkerClient: createWorkerClient,
    createRuntime: createRuntime
  });
});
