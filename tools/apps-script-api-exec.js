'use strict';

const fs = require('fs');
const path = require('path');

const ALLOWED_FUNCTIONS = new Set([
  'prhRuntimeTransportPing',
  'prhReleaseHealthCheckToken'
]);
const HEALTH_BUILD_RETRY_ATTEMPTS = 12;
const HEALTH_BUILD_RETRY_DELAY_MS = 5000;

function safeToken(value, maxLength = 28) {
  const token = String(value || '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
    .slice(0, maxLength);
  return token || 'UNKNOWN';
}

function executionErrorReason(payloadJson) {
  const operationError = payloadJson && payloadJson.error
    ? payloadJson.error
    : payloadJson;
  if (!operationError || typeof operationError !== 'object') return '';

  const code = Number(operationError.code);
  const details = Array.isArray(operationError.details) ? operationError.details : [];
  const detail = details.find((item) => String(item && item['@type'] || '').includes('ExecutionError')) || details[0] || {};
  const message = String(detail.errorMessage || operationError.message || '');
  const errorType = String(detail.errorType || '');
  const stack = Array.isArray(detail.scriptStackTraceElements) ? detail.scriptStackTraceElements : [];
  const top = stack[0] && typeof stack[0] === 'object' ? stack[0] : {};

  const runtime = message.match(/RUNTIME_HEALTH_[A-Z_]+/);
  if (runtime) return runtime[0];

  if (/Authorization is required|Missing required authorization|does not have permission to call|You do not have permission to call|requires? (?:one of )?the following scopes?|insufficient authentication scopes?/i.test(message)) {
    return 'OAUTH_SCRIPT_RUNTIME_SCOPES_REQUIRED';
  }
  if (code === 10 || /exceeded maximum execution time|script timeout/i.test(message)) {
    return 'SCRIPT_EXECUTION_TIMEOUT';
  }
  if (code === 1 || /execution.*cancelled|canceled/i.test(message)) {
    return 'SCRIPT_EXECUTION_CANCELLED';
  }
  if (/service invoked too many times|quota|too many simultaneous invocations|rate limit/i.test(message)) {
    return 'SCRIPT_EXECUTION_QUOTA_EXCEEDED';
  }
  if (/Script function not found|function .* not found/i.test(message)) {
    return 'API_EXECUTABLE_FUNCTION_UNAVAILABLE';
  }

  if (errorType) {
    const typeToken = safeToken(errorType, 20);
    const functionToken = safeToken(top.function, 28);
    const line = Number.isInteger(Number(top.lineNumber)) && Number(top.lineNumber) > 0
      ? Math.min(Number(top.lineNumber), 999999)
      : 0;
    if (functionToken !== 'UNKNOWN' && line > 0) {
      return `SCRIPT_EXECUTION_${typeToken}_${functionToken}_L${line}`;
    }
    return `SCRIPT_EXECUTION_${typeToken}`;
  }
  if (code === 3) return 'SCRIPT_EXECUTION_INVALID_ARGUMENT';
  return 'SCRIPT_EXECUTION_FAILED';
}

function classifyFailure(statusCode, payloadText, payloadJson) {
  const text = String(payloadText || '');
  const runtime = text.match(/RUNTIME_HEALTH_[A-Z_]+/);
  if (runtime) return runtime[0];

  if (statusCode === 200 && payloadJson) {
    const executionReason = executionErrorReason(payloadJson);
    if (executionReason) return executionReason;
  }

  if (statusCode === 404 || /API executable|not published|not deployed|deployment|NOT_FOUND|Script function not found/i.test(text)) {
    return 'API_EXECUTABLE_UNAVAILABLE';
  }
  if (/standard (Google )?Cloud project|standard GCP project|same Cloud Platform project/i.test(text)) {
    return 'COMMON_STANDARD_CLOUD_PROJECT_REQUIRED';
  }
  if (/insufficient.*scope|Request had insufficient authentication scopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(text)) {
    return 'OAUTH_PROJECT_SCOPES_REQUIRED';
  }
  if (/Authorization is required|Missing required authorization|does not have permission to call|You do not have permission to call/i.test(text)) {
    return 'OAUTH_SCRIPT_RUNTIME_SCOPES_REQUIRED';
  }
  if (statusCode === 401 || statusCode === 403 || /PERMISSION_DENIED|unauthorized|NOT_AUTHORIZED|caller does not have permission/i.test(text)) {
    return 'OAUTH_OR_CLOUD_PROJECT_PERMISSION_REQUIRED';
  }
  if (statusCode === 400 || /INVALID_ARGUMENT/i.test(text)) {
    return 'AUTHENTICATED_EXECUTION_INVALID_REQUEST';
  }
  if (statusCode === 429 || /RESOURCE_EXHAUSTED|rate limit|quota/i.test(text)) {
    return 'AUTHENTICATED_EXECUTION_RATE_LIMITED';
  }
  if (statusCode >= 500 || /INTERNAL|UNAVAILABLE|DEADLINE_EXCEEDED/i.test(text)) {
    return 'AUTHENTICATED_EXECUTION_SERVER_ERROR';
  }
  return 'AUTHENTICATED_EXECUTION_FAILED';
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return { json: null, text: '' };
  try {
    return { json: JSON.parse(text), text };
  } catch (_) {
    return { json: null, text };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableBuildPropagationFailure(functionName, reason) {
  return functionName === 'prhReleaseHealthCheckToken' && reason === 'RUNTIME_HEALTH_BUILD_MISMATCH';
}

async function executeAppsScriptRun({ deploymentId, functionName, parameters, accessToken }) {
  const runResponse = await fetch(`https://script.googleapis.com/v1/scripts/${encodeURIComponent(deploymentId)}:run`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      function: functionName,
      parameters,
      devMode: false
    })
  });
  const runPayload = await readJsonResponse(runResponse);
  if (!runResponse.ok) {
    return { ok: false, reason: classifyFailure(runResponse.status, runPayload.text, runPayload.json) };
  }
  if (!runPayload.json || typeof runPayload.json !== 'object') {
    return { ok: false, reason: 'AUTHENTICATED_EXECUTION_RESPONSE_INVALID' };
  }
  if (runPayload.json.done === false) {
    return { ok: false, reason: 'AUTHENTICATED_EXECUTION_NOT_COMPLETED' };
  }
  if (runPayload.json.error) {
    return { ok: false, reason: classifyFailure(200, JSON.stringify(runPayload.json.error), runPayload.json) };
  }
  if (!runPayload.json.response || !Object.prototype.hasOwnProperty.call(runPayload.json.response, 'result')) {
    return { ok: false, reason: 'AUTHENTICATED_EXECUTION_INCOMPLETE' };
  }

  const result = runPayload.json.response.result;
  if (typeof result !== 'string') {
    return { ok: false, reason: 'AUTHENTICATED_EXECUTION_RESULT_INVALID' };
  }
  return { ok: true, result };
}

async function executeWithBuildPropagationRetry({ deploymentId, functionName, parameters, accessToken }) {
  const attempts = functionName === 'prhReleaseHealthCheckToken' ? HEALTH_BUILD_RETRY_ATTEMPTS : 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const outcome = await executeAppsScriptRun({ deploymentId, functionName, parameters, accessToken });
    if (outcome.ok) return outcome;
    if (!isRetryableBuildPropagationFailure(functionName, outcome.reason) || attempt >= attempts) return outcome;
    await sleep(HEALTH_BUILD_RETRY_DELAY_MS);
  }
  return { ok: false, reason: 'AUTHENTICATED_EXECUTION_FAILED' };
}

async function main() {
  try {
    const functionName = process.argv[2];
    const parametersText = process.argv[3] || '[]';
    const deploymentId = String(process.env.APPS_SCRIPT_API_DEPLOYMENT_ID || '');
    const profileName = String(process.env.CLASP_USER || 'prihrash-ci');
    const authPath = process.env.CLASPRC_PATH || path.join(process.env.HOME || '', '.clasprc.json');

    if (!ALLOWED_FUNCTIONS.has(functionName)) {
      emit({ ok: false, reason: 'EXECUTION_FUNCTION_NOT_ALLOWED' });
      return;
    }
    if (!/^AKfy[A-Za-z0-9_-]+$/.test(deploymentId)) {
      emit({ ok: false, reason: 'API_EXECUTABLE_ID_INVALID' });
      return;
    }

    let parameters;
    try {
      parameters = JSON.parse(parametersText);
    } catch (_) {
      emit({ ok: false, reason: 'EXECUTION_PARAMETERS_INVALID' });
      return;
    }
    if (!Array.isArray(parameters)) {
      emit({ ok: false, reason: 'EXECUTION_PARAMETERS_INVALID' });
      return;
    }

    const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    const profile = auth && auth.tokens && auth.tokens[profileName];
    if (!profile) {
      emit({ ok: false, reason: 'OAUTH_PROFILE_NOT_FOUND' });
      return;
    }

    const clientId = profile.client_id;
    const clientSecret = profile.client_secret;
    const refreshToken = profile.refresh_token;
    if (![clientId, clientSecret, refreshToken].every((value) => typeof value === 'string' && value.length > 0)) {
      emit({ ok: false, reason: 'OAUTH_PROFILE_INCOMPLETE' });
      return;
    }

    const tokenBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: tokenBody
    });
    const tokenPayload = await readJsonResponse(tokenResponse);
    const accessToken = tokenPayload.json && tokenPayload.json.access_token;
    if (!tokenResponse.ok || typeof accessToken !== 'string' || !accessToken) {
      emit({ ok: false, reason: 'OAUTH_TOKEN_REFRESH_FAILED' });
      return;
    }

    const outcome = await executeWithBuildPropagationRetry({ deploymentId, functionName, parameters, accessToken });
    emit(outcome);
  } catch (_) {
    emit({ ok: false, reason: 'AUTHENTICATED_EXECUTION_INTERNAL_ERROR' });
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  classifyFailure,
  executionErrorReason,
  safeToken,
  ALLOWED_FUNCTIONS,
  HEALTH_BUILD_RETRY_ATTEMPTS,
  HEALTH_BUILD_RETRY_DELAY_MS,
  isRetryableBuildPropagationFailure,
  executeAppsScriptRun,
  executeWithBuildPropagationRetry
};
