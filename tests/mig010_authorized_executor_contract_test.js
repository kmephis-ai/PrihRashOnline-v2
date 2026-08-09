'use strict';

const assert = require('assert');
const {
  AUTH_REQUEST_SCHEMA,
  AUTH_SCHEMA,
  AUTH_LITERAL,
  MAX_BACKUP_AGE_MS,
  ALLOWED_FUNCTIONS,
  createAuthorizationRequest,
  assertAuthorization,
  executeAuthorizedPackage,
  rollbackAuthorizedPackage,
  commandContract
} = require('../tools/mig010-authorized-executor');

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
      { batch_index: 0, start_sheet_row: 2, batch_hash: 'b'.repeat(64), rows: [[{ t: 's', v: 'SYN' }]] },
      { batch_index: 1, start_sheet_row: 3, batch_hash: 'c'.repeat(64), rows: [[{ t: 's', v: 'SYN2' }]] }
    ],
    write_authorized: false
  };
}

const packageValue = pkg();
const now = new Date('2026-08-09T12:00:00.000Z');
const request = createAuthorizationRequest(packageValue, packageValue.backup_cipher_sha256, now);
assert.strictEqual(request.schema, AUTH_REQUEST_SCHEMA);
assert.strictEqual(request.authorization_required, AUTH_LITERAL);
assert.strictEqual(request.write_authorized, false);
assert(/^[0-9a-f]{64}$/.test(request.request_hash));

const authorization = {
  schema: AUTH_SCHEMA,
  authorization: AUTH_LITERAL,
  request_hash: request.request_hash,
  session_id: request.session_id,
  package_hash: request.package_hash,
  resolved_hash: request.resolved_hash,
  candidate_revision_hash: request.candidate_revision_hash,
  backup_cipher_sha256: request.backup_cipher_sha256,
  current_raw_table_hash: request.current_raw_table_hash,
  final_raw_table_hash: request.final_raw_table_hash,
  target_header_hash: request.target_header_hash,
  backup_verified_at: request.backup_verified_at,
  write_authorized: true
};
assert.strictEqual(assertAuthorization(authorization, request, packageValue, now.getTime()), authorization);

assert.throws(
  () => assertAuthorization({ ...authorization, authorization: 'NO' }, request, packageValue, now.getTime()),
  /MIG010_EXECUTOR_IRREVERSIBLE_ACTION_NOT_AUTHORIZED/
);
assert.throws(
  () => assertAuthorization({ ...authorization, package_hash: 'f'.repeat(64) }, request, packageValue, now.getTime()),
  /MIG010_EXECUTOR_AUTH_BINDING_MISMATCH/
);
assert.throws(
  () => assertAuthorization(authorization, { ...request, request_hash: '0'.repeat(64) }, packageValue, now.getTime()),
  /MIG010_EXECUTOR_AUTH_REQUEST_INVALID/
);
assert.throws(
  () => assertAuthorization(authorization, request, packageValue, now.getTime() + MAX_BACKUP_AGE_MS + 1),
  /MIG010_EXECUTOR_BACKUP_STALE/
);

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
  if (body.function === ALLOWED_FUNCTIONS.begin) {
    result = { schema: 'MIG010_EXECUTION_BEGIN_RESULT_V1', status: 'STAGING_READY', writeAuthorized: true };
  } else if (body.function === ALLOWED_FUNCTIONS.batch) {
    result = { schema: 'MIG010_EXECUTION_BATCH_RESULT_V1', status: 'BATCH_STAGED', batchIndex: body.parameters[0].batch_index };
  } else if (body.function === ALLOWED_FUNCTIONS.finalize) {
    result = {
      schema: 'MIG010_EXECUTION_FINALIZE_RESULT_V1',
      status: 'FINALIZED_PENDING_RECONCILIATION',
      finalRawTableHash: packageValue.final_raw_table_hash,
      rollbackAvailable: true,
      writeAuthorized: true
    };
  } else if (body.function === ALLOWED_FUNCTIONS.rollback) {
    result = { schema: 'MIG010_EXECUTION_ROLLBACK_RESULT_V1', status: 'ROLLED_BACK', writeAuthorized: true };
  } else {
    throw new Error('UNEXPECTED_FUNCTION');
  }
  return response(200, { done: true, response: { result } });
}

(async () => {
  const common = {
    pkg: packageValue,
    request,
    auth: authorization,
    deploymentId: 'AKfySYNTHETIC_DEPLOYMENT_ID_123456',
    oauthProfile: { clientId: 'client', clientSecret: 'secret', refreshToken: 'refresh' },
    fetchImpl: fakeFetch,
    nowMs: now.getTime()
  };
  const executed = await executeAuthorizedPackage(common);
  assert.strictEqual(executed.status, 'FINALIZED_PENDING_RECONCILIATION');
  assert.strictEqual(executed.rollbackAvailable, true);
  assert.strictEqual(executed.financialPayloadStdout, false);
  assert.strictEqual(executed.writeAuthorized, true);
  assert.deepStrictEqual(called.map((item) => item.function), [
    ALLOWED_FUNCTIONS.begin,
    ALLOWED_FUNCTIONS.batch,
    ALLOWED_FUNCTIONS.batch,
    ALLOWED_FUNCTIONS.finalize
  ]);
  assert.strictEqual(called[0].parameter.batch_count, 2);
  assert.strictEqual(called[1].parameter.rows, packageValue.batches[0].rows);
  assert.strictEqual(called[2].parameter.rows, packageValue.batches[1].rows);
  assert(called.every((item) => item.parameter.authorization === AUTH_LITERAL));
  assert(called.every((item) => item.parameter.package_hash === packageValue.package_hash));

  called.length = 0;
  const rolledBack = await rollbackAuthorizedPackage(common);
  assert.strictEqual(rolledBack.status, 'ROLLED_BACK');
  assert.strictEqual(rolledBack.financialPayloadStdout, false);
  assert.deepStrictEqual(called.map((item) => item.function), [ALLOWED_FUNCTIONS.rollback]);

  const contract = commandContract();
  assert.strictEqual(contract.privateAuthorizationRequired, true);
  assert.strictEqual(contract.publicCiCanAuthorize, false);
  assert.strictEqual(contract.finalizePendingReconciliation, true);
  assert.strictEqual(contract.financialPayloadStdout, false);
  assert.strictEqual(contract.authorizationLiteral, AUTH_LITERAL);

  console.log('mig010_authorized_executor_contract_test: OK', {
    exactAuthorizationBinding: true,
    freshBackupRequired: true,
    allowlistedExecutionFunctions: true,
    finalizePendingReconciliation: true,
    rollbackAvailable: true,
    publicCiCanAuthorize: false,
    financialPayloadStdout: false
  });
})().catch((error) => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
