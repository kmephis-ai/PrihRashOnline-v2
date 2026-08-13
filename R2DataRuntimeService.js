/**
 * DATA-REC-001 read-only private Transactions / Data Quality runtime bridge.
 *
 * The bridge owns no financial formulas and no write authority. It creates one
 * immutable canonical snapshot per server call through PERF-012 single-scan,
 * derives a revision from that validated snapshot, and lets Transactions and
 * Data Quality prove they are looking at the same source revision.
 */
var PRH_R2_DATA_RUNTIME = Object.freeze({
  SCHEMA: 'PRH_R2_DATA_RUNTIME_BRIDGE_V1',
  VERSION: '1.0.0',
  TRANSACTIONS_VIEW_SCHEMA: 'PRH_R2_PRIVATE_TRANSACTIONS_VIEW_V1',
  DATA_QUALITY_VIEW_SCHEMA: 'PRH_R2_PRIVATE_DATA_QUALITY_VIEW_V1',
  FINANCIAL_TRUTH_POLICY: 'FIN-TRUTH-v1',
  SNAPSHOT_MAX_AGE_MS: 120000,
  SNAPSHOT_MAX_OPERATIONS: 16,
  DEFAULT_PAGE_LIMIT: 20,
  MAX_PAGE_LIMIT: 50,
  WRITE_AUTHORITY: false,
  AUTO_REPAIR_AUTHORITY: false,
  PERSISTENT_IDENTITY_AUTHORITY: false,
  FREE_ONLY: true
});

function prhR2DataFail_(reason) {
  var error = new Error(reason);
  error.code = reason;
  throw error;
}

function prhR2DataRuntime_() {
  var runtime = prhR2CanonicalRuntime_();
  if (!runtime.transactionExplorer || !runtime.dataQuality || !runtime.singleScanRefresh ||
      !runtime.googleAdapter || !runtime.financialReconciliation) {
    prhR2DataFail_('R2_DATA_RUNTIME_MODULE_MISSING');
  }
  if (typeof runtime.transactionExplorer.exploreTransactions !== 'function' ||
      typeof runtime.dataQuality.scanRecords !== 'function' ||
      typeof runtime.singleScanRefresh.createSingleScanRefresh !== 'function') {
    prhR2DataFail_('R2_DATA_RUNTIME_MODULE_INVALID');
  }
  return runtime;
}

function prhR2DataBoundedReason_(error) {
  var value = String(error && (error.code || error.message) || 'R2_DATA_SOURCE_UNAVAILABLE');
  var colon = value.indexOf(':');
  if (colon >= 0) value = value.slice(0, colon);
  return /^[A-Z][A-Z0-9_]{2,79}$/.test(value) ? value : 'R2_DATA_SOURCE_UNAVAILABLE';
}

function prhR2DataErrorState_(reason) {
  var malformed = [
    'HEADER', 'MAPPING', 'ROW_INVALID', 'AMOUNT', 'TYPE_UNMAPPED', 'STATUS_UNMAPPED',
    'CANONICAL_TRANSACTION', 'CANONICAL_SOURCE', 'PROVENANCE', 'OCCURRED_AT_INVALID',
    'DIMENSION_HASH_COLLISION'
  ].some(function(token) { return String(reason).indexOf(token) >= 0; });
  return malformed ? 'MALFORMED_SOURCE' : 'SOURCE_UNAVAILABLE';
}

function prhR2DataPrivacyMode_(value) {
  var mode = typeof prhPrivacyResolveMode_ === 'function'
    ? prhPrivacyResolveMode_(value)
    : String(value || 'NORMAL').trim().toUpperCase();
  if (['NORMAL', 'MASKED', 'DEMO', 'ZEN'].indexOf(mode) < 0) prhR2DataFail_('R2_DATA_PRIVACY_MODE_INVALID');
  return mode;
}

function prhR2DataExpectedRevision_(value) {
  var revision = String(value || '').trim().toLowerCase();
  if (!revision) return '';
  if (!/^[0-9a-f]{64}$/.test(revision)) prhR2DataFail_('R2_DATA_EXPECTED_REVISION_INVALID');
  return revision;
}

function prhR2DataCreateSnapshot_() {
  var started = Date.now();
  var runtime = prhR2DataRuntime_();
  var currency = prhR2FinCurrency_();
  var dimensions = prhR2FinCreateDimensionResolverState_();
  var gatewayCallCount = 0;
  var rangeReadCount = 0;
  var cellReadCount = 0;
  var gateway = Object.freeze({
    readOperationsTable: function(request) {
      var snapshot = prhGoogleRepositoryReadOperationsTable_(request);
      gatewayCallCount += 1;
      if (snapshot && snapshot.read_plan) {
        rangeReadCount += Number(snapshot.read_plan.range_read_count || 0);
        cellReadCount += Number(snapshot.read_plan.cell_read_count || 0);
      }
      return snapshot;
    }
  });
  var repository = runtime.googleAdapter.createGoogleSheetsTransactionRepository(gateway, {
    default_currency: currency,
    resolvers: dimensions.resolvers
  });
  if (!repository || !repository.capabilities || repository.capabilities.read !== true ||
      repository.capabilities.write !== false || typeof repository.readAll !== 'function') {
    prhR2DataFail_('R2_DATA_REPOSITORY_CAPABILITY_INVALID');
  }
  var cycle = runtime.singleScanRefresh.createSingleScanRefresh(repository, {
    max_age_ms: PRH_R2_DATA_RUNTIME.SNAPSHOT_MAX_AGE_MS,
    max_operations: PRH_R2_DATA_RUNTIME.SNAPSHOT_MAX_OPERATIONS
  });
  var transactions = cycle.readAll();
  var revision = cycle.getRevision();
  if (!Array.isArray(transactions) || !/^[0-9a-f]{64}$/.test(String(revision || ''))) {
    prhR2DataFail_('R2_DATA_SNAPSHOT_INVALID');
  }
  return Object.freeze({
    runtime: runtime,
    currency: currency,
    dimensions: dimensions,
    cycle: cycle,
    transactions: Object.freeze(transactions.slice()),
    revision: revision,
    telemetry: Object.freeze({
      canonical_snapshot_read_count: 1,
      gateway_call_count: gatewayCallCount,
      range_read_count: rangeReadCount,
      cell_read_count: cellReadCount,
      elapsed_ms: Math.max(0, Date.now() - started)
    })
  });
}

function prhR2DataCheckExpectedRevision_(source, expectedRevision) {
  var expected = prhR2DataExpectedRevision_(expectedRevision);
  if (!expected || expected === source.revision) return null;
  return Object.freeze({
    state: 'STALE_SNAPSHOT',
    expected_revision: expected,
    snapshot_revision: source.revision,
    snapshot_revision_prefix: source.revision.slice(0, 12),
    retryable: true,
    reason_code: 'R2_DATA_SNAPSHOT_REVISION_CHANGED'
  });
}

function prhR2DataDisplayLabel_(source, kind, id, masked) {
  if (id == null || id === '') return null;
  if (masked) return 'Скрыто';
  return source.dimensions.displayLabel(kind, id);
}

function prhR2DataUniqueOptions_(source, kind, field, masked) {
  if (masked) return Object.freeze([]);
  var seen = {};
  source.transactions.forEach(function(tx) {
    var id = tx[field];
    if (id == null || id === '' || seen[id]) return;
    seen[id] = true;
  });
  return Object.freeze(Object.keys(seen).map(function(id) {
    return Object.freeze({ value: id, label: prhR2DataDisplayLabel_(source, kind, id, false) });
  }).sort(function(left, right) {
    return left.label.localeCompare(right.label, 'ru');
  }));
}

function prhR2DataProjectTransactionRow_(source, row, masked) {
  var token = prhR2FinSha256Hex_('PRH_R2_DATA_ROW_V1|' + source.revision + '|' + row.transaction_id).slice(0, 20);
  return Object.freeze({
    row_key: token,
    occurred_at: row.occurred_at,
    type: row.type,
    status: row.status,
    amount_minor: masked ? null : row.amount_minor,
    currency: row.currency,
    account: prhR2DataDisplayLabel_(source, 'account', row.account_id, masked),
    destination_account: prhR2DataDisplayLabel_(source, 'account', row.destination_account_id, masked),
    category: prhR2DataDisplayLabel_(source, 'category', row.category_id, masked),
    member: prhR2DataDisplayLabel_(source, 'member', row.member_id, masked),
    project: prhR2DataDisplayLabel_(source, 'project', row.project_id, masked),
    counterparty: masked ? null : row.counterparty,
    description: masked ? null : row.description,
    masked: masked === true
  });
}

function prhR2DataPageCanonical_(source, explorerResult) {
  var byId = {};
  source.transactions.forEach(function(tx) { byId[tx.transaction_id] = tx; });
  return explorerResult.rows.map(function(row) {
    var tx = byId[row.transaction_id];
    if (!tx) prhR2DataFail_('R2_DATA_PAGE_ROW_SOURCE_MISSING');
    return tx;
  });
}

function prhR2DataQueryInput_(input) {
  var source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  var limit = source.limit == null ? PRH_R2_DATA_RUNTIME.DEFAULT_PAGE_LIMIT : Number(source.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > PRH_R2_DATA_RUNTIME.MAX_PAGE_LIMIT) {
    prhR2DataFail_('R2_DATA_PAGE_LIMIT_INVALID');
  }
  var offset = source.offset == null ? 0 : Number(source.offset);
  if (!Number.isInteger(offset) || offset < 0) prhR2DataFail_('R2_DATA_PAGE_OFFSET_INVALID');
  return {
    date_from: source.date_from || null,
    date_to: source.date_to || null,
    account_ids: Array.isArray(source.account_ids) ? source.account_ids : [],
    category_ids: Array.isArray(source.category_ids) ? source.category_ids : [],
    member_ids: Array.isArray(source.member_ids) ? source.member_ids : [],
    types: Array.isArray(source.types) ? source.types : [],
    statuses: Array.isArray(source.statuses) ? source.statuses : [],
    text: source.text || '',
    sort: source.sort && typeof source.sort === 'object' && !Array.isArray(source.sort)
      ? source.sort
      : { field: 'occurred_at', direction: 'DESC' },
    offset: offset,
    limit: limit
  };
}

function prhR2BuildTransactionsView_(request) {
  var mode = prhR2DataPrivacyMode_(request && request.privacy_mode);
  if (mode === 'DEMO' || mode === 'ZEN') {
    return Object.freeze({
      schema: PRH_R2_DATA_RUNTIME.TRANSACTIONS_VIEW_SCHEMA,
      version: PRH_R2_DATA_RUNTIME.VERSION,
      state: 'PRIVACY_MODE_UNAVAILABLE',
      privacy_mode: mode,
      retryable: false,
      reason_code: 'R2_DATA_PRIVATE_ROUTE_REQUIRES_NORMAL_OR_MASKED',
      financial_write_authorized: false
    });
  }
  var source = prhR2DataCreateSnapshot_();
  var stale = prhR2DataCheckExpectedRevision_(source, request && request.expected_revision);
  if (stale) {
    return Object.freeze({
      schema: PRH_R2_DATA_RUNTIME.TRANSACTIONS_VIEW_SCHEMA,
      version: PRH_R2_DATA_RUNTIME.VERSION,
      privacy_mode: mode,
      financial_write_authorized: false,
      state: stale.state,
      expected_revision: stale.expected_revision,
      snapshot_revision: stale.snapshot_revision,
      snapshot_revision_prefix: stale.snapshot_revision_prefix,
      retryable: stale.retryable,
      reason_code: stale.reason_code
    });
  }
  var query = prhR2DataQueryInput_(request && request.query);
  var result = source.runtime.transactionExplorer.exploreTransactions(source.transactions, query);
  var pageCanonical = prhR2DataPageCanonical_(source, result);
  var aggregate = source.runtime.financialReconciliation.aggregateTransactions(pageCanonical);
  if (!aggregate || aggregate.policy_version !== PRH_R2_DATA_RUNTIME.FINANCIAL_TRUTH_POLICY) {
    prhR2DataFail_('R2_DATA_FINANCIAL_POLICY_MISMATCH');
  }
  var masked = mode === 'MASKED';
  var state = source.transactions.length === 0 ? 'EMPTY' : 'READY';
  return Object.freeze({
    schema: PRH_R2_DATA_RUNTIME.TRANSACTIONS_VIEW_SCHEMA,
    version: PRH_R2_DATA_RUNTIME.VERSION,
    state: state,
    privacy_mode: mode,
    currency: source.currency,
    snapshot_revision: source.revision,
    snapshot_revision_prefix: source.revision.slice(0, 12),
    matched_count: result.matched_count,
    page_count: result.page_count,
    has_more: result.has_more,
    query: Object.freeze({
      query_hash_prefix: result.query.query_hash.slice(0, 12),
      offset: result.query.offset,
      limit: result.query.limit,
      sort: result.query.sort
    }),
    rows: Object.freeze(result.rows.map(function(row) {
      return prhR2DataProjectTransactionRow_(source, row, masked);
    })),
    filters: Object.freeze({
      accounts: prhR2DataUniqueOptions_(source, 'account', 'account_id', masked),
      categories: prhR2DataUniqueOptions_(source, 'category', 'category_id', masked),
      members: prhR2DataUniqueOptions_(source, 'member', 'member_id', masked)
    }),
    page_financials: Object.freeze({
      policy_version: aggregate.policy_version,
      included_count: aggregate.included_count,
      income_minor: masked ? null : aggregate.income_minor,
      expense_minor: masked ? null : aggregate.external_expense_minor,
      cash_flow_minor: masked ? null : aggregate.cash_flow_minor
    }),
    retryable: true,
    reason_code: null,
    financial_write_authorized: false,
    canonical_mutation_performed: false,
    telemetry: Object.freeze({
      canonical_snapshot_read_count: source.telemetry.canonical_snapshot_read_count,
      snapshot_reuse_count: source.cycle.getTelemetry().snapshot_reuse_count,
      matched_count: result.matched_count,
      page_count: result.page_count,
      query_hash_prefix: result.query.query_hash.slice(0, 12),
      revision_hash_prefix: source.revision.slice(0, 12),
      elapsed_ms: source.telemetry.elapsed_ms,
      financial_payload_in_telemetry: false
    })
  });
}

function prhR2DataFindingAction_(issue) {
  if (issue.kind === 'EXACT_DUPLICATE') return 'Сверьте одинаковые операции перед любым ручным исправлением.';
  if (issue.kind === 'PROVENANCE') return 'Проверьте источник и привязку исходной строки.';
  if (issue.kind === 'MISSING_INVALID') return 'Исправьте обязательные поля в исходных данных и повторите проверку.';
  return 'Проверьте отмеченную операцию вручную; автоматическое исправление отключено.';
}

function prhR2BuildDataQualityView_(request) {
  var mode = prhR2DataPrivacyMode_(request && request.privacy_mode);
  if (mode === 'DEMO' || mode === 'ZEN') {
    return Object.freeze({
      schema: PRH_R2_DATA_RUNTIME.DATA_QUALITY_VIEW_SCHEMA,
      version: PRH_R2_DATA_RUNTIME.VERSION,
      state: 'PRIVACY_MODE_UNAVAILABLE',
      privacy_mode: mode,
      retryable: false,
      reason_code: 'R2_DATA_PRIVATE_ROUTE_REQUIRES_NORMAL_OR_MASKED',
      repair_write_authorized: false
    });
  }
  var source = prhR2DataCreateSnapshot_();
  var stale = prhR2DataCheckExpectedRevision_(source, request && request.expected_revision);
  if (stale) {
    return Object.freeze({
      schema: PRH_R2_DATA_RUNTIME.DATA_QUALITY_VIEW_SCHEMA,
      version: PRH_R2_DATA_RUNTIME.VERSION,
      privacy_mode: mode,
      repair_write_authorized: false,
      state: stale.state,
      expected_revision: stale.expected_revision,
      snapshot_revision: stale.snapshot_revision,
      snapshot_revision_prefix: stale.snapshot_revision_prefix,
      retryable: stale.retryable,
      reason_code: stale.reason_code
    });
  }
  var scan = source.runtime.dataQuality.scanRecords(source.transactions);
  var preview = source.runtime.dataQuality.previewRepairs(scan);
  var byKind = { MISSING_INVALID: 0, EXACT_DUPLICATE: 0, SUSPICIOUS: 0, PROVENANCE: 0 };
  var byReason = {};
  scan.issues.forEach(function(issue) {
    byKind[issue.kind] = (byKind[issue.kind] || 0) + 1;
    byReason[issue.reason] = (byReason[issue.reason] || 0) + 1;
  });
  var findings = scan.issues.slice(0, 100).map(function(issue) {
    return Object.freeze({
      kind: issue.kind,
      reason: issue.reason,
      severity: issue.severity,
      state: 'REVIEW_REQUIRED',
      action: prhR2DataFindingAction_(issue),
      autofix: false
    });
  });
  return Object.freeze({
    schema: PRH_R2_DATA_RUNTIME.DATA_QUALITY_VIEW_SCHEMA,
    version: PRH_R2_DATA_RUNTIME.VERSION,
    state: source.transactions.length === 0 ? 'EMPTY' : 'READY',
    privacy_mode: mode,
    snapshot_revision: source.revision,
    snapshot_revision_prefix: source.revision.slice(0, 12),
    record_count: scan.record_count,
    valid_record_count: scan.valid_record_count,
    issue_count: scan.issue_count,
    findings_truncated: scan.issue_count > findings.length,
    kind_counts: Object.freeze(byKind),
    reason_counts: Object.freeze(byReason),
    findings: Object.freeze(findings),
    repair_preview: Object.freeze({
      proposal_count: preview.proposal_count,
      preview_only: preview.preview_only === true,
      write_performed: preview.write_performed === true
    }),
    retryable: true,
    reason_code: null,
    repair_write_authorized: false,
    canonical_mutation_performed: false,
    telemetry: Object.freeze({
      canonical_snapshot_read_count: source.telemetry.canonical_snapshot_read_count,
      snapshot_reuse_count: source.cycle.getTelemetry().snapshot_reuse_count,
      record_count: scan.record_count,
      issue_count: scan.issue_count,
      scan_hash_prefix: scan.scan_hash.slice(0, 12),
      revision_hash_prefix: source.revision.slice(0, 12),
      elapsed_ms: source.telemetry.elapsed_ms,
      financial_payload_in_telemetry: false
    })
  });
}

function prhR2DataFailureEnvelope_(schema, request, error) {
  var reason = prhR2DataBoundedReason_(error);
  return Object.freeze({
    schema: schema,
    version: PRH_R2_DATA_RUNTIME.VERSION,
    state: prhR2DataErrorState_(reason),
    privacy_mode: prhR2DataPrivacyMode_(request && request.privacy_mode),
    retryable: true,
    reason_code: reason,
    financial_write_authorized: false,
    repair_write_authorized: false,
    canonical_mutation_performed: false
  });
}

function prhR2FetchTransactionsPayload(request) {
  try {
    return prhR2BuildTransactionsView_(request || {});
  } catch (error) {
    return prhR2DataFailureEnvelope_(PRH_R2_DATA_RUNTIME.TRANSACTIONS_VIEW_SCHEMA, request || {}, error);
  }
}

function prhR2FetchDataQualityPayload(request) {
  try {
    return prhR2BuildDataQualityView_(request || {});
  } catch (error) {
    return prhR2DataFailureEnvelope_(PRH_R2_DATA_RUNTIME.DATA_QUALITY_VIEW_SCHEMA, request || {}, error);
  }
}

function prhR2DataRuntimeSmokeToken() {
  if (PRH_R2_DATA_RUNTIME.WRITE_AUTHORITY !== false || PRH_R2_DATA_RUNTIME.AUTO_REPAIR_AUTHORITY !== false ||
      PRH_R2_DATA_RUNTIME.FREE_ONLY !== true) {
    prhR2DataFail_('R2_DATA_RUNTIME_POLICY_INVALID');
  }
  prhR2DataRuntime_();
  return 'PRH_R2_DATA_RUNTIME_V1|READ_ONLY|OK';
}
