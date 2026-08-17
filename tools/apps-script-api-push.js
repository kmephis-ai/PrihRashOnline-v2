'use strict';

const fs = require('fs');
const path = require('path');

function boundedHttpReason(statusCode, errorStatus, prefix = 'APPS_SCRIPT_CONTENT_HTTP') {
  const code = Number.isInteger(Number(statusCode)) && Number(statusCode) >= 100 && Number(statusCode) <= 599
    ? String(Number(statusCode))
    : '0';
  const rawStatus = String(errorStatus || '').toUpperCase();
  const status = /^[A-Z][A-Z0-9_]{0,39}$/.test(rawStatus) ? rawStatus : 'UNKNOWN';
  return `${prefix}_${code}_${status}`;
}

function safeFileToken(name) {
  const token = String(name || '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
    .slice(0, 48);
  return token || 'UNKNOWN_FILE';
}

function extractInvalidContentReason(payloadJson, files) {
  const error = payloadJson && payloadJson.error;
  if (!error || !Array.isArray(files)) return '';

  const details = Array.isArray(error.details) ? error.details : [];
  for (const detail of details) {
    const violations = Array.isArray(detail && detail.fieldViolations)
      ? detail.fieldViolations
      : (Array.isArray(detail && detail.field_violations) ? detail.field_violations : []);
    for (const violation of violations) {
      const field = String(violation && violation.field || '');
      const match = field.match(/^files(?:\[(\d+)\]|\.(\d+))\.(name|type|source)$/i);
      if (!match) continue;
      const index = Number(match[1] !== undefined ? match[1] : match[2]);
      const file = files[index];
      if (!file) return `DEPLOY_INVALID_FILE_INDEX_${index}`;
      return `DEPLOY_INVALID_${safeFileToken(file.name)}_${match[3].toUpperCase()}`;
    }
  }

  const message = String(error.message || '');
  const fileCandidates = files
    .map((file) => String(file && file.name || ''))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const fileName of fileCandidates) {
    const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`(?:^|[^A-Za-z0-9_])${escaped}(?:\\.(?:js|gs|html|json))?(?:[^A-Za-z0-9_]|$)`, 'i').test(message)) continue;
    const lineMatch = message.match(/(?:line\s*[:#]?\s*|lineNumber\s*[:=]\s*)(\d{1,6})/i);
    const line = lineMatch ? Number(lineMatch[1]) : 0;
    return line > 0
      ? `DEPLOY_INVALID_${safeFileToken(fileName)}_L${line}`
      : `DEPLOY_INVALID_${safeFileToken(fileName)}`;
  }

  if (/manifest|appsscript/i.test(message)) return 'DEPLOY_MANIFEST_INVALID';
  if (/duplicate/i.test(message)) return 'DEPLOY_DUPLICATE_DECLARATION';
  if (/invalid argument|request contains an invalid argument/i.test(message)) return 'DEPLOY_INVALID_ARGUMENT_UNLOCATED';
  return '';
}

function classifyFailure(statusCode, payloadText, errorStatus, payloadJson, files) {
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
    const localized = extractInvalidContentReason(payloadJson, files);
    return localized || 'DEPLOY_SYNTAX_ERROR';
  }
  if (statusCode === 413 || status === 'OUT_OF_RANGE' || /request entity too large|payload too large|content.*too large/i.test(text)) {
    return 'DEPLOY_CONTENT_TOO_LARGE';
  }
  if (statusCode === 400 || status === 'INVALID_ARGUMENT' || /manifest|appsscript|invalid.*file|parse/i.test(text)) {
    const localized = extractInvalidContentReason(payloadJson, files);
    return localized || 'DEPLOY_CONTENT_INVALID';
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

function classifyProjectLookupFailure(statusCode, payloadJson) {
  const error = payloadJson && payloadJson.error;
  const status = String(error && error.status || '').toUpperCase();
  if (statusCode === 400 || status === 'INVALID_ARGUMENT') return 'APPS_SCRIPT_ID_OR_PROJECT_LOOKUP_INVALID';
  if (statusCode === 401 || statusCode === 403 || status === 'PERMISSION_DENIED' || status === 'UNAUTHENTICATED') {
    return 'OAUTH_OR_CLOUD_PROJECT_PERMISSION_REQUIRED';
  }
  if (statusCode === 404 || status === 'NOT_FOUND') return 'APPS_SCRIPT_PROJECT_UNAVAILABLE';
  return boundedHttpReason(statusCode, status, 'APPS_SCRIPT_PROJECT_LOOKUP_HTTP');
}

function classifyNoopWriteFailure(statusCode, payloadJson) {
  const error = payloadJson && payloadJson.error;
  const status = String(error && error.status || '').toUpperCase();
  if (statusCode === 400 || status === 'INVALID_ARGUMENT') return 'APPS_SCRIPT_REMOTE_NOOP_INVALID_ARGUMENT';
  if (statusCode === 401 || statusCode === 403 || status === 'PERMISSION_DENIED' || status === 'UNAUTHENTICATED') {
    return 'OAUTH_OR_CLOUD_PROJECT_PERMISSION_REQUIRED';
  }
  if (statusCode === 404 || status === 'NOT_FOUND') return 'APPS_SCRIPT_PROJECT_UNAVAILABLE';
  if (statusCode === 409 || statusCode === 412 || status === 'FAILED_PRECONDITION' || status === 'ABORTED') {
    return 'APPS_SCRIPT_REMOTE_NOOP_PRECONDITION_FAILED';
  }
  return boundedHttpReason(statusCode, status, 'APPS_SCRIPT_REMOTE_NOOP_HTTP');
}

function validateRemoteContent(remoteJson, candidateFiles) {
  const remoteFiles = remoteJson && remoteJson.files;
  if (!Array.isArray(remoteFiles) || remoteFiles.length === 0) return 'APPS_SCRIPT_REMOTE_CONTENT_INVALID';
  const names = new Set();
  let manifestCount = 0;
  const remoteByName = new Map();
  for (const file of remoteFiles) {
    const name = String(file && file.name || '');
    const type = String(file && file.type || '');
    if (!name || !type) return 'APPS_SCRIPT_REMOTE_CONTENT_INVALID';
    if (typeof file.source !== 'string') return 'APPS_SCRIPT_REMOTE_SOURCE_MISSING';
    if (names.has(name)) return `APPS_SCRIPT_REMOTE_DUPLICATE_${safeFileToken(name)}`;
    names.add(name);
    remoteByName.set(name, type);
    if (name === 'appsscript' && type === 'JSON') manifestCount += 1;
  }
  if (manifestCount !== 1) return 'APPS_SCRIPT_REMOTE_MANIFEST_INVALID';

  for (const file of candidateFiles || []) {
    if (!remoteByName.has(file.name)) continue;
    if (remoteByName.get(file.name) !== file.type) {
      return `DEPLOY_REMOTE_TYPE_MISMATCH_${safeFileToken(file.name)}`;
    }
  }
  return '';
}

function remoteFilesForNoop(remoteJson) {
  const remoteFiles = remoteJson && remoteJson.files;
  if (!Array.isArray(remoteFiles)) throw new Error('APPS_SCRIPT_REMOTE_CONTENT_INVALID');
  return remoteFiles.map((file) => {
    const name = String(file && file.name || '');
    const type = String(file && file.type || '');
    const source = file && file.source;
    if (!name || !type || typeof source !== 'string') throw new Error('APPS_SCRIPT_REMOTE_CONTENT_INVALID');
    return { name, type, source };
  });
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

    const contentUrl = `https://script.googleapis.com/v1/projects/${encodeURIComponent(scriptId)}/content`;
    const authHeaders = { authorization: `Bearer ${accessToken}` };
    const projectResponse = await fetch(`https://script.googleapis.com/v1/projects/${encodeURIComponent(scriptId)}`, {
      method: 'GET',
      headers: authHeaders
    });
    const projectPayload = await readResponse(projectResponse);
    if (!projectResponse.ok || !projectPayload.json || typeof projectPayload.json !== 'object') {
      emit({ ok: false, reason: classifyProjectLookupFailure(projectResponse.status, projectPayload.json) });
      return;
    }

    const remoteResponse = await fetch(contentUrl, {
      method: 'GET',
      headers: authHeaders
    });
    const remotePayload = await readResponse(remoteResponse);
    if (!remoteResponse.ok || !remotePayload.json) {
      emit({ ok: false, reason: classifyProjectLookupFailure(remoteResponse.status, remotePayload.json) });
      return;
    }
    const remoteProblem = validateRemoteContent(remotePayload.json, files);
    if (remoteProblem) {
      emit({ ok: false, reason: remoteProblem });
      return;
    }

    // A/B proof: first write back exactly the accepted remote semantic content.
    // Only name/type/source are sent; output-only metadata from getContent is discarded.
    // A successful no-op proves project identity, OAuth scope and updateContent transport
    // independently of the new candidate payload.
    const noopFiles = remoteFilesForNoop(remotePayload.json);
    const noopResponse = await fetch(contentUrl, {
      method: 'PUT',
      headers: {
        ...authHeaders,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ files: noopFiles })
    });
    const noopPayload = await readResponse(noopResponse);
    if (!noopResponse.ok) {
      emit({ ok: false, reason: classifyNoopWriteFailure(noopResponse.status, noopPayload.json) });
      return;
    }
    if (!noopPayload.json || !Array.isArray(noopPayload.json.files) || noopPayload.json.files.length !== noopFiles.length) {
      emit({ ok: false, reason: 'APPS_SCRIPT_REMOTE_NOOP_RESPONSE_INVALID' });
      return;
    }

    const pushResponse = await fetch(contentUrl, {
      method: 'PUT',
      headers: {
        ...authHeaders,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ files })
    });
    const pushPayload = await readResponse(pushResponse);
    if (!pushResponse.ok) {
      const errorStatus = pushPayload.json && pushPayload.json.error && pushPayload.json.error.status;
      let reason = classifyFailure(pushResponse.status, pushPayload.text, errorStatus, pushPayload.json, files);
      if (reason === 'DEPLOY_INVALID_ARGUMENT_UNLOCATED' || reason === 'DEPLOY_CONTENT_INVALID') {
        reason = 'DEPLOY_CANDIDATE_INVALID_AFTER_REMOTE_NOOP_OK';
      }
      emit({ ok: false, reason });
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

module.exports = {
  boundedHttpReason,
  safeFileToken,
  extractInvalidContentReason,
  classifyFailure,
  classifyProjectLookupFailure,
  classifyNoopWriteFailure,
  validateRemoteContent,
  remoteFilesForNoop,
  toApiFile,
  readDeployFiles
};
