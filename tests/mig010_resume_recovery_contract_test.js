'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  createAuthorizationRequest
} = require('../tools/mig010-authorized-executor');
const {
  TOOL_SCHEMA,
  FUNCTIONS,
  boundedExecutionReason,
  resumeAuthorizedPackage
} = require('../tools/mig010-resume');

const resumeSource = fs.readFileSync(path.join(__dirname, '..', 'Mig010ExecutionResume.js'), 'utf8');
const toolSource = fs.readFileSync(path.join(__dirname, '..', 'tools', 'mig010-resume.js'), 'utf8');

assert(resumeSource.includes('function prhMig010ResumeAuthorizedExecution(request)'));
assert(resumeSource.includes("status: 'STAGING_RESUMABLE'"));
assert(resumeSource.includes("session.status !== 'STAGING'"));
assert(resumeSource.includes('prhMig010AssertSessionRequest_(input, session)'));
assert(resumeSource.includes('prhMig010TableHash_(target.sheet) !== session.current_raw_table_hash'));
assert(resumeSource.includes('prhMig010TableHash_(rollback) !== session.current_raw_table_hash'));
assert(!resumeSource.includes('.setValues('), 'resume preflight must not write cells');
assert(!resumeSource.includes('.clearContent('), 'resume preflight must not clear cells');
assert(!resumeSource.includes('.copyTo('), 'resume preflight must not copy sheets/ranges');
assert(!resumeSource.includes('prhMig010WriteSession_('), 'resume preflight must not advance session state');

function pkg() {
  return {
    schema: 'MIG010_OWNER_EXECUTION_PACKAGE_V1',
    policy_schema: 'MIG010_EXECUTION_POLICY_V1',
    policy_version: '1.0.0',
    strategy: 'STAGE_VERIFY_REPLACE_WITH_ROLLBACK_V1',
    package_hash: '1'.repeat(64),
    resolved_hash: '2'.repeat(64),
    proposal_hash: '3'.repeat(64),
    source_revision_hash: '4'.repeat(64),
    candidate_revision_hash: '5'.repeat(64),
    initial_target_revision_hash: '6'.repeat(64),
    backup_cipher_sha256: '7'.repeat(64),
    current_raw_table_hash: '8'.repeat(64),
    final_raw_table_hash: '9'.repeat(64),
    target_header_hash: 'a'.repeat(64),
    target_sheet_name: 'SYN-TARGET',
    header: [],
    batches: [
      { batch_index: 0, start_sheet_row: 2, batch_hash: 'b'.repeat(64), rows: [[{ t: 's', v: 'SYN-0' }]] },
      { batch_index: 1, start_sheet_row: 3, batch_hash: 'c'.repeat(64), rows: [[{ t: 's', v: 'SYN-1' }]] },
      { batch_index: 2, start_sheet_row: 4, batch_hash: 'd'.repeat(64), rows: [[{ t: 's', v: 'SYN-2' }]] }
    ],
    write_authorized: false
  };
}

const packageValue = pkg();
const now = new Date('2026-08-09T12:00:00.000Z');
const request = createAuthorizationRequest(
  packageValue,
  packageValue.backup_cipher_sha256,
  '2026-08-09T10:00:00.000Z',
  now
);
const authorization = {
  schema: 'MIG010_OWNER_IRREVERSIBLE_AUTHORIZATION_V1',
  authorization: 'IRREVERSIBLE_ACTION_AUTHORIZED',
  request_hash: request.request_hash,
  session_id: request.session_id,
  package_hash: request.package_hash,
  resolved_hash: request.resolved_hash,
  candidate_revision_hash: request.candidate_revision_hash,
  backup_cipher_sha256: request.backup_cipher_sha256,
  current_raw_table_hash: request.current_raw_table_hash,
  final_raw_table_hash: request.final_raw_table_hash,
  target_header_hash: request.target_header_hash,
  backup_created_at: request.backup_created_at,
  backup_verified_at: request.backup_verified_at,
  write_authorized: true
};

function response(status, json) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(json); }
  };
}

const called = [];
async function fakeFetch(url, options) {
  if (url === 'https://oauth2.googleapis.com/token') {
    return response(200, { access_token: 'SYNTHETIC_ACCESS_TOKEN' });
  }
  const body = JSON.parse(options.body);
  called.push({ function: body.function, parameter: body.parameters[0] });
  let result;
  if (body.function === FUNCTIONS.resume) {
    result = {
      schema: 'MIG010_EXECUTION_RESUME_RESULT_V1',
      status: 'STAGING_RESUMABLE',
      nextBatch: 1,
      batchCount: 3,
      liveTargetState: 'INITIAL',
      stagingPresent: true,
      rollbackPresent: true,
      rollbackMatchesInitial: true,
      writeAuthorized: false,
      financialPayload: false
    };
  } else if (body.function === FUNCTIONS.batch) {
    result = {
      schema: 'MIG010_EXECUTION_BATCH_RESULT_V1',
      status: 'BATCH_STAGED',
      batchIndex: body.parameters[0].batch_index,
      writeAuthorized: true
    };
  } else if (body.function === FUNCTIONS.finalize) {
    result = {
      schema: 'MIG010_EXECUTION_FINALIZE_RESULT_V1',
      status: 'FINALIZED_PENDING_RECONCILIATION',
      finalRawTableHash: packageValue.final_raw_table_hash,
      rollbackAvailable: true,
      writeAuthorized: true
    };
  } else {
    throw new Error('UNEXPECTED_FUNCTION');
  }
  return response(200, { done: true, response: { result } });
}

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

(async () => {
  const result = await resumeAuthorizedPackage({
    pkg: packageValue,
    request,
    auth: authorization,
    deploymentId: 'AKfySYNTHETIC_DEPLOYMENT_ID_123456',
    oauthProfile: { clientId: 'client', clientSecret: 'secret', refreshToken: 'refresh' },
    fetchImpl: fakeFetch,
    nowMs: now.getTime()
  });

  assert.strictEqual(result.schema, TOOL_SCHEMA);
  assert.strictEqual(result.status, 'FINALIZED_PENDING_RECONCILIATION');
  assert.strictEqual(result.rollbackAvailable, true);
  assert.strictEqual(result.financialPayloadStdout, false);
  assert.strictEqual(result.writeAuthorized, true);
  assert.deepStrictEqual(called.map((item) => item.function), [
    FUNCTIONS.resume,
    FUNCTIONS.batch,
    FUNCTIONS.batch,
    FUNCTIONS.finalize
  ]);
  assert.deepStrictEqual(
    called.filter((item) => item.function === FUNCTIONS.batch).map((item) => item.parameter.batch_index),
    [1, 2],
    'resume must continue from server nextBatch and must not replay completed batch zero'
  );
  assert(called.every((item) => item.parameter.authorization === 'IRREVERSIBLE_ACTION_AUTHORIZED'));
  assert(called.every((item) => item.parameter.package_hash === packageValue.package_hash));
  assert(toolSource.includes('devMode: false'));
  assert(toolSource.includes('/MIG010_EXECUTION_[A-Z0-9_]+/'));
  assert(!/process\.stdout\.write\([^\n]*(rows|accessToken|clientSecret|refreshToken)/.test(toolSource));

  console.log('mig010_resume_recovery_contract_test: OK', {
    existingSessionOnly: true,
    livePreflightReadOnly: true,
    serverProgressAuthoritative: true,
    completedBatchesSkipped: true,
    boundedMigrationReason: true,
    finalizePendingReconciliation: true,
    financialPayloadStdout: false
  });
})().catch((error) => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
