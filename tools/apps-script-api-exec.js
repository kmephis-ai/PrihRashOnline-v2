'use strict';

const fs = require('fs');
const path = require('path');

const ALLOWED_FUNCTIONS = new Set([
  'prhRuntimeTransportPing',
  'prhReleaseHealthCheckToken'
]);

function classifyFailure(statusCode, payloadText) {
  const text = String(payloadText || '');
  const runtime = text.match(/RUNTIME_HEALTH_[A-Z_]+/);
  if (runtime) return runtime[0];
  if (statusCode === 404 || /API executable|not published|not deployed|deployment|NOT_FOUND|Script function not found/i.test(text)) {
    return 'API_EXECUTABLE_UNAVAILABLE';
  }
  if (/standard (Google )?Cloud project|standard GCP project|same Cloud Platform project/i.test(text)) {
    return 'COMMON_STANDARD_CLOUD_PROJECT_REQUIRED';
  }
  if (/insufficient.*scope|Request had insufficient authentication scopes/i.test(text)) {
    return 'OAUTH_PROJECT_SCOPES_REQUIRED';
  }
  if (statusCode === 401 || statusCode === 403 || /PERMISSION_DENIED|unauthorized|NOT_AUTHORIZED|caller does not have permission/i.test(text)) {
    return 'OAUTH_OR_CLOUD_PROJECT_PERMISSION_REQUIRED';
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
      emit({ ok: false, reason: classifyFailure(runResponse.status, runPayload.text) });
      return;
    }
    if (!runPayload.json || typeof runPayload.json !== 'object') {
      emit({ ok: false, reason: 'AUTHENTICATED_EXECUTION_RESPONSE_INVALID' });
      return;
    }
    if (runPayload.json.error) {
      emit({ ok: false, reason: classifyFailure(200, JSON.stringify(runPayload.json.error)) });
      return;
    }
    if (!runPayload.json.response || !Object.prototype.hasOwnProperty.call(runPayload.json.response, 'result')) {
      emit({ ok: false, reason: 'AUTHENTICATED_EXECUTION_INCOMPLETE' });
      return;
    }

    const result = runPayload.json.response.result;
    if (typeof result !== 'string') {
      emit({ ok: false, reason: 'AUTHENTICATED_EXECUTION_RESULT_INVALID' });
      return;
    }
    emit({ ok: true, result });
  } catch (_) {
    emit({ ok: false, reason: 'AUTHENTICATED_EXECUTION_INTERNAL_ERROR' });
  }
}

if (require.main === module) {
  main();
}

module.exports = { classifyFailure, ALLOWED_FUNCTIONS };
