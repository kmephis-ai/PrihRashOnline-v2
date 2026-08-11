'use strict';

const fs = require('fs');
const path = require('path');
const { classifyFailure, executionErrorReason } = require('./apps-script-api-exec');

const FUNCTION_NAME = 'prhPerfRecBaselineProbeJson';
const MODES = new Set(['COLD', 'WARM']);
const SHA_RE = /^[0-9a-f]{40}$/;
const HASH_PREFIX_RE = /^[0-9a-f]{12}$/;
const PHASE_KEYS = Object.freeze([
  'revision_probe_ms', 'cache_read_ms', 'cache_write_ms', 'settings_read_ms',
  'sheet_read_ms', 'canonical_snapshot_ms', 'home_build_ms', 'total_ms'
]);
const COUNTER_KEYS = Object.freeze([
  'source_revision_probe_count', 'gateway_call_count', 'range_read_count',
  'cell_read_count', 'canonical_snapshot_read_count', 'snapshot_reuse_count',
  'unique_dimension_hash_count', 'dimension_hash_memo_hit_count',
  'cache_payload_utf8_bytes'
]);

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function fail(reason) {
  emit({ ok: false, reason });
  process.exitCode = 1;
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return { json: null, text: '' };
  try { return { json: JSON.parse(text), text }; } catch (_) { return { json: null, text }; }
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function sanitizeTelemetry(raw, requestedMode, wallMs) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('PERF_BASELINE_RESULT_INVALID');
  if (raw.schema !== 'PRH_PERF_REC_TELEMETRY_V1' || raw.roadmap_id !== 'PERF-REC-001') {
    throw new Error('PERF_BASELINE_SCHEMA_INVALID');
  }
  if (raw.mode !== requestedMode || !SHA_RE.test(String(raw.candidate_sha || ''))) {
    throw new Error('PERF_BASELINE_IDENTITY_INVALID');
  }
  if (!raw.phase_ms || typeof raw.phase_ms !== 'object' || Array.isArray(raw.phase_ms)) {
    throw new Error('PERF_BASELINE_PHASES_INVALID');
  }

  const phaseMs = {};
  for (const key of PHASE_KEYS) {
    const value = nonNegativeInteger(raw.phase_ms[key]);
    if (value == null) throw new Error('PERF_BASELINE_PHASES_INVALID');
    phaseMs[key] = value;
  }
  const counters = {};
  for (const key of COUNTER_KEYS) {
    const value = nonNegativeInteger(raw[key]);
    if (value == null) throw new Error('PERF_BASELINE_COUNTERS_INVALID');
    counters[key] = value;
  }
  const sourcePrefix = String(raw.source_revision_hash_prefix || '');
  const canonicalPrefix = raw.canonical_revision_hash_prefix == null
    ? null
    : String(raw.canonical_revision_hash_prefix);
  if (!HASH_PREFIX_RE.test(sourcePrefix) || (canonicalPrefix != null && !HASH_PREFIX_RE.test(canonicalPrefix))) {
    throw new Error('PERF_BASELINE_REVISION_INVALID');
  }
  const cacheStatus = String(raw.cache_status || '');
  const reasonCode = String(raw.reason_code || '');
  if (!/^[A-Z_]+$/.test(cacheStatus) || !/^[A-Z0-9_]+$/.test(reasonCode)) {
    throw new Error('PERF_BASELINE_DECISION_INVALID');
  }

  return {
    ok: true,
    schema: raw.schema,
    roadmap_id: raw.roadmap_id,
    candidate_sha: raw.candidate_sha,
    mode: requestedMode,
    cache_status: cacheStatus,
    reason_code: reasonCode,
    phase_ms: phaseMs,
    ...counters,
    source_revision_hash_prefix: sourcePrefix,
    canonical_revision_hash_prefix: canonicalPrefix,
    execution_wall_ms: Math.max(0, Math.round(wallMs))
  };
}

async function main() {
  try {
    const mode = String(process.argv[2] || '').trim().toUpperCase();
    if (!MODES.has(mode)) return fail('PERF_BASELINE_MODE_INVALID');

    const deploymentId = String(process.env.APPS_SCRIPT_API_DEPLOYMENT_ID || '');
    const profileName = String(process.env.CLASP_USER || 'prihrash-ci');
    const authPath = process.env.CLASPRC_PATH || path.join(process.env.HOME || '', '.clasprc.json');
    if (!/^AKfy[A-Za-z0-9_-]+$/.test(deploymentId)) return fail('API_EXECUTABLE_ID_INVALID');

    const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    const profile = auth && auth.tokens && auth.tokens[profileName];
    if (!profile) return fail('OAUTH_PROFILE_NOT_FOUND');
    const clientId = profile.client_id;
    const clientSecret = profile.client_secret;
    const refreshToken = profile.refresh_token;
    if (![clientId, clientSecret, refreshToken].every((value) => typeof value === 'string' && value.length > 0)) {
      return fail('OAUTH_PROFILE_INCOMPLETE');
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
      return fail('OAUTH_TOKEN_REFRESH_FAILED');
    }

    const started = Date.now();
    const runResponse = await fetch(`https://script.googleapis.com/v1/scripts/${encodeURIComponent(deploymentId)}:run`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ function: FUNCTION_NAME, parameters: [mode], devMode: false })
    });
    const wallMs = Date.now() - started;
    const runPayload = await readResponse(runResponse);
    if (!runResponse.ok) {
      return fail(classifyFailure(runResponse.status, runPayload.text, runPayload.json));
    }
    if (!runPayload.json || runPayload.json.done === false) {
      return fail('AUTHENTICATED_EXECUTION_RESULT_INVALID');
    }
    if (runPayload.json.error) {
      return fail(executionErrorReason(runPayload.json) || 'AUTHENTICATED_EXECUTION_RESULT_INVALID');
    }
    if (!runPayload.json.response || typeof runPayload.json.response.result !== 'string') {
      return fail('AUTHENTICATED_EXECUTION_RESULT_INVALID');
    }

    let raw;
    try { raw = JSON.parse(runPayload.json.response.result); } catch (_) { return fail('PERF_BASELINE_JSON_INVALID'); }
    emit(sanitizeTelemetry(raw, mode, wallMs));
  } catch (error) {
    const reason = error && /^[A-Z0-9_:.-]+$/.test(String(error.message || ''))
      ? String(error.message).slice(0, 120)
      : 'PERF_BASELINE_EXECUTOR_FAILED';
    fail(reason);
  }
}

if (require.main === module) main();

module.exports = { sanitizeTelemetry, PHASE_KEYS, COUNTER_KEYS, FUNCTION_NAME };
