'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const SOURCE_FORMAT = 'PRH_BACKUP_SOURCE_V1';
const SOURCE_SCHEMA_VERSION = 1;
const API_DEPLOYMENT_DESCRIPTION = 'CI-002 authenticated runtime verification';
const MAX_CHUNK_ROWS = 200;

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

function boundedReason(prefix, status) {
  const code = Number(status || 0);
  return `${prefix}_HTTP_${Number.isInteger(code) ? code : 0}`;
}

function knownSourceReason(payload, fallback) {
  const message = String(
    payload && payload.error && payload.error.details && payload.error.details[0]
      && payload.error.details[0].errorMessage || ''
  );
  const match = message.match(/BACKUP_SOURCE_[A-Z0-9_]+/);
  return match ? match[0] : fallback;
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function readPrivateConfig(authPath, projectPath, profileName) {
  const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
  const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
  const profile = auth && auth.tokens && auth.tokens[profileName];
  if (!profile) throw new Error('OAUTH_PROFILE_NOT_FOUND');
  const clientId = profile.client_id;
  const clientSecret = profile.client_secret;
  const refreshToken = profile.refresh_token;
  if (![clientId, clientSecret, refreshToken].every((value) => typeof value === 'string' && value.length > 0)) {
    throw new Error('OAUTH_PROFILE_INCOMPLETE');
  }
  const scriptId = String(project && project.scriptId || '');
  if (!/^[A-Za-z0-9_-]{20,}$/.test(scriptId)) throw new Error('APPS_SCRIPT_ID_INVALID');
  return { clientId, clientSecret, refreshToken, scriptId };
}

async function refreshToken(config) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token'
    })
  });
  const payload = await readJsonResponse(response);
  const accessToken = payload && payload.access_token;
  if (!response.ok || typeof accessToken !== 'string' || !accessToken) {
    throw new Error(boundedReason('OAUTH_TOKEN_REFRESH', response.status));
  }
  return accessToken;
}

async function resolveApiDeployment(scriptId, accessToken) {
  const headers = { authorization: `Bearer ${accessToken}` };
  let pageToken = '';
  const matches = [];
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(`https://script.googleapis.com/v1/projects/${encodeURIComponent(scriptId)}/deployments`);
    url.searchParams.set('pageSize', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers });
    const payload = await readJsonResponse(response);
    if (!response.ok || !payload || !Array.isArray(payload.deployments)) {
      throw new Error(boundedReason('DEPLOYMENT_LIST', response.status));
    }
    for (const deployment of payload.deployments) {
      const description = String(deployment && deployment.deploymentConfig && deployment.deploymentConfig.description || '');
      const executionApi = Array.isArray(deployment && deployment.entryPoints)
        && deployment.entryPoints.some((entry) => entry && entry.entryPointType === 'EXECUTION_API');
      if (description === API_DEPLOYMENT_DESCRIPTION && executionApi) matches.push(deployment);
    }
    pageToken = String(payload.nextPageToken || '');
    if (!pageToken) break;
  }
  if (matches.length !== 1 || !/^AKfy[A-Za-z0-9_-]+$/.test(String(matches[0].deploymentId || ''))) {
    throw new Error('API_DEPLOYMENT_IDENTITY_INVALID');
  }
  return String(matches[0].deploymentId);
}

async function runFunction(deploymentId, accessToken, functionName, parameters, stagePrefix) {
  const response = await fetch(`https://script.googleapis.com/v1/scripts/${encodeURIComponent(deploymentId)}:run`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ function: functionName, parameters, devMode: false })
  });
  const payload = await readJsonResponse(response);
  if (!response.ok || !payload) throw new Error(boundedReason(stagePrefix, response.status));
  if (payload.error) throw new Error(knownSourceReason(payload, `${stagePrefix}_EXECUTION_FAILED`));
  const result = payload.response && payload.response.result;
  if (typeof result !== 'string') throw new Error(`${stagePrefix}_RESPONSE_INVALID`);
  try {
    return JSON.parse(result);
  } catch (_) {
    throw new Error(`${stagePrefix}_RESPONSE_INVALID`);
  }
}

async function probe(options) {
  const stages = [];
  let config;
  try {
    config = readPrivateConfig(options.authPath, options.projectPath, options.profileName);
    stages.push('CONFIG');
  } catch (error) {
    return { status: 'FAIL', stage: 'CONFIG', reason: /^[A-Z][A-Z0-9_]+$/.test(String(error.message || '')) ? error.message : 'CONFIG_READ_FAILED' };
  }

  let accessToken;
  try {
    accessToken = await refreshToken(config);
    stages.push('OAUTH');
  } catch (error) {
    return { status: 'FAIL', stage: 'OAUTH', reason: /^[A-Z][A-Z0-9_]+$/.test(String(error.message || '')) ? error.message : 'OAUTH_STAGE_FAILED' };
  }

  let deploymentId;
  try {
    deploymentId = await resolveApiDeployment(config.scriptId, accessToken);
    stages.push('DEPLOYMENT');
  } catch (error) {
    return { status: 'FAIL', stage: 'DEPLOYMENT', reason: /^[A-Z][A-Z0-9_]+$/.test(String(error.message || '')) ? error.message : 'DEPLOYMENT_STAGE_FAILED' };
  }

  let describe;
  try {
    describe = await runFunction(deploymentId, accessToken, 'prhBackupDescribe', [], 'DESCRIBE');
    if (describe.format !== SOURCE_FORMAT || describe.schemaVersion !== SOURCE_SCHEMA_VERSION
      || !Array.isArray(describe.sheets) || describe.sheets.length !== describe.sheetCount) {
      throw new Error('BACKUP_SOURCE_METADATA_INVALID');
    }
    stages.push('DESCRIBE');
  } catch (error) {
    return { status: 'FAIL', stage: 'DESCRIBE', reason: /^[A-Z][A-Z0-9_]+$/.test(String(error.message || '')) ? error.message : 'DESCRIBE_STAGE_FAILED' };
  }

  try {
    if (describe.sheets.length > 0) {
      const metadata = describe.sheets[0];
      if (!metadata || !metadata.name || !Number.isInteger(metadata.lastRow) || !Number.isInteger(metadata.lastColumn)) {
        throw new Error('BACKUP_SOURCE_SHEET_INVALID');
      }
      if (metadata.lastRow > 0) {
        const chunk = await runFunction(deploymentId, accessToken, 'prhBackupReadChunk', [{
          sheetName: metadata.name,
          startRow: 1,
          maxRows: Math.min(1, MAX_CHUNK_ROWS)
        }], 'CHUNK');
        if (chunk.format !== SOURCE_FORMAT || chunk.schemaVersion !== SOURCE_SCHEMA_VERSION
          || chunk.startRow !== 1 || !Array.isArray(chunk.rows) || chunk.rowCount !== chunk.rows.length
          || chunk.columnCount !== metadata.lastColumn) {
          throw new Error('BACKUP_SOURCE_CHUNK_INVALID');
        }
      }
    }
    stages.push('CHUNK');
  } catch (error) {
    return { status: 'FAIL', stage: 'CHUNK', reason: /^[A-Z][A-Z0-9_]+$/.test(String(error.message || '')) ? error.message : 'CHUNK_STAGE_FAILED' };
  }

  return { status: 'PASS', stage: 'COMPLETE', reason: 'OK', stages };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const authPath = path.resolve(args.auth || path.join(os.homedir(), '.clasprc.json'));
  const projectPath = path.resolve(args.project || '.clasp.json');
  const profileName = String(args.user || 'prihrash-ci');
  try {
    emit(await probe({ authPath, projectPath, profileName }));
  } catch (_) {
    emit({ status: 'FAIL', stage: 'INTERNAL', reason: 'PRIVATE_BACKUP_PROBE_FAILED' });
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  SOURCE_FORMAT,
  SOURCE_SCHEMA_VERSION,
  API_DEPLOYMENT_DESCRIPTION,
  boundedReason,
  knownSourceReason,
  readPrivateConfig,
  probe
};
