'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const POLICY = require('../lib/migration/mig010_execution_policy.v1.json');
const { assertOutsideRepository, readBackupKey } = require('./mig010-owner');
const { readEncryptedBackup, canonicalJson, sha256Hex } = require('./private-backup');
const { classifyFailure } = require('./apps-script-api-exec');

const AUTH_REQUEST_SCHEMA = 'MIG010_OWNER_AUTHORIZATION_REQUEST_V1';
const AUTH_SCHEMA = 'MIG010_OWNER_IRREVERSIBLE_AUTHORIZATION_V1';
const PACKAGE_SCHEMA = 'MIG010_OWNER_EXECUTION_PACKAGE_V1';
const TOOL_SCHEMA = 'MIG010_AUTHORIZED_EXECUTOR_TOOL_V1';
const SHA256_RE = /^[0-9a-f]{64}$/;
const SESSION_RE = /^[A-Za-z0-9_-]{12,64}$/;
const AUTH_LITERAL = 'IRREVERSIBLE_ACTION_AUTHORIZED';
const MAX_BACKUP_AGE_MS = 24 * 60 * 60 * 1000;
const ALLOWED_FUNCTIONS = Object.freeze({
  begin: 'prhMig010BeginAuthorizedExecution',
  batch: 'prhMig010WriteAuthorizedBatch',
  finalize: 'prhMig010FinalizeAuthorizedExecution',
  rollback: 'prhMig010RollbackAuthorizedExecution'
});

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function safeReason(error, fallback = 'MIG010_AUTHORIZED_EXECUTOR_FAILED') {
  const value = String(error && (error.code || error.message) || '');
  return /^[A-Z][A-Z0-9_]{2,95}$/.test(value) ? value : fallback;
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      result._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) result[key] = true;
    else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function readPrivateJson(filePath, reason) {
  const resolved = assertOutsideRepository(filePath, 'MIG010_EXECUTOR_PRIVATE_PATH_INSIDE_REPOSITORY');
  try { return JSON.parse(fs.readFileSync(resolved, 'utf8')); } catch (_) { fail(reason); }
}

function writePrivateJson(filePath, value) {
  const resolved = assertOutsideRepository(filePath, 'MIG010_EXECUTOR_PRIVATE_PATH_INSIDE_REPOSITORY');
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'w', mode: 0o600 });
  try { fs.chmodSync(resolved, 0o600); } catch (_) { /* Windows ACL owner-managed. */ }
}

function assertPackage(pkg) {
  if (!pkg || pkg.schema !== PACKAGE_SCHEMA || pkg.policy_schema !== POLICY.schema || pkg.policy_version !== POLICY.version ||
      pkg.strategy !== POLICY.strategy || pkg.write_authorized !== false || !Array.isArray(pkg.batches) || pkg.batches.length < 1) {
    fail('MIG010_EXECUTOR_PACKAGE_INVALID');
  }
  for (const field of [
    'package_hash','resolved_hash','proposal_hash','source_revision_hash','candidate_revision_hash',
    'initial_target_revision_hash','backup_cipher_sha256','current_raw_table_hash','final_raw_table_hash','target_header_hash'
  ]) {
    if (!SHA256_RE.test(String(pkg[field] || ''))) fail('MIG010_EXECUTOR_PACKAGE_BINDING_INVALID');
  }
  pkg.batches.forEach((batch, index) => {
    if (!batch || batch.batch_index !== index || !Number.isInteger(batch.start_sheet_row) || batch.start_sheet_row < 2 ||
        !SHA256_RE.test(String(batch.batch_hash || '')) || !Array.isArray(batch.rows) || batch.rows.length < 1 ||
        batch.rows.length > POLICY.batch.max_rows) {
      fail('MIG010_EXECUTOR_PACKAGE_BATCH_INVALID');
    }
  });
  return pkg;
}

function normalizeFreshTimestamp(value, nowMs, invalidReason, staleReason) {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) fail(invalidReason);
  const age = nowMs - parsed;
  if (age < 0 || age > MAX_BACKUP_AGE_MS) fail(staleReason);
  return new Date(parsed).toISOString();
}

function requestIdentity(pkg, backupCreatedAt, backupVerifiedAt, sessionId) {
  return {
    schema: AUTH_REQUEST_SCHEMA,
    authorization_required: AUTH_LITERAL,
    package_hash: pkg.package_hash,
    resolved_hash: pkg.resolved_hash,
    candidate_revision_hash: pkg.candidate_revision_hash,
    backup_cipher_sha256: pkg.backup_cipher_sha256,
    current_raw_table_hash: pkg.current_raw_table_hash,
    final_raw_table_hash: pkg.final_raw_table_hash,
    target_header_hash: pkg.target_header_hash,
    backup_created_at: backupCreatedAt,
    backup_verified_at: backupVerifiedAt,
    session_id: sessionId,
    write_authorized: false
  };
}

function createAuthorizationRequest(pkg, backupCipherSha256, backupCreatedAt, now = new Date()) {
  assertPackage(pkg);
  if (backupCipherSha256 !== pkg.backup_cipher_sha256) fail('MIG010_EXECUTOR_BACKUP_PACKAGE_MISMATCH');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail('MIG010_EXECUTOR_REQUEST_TIME_INVALID');
  const nowMs = now.getTime();
  const createdAt = normalizeFreshTimestamp(
    backupCreatedAt,
    nowMs,
    'MIG010_EXECUTOR_BACKUP_CREATED_AT_INVALID',
    'MIG010_EXECUTOR_BACKUP_COPY_STALE'
  );
  const verifiedAt = now.toISOString();
  const sessionId = `MIG010_${crypto.randomBytes(12).toString('hex')}`;
  const identity = requestIdentity(pkg, createdAt, verifiedAt, sessionId);
  return Object.freeze({ ...identity, request_hash: sha256Hex(canonicalJson(identity)) });
}

function assertAuthorization(auth, request, pkg, nowMs = Date.now()) {
  assertPackage(pkg);
  if (!request || request.schema !== AUTH_REQUEST_SCHEMA || request.write_authorized !== false ||
      !SHA256_RE.test(String(request.request_hash || '')) ||
      sha256Hex(canonicalJson(requestIdentity(
        pkg,
        request.backup_created_at,
        request.backup_verified_at,
        request.session_id
      ))) !== request.request_hash) {
    fail('MIG010_EXECUTOR_AUTH_REQUEST_INVALID');
  }
  normalizeFreshTimestamp(
    request.backup_created_at,
    nowMs,
    'MIG010_EXECUTOR_BACKUP_CREATED_AT_INVALID',
    'MIG010_EXECUTOR_BACKUP_COPY_STALE'
  );
  normalizeFreshTimestamp(
    request.backup_verified_at,
    nowMs,
    'MIG010_EXECUTOR_BACKUP_VERIFIED_AT_INVALID',
    'MIG010_EXECUTOR_BACKUP_VERIFICATION_STALE'
  );
  if (!auth || auth.schema !== AUTH_SCHEMA || auth.authorization !== AUTH_LITERAL || auth.write_authorized !== true) {
    fail('MIG010_EXECUTOR_IRREVERSIBLE_ACTION_NOT_AUTHORIZED');
  }
  if (!SESSION_RE.test(String(auth.session_id || '')) || auth.session_id !== request.session_id) {
    fail('MIG010_EXECUTOR_AUTH_SESSION_MISMATCH');
  }
  if (auth.request_hash !== request.request_hash) fail('MIG010_EXECUTOR_AUTH_REQUEST_MISMATCH');
  for (const field of [
    'package_hash','resolved_hash','candidate_revision_hash','backup_cipher_sha256',
    'current_raw_table_hash','final_raw_table_hash','target_header_hash'
  ]) {
    if (auth[field] !== request[field] || auth[field] !== pkg[field]) fail('MIG010_EXECUTOR_AUTH_BINDING_MISMATCH');
  }
  if (auth.backup_created_at !== request.backup_created_at || auth.backup_verified_at !== request.backup_verified_at) {
    fail('MIG010_EXECUTOR_AUTH_BACKUP_TIME_MISMATCH');
  }
  normalizeFreshTimestamp(
    auth.backup_created_at,
    nowMs,
    'MIG010_EXECUTOR_BACKUP_CREATED_AT_INVALID',
    'MIG010_EXECUTOR_BACKUP_COPY_STALE'
  );
  normalizeFreshTimestamp(
    auth.backup_verified_at,
    nowMs,
    'MIG010_EXECUTOR_BACKUP_VERIFIED_AT_INVALID',
    'MIG010_EXECUTOR_BACKUP_VERIFICATION_STALE'
  );
  return Object.freeze(auth);
}

function baseRequest(auth, pkg) {
  return {
    authorization: AUTH_LITERAL,
    session_id: auth.session_id,
    package_hash: pkg.package_hash,
    resolved_hash: pkg.resolved_hash,
    candidate_revision_hash: pkg.candidate_revision_hash,
    backup_cipher_sha256: pkg.backup_cipher_sha256,
    current_raw_table_hash: pkg.current_raw_table_hash,
    final_raw_table_hash: pkg.final_raw_table_hash,
    target_header_hash: pkg.target_header_hash,
    backup_created_at: auth.backup_created_at,
    backup_verified_at: auth.backup_verified_at
  };
}

function readOauthProfile(authPath, profileName) {
  let auth;
  try { auth = JSON.parse(fs.readFileSync(path.resolve(authPath), 'utf8')); } catch (_) { fail('MIG010_EXECUTOR_OAUTH_FILE_INVALID'); }
  const profile = auth && auth.tokens && auth.tokens[profileName];
  if (!profile) fail('MIG010_EXECUTOR_OAUTH_PROFILE_NOT_FOUND');
  const clientId = profile.client_id;
  const clientSecret = profile.client_secret;
  const refreshToken = profile.refresh_token;
  if (![clientId, clientSecret, refreshToken].every((value) => typeof value === 'string' && value.length > 0)) {
    fail('MIG010_EXECUTOR_OAUTH_PROFILE_INCOMPLETE');
  }
  return { clientId, clientSecret, refreshToken };
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return { text: '', json: null };
  try { return { text, json: JSON.parse(text) }; } catch (_) { return { text, json: null }; }
}

async function refreshAccessToken(profile, fetchImpl = fetch) {
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: profile.clientId,
      client_secret: profile.clientSecret,
      refresh_token: profile.refreshToken,
      grant_type: 'refresh_token'
    })
  });
  const payload = await readJsonResponse(response);
  const accessToken = payload.json && payload.json.access_token;
  if (!response.ok || typeof accessToken !== 'string' || !accessToken) fail('MIG010_EXECUTOR_OAUTH_TOKEN_REFRESH_FAILED');
  return accessToken;
}

async function runFunction(deploymentId, accessToken, functionName, parameter, fetchImpl = fetch) {
  if (!Object.values(ALLOWED_FUNCTIONS).includes(functionName)) fail('MIG010_EXECUTOR_FUNCTION_NOT_ALLOWED');
  if (!/^AKfy[A-Za-z0-9_-]+$/.test(String(deploymentId || ''))) fail('MIG010_EXECUTOR_API_DEPLOYMENT_INVALID');
  const response = await fetchImpl(`https://script.googleapis.com/v1/scripts/${encodeURIComponent(deploymentId)}:run`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ function: functionName, parameters: [parameter], devMode: false })
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) fail(classifyFailure(response.status, payload.text, payload.json));
  if (!payload.json || payload.json.done === false) fail('MIG010_EXECUTOR_API_RESPONSE_INVALID');
  if (payload.json.error) fail(classifyFailure(200, JSON.stringify(payload.json.error), payload.json));
  const result = payload.json.response && payload.json.response.result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) fail('MIG010_EXECUTOR_API_RESULT_INVALID');
  return result;
}

async function executeAuthorizedPackage(input) {
  const { pkg, request, auth, deploymentId, oauthProfile, fetchImpl = fetch, nowMs = Date.now() } = input || {};
  assertAuthorization(auth, request, pkg, nowMs);
  const accessToken = await refreshAccessToken(oauthProfile, fetchImpl);
  const base = baseRequest(auth, pkg);
  const begin = await runFunction(deploymentId, accessToken, ALLOWED_FUNCTIONS.begin, {
    ...base,
    batch_count: pkg.batches.length
  }, fetchImpl);
  if (!['STAGING_READY', 'STAGING_RESUMED'].includes(String(begin.status || ''))) {
    fail('MIG010_EXECUTOR_BEGIN_NOT_READY');
  }

  for (const batch of pkg.batches) {
    const result = await runFunction(deploymentId, accessToken, ALLOWED_FUNCTIONS.batch, {
      ...base,
      batch_index: batch.batch_index,
      start_sheet_row: batch.start_sheet_row,
      batch_hash: batch.batch_hash,
      rows: batch.rows
    }, fetchImpl);
    if (!['BATCH_STAGED', 'ALREADY_APPLIED'].includes(String(result.status || ''))) {
      fail('MIG010_EXECUTOR_BATCH_NOT_STAGED');
    }
  }

  const finalized = await runFunction(deploymentId, accessToken, ALLOWED_FUNCTIONS.finalize, base, fetchImpl);
  if (finalized.status !== 'FINALIZED_PENDING_RECONCILIATION' || finalized.finalRawTableHash !== pkg.final_raw_table_hash ||
      finalized.rollbackAvailable !== true) {
    fail('MIG010_EXECUTOR_FINALIZE_INVALID');
  }
  return Object.freeze({
    schema: 'MIG010_OWNER_AUTHORIZED_EXECUTION_V1',
    status: 'FINALIZED_PENDING_RECONCILIATION',
    packageHash: pkg.package_hash,
    resolvedHash: pkg.resolved_hash,
    finalRawTableHash: pkg.final_raw_table_hash,
    rollbackAvailable: true,
    financialPayloadStdout: false,
    writeAuthorized: true
  });
}

async function rollbackAuthorizedPackage(input) {
  const { pkg, request, auth, deploymentId, oauthProfile, fetchImpl = fetch, nowMs = Date.now() } = input || {};
  assertAuthorization(auth, request, pkg, nowMs);
  const accessToken = await refreshAccessToken(oauthProfile, fetchImpl);
  const result = await runFunction(deploymentId, accessToken, ALLOWED_FUNCTIONS.rollback, baseRequest(auth, pkg), fetchImpl);
  if (result.status !== 'ROLLED_BACK') fail('MIG010_EXECUTOR_ROLLBACK_INVALID');
  return Object.freeze({
    schema: 'MIG010_OWNER_AUTHORIZED_ROLLBACK_V1',
    status: 'ROLLED_BACK',
    packageHash: pkg.package_hash,
    financialPayloadStdout: false,
    writeAuthorized: true
  });
}

function commandRequest(args) {
  for (const required of ['package', 'backup', 'key', 'out']) {
    if (!args[required]) fail('MIG010_EXECUTOR_REQUEST_ARGUMENTS_REQUIRED');
  }
  const pkg = assertPackage(readPrivateJson(args.package, 'MIG010_EXECUTOR_PACKAGE_READ_FAILED'));
  const backupPath = assertOutsideRepository(args.backup, 'MIG010_EXECUTOR_BACKUP_INSIDE_REPOSITORY');
  const key = readBackupKey(args.key);
  const verified = readEncryptedBackup(backupPath, key);
  const backupCreatedAt = verified && verified.pkg && verified.pkg.manifest && verified.pkg.manifest.createdAt;
  const request = createAuthorizationRequest(pkg, verified.cipherSha256, backupCreatedAt, new Date());
  writePrivateJson(args.out, request);
  return {
    schema: AUTH_REQUEST_SCHEMA,
    status: 'AUTHORIZATION_REQUIRED',
    requestHash: request.request_hash,
    packageHash: request.package_hash,
    resolvedHash: request.resolved_hash,
    backupCipherSha256: request.backup_cipher_sha256,
    backupCreatedAt: request.backup_created_at,
    backupVerifiedAt: request.backup_verified_at,
    requestWritten: true,
    financialPayloadStdout: false,
    writeAuthorized: false
  };
}

function executionInputs(args) {
  for (const required of ['package', 'request', 'authorization']) {
    if (!args[required]) fail('MIG010_EXECUTOR_EXECUTE_ARGUMENTS_REQUIRED');
  }
  const pkg = assertPackage(readPrivateJson(args.package, 'MIG010_EXECUTOR_PACKAGE_READ_FAILED'));
  const request = readPrivateJson(args.request, 'MIG010_EXECUTOR_AUTH_REQUEST_READ_FAILED');
  const auth = readPrivateJson(args.authorization, 'MIG010_EXECUTOR_AUTHORIZATION_READ_FAILED');
  const deploymentId = String(process.env.APPS_SCRIPT_API_DEPLOYMENT_ID || '');
  if (!/^AKfy[A-Za-z0-9_-]+$/.test(deploymentId)) fail('MIG010_EXECUTOR_API_DEPLOYMENT_INVALID');
  const authPath = args.auth || process.env.CLASPRC_PATH || path.join(os.homedir(), '.clasprc.json');
  const profileName = String(args.user || process.env.CLASP_USER || 'prihrash-ci');
  const oauthProfile = readOauthProfile(authPath, profileName);
  return { pkg, request, auth, deploymentId, oauthProfile };
}

async function commandExecute(args) {
  return executeAuthorizedPackage(executionInputs(args));
}

async function commandRollback(args) {
  return rollbackAuthorizedPackage(executionInputs(args));
}

function commandContract() {
  return {
    schema: TOOL_SCHEMA,
    packageSchema: PACKAGE_SCHEMA,
    authorizationRequestSchema: AUTH_REQUEST_SCHEMA,
    authorizationSchema: AUTH_SCHEMA,
    authorizationLiteral: AUTH_LITERAL,
    maxBackupAgeMs: MAX_BACKUP_AGE_MS,
    exactPackageBinding: true,
    freshEncryptedBackupCopyRequired: true,
    freshEncryptedBackupVerifyRequired: true,
    privateAuthorizationRequired: true,
    executionFunctionsAllowlisted: Object.values(ALLOWED_FUNCTIONS),
    finalizePendingReconciliation: true,
    financialPayloadStdout: false,
    publicCiCanAuthorize: false
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  try {
    let result;
    if (command === 'request') result = commandRequest(args);
    else if (command === 'execute') result = await commandExecute(args);
    else if (command === 'rollback') result = await commandRollback(args);
    else if (command === 'contract') result = commandContract();
    else fail('MIG010_EXECUTOR_COMMAND_INVALID');
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'FAIL', reason: safeReason(error) })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  AUTH_REQUEST_SCHEMA,
  AUTH_SCHEMA,
  PACKAGE_SCHEMA,
  TOOL_SCHEMA,
  AUTH_LITERAL,
  MAX_BACKUP_AGE_MS,
  ALLOWED_FUNCTIONS,
  parseArgs,
  assertPackage,
  normalizeFreshTimestamp,
  requestIdentity,
  createAuthorizationRequest,
  assertAuthorization,
  baseRequest,
  readOauthProfile,
  refreshAccessToken,
  runFunction,
  executeAuthorizedPackage,
  rollbackAuthorizedPackage,
  commandRequest,
  commandContract
};
