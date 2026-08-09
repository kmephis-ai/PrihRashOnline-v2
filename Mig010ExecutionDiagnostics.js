'use strict';

/**
 * MIG-010 read-only execution diagnostics.
 *
 * This file deliberately exposes no financial payload, row content, session id,
 * sheet names, hashes, OAuth material or deployment identifiers. It only reports
 * bounded technical state for an already owner-authorized MIG-010 session.
 */
var PRH_MIG010_DIAGNOSTIC = Object.freeze({
  SCHEMA: 'MIG010_EXECUTION_DIAGNOSTIC_V1'
});

function prhMig010DiagnosticFailureCode_(value) {
  var match = String(value || '').match(/MIG010_EXECUTION_[A-Z0-9_]+/);
  return match ? match[0] : '';
}

function prhMig010DiagnosticLiveState_(hash, input) {
  if (hash === input.current_raw_table_hash) return 'INITIAL';
  if (hash === input.final_raw_table_hash) return 'FINAL';
  return 'DRIFT';
}

/**
 * Read-only inspection for a previously authorized execution.
 * Returns JSON text so the generic Execution API transport can keep its
 * string-only public result contract.
 */
function prhMig010InspectAuthorizedExecution(request) {
  var input = prhMig010AssertAuthorization_(request || {});
  var sessionId = prhMig010SessionId_(input.session_id);
  var target = prhMig010TargetSheet_();
  var liveHash = prhMig010TableHash_(target.sheet);
  var raw = PropertiesService.getScriptProperties().getProperty(prhMig010SessionKey_(sessionId));

  if (!raw) {
    return JSON.stringify({
      schema: PRH_MIG010_DIAGNOSTIC.SCHEMA,
      status: 'NO_SESSION',
      sessionStatus: '',
      nextBatch: 0,
      batchCount: 0,
      liveTargetState: prhMig010DiagnosticLiveState_(liveHash, input),
      stagingPresent: false,
      rollbackPresent: false,
      stagingMatchesFinal: false,
      rollbackMatchesInitial: false,
      failureReason: '',
      financialPayloadStdout: false,
      writeAuthorized: false
    });
  }

  var session;
  try {
    session = JSON.parse(raw);
  } catch (error) {
    prhMig010Fail_('MIG010_EXECUTION_SESSION_INVALID');
  }
  if (!session || session.schema !== 'MIG010_EXECUTION_SESSION_V1') {
    prhMig010Fail_('MIG010_EXECUTION_SESSION_INVALID');
  }
  prhMig010AssertSessionRequest_(input, session);

  var stage = target.spreadsheet.getSheetByName(session.staging_sheet);
  var rollback = target.spreadsheet.getSheetByName(session.rollback_sheet);
  var stageMatchesFinal = false;
  var rollbackMatchesInitial = false;

  if (stage) {
    stageMatchesFinal = prhMig010TableHash_(stage) === session.final_raw_table_hash;
  }
  if (rollback) {
    rollbackMatchesInitial = prhMig010TableHash_(rollback) === session.current_raw_table_hash;
  }

  return JSON.stringify({
    schema: PRH_MIG010_DIAGNOSTIC.SCHEMA,
    status: 'SESSION_FOUND',
    sessionStatus: String(session.status || ''),
    nextBatch: Number(session.next_batch || 0),
    batchCount: Number(session.batch_count || 0),
    liveTargetState: prhMig010DiagnosticLiveState_(liveHash, input),
    stagingPresent: Boolean(stage),
    rollbackPresent: Boolean(rollback),
    stagingMatchesFinal: stageMatchesFinal,
    rollbackMatchesInitial: rollbackMatchesInitial,
    failureReason: prhMig010DiagnosticFailureCode_(session.failure_reason),
    financialPayloadStdout: false,
    writeAuthorized: false
  });
}
