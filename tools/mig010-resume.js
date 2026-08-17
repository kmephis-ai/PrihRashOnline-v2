'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { assertOutsideRepository } = require('./mig010-owner');
const { classifyFailure } = require('./apps-script-api-exec');
const {
  assertPackage,
  assertAuthorization,
  baseRequest,
  readOauthProfile,
  refreshAccessToken
} = require('./mig010-authorized-executor');

const TOOL_SCHEMA = 'MIG010_OWNER_AUTHORIZED_RESUME_V1';
const FUNCTIONS = Object.freeze({
  resume: 'prhMig010ResumeAuthorizedExecution',
  batch: 'prhMig010WriteAuthorizedBatchTyped',
  finalize: 'prhMig010FinalizeAuthorizedExecution'
});

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function safeReason(error, fallback = 'MIG010_RESUME_FAILED') {
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
  const resolved = assertOutsideRepository(filePath, 'MIG010_RESUME_PRIVATE_PATH_INSIDE_REPOSITORY');
  try { return JSON.parse(fs.readFileSync(resolved, 'utf8')); } catch (_) { fail(reason); }
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return { text: '', json: null };
  try { return { text, json: JSON.parse(text) }; } catch (_) { return { text, json: null }; }
}

function boundedExecutionReason(payloadJson, payloadText = '') {
  const operationError = payloadJson && payloadJson.error ? payloadJson.error : payloadJson;
  const details = operationError && Array.isArray(operationError.details) ? operationError.details : [];
  const detail = details.find((item) => String(item && item['@type'] || '').includes('ExecutionError')) || details[0] || {};
  const message = String(detail.errorMessage || operationError && operationError.message || '');
  const migration = message.match(/MIG010_EXECUTION_[A-Z0-9_]+/);
  if (migration) return migration[0];
  return classifyFailure(200, payloadText || JSON.stringify(payloadJson || {}), payloadJson);
}

function normalizeRemoteResult(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch (_) { /* fail below */ }
  }
  fail('MIG010_RESUME_API_RESULT_INVALID');
}

async function runRemote(deploymentId, accessToken, functionName, parameter, fetchImpl = fetch) {
  if (!Object.values(FUNCTIONS).includes(functionName)) fail('MIG010_RESUME_FUNCTION_NOT_ALLOWED');
  if (!/^AKfy[A-Za-z0-9_-]+$/.test(String(deploymentId || ''))) fail('MIG010_RESUME_API_DEPLOYMENT_INVALID');
  const response = await fetchImpl(`https://script.googleapis.com/v1/scripts/${encodeURIComponent(deploymentId)}:run`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ function: functionName, parameters: [parameter], devMode: false })
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) fail(classifyFailure(response.status, payload.text, payload.json));
  if (!payload.json || payload.json.done === false) fail('MIG010_RESUME_API_RESPONSE_INVALID');
  if (payload.json.error) fail(boundedExecutionReason(payload.json, payload.text));
  return normalizeRemoteResult(payload.json.response && payload.json.response.result);
}

async function resumeAuthorizedPackage(input) {
  const { pkg, request, auth, deploymentId, oauthProfile, fetchImpl = fetch, nowMs = Date.now() } = input || {};
  assertPackage(pkg);
  assertAuthorization(auth, request, pkg, nowMs);
  const accessToken = await refreshAccessToken(oauthProfile, fetchImpl);
  const base = baseRequest(auth, pkg);

  const preflight = await runRemote(deploymentId, accessToken, FUNCTIONS.resume, {
    ...base,
    batch_count: pkg.batches.length
  }, fetchImpl);
  if (preflight.schema !== 'MIG010_EXECUTION_RESUME_RESULT_V1' || preflight.status !== 'STAGING_RESUMABLE' ||
      preflight.liveTargetState !== 'INITIAL' || preflight.rollbackMatchesInitial !== true ||
      preflight.stagingPresent !== true || preflight.rollbackPresent !== true || preflight.writeAuthorized !== false) {
    fail('MIG010_RESUME_PREFLIGHT_INVALID');
  }
  const nextBatch = Number(preflight.nextBatch);
  const batchCount = Number(preflight.batchCount);
  if (!Number.isInteger(nextBatch) || nextBatch < 0 || !Number.isInteger(batchCount) ||
      batchCount !== pkg.batches.length || nextBatch > batchCount) {
    fail('MIG010_RESUME_PROGRESS_INVALID');
  }

  for (let index = nextBatch; index < pkg.batches.length; index += 1) {
    const batch = pkg.batches[index];
    const result = await runRemote(deploymentId, accessToken, FUNCTIONS.batch, {
      ...base,
      batch_index: batch.batch_index,
      start_sheet_row: batch.start_sheet_row,
      batch_hash: batch.batch_hash,
      rows: batch.rows
    }, fetchImpl);
    if (!['BATCH_STAGED', 'ALREADY_APPLIED'].includes(String(result.status || ''))) {
      fail('MIG010_RESUME_BATCH_NOT_STAGED');
    }
  }

  const finalized = await runRemote(deploymentId, accessToken, FUNCTIONS.finalize, base, fetchImpl);
  if (finalized.status !== 'FINALIZED_PENDING_RECONCILIATION' ||
      finalized.finalRawTableHash !== pkg.final_raw_table_hash || finalized.rollbackAvailable !== true) {
    fail('MIG010_RESUME_FINALIZE_INVALID');
  }

  return Object.freeze({
    schema: TOOL_SCHEMA,
    status: 'FINALIZED_PENDING_RECONCILIATION',
    rollbackAvailable: true,
    financialPayloadStdout: false,
    writeAuthorized: true
  });
}

async function commandResume(args) {
  for (const required of ['package', 'request', 'authorization']) {
    if (!args[required]) fail('MIG010_RESUME_ARGUMENTS_REQUIRED');
  }
  const pkg = assertPackage(readPrivateJson(args.package, 'MIG010_RESUME_PACKAGE_READ_FAILED'));
  const request = readPrivateJson(args.request, 'MIG010_RESUME_REQUEST_READ_FAILED');
  const auth = readPrivateJson(args.authorization, 'MIG010_RESUME_AUTHORIZATION_READ_FAILED');
  const deploymentId = String(process.env.APPS_SCRIPT_API_DEPLOYMENT_ID || '');
  const authPath = args.auth || process.env.CLASPRC_PATH || path.join(os.homedir(), '.clasprc.json');
  const profileName = String(args.user || process.env.CLASP_USER || 'prihrash-ci');
  const oauthProfile = readOauthProfile(authPath, profileName);
  return resumeAuthorizedPackage({ pkg, request, auth, deploymentId, oauthProfile });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    if (args._[0] !== 'resume') fail('MIG010_RESUME_COMMAND_INVALID');
    const result = await commandResume(args);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'FAIL', reason: safeReason(error) })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  TOOL_SCHEMA,
  FUNCTIONS,
  boundedExecutionReason,
  normalizeRemoteResult,
  runRemote,
  resumeAuthorizedPackage
};
