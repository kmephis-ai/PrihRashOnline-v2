'use strict';

const fs = require('fs');
const path = require('path');

// Privacy boundary: emit only bounded reason codes; never emit OAuth or Drive response payloads.
function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return null; }
}

function classifyDriveApiResponse(statusCode, payload) {
  if (statusCode >= 200 && statusCode < 300) return 'OAUTH_DRIVE_API_ACCESS_OK';
  const error = payload && typeof payload === 'object' ? payload.error : null;
  const errors = error && Array.isArray(error.errors) ? error.errors : [];
  const status = String(error && error.status || '');
  const reason = String(errors[0] && errors[0].reason || '');
  const message = String(error && error.message || '');
  const aggregate = `${status}|${reason}|${message}`;
  if (/ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficientPermissions|insufficient authentication scopes|insufficient.*scope/i.test(aggregate)) {
    return 'OAUTH_DRIVE_SCOPE_MISSING';
  }
  if (statusCode === 401 || /UNAUTHENTICATED|invalid.*credential|invalid.*token/i.test(aggregate)) {
    return 'OAUTH_ACCESS_TOKEN_INVALID';
  }
  if (statusCode === 403 || /PERMISSION_DENIED|forbidden/i.test(aggregate)) {
    return 'OAUTH_DRIVE_API_PERMISSION_DENIED';
  }
  if (statusCode === 429 || /RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(aggregate)) {
    return 'OAUTH_DRIVE_API_RATE_LIMITED';
  }
  if (statusCode >= 500) return 'OAUTH_DRIVE_API_SERVER_ERROR';
  return 'OAUTH_DRIVE_API_CHECK_FAILED';
}

async function main() {
  try {
    const profileName = String(process.env.CLASP_USER || 'prihrash-ci');
    const authPath = process.env.CLASPRC_PATH || path.join(process.env.HOME || '', '.clasprc.json');
    const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    const profile = auth && auth.tokens && auth.tokens[profileName];
    if (!profile) return emit({ ok: false, reason: 'OAUTH_PROFILE_NOT_FOUND' });
    const clientId = profile.client_id;
    const clientSecret = profile.client_secret;
    const refreshToken = profile.refresh_token;
    if (![clientId, clientSecret, refreshToken].every((value) => typeof value === 'string' && value.length > 0)) {
      return emit({ ok: false, reason: 'OAUTH_PROFILE_INCOMPLETE' });
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
    const tokenPayload = await readJson(tokenResponse);
    const accessToken = tokenPayload && tokenPayload.access_token;
    if (!tokenResponse.ok || typeof accessToken !== 'string' || !accessToken) {
      return emit({ ok: false, reason: 'OAUTH_TOKEN_REFRESH_FAILED' });
    }

    const driveResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=kind', {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` }
    });
    const drivePayload = await readJson(driveResponse);
    const reason = classifyDriveApiResponse(driveResponse.status, drivePayload);
    const ok = reason === 'OAUTH_DRIVE_API_ACCESS_OK';
    emit({ ok, reason });
    if (!ok) process.exitCode = 1;
  } catch (_) {
    emit({ ok: false, reason: 'OAUTH_DRIVE_API_CHECK_INTERNAL_ERROR' });
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { classifyDriveApiResponse };
