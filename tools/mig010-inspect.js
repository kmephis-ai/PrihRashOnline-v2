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

const TOOL_SCHEMA = 'MIG010_OWNER_EXECUTION_INSPECT_V1';
const REMOTE_SCHEMA = 'MIG010_EXECUTION_DIAGNOSTIC_V1';
const FUNCTION_NAME = 'prhMig010InspectAuthorizedExecution';
const LIVE_STATES = new Set(['INITIAL', 'FINAL', 'DRIFT']);
const SESSION_STATES = new Set([
  '',
  'STAGING',
  'FINALIZED_PENDING_RECONCILIATION',
  'ROLLED_BACK_AFTER_FAILURE',
  'ROLLED_BACK_BY_OWNER'
]);

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function safeReason(error, fallback = 'MIG010_INSPECT_FAILED') {
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
  const resolved = assertOutsideRepository(filePath, 'MIG010_INSPECT_PRIVATE_PATH_INSIDE_REPOSITORY');
  try { return JSON.parse(fs.readFileSync(resolved, 'utf8')); } catch (_) { fail(reason); }
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

function normalizeDiagnostic(value) {
  if (!value || value.schema !== REMOTE_SCHEMA || !['NO_SESSION', 'SESSION_FOUND'].includes(value.status)) {
    fail('MIG010_INSPECT_REMOTE_RESULT_INVALID');
  }
  if (!LIVE_STATES.has(value.liveTargetState) || !SESSION_STATES.has(String(value.sessionStatus || ''))) {
    fail('MIG010_INSPECT_REMOTE_STATE_INVALID');
  }
  const nextBatch = Number(value.nextBatch);
  const batchCount = Number(value.batchCount);
  if (!Number.isInteger(nextBatch) || nextBatch < 0 || !Number.isInteger(batchCount) || batchCount < 0 || nextBatch > batchCount) {
    fail('MIG010_INSPECT_REMOTE_PROGRESS_INVALID');
  }
  const failureReason = String(value.failureReason || '');
  if (failureReason && !/^MIG010_EXECUTION_[A-Z0-9_]+$/.test(failureReason)) {
    fail('MIG010_INSPECT_REMOTE_REASON_INVALID');
  }
  return Object.freeze({
    schema: TOOL_SCHEMA,
    status: value.status,
    sessionStatus: String(value.sessionStatus || ''),
    nextBatch,
    batchCount,
    liveTargetState: value.liveTargetState,
    stagingPresent: value.stagingPresent === true,
    rollbackPresent: value.rollbackPresent === true,
    stagingMatchesFinal: value.stagingMatchesFinal === true,
    rollbackMatchesInitial: value.rollbackMatchesInitial === true,
    failureReason,
    financialPayloadStdout: false,
    writeAuthorized: false
  });
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return { text: '', json: null };
  try { return { text, json: JSON.parse(text) }; } catch (_) { return { text, json: null }; }
}

async function inspectExecution(input) {
  const { pkg, request, auth, deploymentId, oauthProfile, fetchImpl = fetch, nowMs = Date.now() } = input || {};
  assertPackage(pkg);
  assertAuthorization(auth, request, pkg, nowMs);
  if (!/^AKfy[A-Za-z0-9_-]+$/.test(String(deploymentId || ''))) fail('MIG010_INSPECT_API_DEPLOYMENT_INVALID');
  const accessToken = await refreshAccessToken(oauthProfile, fetchImpl);
  const response = await fetchImpl(`https://script.googleapis.com/v1/scripts/${encodeURIComponent(deploymentId)}:run`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ function: FUNCTION_NAME, parameters: [baseRequest(auth, pkg)], devMode: false })
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) fail(classifyFailure(response.status, payload.text, payload.json));
  if (!payload.json || payload.json.done === false) fail('MIG010_INSPECT_API_RESPONSE_INVALID');
  if (payload.json.error) fail(boundedExecutionReason(payload.json, payload.text));
  const raw = payload.json.response && payload.json.response.result;
  if (typeof raw !== 'string') fail('MIG010_INSPECT_API_RESULT_INVALID');
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_) { fail('MIG010_INSPECT_API_RESULT_INVALID'); }
  return normalizeDiagnostic(parsed);
}

async function commandInspect(args) {
  for (const required of ['package', 'request', 'authorization']) {
    if (!args[required]) fail('MIG010_INSPECT_ARGUMENTS_REQUIRED');
  }
  const pkg = assertPackage(readPrivateJson(args.package, 'MIG010_INSPECT_PACKAGE_READ_FAILED'));
  const request = readPrivateJson(args.request, 'MIG010_INSPECT_REQUEST_READ_FAILED');
  const auth = readPrivateJson(args.authorization, 'MIG010_INSPECT_AUTHORIZATION_READ_FAILED');
  const deploymentId = String(process.env.APPS_SCRIPT_API_DEPLOYMENT_ID || '');
  const authPath = args.auth || process.env.CLASPRC_PATH || path.join(os.homedir(), '.clasprc.json');
  const profileName = String(args.user || process.env.CLASP_USER || 'prihrash-ci');
  const oauthProfile = readOauthProfile(authPath, profileName);
  return inspectExecution({ pkg, request, auth, deploymentId, oauthProfile });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    if (args._[0] !== 'inspect') fail('MIG010_INSPECT_COMMAND_INVALID');
    const result = await commandInspect(args);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'FAIL', reason: safeReason(error) })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  TOOL_SCHEMA,
  REMOTE_SCHEMA,
  FUNCTION_NAME,
  boundedExecutionReason,
  normalizeDiagnostic,
  inspectExecution
};
