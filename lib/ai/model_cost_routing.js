'use strict';

const CONTRACT = require('./model_cost_routing.v1.json');

const CAPABILITY_STATES = new Set(CONTRACT.capability_states);
const LANES = new Set(Object.keys(CONTRACT.lanes));
const WORKLOADS = new Set(Object.keys(CONTRACT.workload_classes));

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function assertContract() {
  if (CONTRACT.schema !== 'PRH_AI_MODEL_COST_ROUTING_V1' || CONTRACT.version !== '1.0.0' || CONTRACT.roadmap_id !== 'AIENG-006') fail('AI_ROUTE_CONTRACT_INVALID');
  if (CONTRACT.policy_mode !== 'FREE_ONLY_SUBSCRIPTION_FIRST' || CONTRACT.cost.mode !== 'FREE_ONLY') fail('AI_ROUTE_COST_MODE_INVALID');
  if (CONTRACT.surfaces.OPENAI_API.enabled !== false || CONTRACT.surfaces.OPENAI_API.required_machine_gates_allowed !== false || CONTRACT.surfaces.OPENAI_API.required_engineering_allowed !== false || CONTRACT.surfaces.OPENAI_API.automatic_billing_enablement !== false) fail('AI_ROUTE_API_POLICY_INVALID');
  if (CONTRACT.surfaces.LOCAL_DETERMINISTIC.required_machine_gates_allowed !== true || CONTRACT.surfaces.LOCAL_DETERMINISTIC.ai_model_required !== false) fail('AI_ROUTE_MACHINE_GATE_POLICY_INVALID');
  if (CONTRACT.surfaces.CHATGPT_SUBSCRIPTION.hardcoded_model_entitlement !== false || CONTRACT.billing_boundary.current_model_availability_hardcoded !== false) fail('AI_ROUTE_ENTITLEMENT_POLICY_INVALID');
  if (CONTRACT.billing_boundary.chatgpt_and_api_separate !== true || CONTRACT.billing_boundary.plus_includes_api_usage !== false || CONTRACT.billing_boundary.paid_api_required !== false) fail('AI_ROUTE_BILLING_BOUNDARY_INVALID');
  if (CONTRACT.exhaustion.red_gate_bypass_allowed !== false || CONTRACT.exhaustion.automatic_api_fallback_allowed !== false) fail('AI_ROUTE_EXHAUSTION_POLICY_INVALID');
  if (Object.values(CONTRACT.authority).some(Boolean)) fail('AI_ROUTE_AUTHORITY_INVALID');
  for (const [lane, definition] of Object.entries(CONTRACT.lanes)) {
    if (!LANES.has(lane) || definition.kind !== 'INTERNAL_WORKLOAD_LANE' || definition.vendor_model_id !== null) fail('AI_ROUTE_LANE_INVALID');
  }
  return true;
}

function normalizeCapabilityState(input = {}) {
  const result = {};
  for (const lane of LANES) {
    const state = String(input[lane] || 'UNKNOWN').toUpperCase();
    if (!CAPABILITY_STATES.has(state)) fail('AI_ROUTE_CAPABILITY_STATE_INVALID');
    result[lane] = state;
  }
  return Object.freeze(result);
}

function routeWorkload(request = {}, capabilityInput = {}) {
  assertContract();
  const workloadClass = String(request.workload_class || '').toUpperCase();
  if (!WORKLOADS.has(workloadClass)) fail('AI_ROUTE_WORKLOAD_UNKNOWN');
  const policy = CONTRACT.workload_classes[workloadClass];
  const capabilities = normalizeCapabilityState(capabilityInput);

  if (policy.machine_authority === true) {
    if (policy.surface !== 'LOCAL_DETERMINISTIC' || policy.required !== true || policy.lane_order.length !== 0) fail('AI_ROUTE_MACHINE_GATE_POLICY_INVALID');
    return Object.freeze({
      schema: CONTRACT.schema,
      version: CONTRACT.version,
      workload_class: workloadClass,
      required: true,
      route: 'RUN_LOCAL_DETERMINISTIC',
      lane: null,
      capability_state: 'NOT_APPLICABLE',
      reason_code: 'AI_ROUTE_MACHINE_GATE_LOCAL_ONLY',
      fallback_count: 0,
      machine_gate_bypass: false,
      api_used: false
    });
  }

  if (String(request.requested_surface || 'CHATGPT_SUBSCRIPTION').toUpperCase() === 'OPENAI_API') {
    return Object.freeze({
      schema: CONTRACT.schema,
      version: CONTRACT.version,
      workload_class: workloadClass,
      required: policy.required,
      route: policy.required ? 'PAUSE_REQUIRED_WORK' : 'DEFER_OPTIONAL',
      lane: null,
      capability_state: 'NOT_APPLICABLE',
      reason_code: 'AI_ROUTE_API_SEPARATE_BILLING_DISABLED',
      fallback_count: 0,
      machine_gate_bypass: false,
      api_used: false
    });
  }

  for (let index = 0; index < policy.lane_order.length; index += 1) {
    const lane = policy.lane_order[index];
    const state = capabilities[lane];
    if (state === 'AVAILABLE') {
      return Object.freeze({
        schema: CONTRACT.schema,
        version: CONTRACT.version,
        workload_class: workloadClass,
        required: policy.required,
        route: 'RUN_CHATGPT_SUBSCRIPTION',
        lane,
        capability_state: state,
        reason_code: index === 0 ? 'AI_ROUTE_SUBSCRIPTION_AVAILABLE' : 'AI_ROUTE_FALLBACK_USED',
        fallback_count: index,
        machine_gate_bypass: false,
        api_used: false
      });
    }
  }

  return Object.freeze({
    schema: CONTRACT.schema,
    version: CONTRACT.version,
    workload_class: workloadClass,
    required: policy.required,
    route: policy.required ? 'PAUSE_REQUIRED_WORK' : 'DEFER_OPTIONAL',
    lane: null,
    capability_state: summarizeCapacity(policy.lane_order, capabilities),
    reason_code: policy.required ? 'AI_ROUTE_REQUIRED_CAPACITY_EXHAUSTED' : 'AI_ROUTE_OPTIONAL_DEFERRED',
    fallback_count: policy.lane_order.length,
    machine_gate_bypass: false,
    api_used: false
  });
}

function summarizeCapacity(lanes, capabilities) {
  const states = lanes.map((lane) => capabilities[lane]);
  if (states.includes('UNKNOWN')) return 'UNKNOWN';
  if (states.includes('EXHAUSTED')) return 'EXHAUSTED';
  return 'UNAVAILABLE';
}

function routingTelemetry(decision) {
  if (!decision || decision.schema !== CONTRACT.schema || decision.version !== CONTRACT.version) fail('AI_ROUTE_DECISION_INVALID');
  const telemetry = Object.freeze({
    schema: CONTRACT.schema,
    version: CONTRACT.version,
    workload_class: decision.workload_class,
    required: decision.required,
    route: decision.route,
    lane: decision.lane,
    capability_state: decision.capability_state,
    reason_code: decision.reason_code,
    fallback_count: decision.fallback_count
  });
  const allowed = new Set(CONTRACT.telemetry.allowlist);
  if (Object.keys(telemetry).some((key) => !allowed.has(key))) fail('AI_ROUTE_TELEMETRY_FIELD_FORBIDDEN');
  const text = JSON.stringify(telemetry);
  if (/prompt|response|amount_minor|counterparty|description|account[_-]?id|billing[_-]?token|api[_-]?key|access[_-]?token|refresh[_-]?token/i.test(text)) fail('AI_ROUTE_TELEMETRY_PAYLOAD_FORBIDDEN');
  return telemetry;
}

assertContract();
module.exports = Object.freeze({ CONTRACT, assertContract, normalizeCapabilityState, routeWorkload, routingTelemetry });
