'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_HIGH_WATER = 180;
const DEFAULT_TARGET = 160;
const DEFAULT_RECENT_UNUSED_RESERVE = 12;
const MAX_PAGES = 20;
const PAGE_SIZE = 50;

// Google Apps Script REST v1 exposes projects.versions create/get/list only.
// Version deletion is an IDE Project History operation, not a supported REST call.
// Keep this explicit so trusted automation never treats a 404 from an invented
// DELETE /versions/{versionNumber} endpoint as successful retention.
const VERSION_DELETE_API_SUPPORTED = false;

function safeStatus(payload) {
  const raw = String(payload && payload.error && payload.error.status || '').toUpperCase();
  return /^[A-Z][A-Z0-9_]{0,39}$/.test(raw) ? raw : 'UNKNOWN';
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

function boundedReason(prefix, response, payload) {
  const code = Number.isInteger(Number(response && response.status)) ? Number(response.status) : 0;
  return `${prefix}_HTTP_${code}_${safeStatus(payload)}`;
}

function versionNumber(value) {
  const number = Number(value && typeof value === 'object' ? value.versionNumber : value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function deploymentVersion(deployment) {
  return versionNumber(deployment && deployment.deploymentConfig && deployment.deploymentConfig.versionNumber);
}

function uniqueSortedVersionNumbers(values) {
  return [...new Set((values || []).map(versionNumber).filter(Boolean))].sort((a, b) => a - b);
}

function candidateVersionDescription(candidateSha, sourceTreeHash) {
  if (!/^[0-9a-f]{40}$/.test(String(candidateSha || ''))) throw new Error('candidate SHA invalid');
  if (!/^[0-9a-f]{64}$/.test(String(sourceTreeHash || ''))) throw new Error('source tree hash invalid');
  return `CI exact candidate ${candidateSha} tree ${sourceTreeHash}`;
}

function selectReusableVersion(versions, deployments, candidateSha, sourceTreeHash) {
  const exactDescription = candidateVersionDescription(candidateSha, sourceTreeHash);
  const legacyDescription = `CI exact candidate ${candidateSha}`;
  const matches = (versions || [])
    .filter((version) => {
      const description = String(version && version.description || '');
      return description === exactDescription || description === legacyDescription;
    })
    .map(versionNumber)
    .filter(Boolean)
    .sort((a, b) => b - a);
  if (!matches.length) return 0;

  const deploymentVersions = uniqueSortedVersionNumbers((deployments || []).map(deploymentVersion));
  const activeMatch = matches.find((number) => deploymentVersions.includes(number));
  return activeMatch || matches[0];
}

function planVersionRetention(input) {
  const versions = Array.isArray(input && input.versions) ? input.versions : [];
  const deployments = Array.isArray(input && input.deployments) ? input.deployments : [];
  const highWater = Number(input && input.highWater == null ? DEFAULT_HIGH_WATER : input.highWater);
  const target = Number(input && input.target == null ? DEFAULT_TARGET : input.target);
  const recentUnusedReserve = Number(input && input.recentUnusedReserve == null
    ? DEFAULT_RECENT_UNUSED_RESERVE
    : input.recentUnusedReserve);
  if (!Number.isInteger(highWater) || !Number.isInteger(target) || !Number.isInteger(recentUnusedReserve) ||
      target < 1 || highWater <= target || highWater > 200 || recentUnusedReserve < 1) {
    throw new Error('version retention policy invalid');
  }

  const numbers = versions.map(versionNumber);
  if (numbers.some((number) => !number) || new Set(numbers).size !== numbers.length) {
    throw new Error('version inventory invalid');
  }
  numbers.sort((a, b) => a - b);
  const protectedVersions = new Set(uniqueSortedVersionNumbers([
    ...deployments.map(deploymentVersion),
    ...((input && input.extraProtectedVersions) || [])
  ]));
  const unusedNewestFirst = numbers.filter((number) => !protectedVersions.has(number)).sort((a, b) => b - a);
  const reservedUnused = new Set(unusedNewestFirst.slice(0, recentUnusedReserve));
  const deletable = numbers.filter((number) => !protectedVersions.has(number) && !reservedUnused.has(number));

  if (numbers.length <= highWater) {
    return Object.freeze({
      ok: true,
      reason: 'BELOW_HIGH_WATER',
      before_count: numbers.length,
      expected_after_count: numbers.length,
      protected_count: protectedVersions.size,
      recent_unused_reserve_count: reservedUnused.size,
      delete_version_numbers: Object.freeze([])
    });
  }

  const required = numbers.length - target;
  if (deletable.length < required) {
    return Object.freeze({
      ok: false,
      reason: 'INSUFFICIENT_UNUSED_VERSION_CAPACITY',
      before_count: numbers.length,
      expected_after_count: numbers.length,
      protected_count: protectedVersions.size,
      recent_unused_reserve_count: reservedUnused.size,
      delete_version_numbers: Object.freeze([])
    });
  }
  const selected = deletable.slice(0, required);
  return Object.freeze({
    ok: true,
    reason: 'RETENTION_REQUIRED',
    before_count: numbers.length,
    expected_after_count: numbers.length - selected.length,
    protected_count: protectedVersions.size,
    recent_unused_reserve_count: reservedUnused.size,
    delete_version_numbers: Object.freeze(selected)
  });
}

async function listAllVersions(scriptId, headers, fetchImpl = fetch) {
  const versions = [];
  let pageToken = '';
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(`https://script.googleapis.com/v1/projects/${encodeURIComponent(scriptId)}/versions`);
    url.searchParams.set('pageSize', String(PAGE_SIZE));
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetchImpl(url, { method: 'GET', headers });
    const payload = await readResponse(response);
    if (!response.ok || !payload.json || !Array.isArray(payload.json.versions)) {
      return { ok: false, reason: boundedReason('VERSION_LIST', response, payload.json) };
    }
    versions.push(...payload.json.versions);
    pageToken = String(payload.json.nextPageToken || '');
    if (!pageToken) return { ok: true, versions };
  }
  return { ok: false, reason: 'VERSION_LIST_PAGINATION_EXCEEDED' };
}

async function listAllDeployments(scriptId, headers, fetchImpl = fetch) {
  const deployments = [];
  let pageToken = '';
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(`https://script.googleapis.com/v1/projects/${encodeURIComponent(scriptId)}/deployments`);
    url.searchParams.set('pageSize', String(PAGE_SIZE));
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetchImpl(url, { method: 'GET', headers });
    const payload = await readResponse(response);
    if (!response.ok || !payload.json || !Array.isArray(payload.json.deployments)) {
      return { ok: false, reason: boundedReason('RETENTION_DEPLOYMENT_LIST', response, payload.json) };
    }
    deployments.push(...payload.json.deployments);
    pageToken = String(payload.json.nextPageToken || '');
    if (!pageToken) return { ok: true, deployments };
  }
  return { ok: false, reason: 'RETENTION_DEPLOYMENT_LIST_PAGINATION_EXCEEDED' };
}

/**
 * Compatibility entrypoint used by trusted deploy/retention workflows.
 *
 * The function intentionally performs inventory + planning only. Apps Script's
 * supported REST API cannot delete project versions, so a required cleanup is
 * surfaced as MANUAL_CLEANUP_REQUIRED while returning ok=true: promotion may
 * continue while capacity remains, and no unsupported mutation is attempted.
 */
async function pruneUnusedVersions(options) {
  const scriptId = String(options && options.scriptId || '');
  const headers = options && options.headers;
  const fetchImpl = options && options.fetchImpl || fetch;
  if (!/^[A-Za-z0-9_-]{20,}$/.test(scriptId) || !headers || typeof headers.authorization !== 'string') {
    return { ok: false, reason: 'VERSION_RETENTION_INPUT_INVALID' };
  }
  const deploymentInventory = options.deployments
    ? { ok: true, deployments: options.deployments }
    : await listAllDeployments(scriptId, headers, fetchImpl);
  if (!deploymentInventory.ok) return deploymentInventory;
  const versionInventory = options.versions
    ? { ok: true, versions: options.versions }
    : await listAllVersions(scriptId, headers, fetchImpl);
  if (!versionInventory.ok) return versionInventory;

  let plan;
  try {
    plan = planVersionRetention({
      versions: versionInventory.versions,
      deployments: deploymentInventory.deployments,
      extraProtectedVersions: options.extraProtectedVersions || [],
      highWater: options.highWater,
      target: options.target,
      recentUnusedReserve: options.recentUnusedReserve
    });
  } catch (_) {
    return { ok: false, reason: 'VERSION_RETENTION_INVENTORY_INVALID' };
  }
  if (!plan.ok) return { ok: false, reason: plan.reason, evidence: plan };

  const manualCleanupCandidateCount = plan.delete_version_numbers.length;
  return {
    ok: true,
    reason: manualCleanupCandidateCount ? 'MANUAL_CLEANUP_REQUIRED' : plan.reason,
    evidence: Object.freeze({
      before_count: plan.before_count,
      after_count: plan.before_count,
      expected_after_count: plan.expected_after_count,
      deleted_count: 0,
      manual_cleanup_candidate_count: manualCleanupCandidateCount,
      protected_count: plan.protected_count,
      recent_unused_reserve_count: plan.recent_unused_reserve_count,
      version_delete_api_supported: VERSION_DELETE_API_SUPPORTED
    })
  };
}

async function ownerAccessToken(profileName) {
  const authPath = process.env.CLASPRC_PATH || path.join(process.env.HOME || '', '.clasprc.json');
  const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
  const profile = auth && auth.tokens && auth.tokens[profileName];
  if (!profile || !profile.client_id || !profile.client_secret || !profile.refresh_token) {
    return { ok: false, reason: 'OAUTH_PROFILE_INCOMPLETE' };
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: profile.client_id,
      client_secret: profile.client_secret,
      refresh_token: profile.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  const payload = await readResponse(response);
  const accessToken = payload.json && payload.json.access_token;
  if (!response.ok || typeof accessToken !== 'string' || !accessToken) {
    return { ok: false, reason: 'OAUTH_TOKEN_REFRESH_FAILED' };
  }
  return { ok: true, accessToken };
}

async function main() {
  try {
    if (!process.argv.includes('--apply')) return console.log(JSON.stringify({ ok: false, reason: 'APPLY_FLAG_REQUIRED' }));
    const scriptId = String(process.env.APPS_SCRIPT_ID || '');
    const profileName = String(process.env.CLASP_USER || 'prihrash-ci');
    const token = await ownerAccessToken(profileName);
    if (!token.ok) return console.log(JSON.stringify(token));
    const result = await pruneUnusedVersions({
      scriptId,
      headers: { authorization: `Bearer ${token.accessToken}` }
    });
    const evidence = result && result.evidence || {};
    console.log(JSON.stringify({
      ok: result.ok === true,
      reason: String(result.reason || 'VERSION_RETENTION_RESULT_INVALID'),
      before_count: Number(evidence.before_count || 0),
      after_count: Number(evidence.after_count || evidence.before_count || 0),
      deleted_count: 0,
      manual_cleanup_candidate_count: Number(evidence.manual_cleanup_candidate_count || 0),
      protected_count: Number(evidence.protected_count || 0),
      recent_unused_reserve_count: Number(evidence.recent_unused_reserve_count || 0),
      version_delete_api_supported: false
    }));
    if (!result.ok) process.exitCode = 1;
  } catch (_) {
    console.log(JSON.stringify({ ok: false, reason: 'VERSION_RETENTION_INTERNAL_ERROR' }));
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  DEFAULT_HIGH_WATER,
  DEFAULT_TARGET,
  DEFAULT_RECENT_UNUSED_RESERVE,
  VERSION_DELETE_API_SUPPORTED,
  versionNumber,
  deploymentVersion,
  candidateVersionDescription,
  selectReusableVersion,
  planVersionRetention,
  listAllVersions,
  listAllDeployments,
  pruneUnusedVersions
};
