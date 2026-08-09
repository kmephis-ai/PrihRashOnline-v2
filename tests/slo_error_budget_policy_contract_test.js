'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  CONTRACT,
  SLI_IDS,
  assertContract,
  evaluateSli,
  evaluateService
} = require('../lib/observability/slo_error_budget');

assertContract();
assert.strictEqual(CONTRACT.schema, 'PRH_SLO_ERROR_BUDGET_V1');
assert.strictEqual(CONTRACT.version, '1.0.0');
assert.strictEqual(CONTRACT.roadmap_id, 'OBS-010');
assert.deepStrictEqual(SLI_IDS, [
  'AVAILABILITY', 'LATENCY', 'CORRECTNESS', 'FRESHNESS', 'MIGRATION_ERRORS'
]);
assert.strictEqual(CONTRACT.precision.ratio_denominator_ppm, 1000000);
assert.strictEqual(CONTRACT.precision.budget_consumed_denominator_bps, 10000);
assert.strictEqual(CONTRACT.privacy.financial_payload_allowed, false);
assert.strictEqual(CONTRACT.privacy.real_financial_aggregates_allowed, false);
assert.strictEqual(CONTRACT.authority.io, false);
assert.strictEqual(CONTRACT.authority.network, false);
assert.strictEqual(CONTRACT.authority.ui, false);
assert.strictEqual(CONTRACT.authority.financial_write, false);
assert.strictEqual(CONTRACT.authority.financial_correctness, false);
assert.strictEqual(CONTRACT.authority.external_provider_required, false);
assert.strictEqual(CONTRACT.authority.paid_dependency_required, false);

const window = Object.freeze({ start_ms: 1000, end_ms: 2000 });

function booleanObservations(sli, count, badCount, start = 1100) {
  return Array.from({ length: count }, (_, index) => ({
    sli,
    ts_ms: start + index,
    ok: index >= badCount
  }));
}

function errorObservations(count, badCount, start = 1100) {
  return Array.from({ length: count }, (_, index) => ({
    sli: 'MIGRATION_ERRORS',
    ts_ms: start + index,
    error: index < badCount
  }));
}

function thresholdObservations(sli, field, count, badCount, threshold, start = 1100) {
  return Array.from({ length: count }, (_, index) => ({
    sli,
    ts_ms: start + index,
    [field]: index < badCount ? threshold + 1 : threshold
  }));
}

// Availability: 0.2% bad consumes 40% of a 0.5% budget -> healthy/PASS.
let result = evaluateSli({
  service: 'WEB_APP', window, sli: 'AVAILABILITY', telemetry_state: 'PASS',
  observations: booleanObservations('AVAILABILITY', 1000, 2)
});
assert.strictEqual(result.observed_good_ppm, 998000);
assert.strictEqual(result.allowed_bad_ppm, 5000);
assert.strictEqual(result.consumed_bad_ppm, 2000);
assert.strictEqual(result.remaining_budget_ppm, 3000);
assert.strictEqual(result.budget_consumed_bps, 4000);
assert.strictEqual(result.budget_state, 'HEALTHY');
assert.strictEqual(result.status, 'PASS');
assert.strictEqual(result.reason_code, 'OK');

// 0.3% bad consumes 60% -> WATCH without objective breach.
result = evaluateSli({
  service: 'WEB_APP', window, sli: 'AVAILABILITY',
  observations: booleanObservations('AVAILABILITY', 1000, 3)
});
assert.strictEqual(result.observed_good_ppm, 997000);
assert.strictEqual(result.budget_consumed_bps, 6000);
assert.strictEqual(result.budget_state, 'WATCH');
assert.strictEqual(result.status, 'WATCH');
assert.strictEqual(result.reason_code, 'ERROR_BUDGET_WATCH');

// Exactly 100% of budget is CRITICAL but still deterministic and not silently PASS.
result = evaluateSli({
  service: 'WEB_APP', window, sli: 'AVAILABILITY',
  observations: booleanObservations('AVAILABILITY', 1000, 5)
});
assert.strictEqual(result.observed_good_ppm, 995000);
assert.strictEqual(result.budget_consumed_bps, 10000);
assert.strictEqual(result.budget_state, 'CRITICAL');
assert.strictEqual(result.status, 'CRITICAL');

// Above budget becomes BREACHED.
result = evaluateSli({
  service: 'WEB_APP', window, sli: 'AVAILABILITY',
  observations: booleanObservations('AVAILABILITY', 1000, 6)
});
assert.strictEqual(result.observed_good_ppm, 994000);
assert.strictEqual(result.remaining_budget_ppm, 0);
assert.strictEqual(result.budget_consumed_bps, 12000);
assert.strictEqual(result.budget_state, 'BREACHED');
assert.strictEqual(result.status, 'BREACHED');

// Latency threshold semantics: 1/20 above 2000 ms consumes the complete 5% budget.
result = evaluateSli({
  service: 'EXECUTION_API', window, sli: 'LATENCY',
  observations: thresholdObservations('LATENCY', 'latency_ms', 20, 1, 2000)
});
assert.strictEqual(result.sample_count, 20);
assert.strictEqual(result.bad_sample_count, 1);
assert.strictEqual(result.threshold_ms, 2000);
assert.strictEqual(result.observed_good_ppm, 950000);
assert.strictEqual(result.status, 'CRITICAL');

// Freshness uses age threshold, not transaction timestamps/amounts.
result = evaluateSli({
  service: 'CANONICAL_READ', window, sli: 'FRESHNESS',
  observations: thresholdObservations('FRESHNESS', 'age_ms', 100, 1, 900000)
});
assert.strictEqual(result.threshold_ms, 900000);
assert.strictEqual(result.observed_good_ppm, 990000);
assert.strictEqual(result.status, 'CRITICAL');

// Correctness and migration errors use technical ok/error signals only.
result = evaluateSli({
  service: 'CANONICAL_READ', window, sli: 'CORRECTNESS',
  observations: booleanObservations('CORRECTNESS', 1000, 0)
});
assert.strictEqual(result.status, 'PASS');
assert.strictEqual(result.bad_sample_count, 0);

result = evaluateSli({
  service: 'MIGRATION', window, sli: 'MIGRATION_ERRORS',
  observations: errorObservations(1000, 1)
});
assert.strictEqual(result.observed_good_ppm, 999000);
assert.strictEqual(result.status, 'CRITICAL');

// Half-open window: out-of-window failures do not contaminate scoped SLI.
const scoped = booleanObservations('AVAILABILITY', 20, 0);
scoped.push({ sli: 'AVAILABILITY', ts_ms: 999, ok: false });
scoped.push({ sli: 'AVAILABILITY', ts_ms: 2000, ok: false });
result = evaluateSli({ service: 'WEB_APP', window, sli: 'AVAILABILITY', observations: scoped });
assert.strictEqual(result.sample_count, 20);
assert.strictEqual(result.bad_sample_count, 0);
assert.strictEqual(result.status, 'PASS');

// Insufficient telemetry is UNKNOWN, never implicit green.
result = evaluateSli({
  service: 'WEB_APP', window, sli: 'AVAILABILITY', observations: booleanObservations('AVAILABILITY', 19, 0)
});
assert.strictEqual(result.status, 'UNKNOWN');
assert.strictEqual(result.reason_code, 'INSUFFICIENT_SAMPLES');
assert.strictEqual(result.observed_good_ppm, null);
assert.strictEqual(result.budget_consumed_bps, null);

// OBS-001 failure isolation: telemetry WARN/FAIL changes observability state only.
result = evaluateSli({
  service: 'WEB_APP', window, sli: 'AVAILABILITY', telemetry_state: 'WARN',
  observations: booleanObservations('AVAILABILITY', 20, 0)
});
assert.strictEqual(result.status, 'DEGRADED');
assert.strictEqual(result.reason_code, 'TELEMETRY_DEGRADED');

result = evaluateSli({
  service: 'WEB_APP', window, sli: 'AVAILABILITY', telemetry_state: 'FAIL',
  observations: booleanObservations('AVAILABILITY', 20, 0)
});
assert.strictEqual(result.status, 'UNKNOWN');
assert.strictEqual(result.reason_code, 'TELEMETRY_UNAVAILABLE');

// Composite service state is worst-of-SLI and contains no raw observation payload.
const observations = [
  ...booleanObservations('AVAILABILITY', 1000, 3),
  ...thresholdObservations('LATENCY', 'latency_ms', 20, 0, 2000),
  ...booleanObservations('CORRECTNESS', 1000, 0),
  ...thresholdObservations('FRESHNESS', 'age_ms', 100, 0, 900000),
  ...errorObservations(1000, 0)
];
const serviceState = evaluateService({ service: 'PRIVATE_RUNTIME', window, observations });
assert.strictEqual(serviceState.status, 'WATCH');
assert.strictEqual(serviceState.alert, false);
assert(serviceState.reasons.includes('AVAILABILITY:ERROR_BUDGET_WATCH'));
assert.strictEqual(serviceState.sli_results.length, 5);
assert(!JSON.stringify(serviceState).includes('observations'));

// Input is strict and cannot smuggle financial/user payload into technical SLI.
for (const bad of [
  () => evaluateSli({ service: 'WEB_APP', window, sli: 'AVAILABILITY', observations: [{ sli: 'AVAILABILITY', ts_ms: 1100, ok: true, amount: 1 }] }),
  () => evaluateSli({ service: 'WEB_APP', window, sli: 'LATENCY', observations: [{ sli: 'LATENCY', ts_ms: 1100, latency_ms: -1 }] }),
  () => evaluateSli({ service: 'WEB APP', window, sli: 'AVAILABILITY', observations: [] }),
  () => evaluateSli({ service: 'WEB_APP', window: { start_ms: 1, end_ms: 1 }, sli: 'AVAILABILITY', observations: [] }),
  () => evaluateSli({ service: 'WEB_APP', window, sli: 'UNKNOWN', observations: [] }),
  () => evaluateSli({ service: 'WEB_APP', window, sli: 'AVAILABILITY', telemetry_state: 'GREEN', observations: [] })
]) assert.throws(bad);

// Pure boundary: no platform/network/write API in evaluator.
const source = fs.readFileSync(path.join(__dirname, '..', 'lib/observability/slo_error_budget.js'), 'utf8');
for (const forbidden of ['SpreadsheetApp.', 'UrlFetchApp.', 'HtmlService.', 'fetch(', 'writeBatch(', 'setValues(', 'appendRow(']) {
  assert(!source.includes(forbidden), `SLO evaluator contains forbidden authority: ${forbidden}`);
}

console.log('slo_error_budget_policy_contract_test: OK', {
  contract: 'PRH_SLO_ERROR_BUDGET_V1@1.0.0',
  sli: SLI_IDS,
  integerPpm: true,
  integerBudgetBps: true,
  emptyTelemetry: 'UNKNOWN',
  telemetryFailureFinancialAuthority: false,
  publicFixtures: 'SYNTHETIC_ONLY',
  financialWriteAuthority: false,
  externalProviderRequired: false
});
