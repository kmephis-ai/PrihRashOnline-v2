(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PrhLocalFirstDelta = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var SCHEMA = 'PRH_LOCAL_FIRST_DELTA_V1';
  var VERSION = '1.0.0';
  var RESPONSE_SCHEMA = 'PRH_LOCAL_FIRST_DELTA_RESPONSE_V1';
  var HEX64 = /^[0-9a-f]{64}$/;
  var DEFAULT_CHUNK_SIZE = 250;
  var DATA_STORES = ['transactions', 'dimensions', 'aggregates', 'sync_journal'];
  var CANONICAL_TRANSACTION_KEYS = Object.freeze([
    'schema', 'schema_version', 'transaction_id', 'occurred_at', 'type', 'status',
    'amount_minor', 'currency', 'account_id', 'destination_account_id', 'category_id',
    'member_id', 'project_id', 'tags', 'counterparty', 'description',
    'reverses_transaction_id', 'adjustment_semantics', 'provenance'
  ]);
  var CANONICAL_PROVENANCE_KEYS = Object.freeze([
    'source_system', 'source_container', 'source_record_id', 'source_fingerprint',
    'identity_strategy', 'transform_version', 'source_position'
  ]);

  function fail(code, detail) {
    var error = new Error(detail ? code + ':' + detail : code);
    error.code = code;
    return error;
  }

  function boundedReason(error, fallback) {
    var value = String(error && (error.code || error.message) || fallback || 'LOCAL_FIRST_DELTA_FAILED');
    var colon = value.indexOf(':');
    if (colon >= 0) value = value.slice(0, colon);
    return /^[A-Z][A-Z0-9_]{2,79}$/.test(value) ? value : (fallback || 'LOCAL_FIRST_DELTA_FAILED');
  }

  function hex64(value, code) {
    var text = String(value || '').trim().toLowerCase();
    if (!HEX64.test(text)) throw fail(code || 'LOCAL_FIRST_DELTA_REVISION_INVALID');
    return text;
  }

  function assertExactObjectKeys(value, expectedKeys, code) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail(code);
    var actual = Object.keys(value).sort();
    var expected = expectedKeys.slice().sort();
    if (actual.length !== expected.length) throw fail(code);
    for (var i = 0; i < expected.length; i += 1) {
      if (actual[i] !== expected[i]) throw fail(code);
    }
    return value;
  }

  function assertCanonicalTransactionShape(tx) {
    assertExactObjectKeys(tx, CANONICAL_TRANSACTION_KEYS, 'LOCAL_FIRST_DELTA_TRANSACTION_SHAPE_INVALID');
    assertExactObjectKeys(tx.provenance, CANONICAL_PROVENANCE_KEYS, 'LOCAL_FIRST_DELTA_PROVENANCE_SHAPE_INVALID');
    return tx;
  }

  function revisionRow(tx) {
    assertCanonicalTransactionShape(tx);
    if (tx.schema !== 'PRH_CANONICAL_TRANSACTION_V1' || tx.schema_version !== 1 ||
        !tx.transaction_id || !tx.provenance || !Array.isArray(tx.tags)) {
      throw fail('LOCAL_FIRST_DELTA_TRANSACTION_INVALID');
    }
    return {
      transaction_id: tx.transaction_id,
      occurred_at: tx.occurred_at,
      type: tx.type,
      status: tx.status,
      amount_minor: tx.amount_minor,
      currency: tx.currency,
      account_id: tx.account_id,
      destination_account_id: tx.destination_account_id,
      category_id: tx.category_id,
      member_id: tx.member_id,
      project_id: tx.project_id,
      tags: tx.tags,
      reverses_transaction_id: tx.reverses_transaction_id,
      adjustment_semantics: tx.adjustment_semantics,
      source_identity: [
        tx.provenance.source_system,
        tx.provenance.identity_strategy,
        tx.provenance.source_record_id,
        tx.provenance.source_fingerprint,
        tx.provenance.transform_version
      ]
    };
  }

  async function sha256Hex(text) {
    var input = String(text);
    if (root && root.crypto && root.crypto.subtle && root.TextEncoder) {
      var bytes = new root.TextEncoder().encode(input);
      var digest = await root.crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest)).map(function (value) {
        return value.toString(16).padStart(2, '0');
      }).join('');
    }
    if (typeof require === 'function') {
      return require('crypto').createHash('sha256').update(input, 'utf8').digest('hex');
    }
    throw fail('LOCAL_FIRST_DELTA_SHA256_UNAVAILABLE');
  }

  async function repositoryRevision(transactions) {
    if (!Array.isArray(transactions)) throw fail('LOCAL_FIRST_DELTA_TRANSACTIONS_INVALID');
    var seen = {};
    var stable = transactions.map(function (tx) {
      var row = revisionRow(tx);
      if (seen[row.transaction_id]) throw fail('LOCAL_FIRST_DELTA_TRANSACTION_ID_DUPLICATE');
      seen[row.transaction_id] = true;
      return row;
    }).sort(function (left, right) {
      return left.transaction_id < right.transaction_id ? -1 : (left.transaction_id > right.transaction_id ? 1 : 0);
    });
    return sha256Hex(JSON.stringify(stable));
  }

  async function transactionEtag(tx) {
    return sha256Hex(JSON.stringify(revisionRow(tx)));
  }

  async function dimensionEtag(row) {
    if (!row || !row.dimension_key || !row.kind || !row.dimension_id || !row.label) {
      throw fail('LOCAL_FIRST_DELTA_DIMENSION_INVALID');
    }
    return sha256Hex(JSON.stringify({
      dimension_key: String(row.dimension_key),
      kind: String(row.kind),
      dimension_id: String(row.dimension_id),
      label: String(row.label)
    }));
  }

  async function buildInventory(snapshot) {
    if (!snapshot || snapshot.status !== 'READY') throw fail('LOCAL_FIRST_DELTA_VERIFIED_SNAPSHOT_REQUIRED');
    var revision = hex64(snapshot.revision, 'LOCAL_FIRST_DELTA_BASE_REVISION_INVALID');
    if (String(snapshot.generation_id || '') !== revision) throw fail('LOCAL_FIRST_DELTA_GENERATION_REVISION_MISMATCH');
    if (!Array.isArray(snapshot.transactions) || !Array.isArray(snapshot.dimensions)) {
      throw fail('LOCAL_FIRST_DELTA_SNAPSHOT_SHAPE_INVALID');
    }

    var transactions = await Promise.all(snapshot.transactions.map(async function (tx) {
      return Object.freeze({ key: String(tx.transaction_id), etag: await transactionEtag(tx) });
    }));
    transactions.sort(function (left, right) { return left.key < right.key ? -1 : (left.key > right.key ? 1 : 0); });
    var dimensions = await Promise.all(snapshot.dimensions.map(async function (row) {
      return Object.freeze({ key: String(row.dimension_key), etag: await dimensionEtag(row) });
    }));
    dimensions.sort(function (left, right) { return left.key < right.key ? -1 : (left.key > right.key ? 1 : 0); });
    var digest = await sha256Hex(JSON.stringify({ transactions: transactions, dimensions: dimensions }));
    return Object.freeze({
      base_revision: revision,
      inventory: Object.freeze({ transactions: Object.freeze(transactions), dimensions: Object.freeze(dimensions), digest: digest })
    });
  }

  function validateCounts(value) {
    var result = {};
    DATA_STORES.forEach(function (name) {
      var count = value && value[name];
      if (!Number.isInteger(count) || count < 0) throw fail('LOCAL_FIRST_DELTA_COUNTS_INVALID', name);
      result[name] = count;
    });
    return result;
  }

  function assertUniqueStrings(values, code) {
    if (!Array.isArray(values)) throw fail(code);
    var seen = {};
    return values.map(function (value) {
      var text = String(value || '').trim();
      if (!text || text.length > 256 || seen[text]) throw fail(code);
      seen[text] = true;
      return text;
    }).sort();
  }

  function assertUniqueRecords(values, keyField, code) {
    if (!Array.isArray(values)) throw fail(code);
    var seen = {};
    return values.map(function (row) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw fail(code);
      var key = String(row[keyField] || '').trim();
      if (!key || key.length > 256 || seen[key]) throw fail(code);
      seen[key] = true;
      return row;
    }).sort(function (left, right) {
      var a = String(left[keyField]);
      var b = String(right[keyField]);
      return a < b ? -1 : (a > b ? 1 : 0);
    });
  }

  async function validateRemoteEnvelope(envelope, requestContext) {
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw fail('LOCAL_FIRST_DELTA_RESPONSE_INVALID');
    if (envelope.schema !== RESPONSE_SCHEMA || envelope.version !== VERSION) throw fail('LOCAL_FIRST_DELTA_RESPONSE_CONTRACT_MISMATCH');
    if (envelope.financial_write_authorized !== false || envelope.canonical_mutation_performed !== false) {
      throw fail('LOCAL_FIRST_DELTA_WRITE_AUTHORITY_VIOLATION');
    }
    var baseRevision = hex64(envelope.base_revision, 'LOCAL_FIRST_DELTA_REMOTE_BASE_INVALID');
    var targetRevision = hex64(envelope.target_revision, 'LOCAL_FIRST_DELTA_REMOTE_TARGET_INVALID');
    var targetGenerationId = hex64(envelope.target_generation_id, 'LOCAL_FIRST_DELTA_REMOTE_GENERATION_INVALID');
    var inventoryDigest = hex64(envelope.base_inventory_digest, 'LOCAL_FIRST_DELTA_REMOTE_INVENTORY_DIGEST_INVALID');
    if (!requestContext || baseRevision !== requestContext.base_revision || inventoryDigest !== requestContext.inventory.digest) {
      throw fail('LOCAL_FIRST_DELTA_REQUEST_BINDING_MISMATCH');
    }
    if (targetGenerationId !== targetRevision) throw fail('LOCAL_FIRST_DELTA_TARGET_GENERATION_MISMATCH');

    if (envelope.state === 'NOOP') {
      if (targetRevision !== baseRevision) throw fail('LOCAL_FIRST_DELTA_NOOP_REVISION_MISMATCH');
      return Object.freeze({ state: 'NOOP', base_revision: baseRevision, target_revision: targetRevision, target_generation_id: targetGenerationId });
    }
    if (envelope.state === 'FULL_REBUILD_REQUIRED') {
      return Object.freeze({
        state: 'FULL_REBUILD_REQUIRED',
        base_revision: baseRevision,
        target_revision: targetRevision,
        target_generation_id: targetGenerationId,
        reason_code: boundedReason({ code: envelope.reason_code }, 'LOCAL_FIRST_DELTA_FULL_REBUILD_REQUIRED')
      });
    }
    if (envelope.state !== 'DELTA') throw fail('LOCAL_FIRST_DELTA_STATE_INVALID');
    if (targetRevision === baseRevision) throw fail('LOCAL_FIRST_DELTA_TARGET_EQUALS_BASE');
    var deltaId = hex64(envelope.delta_id, 'LOCAL_FIRST_DELTA_ID_INVALID');
    var expectedDeltaId = await sha256Hex('PRH_LOCAL_FIRST_DELTA_V1|' + baseRevision + '|' + targetRevision + '|' + inventoryDigest);
    if (deltaId !== expectedDeltaId) throw fail('LOCAL_FIRST_DELTA_ID_MISMATCH');

    var transactionUpserts = assertUniqueRecords(envelope.transaction_upserts, 'transaction_id', 'LOCAL_FIRST_DELTA_TRANSACTION_UPSERTS_INVALID');
    transactionUpserts.forEach(revisionRow);
    var transactionDeletes = assertUniqueStrings(envelope.transaction_deletes, 'LOCAL_FIRST_DELTA_TRANSACTION_DELETES_INVALID');
    var dimensionUpserts = assertUniqueRecords(envelope.dimension_upserts, 'dimension_key', 'LOCAL_FIRST_DELTA_DIMENSION_UPSERTS_INVALID');
    dimensionUpserts.forEach(function (row) {
      if (!row.kind || !row.dimension_id || !row.label) throw fail('LOCAL_FIRST_DELTA_DIMENSION_UPSERTS_INVALID');
    });
    var dimensionDeletes = assertUniqueStrings(envelope.dimension_deletes, 'LOCAL_FIRST_DELTA_DIMENSION_DELETES_INVALID');
    var txUpsertKeys = {};
    transactionUpserts.forEach(function (row) { txUpsertKeys[row.transaction_id] = true; });
    if (transactionDeletes.some(function (key) { return txUpsertKeys[key]; })) throw fail('LOCAL_FIRST_DELTA_TRANSACTION_OPERATION_CONFLICT');
    var dimUpsertKeys = {};
    dimensionUpserts.forEach(function (row) { dimUpsertKeys[row.dimension_key] = true; });
    if (dimensionDeletes.some(function (key) { return dimUpsertKeys[key]; })) throw fail('LOCAL_FIRST_DELTA_DIMENSION_OPERATION_CONFLICT');

    return Object.freeze({
      state: 'DELTA',
      delta_id: deltaId,
      base_revision: baseRevision,
      target_revision: targetRevision,
      target_generation_id: targetGenerationId,
      transaction_upserts: Object.freeze(transactionUpserts),
      transaction_deletes: Object.freeze(transactionDeletes),
      dimension_upserts: Object.freeze(dimensionUpserts),
      dimension_deletes: Object.freeze(dimensionDeletes),
      expected_counts: Object.freeze(validateCounts(envelope.expected_counts))
    });
  }

  function createGoogleScriptDeltaTransport(options) {
    options = options || {};
    var runner = options.googleScriptRun || (root && root.google && root.google.script && root.google.script.run);
    if (!runner) throw fail('LOCAL_FIRST_DELTA_GOOGLE_SCRIPT_RUN_UNAVAILABLE');
    return Object.freeze({
      fetchDelta: function (request) {
        return new Promise(function (resolve, reject) {
          try {
            runner.withSuccessHandler(resolve).withFailureHandler(function (error) {
              reject(fail('LOCAL_FIRST_DELTA_REMOTE_CALL_FAILED', boundedReason(error, 'REMOTE_CALL_FAILED')));
            }).prhLocalFirstDelta(request);
          } catch (error) {
            reject(fail('LOCAL_FIRST_DELTA_REMOTE_CALL_FAILED', boundedReason(error, 'REMOTE_CALL_FAILED')));
          }
        });
      }
    });
  }

  function createDeltaCoordinator(options) {
    options = options || {};
    var store = options.store;
    var transport = options.transport;
    var fullSyncCoordinator = options.fullSyncCoordinator;
    var chunkSize = options.chunkSize == null ? DEFAULT_CHUNK_SIZE : Number(options.chunkSize);
    if (!store || typeof store.status !== 'function' || typeof store.getActiveSnapshot !== 'function' ||
        typeof store.beginGeneration !== 'function' || typeof store.writeGenerationChunk !== 'function' ||
        typeof store.finalizeGeneration !== 'function' || typeof store.abortGeneration !== 'function') {
      throw fail('LOCAL_FIRST_DELTA_STORE_INVALID');
    }
    if (!transport || typeof transport.fetchDelta !== 'function') throw fail('LOCAL_FIRST_DELTA_TRANSPORT_INVALID');
    if (!fullSyncCoordinator || typeof fullSyncCoordinator.sync !== 'function') throw fail('LOCAL_FIRST_DELTA_FULL_SYNC_COORDINATOR_INVALID');
    if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 5000) throw fail('LOCAL_FIRST_DELTA_CHUNK_SIZE_INVALID');
    var inFlight = null;

    async function fallbackFull(reason, started) {
      var result = await fullSyncCoordinator.sync();
      return Object.freeze({
        status: result && (result.status === 'UPDATED' || result.status === 'NOOP') ? 'FULL_REBUILT' : (result && result.status) || 'FAILED',
        reason: reason,
        fallback: result || null,
        active: result && result.active ? result.active : null,
        duration_ms: Math.max(0, Date.now() - started)
      });
    }

    async function rebuildInvalidLocalInventory(reason, started) {
      if (typeof store.wipe !== 'function' || typeof store.open !== 'function') {
        return Object.freeze({
          status: 'FAILED',
          reason: 'LOCAL_FIRST_DELTA_LOCAL_REBUILD_UNAVAILABLE',
          trigger_reason: reason,
          active: null,
          duration_ms: Math.max(0, Date.now() - started)
        });
      }
      try {
        await store.wipe();
        var opened = await store.open();
        if (!opened || opened.status !== 'OPEN') throw fail('LOCAL_FIRST_DELTA_LOCAL_REBUILD_OPEN_FAILED');
      } catch (error) {
        return Object.freeze({
          status: 'FAILED',
          reason: boundedReason(error, 'LOCAL_FIRST_DELTA_LOCAL_REBUILD_FAILED'),
          trigger_reason: reason,
          active: null,
          duration_ms: Math.max(0, Date.now() - started)
        });
      }

      var rebuilt = await fallbackFull(reason, started);
      if (rebuilt.status !== 'FULL_REBUILT') return rebuilt;

      var verified = await store.getActiveSnapshot({ includeJournal: true });
      try {
        await buildInventory(verified);
      } catch (error) {
        try {
          await store.wipe();
          await store.open();
        } catch (cleanupError) { void cleanupError; }
        return Object.freeze({
          status: 'FAILED',
          reason: boundedReason(error, 'LOCAL_FIRST_DELTA_REBUILT_INVENTORY_INVALID'),
          trigger_reason: reason,
          active: null,
          duration_ms: Math.max(0, Date.now() - started)
        });
      }
      return rebuilt;
    }

    function applyMap(baseRows, upserts, deletes, keyField) {
      var map = new Map();
      baseRows.forEach(function (row) { map.set(String(row[keyField]), row); });
      deletes.forEach(function (key) { map.delete(String(key)); });
      upserts.forEach(function (row) { map.set(String(row[keyField]), row); });
      return Array.from(map.values()).sort(function (left, right) {
        var a = String(left[keyField]);
        var b = String(right[keyField]);
        return a < b ? -1 : (a > b ? 1 : 0);
      });
    }

    async function writeChunks(generationId, revision, storeName, records) {
      for (var offset = 0; offset < records.length; offset += chunkSize) {
        var input = { generationId: generationId, revision: revision, transactions: [], dimensions: [], aggregates: [], sync_journal: [] };
        input[storeName] = records.slice(offset, offset + chunkSize);
        await store.writeGenerationChunk(input);
      }
    }

    async function applyValidatedDelta(delta, baseSnapshot, started) {
      var beforeApply = await store.status();
      if (beforeApply.status === 'READY' && beforeApply.revision === delta.target_revision) {
        return Object.freeze({
          status: 'ALREADY_APPLIED',
          reason: null,
          active: Object.freeze({ generation_id: beforeApply.generation_id, revision: beforeApply.revision, counts: beforeApply.counts || null }),
          duration_ms: Math.max(0, Date.now() - started)
        });
      }
      if (beforeApply.status !== 'READY' || beforeApply.revision !== delta.base_revision ||
          baseSnapshot.revision !== delta.base_revision || beforeApply.generation_id !== baseSnapshot.generation_id) {
        return fallbackFull('LOCAL_FIRST_DELTA_BASE_REVISION_MISMATCH', started);
      }

      var transactions = applyMap(baseSnapshot.transactions, delta.transaction_upserts, delta.transaction_deletes, 'transaction_id');
      var dimensions = applyMap(baseSnapshot.dimensions, delta.dimension_upserts, delta.dimension_deletes, 'dimension_key');
      var aggregates = [];
      var actualRevision;
      try {
        actualRevision = await repositoryRevision(transactions);
      } catch (error) {
        return fallbackFull(boundedReason(error, 'LOCAL_FIRST_DELTA_TARGET_REVISION_COMPUTE_FAILED'), started);
      }
      if (actualRevision !== delta.target_revision) {
        return fallbackFull('LOCAL_FIRST_DELTA_TARGET_REVISION_MISMATCH', started);
      }

      var journal = [{
        sequence: 1,
        event: 'DELTA_APPLY',
        delta_id: delta.delta_id,
        base_revision: delta.base_revision,
        target_revision: delta.target_revision,
        transaction_upsert_count: delta.transaction_upserts.length,
        transaction_delete_count: delta.transaction_deletes.length,
        dimension_upsert_count: delta.dimension_upserts.length,
        dimension_delete_count: delta.dimension_deletes.length
      }];
      var actualCounts = { transactions: transactions.length, dimensions: dimensions.length, aggregates: 0, sync_journal: 1 };
      if (DATA_STORES.some(function (name) { return actualCounts[name] !== delta.expected_counts[name]; })) {
        return fallbackFull('LOCAL_FIRST_DELTA_TARGET_COUNT_MISMATCH', started);
      }

      var generationId = delta.target_generation_id;
      var began = false;
      try {
        try { await store.abortGeneration(generationId); } catch (cleanupError) {
          if (boundedReason(cleanupError) === 'ACTIVE_GENERATION_ABORT_FORBIDDEN') throw cleanupError;
        }
        await store.beginGeneration({ generationId: generationId, revision: delta.target_revision });
        began = true;
        await writeChunks(generationId, delta.target_revision, 'transactions', transactions);
        await writeChunks(generationId, delta.target_revision, 'dimensions', dimensions);
        await writeChunks(generationId, delta.target_revision, 'aggregates', aggregates);
        await writeChunks(generationId, delta.target_revision, 'sync_journal', journal);
        var finalized = await store.finalizeGeneration({
          generationId: generationId,
          revision: delta.target_revision,
          expectedCounts: actualCounts
        });
        if (!finalized || finalized.status !== 'ACTIVE') throw fail('LOCAL_FIRST_DELTA_FINALIZE_INVALID');
        var after = await store.status();
        if (!after || after.status !== 'READY' || after.revision !== delta.target_revision || after.generation_id !== generationId) {
          throw fail('LOCAL_FIRST_DELTA_ACTIVE_VERIFY_FAILED');
        }
        return Object.freeze({
          status: 'UPDATED_DELTA',
          reason: null,
          delta_id: delta.delta_id,
          base_revision: delta.base_revision,
          target_revision: delta.target_revision,
          active: Object.freeze({ generation_id: after.generation_id, revision: after.revision, counts: after.counts || null }),
          duration_ms: Math.max(0, Date.now() - started)
        });
      } catch (error) {
        if (began) {
          try { await store.abortGeneration(generationId); } catch (abortError) { void abortError; }
        }
        var preserved = await store.status();
        return Object.freeze({
          status: preserved && preserved.status === 'READY' ? 'DEGRADED' : 'FAILED',
          reason: boundedReason(error, 'LOCAL_FIRST_DELTA_APPLY_FAILED'),
          active: preserved && preserved.status === 'READY'
            ? Object.freeze({ generation_id: preserved.generation_id, revision: preserved.revision, counts: preserved.counts || null })
            : null,
          duration_ms: Math.max(0, Date.now() - started)
        });
      }
    }

    async function executeDeltaSync() {
      var started = Date.now();
      var baseSnapshot = await store.getActiveSnapshot({ includeJournal: true });
      if (!baseSnapshot || baseSnapshot.status !== 'READY') return fallbackFull('LOCAL_FIRST_DELTA_NO_VERIFIED_BASE', started);
      var requestContext;
      try {
        requestContext = await buildInventory(baseSnapshot);
      } catch (error) {
        return rebuildInvalidLocalInventory(boundedReason(error, 'LOCAL_FIRST_DELTA_INVENTORY_FAILED'), started);
      }
      var rawRemote;
      try {
        rawRemote = await transport.fetchDelta(requestContext);
      } catch (error) {
        return Object.freeze({
          status: 'DEGRADED',
          reason: boundedReason(error, 'LOCAL_FIRST_DELTA_REMOTE_UNAVAILABLE'),
          active: Object.freeze({ generation_id: baseSnapshot.generation_id, revision: baseSnapshot.revision, counts: baseSnapshot.counts || null }),
          duration_ms: Math.max(0, Date.now() - started)
        });
      }
      var remote;
      try {
        remote = await validateRemoteEnvelope(rawRemote, requestContext);
      } catch (error) {
        return fallbackFull(boundedReason(error, 'LOCAL_FIRST_DELTA_RESPONSE_INVALID'), started);
      }
      var current = await store.status();
      if (current.status === 'READY' && current.revision === remote.target_revision) {
        return Object.freeze({
          status: remote.state === 'NOOP' ? 'NOOP' : 'ALREADY_APPLIED',
          reason: null,
          active: Object.freeze({ generation_id: current.generation_id, revision: current.revision, counts: current.counts || null }),
          duration_ms: Math.max(0, Date.now() - started)
        });
      }
      if (remote.state === 'NOOP') {
        if (current.status !== 'READY' || current.revision !== remote.base_revision) {
          return fallbackFull('LOCAL_FIRST_DELTA_NOOP_BASE_MISMATCH', started);
        }
        return Object.freeze({
          status: 'NOOP', reason: null,
          active: Object.freeze({ generation_id: current.generation_id, revision: current.revision, counts: current.counts || null }),
          duration_ms: Math.max(0, Date.now() - started)
        });
      }
      if (remote.state === 'FULL_REBUILD_REQUIRED') {
        return fallbackFull(remote.reason_code || 'LOCAL_FIRST_DELTA_FULL_REBUILD_REQUIRED', started);
      }
      return applyValidatedDelta(remote, baseSnapshot, started);
    }

    function sync() {
      if (inFlight) return inFlight;
      inFlight = Promise.resolve().then(executeDeltaSync).finally(function () { inFlight = null; });
      return inFlight;
    }

    return Object.freeze({
      sync: sync,
      startBackgroundSync: function (onResult) {
        return Promise.resolve().then(sync).then(function (result) {
          if (typeof onResult === 'function') onResult(result);
          return result;
        });
      },
      isSyncing: function () { return !!inFlight; }
    });
  }

  return Object.freeze({
    schema: SCHEMA,
    version: VERSION,
    responseSchema: RESPONSE_SCHEMA,
    revisionRow: revisionRow,
    sha256Hex: sha256Hex,
    repositoryRevision: repositoryRevision,
    transactionEtag: transactionEtag,
    dimensionEtag: dimensionEtag,
    buildInventory: buildInventory,
    validateRemoteEnvelope: validateRemoteEnvelope,
    createGoogleScriptDeltaTransport: createGoogleScriptDeltaTransport,
    createDeltaCoordinator: createDeltaCoordinator
  });
});
