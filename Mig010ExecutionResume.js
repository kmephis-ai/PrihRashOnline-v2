'use strict';

/**
 * Read-only preflight for resuming an already-created MIG-010 staging session.
 *
 * This entry point never creates sheets, writes cells, advances progress or
 * finalizes the live target. It exists so an interrupted owner-authorized
 * staging execution can be resumed without starting a second session.
 */
function prhMig010ResumeAuthorizedExecution(request) {
  var input = prhMig010AssertAuthorization_(request);
  var sessionId = prhMig010SessionId_(input.session_id);
  var batchCount = Number(input.batch_count);
  if (!Number.isInteger(batchCount) || batchCount < 1 || batchCount > 100000) {
    prhMig010Fail_('MIG010_EXECUTION_BATCH_COUNT_INVALID');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var session = prhMig010ReadSession_(sessionId);
    prhMig010AssertSessionRequest_(input, session);

    if (session.status !== 'STAGING') {
      prhMig010Fail_('MIG010_EXECUTION_SESSION_NOT_RESUMABLE');
    }
    if (session.batch_count !== batchCount) {
      prhMig010Fail_('MIG010_EXECUTION_RESUME_BATCH_COUNT_MISMATCH');
    }
    if (!Number.isInteger(session.next_batch) || session.next_batch < 0 || session.next_batch > batchCount ||
        !Number.isInteger(session.next_sheet_row) || session.next_sheet_row < 2 ||
        !Array.isArray(session.batch_hashes) || session.batch_hashes.length < session.next_batch) {
      prhMig010Fail_('MIG010_EXECUTION_RESUME_PROGRESS_INVALID');
    }
    for (var index = 0; index < session.next_batch; index += 1) {
      if (!prhMig010Hex64_(session.batch_hashes[index])) {
        prhMig010Fail_('MIG010_EXECUTION_RESUME_BATCH_HISTORY_INVALID');
      }
    }

    var target = prhMig010TargetSheet_();
    if (prhMig010TableHash_(target.sheet) !== session.current_raw_table_hash) {
      prhMig010Fail_('MIG010_EXECUTION_LIVE_TARGET_DRIFT');
    }
    if (prhMig010HashRange_(target.sheet.getRange(1, 1, 1, PRH_MIG010_EXECUTION.COLUMN_COUNT)) !== session.target_header_hash) {
      prhMig010Fail_('MIG010_EXECUTION_TARGET_HEADER_HASH_MISMATCH');
    }

    var stage = target.spreadsheet.getSheetByName(session.staging_sheet);
    var rollback = target.spreadsheet.getSheetByName(session.rollback_sheet);
    if (!stage || !rollback) {
      prhMig010Fail_('MIG010_EXECUTION_SESSION_SHEET_MISSING');
    }
    if (prhMig010TableHash_(rollback) !== session.current_raw_table_hash) {
      prhMig010Fail_('MIG010_EXECUTION_ROLLBACK_DRIFT');
    }
    if (prhMig010HashRange_(stage.getRange(1, 1, 1, PRH_MIG010_EXECUTION.COLUMN_COUNT)) !== session.target_header_hash) {
      prhMig010Fail_('MIG010_EXECUTION_STAGING_HEADER_DRIFT');
    }

    return {
      schema: 'MIG010_EXECUTION_RESUME_RESULT_V1',
      status: 'STAGING_RESUMABLE',
      nextBatch: session.next_batch,
      batchCount: session.batch_count,
      liveTargetState: 'INITIAL',
      stagingPresent: true,
      rollbackPresent: true,
      rollbackMatchesInitial: true,
      writeAuthorized: false,
      financialPayload: false
    };
  } finally {
    lock.releaseLock();
  }
}
