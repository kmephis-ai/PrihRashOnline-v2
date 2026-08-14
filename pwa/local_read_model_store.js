(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PrhLocalReadModelStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SCHEMA = 'PRH_LOCAL_READ_MODEL_V1';
  var VERSION = '1.0.0';
  var DB_NAME = 'prihrash-local-read-model';
  var DB_VERSION = 1;
  var META = 'meta';
  var DATA_STORES = ['transactions', 'dimensions', 'aggregates', 'sync_journal'];
  var ALL_STORES = [META].concat(DATA_STORES);
  var ACTIVE_KEY = 'active_generation';
  var SCHEMA_KEY = 'schema_version';
  var MANIFEST_PREFIX = 'generation:';
  var HEX64 = /^[0-9a-f]{64}$/;

  var STORE_DEFS = Object.freeze({
    meta: Object.freeze({ keyPath: 'key' }),
    transactions: Object.freeze({ keyPath: ['generation_id', 'transaction_id'], recordKey: 'transaction_id' }),
    dimensions: Object.freeze({ keyPath: ['generation_id', 'dimension_key'], recordKey: 'dimension_key' }),
    aggregates: Object.freeze({ keyPath: ['generation_id', 'aggregate_key'], recordKey: 'aggregate_key' }),
    sync_journal: Object.freeze({ keyPath: ['generation_id', 'sequence'], recordKey: 'sequence' })
  });

  function fail(code, message) {
    var error = new Error(message || code);
    error.code = code;
    return error;
  }

  function requestPromise(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || fail('INDEXEDDB_REQUEST_FAILED')); };
    });
  }

  function transactionPromise(transaction) {
    return new Promise(function (resolve, reject) {
      transaction.oncomplete = function () { resolve(); };
      transaction.onerror = function () { reject(transaction.error || fail('INDEXEDDB_TRANSACTION_FAILED')); };
      transaction.onabort = function () { reject(transaction.error || fail('INDEXEDDB_TRANSACTION_ABORTED')); };
    });
  }

  async function abortTransaction(transaction, done, error) {
    try { transaction.abort(); } catch (abortError) { void abortError; }
    try { await done; } catch (transactionError) { void transactionError; }
    throw error;
  }

  function deleteDatabasePromise(indexedDB, name) {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.deleteDatabase(name);
      request.onsuccess = function () { resolve(); };
      request.onerror = function () { reject(request.error || fail('LOCAL_DB_DELETE_FAILED')); };
      request.onblocked = function () { reject(fail('LOCAL_DB_DELETE_BLOCKED')); };
    });
  }

  function validateHex64(value, code) {
    var normalized = String(value || '').toLowerCase();
    if (!HEX64.test(normalized)) throw fail(code || 'INVALID_SHA256_HEX_64');
    return normalized;
  }

  function validateRecordKey(storeName, record) {
    var field = STORE_DEFS[storeName].recordKey;
    if (!record || record[field] === undefined || record[field] === null || String(record[field]).length === 0) {
      throw fail('LOCAL_RECORD_KEY_REQUIRED', storeName + ':' + field);
    }
  }

  function sameKeyPath(actual, expected) {
    if (Array.isArray(expected)) return JSON.stringify(Array.from(actual || [])) === JSON.stringify(expected);
    return actual === expected;
  }

  function createSchema(db) {
    db.createObjectStore(META, { keyPath: 'key' });
    DATA_STORES.forEach(function (name) {
      var definition = STORE_DEFS[name];
      var store = db.createObjectStore(name, { keyPath: definition.keyPath });
      store.createIndex('generation_id', 'generation_id', { unique: false });
    });
  }

  function openDatabase(indexedDB, name) {
    return new Promise(function (resolve, reject) {
      var request;
      try {
        request = indexedDB.open(name, DB_VERSION);
      } catch (error) {
        reject(error);
        return;
      }
      request.onupgradeneeded = function (event) {
        var db = request.result;
        if (event.oldVersion !== 0) {
          request.transaction.abort();
          return;
        }
        createSchema(db);
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || fail('LOCAL_DB_OPEN_FAILED')); };
      request.onblocked = function () { reject(fail('LOCAL_DB_OPEN_BLOCKED')); };
    });
  }

  async function validateSchema(db) {
    var existing = Array.from(db.objectStoreNames).sort();
    var expected = ALL_STORES.slice().sort();
    if (JSON.stringify(existing) !== JSON.stringify(expected)) throw fail('LOCAL_SCHEMA_INCOMPATIBLE');
    var tx = db.transaction(ALL_STORES, 'readonly');
    var done = transactionPromise(tx);
    try {
      ALL_STORES.forEach(function (name) {
        var store = tx.objectStore(name);
        if (!sameKeyPath(store.keyPath, STORE_DEFS[name].keyPath)) throw fail('LOCAL_SCHEMA_INCOMPATIBLE');
        if (name !== META && !store.indexNames.contains('generation_id')) throw fail('LOCAL_SCHEMA_INCOMPATIBLE');
      });
    } catch (error) {
      return abortTransaction(tx, done, error);
    }
    await done;
  }

  async function ensureSchemaMeta(db) {
    var tx = db.transaction([META], 'readwrite');
    var done = transactionPromise(tx);
    var store = tx.objectStore(META);
    var existing = await requestPromise(store.get(SCHEMA_KEY));
    if (!existing) {
      store.put({ key: SCHEMA_KEY, schema: SCHEMA, version: VERSION, db_version: DB_VERSION });
    } else if (existing.schema !== SCHEMA || existing.version !== VERSION || existing.db_version !== DB_VERSION) {
      return abortTransaction(tx, done, fail('LOCAL_SCHEMA_INCOMPATIBLE'));
    }
    await done;
  }

  function createStore(options) {
    options = options || {};
    var indexedDB = options.indexedDB || (typeof globalThis !== 'undefined' ? globalThis.indexedDB : null);
    var IDBKeyRangeCtor = options.IDBKeyRange || (typeof globalThis !== 'undefined' ? globalThis.IDBKeyRange : null);
    var databaseName = options.name || DB_NAME;
    var state = { db: null, rebuildRequired: false, rebuildReason: null };

    if (!indexedDB) throw fail('INDEXEDDB_UNAVAILABLE');
    if (!IDBKeyRangeCtor) throw fail('IDBKEYRANGE_UNAVAILABLE');

    function manifestKey(generationId) { return MANIFEST_PREFIX + generationId; }

    async function open() {
      if (state.db && !state.rebuildRequired) return { status: 'OPEN', schema: SCHEMA, version: VERSION };
      var db = null;
      try {
        db = await openDatabase(indexedDB, databaseName);
        db.onversionchange = function () { db.close(); if (state.db === db) state.db = null; };
        await validateSchema(db);
        await ensureSchemaMeta(db);
        state.db = db;
        state.rebuildRequired = false;
        state.rebuildReason = null;
        return { status: 'OPEN', schema: SCHEMA, version: VERSION };
      } catch (error) {
        if (db) db.close();
        if (state.db) state.db.close();
        state.db = null;
        state.rebuildRequired = true;
        state.rebuildReason = error && error.name === 'VersionError' ? 'LOCAL_SCHEMA_INCOMPATIBLE' : (error.code || 'LOCAL_DB_OPEN_FAILED');
        return { status: 'REBUILD_REQUIRED', reason: state.rebuildReason };
      }
    }

    async function requireDb() {
      if (state.rebuildRequired) throw fail('REBUILD_REQUIRED', state.rebuildReason);
      if (!state.db) {
        var result = await open();
        if (result.status !== 'OPEN') throw fail('REBUILD_REQUIRED', result.reason);
      }
      return state.db;
    }

    async function beginGeneration(input) {
      input = input || {};
      var generationId = validateHex64(input.generationId, 'INVALID_GENERATION_ID');
      var revision = validateHex64(input.revision, 'INVALID_CANONICAL_REVISION');
      var db = await requireDb();
      var tx = db.transaction([META], 'readwrite');
      var done = transactionPromise(tx);
      var meta = tx.objectStore(META);
      var existing = await requestPromise(meta.get(manifestKey(generationId)));
      if (existing && existing.status === 'VERIFIED') {
        return abortTransaction(tx, done, fail('GENERATION_ALREADY_VERIFIED'));
      }
      meta.put({
        key: manifestKey(generationId),
        generation_id: generationId,
        revision: revision,
        status: 'STAGING',
        staged_chunks: 0
      });
      await done;
      return { status: 'STAGING', generation_id: generationId, revision: revision };
    }

    async function writeGenerationChunk(input) {
      input = input || {};
      var generationId = validateHex64(input.generationId, 'INVALID_GENERATION_ID');
      var revision = validateHex64(input.revision, 'INVALID_CANONICAL_REVISION');
      var records = {
        transactions: Array.isArray(input.transactions) ? input.transactions : [],
        dimensions: Array.isArray(input.dimensions) ? input.dimensions : [],
        aggregates: Array.isArray(input.aggregates) ? input.aggregates : [],
        sync_journal: Array.isArray(input.sync_journal) ? input.sync_journal : []
      };
      var db = await requireDb();
      var tx = db.transaction(ALL_STORES, 'readwrite');
      var done = transactionPromise(tx);
      var meta = tx.objectStore(META);
      var manifest = await requestPromise(meta.get(manifestKey(generationId)));
      if (!manifest || manifest.status !== 'STAGING' || manifest.revision !== revision) {
        return abortTransaction(tx, done, fail('STAGING_GENERATION_MISMATCH'));
      }
      try {
        DATA_STORES.forEach(function (storeName) {
          records[storeName].forEach(function (record) {
            validateRecordKey(storeName, record);
            var stored = Object.assign({}, record, { generation_id: generationId });
            tx.objectStore(storeName).put(stored);
          });
        });
      } catch (error) {
        return abortTransaction(tx, done, error);
      }
      manifest.staged_chunks = Number(manifest.staged_chunks || 0) + 1;
      meta.put(manifest);
      await done;
      return {
        status: 'STAGING',
        generation_id: generationId,
        chunk_counts: {
          transactions: records.transactions.length,
          dimensions: records.dimensions.length,
          aggregates: records.aggregates.length,
          sync_journal: records.sync_journal.length
        }
      };
    }

    async function countGeneration(tx, storeName, generationId) {
      return requestPromise(tx.objectStore(storeName).index('generation_id').count(IDBKeyRangeCtor.only(generationId)));
    }

    function normalizeExpectedCounts(input) {
      var result = {};
      DATA_STORES.forEach(function (name) {
        if (!input || !Number.isInteger(input[name]) || input[name] < 0) throw fail('EXPECTED_GENERATION_COUNTS_REQUIRED');
        result[name] = input[name];
      });
      return result;
    }

    async function finalizeGeneration(input) {
      input = input || {};
      var generationId = validateHex64(input.generationId, 'INVALID_GENERATION_ID');
      var revision = validateHex64(input.revision, 'INVALID_CANONICAL_REVISION');
      var expectedCounts = normalizeExpectedCounts(input.expectedCounts);
      var db = await requireDb();
      var tx = db.transaction(ALL_STORES, 'readwrite');
      var done = transactionPromise(tx);
      var meta = tx.objectStore(META);
      var manifest = await requestPromise(meta.get(manifestKey(generationId)));
      if (!manifest || manifest.status !== 'STAGING' || manifest.revision !== revision) {
        return abortTransaction(tx, done, fail('STAGING_GENERATION_MISMATCH'));
      }
      var actualCounts = {};
      for (var i = 0; i < DATA_STORES.length; i += 1) {
        var storeName = DATA_STORES[i];
        actualCounts[storeName] = await countGeneration(tx, storeName, generationId);
        if (actualCounts[storeName] !== expectedCounts[storeName]) {
          return abortTransaction(tx, done, fail('GENERATION_COUNT_MISMATCH', storeName));
        }
      }
      manifest.status = 'VERIFIED';
      manifest.counts = actualCounts;
      meta.put(manifest);
      meta.put({
        key: ACTIVE_KEY,
        generation_id: generationId,
        revision: revision,
        status: 'ACTIVE'
      });
      await done;
      return { status: 'ACTIVE', generation_id: generationId, revision: revision, counts: actualCounts };
    }

    function deleteGenerationRecords(tx, storeName, generationId) {
      return new Promise(function (resolve, reject) {
        var request = tx.objectStore(storeName).index('generation_id').openCursor(IDBKeyRangeCtor.only(generationId));
        request.onerror = function () { reject(request.error || fail('GENERATION_DELETE_FAILED')); };
        request.onsuccess = function () {
          var cursor = request.result;
          if (!cursor) { resolve(); return; }
          cursor.delete();
          cursor.continue();
        };
      });
    }

    async function abortGeneration(generationIdInput) {
      var generationId = validateHex64(generationIdInput, 'INVALID_GENERATION_ID');
      var db = await requireDb();
      var tx = db.transaction(ALL_STORES, 'readwrite');
      var done = transactionPromise(tx);
      var meta = tx.objectStore(META);
      var active = await requestPromise(meta.get(ACTIVE_KEY));
      if (active && active.generation_id === generationId) {
        return abortTransaction(tx, done, fail('ACTIVE_GENERATION_ABORT_FORBIDDEN'));
      }
      for (var i = 0; i < DATA_STORES.length; i += 1) {
        await deleteGenerationRecords(tx, DATA_STORES[i], generationId);
      }
      meta.delete(manifestKey(generationId));
      await done;
      return { status: 'ABORTED', generation_id: generationId };
    }

    async function readGenerationStore(tx, storeName, generationId) {
      return requestPromise(tx.objectStore(storeName).index('generation_id').getAll(IDBKeyRangeCtor.only(generationId)));
    }

    async function getActiveSnapshot(options) {
      options = options || {};
      if (state.rebuildRequired) return { status: 'REBUILD_REQUIRED', reason: state.rebuildReason };
      var db;
      try {
        db = await requireDb();
      } catch (error) {
        return { status: 'REBUILD_REQUIRED', reason: error.code || 'LOCAL_DB_OPEN_FAILED' };
      }
      var tx = db.transaction(ALL_STORES, 'readonly');
      var done = transactionPromise(tx);
      var meta = tx.objectStore(META);
      var active = await requestPromise(meta.get(ACTIVE_KEY));
      if (!active) {
        await done;
        return { status: 'EMPTY', schema: SCHEMA, version: VERSION };
      }
      var generationId;
      var revision;
      try {
        generationId = validateHex64(active.generation_id, 'ACTIVE_GENERATION_INVALID');
        revision = validateHex64(active.revision, 'ACTIVE_REVISION_INVALID');
      } catch (error) {
        await done;
        return { status: 'REBUILD_REQUIRED', reason: error.code };
      }
      var manifest = await requestPromise(meta.get(manifestKey(generationId)));
      if (!manifest || manifest.status !== 'VERIFIED' || manifest.revision !== revision || !manifest.counts) {
        await done;
        return { status: 'REBUILD_REQUIRED', reason: 'ACTIVE_MANIFEST_INVALID' };
      }
      var payload = {};
      for (var i = 0; i < DATA_STORES.length; i += 1) {
        var storeName = DATA_STORES[i];
        payload[storeName] = await readGenerationStore(tx, storeName, generationId);
        if (payload[storeName].length !== manifest.counts[storeName]) {
          await done;
          return { status: 'REBUILD_REQUIRED', reason: 'ACTIVE_COUNT_MISMATCH' };
        }
      }
      await done;
      if (!options.includeJournal) delete payload.sync_journal;
      return {
        status: 'READY',
        schema: SCHEMA,
        version: VERSION,
        generation_id: generationId,
        revision: revision,
        counts: Object.assign({}, manifest.counts),
        transactions: payload.transactions,
        dimensions: payload.dimensions,
        aggregates: payload.aggregates,
        sync_journal: payload.sync_journal
      };
    }

    async function status() {
      var snapshot = await getActiveSnapshot();
      if (snapshot.status !== 'READY') return snapshot;
      return {
        status: 'READY',
        schema: snapshot.schema,
        version: snapshot.version,
        generation_id: snapshot.generation_id,
        revision: snapshot.revision,
        counts: snapshot.counts
      };
    }

    async function wipe() {
      if (state.db) state.db.close();
      state.db = null;
      state.rebuildRequired = false;
      state.rebuildReason = null;
      await deleteDatabasePromise(indexedDB, databaseName);
      return { status: 'WIPED' };
    }

    async function rebuild() {
      await wipe();
      var opened = await open();
      if (opened.status !== 'OPEN') return opened;
      return getActiveSnapshot();
    }

    function close() {
      if (state.db) state.db.close();
      state.db = null;
    }

    return Object.freeze({
      open: open,
      beginGeneration: beginGeneration,
      writeGenerationChunk: writeGenerationChunk,
      finalizeGeneration: finalizeGeneration,
      abortGeneration: abortGeneration,
      getActiveSnapshot: getActiveSnapshot,
      status: status,
      wipe: wipe,
      rebuild: rebuild,
      close: close
    });
  }

  return Object.freeze({
    schema: SCHEMA,
    version: VERSION,
    databaseName: DB_NAME,
    databaseVersion: DB_VERSION,
    stores: Object.freeze(ALL_STORES.slice()),
    createStore: createStore
  });
});
