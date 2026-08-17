'use strict';

const crypto = require('crypto');
const CONTRACT = require('./financial_health_xray.v1.json');

const VERSION = CONTRACT.version;
const SCHEMA = CONTRACT.schema;
const INPUT_SCHEMA = CONTRACT.schemas.assessment_input;
const SIGNAL_SCHEMA = CONTRACT.schemas.signal;
const FINDING_SCHEMA = CONTRACT.schemas.finding;
const RESULT_SCHEMA = CONTRACT.schemas.result;
const EVIDENCE_SCHEMA = CONTRACT.schemas.evidence;
const DRILL_SCHEMA = CONTRACT.schemas.drill;
const TELEMETRY_SCHEMA = CONTRACT.schemas.telemetry;
const FINDING_TELEMETRY_SCHEMA = CONTRACT.schemas.finding_telemetry;
const HASH_RE = /^[0-9a-f]{64}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const ID_RE = /^[A-Z][A-Z0-9_]{2,95}$/;
const DRILL_TARGETS = new Set(['ANALYTICS_STUDIO','FINANCIAL_RISK','BUDGET_CONTROL','SUBSCRIPTIONS','BALANCE_RECONCILIATION']);
const SEVERITY_RANK = Object.freeze({ NONE:0, INFO:1, WARNING:2, HIGH:3, CRITICAL:4 });

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function exactKeys(value, allowed, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const keys = Object.keys(value);
  if (keys.length !== allowed.length || keys.some((key) => !allowed.includes(key))) fail(code);
}

function hash64(value, code) {
  const text = String(value || '');
  if (!HASH_RE.test(text)) fail(code);
  return text;
}

function safeInteger(value, code) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) fail(code);
  return number;
}

function canonicalRegistry() {
  const rules = CONTRACT.rules.slice().sort((a, b) => a.rule_id.localeCompare(b.rule_id));
  return deepFreeze({
    schema: CONTRACT.schemas.registry,
    version: VERSION,
    registry_id: `xray-registry-${sha256(stableStringify(rules)).slice(0, 48)}`,
    rules: deepFreeze(rules.map((rule) => deepFreeze(JSON.parse(JSON.stringify(rule)))))
  });
}

function assertContract() {
  if (SCHEMA !== 'PRH_FINANCIAL_HEALTH_XRAY_V1' || VERSION !== '1.0.0' || CONTRACT.roadmap_id !== 'XRAY-090') fail('XRAY_CONTRACT_VERSION_INVALID');
  if (CONTRACT.rules.length < 7 || CONTRACT.rules.length > CONTRACT.limits.max_rules) fail('XRAY_RULE_COUNT_INVALID');
  const ids = new Set();
  const signals = new Set();
  for (const rule of CONTRACT.rules) {
    if (!ID_RE.test(rule.rule_id) || !ID_RE.test(rule.signal_id)) fail('XRAY_RULE_ID_INVALID');
    if (ids.has(rule.rule_id) || signals.has(rule.signal_id)) fail('XRAY_RULE_DUPLICATE');
    ids.add(rule.rule_id); signals.add(rule.signal_id);
    if (!Object.values(CONTRACT.source_contracts).includes(rule.source_contract)) fail('XRAY_RULE_SOURCE_CONTRACT_INVALID');
    if (!['ENUM','BASIS_POINTS','COUNT'].includes(rule.value_kind)) fail('XRAY_RULE_VALUE_KIND_INVALID');
    if (!DRILL_TARGETS.has(rule.default_drill_target)) fail('XRAY_RULE_DRILL_TARGET_INVALID');
    const evaluation = rule.evaluation || {};
    if (evaluation.kind === 'ENUM_MAP') {
      if (!evaluation.map || !Object.keys(evaluation.map).length) fail('XRAY_RULE_ENUM_MAP_INVALID');
      for (const decision of Object.values(evaluation.map)) {
        if (!['CLEAR','INSUFFICIENT','INCOMPATIBLE','REVIEW_REQUIRED',...CONTRACT.severities.filter((s) => s !== 'NONE')].includes(decision)) fail('XRAY_RULE_ENUM_DECISION_INVALID');
      }
    } else if (evaluation.kind === 'NUMERIC_GTE') {
      if (!Number.isSafeInteger(evaluation.critical) || !Number.isSafeInteger(evaluation.warning) || evaluation.critical < evaluation.warning) fail('XRAY_RULE_THRESHOLD_INVALID');
    } else if (evaluation.kind === 'NUMERIC_LT') {
      if (!Number.isSafeInteger(evaluation.critical) || !Number.isSafeInteger(evaluation.warning) || evaluation.critical >= evaluation.warning) fail('XRAY_RULE_THRESHOLD_INVALID');
    } else fail('XRAY_RULE_EVALUATION_INVALID');
  }
  if (Object.values(CONTRACT.authorities || {}).some((value) => value !== false) || CONTRACT.free_only !== true) fail('XRAY_AUTHORITY_INVALID');
  if (CONTRACT.privacy.financial_values_in_finding !== false || CONTRACT.privacy.private_ids_in_finding !== false || CONTRACT.privacy.telemetry_financial_payload !== false) fail('XRAY_PRIVACY_POLICY_INVALID');
  canonicalRegistry();
  return true;
}

function normalizeContext(input) {
  const canonical = input && Object.prototype.hasOwnProperty.call(input, 'context_hash');
  exactKeys(input, canonical ? ['currency','period_hash','scope_hash','context_hash'] : ['currency','period_hash','scope_hash'], 'XRAY_CONTEXT_SHAPE_INVALID');
  const currency = String(input.currency || '');
  if (!CURRENCY_RE.test(currency)) fail('XRAY_CONTEXT_CURRENCY_INVALID');
  const periodHash = hash64(input.period_hash, 'XRAY_CONTEXT_PERIOD_HASH_INVALID');
  const scopeHash = hash64(input.scope_hash, 'XRAY_CONTEXT_SCOPE_HASH_INVALID');
  const body = { currency, period_hash: periodHash, scope_hash: scopeHash };
  const contextHash = sha256(stableStringify(body));
  if (canonical && hash64(input.context_hash, 'XRAY_CONTEXT_HASH_INVALID') !== contextHash) fail('XRAY_CONTEXT_HASH_MISMATCH');
  return deepFreeze({ ...body, context_hash: contextHash });
}

function normalizeDrill(input, defaultTarget, context) {
  if (input == null) {
    return deepFreeze({ schema:DRILL_SCHEMA, version:VERSION, target:defaultTarget, query_hash:null, scope_hash:context.scope_hash, state_hash:context.context_hash, read_only:true, financial_payload:false, private_ids:false });
  }
  const canonical = input.schema === DRILL_SCHEMA && input.version === VERSION;
  if (canonical) {
    exactKeys(input, ['schema','version','target','query_hash','scope_hash','state_hash','read_only','financial_payload','private_ids'], 'XRAY_DRILL_SHAPE_INVALID');
    if (input.read_only !== true || input.financial_payload !== false || input.private_ids !== false) fail('XRAY_DRILL_AUTHORITY_INVALID');
  } else {
    exactKeys(input, ['target','query_hash','scope_hash','state_hash'], 'XRAY_DRILL_SHAPE_INVALID');
  }
  const target = String(input.target || '');
  if (!DRILL_TARGETS.has(target)) fail('XRAY_DRILL_TARGET_INVALID');
  const queryHash = input.query_hash == null ? null : hash64(input.query_hash, 'XRAY_DRILL_QUERY_HASH_INVALID');
  const scopeHash = input.scope_hash == null ? context.scope_hash : hash64(input.scope_hash, 'XRAY_DRILL_SCOPE_HASH_INVALID');
  const stateHash = input.state_hash == null ? context.context_hash : hash64(input.state_hash, 'XRAY_DRILL_STATE_HASH_INVALID');
  if (scopeHash !== context.scope_hash) fail('XRAY_DRILL_SCOPE_CONTEXT_MISMATCH');
  return deepFreeze({ schema:DRILL_SCHEMA, version:VERSION, target, query_hash:queryHash, scope_hash:scopeHash, state_hash:stateHash, read_only:true, financial_payload:false, private_ids:false });
}

function normalizeSignal(input, rule, context) {
  exactKeys(input, ['schema','version','signal_id','source_contract','source_hash','context_hash','provenance_kind','state','value_kind','value','evidence_hash','drill'], 'XRAY_SIGNAL_SHAPE_INVALID');
  if (input.schema !== SIGNAL_SCHEMA || input.version !== VERSION || input.signal_id !== rule.signal_id) fail('XRAY_SIGNAL_ID_INVALID');
  if (input.source_contract !== rule.source_contract) fail('XRAY_SIGNAL_SOURCE_CONTRACT_INVALID');
  const sourceHash = hash64(input.source_hash, 'XRAY_SIGNAL_SOURCE_HASH_INVALID');
  const contextHash = hash64(input.context_hash, 'XRAY_SIGNAL_CONTEXT_HASH_INVALID');
  if (contextHash !== context.context_hash) fail('XRAY_SIGNAL_CONTEXT_MISMATCH');
  const provenanceKind = String(input.provenance_kind || '');
  if (!CONTRACT.provenance_kinds.includes(provenanceKind)) fail('XRAY_SIGNAL_PROVENANCE_KIND_INVALID');
  const state = String(input.state || '');
  if (!CONTRACT.signal_states.includes(state)) fail('XRAY_SIGNAL_STATE_INVALID');
  if (input.value_kind !== rule.value_kind) fail('XRAY_SIGNAL_VALUE_KIND_INVALID');
  const evidenceHash = hash64(input.evidence_hash, 'XRAY_SIGNAL_EVIDENCE_HASH_INVALID');
  let value = input.value;
  if (state !== 'AVAILABLE') {
    if (value !== null) fail('XRAY_NONAVAILABLE_SIGNAL_VALUE_FORBIDDEN');
  } else if (rule.value_kind === 'ENUM') {
    value = String(value || '');
    if (!Object.prototype.hasOwnProperty.call(rule.evaluation.map, value)) fail('XRAY_SIGNAL_ENUM_INVALID');
  } else {
    value = safeInteger(value, 'XRAY_SIGNAL_NUMERIC_INVALID');
    if (rule.value_kind === 'BASIS_POINTS' && (value < CONTRACT.limits.basis_points_min || value > CONTRACT.limits.basis_points_max)) fail('XRAY_SIGNAL_BASIS_POINTS_INVALID');
    if (rule.value_kind === 'COUNT' && (value < 0 || value > CONTRACT.limits.max_count_value)) fail('XRAY_SIGNAL_COUNT_INVALID');
  }
  return deepFreeze({
    schema:SIGNAL_SCHEMA, version:VERSION, signal_id:rule.signal_id, source_contract:rule.source_contract,
    source_hash:sourceHash, context_hash:contextHash, provenance_kind:provenanceKind, state,
    value_kind:rule.value_kind, value, evidence_hash:evidenceHash,
    drill:normalizeDrill(input.drill, rule.default_drill_target, context)
  });
}

function decisionFromSeverity(severity) {
  if (!CONTRACT.severities.includes(severity) || severity === 'NONE') fail('XRAY_SEVERITY_INVALID');
  return { state:'TRIGGERED', severity, reason_code:`POLICY_${severity}` };
}

function evaluateAvailable(rule, value) {
  const evaluation = rule.evaluation;
  if (evaluation.kind === 'ENUM_MAP') {
    const decision = evaluation.map[value];
    if (decision === 'CLEAR') return { state:'CLEAR', severity:'NONE', reason_code:'POLICY_CLEAR' };
    if (decision === 'INSUFFICIENT') return { state:'INSUFFICIENT', severity:'NONE', reason_code:'POLICY_INSUFFICIENT' };
    if (decision === 'INCOMPATIBLE') return { state:'INCOMPATIBLE', severity:'NONE', reason_code:'POLICY_INCOMPATIBLE' };
    if (decision === 'REVIEW_REQUIRED') return { state:'REVIEW_REQUIRED', severity:'NONE', reason_code:'POLICY_REVIEW_REQUIRED' };
    return decisionFromSeverity(decision);
  }
  if (evaluation.kind === 'NUMERIC_GTE') {
    if (value >= evaluation.critical) return decisionFromSeverity(evaluation.critical_severity);
    if (value >= evaluation.warning) return decisionFromSeverity(evaluation.warning_severity);
    return { state:'CLEAR', severity:'NONE', reason_code:'POLICY_CLEAR' };
  }
  if (evaluation.kind === 'NUMERIC_LT') {
    if (value < evaluation.critical) return decisionFromSeverity(evaluation.critical_severity);
    if (value < evaluation.warning) return decisionFromSeverity(evaluation.warning_severity);
    return { state:'CLEAR', severity:'NONE', reason_code:'POLICY_CLEAR' };
  }
  fail('XRAY_RULE_EVALUATION_INVALID');
}

function missingFinding(rule, context) {
  return findingFromDecision(rule, null, context, { state:'INSUFFICIENT', severity:'NONE', reason_code:'SIGNAL_MISSING' });
}

function findingFromDecision(rule, signal, context, decision) {
  const evidence = deepFreeze({
    schema:EVIDENCE_SCHEMA, version:VERSION, source_contract:rule.source_contract,
    source_hash:signal ? signal.source_hash : null, evidence_hash:signal ? signal.evidence_hash : null,
    context_hash:context.context_hash, read_only:true, financial_values:false, private_ids:false, causal_claim:false
  });
  const drill = signal ? signal.drill : normalizeDrill(null, rule.default_drill_target, context);
  const valueHash = signal && signal.state === 'AVAILABLE' ? sha256(stableStringify({ kind:signal.value_kind, value:signal.value })) : null;
  const body = {
    schema:FINDING_SCHEMA, version:VERSION, rule_id:rule.rule_id, rule_version:rule.rule_version,
    family:rule.family, state:decision.state, severity:decision.severity,
    score:CONTRACT.score_by_severity[decision.severity], policy_id:rule.policy_id,
    reason_code:decision.reason_code, explanation_code:`${rule.rule_id}_${decision.state}`,
    provenance_kind:signal ? signal.provenance_kind : null, source_contract:rule.source_contract,
    context_hash:context.context_hash, diagnostic_value_hash:valueHash, evidence, drill
  };
  return deepFreeze({ ...body, finding_id:`xray-finding-${sha256(stableStringify(body)).slice(0, 48)}` });
}

function evaluateXray(input) {
  assertContract();
  exactKeys(input, ['schema','version','context','signals'], 'XRAY_INPUT_SHAPE_INVALID');
  if (input.schema !== INPUT_SCHEMA || input.version !== VERSION) fail('XRAY_INPUT_VERSION_INVALID');
  const context = normalizeContext(input.context);
  if (!Array.isArray(input.signals) || input.signals.length > CONTRACT.limits.max_signals) fail('XRAY_SIGNALS_INVALID');
  const registry = canonicalRegistry();
  const ruleBySignal = new Map(registry.rules.map((rule) => [rule.signal_id, rule]));
  const normalized = new Map();
  for (const raw of input.signals) {
    const signalId = String(raw && raw.signal_id || '');
    const rule = ruleBySignal.get(signalId);
    if (!rule) fail('XRAY_SIGNAL_NOT_REGISTERED', signalId);
    if (normalized.has(signalId)) fail('XRAY_SIGNAL_DUPLICATE', signalId);
    normalized.set(signalId, normalizeSignal(raw, rule, context));
  }
  const findings = registry.rules.map((rule) => {
    const signal = normalized.get(rule.signal_id);
    if (!signal) return missingFinding(rule, context);
    if (signal.state === 'MISSING') return findingFromDecision(rule, signal, context, { state:'INSUFFICIENT', severity:'NONE', reason_code:'UPSTREAM_MISSING' });
    if (signal.state === 'INCOMPATIBLE') return findingFromDecision(rule, signal, context, { state:'INCOMPATIBLE', severity:'NONE', reason_code:'UPSTREAM_INCOMPATIBLE' });
    if (signal.state === 'REVIEW_REQUIRED') return findingFromDecision(rule, signal, context, { state:'REVIEW_REQUIRED', severity:'NONE', reason_code:'UPSTREAM_REVIEW_REQUIRED' });
    return findingFromDecision(rule, signal, context, evaluateAvailable(rule, signal.value));
  });
  const counts = { triggered:0, clear:0, insufficient:0, incompatible:0, review_required:0, critical:0, high:0, warning:0, info:0 };
  let overall = 'NONE';
  let score = 0;
  for (const finding of findings) {
    const stateKey = finding.state.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(counts, stateKey)) counts[stateKey] += 1;
    const sevKey = finding.severity.toLowerCase();
    if (finding.severity !== 'NONE') counts[sevKey] += 1;
    if (SEVERITY_RANK[finding.severity] > SEVERITY_RANK[overall]) overall = finding.severity;
    score = Math.max(score, finding.score);
  }
  const body = {
    schema:RESULT_SCHEMA, version:VERSION, registry_id:registry.registry_id, context_hash:context.context_hash,
    finding_count:findings.length, findings:deepFreeze(findings), counts:deepFreeze(counts), overall_severity:overall,
    diagnostic_score:score,
    provenance:deepFreeze({ financial_truth:false, financial_formula:false, causal_claim:false, canonical_mutation:false, financial_write:false, llm_used:false })
  };
  return deepFreeze({ ...body, result_id:`xray-result-${sha256(stableStringify(body)).slice(0, 48)}` });
}

function makeSignal(spec, contextInput) {
  const context = normalizeContext(contextInput);
  if (!spec || typeof spec !== 'object') fail('XRAY_SIGNAL_SPEC_INVALID');
  const registry = canonicalRegistry();
  const rule = registry.rules.find((item) => item.signal_id === spec.signal_id);
  if (!rule) fail('XRAY_SIGNAL_NOT_REGISTERED');
  const sourceIdentity = String(spec.source_identity || '');
  const evidenceIdentity = String(spec.evidence_identity || sourceIdentity);
  if (!sourceIdentity || !evidenceIdentity) fail('XRAY_SIGNAL_IDENTITY_REQUIRED');
  return normalizeSignal({
    schema:SIGNAL_SCHEMA, version:VERSION, signal_id:rule.signal_id, source_contract:rule.source_contract,
    source_hash:sha256(sourceIdentity), context_hash:context.context_hash,
    provenance_kind:spec.provenance_kind, state:spec.state, value_kind:rule.value_kind,
    value:spec.state === 'AVAILABLE' ? spec.value : null, evidence_hash:sha256(evidenceIdentity), drill:spec.drill || null
  }, rule, context);
}

function signalsFromLiquidityRisk(result, contextInput) {
  const context = normalizeContext(contextInput);
  if (!result || result.schema !== 'PRH_LIQUIDITY_RISK_RESULT_V1' || result.version !== '1.0.0') fail('XRAY_RISK_RESULT_INVALID');
  if (!/^risk-[0-9a-f]{48}$/.test(String(result.assessment_id || ''))) fail('XRAY_RISK_RESULT_ID_INVALID');
  const provenance = result.provenance || {};
  if (provenance.financial_truth !== false || provenance.cash_flow_as_current_balance_proxy !== false || provenance.fx_conversion_used !== false || provenance.canonical_mutation !== false || provenance.financial_write !== false) fail('XRAY_RISK_PROVENANCE_INVALID');
  if (!result.emergency_runway || !result.scenario_risk || !result.evidence || result.evidence.read_only !== true || result.evidence.financial_payload_embedded !== false) fail('XRAY_RISK_EVIDENCE_INVALID');
  const review = result.status === 'REVIEW_REQUIRED';
  const missing = result.status === 'INSUFFICIENT_DATA';
  const sourceIdentity = result.assessment_id;
  const evidenceIdentity = stableStringify(result.evidence);
  const riskDrill = { target:'FINANCIAL_RISK', query_hash:null, scope_hash:context.scope_hash, state_hash:sha256(sourceIdentity) };
  return deepFreeze([
    makeSignal({ signal_id:'RISK_EMERGENCY_RUNWAY_STATE', source_identity:sourceIdentity, evidence_identity:evidenceIdentity, provenance_kind:'DERIVED', state:review?'REVIEW_REQUIRED':missing?'MISSING':'AVAILABLE', value:result.emergency_runway.state, drill:riskDrill }, context),
    makeSignal({ signal_id:'RISK_SCENARIO_RISK_STATE', source_identity:sourceIdentity, evidence_identity:evidenceIdentity, provenance_kind:'PROJECTED', state:review?'REVIEW_REQUIRED':missing?'MISSING':'AVAILABLE', value:result.scenario_risk.state, drill:riskDrill }, context)
  ]);
}

function xrayTelemetry(result) {
  if (!result || result.schema !== RESULT_SCHEMA || result.version !== VERSION || !/^xray-result-[0-9a-f]{48}$/.test(String(result.result_id || ''))) fail('XRAY_RESULT_INVALID');
  const output = {
    schema:TELEMETRY_SCHEMA, version:VERSION, result_hash_prefix:sha256(stableStringify(result)).slice(0,12),
    finding_count:result.finding_count, triggered_count:result.counts.triggered, clear_count:result.counts.clear,
    insufficient_count:result.counts.insufficient, incompatible_count:result.counts.incompatible,
    review_required_count:result.counts.review_required, critical_count:result.counts.critical,
    high_count:result.counts.high, warning_count:result.counts.warning, info_count:result.counts.info,
    overall_severity:result.overall_severity
  };
  const extras = Object.keys(output).filter((key) => !CONTRACT.telemetry_allowlist.includes(key));
  if (extras.length) fail('XRAY_TELEMETRY_FIELD_FORBIDDEN');
  return deepFreeze(output);
}

function findingTelemetry(finding) {
  if (!finding || finding.schema !== FINDING_SCHEMA || finding.version !== VERSION || !/^xray-finding-[0-9a-f]{48}$/.test(String(finding.finding_id || ''))) fail('XRAY_FINDING_INVALID');
  const output = { schema:FINDING_TELEMETRY_SCHEMA, version:VERSION, rule_id:finding.rule_id, family:finding.family, state:finding.state, severity:finding.severity, reason_code:finding.reason_code, finding_hash_prefix:sha256(stableStringify(finding)).slice(0,12) };
  const extras = Object.keys(output).filter((key) => !CONTRACT.finding_telemetry_allowlist.includes(key));
  if (extras.length) fail('XRAY_FINDING_TELEMETRY_FIELD_FORBIDDEN');
  return deepFreeze(output);
}

assertContract();

module.exports = Object.freeze({ CONTRACT, VERSION, SCHEMA, INPUT_SCHEMA, SIGNAL_SCHEMA, FINDING_SCHEMA, RESULT_SCHEMA, EVIDENCE_SCHEMA, DRILL_SCHEMA, TELEMETRY_SCHEMA, assertContract, stableStringify, canonicalRegistry, normalizeContext, makeSignal, signalsFromLiquidityRisk, evaluateXray, xrayTelemetry, findingTelemetry });
