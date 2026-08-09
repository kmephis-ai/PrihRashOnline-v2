'use strict';

/**
 * MIG-010 staging-only readback diagnostic.
 *
 * The probe writes only the already-authorized next batch into the hidden
 * staging sheet, never mutates the live target, restores the staging range
 * after the probe, and exposes only bounded mismatch classes/booleans.
 */
var PRH_MIG010_READBACK_PROBE = Object.freeze({
  SCHEMA: 'MIG010_EXECUTION_READBACK_PROBE_V1',
  MISMATCH_CLASSES: Object.freeze([
    'FORMULA_LOST',
    'FORMULA_NORMALIZED',
    'STRING_COERCED_TO_FORMULA',
    'STRING_TYPE_COERCION',
    'STRING_VALUE_NORMALIZED',
    'NUMBER_TYPE_COERCION',
    'NUMBER_VALUE_CHANGED',
    'DATE_TYPE_COERCION',
    'DATE_VALUE_SHIFT',
    'BOOLEAN_TYPE_COERCION',
    'BOOLEAN_VALUE_CHANGED',
    'CELL_ENCODING_MISMATCH'
  ])
});

function prhMig010ProbeCellClass_(expectedCell, actualCell) {
  var expected = prhMig010NormalizedEncodedCell_(expectedCell);
  var actual = actualCell || {};
  if (prhMig010StableStringify_(expected) === prhMig010StableStringify_(actual)) return '';

  if (expected.f) {
    if (!actual.f) return 'FORMULA_LOST';
    return 'FORMULA_NORMALIZED';
  }
  if (expected.t === 's') {
    if (actual.f) return 'STRING_COERCED_TO_FORMULA';
    if (actual.t !== 's') return 'STRING_TYPE_COERCION';
    return 'STRING_VALUE_NORMALIZED';
  }
  if (expected.t === 'n') {
    if (actual.t !== 'n') return 'NUMBER_TYPE_COERCION';
    return 'NUMBER_VALUE_CHANGED';
  }
  if (expected.t === 'd') {
    if (actual.t !== 'd') return 'DATE_TYPE_COERCION';
    return 'DATE_VALUE_SHIFT';
  }
  if (expected.t === 'b') {
    if (actual.t !== 'b') return 'BOOLEAN_TYPE_COERCION';
    return 'BOOLEAN_VALUE_CHANGED';
  }
  return 'CELL_ENCODING_MISMATCH';
}

function prhMig010ProbeMismatchClasses_(expectedRows, actualRows) {
  var seen = {};
  if (!Array.isArray(expectedRows) || !Array.isArray(actualRows) || expectedRows.length !== actualRows.length) {
    return ['CELL_ENCODING_MISMATCH'];
  }
  expectedRows.forEach(function (row, r) {
    if (!Array.isArray(row) || !Array.isArray(actualRows[r]) || row.length !== actualRows[r].length) {
      seen.CELL_ENCODING_MISMATCH = true;
      return;
    }
    row.forEach(function (cell, c) {
      var mismatch = prhMig010ProbeCellClass_(cell, actualRows[r][c]);
      if (mismatch) seen[mismatch] = true;
    });
  });
  return Object.keys(seen).sort();
}

function prhMig010ProbeRangeCleared_(range) {
  var values = range.getValues();
  var formulas = range.getFormulas();
  for (var r = 0; r < values.length; r += 1) {
    for (var c = 0; c < values[r].length; c += 1) {
      if (String(formulas[r][c] || '') || String(values[r][c] == null ? '' : values[r][c])) return false;
    }
  }
  return true;
}

/**
 * Exercise the exact production adaptive writer without advancing session.
 * The production helper may keep a minimal compatible format on cells that
 * would otherwise be coerced. For the probe, content is cleared first and the
 * original number formats are restored only after content is gone, so the
 * diagnostic leaves staging exactly as it found it.
 */
function prhMig010ProbeAdaptiveWrite_(range, encodedRows, matrix) {
  var originalFormats = range.getNumberFormats();
  var writeResult;
  var classes = [];
  try {
    writeResult = prhMig010SetTypedValues_(range, encodedRows, matrix);
    SpreadsheetApp.flush();
    classes = prhMig010ProbeMismatchClasses_(encodedRows, prhMig010EncodeRange_(range));
  } finally {
    range.clearContent();
    SpreadsheetApp.flush();
    range.setNumberFormats(originalFormats);
    SpreadsheetApp.flush();
  }
  return {
    adaptiveFormatReadback: classes,
    adaptiveRepairApplied: Boolean(writeResult && writeResult.adaptiveRepairApplied)
  };
}

function prhMig010ProbeAuthorizedBatchReadback(request) {
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
    if (!Number.isInteger(batchIndex) || batchIndex !== session.next_batch ||
        !Number.isInteger(startSheetRow) || startSheetRow !== session.next_sheet_row ||
        !prhMig010Hex64_(input.batch_hash) || !Array.isArray(input.rows)) {
      prhMig010Fail_('MIG010_EXECUTION_PROBE_REQUEST_INVALID');
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
    var range = stage.getRange(startSheetRow, 1, matrix.length, PRH_MIG010_EXECUTION.COLUMN_COUNT);
    range.clearContent();
    SpreadsheetApp.flush();
    var diagnostic = prhMig010ProbeAdaptiveWrite_(range, input.rows, matrix);

    if (!prhMig010ProbeRangeCleared_(range)) {
      prhMig010Fail_('MIG010_EXECUTION_PROBE_RANGE_CLEAR_FAILED');
    }
    if (prhMig010TableHash_(target.sheet) !== session.current_raw_table_hash) {
      prhMig010Fail_('MIG010_EXECUTION_LIVE_TARGET_DRIFT');
    }

    return JSON.stringify({
      schema: PRH_MIG010_READBACK_PROBE.SCHEMA,
      status: diagnostic.adaptiveFormatReadback.length ? 'MISMATCH_CLASSIFIED' : 'MATCHED',
      mismatchClasses: diagnostic.adaptiveFormatReadback,
      adaptiveFormatReadback: diagnostic.adaptiveFormatReadback,
      adaptiveRepairApplied: diagnostic.adaptiveRepairApplied,
      rangeCleared: true,
      originalFormatsRestoredAfterClear: true,
      liveTargetMutated: false,
      financialPayloadStdout: false
    });
  } finally {
    lock.releaseLock();
  }
}
