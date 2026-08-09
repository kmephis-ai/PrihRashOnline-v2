'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { assertOutsideRepository } = require('./mig010-owner');
const {
  assertPackage,
  assertAuthorization,
  baseRequest,
  readOauthProfile,
  refreshAccessToken
} = require('./mig010-authorized-executor');
const { inspectExecution, boundedExecutionReason } = require('./mig010-inspect');

const TOOL_SCHEMA = 'MIG010_OWNER_READBACK_PROBE_V1';
const REMOTE_SCHEMA = 'MIG010_EXECUTION_READBACK_PROBE_V1';
const FUNCTION_NAME = 'prhMig010ProbeAuthorizedBatchReadback';
const ALLOWED_CLASSES = new Set([
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
]);

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function safeReason(error, fallback = 'MIG010_READBACK_PROBE_FAILED') {
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
  const resolved = assertOutsideRepository(filePath, 'MIG010_READBACK_PROBE_PRIVATE_PATH_INSIDE_REPOSITORY');
  try { return JSON.parse(fs.readFileSync(resolved, 'utf8')); } catch (_) { fail(reason); }
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return { text: '', json: null };
  try { return { text, json: JSON.parse(text) }; } catch (_) { return { text, json: null }; }
}

function normalizeClasses(value, reason) {
  if (!Array.isArray(value) ||
      value.some((item) => !ALLOWED_CLASSES.has(String(item))) ||
      new Set(value.map(String)).size !== value.length) {
    fail(reason);
  }
  return value.map(String).sort();
}

function normalizeProbe(value) {
  if (!value || value.schema !== REMOTE_SCHEMA || !['MISMATCH_CLASSIFIED', 'MATCHED'].includes(value.status)) {
    fail('MIG010_READBACK_PROBE_REMOTE_RESULT_INVALID');
  }

  const mismatchClasses = normalizeClasses(value.mismatchClasses, 'MIG010_READBACK_PROBE_REMOTE_CLASSES_INVALID');
  if (value.status === 'MISMATCH_CLASSIFIED' && mismatchClasses.length < 1) {
    fail('MIG010_READBACK_PROBE_REMOTE_CLASSES_INVALID');
  }
  if (value.status === 'MATCHED' && mismatchClasses.length !== 0) {
    fail('MIG010_READBACK_PROBE_REMOTE_CLASSES_INVALID');
  }
  if (value.rangeCleared !== true || value.liveTargetMutated !== false || value.financialPayloadStdout !== false) {
    fail('MIG010_READBACK_PROBE_REMOTE_SAFETY_INVALID');
  }

  if (value.adaptiveFormatReadback != null) {
    const adaptiveFormatReadback = normalizeClasses(
      value.adaptiveFormatReadback,
      'MIG010_READBACK_PROBE_REMOTE_ADAPTIVE_INVALID'
    );
    if (JSON.stringify(adaptiveFormatReadback) !== JSON.stringify(mismatchClasses) ||
        typeof value.adaptiveRepairApplied !== 'boolean' ||
        value.originalFormatsRestoredAfterClear !== true) {
      fail('MIG010_READBACK_PROBE_REMOTE_ADAPTIVE_INVALID');
    }
    return Object.freeze({
      schema: TOOL_SCHEMA,
      status: value.status,
      mismatchClasses,
      adaptiveFormatReadback,
      adaptiveRepairApplied: value.adaptiveRepairApplied,
      rangeCleared: true,
      originalFormatsRestoredAfterClear: true,
      liveTargetMutated: false,
      financialPayloadStdout: false
    });
  }

  // Backward-compatible normalization for already-produced lifecycle probes.
  const beforeFormatRestore = normalizeClasses(
    value.beforeFormatRestore == null ? value.mismatchClasses : value.beforeFormatRestore,
    'MIG010_READBACK_PROBE_REMOTE_LIFECYCLE_INVALID'
  );
  const afterFormatRestore = normalizeClasses(
    value.afterFormatRestore == null ? value.mismatchClasses : value.afterFormatRestore,
    'MIG010_READBACK_PROBE_REMOTE_LIFECYCLE_INVALID'
  );
  const combined = Array.from(new Set([...beforeFormatRestore, ...afterFormatRestore])).sort();
  if (JSON.stringify(combined) !== JSON.stringify(mismatchClasses)) {
    fail('MIG010_READBACK_PROBE_REMOTE_LIFECYCLE_INVALID');
  }
  return Object.freeze({
    schema: TOOL_SCHEMA,
    status: value.status,
    mismatchClasses,
    beforeFormatRestore,
    afterFormatRestore,
    rangeCleared: true,
    liveTargetMutated: false,
    financialPayloadStdout: false
  });
}

async function probeExecution(input) {
  const { pkg, request, auth, deploymentId, oauthProfile, fetchImpl = fetch, nowMs = Date.now() } = input || {};
  assertPackage(pkg);
  assertAuthorization(auth, request, pkg, nowMs);
  if (!/^AKfy[A-Za-z0-9_-]+$/.test(String(deploymentId || ''))) fail('MIG010_READBACK_PROBE_API_DEPLOYMENT_INVALID');

  const diagnostic = await inspectExecution({ pkg, request, auth, deploymentId, oauthProfile, fetchImpl, nowMs });
  if (diagnostic.status !== 'SESSION_FOUND' || diagnostic.sessionStatus !== 'STAGING' ||
      diagnostic.liveTargetState !== 'INITIAL' || diagnostic.rollbackPresent !== true ||
      diagnostic.rollbackMatchesInitial !== true || diagnostic.nextBatch >= diagnostic.batchCount) {
    fail('MIG010_READBACK_PROBE_SESSION_NOT_SAFE');
  }
  const batch = pkg.batches[diagnostic.nextBatch];
  if (!batch || batch.batch_index !== diagnostic.nextBatch) fail('MIG010_READBACK_PROBE_BATCH_BINDING_INVALID');

  const accessToken = await refreshAccessToken(oauthProfile, fetchImpl);
  const response = await fetchImpl(`https://script.googleapis.com/v1/scripts/${encodeURIComponent(deploymentId)}:run`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      function: FUNCTION_NAME,
      parameters: [{
        ...baseRequest(auth, pkg),
        batch_index: batch.batch_index,
        start_sheet_row: batch.start_sheet_row,
        batch_hash: batch.batch_hash,
        rows: batch.rows
      }],
      devMode: false
    })
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) fail('MIG010_READBACK_PROBE_API_HTTP_FAILED');
  if (!payload.json || payload.json.done === false) fail('MIG010_READBACK_PROBE_API_RESPONSE_INVALID');
  if (payload.json.error) fail(boundedExecutionReason(payload.json, payload.text));
  const raw = payload.json.response && payload.json.response.result;
  if (typeof raw !== 'string') fail('MIG010_READBACK_PROBE_API_RESULT_INVALID');
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_) { fail('MIG010_READBACK_PROBE_API_RESULT_INVALID'); }
  return normalizeProbe(parsed);
}

function executionInputs(args) {
  for (const required of ['package', 'request', 'authorization']) {
    if (!args[required]) fail('MIG010_READBACK_PROBE_ARGUMENTS_REQUIRED');
  }
  const pkg = assertPackage(readPrivateJson(args.package, 'MIG010_READBACK_PROBE_PACKAGE_READ_FAILED'));
  const request = readPrivateJson(args.request, 'MIG010_READBACK_PROBE_REQUEST_READ_FAILED');
  const auth = readPrivateJson(args.authorization, 'MIG010_READBACK_PROBE_AUTHORIZATION_READ_FAILED');
  const deploymentId = String(process.env.APPS_SCRIPT_API_DEPLOYMENT_ID || '');
  const authPath = args.auth || process.env.CLASPRC_PATH || path.join(os.homedir(), '.clasprc.json');
  const profileName = String(args.user || process.env.CLASP_USER || 'prihrash-ci');
  const oauthProfile = readOauthProfile(authPath, profileName);
  return { pkg, request, auth, deploymentId, oauthProfile };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    if (args._[0] !== 'probe') fail('MIG010_READBACK_PROBE_COMMAND_INVALID');
    const result = await probeExecution(executionInputs(args));
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
  ALLOWED_CLASSES,
  parseArgs,
  normalizeProbe,
  probeExecution
};
