(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.PrhLocalFirstPerformance = api;
    api.autoInstall();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var SCHEMA = 'PRH_LOCAL_FIRST_PERFORMANCE_V1';
  var VERSION = '1.0.0';
  var STORE_NAME = 'prihrash-local-first-v1';
  var META_STORE = 'meta';
  var ACTIVE_KEY = 'active_generation';
  var MANIFEST_PREFIX = 'generation:';
  var HEX64 = /^[0-9a-f]{64}$/;
  var DOM_CACHE_LIMIT = 8;
  var ROUTES = Object.freeze(['home', 'transactions', 'expenses', 'income', 'cash-flow', 'data-quality']);
  var FINANCE_ROUTES = Object.freeze(['home', 'expenses', 'income', 'cash-flow']);
  var TARGETS = Object.freeze({
    warm_route_switch_p95: Object.freeze({ threshold_ms: 100, min_samples: 10 }),
    filter_kpi_update_p95: Object.freeze({ threshold_ms: 200, min_samples: 10 }),
    chart_repaint_desktop_p95: Object.freeze({ threshold_ms: 300, min_samples: 10 }),
    chart_repaint_mobile_p95: Object.freeze({ threshold_ms: 500, min_samples: 10 }),
    back_forward_p95: Object.freeze({ threshold_ms: 100, min_samples: 10 }),
    cached_first_meaningful_paint_p95: Object.freeze({ threshold_ms: 800, min_samples: 1 })
  });
  var ROUTE_SEQUENCE = Object.freeze([
    'home', 'transactions', 'expenses', 'income', 'cash-flow', 'data-quality',
    'home', 'expenses', 'transactions', 'cash-flow', 'income', 'data-quality'
  ]);
  var lastReport = null;
  var running = false;
  var moduleStartMs = now();
  var domCacheInstalled = false;
  var pendingHistoryPhase = null;
  var historyPhaseSamples = [];
  var financeMeaningfulCommitSequence = 0;
  var financeMeaningfulCommitWaiters = [];

  function fail(code) {
    var error = new Error(code);
    error.code = code;
    return error;
  }

  function now() {
    return root && root.performance && typeof root.performance.now === 'function'
      ? root.performance.now()
      : Date.now();
  }

  function finiteDuration(value) {
    var number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 60000 ? number : null;
  }

  function roundedDuration(value) {
    var valid = finiteDuration(value);
    return valid === null ? null : Number(valid.toFixed(3));
  }

  function validSamples(values) {
    return (Array.isArray(values) ? values : []).map(finiteDuration).filter(function (value) { return value !== null; });
  }

  function percentile95(values) {
    var samples = validSamples(values);
    if (!samples.length) return null;
    samples.sort(function (a, b) { return a - b; });
    return samples[Math.max(0, Math.ceil(samples.length * 0.95) - 1)];
  }

  function fmpPhaseBreakdown(responseStart, responseEnd, moduleStart, ready) {
    var rs = finiteDuration(responseStart);
    var re = finiteDuration(responseEnd);
    var ms = finiteDuration(moduleStart);
    var rd = finiteDuration(ready);
    function span(start, end) {
      if (start === null || end === null || end < start) return null;
      return roundedDuration(end - start);
    }
    return Object.freeze({
      response_start_ms: roundedDuration(rs),
      response_end_ms: roundedDuration(re),
      module_start_ms: roundedDuration(ms),
      ready_ms: roundedDuration(rd),
      response_to_module_ms: span(re, ms),
      module_to_ready_ms: span(ms, rd),
      response_to_ready_ms: span(re, rd)
    });
  }

  function navigationPhaseBreakdown(readyMs) {
    var responseStart = null;
    var responseEnd = null;
    if (root && root.performance && typeof root.performance.getEntriesByType === 'function') {
      var entries = root.performance.getEntriesByType('navigation');
      var navigation = entries && entries.length ? entries[0] : null;
      if (navigation) {
        responseStart = navigation.responseStart;
        responseEnd = navigation.responseEnd;
      }
    }
    return fmpPhaseBreakdown(responseStart, responseEnd, moduleStartMs, readyMs);
  }


  function historyPhaseBreakdown(actionStart, popstateAt, meaningfulReadyAt, stableFrameAt, firstFrameAt) {
    var start = finiteDuration(actionStart);
    var popstate = finiteDuration(popstateAt);
    var ready = finiteDuration(meaningfulReadyAt);
    var stable = finiteDuration(stableFrameAt);
    var firstFrame = finiteDuration(firstFrameAt);
    function span(from, to) {
      if (from === null || to === null || to < from) return null;
      return roundedDuration(to - from);
    }
    return Object.freeze({
      action_to_popstate_ms: span(start, popstate),
      popstate_to_meaningful_ready_ms: span(popstate, ready),
      meaningful_ready_to_first_frame_ms: span(ready, firstFrame),
      first_to_stable_frame_ms: span(firstFrame, stable),
      meaningful_ready_to_stable_frame_ms: span(ready, stable),
      action_to_stable_frame_ms: span(start, stable)
    });
  }

  function historyPhaseP95(samples) {
    var list = Array.isArray(samples) ? samples : [];
    function p95(field) {
      var values = list.map(function (entry) { return entry && entry[field]; }).filter(function (value) { return value !== null && value !== undefined; });
      var value = percentile95(values);
      return value === null ? null : roundedDuration(value);
    }
    return Object.freeze({
      sample_count: list.length,
      action_to_popstate_p95_ms: p95('action_to_popstate_ms'),
      popstate_to_meaningful_ready_p95_ms: p95('popstate_to_meaningful_ready_ms'),
      meaningful_ready_to_first_frame_p95_ms: p95('meaningful_ready_to_first_frame_ms'),
      first_to_stable_frame_p95_ms: p95('first_to_stable_frame_ms'),
      meaningful_ready_to_stable_frame_p95_ms: p95('meaningful_ready_to_stable_frame_ms'),
      action_to_stable_frame_p95_ms: p95('action_to_stable_frame_ms')
    });
  }

  function installHistoryPhaseProbe() {
    if (!root || typeof root.addEventListener !== 'function') return false;
    root.addEventListener('popstate', function () {
      if (!pendingHistoryPhase || pendingHistoryPhase.popstate_at !== null) return;
      pendingHistoryPhase.popstate_at = now();
    });
    return true;
  }

  function blockedMetric(metricId, reason, deviceClass) {
    var target = TARGETS[metricId];
    if (!target) throw fail('PERF_LF_METRIC_UNKNOWN');
    return Object.freeze({
      metric_id: metricId,
      sample_count: 0,
      p95_ms: null,
      threshold_ms: target.threshold_ms,
      status: 'BLOCKED',
      reason: reason || 'PERF_LF_METRIC_BLOCKED',
      device_class: deviceClass || null
    });
  }

  function evaluateMetric(metricId, values, deviceClass) {
    var target = TARGETS[metricId];
    if (!target) throw fail('PERF_LF_METRIC_UNKNOWN');
    var inputCount = Array.isArray(values) ? values.length : 0;
    var samples = validSamples(values);
    if (samples.length !== inputCount) return blockedMetric(metricId, 'PERF_LF_INVALID_MEASUREMENT', deviceClass);
    if (samples.length < target.min_samples) return blockedMetric(metricId, 'PERF_LF_INSUFFICIENT_SAMPLES', deviceClass);
    var value = percentile95(samples);
    return Object.freeze({
      metric_id: metricId,
      sample_count: samples.length,
      p95_ms: Number(value.toFixed(3)),
      threshold_ms: target.threshold_ms,
      status: value <= target.threshold_ms ? 'PASS' : 'FAIL',
      reason: value <= target.threshold_ms ? null : 'PERF_LF_SLO_EXCEEDED',
      device_class: deviceClass || null
    });
  }

  function afterFrames(count) {
    var remaining = Math.max(1, Number(count) || 1);
    return new Promise(function (resolve) {
      function frame() {
        remaining -= 1;
        if (remaining <= 0) resolve();
        else root.requestAnimationFrame(frame);
      }
      root.requestAnimationFrame(frame);
    });
  }

  function waitUntil(predicate, timeoutMs, reason) {
    var started = now();
    return new Promise(function (resolve, reject) {
      function check() {
        var value = false;
        try { value = predicate(); } catch (error) { reject(error); return; }
        if (value) { resolve(value); return; }
        if (now() - started >= timeoutMs) { reject(fail(reason || 'PERF_LF_WAIT_TIMEOUT')); return; }
        root.requestAnimationFrame(check);
      }
      check();
    });
  }

  function activeRoute() {
    return String(root.document && root.document.body && root.document.body.dataset.activeLfRoute || 'home');
  }

  function financeMeaningfulReady(route) {
    if (FINANCE_ROUTES.indexOf(route) < 0) return false;
    var toolbar = root.document.getElementById('lf-finance-toolbar');
    var content = root.document.getElementById('lf-finance-content');
    if (!toolbar || !content || toolbar.hidden || content.hidden) return false;
    if (content.querySelector('.loading,.empty,.error')) return false;
    return !!content.querySelector('.kpi-grid,.panel-grid,.panel,.provenance,.series,.bars');
  }

  function dataMeaningfulReady(route) {
    if (route !== 'transactions' && route !== 'data-quality') return false;
    var grid = root.document.getElementById('lf-preview-grid');
    if (!grid || grid.hidden || String(grid.dataset.lfDataRoute || '') !== route) return false;
    if (grid.querySelector('.lf-data-status[data-state="ERROR"]')) return false;
    return !!grid.querySelector('.lf-data-shell');
  }

  function routeMeaningfulReady(route) {
    if (activeRoute() !== route) return false;
    return FINANCE_ROUTES.indexOf(route) >= 0 ? financeMeaningfulReady(route) : dataMeaningfulReady(route);
  }

  function signalFinanceMeaningfulCommit(element) {
    if (!element || element.id !== 'lf-finance-content') return null;
    var route = activeRoute();
    if (FINANCE_ROUTES.indexOf(route) < 0 || !financeMeaningfulReady(route)) return null;
    financeMeaningfulCommitSequence += 1;
    var entry = Object.freeze({
      sequence: financeMeaningfulCommitSequence,
      route: route,
      at: now()
    });
    var pending = financeMeaningfulCommitWaiters.slice();
    financeMeaningfulCommitWaiters = [];
    pending.forEach(function (waiter) {
      if (waiter.route === route && entry.sequence >= waiter.minSequence) waiter.resolve(entry);
      else financeMeaningfulCommitWaiters.push(waiter);
    });
    return entry;
  }

  function waitForFinanceMeaningfulCommit(route, timeoutMs) {
    if (FINANCE_ROUTES.indexOf(route) < 0) return Promise.reject(fail('PERF_LF_HISTORY_COMMIT_ROUTE_INVALID'));
    var minSequence = financeMeaningfulCommitSequence + 1;
    return new Promise(function (resolve, reject) {
      var settled = false;
      var waiter = {
        route: route,
        minSequence: minSequence,
        resolve: function (entry) {
          if (settled) return;
          settled = true;
          if (timeoutId !== null && root && typeof root.clearTimeout === 'function') root.clearTimeout(timeoutId);
          resolve(entry);
        }
      };
      financeMeaningfulCommitWaiters.push(waiter);
      var timeoutId = root && typeof root.setTimeout === 'function' ? root.setTimeout(function () {
        if (settled) return;
        settled = true;
        var index = financeMeaningfulCommitWaiters.indexOf(waiter);
        if (index >= 0) financeMeaningfulCommitWaiters.splice(index, 1);
        reject(fail('PERF_LF_HISTORY_MEANINGFUL_COMMIT_TIMEOUT'));
      }, Math.max(1, Number(timeoutMs) || 6000)) : null;
    });
  }

  function nextFrameAt() {
    return new Promise(function (resolve, reject) {
      if (!root || typeof root.requestAnimationFrame !== 'function') {
        reject(fail('PERF_LF_RAF_UNAVAILABLE'));
        return;
      }
      root.requestAnimationFrame(function () { resolve(now()); });
    });
  }

  async function waitRouteReady(route) {
    await waitUntil(function () { return routeMeaningfulReady(route); }, 6000, 'PERF_LF_ROUTE_NOT_READY');
    await afterFrames(2);
  }

  function warmRuntimeReadyState(spa, state) {
    return !!(spa && spa.financeWarmReady === true && state && state.snapshot_status === 'READY' &&
      state.view && state.view.status === 'READY');
  }

  async function waitWarmRuntimeReady() {
    var started = now();
    await waitUntil(function () {
      var spa = root.__PRH_LF_SPA_RUNTIME__ || {};
      var finance = root.__PRH_LF_FINANCE_RUNTIME__;
      var state = finance && typeof finance.getState === 'function' ? finance.getState() : null;
      return warmRuntimeReadyState(spa, state);
    }, 15000, 'PERF_LF_WARM_RUNTIME_NOT_READY');
    await afterFrames(2);
    var spa = root.__PRH_LF_SPA_RUNTIME__ || {};
    var finance = root.__PRH_LF_FINANCE_RUNTIME__;
    var state = finance && typeof finance.getState === 'function' ? finance.getState() : null;
    if (!warmRuntimeReadyState(spa, state)) throw fail('PERF_LF_WARM_RUNTIME_NOT_READY');
    return roundedDuration(now() - started);
  }

  function spaApi() {
    var api = root.__PRH_LF_SPA_TEST__;
    if (!api || typeof api.navigate !== 'function') throw fail('PERF_LF_SPA_RUNTIME_NOT_READY');
    return api;
  }

  async function navigateReady(route, historyEnabled) {
    spaApi().navigate(route, { focusMain: false, history: historyEnabled !== false });
    await waitRouteReady(route);
  }

  function counterSnapshot() {
    var spa = root.__PRH_LF_SPA_RUNTIME__ || {};
    var data = root.__PRH_LF_DATA_RUNTIME__ || {};
    return Object.freeze({
      mandatoryNetworkRequests: Number(spa.mandatoryNetworkCalls || 0) + Number(data.networkCalls || 0),
      googleSheetsReads: Number(spa.googleSheetsReads || 0) + Number(data.googleSheetsReads || 0),
      backgroundSyncCalls: Number(spa.backgroundSyncCalls || 0),
      documentLoads: Number(spa.bootCount || 0)
    });
  }

  function counterDelta(before, after) {
    return Object.freeze({
      mandatoryNetworkRequests: Math.max(0, after.mandatoryNetworkRequests - before.mandatoryNetworkRequests),
      googleSheetsReads: Math.max(0, after.googleSheetsReads - before.googleSheetsReads),
      backgroundSyncCalls: Math.max(0, after.backgroundSyncCalls - before.backgroundSyncCalls),
      documentLoads: after.documentLoads
    });
  }

  function resourceIndex() {
    if (!root.performance || typeof root.performance.getEntriesByType !== 'function') return 0;
    return root.performance.getEntriesByType('resource').length;
  }

  function observedResourceRequestsSince(index) {
    if (!root.performance || typeof root.performance.getEntriesByType !== 'function') return 0;
    return root.performance.getEntriesByType('resource').slice(index).filter(function (entry) {
      var name = String(entry && entry.name || '');
      return name.indexOf('blob:') !== 0 && name.indexOf('data:') !== 0;
    }).length;
  }

  function runtimeState() {
    var chip = root.document && root.document.getElementById('lf-sync-chip');
    return String(chip && chip.dataset.state || 'UNKNOWN').toUpperCase();
  }

  function safePrefix(value, length) {
    var text = String(value || '').toLowerCase();
    return /^[0-9a-f]{12,64}$/.test(text) ? text.slice(0, length || 12) : null;
  }

  function provenance() {
    var boot = root.__PRH_LF_SERVER_BOOT__ || {};
    var spa = root.__PRH_LF_SPA_RUNTIME__ || {};
    var runtimeTag = root.document && root.document.querySelector('script[data-prh-local-first-runtime]');
    return Object.freeze({
      candidate_sha_prefix: safePrefix(boot.candidateSha || boot.candidate_sha, 12),
      source_tree_hash_prefix: safePrefix(boot.sourceTreeHash || boot.source_tree_hash, 12),
      runtime_sha256_prefix: safePrefix(runtimeTag && runtimeTag.dataset.runtimeSha256, 12),
      revision_hash_prefix: safePrefix(spa.financeRevisionPrefix, 12)
    });
  }

  function idbRequest(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || fail('PERF_LF_LOCAL_STORE_READ_FAILED')); };
    });
  }

  function idbTransactionDone(transaction) {
    return new Promise(function (resolve, reject) {
      transaction.oncomplete = function () { resolve(); };
      transaction.onerror = function () { reject(transaction.error || fail('PERF_LF_LOCAL_STORE_READ_FAILED')); };
      transaction.onabort = function () { reject(transaction.error || fail('PERF_LF_LOCAL_STORE_READ_FAILED')); };
    });
  }

  function openExistingPerformanceStore() {
    return new Promise(function (resolve, reject) {
      var request;
      try { request = root.indexedDB.open(STORE_NAME); }
      catch (error) { reject(error); return; }
      request.onupgradeneeded = function () {
        try { request.transaction.abort(); } catch (error) { void error; }
        reject(fail('PERF_LF_LOCAL_STORE_NOT_READY'));
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || fail('PERF_LF_LOCAL_STORE_NOT_READY')); };
      request.onblocked = function () { reject(fail('PERF_LF_LOCAL_STORE_NOT_READY')); };
    });
  }

  async function probeActiveVerifiedMetadata() {
    var db = await openExistingPerformanceStore();
    try {
      if (!db.objectStoreNames.contains(META_STORE)) throw fail('PERF_LF_LOCAL_STORE_NOT_READY');
      var tx = db.transaction([META_STORE], 'readonly');
      var done = idbTransactionDone(tx);
      var meta = tx.objectStore(META_STORE);
      var active = await idbRequest(meta.get(ACTIVE_KEY));
      if (!active || active.status !== 'ACTIVE' || !HEX64.test(String(active.generation_id || '')) || !HEX64.test(String(active.revision || ''))) {
        await done;
        return null;
      }
      var manifest = await idbRequest(meta.get(MANIFEST_PREFIX + active.generation_id));
      await done;
      if (!manifest || manifest.status !== 'VERIFIED' || manifest.generation_id !== active.generation_id ||
          manifest.revision !== active.revision || !manifest.counts || typeof manifest.counts !== 'object') return null;
      return Object.freeze({ generation_id: active.generation_id, revision: active.revision, counts: Object.freeze(Object.assign({}, manifest.counts)) });
    } finally {
      db.close();
    }
  }

  function installFinanceDomRestoreCache() {
    if (domCacheInstalled || !root || !root.Element || !root.document) return false;
    var descriptor = Object.getOwnPropertyDescriptor(root.Element.prototype, 'innerHTML');
    if (!descriptor || typeof descriptor.get !== 'function' || typeof descriptor.set !== 'function' || descriptor.configurable === false) return false;
    var parked = new Map();
    var currentKey = new WeakMap();

    function park(element, key) {
      if (!key || !element.firstChild) return;
      var fragment = root.document.createDocumentFragment();
      while (element.firstChild) fragment.appendChild(element.firstChild);
      parked.delete(key);
      parked.set(key, fragment);
      while (parked.size > DOM_CACHE_LIMIT) parked.delete(parked.keys().next().value);
    }

    Object.defineProperty(root.Element.prototype, 'innerHTML', {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set: function (value) {
        if (!this || this.id !== 'lf-finance-content' || typeof value !== 'string') {
          descriptor.set.call(this, value);
          return;
        }
        var nextKey = String(value);
        var previousKey = currentKey.get(this) || null;
        if (previousKey === nextKey) {
          descriptor.set.call(this, value);
          currentKey.set(this, nextKey);
          signalFinanceMeaningfulCommit(this);
          return;
        }
        if (previousKey) park(this, previousKey);
        var cached = parked.get(nextKey);
        if (cached) {
          while (this.firstChild) this.removeChild(this.firstChild);
          this.appendChild(cached);
          parked.delete(nextKey);
          currentKey.set(this, nextKey);
          signalFinanceMeaningfulCommit(this);
          return;
        }
        descriptor.set.call(this, value);
        currentKey.set(this, nextKey);
        signalFinanceMeaningfulCommit(this);
      }
    });
    domCacheInstalled = true;
    return true;
  }

  async function probePriorVerifiedSnapshot() {
    if (!root || !root.indexedDB || !root.IDBKeyRange) {
      return Object.freeze({ cached: false, reason: 'PERF_LF_LOCAL_STORE_NOT_READY', p95_ms: null, phases: null });
    }
    try {
      var metadata = await probeActiveVerifiedMetadata();
      if (!metadata) {
        return Object.freeze({ cached: false, reason: 'PERF_LF_COLD_BOOTSTRAP_EXCLUDED', p95_ms: null, phases: null });
      }
      await waitUntil(function () { return !!root.__PRH_LF_SPA_TEST__; }, 6000, 'PERF_LF_SPA_RUNTIME_NOT_READY');
      await waitRouteReady(activeRoute());
      var readyMs = Number(now().toFixed(3));
      return Object.freeze({ cached: true, reason: null, p95_ms: readyMs, phases: navigationPhaseBreakdown(readyMs) });
    } catch (error) {
      return Object.freeze({ cached: false, reason: String(error && (error.code || error.message) || 'PERF_LF_CACHED_FMP_FAILED'), p95_ms: null, phases: null });
    }
  }

  installFinanceDomRestoreCache();
  installHistoryPhaseProbe();
  var cachedStartupProbe = root && root.document ? probePriorVerifiedSnapshot() : Promise.resolve(Object.freeze({ cached: false, reason: 'PERF_LF_BROWSER_REQUIRED', p95_ms: null, phases: null }));

  async function measureWarmRoutes() {
    var origin = activeRoute();
    for (var i = 0; i < ROUTES.length; i += 1) await navigateReady(ROUTES[i], false);
    var samples = [];
    for (var j = 0; j < ROUTE_SEQUENCE.length; j += 1) {
      var route = ROUTE_SEQUENCE[j];
      var started = now();
      await navigateReady(route, false);
      samples.push(now() - started);
    }
    await navigateReady(origin, false);
    return samples;
  }

  async function waitForFinanceMutation(trigger) {
    var content = root.document.getElementById('lf-finance-content');
    if (!content) throw fail('PERF_LF_FINANCE_CONTENT_MISSING');
    var mutated = false;
    var observer = new root.MutationObserver(function () { mutated = true; });
    observer.observe(content, { childList: true, subtree: true, characterData: true, attributes: true });
    var started = now();
    try {
      trigger();
      await waitUntil(function () { return mutated && financeMeaningfulReady('home'); }, 6000, 'PERF_LF_FILTER_RENDER_NOT_READY');
      await afterFrames(1);
      var kpi = now() - started;
      await afterFrames(1);
      var chart = now() - started;
      return Object.freeze({ kpi: kpi, chart: chart });
    } finally {
      observer.disconnect();
    }
  }

  async function measureFilterAndChart() {
    await navigateReady('home', false);
    var button = root.document.getElementById('lf-filter-apply');
    if (!button || button.disabled) throw fail('PERF_LF_FILTER_CONTROL_NOT_READY');
    await waitForFinanceMutation(function () { button.click(); });
    var kpiSamples = [];
    var chartSamples = [];
    for (var i = 0; i < 10; i += 1) {
      var sample = await waitForFinanceMutation(function () { button.click(); });
      kpiSamples.push(sample.kpi);
      chartSamples.push(sample.chart);
    }
    return Object.freeze({ kpi: Object.freeze(kpiSamples), chart: Object.freeze(chartSamples) });
  }

  async function measureHistoryAction(route, action) {
    var started = now();
    pendingHistoryPhase = { action_started: started, popstate_at: null };
    var meaningfulCommit = waitForFinanceMeaningfulCommit(route, 6000);
    try {
      action();
      var commit = await meaningfulCommit;
      if (!pendingHistoryPhase || pendingHistoryPhase.popstate_at === null) throw fail('PERF_LF_HISTORY_POPSTATE_NOT_OBSERVED');
      if (!commit || !finiteDuration(commit.at) || !routeMeaningfulReady(route)) throw fail('PERF_LF_HISTORY_MEANINGFUL_COMMIT_INVALID');
      var meaningfulReadyAt = commit.at;
      var firstFrameAt = await nextFrameAt();
      var stableFrameAt = await nextFrameAt();
      var phase = historyPhaseBreakdown(started, pendingHistoryPhase.popstate_at, meaningfulReadyAt, stableFrameAt, firstFrameAt);
      historyPhaseSamples.push(phase);
      return stableFrameAt - started;
    } finally {
      pendingHistoryPhase = null;
    }
  }

  async function measureHistory() {
    var origin = activeRoute();
    await navigateReady('home', false);
    await navigateReady('expenses', false);
    var samples = [];
    historyPhaseSamples = [];
    for (var i = 0; i < 5; i += 1) {
      await navigateReady('home', true);
      await navigateReady('expenses', true);
      samples.push(await measureHistoryAction('home', function () { root.history.back(); }));
      samples.push(await measureHistoryAction('expenses', function () { root.history.forward(); }));
    }
    await navigateReady(origin, false);
    return samples;
  }

  function deviceClass() {
    return root && root.innerWidth <= 600 ? 'REPRESENTATIVE_MOBILE' : 'DESKTOP';
  }

  function chartMetricId(device) {
    return device === 'REPRESENTATIVE_MOBILE' ? 'chart_repaint_mobile_p95' : 'chart_repaint_desktop_p95';
  }

  function counterpartChartMetricId(device) {
    return device === 'REPRESENTATIVE_MOBILE' ? 'chart_repaint_desktop_p95' : 'chart_repaint_mobile_p95';
  }

  async function run() {
    if (running) throw fail('PERF_LF_RUN_ALREADY_ACTIVE');
    running = true;
    var originalRoute = activeRoute();
    var before = counterSnapshot();
    var resourcesBefore = resourceIndex();
    var device = deviceClass();
    try {
      if (!root.document || !root.MutationObserver) throw fail('PERF_LF_BROWSER_REQUIRED');
      spaApi();
      await waitRouteReady(originalRoute);
      var startup = await cachedStartupProbe;
      var warmRuntimeReadyWaitMs = await waitWarmRuntimeReady();
      var routeSamples = await measureWarmRoutes();
      var filterChart = await measureFilterAndChart();
      var historySamples = await measureHistory();
      var after = counterSnapshot();
      var counters = counterDelta(before, after);
      var observedResources = observedResourceRequestsSince(resourcesBefore);
      var chartId = chartMetricId(device);
      var otherChartId = counterpartChartMetricId(device);
      var cachedMetric = startup.cached
        ? evaluateMetric('cached_first_meaningful_paint_p95', [startup.p95_ms], device)
        : blockedMetric('cached_first_meaningful_paint_p95', startup.reason, device);
      var metrics = [
        evaluateMetric('warm_route_switch_p95', routeSamples, device),
        evaluateMetric('filter_kpi_update_p95', filterChart.kpi, device),
        evaluateMetric(chartId, filterChart.chart, device),
        blockedMetric(otherChartId, 'PERF_LF_DEVICE_CLASS_NOT_MEASURED', device),
        evaluateMetric('back_forward_p95', historySamples, device),
        cachedMetric
      ];
      var applicable = metrics.filter(function (metric) { return metric.reason !== 'PERF_LF_DEVICE_CLASS_NOT_MEASURED'; });
      var reasons = [];
      if (applicable.some(function (metric) { return metric.status === 'FAIL'; })) reasons.push('PERF_LF_SLO_EXCEEDED');
      if (applicable.some(function (metric) { return metric.status === 'BLOCKED'; })) reasons.push('PERF_LF_METRIC_BLOCKED');
      if (counters.mandatoryNetworkRequests !== 0) reasons.push('PERF_LF_MANDATORY_NETWORK_DETECTED');
      if (counters.googleSheetsReads !== 0) reasons.push('PERF_LF_GOOGLE_SHEETS_READ_DETECTED');
      if (counters.documentLoads !== 1) reasons.push('PERF_LF_DOCUMENT_RELOAD_DETECTED');
      if (observedResources !== 0) reasons.push('PERF_LF_WARM_RESOURCE_ACTIVITY_DETECTED');
      if (runtimeState() !== 'READY') reasons.push('PERF_LF_RUNTIME_NOT_READY_FOR_ATTESTATION');
      var uniqueReasons = reasons.filter(function (reason, index) { return reasons.indexOf(reason) === index; });
      var report = Object.freeze({
        schema: SCHEMA,
        version: VERSION,
        status: uniqueReasons.length ? (uniqueReasons.some(function (reason) { return reason === 'PERF_LF_SLO_EXCEEDED' || reason.indexOf('_DETECTED') >= 0; }) ? 'FAIL' : 'BLOCKED') : 'PASS',
        reason: uniqueReasons.length ? uniqueReasons.join('+') : null,
        metrics: Object.freeze(metrics),
        mandatory_network_requests: counters.mandatoryNetworkRequests,
        google_sheets_reads: counters.googleSheetsReads,
        observed_resource_requests: observedResources,
        background_sync_calls: counters.backgroundSyncCalls,
        document_loads: counters.documentLoads,
        device_class: device,
        runtime_state: runtimeState(),
        provenance: provenance(),
        cached_fmp_phases: startup.phases || null,
        back_forward_phases: historyPhaseP95(historyPhaseSamples),
        warm_runtime_ready_wait_ms: warmRuntimeReadyWaitMs,
        cold_bootstrap_included: false,
        route_warmup_count: ROUTES.length,
        financial_payload_in_report: false
      });
      lastReport = report;
      if (root.__PRH_LF_SPA_RUNTIME__) root.__PRH_LF_SPA_RUNTIME__.lastPerformanceReport = report;
      return report;
    } finally {
      running = false;
      try { if (activeRoute() !== originalRoute && root.__PRH_LF_SPA_TEST__) await navigateReady(originalRoute, false); } catch (error) { void error; }
    }
  }

  function metricLabel(metricId) {
    return ({
      warm_route_switch_p95: 'Переход между разделами',
      filter_kpi_update_p95: 'Фильтр и KPI',
      chart_repaint_desktop_p95: 'График · desktop',
      chart_repaint_mobile_p95: 'График · mobile',
      back_forward_p95: 'Back / Forward',
      cached_first_meaningful_paint_p95: 'Cached first meaningful paint'
    })[metricId] || metricId;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function phaseText(fmp, history, warmReadyWaitMs) {
    function ms(value) { return value == null ? '—' : Number(value).toFixed(1) + ' мс'; }
    var fmpText = fmp ? ('FMP · responseStart ' + ms(fmp.response_start_ms) +
      ' · responseEnd ' + ms(fmp.response_end_ms) +
      ' · module ' + ms(fmp.module_start_ms) +
      ' · READY ' + ms(fmp.ready_ms) +
      ' · response→module ' + ms(fmp.response_to_module_ms) +
      ' · module→READY ' + ms(fmp.module_to_ready_ms)) : 'FMP phases: недоступно';
    var historyText = history ? ('Back/Forward phases · action→popstate ' + ms(history.action_to_popstate_p95_ms) +
      ' · popstate→READY ' + ms(history.popstate_to_meaningful_ready_p95_ms) +
      ' · READY→RAF1 ' + ms(history.meaningful_ready_to_first_frame_p95_ms) +
      ' · RAF1→RAF2 ' + ms(history.first_to_stable_frame_p95_ms) +
      ' · READY→2RAF ' + ms(history.meaningful_ready_to_stable_frame_p95_ms)) : 'Back/Forward phases: недоступно';
    return fmpText + ' · warm-ready wait ' + ms(warmReadyWaitMs) + ' | ' + historyText;
  }

  function renderReport(report) {
    var output = root.document.getElementById('lf-perf-result');
    var body = root.document.getElementById('lf-perf-body');
    var phases = root.document.getElementById('lf-perf-phases');
    if (!output || !body) return;
    body.innerHTML = report.metrics.map(function (metric) {
      var value = metric.p95_ms == null ? '—' : metric.p95_ms.toFixed(2) + ' мс';
      var reason = metric.reason ? ' · ' + metric.reason : '';
      return '<tr data-metric="' + esc(metric.metric_id) + '" data-status="' + esc(metric.status) + '">' +
        '<td>' + esc(metricLabel(metric.metric_id)) + '</td><td>' + esc(String(metric.sample_count)) + '</td>' +
        '<td>' + esc(value) + '</td><td>≤ ' + esc(String(metric.threshold_ms)) + ' мс</td>' +
        '<td><strong>' + esc(metric.status) + '</strong><span class="lf-perf-reason">' + esc(reason) + '</span></td></tr>';
    }).join('');
    output.dataset.status = report.status;
    output.dataset.reason = report.reason || '';
    output.textContent = report.status + ' · сеть: ' + report.mandatory_network_requests +
      ' · Sheets: ' + report.google_sheets_reads + ' · resources: ' + report.observed_resource_requests +
      ' · ' + report.device_class + (report.reason ? ' · ' + report.reason : '');
    if (phases) phases.textContent = phaseText(report.cached_fmp_phases, report.back_forward_phases, report.warm_runtime_ready_wait_ms);
  }

  function installUi() {
    if (!root.document || root.document.getElementById('lf-performance-report')) return false;
    var params = new URL(root.location.href).searchParams;
    if (String(params.get('lf_diag') || '') !== '1') return false;
    var main = root.document.getElementById('lf-main');
    if (!main) return false;
    var style = root.document.createElement('style');
    style.setAttribute('data-prh-local-first-performance-style', VERSION);
    style.textContent = '.lf-perf-table-wrap{overflow:auto;max-width:100%}.lf-perf-table{width:100%;border-collapse:collapse;margin-top:12px;min-width:680px}.lf-perf-table th,.lf-perf-table td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.lf-perf-table th{font-size:12px;color:var(--muted)}.lf-perf-table tr[data-status="PASS"] strong{color:var(--ok)}.lf-perf-table tr[data-status="FAIL"] strong{color:var(--bad)}.lf-perf-table tr[data-status="BLOCKED"] strong{color:var(--warn)}.lf-perf-reason{font-size:11px;color:var(--muted);overflow-wrap:anywhere}#lf-perf-result{overflow-wrap:anywhere}#lf-perf-phases{margin-top:8px;font-size:11px;color:var(--muted);overflow-wrap:anywhere}';
    root.document.head.appendChild(style);
    var section = root.document.createElement('section');
    section.className = 'diagnostic';
    section.id = 'lf-performance-report';
    section.setAttribute('data-lf-diagnostic', 'performance-truth');
    section.innerHTML = '<h2>Performance Report</h2><p>Проверяет тёплые переходы, фильтр/KPI, перерисовку графиков, Back/Forward и cached first meaningful paint отдельно от cold bootstrap. Финансовые значения в отчёт не попадают.</p>' +
      '<div class="diagnostic-actions"><button class="button secondary" type="button" id="lf-perf-run">Проверить Local-first SLO</button><output id="lf-perf-result" aria-live="polite">Готово к проверке</output></div>' +
      '<div id="lf-perf-phases">FMP phases появятся после измерения</div>' +
      '<div class="lf-perf-table-wrap"><table class="lf-perf-table"><thead><tr><th>SLO</th><th>Замеры</th><th>P95</th><th>Порог</th><th>Статус</th></tr></thead><tbody id="lf-perf-body"></tbody></table></div>';
    main.appendChild(section);
    var button = root.document.getElementById('lf-perf-run');
    button.addEventListener('click', async function () {
      var output = root.document.getElementById('lf-perf-result');
      button.disabled = true;
      output.dataset.status = 'RUNNING';
      output.textContent = 'Прогреваем маршруты и выполняем замеры…';
      try {
        renderReport(await run());
      } catch (error) {
        var reason = String(error && (error.code || error.message) || 'PERF_LF_RUN_FAILED');
        output.dataset.status = 'BLOCKED';
        output.dataset.reason = reason;
        output.textContent = 'Измерение недоступно: ' + reason;
      } finally {
        button.disabled = false;
      }
    });
    return true;
  }

  function autoInstall() {
    if (!root || !root.document) return false;
    installFinanceDomRestoreCache();
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', installUi, { once: true });
      return true;
    }
    installUi();
    return true;
  }

  return Object.freeze({
    schema: SCHEMA,
    version: VERSION,
    storeName: STORE_NAME,
    targets: TARGETS,
    routes: ROUTES,
    validSamples: validSamples,
    percentile95: percentile95,
    evaluateMetric: evaluateMetric,
    blockedMetric: blockedMetric,
    fmpPhaseBreakdown: fmpPhaseBreakdown,
    historyPhaseBreakdown: historyPhaseBreakdown,
    warmRuntimeReadyState: warmRuntimeReadyState,
    run: run,
    getLastReport: function () { return lastReport; },
    autoInstall: autoInstall
  });
});