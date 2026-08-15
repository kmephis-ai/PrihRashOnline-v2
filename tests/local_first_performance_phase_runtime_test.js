'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const performanceRuntime = require('../pwa/local_first_performance');

const ROOT = path.resolve(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/local_first/local_first_performance.v1.json'), 'utf8'));

const phases = performanceRuntime.fmpPhaseBreakdown(100, 150, 180, 260);
assert.deepStrictEqual(phases, {
  response_start_ms: 100,
  response_end_ms: 150,
  module_start_ms: 180,
  ready_ms: 260,
  response_to_module_ms: 30,
  module_to_ready_ms: 80,
  response_to_ready_ms: 110
});


const historyPhases = performanceRuntime.historyPhaseBreakdown(100, 125, 140, 172);
assert.deepStrictEqual(historyPhases, {
  action_to_popstate_ms: 25,
  popstate_to_meaningful_ready_ms: 15,
  meaningful_ready_to_stable_frame_ms: 32,
  action_to_stable_frame_ms: 72
});
const invalidHistoryOrder = performanceRuntime.historyPhaseBreakdown(100, 90, 140, 172);
assert.strictEqual(invalidHistoryOrder.action_to_popstate_ms, null, 'history phase ordering must fail closed');
assert.strictEqual(invalidHistoryOrder.popstate_to_meaningful_ready_ms, 50);

const invalidOrder = performanceRuntime.fmpPhaseBreakdown(100, 200, 150, 260);
assert.strictEqual(invalidOrder.response_to_module_ms, null, 'phase span must fail closed when module appears before response end');
assert.strictEqual(invalidOrder.module_to_ready_ms, 110);
assert.strictEqual(invalidOrder.response_to_ready_ms, 60);

for (const field of [
  'cached_fmp_phases',
  'response_start_ms',
  'response_end_ms',
  'module_start_ms',
  'ready_ms',
  'response_to_module_ms',
  'module_to_ready_ms',
  'response_to_ready_ms',
  'back_forward_phases',
  'warm_runtime_ready_wait_ms',
  'action_to_popstate_p95_ms',
  'popstate_to_meaningful_ready_p95_ms',
  'meaningful_ready_to_stable_frame_p95_ms',
  'action_to_stable_frame_p95_ms'
]) {
  assert(contract.privacy.allowed_report_fields.includes(field), `privacy allowlist missing ${field}`);
}

assert.strictEqual(
  contract.metrics.cached_first_meaningful_paint_p95.boundary,
  'NAVIGATION_TIME_ORIGIN_TO_FIRST_READY_MEANINGFUL_FRAME',
  'owner FAIL must not be masked by moving cached FMP start boundary'
);
assert.strictEqual(contract.metrics.cached_first_meaningful_paint_p95.threshold_ms, 800, 'cached FMP threshold must not be relaxed');
assert.strictEqual(contract.metrics.back_forward_p95.threshold_ms, 100, 'Back/Forward threshold must not be relaxed');
assert.strictEqual(contract.metrics.back_forward_p95.boundary, 'HISTORY_ACTION_TO_STABLE_MEANINGFUL_FRAME', 'Back/Forward start/end boundary must remain unchanged');
assert.strictEqual(contract.metrics.back_forward_p95.phase_evidence, 'ACTION_POPSTATE_MEANINGFUL_READY_STABLE_FRAME');
assert(!/url|href|amount|transaction|category|member|account|project/i.test(Object.keys(phases).join('|')), 'phase evidence keys must not expose private payload or locators');

console.log('local_first_performance_phase_contract_test: PASS', {
  navigationOriginBoundaryPreserved: true,
  thresholdsPreserved: true,
  diagnosticPhaseSpansOnly: true,
  invalidPhaseOrderingFailsClosed: true,
  privacyAllowlistUpdated: true
});
