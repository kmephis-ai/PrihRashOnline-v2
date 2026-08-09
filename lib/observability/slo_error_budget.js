'use strict';

const CONTRACT = require('./slo_error_budget.v1.json');

const PPM = CONTRACT.precision.ratio_denominator_ppm;
const BPS = CONTRACT.precision.budget_consumed_denominator_bps;
const SLI_IDS = Object.freeze(Object.keys(CONTRACT.sli_profiles));
const STATE_RANK = Object.freeze(Object.fromEntries(
  CONTRACT.service_state_order.map((state, index) => [state, index])
));

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function isSafeNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function assertCode(value, code) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.:-]{1,64}$/.test(value)) fail(code);
  return value;
}

function assertContract() {
  if (CONTRACT.schema !== 'PRH_SLO_ERROR_BUDGET_V1' || CONTRACT.version !== '1.0.0' ||
      CONTRACT.roadmap_id !== 'OBS-010') fail('SLO_CONTRACT_INVALID');
  if (PPM !== 1000000 || BPS !== 10000) fail('SLO_PRECISION_INVALID');
  if (CONTRACT.privacy.financial_payload_allowed !== false ||
      CONTRACT.privacy.real_financial_aggregates_allowed !== false ||
      CONTRACT.authority.io !== false || CONTRACT.authority.network !== false ||
      CONTRACT.authority.ui !== false || CONTRACT.authority.financial_write !== false ||
      CONTRACT.authority.financial_correctness !== false ||
      CONTRACT.authority.external_provider_required !== false ||
      CONTRACT.authority.paid_dependency_required !== false) {
    fail('SLO_AUTHORITY_INVALID');
  }
  for (const sli of SLI_IDS) {
    const profile = CONTRACT.sli_profiles[sli];
    if (!Number.isInteger(profile.objective_ppm) || profile.objective_ppm <= 0 || profile.objective_ppm >= PPM) {
      fail('SLO_OBJECTIVE_INVALID', sli);
    }
    if (!Number.isInteger(profile.min_samples) || profile.min_samples <= 0) fail('SLO_MIN_SAMPLES_INVALID', sli);
    if ((profile.kind === 'LATENCY_THRESHOLD_RATIO' || profile.kind === 'AGE_THRESHOLD_RATIO') &&
        !isSafeNonNegativeInteger(profile.threshold_ms)) fail('SLO_THRESHOLD_INVALID', sli);
  }
  return true;
}

function normalizeWindow(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const allowed = new Set(['start_ms', 'end_ms']);
  for (const key of Object.keys(source)) if (!allowed.has(key)) fail('SLO_WINDOW_FIELD_UNKNOWN', key);
  if (!isSafeNonNegativeInteger(source.start_ms) || !isSafeNonNegativeInteger(source.end_ms) ||
      source.end_ms <= source.start_ms) fail('SLO_WINDOW_INVALID');
  return Object.freeze({ start_ms: source.start_ms, end_ms: source.end_ms });
}

function normalizeTelemetryState(value) {
  const state = value === undefined ? 'PASS' : String(value);
  if (!CONTRACT.telemetry_state.allowed.includes(state)) fail('SLO_TELEMETRY_STATE_INVALID', state);
  return state;
}

function observationShape(sli) {
  const profile = CONTRACT.sli_profiles[sli];
  if (!profile) fail('SLO_ID_UNKNOWN', String(sli));
  switch (profile.kind) {
    case 'BOOLEAN_OK_RATIO': return Object.freeze({ fields: ['sli', 'ts_ms', 'ok'], value: 'ok' });
    case 'LATENCY_THRESHOLD_RATIO': return Object.freeze({ fields: ['sli', 'ts_ms', 'latency_ms'], value: 'latency_ms' });
    case 'AGE_THRESHOLD_RATIO': return Object.freeze({ fields: ['sli', 'ts_ms', 'age_ms'], value: 'age_ms' });
    case 'ERROR_FREE_RATIO': return Object.freeze({ fields: ['sli', 'ts_ms', 'error'], value: 'error' });
    default: fail('SLO_KIND_UNSUPPORTED', profile.kind);
  }
}

function normalizeObservation(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : null;
  if (!source) fail('SLO_OBSERVATION_INVALID');
  const sli = String(source.sli || '');
  const shape = observationShape(sli);
  const allowed = new Set(shape.fields);
  for (const key of Object.keys(source)) if (!allowed.has(key)) fail('SLO_OBSERVATION_FIELD_UNKNOWN', `${sli}:${key}`);
  if (!isSafeNonNegativeInteger(source.ts_ms)) fail('SLO_OBSERVATION_TIMESTAMP_INVALID', sli);

  const output = { sli, ts_ms: source.ts_ms };
  if (shape.value === 'ok') {
    if (typeof source.ok !== 'boolean') fail('SLO_OBSERVATION_VALUE_INVALID', sli);
    output.ok = source.ok;
  } else if (shape.value === 'error') {
    if (typeof source.error !== 'boolean') fail('SLO_OBSERVATION_VALUE_INVALID', sli);
    output.error = source.error;
  } else {
    if (!isSafeNonNegativeInteger(source[shape.value])) fail('SLO_OBSERVATION_VALUE_INVALID', sli);
    output[shape.value] = source[shape.value];
  }
  return Object.freeze(output);
}

function isGood(sli, observation) {
  const profile = CONTRACT.sli_profiles[sli];
  switch (profile.kind) {
    case 'BOOLEAN_OK_RATIO': return observation.ok === true;
    case 'LATENCY_THRESHOLD_RATIO': return observation.latency_ms <= profile.threshold_ms;
    case 'AGE_THRESHOLD_RATIO': return observation.age_ms <= profile.threshold_ms;
    case 'ERROR_FREE_RATIO': return observation.error === false;
    default: fail('SLO_KIND_UNSUPPORTED', profile.kind);
  }
}

function budgetState(consumedBps) {
  for (const band of CONTRACT.budget_bands_bps) {
    if (band.max_inclusive === null || consumedBps <= band.max_inclusive) return band.state;
  }
  fail('SLO_BUDGET_BANDS_INVALID');
}

function stateFromBudget(state) {
  if (state === 'HEALTHY') return 'PASS';
  if (STATE_RANK[state] !== undefined) return state;
  fail('SLO_BUDGET_STATE_INVALID', state);
}

function maxState(...states) {
  let selected = 'PASS';
  for (const state of states) {
    if (STATE_RANK[state] === undefined) fail('SLO_STATE_INVALID', state);
    if (STATE_RANK[state] > STATE_RANK[selected]) selected = state;
  }
  return selected;
}

function unknownResult(service, window, sli, telemetryState, reasonCode, sampleCount) {
  const profile = CONTRACT.sli_profiles[sli];
  return Object.freeze({
    schema: CONTRACT.schema,
    version: CONTRACT.version,
    service,
    window_start_ms: window.start_ms,
    window_end_ms: window.end_ms,
    sli,
    status: 'UNKNOWN',
    reason_code: reasonCode,
    objective_ppm: profile.objective_ppm,
    observed_good_ppm: null,
    sample_count: sampleCount,
    bad_sample_count: null,
    allowed_bad_ppm: PPM - profile.objective_ppm,
    consumed_bad_ppm: null,
    remaining_budget_ppm: null,
    budget_consumed_bps: null,
    budget_state: 'UNKNOWN',
    threshold_ms: profile.threshold_ms === undefined ? null : profile.threshold_ms,
    telemetry_state: telemetryState
  });
}

function evaluateSli(input) {
  assertContract();
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const allowed = new Set(['service', 'window', 'sli', 'telemetry_state', 'observations']);
  for (const key of Object.keys(source)) if (!allowed.has(key)) fail('SLO_INPUT_FIELD_UNKNOWN', key);

  const service = assertCode(source.service, 'SLO_SERVICE_INVALID');
  const window = normalizeWindow(source.window);
  const sli = String(source.sli || '');
  if (!SLI_IDS.includes(sli)) fail('SLO_ID_UNKNOWN', sli);
  const telemetryState = normalizeTelemetryState(source.telemetry_state);
  if (!Array.isArray(source.observations)) fail('SLO_OBSERVATIONS_INVALID');

  const observations = source.observations.map(normalizeObservation);
  for (const observation of observations) {
    if (observation.sli !== sli) fail('SLO_OBSERVATION_SLI_MISMATCH', `${sli}:${observation.sli}`);
  }
  const scoped = observations.filter((observation) =>
    observation.ts_ms >= window.start_ms && observation.ts_ms < window.end_ms
  );

  if (telemetryState === 'FAIL') {
    return unknownResult(service, window, sli, telemetryState, 'TELEMETRY_UNAVAILABLE', scoped.length);
  }

  const profile = CONTRACT.sli_profiles[sli];
  if (scoped.length < profile.min_samples) {
    return unknownResult(service, window, sli, telemetryState, 'INSUFFICIENT_SAMPLES', scoped.length);
  }

  const good = scoped.reduce((count, observation) => count + (isGood(sli, observation) ? 1 : 0), 0);
  const bad = scoped.length - good;
  const observedGoodPpm = Math.floor((good * PPM) / scoped.length);
  const consumedBadPpm = PPM - observedGoodPpm;
  const allowedBadPpm = PPM - profile.objective_ppm;
  const remainingBudgetPpm = Math.max(0, allowedBadPpm - consumedBadPpm);
  const consumedBps = Math.ceil((consumedBadPpm * BPS) / allowedBadPpm);
  const budget = budgetState(consumedBps);
  let status = stateFromBudget(budget);
  let reasonCode = budget === 'HEALTHY' ? 'OK' : `ERROR_BUDGET_${budget}`;

  if (telemetryState === 'WARN') {
    status = maxState(status, CONTRACT.telemetry_state.warn_service_state);
    reasonCode = 'TELEMETRY_DEGRADED';
  }

  return Object.freeze({
    schema: CONTRACT.schema,
    version: CONTRACT.version,
    service,
    window_start_ms: window.start_ms,
    window_end_ms: window.end_ms,
    sli,
    status,
    reason_code: reasonCode,
    objective_ppm: profile.objective_ppm,
    observed_good_ppm: observedGoodPpm,
    sample_count: scoped.length,
    bad_sample_count: bad,
    allowed_bad_ppm: allowedBadPpm,
    consumed_bad_ppm: consumedBadPpm,
    remaining_budget_ppm: remainingBudgetPpm,
    budget_consumed_bps: consumedBps,
    budget_state: budget,
    threshold_ms: profile.threshold_ms === undefined ? null : profile.threshold_ms,
    telemetry_state: telemetryState
  });
}

function evaluateService(input) {
  assertContract();
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const allowed = new Set(['service', 'window', 'telemetry_state', 'observations']);
  for (const key of Object.keys(source)) if (!allowed.has(key)) fail('SLO_SERVICE_INPUT_FIELD_UNKNOWN', key);
  const service = assertCode(source.service, 'SLO_SERVICE_INVALID');
  const window = normalizeWindow(source.window);
  const telemetryState = normalizeTelemetryState(source.telemetry_state);
  if (!Array.isArray(source.observations)) fail('SLO_OBSERVATIONS_INVALID');
  const normalized = source.observations.map(normalizeObservation);

  const results = SLI_IDS.map((sli) => evaluateSli({
    service,
    window,
    sli,
    telemetry_state: telemetryState,
    observations: normalized.filter((item) => item.sli === sli)
  }));
  const status = results.reduce((current, result) => maxState(current, result.status), 'PASS');
  const reasons = Object.freeze(results
    .filter((result) => result.reason_code !== 'OK')
    .map((result) => `${result.sli}:${result.reason_code}`));

  return Object.freeze({
    schema: 'PRH_SLO_SERVICE_STATE_V1',
    version: CONTRACT.version,
    service,
    window_start_ms: window.start_ms,
    window_end_ms: window.end_ms,
    status,
    telemetry_state: telemetryState,
    alert: ['CRITICAL', 'BREACHED', 'UNKNOWN'].includes(status),
    reasons,
    sli_results: Object.freeze(results)
  });
}

module.exports = {
  CONTRACT,
  SLI_IDS,
  assertContract,
  normalizeWindow,
  normalizeObservation,
  evaluateSli,
  evaluateService
};
