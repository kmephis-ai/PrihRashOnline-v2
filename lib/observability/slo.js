'use strict';

const contract = require('./slo.v1.json');

const ALLOWED_FIELDS = new Set(contract.observation_fields);
const TECHNICAL_CODE_RE = new RegExp(contract.technical_code_pattern);
const SLI_BY_ID = new Map(contract.slis.map((definition) => [definition.id, definition]));

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function assertFiniteNonNegative(value, code) {
  if (!Number.isFinite(value) || value < 0) fail(code);
  return value;
}

function assertIntegerNonNegative(value, code) {
  if (!Number.isInteger(value) || value < 0) fail(code);
  return value;
}

function validateTechnicalCode(value, code) {
  const text = String(value || '');
  if (!TECHNICAL_CODE_RE.test(text)) fail(code);
  return text;
}

function validateObservation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('SLO_OBSERVATION_INVALID');
  for (const key of Object.keys(input)) {
    if (!ALLOWED_FIELDS.has(key)) fail('SLO_OBSERVATION_FIELD_FORBIDDEN');
  }

  const sliId = String(input.sli_id || '');
  const definition = SLI_BY_ID.get(sliId);
  if (!definition) fail('SLO_ID_UNKNOWN');

  const observation = { sli_id: sliId };
  if (input.source !== undefined) observation.source = validateTechnicalCode(input.source, 'SLO_SOURCE_INVALID');

  if (definition.allowed_sources) {
    if (!observation.source || !definition.allowed_sources.includes(observation.source)) {
      fail('SLO_SOURCE_NOT_ALLOWED');
    }
  }

  switch (definition.kind) {
    case 'boolean_good':
      if (typeof input.ok !== 'boolean') fail('SLO_BOOLEAN_OBSERVATION_INVALID');
      observation.ok = input.ok;
      break;
    case 'duration_threshold':
      observation.duration_ms = assertFiniteNonNegative(input.duration_ms, 'SLO_DURATION_INVALID');
      break;
    case 'age_threshold':
      observation.observed_at_ms = assertFiniteNonNegative(input.observed_at_ms, 'SLO_OBSERVED_AT_INVALID');
      observation.evaluated_at_ms = assertFiniteNonNegative(input.evaluated_at_ms, 'SLO_EVALUATED_AT_INVALID');
      if (observation.evaluated_at_ms < observation.observed_at_ms) fail('SLO_FRESHNESS_TIME_ORDER_INVALID');
      break;
    case 'error_ratio':
      observation.error_count = assertIntegerNonNegative(input.error_count, 'SLO_ERROR_COUNT_INVALID');
      observation.checked_count = assertIntegerNonNegative(input.checked_count, 'SLO_CHECKED_COUNT_INVALID');
      if (observation.checked_count < 1 || observation.error_count > observation.checked_count) {
        fail('SLO_ERROR_RATIO_INVALID');
      }
      break;
    default:
      fail('SLO_KIND_UNSUPPORTED');
  }
  return observation;
}

function observationContribution(definition, observation) {
  switch (definition.kind) {
    case 'boolean_good':
      return { good: observation.ok ? 1 : 0, total: 1 };
    case 'duration_threshold':
      return { good: observation.duration_ms <= definition.threshold_ms ? 1 : 0, total: 1 };
    case 'age_threshold': {
      const age = observation.evaluated_at_ms - observation.observed_at_ms;
      return { good: age <= definition.threshold_ms ? 1 : 0, total: 1 };
    }
    case 'error_ratio':
      return { good: observation.checked_count - observation.error_count, total: observation.checked_count };
    default:
      fail('SLO_KIND_UNSUPPORTED');
  }
}

function allowedBadCount(total, objective) {
  return Math.max(0, Math.floor((total * (1 - objective)) + 1e-12));
}

function summarizeSli(definition, observations) {
  if (observations.length === 0) {
    return {
      sli_id: definition.id,
      status: 'UNKNOWN',
      reason_code: 'SLO_NO_OBSERVATIONS',
      objective: definition.objective,
      good_count: 0,
      bad_count: 0,
      total_count: 0,
      error_budget_allowed_bad: 0,
      error_budget_remaining: 0
    };
  }

  let good = 0;
  let total = 0;
  for (const observation of observations) {
    const contribution = observationContribution(definition, observation);
    good += contribution.good;
    total += contribution.total;
  }
  const bad = total - good;
  const allowedBad = allowedBadCount(total, definition.objective);
  const remaining = Math.max(0, allowedBad - bad);
  const ratio = total > 0 ? good / total : 0;

  let status = 'PASS';
  let reasonCode = 'OK';
  if (total < definition.min_samples) {
    status = 'INSUFFICIENT_DATA';
    reasonCode = 'SLO_MIN_SAMPLES_NOT_MET';
  } else if (bad > allowedBad) {
    status = 'EXHAUSTED';
    reasonCode = 'SLO_ERROR_BUDGET_EXHAUSTED';
  } else if (bad > 0) {
    status = 'DEGRADED';
    reasonCode = 'SLO_ERROR_BUDGET_CONSUMED';
  }

  const summary = {
    sli_id: definition.id,
    status,
    reason_code: reasonCode,
    objective: definition.objective,
    good_count: good,
    bad_count: bad,
    total_count: total,
    good_ratio: Number(ratio.toFixed(6)),
    error_budget_allowed_bad: allowedBad,
    error_budget_remaining: remaining
  };
  if (definition.threshold_ms !== undefined) summary.threshold_ms = definition.threshold_ms;
  return summary;
}

function aggregateStatus(summaries) {
  if (summaries.some((entry) => entry.status === 'EXHAUSTED')) return 'FAIL';
  if (summaries.some((entry) => entry.status !== 'PASS')) return 'WARN';
  return 'PASS';
}

function evaluateSlo(inputs) {
  if (!Array.isArray(inputs)) fail('SLO_OBSERVATIONS_INVALID');
  const grouped = new Map(contract.slis.map((definition) => [definition.id, []]));
  for (const input of inputs) {
    const observation = validateObservation(input);
    grouped.get(observation.sli_id).push(observation);
  }

  const slis = contract.slis.map((definition) => summarizeSli(definition, grouped.get(definition.id)));
  return {
    schema: contract.schema,
    version: contract.version,
    status: aggregateStatus(slis),
    reason_code: slis.some((entry) => entry.status === 'EXHAUSTED')
      ? 'SLO_ONE_OR_MORE_BUDGETS_EXHAUSTED'
      : slis.some((entry) => entry.status !== 'PASS')
        ? 'SLO_ATTENTION_REQUIRED'
        : 'OK',
    slis
  };
}

module.exports = {
  CONTRACT: contract,
  validateObservation,
  summarizeSli,
  evaluateSlo,
  allowedBadCount
};
