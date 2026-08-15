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
  var STARTUP_VIEW_CACHE_SCHEMA = 'PRH_LOCAL_FINANCE_STARTUP_VIEW_CACHE_V1';
  var STARTUP_VIEW_CACHE_VERSION = '1.0.0';
  var STARTUP_VIEW_CACHE_DB = 'prihrash-local-finance-startup-view-v1';
  var STARTUP_VIEW_CACHE_STORE = 'ready_views';
  var CANONICAL_LOCAL_DB = 'prihrash-local-first-v1';
  var LOCAL_META_STORE = 'meta';
  var LOCAL_ACTIVE_KEY = 'active_generation';
  var LOCAL_MANIFEST_PREFIX = 'generation:';
  var ROUTES = Object.freeze(['home', 'expenses', 'income', 'cash-flow']);
  var VIEW_CACHE_LIMIT = 24;
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

  function idbRequest(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || fail('LOCAL_FINANCE_STARTUP_CACHE_IDB_REQUEST_FAILED')); };
    });
  }

  function idbTransaction(transaction) {
    return new Promise(function (resolve, reject) {
      transaction.oncomplete = function () { resolve(); };
      transaction.onerror = function () { reject(transaction.error || fail('LOCAL_FINANCE_STARTUP_CACHE_IDB_TX_FAILED')); };
      transaction.onabort = function () { reject(transaction.error || fail('LOCAL_FINANCE_STARTUP_CACHE_IDB_TX_ABORTED')); };
    });
  }

  function startupFilterEligible(contextInput) {
    var context;
    try { context = normalizeFilterContext(contextInput); } catch (error) { return false; }
    if (!context.currency || context.start || context.end) return false;
    return FILTER_FIELDS.every(function (field) { return context[field] == null; });
  }

  function expectedResultKeys(route) {
    if (route === 'home') return ['totals', 'trend'];
    if (route === 'expenses' || route === 'income') return ['breakdown', 'total'];
    if (route === 'cash-flow') return ['series', 'total'];
    return [];
  }

  function validateStartupView(view, meta, route) {
    if (!view || typeof view !== 'object' || Array.isArray(view) || view.status !== 'READY') throw fail('LOCAL_FINANCE_STARTUP_VIEW_INVALID');
    if (String(view.route || '') !== route) throw fail('LOCAL_FINANCE_STARTUP_VIEW_ROUTE_MISMATCH');
    if (String(view.generation_id || '') !== meta.generation_id || String(view.revision || '') !== meta.revision) {
      throw fail('LOCAL_FINANCE_STARTUP_VIEW_REVISION_MISMATCH');
    }
    var context = normalizeFilterContext(view.filter_context || {});
    if (!startupFilterEligible(context)) throw fail('LOCAL_FINANCE_STARTUP_VIEW_FILTER_INVALID');
    if (!view.provenance || view.provenance.financial_truth_policy !== 'FIN-TRUTH-v1' ||
        view.provenance.canonical_worker_only !== true || view.provenance.ui_financial_formula_used !== false ||
        String(view.provenance.input_revision || '') !== meta.revision) {
      throw fail('LOCAL_FINANCE_STARTUP_VIEW_PROVENANCE_INVALID');
    }
    if (!view.labels || typeof view.labels !== 'object' || Array.isArray(view.labels) ||
        !view.results || typeof view.results !== 'object' || Array.isArray(view.results)) {
      throw fail('LOCAL_FINANCE_STARTUP_VIEW_PAYLOAD_INVALID');
    }
    var actualKeys = Object.keys(view.results).sort();
    var wantedKeys = expectedResultKeys(route).sort();
    if (JSON.stringify(actualKeys) !== JSON.stringify(wantedKeys)) throw fail('LOCAL_FINANCE_STARTUP_VIEW_RESULT_KEYS_INVALID');
    actualKeys.forEach(function (key) { assertAnalyticsResult(view.results[key], meta); });
    return Object.freeze({
      status: 'READY',
      route: route,
      generation_id: meta.generation_id,
      revision: meta.revision,
      filter_context: context,
      labels: Object.freeze(view.labels),
      results: Object.freeze(view.results),
      provenance: Object.freeze({
        financial_truth_policy: 'FIN-TRUTH-v1',
        canonical_worker_only: true,
        ui_financial_formula_used: false,
        input_revision: meta.revision
      })
    });
  }

  function createStartupViewCache(options) {
    options = options || {};
    var indexedDB = options.indexedDB || (root && root.indexedDB);
    var canonicalDatabaseName = String(options.canonicalDatabaseName || CANONICAL_LOCAL_DB);
    var cacheDatabaseName = String(options.cacheDatabaseName || STARTUP_VIEW_CACHE_DB);
    var cacheDbPromise = null;

    async function canonicalDatabaseExists() {
      if (!indexedDB || typeof indexedDB.databases !== 'function') return false;
      try {
        var databases = await indexedDB.databases();
        return databases.some(function (entry) { return entry && entry.name === canonicalDatabaseName; });
      } catch (error) {
        return false;
      }
    }

    function openExistingCanonicalDatabase() {
      return new Promise(function (resolve, reject) {
        var request = indexedDB.open(canonicalDatabaseName);
        var upgraded = false;
        request.onupgradeneeded = function () {
          upgraded = true;
          try { request.transaction.abort(); } catch (error) { void error; }
        };
        request.onsuccess = function () {
          if (upgraded) { try { request.result.close(); } catch (error) { void error; } reject(fail('LOCAL_FINANCE_CANONICAL_DB_NOT_READY')); return; }
          resolve(request.result);
        };
        request.onerror = function () { reject(request.error || fail('LOCAL_FINANCE_CANONICAL_DB_OPEN_FAILED')); };
        request.onblocked = function () { reject(fail('LOCAL_FINANCE_CANONICAL_DB_BLOCKED')); };
      });
    }

    async function readActiveMetadata() {
      if (!indexedDB || !(await canonicalDatabaseExists())) return null;
      var db = await openExistingCanonicalDatabase();
      try {
        if (!db.objectStoreNames.contains(LOCAL_META_STORE)) return null;
        var tx = db.transaction([LOCAL_META_STORE], 'readonly');
        var done = idbTransaction(tx);
        var metaStore = tx.objectStore(LOCAL_META_STORE);
        var active = await idbRequest(metaStore.get(LOCAL_ACTIVE_KEY));
        if (!active || active.status !== 'ACTIVE') { await done; return null; }
        var generationId = hex64(active.generation_id, 'LOCAL_FINANCE_ACTIVE_GENERATION_INVALID');
        var revision = hex64(active.revision, 'LOCAL_FINANCE_ACTIVE_REVISION_INVALID');
        if (generationId !== revision) { await done; return null; }
        var manifest = await idbRequest(metaStore.get(LOCAL_MANIFEST_PREFIX + generationId));
        await done;
        if (!manifest || manifest.status !== 'VERIFIED' || manifest.revision !== revision || !manifest.counts) return null;
        return Object.freeze({
          status: 'READY',
          generation_id: generationId,
          revision: revision,
          counts: Object.freeze(Object.assign({}, manifest.counts))
        });
      } finally {
        try { db.close(); } catch (error) { void error; }
      }
    }

    function openCacheDatabase() {
      if (!indexedDB) return Promise.reject(fail('LOCAL_FINANCE_STARTUP_CACHE_IDB_UNAVAILABLE'));
      if (cacheDbPromise) return cacheDbPromise;
      cacheDbPromise = new Promise(function (resolve, reject) {
        var request = indexedDB.open(cacheDatabaseName, 1);
        request.onupgradeneeded = function () {
          var db = request.result;
          if (!db.objectStoreNames.contains(STARTUP_VIEW_CACHE_STORE)) db.createObjectStore(STARTUP_VIEW_CACHE_STORE, { keyPath: 'key' });
        };
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { cacheDbPromise = null; reject(request.error || fail('LOCAL_FINANCE_STARTUP_CACHE_OPEN_FAILED')); };
        request.onblocked = function () { cacheDbPromise = null; reject(fail('LOCAL_FINANCE_STARTUP_CACHE_BLOCKED')); };
      });
      return cacheDbPromise;
    }

    function recordKey(revision, route) { return revision + '\u001e' + route; }

    async function get(meta, route) {
      if (!meta || meta.status !== 'READY' || ROUTES.indexOf(route) < 0) return null;
      try {
        var db = await openCacheDatabase();
        var tx = db.transaction([STARTUP_VIEW_CACHE_STORE], 'readonly');
        var done = idbTransaction(tx);
        var record = await idbRequest(tx.objectStore(STARTUP_VIEW_CACHE_STORE).get(recordKey(meta.revision, route)));
        await done;
        if (!record || record.schema !== STARTUP_VIEW_CACHE_SCHEMA || record.version !== STARTUP_VIEW_CACHE_VERSION ||
            record.revision !== meta.revision || record.generation_id !== meta.generation_id || record.route !== route) return null;
        return validateStartupView(record.view, meta, route);
      } catch (error) {
        return null;
      }
    }

    async function put(view) {
      if (!view || view.status !== 'READY' || ROUTES.indexOf(view.route) < 0 || !startupFilterEligible(view.filter_context)) return false;
      var meta = Object.freeze({ status: 'READY', generation_id: hex64(view.generation_id), revision: hex64(view.revision) });
      if (meta.generation_id !== meta.revision) return false;
      var validated = validateStartupView(view, meta, view.route);
      try {
        var db = await openCacheDatabase();
        var tx = db.transaction([STARTUP_VIEW_CACHE_STORE], 'readwrite');
        var done = idbTransaction(tx);
        var store = tx.objectStore(STARTUP_VIEW_CACHE_STORE);
        var cursorRequest = store.openCursor();
        cursorRequest.onsuccess = function () {
          var cursor = cursorRequest.result;
          if (!cursor) return;
          var existing = cursor.value;
          if (!existing || existing.revision !== meta.revision) cursor.delete();
          cursor.continue();
        };
        store.put({
          key: recordKey(meta.revision, validated.route),
          schema: STARTUP_VIEW_CACHE_SCHEMA,
          version: STARTUP_VIEW_CACHE_VERSION,
          generation_id: meta.generation_id,
          revision: meta.revision,
          route: validated.route,
          view: validated
        });
        await done;
        return true;
      } catch (error) {
        return false;
      }
    }

    return Object.freeze({
      schema: STARTUP_VIEW_CACHE_SCHEMA,
      version: STARTUP_VIEW_CACHE_VERSION,
      readActiveMetadata: readActiveMetadata,
      get: get,
      put: put
    });
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
        worker.postMessage({
          type: 'BIND_DATASET',
          generation_id: generationId,
          revision: revision,
          transactions: snapshot.transactions
        });
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
    var startupViewCache = options.startupViewCache || createStartupViewCache({
      indexedDB: options.indexedDB || (root && root.indexedDB),
      canonicalDatabaseName: options.localDatabaseName || CANONICAL_LOCAL_DB,
      cacheDatabaseName: options.startupCacheDatabaseName || STARTUP_VIEW_CACHE_DB
    });
    if (!store || typeof store.getActiveSnapshot !== 'function' || typeof store.status !== 'function') throw fail('LOCAL_FINANCE_STORE_INVALID');
    if (!workerClient || typeof workerClient.query !== 'function' || typeof workerClient.bind !== 'function') throw fail('LOCAL_FINANCE_WORKER_CLIENT_INVALID');

    var state = {
      snapshot: null,
      active_meta: null,
      route: 'home',
      filter_context: emptyFilterContext(),
      render_epoch: 0,
      sync_status: 'IDLE',
      degraded_reason: null,
      last_view: null
    };
    var readyViewCache = new Map();
    var cacheRevision = null;

    function clearReadyViewCache() {
      readyViewCache.clear();
      cacheRevision = state.snapshot ? String(state.snapshot.revision || '') : null;
    }

    function syncReadyViewCacheRevision() {
      var revision = state.snapshot ? String(state.snapshot.revision || '') : null;
      if (revision !== cacheRevision) {
        readyViewCache.clear();
        cacheRevision = revision;
      }
    }

    function filterContextCacheKey(context) {
      context = context || {};
      return [context.currency, context.start, context.end]
        .concat(FILTER_FIELDS.map(function (field) { return context[field]; }))
        .map(function (value) { return value == null ? '' : String(value); })
        .join('\u001f');
    }

    function readyViewCacheKey(route, context) {
      syncReadyViewCacheRevision();
      if (!state.snapshot || !cacheRevision) return null;
      return cacheRevision + '\u001e' + String(route || '') + '\u001e' + filterContextCacheKey(context);
    }

    function getCachedReadyView(route, context) {
      var key = readyViewCacheKey(route, context);
      if (!key || !readyViewCache.has(key)) return null;
      var view = readyViewCache.get(key);
      if (!view || view.status !== 'READY' || view.route !== route || view.revision !== cacheRevision) {
        readyViewCache.delete(key);
        return null;
      }
      readyViewCache.delete(key);
      readyViewCache.set(key, view);
      return view;
    }

    function rememberReadyView(view) {
      if (!view || view.status !== 'READY' || !state.snapshot || view.revision !== state.snapshot.revision) return;
      var key = readyViewCacheKey(view.route, view.filter_context);
      if (!key) return;
      if (readyViewCache.has(key)) readyViewCache.delete(key);
      readyViewCache.set(key, view);
      while (readyViewCache.size > VIEW_CACHE_LIMIT) {
        var oldest = readyViewCache.keys().next();
        if (oldest.done) break;
        readyViewCache.delete(oldest.value);
      }
      if (startupFilterEligible(view.filter_context) && startupViewCache && typeof startupViewCache.put === 'function') {
        Promise.resolve(startupViewCache.put(view)).catch(function () {});
      }
    }

    function activeIdentity() {
      return state.snapshot || state.active_meta;
    }

    function publicState() {
      var identity = activeIdentity();
      var currencies = state.snapshot ? availableCurrencies(state.snapshot) :
        (identity && state.filter_context.currency ? Object.freeze([state.filter_context.currency]) : Object.freeze([]));
      return Object.freeze({
        schema: SCHEMA,
        version: VERSION,
        route: state.route,
        filter_context: state.filter_context,
        snapshot_status: identity ? 'READY' : 'EMPTY',
        generation_id: identity ? identity.generation_id : null,
        revision: identity ? identity.revision : null,
        revision_prefix: identity ? identity.revision.slice(0, 12) : null,
        currencies: currencies,
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
      state.active_meta = null;
      clearReadyViewCache();
      state.last_view = Object.freeze({
        status: 'EMPTY',
        route: state.route,
        reason: reason || 'VERIFIED_LOCAL_SNAPSHOT_LOST_AFTER_SYNC_FAILURE'
      });
    }

    function snapshotMetadata(snapshot) {
      return Object.freeze({
        status: 'READY',
        generation_id: snapshot.generation_id,
        revision: snapshot.revision,
        counts: Object.freeze(Object.assign({}, snapshot.counts || {}))
      });
    }

    async function loadVerifiedSnapshot() {
      var snapshot = await store.getActiveSnapshot({ includeJournal: false });
      if (snapshot && snapshot.status === 'READY') {
        hex64(snapshot.revision, 'LOCAL_FINANCE_SNAPSHOT_REVISION_INVALID');
        hex64(snapshot.generation_id, 'LOCAL_FINANCE_SNAPSHOT_GENERATION_INVALID');
        if (snapshot.revision !== snapshot.generation_id) throw fail('LOCAL_FINANCE_SNAPSHOT_BINDING_INVALID');
        state.snapshot = snapshot;
        state.active_meta = snapshotMetadata(snapshot);
        syncReadyViewCacheRevision();
        if (!state.filter_context.currency) {
          state.filter_context = normalizeFilterContext(Object.assign({}, state.filter_context, { currency: defaultCurrency(snapshot) }));
        }
        await workerClient.bind(snapshot);
        return snapshot;
      }
      state.snapshot = null;
      state.active_meta = null;
      clearReadyViewCache();
      return null;
    }

    async function restoreStartupView() {
      if (!startupViewCache || typeof startupViewCache.readActiveMetadata !== 'function' || typeof startupViewCache.get !== 'function') return null;
      try {
        var meta = await startupViewCache.readActiveMetadata();
        if (!meta || meta.status !== 'READY') return null;
        var view = await startupViewCache.get(meta, state.route);
        if (!view) return null;
        state.active_meta = meta;
        state.filter_context = view.filter_context;
        state.last_view = view;
        state.sync_status = 'READY';
        state.degraded_reason = null;
        emit();
        return view;
      } catch (error) {
        return null;
      }
    }

    async function renderCurrent() {
      var epoch = ++state.render_epoch;
      if (!state.snapshot) {
        state.last_view = Object.freeze({
          status: state.active_meta ? 'LOADING' : 'EMPTY',
          route: state.route,
          reason: state.active_meta ? null : 'VERIFIED_LOCAL_SNAPSHOT_REQUIRED'
        });
        emit();
        return state.last_view;
      }
      var renderRoute = state.route;
      var renderSnapshot = state.snapshot;
      var renderFilterContext = state.filter_context;
      var cached = getCachedReadyView(renderRoute, renderFilterContext);
      if (cached) {
        state.last_view = cached;
        emit();
        return cached;
      }
      state.last_view = Object.freeze({ status: 'LOADING', route: renderRoute });
      emit();
      var specs = routeQueries(renderRoute, renderSnapshot, renderFilterContext);
      try {
        var results = await Promise.all(specs.map(async function (spec) {
          var envelope = await workerClient.query(renderSnapshot, spec.query);
          return Object.freeze({ key: spec.key, result: assertAnalyticsResult(envelope.result, renderSnapshot) });
        }));
        if (epoch !== state.render_epoch || state.snapshot !== renderSnapshot || state.route !== renderRoute || state.filter_context !== renderFilterContext) {
          return Object.freeze({ status: 'STALE_DISCARDED', route: renderRoute });
        }
        var byKey = {};
        results.forEach(function (entry) { byKey[entry.key] = entry.result; });
        state.last_view = Object.freeze({
          status: 'READY',
          route: renderRoute,
          generation_id: renderSnapshot.generation_id,
          revision: renderSnapshot.revision,
          filter_context: renderFilterContext,
          labels: Object.freeze(dimensionLabels(renderSnapshot)),
          results: Object.freeze(byKey),
          provenance: Object.freeze({
            financial_truth_policy: 'FIN-TRUTH-v1',
            canonical_worker_only: true,
            ui_financial_formula_used: false,
            input_revision: renderSnapshot.revision
          })
        });
        rememberReadyView(state.last_view);
        emit();
        return state.last_view;
      } catch (error) {
        if (epoch !== state.render_epoch || safeReason(error) === 'LOCAL_FINANCE_WORKER_STALE_DISCARDED') {
          return Object.freeze({ status: 'STALE_DISCARDED', route: renderRoute });
        }
        state.last_view = Object.freeze({ status: 'ERROR', route: renderRoute, reason: safeReason(error, 'LOCAL_FINANCE_RENDER_FAILED') });
        emit();
        return state.last_view;
      }
    }

    async function setRoute(route) {
      var normalized = String(route || '').trim().toLowerCase();
      if (ROUTES.indexOf(normalized) < 0) throw fail('LOCAL_FINANCE_ROUTE_INVALID');
      state.route = normalized;
      if (!state.snapshot && state.active_meta && startupViewCache && typeof startupViewCache.get === 'function') {
        var restored = await startupViewCache.get(state.active_meta, normalized);
        if (restored) {
          state.filter_context = restored.filter_context;
          state.last_view = restored;
          emit();
          return restored;
        }
      }
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
        if (forceRender === true || recoveredFromError) clearReadyViewCache();
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
      var restored = await restoreStartupView();
      try {
        await loadVerifiedSnapshot();
      } catch (error) {
        state.snapshot = null;
        state.active_meta = null;
        clearReadyViewCache();
        state.sync_status = 'FAILED';
        state.degraded_reason = safeReason(error, 'LOCAL_FINANCE_LOCAL_HYDRATION_FAILED');
        state.last_view = Object.freeze({ status: 'ERROR', route: state.route, reason: state.degraded_reason });
        emit();
        throw error;
      }
      state.sync_status = state.snapshot ? 'READY' : 'EMPTY';
      if (restored && state.snapshot && restored.revision === state.snapshot.revision && restored.generation_id === state.snapshot.generation_id) {
        rememberReadyView(restored);
      }
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
    startupViewCacheSchema: STARTUP_VIEW_CACHE_SCHEMA,
    startupViewCacheVersion: STARTUP_VIEW_CACHE_VERSION,
    routes: ROUTES,
    emptyFilterContext: emptyFilterContext,
    normalizeFilterContext: normalizeFilterContext,
    availableCurrencies: availableCurrencies,
    fullDataTimeRange: fullDataTimeRange,
    analyticsQuery: analyticsQuery,
    routeQueries: routeQueries,
    createStartupViewCache: createStartupViewCache,
    createWorkerClient: createWorkerClient,
    createRuntime: createRuntime
  });
});
