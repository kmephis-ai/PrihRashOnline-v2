'use strict';

const fs = require('fs');
const path = require('path');
const {
  candidateVersionDescription,
  listAllVersions,
  pruneUnusedVersions,
  selectReusableVersion
} = require('./apps-script-version-retention');

const WEB_DESCRIPTION = 'PrihRashOnline Web Dashboard DEV WebApp';
const API_DESCRIPTION = 'CI-002 authenticated runtime verification';
const VERIFY_ATTEMPTS = 10;
const VERIFY_DELAY_MS = 1500;

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

function safeStatus(payload) {
  const raw = String(payload && payload.error && payload.error.status || '').toUpperCase();
  return /^[A-Z][A-Z0-9_]{0,39}$/.test(raw) ? raw : 'UNKNOWN';
}

function boundedHttpReason(prefix, response, payload) {
  const code = Number.isInteger(Number(response && response.status)) ? Number(response.status) : 0;
  return `${prefix}_HTTP_${code}_${safeStatus(payload)}`;
}

function classifyApiFailure(prefix, response, payload) {
  const status = safeStatus(payload);
  const code = Number(response && response.status || 0);
  if (code === 401 || code === 403 || status === 'PERMISSION_DENIED' || status === 'UNAUTHENTICATED') {
    return `${prefix}_OAUTH_OR_PERMISSION_REQUIRED`;
  }
  if (code === 404 || status === 'NOT_FOUND') return `${prefix}_NOT_FOUND`;
  if (code === 409 || code === 412 || status === 'FAILED_PRECONDITION' || status === 'ABORTED') {
    return `${prefix}_PRECONDITION_FAILED`;
  }
  if (code === 429 || status === 'RESOURCE_EXHAUSTED') return `${prefix}_RATE_LIMITED`;
  if (code >= 500 || status === 'INTERNAL' || status === 'UNAVAILABLE' || status === 'DEADLINE_EXCEEDED') {
    return `${prefix}_SERVER_ERROR`;
  }
  return boundedHttpReason(prefix, response, payload);
}

function hasEntryPoint(deployment, type) {
  return Array.isArray(deployment && deployment.entryPoints)
    && deployment.entryPoints.some((entry) => entry && entry.entryPointType === type);
}

function deploymentVersion(deployment) {
  const value = deployment && deployment.deploymentConfig && deployment.deploymentConfig.versionNumber;
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function deploymentDescription(deployment) {
  return String(deployment && deployment.deploymentConfig && deployment.deploymentConfig.description || '');
}

function deploymentConfig(scriptId, versionNumber, description) {
  return {
    deploymentConfig: {
      scriptId,
      versionNumber,
      manifestFileName: 'appsscript',
      description
    }
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listAllDeployments(scriptId, headers) {
  const deployments = [];
  let pageToken = '';
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(`https://script.googleapis.com/v1/projects/${encodeURIComponent(scriptId)}/deployments`);
    url.searchParams.set('pageSize', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { method: 'GET', headers });
    const payload = await readResponse(response);
    if (!response.ok || !payload.json) {
      return { ok: false, reason: classifyApiFailure('DEPLOYMENT_LIST', response, payload.json) };
    }
    if (!Array.isArray(payload.json.deployments)) return { ok: false, reason: 'DEPLOYMENT_LIST_RESPONSE_INVALID' };
    deployments.push(...payload.json.deployments);
    pageToken = String(payload.json.nextPageToken || '');
    if (!pageToken) return { ok: true, deployments };
  }
  return { ok: false, reason: 'DEPLOYMENT_LIST_PAGINATION_EXCEEDED' };
}

async function updateDeployment(scriptId, deploymentId, versionNumber, description, headers, prefix) {
  const response = await fetch(
    `https://script.googleapis.com/v1/projects/${encodeURIComponent(scriptId)}/deployments/${encodeURIComponent(deploymentId)}`,
    {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(deploymentConfig(scriptId, versionNumber, description))
    }
  );
  const payload = await readResponse(response);
  if (!response.ok || !payload.json) return { ok: false, reason: classifyApiFailure(prefix, response, payload.json) };
  if (deploymentVersion(payload.json) !== versionNumber) return { ok: false, reason: `${prefix}_VERSION_MISMATCH` };
  return { ok: true };
}

async function getDeployment(scriptId, deploymentId, headers, prefix) {
  const response = await fetch(
    `https://script.googleapis.com/v1/projects/${encodeURIComponent(scriptId)}/deployments/${encodeURIComponent(deploymentId)}`,
    { method: 'GET', headers }
  );
  const payload = await readResponse(response);
  if (!response.ok || !payload.json) return { ok: false, reason: classifyApiFailure(prefix, response, payload.json) };
  return { ok: true, deployment: payload.json };
}

async function waitForDeploymentVersion(scriptId, deploymentId, versionNumber, headers, prefix, options = {}) {
  const attempts = Number.isInteger(options.attempts) && options.attempts > 0 ? options.attempts : VERIFY_ATTEMPTS;
  const delayMs = Number.isInteger(options.delayMs) && options.delayMs >= 0 ? options.delayMs : VERIFY_DELAY_MS;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const current = await getDeployment(scriptId, deploymentId, headers, prefix);
    if (!current.ok) return current;
    if (deploymentVersion(current.deployment) === versionNumber) {
      return { ok: true, attempts: attempt };
    }
    if (attempt < attempts && delayMs > 0) await sleep(delayMs);
  }
  return { ok: false, reason: `${prefix}_VERSION_NOT_VISIBLE` };
}

async function rollbackDeployments(scriptId, apiDeployment, webDeployment, previousApiVersion, previousWebVersion, headers) {
  await Promise.all([
    updateDeployment(
      scriptId,
      apiDeployment.deploymentId,
      previousApiVersion,
      deploymentDescription(apiDeployment) || API_DESCRIPTION,
      headers,
      'API_DEPLOYMENT_ROLLBACK'
    ),
    updateDeployment(
      scriptId,
      webDeployment.deploymentId,
      previousWebVersion,
      deploymentDescription(webDeployment) || WEB_DESCRIPTION,
      headers,
      'WEB_DEPLOYMENT_ROLLBACK'
    )
  ]);
}

async function main() {
  try {
    const scriptId = String(process.env.APPS_SCRIPT_ID || '');
    const apiDeploymentId = String(process.env.APPS_SCRIPT_API_DEPLOYMENT_ID || '');
    const candidateSha = String(process.env.CANDIDATE_SHA || '');
    const sourceTreeHash = String(process.env.SOURCE_TREE_HASH || '');
    const profileName = String(process.env.CLASP_USER || 'prihrash-ci');
    const authPath = process.env.CLASPRC_PATH || path.join(process.env.HOME || '', '.clasprc.json');

    if (!/^[A-Za-z0-9_-]{20,}$/.test(scriptId)) return emit({ ok: false, reason: 'APPS_SCRIPT_ID_INVALID' });
    if (!/^AKfy[A-Za-z0-9_-]+$/.test(apiDeploymentId)) return emit({ ok: false, reason: 'API_DEPLOYMENT_ID_INVALID' });
    if (!/^[0-9a-f]{40}$/.test(candidateSha)) return emit({ ok: false, reason: 'CANDIDATE_SHA_INVALID' });
    if (!/^[0-9a-f]{64}$/.test(sourceTreeHash)) return emit({ ok: false, reason: 'SOURCE_TREE_HASH_INVALID' });

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
    const tokenPayload = await readResponse(tokenResponse);
    const accessToken = tokenPayload.json && tokenPayload.json.access_token;
    if (!tokenResponse.ok || typeof accessToken !== 'string' || !accessToken) {
      return emit({ ok: false, reason: 'OAUTH_TOKEN_REFRESH_FAILED' });
    }
    const headers = { authorization: `Bearer ${accessToken}` };

    const listed = await listAllDeployments(scriptId, headers);
    if (!listed.ok) return emit({ ok: false, reason: listed.reason });
    const apiMatches = listed.deployments.filter((deployment) => deployment && deployment.deploymentId === apiDeploymentId);
    if (apiMatches.length !== 1 || !hasEntryPoint(apiMatches[0], 'EXECUTION_API')) {
      return emit({ ok: false, reason: 'API_DEPLOYMENT_IDENTITY_INVALID' });
    }
    const webMatches = listed.deployments.filter((deployment) => deploymentDescription(deployment) === WEB_DESCRIPTION && hasEntryPoint(deployment, 'WEB_APP'));
    if (webMatches.length !== 1) return emit({ ok: false, reason: 'WEB_DEPLOYMENT_IDENTITY_INVALID' });

    const apiDeployment = apiMatches[0];
    const webDeployment = webMatches[0];
    const previousApiVersion = deploymentVersion(apiDeployment);
    const previousWebVersion = deploymentVersion(webDeployment);
    if (!previousApiVersion || !previousWebVersion) return emit({ ok: false, reason: 'DEPLOYMENT_PREVIOUS_VERSION_INVALID' });

    const versionInventory = await listAllVersions(scriptId, headers);
    if (!versionInventory.ok) return emit({ ok: false, reason: versionInventory.reason });
    const reusableVersion = selectReusableVersion(
      versionInventory.versions,
      listed.deployments,
      candidateSha,
      sourceTreeHash
    );
    const retention = await pruneUnusedVersions({
      scriptId,
      headers,
      deployments: listed.deployments,
      versions: versionInventory.versions,
      extraProtectedVersions: reusableVersion ? [reusableVersion] : []
    });
    if (!retention.ok) return emit({ ok: false, reason: retention.reason });

    let versionNumber = reusableVersion;
    let versionReused = Boolean(reusableVersion);
    if (!versionNumber) {
      const versionResponse = await fetch(`https://script.googleapis.com/v1/projects/${encodeURIComponent(scriptId)}/versions`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ description: candidateVersionDescription(candidateSha, sourceTreeHash) })
      });
      const versionPayload = await readResponse(versionResponse);
      if (!versionResponse.ok || !versionPayload.json) {
        return emit({ ok: false, reason: classifyApiFailure('VERSION_CREATE', versionResponse, versionPayload.json) });
      }
      versionNumber = Number(versionPayload.json.versionNumber);
      versionReused = false;
    }
    if (!Number.isInteger(versionNumber) || versionNumber <= 0) return emit({ ok: false, reason: 'VERSION_CREATE_RESPONSE_INVALID' });

    if (previousApiVersion === versionNumber && previousWebVersion === versionNumber) {
      return emit({
        ok: true,
        versionNumber,
        versionReused: true,
        deploymentsChanged: false,
        retentionReason: retention.reason,
        versionsDeleted: Number(retention.evidence && retention.evidence.deleted_count || 0)
      });
    }

    const apiUpdated = await updateDeployment(scriptId, apiDeploymentId, versionNumber, API_DESCRIPTION, headers, 'API_DEPLOYMENT_UPDATE');
    if (!apiUpdated.ok) return emit({ ok: false, reason: apiUpdated.reason });

    const webUpdated = await updateDeployment(scriptId, webDeployment.deploymentId, versionNumber, WEB_DESCRIPTION, headers, 'WEB_DEPLOYMENT_UPDATE');
    if (!webUpdated.ok) {
      await updateDeployment(scriptId, apiDeploymentId, previousApiVersion, deploymentDescription(apiDeployment) || API_DESCRIPTION, headers, 'API_DEPLOYMENT_ROLLBACK');
      return emit({ ok: false, reason: webUpdated.reason });
    }

    // Deployment update responses are authoritative for the requested version, but the
    // subsequent GET view can lag briefly. Poll a small bounded window; never treat a
    // stale read as success, and roll both stable deployments back if exact visibility
    // is not established within the window.
    const [apiVerified, webVerified] = await Promise.all([
      waitForDeploymentVersion(scriptId, apiDeploymentId, versionNumber, headers, 'API_DEPLOYMENT_VERIFY'),
      waitForDeploymentVersion(scriptId, webDeployment.deploymentId, versionNumber, headers, 'WEB_DEPLOYMENT_VERIFY')
    ]);
    if (!apiVerified.ok || !webVerified.ok) {
      await rollbackDeployments(scriptId, apiDeployment, webDeployment, previousApiVersion, previousWebVersion, headers);
      const reason = !apiVerified.ok
        ? apiVerified.reason
        : (!webVerified.ok ? webVerified.reason : 'DEPLOYMENT_EXACT_VERSION_VERIFY_FAILED');
      return emit({ ok: false, reason });
    }

    return emit({
      ok: true,
      versionNumber,
      versionReused,
      deploymentsChanged: true,
      retentionReason: retention.reason,
      versionsDeleted: Number(retention.evidence && retention.evidence.deleted_count || 0)
    });
  } catch (_) {
    return emit({ ok: false, reason: 'DEPLOYMENT_PROMOTION_INTERNAL_ERROR' });
  }
}

if (require.main === module) main();

module.exports = {
  WEB_DESCRIPTION,
  API_DESCRIPTION,
  VERIFY_ATTEMPTS,
  VERIFY_DELAY_MS,
  safeStatus,
  boundedHttpReason,
  classifyApiFailure,
  hasEntryPoint,
  deploymentVersion,
  deploymentDescription,
  deploymentConfig,
  waitForDeploymentVersion
};
