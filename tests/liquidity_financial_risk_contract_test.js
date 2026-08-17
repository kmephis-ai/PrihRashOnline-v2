'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { normalizeCanonicalTransaction } = require('../lib/domain/canonical_transaction');
const TREND = require('../lib/analytics/long_term_trends');
const PROJ = require('../lib/planning/cash_flow_projection');
const NW = require('../lib/networth/net_worth');
const RISK = require('../lib/risk/liquidity_financial_risk');

function hash(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function tx(index, month, cashFlowMinor) {
  const type = cashFlowMinor >= 0 ? 'income' : 'expense';
  return normalizeCanonicalTransaction({
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: `RISK-TX-${String(index).padStart(3, '0')}`,
    occurred_at: `${month}-15T12:00:00Z`,
    type,
    status: 'posted',
    amount_minor: Math.abs(cashFlowMinor),
    currency: 'RUB',
    account_id: 'acct-synthetic-risk',
    destination_account_id: null,
    category_id: type === 'income' ? 'income-synthetic-risk' : 'expense-synthetic-risk',
    member_id: null,
    project_id: null,
    tags: ['synthetic-risk'],
    counterparty: null,
    description: null,
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC',
      source_container: 'fixture:risk-030',
      source_record_id: `RISK-REC-${index}`,
      source_fingerprint: hash(`risk:${index}:${cashFlowMinor}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'RISK-030-SYNTHETIC-v1',
      source_position: null
    }
  });
}

function trendQuery() {
  return {
    schema: TREND.QUERY_SCHEMA,
    contract_version: TREND.VERSION,
    currency: 'RUB',
    measures: ['CASH_FLOW'],
    dimension: null,
    filters: [],
    sort: [],
    parameters: {},
    limit: 500,
    trend: { selector: { kind: 'EXPLICIT_RANGE', start: '2026-01-01', end: '2026-10-01' }, grain: 'MONTH', comparison_mode: 'NONE' }
  };
}

function projection(values, scenarioOverrides = {}) {
  const transactions = values.map((value, index) => tx(index + 1, `2026-${String(index + 1).padStart(2, '0')}`, value));
  const trend = TREND.evaluateLongTermTrend(transactions, trendQuery());
  return PROJ.projectCashFlow(trend, {
    schema: PROJ.SCENARIO_SCHEMA,
    version: PROJ.VERSION,
    horizon_months: 3,
    monthly_adjustment_minor: 0,
    one_off_adjustments: [],
    ...scenarioOverrides
  });
}

function account(positionId, valueMinor, options = {}) {
  const valuationDate = options.valuation_date || '2026-09-30';
  const mismatch = options.mismatch === true;
  return {
    schema: NW.POSITION_SCHEMA,
    version: NW.VERSION,
    position_id: positionId,
    type: 'ACCOUNT',
    label: `Synthetic ${positionId}`,
    valuation_date: valuationDate,
    currency: 'RUB',
    value_minor: valueMinor,
    provenance: {
      source_kind: 'OBSERVED_BALANCE',
      account_id: `${positionId}-account`,
      observation_id: `${positionId}-observation`,
      reconciliation_id: mismatch ? `${positionId}-reconciliation` : null,
      reconciliation_state: mismatch ? 'MISMATCH' : null
    }
  };
}

function valuation(positionId, type, valueMinor, options = {}) {
  const valuationDate = options.valuation_date || '2026-09-30';
  return {
    schema: NW.POSITION_SCHEMA,
    version: NW.VERSION,
    position_id: positionId,
    type,
    label: `Synthetic ${positionId}`,
    valuation_date: valuationDate,
    currency: 'RUB',
    value_minor: valueMinor,
    provenance: {
      source_kind: 'SYNTHETIC_TEST',
      source_record_id: `synthetic:${positionId}`,
      source_fingerprint: hash(`valuation:${positionId}:${valueMinor}`)
    }
  };
}

function netWorth(options = {}) {
  const valuationDate = options.valuation_date || '2026-09-30';
  return NW.evaluateNetWorth({
    schema: NW.SNAPSHOT_SCHEMA,
    version: NW.VERSION,
    snapshot_id: 'risk-synthetic-snapshot',
    valuation_date: valuationDate,
    currency: 'RUB',
    positions: [
      account('liquid-cash', 120000, { valuation_date: valuationDate, mismatch: options.mismatch_selected === true }),
      account('liquid-checking', 30000, { valuation_date: valuationDate }),
      account('overdraft', -10000, { valuation_date: valuationDate }),
      valuation('declared-asset', 'ASSET', 500000, { valuation_date: valuationDate }),
      valuation('declared-liability', 'LIABILITY', 100000, { valuation_date: valuationDate })
    ]
  });
}

function essential(amountMinor = 20000) {
  if (amountMinor == null) return { amount_minor: null, provenance: null };
  return {
    amount_minor: amountMinor,
    provenance: {
      source_kind: 'SYNTHETIC_TEST',
      source_record_id: 'synthetic:essential-outflow',
      source_fingerprint: hash(`essential:${amountMinor}`)
    }
  };
}

function assessment(projectionResult, overrides = {}) {
  return {
    schema: RISK.INPUT_SCHEMA,
    version: RISK.VERSION,
    currency: 'RUB',
    projection_currency: 'RUB',
    net_worth_result: netWorth(),
    projection_result: projectionResult,
    liquid_position_ids: ['liquid-cash', 'liquid-checking'],
    essential_monthly_outflow: essential(),
    ...overrides
  };
}

const positiveProjection = projection([10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000]);
const deficitProjection = projection([-10000, -15000, -20000, -25000, -30000, -35000, -40000, -45000, -50000]);
const shortfallProjection = projection([-10000, -15000, -20000, -25000, -30000, -35000, -40000, -45000, -50000], { monthly_adjustment_minor: -50000 });

assert.strictEqual(RISK.assertContract(), true);
assert.strictEqual(RISK.CONTRACT.schema, 'PRH_LIQUIDITY_FINANCIAL_RISK_V1');
assert.strictEqual(RISK.CONTRACT.version, '1.0.0');
assert.strictEqual(RISK.CONTRACT.roadmap_id, 'RISK-030');
assert.strictEqual(RISK.CONTRACT.dependencies.net_worth, 'PRH_NET_WORTH_V1@1.0.0');
assert.strictEqual(RISK.CONTRACT.dependencies.cash_flow_projection, 'PRH_CASH_FLOW_PROJECTION_V1@1.0.0');
assert.strictEqual(RISK.CONTRACT.currency_policy.fx_conversion, false);
assert.strictEqual(RISK.CONTRACT.currency_policy.projection_result_embeds_currency, false);
assert.strictEqual(RISK.CONTRACT.currency_policy.projection_currency_binding, 'EXPLICIT_CALLER_CONTEXT_REQUIRED');
assert.strictEqual(RISK.CONTRACT.liquidity_policy.cash_flow_as_current_balance_proxy, false);
assert.strictEqual(RISK.CONTRACT.period_policy.max_snapshot_age_days_before_first_forecast_month, 31);
assert.strictEqual(RISK.CONTRACT.essential_outflow_policy.financial_truth, false);
assert.strictEqual(RISK.CONTRACT.free_only, true);
assert.ok(Object.values(RISK.CONTRACT.authorities).every((value) => value === false));

assert.strictEqual(RISK.ratioBasisPoints(150000, 20000), 75000);
assert.strictEqual(RISK.ratioBasisPoints(10000, 30000), 3333, 'runway ratio must floor conservatively');

const stableInput = assessment(positiveProjection);
const stableBefore = JSON.stringify(stableInput);
const stable = RISK.evaluateLiquidityRisk(stableInput);
assert.strictEqual(JSON.stringify(stableInput), stableBefore, 'RISK-030 must not mutate inputs');
assert.strictEqual(stable.status, 'READY');
assert.strictEqual(stable.reason_code, 'OK');
assert.strictEqual(stable.currency, 'RUB');
assert.strictEqual(stable.liquidity.selected_position_count, 2);
assert.strictEqual(stable.liquidity.current_liquidity_minor, 150000);
assert.strictEqual(stable.liquidity.negative_cash_flow_month_count, 0);
assert.strictEqual(stable.liquidity.first_shortfall_month, null);
assert.strictEqual(stable.emergency_runway.months_basis_points, 75000);
assert.strictEqual(stable.emergency_runway.state, 'OK');
assert.strictEqual(stable.scenario_risk.state, 'STABLE');
assert.strictEqual(stable.provenance.financial_truth, false);
assert.strictEqual(stable.provenance.cash_flow_as_current_balance_proxy, false);
assert.strictEqual(stable.provenance.fx_conversion_used, false);
assert.strictEqual(stable.provenance.canonical_mutation, false);
assert.strictEqual(stable.provenance.financial_write, false);
assert.strictEqual(stable.evidence.read_only, true);
assert.strictEqual(stable.evidence.mutation_authority, false);
assert.strictEqual(stable.evidence.financial_payload_embedded, false);
assert.match(stable.evidence.projection_sha256, /^[0-9a-f]{64}$/);
assert.match(stable.evidence.liquid_selection_sha256, /^[0-9a-f]{64}$/);

const reordered = RISK.evaluateLiquidityRisk(assessment(positiveProjection, { liquid_position_ids: ['liquid-checking', 'liquid-cash'] }));
assert.strictEqual(reordered.assessment_id, stable.assessment_id, 'liquid selection order must not alter assessment identity');
assert.strictEqual(reordered.evidence.liquid_selection_sha256, stable.evidence.liquid_selection_sha256);

const deficit = RISK.evaluateLiquidityRisk(assessment(deficitProjection, { essential_monthly_outflow: essential(50000) }));
assert.strictEqual(deficit.status, 'READY');
assert.strictEqual(deficit.liquidity.current_liquidity_minor, 150000);
assert.strictEqual(deficit.emergency_runway.months_basis_points, 30000);
assert.strictEqual(deficit.emergency_runway.state, 'WARNING');
assert.strictEqual(deficit.scenario_risk.state, 'BUFFER_CRITICAL');
assert.strictEqual(deficit.liquidity.first_shortfall_month, null);
assert.strictEqual(deficit.liquidity.negative_cash_flow_month_count, 3);

const shortfall = RISK.evaluateLiquidityRisk(assessment(shortfallProjection, { essential_monthly_outflow: essential(50000) }));
assert.strictEqual(shortfall.scenario_risk.state, 'SHORTFALL');
assert.strictEqual(shortfall.liquidity.first_shortfall_month, '2026-11-01');
assert.strictEqual(shortfall.scenario_risk.minimum_buffer_months_basis_points, null);

const reviewRequired = RISK.evaluateLiquidityRisk(assessment(positiveProjection, { net_worth_result: netWorth({ mismatch_selected: true }) }));
assert.strictEqual(reviewRequired.status, 'REVIEW_REQUIRED');
assert.strictEqual(reviewRequired.reason_code, 'NET_WORTH_RECONCILIATION_REVIEW_REQUIRED');
assert.strictEqual(reviewRequired.provenance.reconciliation_review_required, true);
assert.strictEqual(reviewRequired.liquidity.current_liquidity_minor, 150000, 'explicit selected value may remain explainable but cannot claim READY');

const partial = RISK.evaluateLiquidityRisk(assessment(positiveProjection, { essential_monthly_outflow: essential(null) }));
assert.strictEqual(partial.status, 'PARTIAL');
assert.strictEqual(partial.reason_code, 'ESSENTIAL_OUTFLOW_REQUIRED_FOR_RUNWAY');
assert.strictEqual(partial.emergency_runway.months_basis_points, null);
assert.strictEqual(partial.emergency_runway.state, 'INSUFFICIENT_DATA');
assert.strictEqual(partial.scenario_risk.state, 'BURN_RATE_REQUIRED');

const missingSelection = RISK.evaluateLiquidityRisk(assessment(positiveProjection, { liquid_position_ids: null }));
assert.strictEqual(missingSelection.status, 'INSUFFICIENT_DATA');
assert.strictEqual(missingSelection.reason_code, 'LIQUIDITY_SELECTION_REQUIRED');
assert.strictEqual(missingSelection.liquidity, null);
assert.strictEqual(missingSelection.emergency_runway.months_basis_points, null);
assert.strictEqual(missingSelection.scenario_risk.state, 'LIQUIDITY_SELECTION_REQUIRED');
assert.strictEqual(missingSelection.evidence.liquid_selection_sha256, null);

const explicitZero = RISK.evaluateLiquidityRisk(assessment(positiveProjection, { liquid_position_ids: [] }));
assert.strictEqual(explicitZero.status, 'READY');
assert.strictEqual(explicitZero.liquidity.current_liquidity_minor, 0);
assert.strictEqual(explicitZero.emergency_runway.months_basis_points, 0);
assert.strictEqual(explicitZero.emergency_runway.state, 'CRITICAL');

assert.throws(() => RISK.evaluateLiquidityRisk(assessment(positiveProjection, { projection_currency: 'USD' })), (error) => error.code === 'RISK_PROJECTION_CURRENCY_MISMATCH');
assert.throws(() => RISK.evaluateLiquidityRisk(assessment(positiveProjection, { currency: 'USD', projection_currency: 'USD' })), (error) => error.code === 'RISK_NET_WORTH_CURRENCY_MISMATCH');
assert.throws(() => RISK.evaluateLiquidityRisk(assessment(positiveProjection, { net_worth_result: netWorth({ valuation_date: '2026-08-01' }) })), (error) => error.code === 'RISK_PERIOD_CONTEXT_MISMATCH');
assert.throws(() => RISK.evaluateLiquidityRisk(assessment(positiveProjection, { net_worth_result: netWorth({ valuation_date: '2026-10-02' }) })), (error) => error.code === 'RISK_PERIOD_CONTEXT_MISMATCH');
assert.throws(() => RISK.evaluateLiquidityRisk(assessment(positiveProjection, { liquid_position_ids: ['liquid-cash', 'liquid-cash'] })), (error) => error.code === 'RISK_LIQUID_POSITION_DUPLICATE');
assert.throws(() => RISK.evaluateLiquidityRisk(assessment(positiveProjection, { liquid_position_ids: ['missing-position'] })), (error) => error.code === 'RISK_LIQUID_POSITION_NOT_FOUND');
assert.throws(() => RISK.evaluateLiquidityRisk(assessment(positiveProjection, { liquid_position_ids: ['declared-liability'] })), (error) => error.code === 'RISK_LIQUID_POSITION_NOT_ELIGIBLE');
assert.throws(() => RISK.evaluateLiquidityRisk(assessment(positiveProjection, { liquid_position_ids: ['overdraft'] })), (error) => error.code === 'RISK_LIQUID_POSITION_NOT_ELIGIBLE');
assert.throws(() => RISK.evaluateLiquidityRisk(assessment(positiveProjection, { essential_monthly_outflow: essential(0) })), (error) => error.code === 'RISK_ESSENTIAL_OUTFLOW_INVALID');
assert.throws(() => RISK.evaluateLiquidityRisk(assessment(positiveProjection, { essential_monthly_outflow: { amount_minor: null, provenance: essential(100).provenance } })), (error) => error.code === 'RISK_ESSENTIAL_OUTFLOW_PROVENANCE_WITHOUT_AMOUNT');

const tamperedNw = JSON.parse(JSON.stringify(netWorth()));
tamperedNw.net_worth_minor += 1;
assert.throws(() => RISK.evaluateLiquidityRisk(assessment(positiveProjection, { net_worth_result: tamperedNw })), (error) => error.code === 'RISK_NET_WORTH_RESULT_INTEGRITY_INVALID');

const tamperedProjection = JSON.parse(JSON.stringify(positiveProjection));
tamperedProjection.forecast[0].projected_cash_flow_minor += 1;
assert.throws(() => RISK.evaluateLiquidityRisk(assessment(tamperedProjection)), (error) => error.code === 'RISK_PROJECTION_ARITHMETIC_INVALID');


const tamperedBacktest = JSON.parse(JSON.stringify(positiveProjection));
tamperedBacktest.backtest.mean_absolute_error_minor += 1;
assert.throws(() => RISK.evaluateLiquidityRisk(assessment(tamperedBacktest)), (error) => error.code === 'RISK_PROJECTION_BACKTEST_METRICS_INVALID');

const tamperedBacktestPoint = JSON.parse(JSON.stringify(positiveProjection));
tamperedBacktestPoint.backtest.points[0].actual_minor += 1;
assert.throws(() => RISK.evaluateLiquidityRisk(assessment(tamperedBacktestPoint)), (error) => ['RISK_PROJECTION_BACKTEST_ARITHMETIC_INVALID', 'RISK_PROJECTION_BACKTEST_METRICS_INVALID'].includes(error.code));

const tamperedBaseline = JSON.parse(JSON.stringify(positiveProjection));
for (const row of tamperedBaseline.forecast) {
  row.baseline_cash_flow_minor += 1;
  row.projected_cash_flow_minor += 1;
  row.uncertainty_lower_minor += 1;
  row.uncertainty_upper_minor += 1;
}
assert.throws(() => RISK.evaluateLiquidityRisk(assessment(tamperedBaseline)), (error) => error.code === 'RISK_PROJECTION_FIXED_ORIGIN_INVALID');

const tamperedProvenance = JSON.parse(JSON.stringify(positiveProjection));
tamperedProvenance.provenance.financial_truth = true;
assert.throws(() => RISK.evaluateLiquidityRisk(assessment(tamperedProvenance)), (error) => error.code === 'RISK_PROJECTION_PROVENANCE_INVALID');

const brokenSequence = JSON.parse(JSON.stringify(positiveProjection));
brokenSequence.forecast[1].month = '2027-01-01';
assert.throws(() => RISK.evaluateLiquidityRisk(assessment(brokenSequence)), (error) => error.code === 'RISK_PROJECTION_MONTH_SEQUENCE_INVALID');

assert.throws(() => RISK.ratioBasisPoints(-1, 100), (error) => error.code === 'RISK_RATIO_INPUT_INVALID');
assert.throws(() => RISK.ratioBasisPoints(100, 0), (error) => error.code === 'RISK_RATIO_INPUT_INVALID');

const telemetry = RISK.riskTelemetry(stable);
assert.deepStrictEqual(Object.keys(telemetry).sort(), RISK.CONTRACT.telemetry_allowlist.slice().sort());
assert.strictEqual(telemetry.status, 'READY');
assert.strictEqual(telemetry.liquid_position_count, 2);
assert.strictEqual(telemetry.projection_month_count, 3);
assert.strictEqual(telemetry.essential_outflow_present, true);
assert.strictEqual(telemetry.emergency_runway_state, 'OK');
assert.strictEqual(telemetry.scenario_risk_state, 'STABLE');
assert.strictEqual(telemetry.shortfall_detected, false);
assert.strictEqual(telemetry.reconciliation_review_required, false);
const reviewTelemetry = RISK.riskTelemetry(reviewRequired);
assert.strictEqual(reviewTelemetry.reconciliation_review_required, true);
assert.strictEqual(reviewTelemetry.status, 'REVIEW_REQUIRED');
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['current_liquidity_minor', 'projected_cash_flow_minor', 'months_basis_points', 'RUB', 'liquid-cash', 'net_worth_id', 'projection_sha256']) {
  assert.strictEqual(telemetryText.includes(forbidden), false, `RISK telemetry leaked ${forbidden}`);
}

console.log('liquidity_financial_risk_contract_test: PASS', {
  schema: RISK.CONTRACT.schema,
  version: RISK.CONTRACT.version,
  stableRunwayMonthsBp: stable.emergency_runway.months_basis_points,
  stableState: stable.scenario_risk.state,
  shortfallState: shortfall.scenario_risk.state,
  missingSelection: missingSelection.status,
  missingBurn: partial.status,
  currencyBinding: RISK.CONTRACT.currency_policy.projection_currency_binding,
  financialTruth: stable.provenance.financial_truth,
  financialWrite: RISK.CONTRACT.authorities.financial_write,
  freeOnly: RISK.CONTRACT.free_only
});
