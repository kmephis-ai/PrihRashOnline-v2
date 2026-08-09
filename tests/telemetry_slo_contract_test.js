'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  CONTRACT,
  validateObservation,
  evaluateSlo,
  allowedBadCount
} = require('../lib/observability/slo');

assert.strictEqual(CONTRACT.schema, 'PRH_SLO_CONTRACT_V1');
assert.strictEqual(CONTRACT.version, '1.0.0');
assert.strictEqual(CONTRACT.roadmap_id, 'OBS-010');
assert.strictEqual(CONTRACT.free_only, true);
assert.strictEqual(CONTRACT.external_provider_required, false);
assert.strictEqual(CONTRACT.financial_payload_allowed, false);
assert.deepStrictEqual(CONTRACT.slis.map((entry) => entry.id), [
  'availability', 'latency', 'correctness', 'freshness', 'migration_errors'
]);

function passObservations() {
  const observations = [];
  for (let i = 0; i < 5; i += 1) observations.push({ sli_id: 'availability', ok: true });
  for (let i = 0; i < 20; i += 1) observations.push({ sli_id: 'latency', duration_ms: 900 + i });
  observations.push({ sli_id: 'correctness', ok: true, source: 'FINANCIAL_RECONCILIATION' });
  for (let i = 0; i < 5; i += 1) {
    observations.push({
      sli_id: 'freshness',
      observed_at_ms: 100000 + (i * 1000),
      evaluated_at_ms: 200000 + (i * 1000)
    });
  }
  observations.push({ sli_id: 'migration_errors', error_count: 0, checked_count: 100 });
  return observations;
}

{
  const report = evaluateSlo(passObservations());
  assert.strictEqual(report.status, 'PASS');
  assert.strictEqual(report.reason_code, 'OK');
  assert(report.slis.every((entry) => entry.status === 'PASS'));
  assert.strictEqual(report.slis.find((entry) => entry.sli_id === 'migration_errors').good_count, 100);
}

{
  const degraded = passObservations();
  degraded[5] = { sli_id: 'latency', duration_ms: 2000 };
  const report = evaluateSlo(degraded);
  const latency = report.slis.find((entry) => entry.sli_id === 'latency');
  assert.strictEqual(report.status, 'WARN');
  assert.strictEqual(latency.status, 'DEGRADED');
  assert.strictEqual(latency.bad_count, 1);
  assert.strictEqual(latency.error_budget_allowed_bad, 1);
  assert.strictEqual(latency.error_budget_remaining, 0);
}

{
  const exhausted = passObservations();
  exhausted[5] = { sli_id: 'latency', duration_ms: 2000 };
  exhausted[6] = { sli_id: 'latency', duration_ms: 2100 };
  const report = evaluateSlo(exhausted);
  assert.strictEqual(report.status, 'FAIL');
  assert.strictEqual(report.reason_code, 'SLO_ONE_OR_MORE_BUDGETS_EXHAUSTED');
  assert.strictEqual(report.slis.find((entry) => entry.sli_id === 'latency').status, 'EXHAUSTED');
}

{
  const report = evaluateSlo([{ sli_id: 'availability', ok: true }]);
  assert.strictEqual(report.status, 'WARN');
  assert.strictEqual(report.slis.find((entry) => entry.sli_id === 'availability').status, 'INSUFFICIENT_DATA');
  assert.strictEqual(report.slis.find((entry) => entry.sli_id === 'correctness').status, 'UNKNOWN');
}

assert.strictEqual(allowedBadCount(200, 0.995), 1);
assert.strictEqual(allowedBadCount(20, 0.95), 1);
assert.strictEqual(allowedBadCount(100, 1), 0);

assert.throws(
  () => validateObservation({ sli_id: 'availability', ok: true, amount_minor: 12345 }),
  /SLO_OBSERVATION_FIELD_FORBIDDEN/
);
assert.throws(
  () => validateObservation({ sli_id: 'correctness', ok: true, source: 'UNAUTHORIZED_SOURCE' }),
  /SLO_SOURCE_NOT_ALLOWED/
);
assert.throws(
  () => validateObservation({ sli_id: 'freshness', observed_at_ms: 200, evaluated_at_ms: 100 }),
  /SLO_FRESHNESS_TIME_ORDER_INVALID/
);
assert.throws(
  () => validateObservation({ sli_id: 'migration_errors', error_count: 2, checked_count: 1 }),
  /SLO_ERROR_RATIO_INVALID/
);
assert.throws(
  () => validateObservation({ sli_id: 'not_registered', ok: true }),
  /SLO_ID_UNKNOWN/
);

{
  const privacySource = fs.readFileSync(path.join(__dirname, '..', 'SecurityPrivacyPolicy.js'), 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(privacySource, context, { filename: 'SecurityPrivacyPolicy.js' });
  const safe = vm.runInContext(`sanitizeAuditMetadata_({
    sliId:'latency',
    sloStatus:'DEGRADED',
    sloObjective:0.95,
    sloThresholdMs:1500,
    sloGoodCount:19,
    sloBadCount:1,
    sloTotalCount:20,
    sloBudgetRemaining:0,
    sloReasonCode:'SLO_ERROR_BUDGET_CONSUMED',
    amountMinor:12345,
    description:'private',
    rawPayload:'private'
  })`, context);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(safe)), {
    sliId: 'latency',
    sloStatus: 'DEGRADED',
    sloObjective: 0.95,
    sloThresholdMs: 1500,
    sloGoodCount: 19,
    sloBadCount: 1,
    sloTotalCount: 20,
    sloBudgetRemaining: 0,
    sloReasonCode: 'SLO_ERROR_BUDGET_CONSUMED'
  });
}

const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'observability', 'slo.js'), 'utf8');
for (const forbidden of ['SpreadsheetApp.', 'UrlFetchApp.', 'HtmlService.', 'window.', 'document.']) {
  assert(!source.includes(forbidden), `SLO evaluator must stay platform-neutral: ${forbidden}`);
}

console.log('telemetry_slo_contract_test: OK', {
  schema: CONTRACT.schema,
  slis: CONTRACT.slis.length,
  deterministicErrorBudget: true,
  explicitUnknownAndInsufficientData: true,
  technicalTelemetryOnly: true,
  freeOnly: true
});
