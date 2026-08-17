'use strict';

const assert = require('assert');
const crypto = require('crypto');
const XRAY = require('../lib/xray/financial_health_xray');

const h = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
const context = { currency:'RUB', period_hash:h('period:2026'), scope_hash:h('scope:default') };

function signal(signalId, value, options = {}) {
  return XRAY.makeSignal({
    signal_id: signalId,
    source_identity: options.source_identity || `source:${signalId}`,
    evidence_identity: options.evidence_identity || `evidence:${signalId}`,
    provenance_kind: options.provenance_kind || 'DERIVED',
    state: options.state || 'AVAILABLE',
    value,
    drill: options.drill || null
  }, context);
}

assert.strictEqual(XRAY.assertContract(), true);
const registry = XRAY.canonicalRegistry();
assert.strictEqual(registry.schema, 'PRH_XRAY_RULE_REGISTRY_V1');
assert.strictEqual(registry.rules.length, 9);
assert.deepStrictEqual(registry.rules.map((r) => r.rule_id), registry.rules.map((r) => r.rule_id).slice().sort());
assert(Object.isFrozen(registry));

const triggeredSignals = [
  signal('BALANCE_RECONCILIATION_STATE', 'MISMATCH', { provenance_kind:'OBSERVED' }),
  signal('BUDGET_ALERT_STATE', 'AT_RISK', { provenance_kind:'DECLARED' }),
  signal('RISK_SCENARIO_RISK_STATE', 'SHORTFALL', { provenance_kind:'PROJECTED' }),
  signal('DOMINANT_CHANGE_DRIVER_BPS', 9700),
  signal('RISK_EMERGENCY_RUNWAY_STATE', 'CRITICAL'),
  signal('EXPENSE_TOP1_SHARE_BPS', 7000),
  signal('INCOME_TOP1_SHARE_BPS', 8500),
  signal('RECURRING_COMMITMENT_COUNT', 6),
  signal('SAVINGS_POSITIVE_PERIOD_BPS', 2500)
];
const triggeredInput = { schema:XRAY.INPUT_SCHEMA, version:XRAY.VERSION, context, signals:triggeredSignals };
const before = JSON.stringify(triggeredInput);
const triggered = XRAY.evaluateXray(triggeredInput);
assert.strictEqual(JSON.stringify(triggeredInput), before, 'X-Ray must not mutate input');
assert.strictEqual(triggered.finding_count, 9);
assert.strictEqual(triggered.counts.triggered, 8);
assert.strictEqual(triggered.counts.review_required, 1);
assert.strictEqual(triggered.counts.critical, 3);
assert.strictEqual(triggered.counts.high, 2);
assert.strictEqual(triggered.counts.warning, 3);
assert.strictEqual(triggered.overall_severity, 'CRITICAL');
assert.strictEqual(triggered.diagnostic_score, 100);
assert.strictEqual(triggered.provenance.financial_truth, false);
assert.strictEqual(triggered.provenance.financial_formula, false);
assert.strictEqual(triggered.provenance.causal_claim, false);
assert.strictEqual(triggered.provenance.financial_write, false);
assert.strictEqual(triggered.provenance.llm_used, false);
for (const finding of triggered.findings) {
  assert.strictEqual(finding.evidence.read_only, true);
  assert.strictEqual(finding.evidence.financial_values, false);
  assert.strictEqual(finding.evidence.private_ids, false);
  assert.strictEqual(finding.evidence.causal_claim, false);
  assert.strictEqual(finding.drill.read_only, true);
  assert.strictEqual(finding.drill.financial_payload, false);
  assert.strictEqual(finding.drill.private_ids, false);
  assert.match(finding.finding_id, /^xray-finding-[0-9a-f]{48}$/);
}

const reordered = XRAY.evaluateXray({ ...triggeredInput, signals: triggeredSignals.slice().reverse() });
assert.strictEqual(reordered.result_id, triggered.result_id, 'signal order must not alter result identity');
assert.strictEqual(XRAY.stableStringify(reordered), XRAY.stableStringify(triggered));

const clear = XRAY.evaluateXray({ schema:XRAY.INPUT_SCHEMA, version:XRAY.VERSION, context, signals:[
  signal('BALANCE_RECONCILIATION_STATE', 'MATCH', { provenance_kind:'OBSERVED' }),
  signal('BUDGET_ALERT_STATE', 'ON_TRACK', { provenance_kind:'DECLARED' }),
  signal('RISK_SCENARIO_RISK_STATE', 'STABLE', { provenance_kind:'PROJECTED' }),
  signal('DOMINANT_CHANGE_DRIVER_BPS', 2000),
  signal('RISK_EMERGENCY_RUNWAY_STATE', 'OK'),
  signal('EXPENSE_TOP1_SHARE_BPS', 3000),
  signal('INCOME_TOP1_SHARE_BPS', 3500),
  signal('RECURRING_COMMITMENT_COUNT', 2),
  signal('SAVINGS_POSITIVE_PERIOD_BPS', 9000)
]});
assert.strictEqual(clear.counts.clear, 9);
assert.strictEqual(clear.counts.triggered, 0);
assert.strictEqual(clear.overall_severity, 'NONE');
assert.strictEqual(clear.diagnostic_score, 0);

const missing = XRAY.evaluateXray({ schema:XRAY.INPUT_SCHEMA, version:XRAY.VERSION, context, signals:[] });
assert.strictEqual(missing.counts.insufficient, 9);
assert.strictEqual(missing.counts.clear, 0, 'missing signals must never become CLEAR');
assert(missing.findings.every((finding) => finding.reason_code === 'SIGNAL_MISSING'));

const explicitMissing = XRAY.evaluateXray({ schema:XRAY.INPUT_SCHEMA, version:XRAY.VERSION, context, signals:[
  signal('RISK_EMERGENCY_RUNWAY_STATE', null, { state:'MISSING' })
]});
const runwayMissing = explicitMissing.findings.find((finding) => finding.rule_id === 'XRAY_EMERGENCY_RUNWAY');
assert.strictEqual(runwayMissing.state, 'INSUFFICIENT');
assert.strictEqual(runwayMissing.reason_code, 'UPSTREAM_MISSING');

const incompatible = XRAY.evaluateXray({ schema:XRAY.INPUT_SCHEMA, version:XRAY.VERSION, context, signals:[
  signal('INCOME_TOP1_SHARE_BPS', null, { state:'INCOMPATIBLE' })
]});
assert.strictEqual(incompatible.findings.find((f) => f.rule_id === 'XRAY_INCOME_DEPENDENCE').state, 'INCOMPATIBLE');

const review = XRAY.evaluateXray({ schema:XRAY.INPUT_SCHEMA, version:XRAY.VERSION, context, signals:[
  signal('BALANCE_RECONCILIATION_STATE', null, { state:'REVIEW_REQUIRED', provenance_kind:'OBSERVED' })
]});
assert.strictEqual(review.findings.find((f) => f.rule_id === 'XRAY_BALANCE_RECONCILIATION').state, 'REVIEW_REQUIRED');

assert.throws(() => XRAY.evaluateXray({ ...triggeredInput, signals:[triggeredSignals[0], triggeredSignals[0]] }), (e) => e.code === 'XRAY_SIGNAL_DUPLICATE');
assert.throws(() => XRAY.evaluateXray({ ...triggeredInput, signals:[{ ...triggeredSignals[0], source_contract:'PRH_FAKE@1.0.0' }] }), (e) => e.code === 'XRAY_SIGNAL_SOURCE_CONTRACT_INVALID');
assert.throws(() => XRAY.evaluateXray({ ...triggeredInput, signals:[{ ...triggeredSignals[0], context_hash:h('other') }] }), (e) => e.code === 'XRAY_SIGNAL_CONTEXT_MISMATCH');
assert.throws(() => signal('INCOME_TOP1_SHARE_BPS', 10001), (e) => e.code === 'XRAY_SIGNAL_BASIS_POINTS_INVALID');
assert.throws(() => signal('RECURRING_COMMITMENT_COUNT', Number.MAX_SAFE_INTEGER + 1), (e) => e.code === 'XRAY_SIGNAL_NUMERIC_INVALID');
assert.throws(() => signal('RISK_EMERGENCY_RUNWAY_STATE', 'MAGIC_OK'), (e) => e.code === 'XRAY_SIGNAL_ENUM_INVALID');

for (let i = 0; i < 64; i += 1) {
  const value = (i * 137) % 10001;
  const a = XRAY.evaluateXray({ schema:XRAY.INPUT_SCHEMA, version:XRAY.VERSION, context, signals:[signal('INCOME_TOP1_SHARE_BPS', value)] });
  const b = XRAY.evaluateXray({ schema:XRAY.INPUT_SCHEMA, version:XRAY.VERSION, context, signals:[signal('INCOME_TOP1_SHARE_BPS', value)] });
  assert.strictEqual(a.result_id, b.result_id);
  const finding = a.findings.find((f) => f.rule_id === 'XRAY_INCOME_DEPENDENCE');
  assert(['TRIGGERED','CLEAR'].includes(finding.state));
  assert.strictEqual(finding.evidence.causal_claim, false);
}

const syntheticRisk = {
  schema:'PRH_LIQUIDITY_RISK_RESULT_V1', version:'1.0.0', assessment_id:`risk-${h('risk-assessment').slice(0,48)}`,
  status:'READY', emergency_runway:{ state:'WARNING' }, scenario_risk:{ state:'BUFFER_WARNING' },
  evidence:{ read_only:true, financial_payload_embedded:false, synthetic:true },
  provenance:{ financial_truth:false, cash_flow_as_current_balance_proxy:false, fx_conversion_used:false, canonical_mutation:false, financial_write:false }
};
const riskSignals = XRAY.signalsFromLiquidityRisk(syntheticRisk, context);
assert.strictEqual(riskSignals.length, 2);
assert(riskSignals.every((s) => s.source_contract === 'PRH_LIQUIDITY_FINANCIAL_RISK_V1@1.0.0'));
const riskOnly = XRAY.evaluateXray({ schema:XRAY.INPUT_SCHEMA, version:XRAY.VERSION, context, signals:riskSignals });
assert.strictEqual(riskOnly.findings.find((f) => f.rule_id === 'XRAY_EMERGENCY_RUNWAY').severity, 'WARNING');
assert.strictEqual(riskOnly.findings.find((f) => f.rule_id === 'XRAY_CASH_FLOW_DEFICIT').severity, 'WARNING');

const telemetry = XRAY.xrayTelemetry(triggered);
assert.deepStrictEqual(Object.keys(telemetry).sort(), XRAY.CONTRACT.telemetry_allowlist.slice().sort());
const findingTelemetry = XRAY.findingTelemetry(triggered.findings.find((f) => f.rule_id === 'XRAY_INCOME_DEPENDENCE'));
assert.deepStrictEqual(Object.keys(findingTelemetry).sort(), XRAY.CONTRACT.finding_telemetry_allowlist.slice().sort());
const publicText = JSON.stringify({ telemetry, findingTelemetry });
for (const forbidden of ['8500','7000','9700','source:','evidence:','RUB','xray-finding-']) assert.strictEqual(publicText.includes(forbidden), false, `public telemetry leaked ${forbidden}`);

const source = require('fs').readFileSync(require('path').join(__dirname, '..', 'lib/xray/financial_health_xray.js'), 'utf8');
assert(!/SpreadsheetApp|UrlFetchApp|HtmlService|XMLHttpRequest|\bdocument\.|\bwindow\.|setValues|appendRow/.test(source));
assert(!/financial_truth\s*:\s*true|financial_write\s*:\s*true|canonical_mutation\s*:\s*true|causal_claim\s*:\s*true|llm_used\s*:\s*true/.test(source));

console.log('financial_health_xray_contract: PASS', {
  contract: `${XRAY.CONTRACT.schema}@${XRAY.CONTRACT.version}`,
  rules: registry.rules.length,
  triggered: triggered.counts.triggered,
  missingNeverClear: missing.counts.clear === 0,
  risk030Adapter: riskSignals.length === 2,
  deterministicPropertyIterations: 64,
  financialTruth: triggered.provenance.financial_truth,
  causalClaim: triggered.provenance.causal_claim,
  financialWrite: triggered.provenance.financial_write,
  llmUsed: triggered.provenance.llm_used,
  freeOnly: XRAY.CONTRACT.free_only
});
