/**
 * SYNC-LF-001 read-only background bootstrap adapter for Local-first runtime.
 *
 * Authority boundary:
 * - canonical source remains Google/PRH_TRANSACTION_REPOSITORY_V1;
 * - canonicalization/revision are reused through prhR2DataCreateSnapshot_();
 * - this adapter never performs a canonical financial write;
 * - returned household payload is owner-private runtime data and must never be
 *   copied to GitHub evidence/logs;
 * - warm SPA interaction never calls this function as a prerequisite.
 */
var PRH_LOCAL_FIRST_SYNC = Object.freeze({
  SCHEMA: 'PRH_LOCAL_FIRST_SYNC_V1',
  VERSION: '1.0.0',
  RESPONSE_SCHEMA: 'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1',
  LOCAL_STORE_CONTRACT: 'PRH_LOCAL_READ_MODEL_V1@1.0.0',
  CANONICAL_TRANSACTION_CONTRACT: 'PRH_CANONICAL_TRANSACTION_V1@1',
  SOURCE_AUTHORITY: 'GOOGLE_CANONICAL_READ_ONLY',
  MAX_TRANSACTIONS: 50000,
  MAX_SERIALIZED_CHARS: 25000000,
  WRITE_AUTHORITY: false,
  FREE_ONLY: true
});

function prhLocalFirstSyncFail_(reason) {
  var error = new Error(reason);
  error.code = reason;
  throw error;
}

function prhLocalFirstSyncNormalizeRequest_(request) {
  var source = request == null ? {} : request;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    prhLocalFirstSyncFail_('LOCAL_FIRST_SYNC_REQUEST_INVALID');
  }
  Object.keys(source).forEach(function(key) {
    if (key !== 'local_revision') prhLocalFirstSyncFail_('LOCAL_FIRST_SYNC_REQUEST_FIELD_UNKNOWN');
  });
  var localRevision = String(source.local_revision || '').trim().toLowerCase();
  if (localRevision && !/^[0-9a-f]{64}$/.test(localRevision)) {
    prhLocalFirstSyncFail_('LOCAL_FIRST_SYNC_LOCAL_REVISION_INVALID');
  }
  return Object.freeze({ local_revision: localRevision });
}

/**
 * Apps Script transport does not preserve object properties whose value is
 * undefined. Canonical transactions, however, deliberately use an exact-key
 * contract in the browser/Worker boundary. Project the server object onto the
 * exact wire shape and materialize every nullable property as null so a
 * JSON/structured transport round-trip cannot silently change that shape.
 *
 * This is a transport projection only: it never changes canonical source
 * authority or the revision calculated from the source transaction.
 */
function prhLocalFirstSyncTransportRequired_(value) {
  if (value === undefined) {
    prhLocalFirstSyncFail_('LOCAL_FIRST_SYNC_CANONICAL_TRANSACTION_TRANSPORT_INVALID');
  }
  return value;
}

function prhLocalFirstSyncTransportNullable_(value) {
  return value === undefined ? null : value;
}

function prhLocalFirstSyncProjectProvenance_(provenance) {
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    prhLocalFirstSyncFail_('LOCAL_FIRST_SYNC_CANONICAL_TRANSACTION_TRANSPORT_INVALID');
  }
  return Object.freeze({
    source_system: prhLocalFirstSyncTransportRequired_(provenance.source_system),
    source_container: prhLocalFirstSyncTransportNullable_(provenance.source_container),
    source_record_id: prhLocalFirstSyncTransportRequired_(provenance.source_record_id),
    source_fingerprint: prhLocalFirstSyncTransportRequired_(provenance.source_fingerprint),
    identity_strategy: prhLocalFirstSyncTransportRequired_(provenance.identity_strategy),
    transform_version: prhLocalFirstSyncTransportRequired_(provenance.transform_version),
    source_position: prhLocalFirstSyncTransportNullable_(provenance.source_position)
  });
}

function prhLocalFirstSyncProjectTransaction_(tx) {
  if (!tx || typeof tx !== 'object' || Array.isArray(tx) || !Array.isArray(tx.tags)) {
    prhLocalFirstSyncFail_('LOCAL_FIRST_SYNC_CANONICAL_TRANSACTION_TRANSPORT_INVALID');
  }
  return Object.freeze({
    schema: prhLocalFirstSyncTransportRequired_(tx.schema),
    schema_version: prhLocalFirstSyncTransportRequired_(tx.schema_version),
    transaction_id: prhLocalFirstSyncTransportRequired_(tx.transaction_id),
    occurred_at: prhLocalFirstSyncTransportRequired_(tx.occurred_at),
    type: prhLocalFirstSyncTransportRequired_(tx.type),
    status: prhLocalFirstSyncTransportRequired_(tx.status),
    amount_minor: prhLocalFirstSyncTransportRequired_(tx.amount_minor),
    currency: prhLocalFirstSyncTransportRequired_(tx.currency),
    account_id: prhLocalFirstSyncTransportRequired_(tx.account_id),
    destination_account_id: prhLocalFirstSyncTransportNullable_(tx.destination_account_id),
    category_id: prhLocalFirstSyncTransportRequired_(tx.category_id),
    member_id: prhLocalFirstSyncTransportNullable_(tx.member_id),
    project_id: prhLocalFirstSyncTransportNullable_(tx.project_id),
    tags: Object.freeze(tx.tags.slice()),
    counterparty: prhLocalFirstSyncTransportNullable_(tx.counterparty),
    description: prhLocalFirstSyncTransportNullable_(tx.description),
    reverses_transaction_id: prhLocalFirstSyncTransportNullable_(tx.reverses_transaction_id),
    adjustment_semantics: prhLocalFirstSyncTransportNullable_(tx.adjustment_semantics),
    provenance: prhLocalFirstSyncProjectProvenance_(tx.provenance)
  });
}

function prhLocalFirstSyncDimensionRecords_(snapshot) {
  if (!snapshot || !snapshot.dimensions || typeof snapshot.dimensions.displayLabel !== 'function') {
    prhLocalFirstSyncFail_('LOCAL_FIRST_SYNC_DIMENSION_RESOLVER_INVALID');
  }
  var byKey = {};
  var records = [];

  function add(kind, id) {
    var dimensionId = String(id || '');
    if (!dimensionId) return;
    var key = kind + '|' + dimensionId;
    if (byKey[key]) return;
    var label = snapshot.dimensions.displayLabel(kind, dimensionId);
    if (!label) prhLocalFirstSyncFail_('LOCAL_FIRST_SYNC_DIMENSION_LABEL_MISSING');
    byKey[key] = true;
    records.push(Object.freeze({
      dimension_key: key,
      kind: kind,
      dimension_id: dimensionId,
      label: String(label)
    }));
  }

  snapshot.transactions.forEach(function(tx) {
    add('account', tx.account_id);
    add('account', tx.destination_account_id);
    add('category', tx.category_id);
    add('member', tx.member_id);
    add('project', tx.project_id);
  });

  records.sort(function(left, right) {
    return left.dimension_key < right.dimension_key ? -1 : (left.dimension_key > right.dimension_key ? 1 : 0);
  });
  return Object.freeze(records);
}

function prhLocalFirstSyncAssertSnapshot_(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.transactions) ||
      !/^[0-9a-f]{64}$/.test(String(snapshot.revision || ''))) {
    prhLocalFirstSyncFail_('LOCAL_FIRST_SYNC_CANONICAL_SNAPSHOT_INVALID');
  }
  if (snapshot.transactions.length > PRH_LOCAL_FIRST_SYNC.MAX_TRANSACTIONS) {
    prhLocalFirstSyncFail_('LOCAL_FIRST_SYNC_TRANSACTION_LIMIT_EXCEEDED');
  }
  snapshot.transactions.forEach(function(tx) {
    if (!tx || tx.schema !== 'PRH_CANONICAL_TRANSACTION_V1' || tx.schema_version !== 1 || !tx.transaction_id) {
      prhLocalFirstSyncFail_('LOCAL_FIRST_SYNC_CANONICAL_TRANSACTION_INVALID');
    }
  });
  return snapshot;
}

function prhLocalFirstSyncBootstrap(request) {
  var started = Date.now();
  var normalized = prhLocalFirstSyncNormalizeRequest_(request);
  var snapshot = prhLocalFirstSyncAssertSnapshot_(prhR2DataCreateSnapshot_());
  var revision = String(snapshot.revision).toLowerCase();

  if (normalized.local_revision && normalized.local_revision === revision) {
    return Object.freeze({
      schema: PRH_LOCAL_FIRST_SYNC.RESPONSE_SCHEMA,
      version: PRH_LOCAL_FIRST_SYNC.VERSION,
      state: 'NOOP',
      revision: revision,
      generation_id: revision,
      source_authority: PRH_LOCAL_FIRST_SYNC.SOURCE_AUTHORITY,
      financial_write_authorized: false,
      canonical_mutation_performed: false,
      telemetry: Object.freeze({
        revision_hash_prefix: revision.slice(0, 12),
        status: 'NOOP',
        duration_ms: Math.max(0, Date.now() - started),
        financial_payload_in_telemetry: false
      })
    });
  }

  var dimensions = prhLocalFirstSyncDimensionRecords_(snapshot);
  var transactions = snapshot.transactions.map(prhLocalFirstSyncProjectTransaction_);
  var aggregates = [];
  var journal = [Object.freeze({
    sequence: 1,
    event: 'FULL_BOOTSTRAP',
    revision: revision,
    transaction_count: transactions.length,
    dimension_count: dimensions.length
  })];
  var expectedCounts = Object.freeze({
    transactions: transactions.length,
    dimensions: dimensions.length,
    aggregates: aggregates.length,
    sync_journal: journal.length
  });
  var response = {
    schema: PRH_LOCAL_FIRST_SYNC.RESPONSE_SCHEMA,
    version: PRH_LOCAL_FIRST_SYNC.VERSION,
    state: 'FULL_BOOTSTRAP',
    revision: revision,
    generation_id: revision,
    source_authority: PRH_LOCAL_FIRST_SYNC.SOURCE_AUTHORITY,
    local_store_contract: PRH_LOCAL_FIRST_SYNC.LOCAL_STORE_CONTRACT,
    canonical_transaction_contract: PRH_LOCAL_FIRST_SYNC.CANONICAL_TRANSACTION_CONTRACT,
    transactions: transactions,
    dimensions: dimensions,
    aggregates: aggregates,
    sync_journal: journal,
    expected_counts: expectedCounts,
    financial_write_authorized: false,
    canonical_mutation_performed: false,
    telemetry: Object.freeze({
      revision_hash_prefix: revision.slice(0, 12),
      generation_hash_prefix: revision.slice(0, 12),
      transaction_count: transactions.length,
      dimension_count: dimensions.length,
      status: 'FULL_BOOTSTRAP',
      duration_ms: Math.max(0, Date.now() - started),
      financial_payload_in_telemetry: false
    })
  };
  var serializedChars = JSON.stringify(response).length;
  if (serializedChars > PRH_LOCAL_FIRST_SYNC.MAX_SERIALIZED_CHARS) {
    prhLocalFirstSyncFail_('LOCAL_FIRST_SYNC_SNAPSHOT_TOO_LARGE');
  }
  response.serialized_chars = serializedChars;
  return Object.freeze(response);
}
