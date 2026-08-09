'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  TOOL_SCHEMA,
  REMOTE_SCHEMA,
  FUNCTION_NAME,
  boundedExecutionReason,
  normalizeDiagnostic
} = require('../tools/mig010-inspect');

const appsSource = fs.readFileSync(path.join(__dirname, '..', 'Mig010ExecutionDiagnostics.js'), 'utf8');
const toolSource = fs.readFileSync(path.join(__dirname, '..', 'tools', 'mig010-inspect.js'), 'utf8');

assert.strictEqual(FUNCTION_NAME, 'prhMig010InspectAuthorizedExecution');
assert(appsSource.includes('function prhMig010InspectAuthorizedExecution(request)'));
assert(appsSource.includes("status: 'NO_SESSION'"));
assert(appsSource.includes("status: 'SESSION_FOUND'"));
assert(appsSource.includes('liveTargetState'));
assert(appsSource.includes('stagingMatchesFinal'));
assert(appsSource.includes('rollbackMatchesInitial'));
assert(appsSource.includes('financialPayloadStdout: false'));
assert(appsSource.includes('writeAuthorized: false'));
assert(!appsSource.includes('sessionId: sessionId'), 'diagnostic stdout must not expose private session id');
assert(!appsSource.includes('finalRawTableHash:'), 'diagnostic stdout must not expose private hashes');
assert(!appsSource.includes('currentRawTableHash:'), 'diagnostic stdout must not expose private hashes');

const noSession = normalizeDiagnostic({
  schema: REMOTE_SCHEMA,
  status: 'NO_SESSION',
  sessionStatus: '',
  nextBatch: 0,
  batchCount: 0,
  liveTargetState: 'INITIAL',
  stagingPresent: false,
  rollbackPresent: false,
  stagingMatchesFinal: false,
  rollbackMatchesInitial: false,
  failureReason: '',
  financialPayloadStdout: false,
  writeAuthorized: false
});
assert.strictEqual(noSession.schema, TOOL_SCHEMA);
assert.strictEqual(noSession.status, 'NO_SESSION');
assert.strictEqual(noSession.liveTargetState, 'INITIAL');
assert.strictEqual(noSession.writeAuthorized, false);

const partial = normalizeDiagnostic({
  schema: REMOTE_SCHEMA,
  status: 'SESSION_FOUND',
  sessionStatus: 'STAGING',
  nextBatch: 3,
  batchCount: 10,
  liveTargetState: 'INITIAL',
  stagingPresent: true,
  rollbackPresent: true,
  stagingMatchesFinal: false,
  rollbackMatchesInitial: true,
  failureReason: '',
  financialPayloadStdout: false,
  writeAuthorized: false
});
assert.strictEqual(partial.status, 'SESSION_FOUND');
assert.strictEqual(partial.nextBatch, 3);
assert.strictEqual(partial.batchCount, 10);
assert.strictEqual(partial.rollbackMatchesInitial, true);
assert.strictEqual(partial.writeAuthorized, false);

const rolledBack = normalizeDiagnostic({
  schema: REMOTE_SCHEMA,
  status: 'SESSION_FOUND',
  sessionStatus: 'ROLLED_BACK_AFTER_FAILURE',
  nextBatch: 10,
  batchCount: 10,
  liveTargetState: 'INITIAL',
  stagingPresent: true,
  rollbackPresent: true,
  stagingMatchesFinal: true,
  rollbackMatchesInitial: true,
  failureReason: 'MIG010_EXECUTION_FINAL_HASH_MISMATCH',
  financialPayloadStdout: false,
  writeAuthorized: false
});
assert.strictEqual(rolledBack.failureReason, 'MIG010_EXECUTION_FINAL_HASH_MISMATCH');
assert.strictEqual(rolledBack.liveTargetState, 'INITIAL');

assert.throws(
  () => normalizeDiagnostic({ ...partial, liveTargetState: 'PRIVATE_VALUE' }),
  /MIG010_INSPECT_REMOTE_STATE_INVALID/
);
assert.throws(
  () => normalizeDiagnostic({ ...partial, nextBatch: 11, batchCount: 10 }),
  /MIG010_INSPECT_REMOTE_PROGRESS_INVALID/
);
assert.throws(
  () => normalizeDiagnostic({ ...partial, failureReason: 'private row content' }),
  /MIG010_INSPECT_REMOTE_REASON_INVALID/
);

const remoteFailure = {
  error: {
    code: 3,
    message: 'ScriptError',
    details: [{
      '@type': 'type.googleapis.com/google.apps.script.v1.ExecutionError',
      errorMessage: 'Error: MIG010_EXECUTION_BATCH_READBACK_MISMATCH',
      errorType: 'ScriptError',
      scriptStackTraceElements: [{ function: 'prhMig010Fail_', lineNumber: 28 }]
    }]
  }
};
assert.strictEqual(
  boundedExecutionReason(remoteFailure, JSON.stringify(remoteFailure)),
  'MIG010_EXECUTION_BATCH_READBACK_MISMATCH'
);

assert(toolSource.includes('devMode: false'), 'diagnostic must inspect immutable deployed code');
assert(toolSource.includes('assertAuthorization(auth, request, pkg, nowMs)'), 'diagnostic must preserve exact owner authorization binding');
assert(toolSource.includes('financialPayloadStdout: false'));
assert(toolSource.includes('writeAuthorized: false'));
assert(!/process\.stdout\.write\([^\n]*(accessToken|clientSecret|refreshToken|session_id|rows)/.test(toolSource));

console.log('mig010_execution_diagnostics_contract_test: OK', {
  readOnly: true,
  exactAuthorizationBinding: true,
  boundedMigrationReasons: true,
  liveStateOnly: true,
  progressOnly: true,
  financialPayloadStdout: false,
  writeAuthorized: false
});
