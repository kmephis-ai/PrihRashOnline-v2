(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PrhLocalFirstSync = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var SCHEMA = 'PRH_LOCAL_FIRST_SYNC_V1';
  var VERSION = '1.0.0';
  var RESPONSE_SCHEMA = 'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1';
  var HEX64 = /^[0-9a-f]{64}$/;
  var DEFAULT_CHUNK_SIZE = 250;
  var DATA_STORES = ['transactions', 'dimensions', 'aggregates', 'sync_journal'];
  var REMOTE_TECHNICAL_REASON_RE = /\b(?:LOCAL_FIRST|CANONICAL|RUNTIME_HEALTH|R2|WORKER)_[A-Z0-9_]{2,96}\b/;

  function fail(code, detail) {
    var error = new Error(detail ? code + ':' + detail : code);
    error.code = code;
    return error;
  }

  function boundedReason(error, fallback) {
    var value = String(error && (error.code || error.message) || fallback || 'LOCAL_FIRST_SYNC_FAILED');
    var colon = value.indexOf(':');
    if (colon >= 0) value = value.slice(0, colon);
    return /^[A-Z][A-Z0-9_]{2,79}$/.test(value) ? value : (fallback || 'LOCAL_FIRST_SYNC_FAILED');
  }

  function remoteTechnicalReason(error) {
    var candidates = [
      error && error.code,
      error && error.message,
      error == null ? '' : String(error)
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      var match = String(candidates[i] || '').match(REMOTE_TECHNICAL_REASON_RE);
      if (match) return match[0];
    }
    return 'LOCAL_FIRST_SYNC_REMOTE_CALL_FAILED';
  }

  function validateHex64(value, code) {
    var normalized = String(value || '').trim().toLowerCase();
    if (!HEX64.test(normalized)) throw fail(code || 'LOCAL_FIRST_SYNC_REVISION_INVALID');
    return normalized;
  }

  function normalizeCounts(value) {
    var counts = {};
    DATA_STORES.forEach(function (name) {
      var count = value && value[name];
      if (!Number.isInteger(count) || count < 0) throw fail('LOCAL_FIRST_SYNC_COUNTS_INVALID', name);
      counts[name] = count;
    });
    return counts;
  }

  function validateNoWriteAuthority(envelope) {
    if (envelope.financial_write_authorized !== false || envelope.canonical_mutation_performed !== false) {
      throw fail('LOCAL_FIRST_SYNC_WRITE_AUTHORITY_VIOLATION');
    }
  }

  function validateRemoteEnvelope(envelope, activeRevision) {
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
      throw fail('LOCAL_FIRST_SYNC_RESPONSE_INVALID');
    }
    if (envelope.schema !== RESPONSE_SCHEMA || envelope.version !== VERSION) {
      throw fail('LOCAL_FIRST_SYNC_RESPONSE_CONTRACT_MISMATCH');
    }
    validateNoWriteAuthority(envelope);
    var revision = validateHex64(envelope.revision, 'LOCAL_FIRST_SYNC_REMOTE_REVISION_INVALID');
    var generationId = validateHex64(envelope.generation_id, 'LOCAL_FIRST_SYNC_GENERATION_INVALID');
    if (generationId !== revision) throw fail('LOCAL_FIRST_SYNC_GENERATION_REVISION_MISMATCH');

    if (envelope.state === 'NOOP') {
      if (!activeRevision || activeRevision !== revision) throw fail('LOCAL_FIRST_SYNC_NOOP_REVISION_MISMATCH');
      return Object.freeze({ state: 'NOOP', revision: revision, generation_id: generationId });
    }
    if (envelope.state !== 'FULL_BOOTSTRAP') throw fail('LOCAL_FIRST_SYNC_STATE_INVALID');
    if (activeRevision && activeRevision === revision) throw fail('LOCAL_FIRST_SYNC_EXPECTED_NOOP');

    var payload = {};
    DATA_STORES.forEach(function (name) {
      if (!Array.isArray(envelope[name])) throw fail('LOCAL_FIRST_SYNC_PAYLOAD_INVALID', name);
      payload[name] = envelope[name].slice();
    });
    var expectedCounts = normalizeCounts(envelope.expected_counts);
    DATA_STORES.forEach(function (name) {
      if (payload[name].length !== expectedCounts[name]) {
        throw fail('LOCAL_FIRST_SYNC_PAYLOAD_COUNT_MISMATCH', name);
      }
    });
    return Object.freeze({
      state: 'FULL_BOOTSTRAP',
      revision: revision,
      generation_id: generationId,
      transactions: payload.transactions,
      dimensions: payload.dimensions,
      aggregates: payload.aggregates,
      sync_journal: payload.sync_journal,
      expected_counts: expectedCounts
    });
  }

  function createGoogleScriptTransport(options) {
    options = options || {};
    var runner = options.googleScriptRun || (root && root.google && root.google.script && root.google.script.run);
    if (!runner) throw fail('LOCAL_FIRST_SYNC_GOOGLE_SCRIPT_RUN_UNAVAILABLE');
    return Object.freeze({
      fetchBootstrap: function (request) {
        return new Promise(function (resolve, reject) {
          var chain;
          try {
            chain = runner.withSuccessHandler(resolve).withFailureHandler(function (error) {
              reject(fail(remoteTechnicalReason(error)));
            });
            chain.prhLocalFirstSyncBootstrap(request || {});
          } catch (error) {
            reject(fail(remoteTechnicalReason(error)));
          }
        });
      }
    });
  }

  function createSyncCoordinator(options) {
    options = options || {};
    var store = options.store;
    var transport = options.transport;
    var chunkSize = options.chunkSize == null ? DEFAULT_CHUNK_SIZE : Number(options.chunkSize);
    if (!store || typeof store.status !== 'function' || typeof store.getActiveSnapshot !== 'function' ||
        typeof store.beginGeneration !== 'function' || typeof store.writeGenerationChunk !== 'function' ||
        typeof store.finalizeGeneration !== 'function' || typeof store.abortGeneration !== 'function') {
      throw fail('LOCAL_FIRST_SYNC_STORE_INVALID');
    }
    if (!transport || typeof transport.fetchBootstrap !== 'function') throw fail('LOCAL_FIRST_SYNC_TRANSPORT_INVALID');
    if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 5000) throw fail('LOCAL_FIRST_SYNC_CHUNK_SIZE_INVALID');

    var inFlight = null;

    function summaryFromStatus(status) {
      return status && status.status === 'READY' ? Object.freeze({
        generation_id: status.generation_id,
        revision: status.revision,
        counts: status.counts || null
      }) : null;
    }

    async function readLocal(options) {
      return store.getActiveSnapshot(options || {});
    }

    async function cleanupStaging(generationId) {
      try {
        await store.abortGeneration(generationId);
      } catch (error) {
        if (boundedReason(error) === 'ACTIVE_GENERATION_ABORT_FORBIDDEN') throw error;
      }
    }

    async function writeStoreChunks(generationId, revision, storeName, records) {
      for (var offset = 0; offset < records.length; offset += chunkSize) {
        var input = {
          generationId: generationId,
          revision: revision,
          transactions: [],
          dimensions: [],
          aggregates: [],
          sync_journal: []
        };
        input[storeName] = records.slice(offset, offset + chunkSize);
        await store.writeGenerationChunk(input);
      }
    }

    async function executeSync() {
      var started = Date.now();
      var before = await store.status();
      if (before.status === 'REBUILD_REQUIRED') {
        return Object.freeze({
          status: 'BLOCKED',
          reason: 'REBUILD_REQUIRED',
          active: null,
          duration_ms: Math.max(0, Date.now() - started)
        });
      }
      var activeBefore = summaryFromStatus(before);
      var localRevision = activeBefore ? activeBefore.revision : '';
      var rawRemote;
      try {
        rawRemote = await transport.fetchBootstrap({ local_revision: localRevision });
      } catch (error) {
        return Object.freeze({
          status: activeBefore ? 'DEGRADED' : 'FAILED',
          reason: boundedReason(error, 'LOCAL_FIRST_SYNC_REMOTE_UNAVAILABLE'),
          active: activeBefore,
          duration_ms: Math.max(0, Date.now() - started)
        });
      }

      var remote;
      try {
        remote = validateRemoteEnvelope(rawRemote, localRevision || null);
      } catch (error) {
        return Object.freeze({
          status: activeBefore ? 'DEGRADED' : 'FAILED',
          reason: boundedReason(error, 'LOCAL_FIRST_SYNC_RESPONSE_INVALID'),
          active: activeBefore,
          duration_ms: Math.max(0, Date.now() - started)
        });
      }

      if (remote.state === 'NOOP') {
        return Object.freeze({
          status: 'NOOP',
          reason: null,
          active: activeBefore,
          revision: remote.revision,
          generation_id: remote.generation_id,
          duration_ms: Math.max(0, Date.now() - started)
        });
      }

      var generationId = remote.generation_id;
      var began = false;
      try {
        await cleanupStaging(generationId);
        await store.beginGeneration({ generationId: generationId, revision: remote.revision });
        began = true;
        for (var i = 0; i < DATA_STORES.length; i += 1) {
          var name = DATA_STORES[i];
          await writeStoreChunks(generationId, remote.revision, name, remote[name]);
        }
        var finalized = await store.finalizeGeneration({
          generationId: generationId,
          revision: remote.revision,
          expectedCounts: remote.expected_counts
        });
        if (!finalized || finalized.status !== 'ACTIVE' || finalized.generation_id !== generationId ||
            finalized.revision !== remote.revision) {
          throw fail('LOCAL_FIRST_SYNC_FINALIZE_INVALID');
        }
        var after = await store.status();
        if (!after || after.status !== 'READY' || after.generation_id !== generationId || after.revision !== remote.revision) {
          throw fail('LOCAL_FIRST_SYNC_ACTIVE_VERIFY_FAILED');
        }
        return Object.freeze({
          status: 'UPDATED',
          reason: null,
          previous_active: activeBefore,
          active: summaryFromStatus(after),
          revision: remote.revision,
          generation_id: generationId,
          duration_ms: Math.max(0, Date.now() - started)
        });
      } catch (error) {
        if (began) {
          try { await store.abortGeneration(generationId); } catch (abortError) { void abortError; }
        }
        var preserved = await store.status();
        var activePreserved = summaryFromStatus(preserved);
        return Object.freeze({
          status: activePreserved ? 'DEGRADED' : 'FAILED',
          reason: boundedReason(error, 'LOCAL_FIRST_SYNC_APPLY_FAILED'),
          active: activePreserved,
          duration_ms: Math.max(0, Date.now() - started)
        });
      }
    }

    function sync() {
      if (inFlight) return inFlight;
      inFlight = Promise.resolve().then(executeSync).finally(function () { inFlight = null; });
      return inFlight;
    }

    function startBackgroundSync(onResult) {
      return Promise.resolve().then(sync).then(function (result) {
        if (typeof onResult === 'function') onResult(result);
        return result;
      });
    }

    return Object.freeze({
      readLocal: readLocal,
      sync: sync,
      startBackgroundSync: startBackgroundSync,
      isSyncing: function () { return !!inFlight; }
    });
  }

  return Object.freeze({
    schema: SCHEMA,
    version: VERSION,
    responseSchema: RESPONSE_SCHEMA,
    defaultChunkSize: DEFAULT_CHUNK_SIZE,
    validateRemoteEnvelope: validateRemoteEnvelope,
    createGoogleScriptTransport: createGoogleScriptTransport,
    createSyncCoordinator: createSyncCoordinator
  });
});
