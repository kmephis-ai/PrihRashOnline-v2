/**
 * DELTA-LF-001 read-only revision-bound delta adapter.
 *
 * This service computes an owner-private delta against inventory supplied from
 * the browser's ACTIVE + VERIFIED Local Read Model. Canonical source/revision
 * authority remains prhR2DataCreateSnapshot_(); no canonical write exists here.
 */
var PRH_LOCAL_FIRST_DELTA = Object.freeze({
  SCHEMA: 'PRH_LOCAL_FIRST_DELTA_V1',
  VERSION: '1.0.0',
  RESPONSE_SCHEMA: 'PRH_LOCAL_FIRST_DELTA_RESPONSE_V1',
  SOURCE_AUTHORITY: 'GOOGLE_CANONICAL_READ_ONLY',
  MAX_TRANSACTIONS: 50000,
  MAX_DIMENSIONS: 20000,
  MAX_DELTA_OPERATIONS: 10000,
  FULL_REBUILD_RATIO_THRESHOLD: 0.75,
  WRITE_AUTHORITY: false,
  FREE_ONLY: true
});

function prhLocalFirstDeltaFail_(reason) {
  var error = new Error(reason);
  error.code = reason;
  throw error;
}

function prhLocalFirstDeltaHex64_(value, reason) {
  var text = String(value || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(text)) prhLocalFirstDeltaFail_(reason);
  return text;
}

function prhLocalFirstDeltaRevisionRow_(tx) {
  if (!tx || tx.schema !== 'PRH_CANONICAL_TRANSACTION_V1' || tx.schema_version !== 1 || !tx.transaction_id) {
    prhLocalFirstDeltaFail_('LOCAL_FIRST_DELTA_TRANSACTION_INVALID');
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

function prhLocalFirstDeltaTransactionEtag_(tx) {
  return prhR2FinSha256Hex_(JSON.stringify(prhLocalFirstDeltaRevisionRow_(tx)));
}

function prhLocalFirstDeltaDimensionEtag_(row) {
  if (!row || !row.dimension_key || !row.kind || !row.dimension_id || !row.label) {
    prhLocalFirstDeltaFail_('LOCAL_FIRST_DELTA_DIMENSION_INVALID');
  }
  return prhR2FinSha256Hex_(JSON.stringify({
    dimension_key: String(row.dimension_key),
    kind: String(row.kind),
    dimension_id: String(row.dimension_id),
    label: String(row.label)
  }));
}

function prhLocalFirstDeltaNormalizeInventoryList_(value, max, reason) {
  if (!Array.isArray(value) || value.length > max) prhLocalFirstDeltaFail_(reason);
  var seen = {};
  var normalized = value.map(function(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        Object.keys(item).some(function(key) { return key !== 'key' && key !== 'etag'; })) {
      prhLocalFirstDeltaFail_(reason);
    }
    var key = String(item.key || '').trim();
    if (!key || key.length > 256 || seen[key]) prhLocalFirstDeltaFail_(reason);
    seen[key] = true;
    return Object.freeze({
      key: key,
      etag: prhLocalFirstDeltaHex64_(item.etag, reason)
    });
  });
  normalized.sort(function(left, right) {
    return left.key < right.key ? -1 : (left.key > right.key ? 1 : 0);
  });
  return Object.freeze(normalized);
}

function prhLocalFirstDeltaInventoryDigest_(transactions, dimensions) {
  return prhR2FinSha256Hex_(JSON.stringify({
    transactions: transactions,
    dimensions: dimensions
  }));
}

function prhLocalFirstDeltaNormalizeRequest_(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request) ||
      Object.keys(request).some(function(key) { return key !== 'base_revision' && key !== 'inventory'; })) {
    prhLocalFirstDeltaFail_('LOCAL_FIRST_DELTA_REQUEST_INVALID');
  }
  var baseRevision = prhLocalFirstDeltaHex64_(request.base_revision, 'LOCAL_FIRST_DELTA_BASE_REVISION_INVALID');
  var inventory = request.inventory;
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory) ||
      Object.keys(inventory).some(function(key) { return ['transactions', 'dimensions', 'digest'].indexOf(key) < 0; })) {
    prhLocalFirstDeltaFail_('LOCAL_FIRST_DELTA_INVENTORY_INVALID');
  }
  var transactions = prhLocalFirstDeltaNormalizeInventoryList_(
    inventory.transactions,
    PRH_LOCAL_FIRST_DELTA.MAX_TRANSACTIONS,
    'LOCAL_FIRST_DELTA_TRANSACTION_INVENTORY_INVALID'
  );
  var dimensions = prhLocalFirstDeltaNormalizeInventoryList_(
    inventory.dimensions,
    PRH_LOCAL_FIRST_DELTA.MAX_DIMENSIONS,
    'LOCAL_FIRST_DELTA_DIMENSION_INVENTORY_INVALID'
  );
  var digest = prhLocalFirstDeltaHex64_(inventory.digest, 'LOCAL_FIRST_DELTA_INVENTORY_DIGEST_INVALID');
  var actualDigest = prhLocalFirstDeltaInventoryDigest_(transactions, dimensions);
  if (digest !== actualDigest) prhLocalFirstDeltaFail_('LOCAL_FIRST_DELTA_INVENTORY_DIGEST_MISMATCH');
  return Object.freeze({
    base_revision: baseRevision,
    inventory: Object.freeze({ transactions: transactions, dimensions: dimensions, digest: digest })
  });
}

function prhLocalFirstDeltaCurrentInventory_(snapshot) {
  var transactions = snapshot.transactions.map(function(tx) {
    return Object.freeze({ key: String(tx.transaction_id), etag: prhLocalFirstDeltaTransactionEtag_(tx), record: tx });
  }).sort(function(left, right) { return left.key < right.key ? -1 : (left.key > right.key ? 1 : 0); });
  var dimensions = prhLocalFirstSyncDimensionRecords_(snapshot).map(function(row) {
    return Object.freeze({ key: String(row.dimension_key), etag: prhLocalFirstDeltaDimensionEtag_(row), record: row });
  }).sort(function(left, right) { return left.key < right.key ? -1 : (left.key > right.key ? 1 : 0); });
  if (transactions.length > PRH_LOCAL_FIRST_DELTA.MAX_TRANSACTIONS || dimensions.length > PRH_LOCAL_FIRST_DELTA.MAX_DIMENSIONS) {
    prhLocalFirstDeltaFail_('LOCAL_FIRST_DELTA_CURRENT_INVENTORY_LIMIT_EXCEEDED');
  }
  return Object.freeze({ transactions: Object.freeze(transactions), dimensions: Object.freeze(dimensions) });
}

function prhLocalFirstDeltaDiff_(baseRows, currentRows) {
  var baseByKey = {};
  var currentByKey = {};
  baseRows.forEach(function(row) { baseByKey[row.key] = row; });
  currentRows.forEach(function(row) { currentByKey[row.key] = row; });
  var upserts = currentRows.filter(function(row) {
    return !baseByKey[row.key] || baseByKey[row.key].etag !== row.etag;
  }).map(function(row) { return row.record; });
  var deletes = baseRows.filter(function(row) {
    return !currentByKey[row.key];
  }).map(function(row) { return row.key; });
  return Object.freeze({ upserts: Object.freeze(upserts), deletes: Object.freeze(deletes) });
}

function prhLocalFirstDeltaRebuildResponse_(baseRevision, targetRevision, inventoryDigest, reason, started) {
  return Object.freeze({
    schema: PRH_LOCAL_FIRST_DELTA.RESPONSE_SCHEMA,
    version: PRH_LOCAL_FIRST_DELTA.VERSION,
    state: 'FULL_REBUILD_REQUIRED',
    base_revision: baseRevision,
    target_revision: targetRevision,
    target_generation_id: targetRevision,
    base_inventory_digest: inventoryDigest,
    reason_code: reason,
    financial_write_authorized: false,
    canonical_mutation_performed: false,
    telemetry: Object.freeze({
      base_revision_prefix: baseRevision.slice(0, 12),
      target_revision_prefix: targetRevision.slice(0, 12),
      status: 'FULL_REBUILD_REQUIRED',
      reason: reason,
      duration_ms: Math.max(0, Date.now() - started),
      financial_payload_in_telemetry: false
    })
  });
}

function prhLocalFirstDelta(request) {
  var started = Date.now();
  var normalized = prhLocalFirstDeltaNormalizeRequest_(request);
  var snapshot = prhLocalFirstSyncAssertSnapshot_(prhR2DataCreateSnapshot_());
  var baseRevision = normalized.base_revision;
  var targetRevision = String(snapshot.revision).toLowerCase();

  if (baseRevision === targetRevision) {
    return Object.freeze({
      schema: PRH_LOCAL_FIRST_DELTA.RESPONSE_SCHEMA,
      version: PRH_LOCAL_FIRST_DELTA.VERSION,
      state: 'NOOP',
      base_revision: baseRevision,
      target_revision: targetRevision,
      target_generation_id: targetRevision,
      base_inventory_digest: normalized.inventory.digest,
      financial_write_authorized: false,
      canonical_mutation_performed: false,
      telemetry: Object.freeze({
        base_revision_prefix: baseRevision.slice(0, 12),
        target_revision_prefix: targetRevision.slice(0, 12),
        status: 'NOOP',
        upsert_count: 0,
        delete_count: 0,
        duration_ms: Math.max(0, Date.now() - started),
        financial_payload_in_telemetry: false
      })
    });
  }

  var current = prhLocalFirstDeltaCurrentInventory_(snapshot);
  var txDelta = prhLocalFirstDeltaDiff_(normalized.inventory.transactions, current.transactions);
  var dimDelta = prhLocalFirstDeltaDiff_(normalized.inventory.dimensions, current.dimensions);
  var operationCount = txDelta.upserts.length + txDelta.deletes.length + dimDelta.upserts.length + dimDelta.deletes.length;
  var baselineCount = Math.max(
    1,
    normalized.inventory.transactions.length + normalized.inventory.dimensions.length,
    current.transactions.length + current.dimensions.length
  );
  var ratio = operationCount / baselineCount;
  if (operationCount > PRH_LOCAL_FIRST_DELTA.MAX_DELTA_OPERATIONS || ratio > PRH_LOCAL_FIRST_DELTA.FULL_REBUILD_RATIO_THRESHOLD) {
    return prhLocalFirstDeltaRebuildResponse_(
      baseRevision,
      targetRevision,
      normalized.inventory.digest,
      operationCount > PRH_LOCAL_FIRST_DELTA.MAX_DELTA_OPERATIONS ? 'DELTA_OPERATION_LIMIT_EXCEEDED' : 'DELTA_RATIO_THRESHOLD_EXCEEDED',
      started
    );
  }

  var deltaId = prhR2FinSha256Hex_('PRH_LOCAL_FIRST_DELTA_V1|' + baseRevision + '|' + targetRevision + '|' + normalized.inventory.digest);
  return Object.freeze({
    schema: PRH_LOCAL_FIRST_DELTA.RESPONSE_SCHEMA,
    version: PRH_LOCAL_FIRST_DELTA.VERSION,
    state: 'DELTA',
    delta_id: deltaId,
    base_revision: baseRevision,
    target_revision: targetRevision,
    target_generation_id: targetRevision,
    base_inventory_digest: normalized.inventory.digest,
    transaction_upserts: Object.freeze(txDelta.upserts.map(prhLocalFirstSyncProjectTransaction_)),
    transaction_deletes: txDelta.deletes,
    dimension_upserts: dimDelta.upserts,
    dimension_deletes: dimDelta.deletes,
    expected_counts: Object.freeze({
      transactions: current.transactions.length,
      dimensions: current.dimensions.length,
      aggregates: 0,
      sync_journal: 1
    }),
    financial_write_authorized: false,
    canonical_mutation_performed: false,
    telemetry: Object.freeze({
      base_revision_prefix: baseRevision.slice(0, 12),
      target_revision_prefix: targetRevision.slice(0, 12),
      upsert_count: txDelta.upserts.length + dimDelta.upserts.length,
      delete_count: txDelta.deletes.length + dimDelta.deletes.length,
      status: 'DELTA',
      duration_ms: Math.max(0, Date.now() - started),
      financial_payload_in_telemetry: false
    })
  });
}
