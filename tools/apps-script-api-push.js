'use strict';

const fs = require('fs');
const path = require('path');

function boundedHttpReason(statusCode, errorStatus) {
  const code = Number.isInteger(Number(statusCode)) && Number(statusCode) >= 100 && Number(statusCode) <= 599
    ? String(Number(statusCode))
    : '0';
  const rawStatus = String(errorStatus || '').toUpperCase();
  const status = /^[A-Z][A-Z0-9_]{0,39}$/.test(rawStatus) ? rawStatus : 'UNKNOWN';
  return `APPS_SCRIPT_CONTENT_HTTP_${code}_${status}`;
}

function classifyFailure(statusCode, payloadText, errorStatus) {
  const text = String(payloadText || '');
  const status = String(errorStatus || '').toUpperCase();

  if (/User has not enabled the Apps Script API|script\.google\.com\/home\/usersettings/i.test(text)) {
    return 'APPS_SCRIPT_API_USER_SETTING_REQUIRED';
  }
  if (/insufficient.*scope|Request had insufficient authentication scopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(text)) {
    return 'OAUTH_PROJECT_SCOPES_REQUIRED';
  }
  if (statusCode === 401 || statusCode === 403 || status === 'PERMISSION_DENIED' || status === 'UNAUTHENTICATED' || /PERMISSION_DENIED|unauthorized|NOT_AUTHORIZED|caller does not have permission/i.test(text)) {
    return 'OAUTH_OR_CLOUD_PROJECT_PERMISSION_REQUIRED';
  }
  if (statusCode === 404 || status === 'NOT_FOUND' || /NOT_FOUND|script project.*not found|Requested entity was not found/i.test(text)) {
    return 'APPS_SCRIPT_PROJECT_UNAVAILABLE';
  }
  if (/Syntax error:/i.test(text)) {
    return 'DEPLOY_SYNTAX_ERROR';
  }
  if (statusCode === 413 || status === 'OUT_OF_RANGE' || /request entity too large|payload too large|content.*too large/i.test(text)) {
    return 'DEPLOY_CONTENT_TOO_LARGE';
  }
  if (statusCode === 400 || status === 'INVALID_ARGUMENT' || /manifest|appsscript|invalid.*file|parse/i.test(text)) {
    return 'DEPLOY_CONTENT_INVALID';
  }
  if (statusCode === 409 || statusCode === 412 || status === 'FAILED_PRECONDITION' || status === 'ABORTED') {
    return 'APPS_SCRIPT_CONTENT_PRECONDITION_FAILED';
  }
  if (statusCode === 429 || status === 'RESOURCE_EXHAUSTED') {
    return 'APPS_SCRIPT_API_RATE_LIMITED';
  }
  if (statusCode >= 500 || status === 'INTERNAL' || status === 'UNAVAILABLE' || status === 'DEADLINE_EXCEEDED') {
    return 'APPS_SCRIPT_API_SERVER_ERROR';
  }
  return boundedHttpReason(statusCode, errorStatus);
}

function toApiFile(fileName, source) {
  if (fileName === 'appsscript.json') {
    return { name: 'appsscript', type: 'JSON', source };
  }
  if (fileName.endsWith('.js')) {
    return { name: fileName.slice(0, -3), type: 'SERVER_JS', source };
  }
  if (fileName.endsWith('.html')) {
    return { name: fileName.slice(0, -5), type: 'HTML', source };
  }
  throw new Error('UNSUPPORTED_DEPLOY_FILE');
}

function readDeployFiles(directory) {
  const names = fs.readdirSync(directory)
    .filter((name) => !name.startsWith('.'))
    .sort((a, b) => a.localeCompare(b));
  if (!names.includes('appsscript.json')) throw new Error('MANIFEST_MISSING');
  return names.map((name) => {
    const fullPath = path.join(directory, name);
    const stat = fs.lstatSync(fullPath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('UNSAFE_DEPLOY_ENTRY');
    return toApiFile(name, fs.readFileSync(fullPath, 'utf8'));
  });
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return { text: '', json: null };
  try {
    return { text, json: JSON.parse(text) };
  } catch (_) {
    return { text, json: null };
  }
}

async function main() {
  try {
    const directory = process.argv[2];
    const scriptId = String(process.env.APPS_SCRIPT_ID || '');
    const profileName = String(process.env.CLASP_USER || 'prihrash-ci');
    const authPath = process.env.CLASPRC_PATH || path.join(process.env.HOME || '', '.clasprc.json');

    if (!directory || !fs.existsSync(directory)) {
      emit({ ok: false, reason: 'DEPLOY_DIRECTORY_MISSING' });
      return;
    }
    if (!/^[A-Za-z0-9_-]{20,}$/.test(scriptId)) {
      emit({ ok: false, reason: 'APPS_SCRIPT_ID_INVALID' });
      return;
    }

    let files;
    try {
      files = readDeployFiles(directory);
    } catch (error) {
      const reason = ['MANIFEST_MISSING', 'UNSAFE_DEPLOY_ENTRY', 'UNSUPPORTED_DEPLOY_FILE'].includes(error.message)
        ? error.message
        : 'DEPLOY_CONTENT_PREP_FAILED';
      emit({ ok: false, reason });
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

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });
    const tokenPayload = await readResponse(tokenResponse);
    const accessToken = tokenPayload.json && tokenPayload.json.access_token;
    if (!tokenResponse.ok || typeof accessToken !== 'string' || !accessToken) {
      emit({ ok: false, reason: 'OAUTH_TOKEN_REFRESH_FAILED' });
      return;
    }

    const pushResponse = await fetch(`https://script.googleapis.com/v1/projects/${encodeURIComponent(scriptId)}/content`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ files })
    });
    const pushPayload = await readResponse(pushResponse);
    if (!pushResponse.ok) {
      const errorStatus = pushPayload.json && pushPayload.json.error && pushPayload.json.error.status;
      emit({ ok: false, reason: classifyFailure(pushResponse.status, pushPayload.text, errorStatus) });
      return;
    }
    if (!pushPayload.json || !Array.isArray(pushPayload.json.files)) {
      emit({ ok: false, reason: 'APPS_SCRIPT_CONTENT_RESPONSE_INVALID' });
      return;
    }
    if (pushPayload.json.files.length !== files.length) {
      emit({ ok: false, reason: 'APPS_SCRIPT_CONTENT_FILECOUNT_MISMATCH' });
      return;
    }

    emit({ ok: true, fileCount: files.length });
  } catch (_) {
    emit({ ok: false, reason: 'APPS_SCRIPT_CONTENT_PUSH_INTERNAL_ERROR' });
  }
}

if (require.main === module) {
  main();
}

module.exports = { boundedHttpReason, classifyFailure, toApiFile, readDeployFiles };
