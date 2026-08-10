'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROUTER = require('../lib/ai/model_cost_routing');
const CONTRACT = require('../lib/ai/model_cost_routing.v1.json');

assert.strictEqual(CONTRACT.schema, 'PRH_AI_MODEL_COST_ROUTING_V1');
assert.strictEqual(CONTRACT.version, '1.0.0');
assert.strictEqual(CONTRACT.roadmap_id, 'AIENG-006');
assert.strictEqual(CONTRACT.cost.mode, 'FREE_ONLY');
assert.strictEqual(CONTRACT.billing_boundary.chatgpt_and_api_separate, true);
assert.strictEqual(CONTRACT.billing_boundary.plus_includes_api_usage, false);
assert.strictEqual(CONTRACT.billing_boundary.paid_api_required, false);
assert.strictEqual(CONTRACT.billing_boundary.current_model_availability_hardcoded, false);
assert.strictEqual(CONTRACT.surfaces.OPENAI_API.enabled, false);
assert.strictEqual(CONTRACT.surfaces.OPENAI_API.automatic_billing_enablement, false);
assert.strictEqual(CONTRACT.exhaustion.red_gate_bypass_allowed, false);
assert.strictEqual(CONTRACT.exhaustion.automatic_api_fallback_allowed, false);
assert(Object.values(CONTRACT.authority).every((value) => value === false));

for (const lane of ['SOL', 'TERRA', 'LUNA']) {
  assert.strictEqual(CONTRACT.lanes[lane].kind, 'INTERNAL_WORKLOAD_LANE');
  assert.strictEqual(CONTRACT.lanes[lane].vendor_model_id, null, `${lane} must not claim a vendor model entitlement`);
}

const noModels = { SOL: 'UNKNOWN', TERRA: 'EXHAUSTED', LUNA: 'UNAVAILABLE' };
const machineGate = ROUTER.routeWorkload({ workload_class: 'MACHINE_GATE' }, noModels);
assert.deepStrictEqual(machineGate, {
  schema: CONTRACT.schema,
  version: CONTRACT.version,
  workload_class: 'MACHINE_GATE',
  required: true,
  route: 'RUN_LOCAL_DETERMINISTIC',
  lane: null,
  capability_state: 'NOT_APPLICABLE',
  reason_code: 'AI_ROUTE_MACHINE_GATE_LOCAL_ONLY',
  fallback_count: 0,
  machine_gate_bypass: false,
  api_used: false
});

const standard = ROUTER.routeWorkload({ workload_class: 'STANDARD_ENGINEERING' }, { SOL:'AVAILABLE', TERRA:'AVAILABLE', LUNA:'AVAILABLE' });
assert.strictEqual(standard.route, 'RUN_CHATGPT_SUBSCRIPTION');
assert.strictEqual(standard.lane, 'SOL');
assert.strictEqual(standard.reason_code, 'AI_ROUTE_SUBSCRIPTION_AVAILABLE');
assert.strictEqual(standard.fallback_count, 0);

const standardFallback = ROUTER.routeWorkload({ workload_class: 'STANDARD_ENGINEERING' }, { SOL:'EXHAUSTED', TERRA:'AVAILABLE', LUNA:'AVAILABLE' });
assert.strictEqual(standardFallback.route, 'RUN_CHATGPT_SUBSCRIPTION');
assert.strictEqual(standardFallback.lane, 'TERRA');
assert.strictEqual(standardFallback.reason_code, 'AI_ROUTE_FALLBACK_USED');
assert.strictEqual(standardFallback.fallback_count, 1);

const deep = ROUTER.routeWorkload({ workload_class: 'DEEP_REVIEW' }, { TERRA:'EXHAUSTED', SOL:'AVAILABLE', LUNA:'AVAILABLE' });
assert.strictEqual(deep.lane, 'SOL');
assert.strictEqual(deep.fallback_count, 1);
assert.notStrictEqual(deep.lane, 'LUNA', 'DEEP_REVIEW policy intentionally excludes LUNA fallback');

const requiredPause = ROUTER.routeWorkload({ workload_class: 'DEEP_REVIEW' }, { TERRA:'EXHAUSTED', SOL:'UNKNOWN', LUNA:'AVAILABLE' });
assert.strictEqual(requiredPause.route, 'PAUSE_REQUIRED_WORK');
assert.strictEqual(requiredPause.reason_code, 'AI_ROUTE_REQUIRED_CAPACITY_EXHAUSTED');
assert.strictEqual(requiredPause.api_used, false);
assert.strictEqual(requiredPause.machine_gate_bypass, false);

const optionalDeferred = ROUTER.routeWorkload({ workload_class: 'QUICK_DOC' }, { LUNA:'EXHAUSTED', SOL:'UNAVAILABLE', TERRA:'UNKNOWN' });
assert.strictEqual(optionalDeferred.route, 'DEFER_OPTIONAL');
assert.strictEqual(optionalDeferred.reason_code, 'AI_ROUTE_OPTIONAL_DEFERRED');
assert.strictEqual(optionalDeferred.api_used, false);

const apiRequired = ROUTER.routeWorkload({ workload_class:'STANDARD_ENGINEERING', requested_surface:'OPENAI_API' }, { SOL:'AVAILABLE' });
assert.strictEqual(apiRequired.route, 'PAUSE_REQUIRED_WORK');
assert.strictEqual(apiRequired.reason_code, 'AI_ROUTE_API_SEPARATE_BILLING_DISABLED');
assert.strictEqual(apiRequired.api_used, false);

const apiOptional = ROUTER.routeWorkload({ workload_class:'OPTIONAL_REVIEW', requested_surface:'OPENAI_API' }, { SOL:'AVAILABLE' });
assert.strictEqual(apiOptional.route, 'DEFER_OPTIONAL');
assert.strictEqual(apiOptional.reason_code, 'AI_ROUTE_API_SEPARATE_BILLING_DISABLED');
assert.strictEqual(apiOptional.api_used, false);

assert.throws(() => ROUTER.routeWorkload({ workload_class:'UNKNOWN' }, {}), /AI_ROUTE_WORKLOAD_UNKNOWN/);
assert.throws(() => ROUTER.routeWorkload({ workload_class:'STANDARD_ENGINEERING' }, { SOL:'PAID_BURST' }), /AI_ROUTE_CAPABILITY_STATE_INVALID/);

const telemetry = ROUTER.routingTelemetry(standardFallback);
assert.deepStrictEqual(Object.keys(telemetry).sort(), CONTRACT.telemetry.allowlist.slice().sort());
assert.strictEqual(telemetry.lane, 'TERRA');
assert.strictEqual(telemetry.required, true);
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['prompt','response','amount_minor','counterparty','billing_token','api_key','access_token','refresh_token']) {
  assert(!telemetryText.toLowerCase().includes(forbidden), `Routing telemetry leaked ${forbidden}`);
}

const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'ai', 'model_cost_routing.js'), 'utf8');
assert(!/fetch\s*\(|UrlFetchApp|XMLHttpRequest|openai\s*\.\s*responses|chat\.completions/i.test(source), 'Router must not call network/provider APIs');
assert(!/billingAccounts|enableBilling|paidOverageAllowed\s*[:=]\s*true/i.test(source), 'Router must not enable billing');
assert(source.includes('RUN_LOCAL_DETERMINISTIC'), 'Required machine gates must remain local deterministic');
assert(source.includes('PAUSE_REQUIRED_WORK'), 'Required exhaustion must pause rather than bypass');

console.log('ai_model_cost_routing_contract_test: OK', {
  contract: `${CONTRACT.schema}@${CONTRACT.version}`,
  internalLanes: Object.keys(CONTRACT.lanes),
  machineGateModelIndependent: true,
  subscriptionFallbackDeterministic: true,
  requiredExhaustion: 'PAUSE_REQUIRED_WORK',
  optionalExhaustion: 'DEFER_OPTIONAL',
  apiSeparateBilling: true,
  apiEnabled: false,
  paidApiRequired: false,
  redGateBypass: false,
  publicTelemetryPayload: false,
  freeOnly: true
});
