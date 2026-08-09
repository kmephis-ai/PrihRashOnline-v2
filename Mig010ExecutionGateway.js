'use strict';

/**
 * MIG-010 owner-authorized staging execution gateway.
 *
 * This gateway is deliberately separate from the generic ARCH-011 repository
 * adapter. Generic Google canonical writes remain blocked. These entry points
 * accept only an owner-private execution package that has already passed
 * repair resolve + rebuild dry-run and still require the literal irreversible
 * authorization at runtime.
 */
var PRH_MIG010_EXECUTION = Object.freeze({
  SCHEMA: 'MIG010_EXECUTION_GATEWAY_V1',
  VERSION: '1.0.0',
  AUTHORIZATION: 'IRREVERSIBLE_ACTION_AUTHORIZED',
  MAX_BATCH_ROWS: 100,
  MAX_BACKUP_AGE_MS: 24 * 60 * 60 * 1000,
  COLUMN_COUNT: 20,
  SESSION_PREFIX: 'MIG010_SESSION_',
  HEADERS: Object.freeze([
    'ID', 'Дата и время', 'Дата', 'Месяц', 'Тип', 'Сумма', 'Счёт', 'Счёт назначения',
    'Категория', 'Подкатегория', 'Наименование', 'Член семьи', 'Проект', 'Теги',
    'Регулярная', 'Комментарий', 'Источник', 'Строка источника', 'Статус', 'Исходный тип'
  ])
});

function prhMig010Fail_(reason) {
  throw new Error(reason);
}

function prhMig010Text_(value) {
  return String(value == null ? '' : value).trim();
}

function prhMig010Hex64_(value) {
  return /^[0-9a-f]{64}$/.test(String(value || ''));
}

function prhMig010SessionId_(value) {
  var id = String(value || '');
  if (!/^[A-Za-z0-9_-]{12,64}$/.test(id)) prhMig010Fail_('MIG010_EXECUTION_SESSION_ID_INVALID');
  return id;
}

function prhMig010StableStringify_(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(prhMig010StableStringify_).join(',') + ']';
  return '{' + Object.keys(value).sort().map(function (key) {
    return JSON.stringify(key) + ':' + prhMig010StableStringify_(value[key]);
  }).join(',') + '}';
}

function prhMig010Sha256_(value) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function (item) {
    var unsigned = item < 0 ? item + 256 : item;
    return ('0' + unsigned.toString(16)).slice(-2);
  }).join('');
}

function prhMig010NormalizedEncodedCell_(cell) {
  if (!cell || typeof cell !== 'object' || Array.isArray(cell)) prhMig010Fail_('MIG010_EXECUTION_CELL_INVALID');
  if (cell.f) return { f: String(cell.f) };
  if (cell.t === 'd') {
    var date = new Date(String(cell.v || ''));
    if (!isFinite(date.getTime())) prhMig010Fail_('MIG010_EXECUTION_DATE_CELL_INVALID');
    return { t: 'd', v: date.toISOString() };
  }
  if (cell.t === 'n') {
    if (typeof cell.v !== 'number' || !isFinite(cell.v)) prhMig010Fail_('MIG010_EXECUTION_NUMBER_CELL_INVALID');
    return { t: 'n', v: cell.v };
  }
  if (cell.t === 'b') return { t: 'b', v: Boolean(cell.v) };
  if (cell.t === 's') return { t: 's', v: String(cell.v == null ? '' : cell.v) };
  prhMig010Fail_('MIG010_EXECUTION_CELL_TYPE_INVALID');
}

function prhMig010HashEncodedRows_(rows) {
  if (!Array.isArray(rows)) prhMig010Fail_('MIG010_EXECUTION_ROWS_INVALID');
  var normalized = rows.map(function (row) {
    if (!Array.isArray(row) || row.length !== PRH_MIG010_EXECUTION.COLUMN_COUNT) {
      prhMig010Fail_('MIG010_EXECUTION_ROW_WIDTH_INVALID');
    }
    return row.map(prhMig010NormalizedEncodedCell_);
  });
  return prhMig010Sha256_(prhMig010StableStringify_(normalized));
}

function prhMig010EncodeLiveCell_(value, formula) {
  if (formula) return { f: String(formula) };
  if (value instanceof Date) {
    if (!isFinite(value.getTime())) prhMig010Fail_('MIG010_EXECUTION_LIVE_DATE_INVALID');
    return { t: 'd', v: value.toISOString() };
  }
  if (typeof value === 'number') {
    if (!isFinite(value)) prhMig010Fail_('MIG010_EXECUTION_LIVE_NUMBER_INVALID');
    return { t: 'n', v: value };
  }
  if (typeof value === 'boolean') return { t: 'b', v: value };
  return { t: 's', v: String(value == null ? '' : value) };
}

function prhMig010EncodeRange_(range) {
  var values = range.getValues();
  var formulas = range.getFormulas();
  return values.map(function (row, r) {
    return row.map(function (value, c) {
      return prhMig010EncodeLiveCell_(value, formulas[r][c]);
    });
  });
}

function prhMig010HashRange_(range) {
  return prhMig010HashEncodedRows_(prhMig010EncodeRange_(range));
}

function prhMig010AssertHeaders_(sheet) {
  var headers = sheet.getRange(1, 1, 1, PRH_MIG010_EXECUTION.COLUMN_COUNT).getValues()[0];
  PRH_MIG010_EXECUTION.HEADERS.forEach(function (expected, index) {
    if (String(headers[index] || '').trim() !== expected) {
      prhMig010Fail_('MIG010_EXECUTION_TARGET_HEADER_INVALID');
    }
  });
  return true;
}

function prhMig010TableHash_(sheet) {
  prhMig010AssertHeaders_(sheet);
  var lastRow = Math.max(sheet.getLastRow(), 1);
  return prhMig010HashRange_(sheet.getRange(1, 1, lastRow, PRH_MIG010_EXECUTION.COLUMN_COUNT));
}

function prhMig010DecodeRowsForWrite_(rows, startSheetRow) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > PRH_MIG010_EXECUTION.MAX_BATCH_ROWS) {
    prhMig010Fail_('MIG010_EXECUTION_BATCH_SIZE_INVALID');
  }
  return rows.map(function (row, r) {
    if (!Array.isArray(row) || row.length !== PRH_MIG010_EXECUTION.COLUMN_COUNT) {
      prhMig010Fail_('MIG010_EXECUTION_ROW_WIDTH_INVALID');
    }
    var sheetRow = startSheetRow + r;
    return row.map(function (cell, c) {
      var normalized = prhMig010NormalizedEncodedCell_(cell);
      if (normalized.f) {
        if (c !== 2 && c !== 3) prhMig010Fail_('MIG010_EXECUTION_FORMULA_COLUMN_INVALID');
        var expected = c === 2
          ? '=IF(B' + sheetRow + '="";"";INT(B' + sheetRow + '))'
          : '=IF(C' + sheetRow + '="";"";DATE(YEAR(C' + sheetRow + ');MONTH(C' + sheetRow + ');1))';
        if (normalized.f !== expected) prhMig010Fail_('MIG010_EXECUTION_FORMULA_BINDING_INVALID');
        return normalized.f;
      }
      if (normalized.t === 'd') return new Date(normalized.v);
      if (normalized.t === 'n' || normalized.t === 'b') return normalized.v;
      if (/^\s*=/.test(normalized.v)) prhMig010Fail_('MIG010_EXECUTION_FORMULA_LIKE_TEXT_UNSUPPORTED');
      return normalized.v;
    });
  });
}

function prhMig010SessionKey_(sessionId) {
  return PRH_MIG010_EXECUTION.SESSION_PREFIX + sessionId;
}

function prhMig010ReadSession_(sessionId) {
  var raw = PropertiesService.getScriptProperties().getProperty(prhMig010SessionKey_(sessionId));
  if (!raw) prhMig010Fail_('MIG010_EXECUTION_SESSION_NOT_FOUND');
  var session;
  try { session = JSON.parse(raw); } catch (error) { prhMig010Fail_('MIG010_EXECUTION_SESSION_INVALID'); }
  if (!session || session.schema !== 'MIG010_EXECUTION_SESSION_V1') prhMig010Fail_('MIG010_EXECUTION_SESSION_INVALID');
  return session;
}

function prhMig010WriteSession_(session) {
  PropertiesService.getScriptProperties().setProperty(
    prhMig010SessionKey_(session.session_id),
    JSON.stringify(session)
  );
}

function prhMig010AssertAuthorization_(request) {
  var input = request || {};
  if (input.authorization !== PRH_MIG010_EXECUTION.AUTHORIZATION) {
    prhMig010Fail_('MIG010_EXECUTION_IRREVERSIBLE_ACTION_NOT_AUTHORIZED');
  }
  ['package_hash','resolved_hash','candidate_revision_hash','backup_cipher_sha256','current_raw_table_hash','final_raw_table_hash','target_header_hash']
    .forEach(function (field) {
      if (!prhMig010Hex64_(input[field])) prhMig010Fail_('MIG010_EXECUTION_AUTHORIZATION_BINDING_INVALID');
    });
  var verifiedAt = Date.parse(String(input.backup_verified_at || ''));
  if (!isFinite(verifiedAt)) prhMig010Fail_('MIG010_EXECUTION_BACKUP_VERIFIED_AT_INVALID');
  var age = Date.now() - verifiedAt;
  if (age < 0 || age > PRH_MIG010_EXECUTION.MAX_BACKUP_AGE_MS) prhMig010Fail_('MIG010_EXECUTION_BACKUP_STALE');
  return input;
}

function prhMig010AssertSessionRequest_(request, session) {
  prhMig010AssertAuthorization_(request);
  if (request.package_hash !== session.package_hash ||
      request.resolved_hash !== session.resolved_hash ||
      request.candidate_revision_hash !== session.candidate_revision_hash ||
      request.backup_cipher_sha256 !== session.backup_cipher_sha256 ||
      request.current_raw_table_hash !== session.current_raw_table_hash ||
      request.final_raw_table_hash !== session.final_raw_table_hash ||
      request.target_header_hash !== session.target_header_hash) {
    prhMig010Fail_('MIG010_EXECUTION_SESSION_BINDING_MISMATCH');
  }
}

function prhMig010TargetSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) prhMig010Fail_('MIG010_EXECUTION_SPREADSHEET_UNAVAILABLE');
  var name = PR_CONFIG && PR_CONFIG.SHEETS && PR_CONFIG.SHEETS.OPERATIONS;
  if (!name) prhMig010Fail_('MIG010_EXECUTION_TARGET_CONFIG_INVALID');
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) prhMig010Fail_('MIG010_EXECUTION_TARGET_SHEET_NOT_FOUND');
  prhMig010AssertHeaders_(sheet);
  return { spreadsheet: spreadsheet, sheet: sheet };
}

function prhMig010SafeSheetName_(prefix, sessionId) {
  return prefix + sessionId.slice(0, 32);
}

function prhMig010BeginAuthorizedExecution(request) {
  var input = prhMig010AssertAuthorization_(request);
  var sessionId = prhMig010SessionId_(input.session_id);
  var batchCount = Number(input.batch_count);
  if (!Number.isInteger(batchCount) || batchCount < 1 || batchCount > 100000) {
    prhMig010Fail_('MIG010_EXECUTION_BATCH_COUNT_INVALID');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var properties = PropertiesService.getScriptProperties();
    if (properties.getProperty(prhMig010SessionKey_(sessionId))) {
      prhMig010Fail_('MIG010_EXECUTION_SESSION_ALREADY_EXISTS');
    }
    var target = prhMig010TargetSheet_();
    if (prhMig010TableHash_(target.sheet) !== input.current_raw_table_hash) {
      prhMig010Fail_('MIG010_EXECUTION_TARGET_CHANGED_SINCE_BACKUP');
    }
    if (prhMig010HashRange_(target.sheet.getRange(1, 1, 1, PRH_MIG010_EXECUTION.COLUMN_COUNT)) !== input.target_header_hash) {
      prhMig010Fail_('MIG010_EXECUTION_TARGET_HEADER_HASH_MISMATCH');
    }

    var rollbackName = prhMig010SafeSheetName_('__MIG010_RB_', sessionId);
    var stageName = prhMig010SafeSheetName_('__MIG010_STAGE_', sessionId);
    if (target.spreadsheet.getSheetByName(rollbackName) || target.spreadsheet.getSheetByName(stageName)) {
      prhMig010Fail_('MIG010_EXECUTION_SESSION_SHEET_COLLISION');
    }
    var rollback = target.sheet.copyTo(target.spreadsheet).setName(rollbackName);
    rollback.hideSheet();
    var stage = target.spreadsheet.insertSheet(stageName);
    stage.hideSheet();
    target.sheet.getRange(1, 1, 1, PRH_MIG010_EXECUTION.COLUMN_COUNT)
      .copyTo(stage.getRange(1, 1, 1, PRH_MIG010_EXECUTION.COLUMN_COUNT), { contentsOnly: true });

    var session = {
      schema: 'MIG010_EXECUTION_SESSION_V1',
      session_id: sessionId,
      status: 'STAGING',
      package_hash: input.package_hash,
      resolved_hash: input.resolved_hash,
      candidate_revision_hash: input.candidate_revision_hash,
      backup_cipher_sha256: input.backup_cipher_sha256,
      current_raw_table_hash: input.current_raw_table_hash,
      final_raw_table_hash: input.final_raw_table_hash,
      target_header_hash: input.target_header_hash,
      batch_count: batchCount,
      next_batch: 0,
      next_sheet_row: 2,
      batch_hashes: [],
      rollback_sheet: rollbackName,
      staging_sheet: stageName,
      started_at: new Date().toISOString()
    };
    prhMig010WriteSession_(session);
    return {
      schema: 'MIG010_EXECUTION_BEGIN_RESULT_V1',
      status: 'STAGING_READY',
      sessionId: sessionId,
      writeAuthorized: true,
      financialPayload: false
    };
  } finally {
    lock.releaseLock();
  }
}

function prhMig010WriteAuthorizedBatch(request) {
  var input = request || {};
  var sessionId = prhMig010SessionId_(input.session_id);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var session = prhMig010ReadSession_(sessionId);
    prhMig010AssertSessionRequest_(input, session);
    if (session.status !== 'STAGING') prhMig010Fail_('MIG010_EXECUTION_SESSION_NOT_STAGING');
    var batchIndex = Number(input.batch_index);
    var startSheetRow = Number(input.start_sheet_row);
    if (!Number.isInteger(batchIndex) || batchIndex < 0 || !Number.isInteger(startSheetRow) || startSheetRow < 2 ||
        !prhMig010Hex64_(input.batch_hash) || !Array.isArray(input.rows)) {
      prhMig010Fail_('MIG010_EXECUTION_BATCH_REQUEST_INVALID');
    }
    if (batchIndex < session.next_batch) {
      if (session.batch_hashes[batchIndex] === input.batch_hash) {
        return { schema: 'MIG010_EXECUTION_BATCH_RESULT_V1', status: 'ALREADY_APPLIED', batchIndex: batchIndex, writeAuthorized: true };
      }
      prhMig010Fail_('MIG010_EXECUTION_BATCH_IDEMPOTENCY_CONFLICT');
    }
    if (batchIndex !== session.next_batch || startSheetRow !== session.next_sheet_row) {
      prhMig010Fail_('MIG010_EXECUTION_BATCH_SEQUENCE_INVALID');
    }
    if (prhMig010HashEncodedRows_(input.rows) !== input.batch_hash) {
      prhMig010Fail_('MIG010_EXECUTION_BATCH_HASH_MISMATCH');
    }
    var target = prhMig010TargetSheet_();
    var stage = target.spreadsheet.getSheetByName(session.staging_sheet);
    if (!stage) prhMig010Fail_('MIG010_EXECUTION_STAGING_SHEET_MISSING');
    var matrix = prhMig010DecodeRowsForWrite_(input.rows, startSheetRow);
    var range = stage.getRange(startSheetRow, 1, matrix.length, PRH_MIG010_EXECUTION.COLUMN_COUNT);
    range.setValues(matrix);
    SpreadsheetApp.flush();
    if (prhMig010HashRange_(range) !== input.batch_hash) {
      range.clearContent();
      prhMig010Fail_('MIG010_EXECUTION_BATCH_READBACK_MISMATCH');
    }
    session.batch_hashes[batchIndex] = input.batch_hash;
    session.next_batch += 1;
    session.next_sheet_row += matrix.length;
    prhMig010WriteSession_(session);
    return {
      schema: 'MIG010_EXECUTION_BATCH_RESULT_V1',
      status: 'BATCH_STAGED',
      batchIndex: batchIndex,
      writeAuthorized: true,
      financialPayload: false
    };
  } finally {
    lock.releaseLock();
  }
}

function prhMig010RestoreFromRollback_(spreadsheet, targetSheet, rollbackSheet, expectedHash) {
  if (!rollbackSheet) prhMig010Fail_('MIG010_EXECUTION_ROLLBACK_SHEET_MISSING');
  var sourceLastRow = Math.max(rollbackSheet.getLastRow(), 1);
  var clearLastRow = Math.max(targetSheet.getLastRow(), sourceLastRow, 1);
  targetSheet.getRange(1, 1, clearLastRow, PRH_MIG010_EXECUTION.COLUMN_COUNT).clearContent();
  for (var start = 1; start <= sourceLastRow; start += PRH_MIG010_EXECUTION.MAX_BATCH_ROWS) {
    var count = Math.min(PRH_MIG010_EXECUTION.MAX_BATCH_ROWS, sourceLastRow - start + 1);
    rollbackSheet.getRange(start, 1, count, PRH_MIG010_EXECUTION.COLUMN_COUNT)
      .copyTo(targetSheet.getRange(start, 1, count, PRH_MIG010_EXECUTION.COLUMN_COUNT), { contentsOnly: true });
  }
  SpreadsheetApp.flush();
  if (prhMig010TableHash_(targetSheet) !== expectedHash) {
    prhMig010Fail_('MIG010_EXECUTION_ROLLBACK_VERIFY_FAILED');
  }
  return true;
}

function prhMig010FinalizeAuthorizedExecution(request) {
  var input = request || {};
  var sessionId = prhMig010SessionId_(input.session_id);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var session = prhMig010ReadSession_(sessionId);
    prhMig010AssertSessionRequest_(input, session);
    if (session.status !== 'STAGING') prhMig010Fail_('MIG010_EXECUTION_SESSION_NOT_STAGING');
    if (session.next_batch !== session.batch_count) prhMig010Fail_('MIG010_EXECUTION_BATCHES_INCOMPLETE');
    var target = prhMig010TargetSheet_();
    var stage = target.spreadsheet.getSheetByName(session.staging_sheet);
    var rollback = target.spreadsheet.getSheetByName(session.rollback_sheet);
    if (!stage || !rollback) prhMig010Fail_('MIG010_EXECUTION_SESSION_SHEET_MISSING');
    if (prhMig010TableHash_(stage) !== session.final_raw_table_hash) {
      prhMig010Fail_('MIG010_EXECUTION_STAGING_FINAL_HASH_MISMATCH');
    }
    if (prhMig010TableHash_(target.sheet) !== session.current_raw_table_hash) {
      prhMig010Fail_('MIG010_EXECUTION_LIVE_TARGET_DRIFT');
    }

    var stageLastRow = Math.max(stage.getLastRow(), 1);
    var clearLastRow = Math.max(target.sheet.getLastRow(), stageLastRow, 1);
    try {
      target.sheet.getRange(2, 1, Math.max(clearLastRow - 1, 1), PRH_MIG010_EXECUTION.COLUMN_COUNT).clearContent();
      for (var start = 2; start <= stageLastRow; start += PRH_MIG010_EXECUTION.MAX_BATCH_ROWS) {
        var count = Math.min(PRH_MIG010_EXECUTION.MAX_BATCH_ROWS, stageLastRow - start + 1);
        stage.getRange(start, 1, count, PRH_MIG010_EXECUTION.COLUMN_COUNT)
          .copyTo(target.sheet.getRange(start, 1, count, PRH_MIG010_EXECUTION.COLUMN_COUNT), { contentsOnly: true });
        SpreadsheetApp.flush();
        if (prhMig010HashRange_(target.sheet.getRange(start, 1, count, PRH_MIG010_EXECUTION.COLUMN_COUNT)) !==
            prhMig010HashRange_(stage.getRange(start, 1, count, PRH_MIG010_EXECUTION.COLUMN_COUNT))) {
          prhMig010Fail_('MIG010_EXECUTION_LIVE_BATCH_READBACK_MISMATCH');
        }
      }
      SpreadsheetApp.flush();
      if (prhMig010TableHash_(target.sheet) !== session.final_raw_table_hash) {
        prhMig010Fail_('MIG010_EXECUTION_FINAL_HASH_MISMATCH');
      }
    } catch (error) {
      prhMig010RestoreFromRollback_(target.spreadsheet, target.sheet, rollback, session.current_raw_table_hash);
      session.status = 'ROLLED_BACK_AFTER_FAILURE';
      session.failure_reason = String(error && error.message || 'MIG010_EXECUTION_FINALIZE_FAILED');
      prhMig010WriteSession_(session);
      throw error;
    }
    session.status = 'FINALIZED_PENDING_RECONCILIATION';
    session.finalized_at = new Date().toISOString();
    prhMig010WriteSession_(session);
    return {
      schema: 'MIG010_EXECUTION_FINALIZE_RESULT_V1',
      status: 'FINALIZED_PENDING_RECONCILIATION',
      sessionId: sessionId,
      finalRawTableHash: session.final_raw_table_hash,
      rollbackAvailable: true,
      writeAuthorized: true,
      financialPayload: false
    };
  } finally {
    lock.releaseLock();
  }
}

function prhMig010RollbackAuthorizedExecution(request) {
  var input = request || {};
  var sessionId = prhMig010SessionId_(input.session_id);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var session = prhMig010ReadSession_(sessionId);
    prhMig010AssertSessionRequest_(input, session);
    var target = prhMig010TargetSheet_();
    var rollback = target.spreadsheet.getSheetByName(session.rollback_sheet);
    prhMig010RestoreFromRollback_(target.spreadsheet, target.sheet, rollback, session.current_raw_table_hash);
    session.status = 'ROLLED_BACK_BY_OWNER';
    session.rolled_back_at = new Date().toISOString();
    prhMig010WriteSession_(session);
    return {
      schema: 'MIG010_EXECUTION_ROLLBACK_RESULT_V1',
      status: 'ROLLED_BACK',
      sessionId: sessionId,
      writeAuthorized: true,
      financialPayload: false
    };
  } finally {
    lock.releaseLock();
  }
}

/** Public-safe capability metadata only. */
function prhMig010ExecutionGatewayStatus() {
  return {
    schema: PRH_MIG010_EXECUTION.SCHEMA,
    version: PRH_MIG010_EXECUTION.VERSION,
    strategy: 'STAGE_VERIFY_REPLACE_WITH_ROLLBACK_V1',
    max_batch_rows: PRH_MIG010_EXECUTION.MAX_BATCH_ROWS,
    rollback_copy_required: true,
    staging_required: true,
    explicit_authorization_required: true,
    public_ci_can_authorize: false,
    generic_repository_write_authorized: false
  };
}
