/**
 * PERF-REC-001 Apps Script runtime performance adapter.
 *
 * This service has no financial semantics and no financial write authority.
 * It binds PERF-011 cache identity/freshness rules to Apps Script UserCache and
 * uses a cheap source revision probe before allowing a cache HIT.
 */
var PRH_PERF_REC_RUNTIME = Object.freeze({
  SCHEMA: 'PRH_PERF_REC_RUNTIME_V1',
  VERSION: '1.0.0',
  ROADMAP_ID: 'PERF-REC-001',
  SOURCE_REVISION_SCHEMA: 'PRH_GOOGLE_SHEETS_SOURCE_REVISION_V1',
  HOME_CACHE_SCHEMA: 'PRH_FINANCIAL_HOME_REVISION_CACHE_V1',
  CACHE_TTL_SECONDS: 300,
  CACHE_MAX_UTF8_BYTES: 85000,
  PROJECTION_IDENTITY: 'PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0',
  FINANCIAL_WRITE: false,
  FINANCIAL_SEMANTICS: false,
  PRIVATE_CACHE: 'USER',
  FREE_ONLY: true
});

var PRH_PERF_REC_TELEMETRY_ = null;

function prhPerfRecFail_(reason) {
  var error = new Error(reason);
  error.code = reason;
  throw error;
}

function prhPerfRecNowMs_() {
  return Date.now();
}

function prhPerfRecResetTelemetry_(mode) {
  PRH_PERF_REC_TELEMETRY_ = {
    schema: 'PRH_PERF_REC_TELEMETRY_V1',
    roadmap_id: PRH_PERF_REC_RUNTIME.ROADMAP_ID,
    mode: String(mode || 'HOME'),
    cache_status: 'NOT_CHECKED',
    reason_code: 'STARTED',
    phase_ms: {
      revision_probe_ms: 0,
      cache_read_ms: 0,
      cache_write_ms: 0,
      settings_read_ms: 0,
      sheet_read_ms: 0,
      canonical_snapshot_ms: 0,
      home_build_ms: 0,
      total_ms: 0
    },
    source_revision_probe_count: 0,
    gateway_call_count: 0,
    range_read_count: 0,
    cell_read_count: 0,
    canonical_snapshot_read_count: 0,
    snapshot_reuse_count: 0,
    unique_dimension_hash_count: 0,
    dimension_hash_memo_hit_count: 0,
    source_revision_hash_prefix: null,
    canonical_revision_hash_prefix: null,
    cache_payload_utf8_bytes: 0
  };
}

function prhPerfRecRecordPhase_(name, elapsedMs) {
  if (!PRH_PERF_REC_TELEMETRY_ || !PRH_PERF_REC_TELEMETRY_.phase_ms ||
      !Object.prototype.hasOwnProperty.call(PRH_PERF_REC_TELEMETRY_.phase_ms, name)) return;
  var value = Number(elapsedMs || 0);
  if (!Number.isFinite(value) || value < 0) return;
  PRH_PERF_REC_TELEMETRY_.phase_ms[name] += Math.round(value);
}

function prhPerfRecRecordSource_(source) {
  if (!PRH_PERF_REC_TELEMETRY_) return;
  ['gateway_call_count','range_read_count','cell_read_count','canonical_snapshot_read_count',
    'snapshot_reuse_count','unique_dimension_hash_count','dimension_hash_memo_hit_count'].forEach(function(key) {
    var value = Number(source && source[key] || 0);
    if (Number.isFinite(value) && value >= 0) PRH_PERF_REC_TELEMETRY_[key] = Math.round(value);
  });
  var prefix = String(source && source.canonical_revision_hash_prefix || '');
  if (/^[0-9a-f]{12}$/.test(prefix)) PRH_PERF_REC_TELEMETRY_.canonical_revision_hash_prefix = prefix;
}

function prhPerfRecSourceRevision_() {
  var started = prhPerfRecNowMs_();
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet || typeof spreadsheet.getId !== 'function') prhPerfRecFail_('PERF_REC_SPREADSHEET_REQUIRED');
    var file = DriveApp.getFileById(spreadsheet.getId());
    var updated = file && file.getLastUpdated ? file.getLastUpdated() : null;
    var updatedMs = updated instanceof Date ? updated.getTime() : NaN;
    if (!Number.isSafeInteger(updatedMs) || updatedMs < 1) prhPerfRecFail_('PERF_REC_SOURCE_MODIFIED_TIME_INVALID');
    var sheet = getSheetRequired_(PR_CONFIG.SHEETS.OPERATIONS);
    var lastRow = Number(sheet.getLastRow());
    var lastColumn = Number(sheet.getLastColumn());
    if (!Number.isInteger(lastRow) || lastRow < 1 || !Number.isInteger(lastColumn) || lastColumn < 1) {
      prhPerfRecFail_('PERF_REC_SOURCE_GEOMETRY_INVALID');
    }
    var revision = prhR2FinSha256Hex_(
      PRH_PERF_REC_RUNTIME.SOURCE_REVISION_SCHEMA + '|' + updatedMs + '|' + lastRow + '|' + lastColumn
    );
    if (!/^[0-9a-f]{64}$/.test(revision)) prhPerfRecFail_('PERF_REC_SOURCE_REVISION_INVALID');
    if (PRH_PERF_REC_TELEMETRY_) {
      PRH_PERF_REC_TELEMETRY_.source_revision_probe_count += 1;
      PRH_PERF_REC_TELEMETRY_.source_revision_hash_prefix = revision.slice(0, 12);
    }
    return revision;
  } finally {
    prhPerfRecRecordPhase_('revision_probe_ms', prhPerfRecNowMs_() - started);
  }
}

function prhPerfRecCacheIdentity_(sourceRevision) {
  var runtime = prhR2CanonicalRuntime_();
  runtime.revisionAwareCache.assertContract();
  return runtime.revisionAwareCache.cacheKeyHash(
    'PRH_TRANSACTION_REPOSITORY_V1',
    sourceRevision,
    'READ_ALL',
    null,
    {
      repository_adapter_namespace: 'PRH_GOOGLE_SHEETS_TRANSACTION_ADAPTER_V1@1.0.0|mapping:1.0.0',
      projection_identity: PRH_PERF_REC_RUNTIME.PROJECTION_IDENTITY
    }
  );
}

function prhPerfRecHomeCacheKey_(sourceRevision) {
  return 'prh-r2-home-v1-' + prhPerfRecCacheIdentity_(sourceRevision);
}

function prhPerfRecUtf8Size_(value) {
  var text = String(value || '');
  if (Utilities && typeof Utilities.newBlob === 'function') {
    return Utilities.newBlob(text, 'application/json').getBytes().length;
  }
  return unescape(encodeURIComponent(text)).length;
}

function prhPerfRecReadHomeCache_(sourceRevision) {
  var started = prhPerfRecNowMs_();
  try {
    var raw = CacheService.getUserCache().get(prhPerfRecHomeCacheKey_(sourceRevision));
    if (!raw) return null;
    var wrapper;
    try { wrapper = JSON.parse(raw); } catch (_) { return null; }
    if (!wrapper || wrapper.schema !== PRH_PERF_REC_RUNTIME.HOME_CACHE_SCHEMA ||
        wrapper.contract_version !== PRH_PERF_REC_RUNTIME.VERSION ||
        wrapper.source_revision !== sourceRevision || !wrapper.home ||
        wrapper.home.schema !== PRH_R2_FIN_RUNTIME.HOME_VIEW_SCHEMA) return null;
    if (PRH_PERF_REC_TELEMETRY_) {
      PRH_PERF_REC_TELEMETRY_.cache_payload_utf8_bytes = prhPerfRecUtf8Size_(raw);
    }
    return wrapper.home;
  } finally {
    prhPerfRecRecordPhase_('cache_read_ms', prhPerfRecNowMs_() - started);
  }
}

function prhPerfRecWriteHomeCache_(sourceRevision, home) {
  var started = prhPerfRecNowMs_();
  try {
    var wrapper = {
      schema: PRH_PERF_REC_RUNTIME.HOME_CACHE_SCHEMA,
      contract_version: PRH_PERF_REC_RUNTIME.VERSION,
      source_revision: sourceRevision,
      home: home
    };
    var serialized = JSON.stringify(wrapper);
    var bytes = prhPerfRecUtf8Size_(serialized);
    if (PRH_PERF_REC_TELEMETRY_) PRH_PERF_REC_TELEMETRY_.cache_payload_utf8_bytes = bytes;
    if (bytes > PRH_PERF_REC_RUNTIME.CACHE_MAX_UTF8_BYTES) {
      if (PRH_PERF_REC_TELEMETRY_) PRH_PERF_REC_TELEMETRY_.reason_code = 'CACHE_PAYLOAD_TOO_LARGE';
      return false;
    }
    CacheService.getUserCache().put(
      prhPerfRecHomeCacheKey_(sourceRevision),
      serialized,
      PRH_PERF_REC_RUNTIME.CACHE_TTL_SECONDS
    );
    return true;
  } finally {
    prhPerfRecRecordPhase_('cache_write_ms', prhPerfRecNowMs_() - started);
  }
}

function prhPerfRecRemoveHomeCache_(sourceRevision) {
  CacheService.getUserCache().remove(prhPerfRecHomeCacheKey_(sourceRevision));
}

function prhPerfRecGetOrBuildHome_(builder) {
  if (typeof builder !== 'function') prhPerfRecFail_('PERF_REC_HOME_BUILDER_REQUIRED');
  prhPerfRecResetTelemetry_('HOME');
  var totalStarted = prhPerfRecNowMs_();
  try {
    var revisionBefore = prhPerfRecSourceRevision_();
    var cached = prhPerfRecReadHomeCache_(revisionBefore);
    var revisionAfterCache = prhPerfRecSourceRevision_();
    if (cached && revisionAfterCache === revisionBefore) {
      PRH_PERF_REC_TELEMETRY_.cache_status = 'HIT';
      PRH_PERF_REC_TELEMETRY_.reason_code = 'EXACT_SOURCE_REVISION_MATCH';
      return cached;
    }
    if (cached && revisionAfterCache !== revisionBefore) {
      PRH_PERF_REC_TELEMETRY_.cache_status = 'MISS';
      PRH_PERF_REC_TELEMETRY_.reason_code = 'SOURCE_REVISION_CHANGED_DURING_CACHE_READ';
    } else {
      PRH_PERF_REC_TELEMETRY_.cache_status = 'MISS';
      PRH_PERF_REC_TELEMETRY_.reason_code = 'CACHE_KEY_ABSENT';
    }

    var buildRevision = revisionAfterCache;
    var home = builder();
    var revisionAfterBuild = prhPerfRecSourceRevision_();
    if (revisionAfterBuild !== buildRevision) {
      PRH_PERF_REC_TELEMETRY_.reason_code = 'SOURCE_REVISION_CHANGED_DURING_BUILD';
      prhPerfRecFail_('PERF_REC_SOURCE_REVISION_CHANGED_DURING_BUILD');
    }
    prhPerfRecWriteHomeCache_(buildRevision, home);
    if (PRH_PERF_REC_TELEMETRY_.reason_code === 'CACHE_KEY_ABSENT') {
      PRH_PERF_REC_TELEMETRY_.reason_code = 'COLD_SINGLE_SCAN_BUILT';
    }
    return home;
  } finally {
    prhPerfRecRecordPhase_('total_ms', prhPerfRecNowMs_() - totalStarted);
  }
}

function prhPerfRecTelemetrySnapshot_() {
  var source = PRH_PERF_REC_TELEMETRY_ || {};
  return JSON.parse(JSON.stringify(source));
}

/**
 * Owner-authenticated Execution API probe. Returns technical timing/read-count
 * evidence only; never returns financial values, labels, row IDs or Web App URL.
 */
function prhPerfRecBaselineProbe(mode) {
  var requested = String(mode || '').trim().toUpperCase();
  if (requested !== 'COLD' && requested !== 'WARM') prhPerfRecFail_('PERF_REC_BASELINE_MODE_INVALID');
  var revision = prhPerfRecSourceRevision_();
  if (requested === 'COLD') prhPerfRecRemoveHomeCache_(revision);
  prhR2BuildFinancialHomeRuntime_();
  var telemetry = prhPerfRecTelemetrySnapshot_();
  telemetry.mode = requested;
  telemetry.candidate_sha = typeof PR_BUILD_INFO === 'object' && PR_BUILD_INFO ? String(PR_BUILD_INFO.candidateSha || '') : '';
  if (!/^[0-9a-f]{40}$/.test(telemetry.candidate_sha)) prhPerfRecFail_('PERF_REC_BUILD_IDENTITY_REQUIRED');
  return telemetry;
}
