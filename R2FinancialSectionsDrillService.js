/**
 * FIN-REC-001 revision-bound drill for private financial sections.
 *
 * Drill is a separate read-only request, but it must prove the same canonical
 * repository revision as the parent financial view. It delegates filtering and
 * paging to the canonical Transaction Explorer engine and owns no formulas.
 */
var PRH_R2_FIN_DRILL = Object.freeze({
  SCHEMA: 'PRH_R2_PRIVATE_FINANCIAL_DRILL_V1',
  VERSION: '1.0.0',
  LIMIT: 20,
  WRITE_AUTHORITY: false,
  FREE_ONLY: true
});

function prhR2FinDrillFail_(reason) {
  var error = new Error(reason);
  error.code = reason;
  throw error;
}

function prhR2FinDrillRequest_(request) {
  var input = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
  var expected = String(input.expected_revision || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expected)) prhR2FinDrillFail_('R2_FIN_DRILL_EXPECTED_REVISION_REQUIRED');
  var base = prhR2FinSectionsRequest_(input);
  var category = String(input.drill_category_id || '').trim();
  if (category) {
    var normalized = prhR2FinSectionsIds_([category]);
    if (normalized.length !== 1 || normalized[0] !== category) prhR2FinDrillFail_('R2_FIN_DRILL_CATEGORY_INVALID');
  }
  return Object.freeze({
    expected_revision: expected,
    privacy_mode: base.privacy_mode,
    window_days: base.window_days,
    filters: base.filters,
    category_id: category
  });
}

function prhR2FinDrillProjectRow_(source, row) {
  return Object.freeze({
    occurred_at: row.occurred_at,
    type: row.type,
    status: row.status,
    amount_minor: row.amount_minor,
    currency: row.currency,
    account: prhR2FinSectionsLabel_(source, 'account', row.account_id, 'Без счёта'),
    category: prhR2FinSectionsLabel_(source, 'category', row.category_id, 'Без категории'),
    member: prhR2FinSectionsLabel_(source, 'member', row.member_id, 'Без участника'),
    counterparty: row.counterparty,
    description: row.description
  });
}

function prhR2BuildFinancialSectionsDrill_(request) {
  var normalized = prhR2FinDrillRequest_(request);
  if (normalized.privacy_mode !== 'NORMAL') {
    return Object.freeze({
      schema: PRH_R2_FIN_DRILL.SCHEMA,
      version: PRH_R2_FIN_DRILL.VERSION,
      state: 'PRIVACY_MODE_UNAVAILABLE',
      retryable: false,
      reason_code: 'R2_FIN_DRILL_REQUIRES_NORMAL',
      financial_write_authorized: false
    });
  }

  var source = prhR2DataCreateSnapshot_();
  if (source.revision !== normalized.expected_revision) {
    return Object.freeze({
      schema: PRH_R2_FIN_DRILL.SCHEMA,
      version: PRH_R2_FIN_DRILL.VERSION,
      state: 'STALE_SNAPSHOT',
      snapshot_revision_prefix: source.revision.slice(0, 12),
      retryable: true,
      reason_code: 'R2_FIN_DRILL_SNAPSHOT_REVISION_CHANGED',
      financial_write_authorized: false
    });
  }
  if (!source.transactions.length) {
    return Object.freeze({
      schema: PRH_R2_FIN_DRILL.SCHEMA,
      version: PRH_R2_FIN_DRILL.VERSION,
      state: 'EMPTY',
      snapshot_revision_prefix: source.revision.slice(0, 12),
      rows: Object.freeze([]),
      matched_count: 0,
      financial_write_authorized: false
    });
  }

  var runtime = prhR2FinSectionsRuntime_();
  var period = prhR2FinSectionsPeriod_(source.transactions, normalized.window_days);
  var filtered = prhR2FinSectionsApplyFilters_(source.transactions, normalized.filters);
  if (normalized.category_id && normalized.filters.category_ids.length && normalized.filters.category_ids.indexOf(normalized.category_id) < 0) {
    prhR2FinDrillFail_('R2_FIN_DRILL_CATEGORY_OUTSIDE_FILTER');
  }
  var result = runtime.transactionExplorer.exploreTransactions(filtered, {
    date_from: period.current.start,
    date_to: period.current.end,
    category_ids: normalized.category_id ? [normalized.category_id] : [],
    sort: { field: 'occurred_at', direction: 'DESC' },
    offset: 0,
    limit: PRH_R2_FIN_DRILL.LIMIT
  });

  return Object.freeze({
    schema: PRH_R2_FIN_DRILL.SCHEMA,
    version: PRH_R2_FIN_DRILL.VERSION,
    state: result.matched_count ? 'READY' : 'EMPTY',
    engine: 'PRH_TRANSACTION_EXPLORER_V1',
    snapshot_revision_prefix: source.revision.slice(0, 12),
    period: period.current,
    category_label: normalized.category_id ? prhR2FinSectionsLabel_(source, 'category', normalized.category_id, 'Без категории') : null,
    matched_count: result.matched_count,
    page_count: result.page_count,
    has_more: result.has_more,
    rows: Object.freeze(result.rows.map(function(row) { return prhR2FinDrillProjectRow_(source, row); })),
    retryable: true,
    reason_code: null,
    financial_write_authorized: false,
    telemetry: Object.freeze({
      canonical_snapshot_read_count: 1,
      matched_count: result.matched_count,
      page_count: result.page_count,
      revision_hash_prefix: source.revision.slice(0, 12),
      financial_payload_in_telemetry: false
    })
  });
}

function prhR2FetchFinancialSectionsDrillPayload(request) {
  try {
    return prhR2BuildFinancialSectionsDrill_(request || {});
  } catch (error) {
    var reason = typeof prhR2DataBoundedReason_ === 'function' ? prhR2DataBoundedReason_(error) : 'R2_FIN_DRILL_SOURCE_UNAVAILABLE';
    return Object.freeze({
      schema: PRH_R2_FIN_DRILL.SCHEMA,
      version: PRH_R2_FIN_DRILL.VERSION,
      state: 'SOURCE_UNAVAILABLE',
      retryable: true,
      reason_code: reason,
      financial_write_authorized: false
    });
  }
}

function prhR2FinancialSectionsDrillSmokeToken() {
  if (PRH_R2_FIN_DRILL.WRITE_AUTHORITY !== false || PRH_R2_FIN_DRILL.FREE_ONLY !== true) prhR2FinDrillFail_('R2_FIN_DRILL_POLICY_INVALID');
  return 'PRH_R2_FIN_DRILL_V1|REVISION_BOUND|READ_ONLY|OK';
}
