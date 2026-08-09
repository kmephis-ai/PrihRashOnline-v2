'use strict';

/**
 * MIG-010 exact-type staging writer.
 *
 * Google Sheets can coerce a JavaScript string to another cell type when
 * Range.setValues() writes into a non-text formatted cell. The execution
 * package already carries explicit t:s/t:n/t:d/t:b/formula types, therefore
 * staging must preserve those types exactly instead of accepting Sheets
 * inference. This helper temporarily applies text number format only to t:s
 * cells, performs setValues(), restores the previous formats, and leaves the
 * existing cryptographic readback as the final authority.
 */
var PRH_MIG010_TYPED_WRITE = Object.freeze({
  SCHEMA: 'MIG010_TYPED_STAGING_WRITE_V1',
  TEXT_NUMBER_FORMAT: '@'
});

function prhMig010TypedFormats_(encodedRows, originalFormats) {
  if (!Array.isArray(encodedRows) || !Array.isArray(originalFormats) ||
      encodedRows.length !== originalFormats.length) {
    prhMig010Fail_('MIG010_EXECUTION_TYPED_FORMAT_MATRIX_INVALID');
  }
  return encodedRows.map(function (row, r) {
    if (!Array.isArray(row) || !Array.isArray(originalFormats[r]) ||
        row.length !== originalFormats[r].length) {
      prhMig010Fail_('MIG010_EXECUTION_TYPED_FORMAT_MATRIX_INVALID');
    }
    return row.map(function (cell, c) {
      var normalized = prhMig010NormalizedEncodedCell_(cell);
      if (!normalized.f && normalized.t === 's') {
        return PRH_MIG010_TYPED_WRITE.TEXT_NUMBER_FORMAT;
      }
      return originalFormats[r][c];
    });
  });
}

function prhMig010SetTypedValues_(range, encodedRows, matrix) {
  if (!range || typeof range.getNumberFormats !== 'function' ||
      typeof range.setNumberFormats !== 'function') {
    prhMig010Fail_('MIG010_EXECUTION_TYPED_FORMAT_API_UNAVAILABLE');
  }
  var originalFormats = range.getNumberFormats();
  var typedFormats = prhMig010TypedFormats_(encodedRows, originalFormats);
  range.setNumberFormats(typedFormats);
  try {
    range.setValues(matrix);
    SpreadsheetApp.flush();
  } finally {
    range.setNumberFormats(originalFormats);
    SpreadsheetApp.flush();
  }
  var restored = range.getNumberFormats();
  if (prhMig010StableStringify_(restored) !== prhMig010StableStringify_(originalFormats)) {
    prhMig010Fail_('MIG010_EXECUTION_TYPED_FORMAT_RESTORE_FAILED');
  }
  return true;
}

/**
 * Same exact-bound/idempotent contract as prhMig010WriteAuthorizedBatch, but
 * with explicit string-type preservation before the existing readback hash.
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

    prhMig010SetTypedValues_(range, input.rows, matrix);
    if (prhMig010HashRange_(range) !== input.batch_hash) {
      range.clearContent();
      SpreadsheetApp.flush();
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
      typedStringPreservation: true,
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
    explicitStringTypePreservation: true,
    temporaryTextFormatOnly: true,
    originalFormatsRestored: true,
    exactReadbackStillRequired: true,
    genericRepositoryWriteAuthorized: false
  };
}
