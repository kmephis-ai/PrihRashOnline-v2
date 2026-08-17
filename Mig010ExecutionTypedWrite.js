'use strict';

/**
 * MIG-010 exact-type staging writer.
 *
 * Google Sheets can coerce a JavaScript string/date to another cell type when
 * Range.setValues() writes into a format that conflicts with the explicit
 * package type. The execution package is authoritative for t:s/t:n/t:d/t:b
 * and formulas, so staging must preserve those types exactly.
 *
 * Strategy:
 * 1) write once using the existing formats;
 * 2) if exact readback already matches, keep every existing format untouched;
 * 3) otherwise repair only cells whose mismatch is a type coercion that can be
 *    fixed by number format (t:s -> text, t:d -> date-time), rewrite, and keep
 *    only those minimal compatible formats;
 * 4) if exact readback still differs, clear the failed batch, restore all
 *    original formats and fail closed.
 *
 * This avoids the incident where restoring an incompatible legacy format after
 * a successful typed write re-coerced both string and date cells.
 */
var PRH_MIG010_TYPED_WRITE = Object.freeze({
  SCHEMA: 'MIG010_TYPED_STAGING_WRITE_V2',
  TEXT_NUMBER_FORMAT: '@',
  DATE_TIME_NUMBER_FORMAT: 'dd.MM.yyyy HH:mm:ss'
});

function prhMig010RowsExact_(encodedRows, range) {
  return prhMig010HashEncodedRows_(encodedRows) === prhMig010HashRange_(range);
}

function prhMig010AdaptiveFormats_(encodedRows, actualRows, originalFormats) {
  if (!Array.isArray(encodedRows) || !Array.isArray(actualRows) ||
      !Array.isArray(originalFormats) || encodedRows.length !== actualRows.length ||
      encodedRows.length !== originalFormats.length) {
    prhMig010Fail_('MIG010_EXECUTION_TYPED_FORMAT_MATRIX_INVALID');
  }

  var repaired = false;
  var formats = encodedRows.map(function (row, r) {
    if (!Array.isArray(row) || !Array.isArray(actualRows[r]) ||
        !Array.isArray(originalFormats[r]) || row.length !== actualRows[r].length ||
        row.length !== originalFormats[r].length) {
      prhMig010Fail_('MIG010_EXECUTION_TYPED_FORMAT_MATRIX_INVALID');
    }

    return row.map(function (cell, c) {
      var expected = prhMig010NormalizedEncodedCell_(cell);
      var actual = actualRows[r][c] || {};
      if (prhMig010StableStringify_(expected) === prhMig010StableStringify_(actual)) {
        return originalFormats[r][c];
      }

      if (!expected.f && expected.t === 's' && !actual.f && actual.t !== 's') {
        repaired = true;
        return PRH_MIG010_TYPED_WRITE.TEXT_NUMBER_FORMAT;
      }
      if (!expected.f && expected.t === 'd' && !actual.f && actual.t !== 'd') {
        repaired = true;
        return PRH_MIG010_TYPED_WRITE.DATE_TIME_NUMBER_FORMAT;
      }

      prhMig010Fail_('MIG010_EXECUTION_TYPE_REPAIR_UNSUPPORTED');
    });
  });

  if (!repaired) prhMig010Fail_('MIG010_EXECUTION_TYPE_REPAIR_NOT_APPLICABLE');
  return formats;
}

function prhMig010RestoreFailedTypedWrite_(range, originalFormats) {
  try {
    range.clearContent();
    SpreadsheetApp.flush();
    range.setNumberFormats(originalFormats);
    SpreadsheetApp.flush();
  } catch (_) {
    prhMig010Fail_('MIG010_EXECUTION_TYPED_WRITE_CLEANUP_FAILED');
  }
  var restored = range.getNumberFormats();
  if (prhMig010StableStringify_(restored) !== prhMig010StableStringify_(originalFormats)) {
    prhMig010Fail_('MIG010_EXECUTION_TYPED_FORMAT_RESTORE_FAILED');
  }
  return true;
}

/**
 * Writes one range while preserving explicit package types. On success the
 * range contains exact package cells. Existing formats remain unchanged unless
 * a concrete coercion required a minimal compatible format on that cell.
 */
function prhMig010SetTypedValues_(range, encodedRows, matrix) {
  if (!range || typeof range.getNumberFormats !== 'function' ||
      typeof range.setNumberFormats !== 'function') {
    prhMig010Fail_('MIG010_EXECUTION_TYPED_FORMAT_API_UNAVAILABLE');
  }

  var originalFormats = range.getNumberFormats();
  try {
    range.setValues(matrix);
    SpreadsheetApp.flush();
    if (prhMig010RowsExact_(encodedRows, range)) {
      return {
        adaptiveRepairApplied: false,
        originalFormats: originalFormats
      };
    }

    var actualRows = prhMig010EncodeRange_(range);
    var repairedFormats = prhMig010AdaptiveFormats_(encodedRows, actualRows, originalFormats);

    range.clearContent();
    SpreadsheetApp.flush();
    range.setNumberFormats(repairedFormats);
    SpreadsheetApp.flush();
    range.setValues(matrix);
    SpreadsheetApp.flush();

    if (!prhMig010RowsExact_(encodedRows, range)) {
      prhMig010RestoreFailedTypedWrite_(range, originalFormats);
      prhMig010Fail_('MIG010_EXECUTION_BATCH_READBACK_MISMATCH');
    }

    return {
      adaptiveRepairApplied: true,
      originalFormats: originalFormats
    };
  } catch (error) {
    if (!prhMig010RowsExact_(encodedRows, range)) {
      try { prhMig010RestoreFailedTypedWrite_(range, originalFormats); } catch (_) { /* bounded failure below */ }
    }
    throw error;
  }
}

/**
 * Same exact-bound/idempotent contract as prhMig010WriteAuthorizedBatch, with
 * adaptive exact-type preservation before the existing cryptographic readback.
 */
function prhMig010WriteAuthorizedBatchTyped(request) {
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
    if (!Number.isInteger(batchIndex) || batchIndex < 0 ||
        !Number.isInteger(startSheetRow) || startSheetRow < 2 ||
        !prhMig010Hex64_(input.batch_hash) || !Array.isArray(input.rows)) {
      prhMig010Fail_('MIG010_EXECUTION_BATCH_REQUEST_INVALID');
    }

    if (batchIndex < session.next_batch) {
      if (session.batch_hashes[batchIndex] === input.batch_hash) {
        return {
          schema: 'MIG010_EXECUTION_BATCH_RESULT_V1',
          status: 'ALREADY_APPLIED',
          batchIndex: batchIndex,
          writeAuthorized: true
        };
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
    if (prhMig010TableHash_(target.sheet) !== session.current_raw_table_hash) {
      prhMig010Fail_('MIG010_EXECUTION_LIVE_TARGET_DRIFT');
    }
    var stage = target.spreadsheet.getSheetByName(session.staging_sheet);
    if (!stage) prhMig010Fail_('MIG010_EXECUTION_STAGING_SHEET_MISSING');

    var matrix = prhMig010DecodeRowsForWrite_(input.rows, startSheetRow);
    var range = stage.getRange(
      startSheetRow,
      1,
      matrix.length,
      PRH_MIG010_EXECUTION.COLUMN_COUNT
    );

    var writeResult = prhMig010SetTypedValues_(range, input.rows, matrix);
    if (prhMig010HashRange_(range) !== input.batch_hash) {
      prhMig010RestoreFailedTypedWrite_(range, writeResult.originalFormats);
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
      adaptiveTypeRepairApplied: writeResult.adaptiveRepairApplied === true,
      writeAuthorized: true,
      financialPayload: false
    };
  } finally {
    lock.releaseLock();
  }
}

function prhMig010TypedWriteCapability() {
  return {
    schema: PRH_MIG010_TYPED_WRITE.SCHEMA,
    adaptiveExistingFormatFirst: true,
    explicitStringTypePreservation: true,
    explicitDateTypePreservation: true,
    minimalCompatibleFormatRepair: true,
    incompatibleFormatsNotRestoredAfterSuccess: true,
    originalFormatsRestoredAfterFailedWrite: true,
    exactReadbackStillRequired: true,
    genericRepositoryWriteAuthorized: false
  };
}
