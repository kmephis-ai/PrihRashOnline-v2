'use strict';

const CONTRACT = require('./goal_planning.v1.json');

const SCHEMA = 'PRH_GOAL_PLANNING_V1';
const VERSION = '1.0.0';
const GOAL_SCHEMA = CONTRACT.schemas.goal;
const EVENT_SCHEMA = CONTRACT.schemas.funding_event;
const RESULT_SCHEMA = CONTRACT.schemas.result;
const TELEMETRY_SCHEMA = CONTRACT.schemas.telemetry;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;

function fail(reason, detail) {
  const error = new Error(detail ? `${reason}:${detail}` : reason);
  error.code = reason;
  throw error;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function exactKeys(value, allowed, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length) fail(reason, extra.join(','));
}

function assertContract() {
  if (CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'GOAL-030') fail('GOAL_CONTRACT_VERSION_INVALID');
  if (CONTRACT.dependency.budget_item !== 'BUD-020' || CONTRACT.dependency.budget_semantics_redefined !== false) fail('GOAL_BUDGET_BOUNDARY_INVALID');
  if (CONTRACT.funding_history.provenance !== 'DECLARED_PLANNING' || CONTRACT.funding_history.canonical_transaction_claim !== false) fail('GOAL_FUNDING_PROVENANCE_INVALID');
  if (CONTRACT.recommendation.model_kind !== 'DETERMINISTIC_RULE' || CONTRACT.recommendation.hidden_forecast !== false || CONTRACT.recommendation.financial_truth !== false) fail('GOAL_RECOMMENDATION_BOUNDARY_INVALID');
  if (Object.values(CONTRACT.authorities || {}).some((value) => value !== false) || CONTRACT.free_only !== true) fail('GOAL_AUTHORITY_INVALID');
  return true;
}

function safeInteger(value, reason) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) fail(reason);
  return number;
}

function safeAdd(a, b, reason = 'GOAL_SAFE_INTEGER_OVERFLOW') {
  const result = a + b;
  if (!Number.isSafeInteger(result)) fail(reason);
  return result;
}

function safeSub(a, b, reason = 'GOAL_SAFE_INTEGER_OVERFLOW') {
  const result = a - b;
  if (!Number.isSafeInteger(result)) fail(reason);
  return result;
}

function positiveInteger(value, reason) {
  const number = safeInteger(value, reason);
  if (number <= 0) fail(reason);
  return number;
}

function opaqueId(value, reason) {
  const text = String(value || '').trim();
  if (!ID_RE.test(text)) fail(reason);
  return text;
}

function displayName(value) {
  const text = String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  if (!text || text.length > CONTRACT.goal.name_max_length || /[\u0000-\u001f\u007f]/.test(text)) fail('GOAL_NAME_INVALID');
  return text;
}

function parseDate(value, reason) {
  const text = String(value || '');
  if (!DATE_RE.test(text)) fail(reason);
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) fail(reason);
  return Object.freeze({ text, year, month, day, ms: date.getTime() });
}

function enumValue(value, allowed, reason) {
  const text = String(value || '').trim().toUpperCase();
  if (!allowed.includes(text)) fail(reason);
  return text;
}

function normalizeGoal(input) {
  assertContract();
  exactKeys(input, ['schema', 'version', 'goal_id', 'name', 'target_minor', 'currency', 'deadline', 'priority', 'status', 'funding_events'], 'GOAL_SHAPE_INVALID');
  if (input.schema !== GOAL_SCHEMA || input.version !== VERSION) fail('GOAL_VERSION_INVALID');
  const currency = String(input.currency || '').trim().toUpperCase();
  if (!CURRENCY_RE.test(currency)) fail('GOAL_CURRENCY_INVALID');
  const deadline = input.deadline == null ? null : parseDate(input.deadline, 'GOAL_DEADLINE_INVALID').text;
  if (!Array.isArray(input.funding_events)) fail('GOAL_FUNDING_EVENTS_INVALID');
  const events = input.funding_events.map(normalizeFundingEvent).sort((a, b) => a.occurred_on.localeCompare(b.occurred_on) || a.event_id.localeCompare(b.event_id));
  if (new Set(events.map((event) => event.event_id)).size !== events.length) fail('GOAL_FUNDING_EVENT_ID_DUPLICATE');
  return deepFreeze({
    schema: GOAL_SCHEMA,
    version: VERSION,
    goal_id: opaqueId(input.goal_id, 'GOAL_ID_INVALID'),
    name: displayName(input.name),
    target_minor: positiveInteger(input.target_minor, 'GOAL_TARGET_INVALID'),
    currency,
    deadline,
    priority: enumValue(input.priority, CONTRACT.goal.priorities, 'GOAL_PRIORITY_INVALID'),
    status: enumValue(input.status, CONTRACT.goal.statuses, 'GOAL_STATUS_INVALID'),
    funding_events: deepFreeze(events)
  });
}

function normalizeFundingEvent(input) {
  exactKeys(input, ['schema', 'version', 'event_id', 'occurred_on', 'delta_minor', 'provenance'], 'GOAL_FUNDING_EVENT_SHAPE_INVALID');
  if (input.schema !== EVENT_SCHEMA || input.version !== VERSION) fail('GOAL_FUNDING_EVENT_VERSION_INVALID');
  if (input.provenance !== CONTRACT.funding_history.provenance) fail('GOAL_FUNDING_PROVENANCE_INVALID');
  const delta = safeInteger(input.delta_minor, 'GOAL_FUNDING_DELTA_INVALID');
  if (delta === 0) fail('GOAL_FUNDING_DELTA_INVALID');
  return deepFreeze({
    schema: EVENT_SCHEMA,
    version: VERSION,
    event_id: opaqueId(input.event_id, 'GOAL_FUNDING_EVENT_ID_INVALID'),
    occurred_on: parseDate(input.occurred_on, 'GOAL_FUNDING_EVENT_DATE_INVALID').text,
    delta_minor: delta,
    provenance: 'DECLARED_PLANNING'
  });
}

function roundBasisPoints(numerator, denominator) {
  numerator = safeInteger(numerator, 'GOAL_PROGRESS_INVALID');
  denominator = positiveInteger(denominator, 'GOAL_PROGRESS_INVALID');
  if (numerator <= 0) return 0;
  const scaled = numerator * 10000;
  if (!Number.isSafeInteger(scaled)) fail('GOAL_SAFE_INTEGER_OVERFLOW');
  const raw = Math.floor((scaled + Math.floor(denominator / 2)) / denominator);
  return Math.max(0, Math.min(10000, raw));
}

function ceilDividePositive(numerator, denominator) {
  numerator = safeInteger(numerator, 'GOAL_RECOMMENDATION_VALUE_INVALID');
  denominator = positiveInteger(denominator, 'GOAL_RECOMMENDATION_PERIOD_INVALID');
  if (numerator <= 0) return 0;
  const value = Math.floor((numerator - 1) / denominator) + 1;
  if (!Number.isSafeInteger(value)) fail('GOAL_SAFE_INTEGER_OVERFLOW');
  return value;
}

function calendarDaysBetween(start, end) {
  const a = parseDate(start, 'GOAL_AS_OF_INVALID');
  const b = parseDate(end, 'GOAL_DEADLINE_INVALID');
  return Math.trunc((b.ms - a.ms) / DAY_MS);
}

function contributionPeriods(asOf, deadline) {
  const a = parseDate(asOf, 'GOAL_AS_OF_INVALID');
  const b = parseDate(deadline, 'GOAL_DEADLINE_INVALID');
  if (b.ms < a.ms) return 0;
  return (b.year - a.year) * 12 + (b.month - a.month) + 1;
}

function evaluateGoal(input, asOfInput) {
  const goal = normalizeGoal(input);
  const asOf = parseDate(asOfInput, 'GOAL_AS_OF_INVALID');
  let funded = 0;
  let eventCount = 0;
  for (const event of goal.funding_events) {
    const eventDate = parseDate(event.occurred_on, 'GOAL_FUNDING_EVENT_DATE_INVALID');
    if (eventDate.ms > asOf.ms) fail('GOAL_FUTURE_FUNDING_EVENT');
    funded = safeAdd(funded, event.delta_minor);
    if (funded < 0) fail('GOAL_NEGATIVE_CUMULATIVE_FUNDING');
    eventCount += 1;
  }
  const remaining = Math.max(0, safeSub(goal.target_minor, funded));
  const overfunded = Math.max(0, safeSub(funded, goal.target_minor));
  const progressBps = roundBasisPoints(funded, goal.target_minor);
  const deadlineDays = goal.deadline == null ? null : calendarDaysBetween(asOf.text, goal.deadline);
  const periods = goal.deadline == null ? null : contributionPeriods(asOf.text, goal.deadline);
  let deadlineState = 'NO_DEADLINE';
  if (goal.deadline != null) deadlineState = deadlineDays < 0 ? 'OVERDUE' : deadlineDays === 0 ? 'DUE_TODAY' : 'FUTURE';

  let reason = 'ACTIVE_ON_TRACK_INPUT_REQUIRED';
  let requiredMonthly = null;
  if (goal.status === 'CANCELLED') reason = 'CANCELLED';
  else if (goal.status === 'PAUSED') reason = 'PAUSED';
  else if (remaining === 0 || goal.status === 'ACHIEVED') {
    reason = 'GOAL_FUNDED';
    requiredMonthly = 0;
  } else if (goal.deadline == null) reason = 'NO_DEADLINE';
  else if (deadlineDays < 0) reason = 'OVERDUE';
  else {
    reason = 'ACTIVE_ON_TRACK_INPUT_REQUIRED';
    requiredMonthly = ceilDividePositive(remaining, periods);
  }

  return deepFreeze({
    schema: RESULT_SCHEMA,
    version: VERSION,
    as_of: asOf.text,
    goal,
    funded_minor: funded,
    remaining_minor: remaining,
    overfunded_minor: overfunded,
    progress_basis_points: progressBps,
    funding_event_count: eventCount,
    deadline_state: deadlineState,
    deadline_days_remaining: deadlineDays,
    contribution_periods: periods,
    recommendation: deepFreeze({
      model_kind: 'DETERMINISTIC_RULE',
      reason_code: reason,
      required_monthly_contribution_minor: requiredMonthly,
      financial_truth: false,
      hidden_forecast: false
    }),
    provenance: deepFreeze({
      funding_provenance: 'DECLARED_PLANNING',
      canonical_transaction_claim: false,
      budget_semantics_redefined: false,
      projection_used: false,
      financial_truth: false,
      canonical_mutation: false
    })
  });
}

function serializeGoal(input) {
  return stableStringify(normalizeGoal(input));
}

function progressBand(bps) {
  if (bps === 10000) return 'COMPLETE';
  if (bps >= 7500) return '75_99';
  if (bps >= 5000) return '50_74';
  if (bps >= 2500) return '25_49';
  return '0_24';
}

function goalTelemetry(result) {
  if (!result || result.schema !== RESULT_SCHEMA || result.version !== VERSION) fail('GOAL_RESULT_INVALID');
  const output = {
    schema: TELEMETRY_SCHEMA,
    version: VERSION,
    status: result.goal.status,
    priority: result.goal.priority,
    has_deadline: result.goal.deadline != null,
    funding_event_count: result.funding_event_count,
    deadline_state: result.deadline_state,
    recommendation_reason: result.recommendation.reason_code,
    progress_band: progressBand(result.progress_basis_points),
    decision: 'OK',
    reason_code: 'OK'
  };
  const extra = Object.keys(output).filter((key) => !CONTRACT.telemetry_allowlist.includes(key));
  if (extra.length) fail('GOAL_TELEMETRY_FIELD_FORBIDDEN', extra.join(','));
  return deepFreeze(output);
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  GOAL_SCHEMA,
  EVENT_SCHEMA,
  RESULT_SCHEMA,
  TELEMETRY_SCHEMA,
  assertContract,
  stableStringify,
  normalizeFundingEvent,
  normalizeGoal,
  roundBasisPoints,
  ceilDividePositive,
  calendarDaysBetween,
  contributionPeriods,
  evaluateGoal,
  serializeGoal,
  goalTelemetry
});
