'use strict';

const crypto = require('crypto');
const CONTRACT = require('./liquidity_financial_risk.v1.json');
const NW = require('../networth/net_worth');
const PROJ = require('../planning/cash_flow_projection');

const SCHEMA = CONTRACT.schema;
const VERSION = CONTRACT.version;
const INPUT_SCHEMA = CONTRACT.schemas.assessment_input;
const RESULT_SCHEMA = CONTRACT.schemas.result;
const EVIDENCE_SCHEMA = CONTRACT.schemas.evidence;
const TELEMETRY_SCHEMA = CONTRACT.schemas.telemetry;
const CURRENCY_RE = /^[A-Z]{3}$/;
const MONTH_RE = /^\d{4}-\d{2}-01$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

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
  const keys = Object.keys(value);
  if (keys.length !== allowed.length || keys.some((key) => !allowed.includes(key))) fail(reason);
}

function safeInteger(value, reason) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) fail(reason);
  return number;
}

function safeAdd(a, b, reason = 'RISK_SAFE_INTEGER_OVERFLOW') {
  const result = a + b;
  if (!Number.isSafeInteger(result)) fail(reason);
  return result;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function currency(value) {
  const text = String(value || '').trim();
  if (!CURRENCY_RE.test(text)) fail('RISK_CURRENCY_INVALID');
  return text;
}

function opaqueId(value, reason) {
  const text = String(value == null ? '' : value).trim();
  if (!ID_RE.test(text)) fail(reason);
  return text;
}

function assertContract() {
  if (SCHEMA !== 'PRH_LIQUIDITY_FINANCIAL_RISK_V1' || VERSION !== '1.0.0' || CONTRACT.roadmap_id !== 'RISK-030') {
    fail('RISK_CONTRACT_VERSION_INVALID');
  }
  if (CONTRACT.dependencies.net_worth !== 'PRH_NET_WORTH_V1@1.0.0' ||
      CONTRACT.dependencies.cash_flow_projection !== 'PRH_CASH_FLOW_PROJECTION_V1@1.0.0') {
    fail('RISK_UPSTREAM_CONTRACT_INVALID');
  }
  if (CONTRACT.currency_policy.fx_conversion !== false ||
      CONTRACT.currency_policy.projection_result_embeds_currency !== false ||
      CONTRACT.currency_policy.projection_currency_binding !== 'EXPLICIT_CALLER_CONTEXT_REQUIRED') {
    fail('RISK_CURRENCY_BOUNDARY_INVALID');
  }
  if (CONTRACT.liquidity_policy.cash_flow_as_current_balance_proxy !== false) fail('RISK_LIQUIDITY_PROXY_BOUNDARY_INVALID');
  if (CONTRACT.period_policy.net_worth_snapshot_not_after_first_forecast_month !== true ||
      CONTRACT.period_policy.max_snapshot_age_days_before_first_forecast_month !== 31 ||
      CONTRACT.period_policy.incompatible_period !== 'FAIL_CLOSED') fail('RISK_PERIOD_POLICY_INVALID');
  if (CONTRACT.emergency_runway.basis_points_per_month !== 10000 ||
      CONTRACT.emergency_runway.critical_below_months_basis_points >= CONTRACT.emergency_runway.warning_below_months_basis_points) {
    fail('RISK_RUNWAY_POLICY_INVALID');
  }
  if (Object.values(CONTRACT.authorities || {}).some((value) => value !== false) || CONTRACT.free_only !== true) {
    fail('RISK_AUTHORITY_INVALID');
  }
  return true;
}

function validateNetWorthResult(input) {
  if (!input || input.schema !== NW.RESULT_SCHEMA || input.version !== NW.VERSION || !input.snapshot) fail('RISK_NET_WORTH_RESULT_INVALID');
  const recomputed = NW.evaluateNetWorth(input.snapshot);
  if (NW.stableStringify(recomputed) !== NW.stableStringify(input)) fail('RISK_NET_WORTH_RESULT_INTEGRITY_INVALID');
  return input;
}

function normalizeProjectionResult(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('RISK_PROJECTION_RESULT_INVALID');
  exactKeys(input, ['schema', 'version', 'model_id', 'model_kind', 'observed_complete_months', 'observed_range', 'scenario', 'backtest', 'uncertainty', 'forecast', 'provenance'], 'RISK_PROJECTION_RESULT_SHAPE_INVALID');
  if (input.schema !== PROJ.RESULT_SCHEMA || input.version !== PROJ.VERSION) fail('RISK_PROJECTION_RESULT_INVALID');
  if (input.model_id !== PROJ.CONTRACT.baseline.model_id || input.model_kind !== PROJ.CONTRACT.baseline.model_kind) fail('RISK_PROJECTION_MODEL_INVALID');
  const scenario = PROJ.normalizeScenario(input.scenario);
  if (!input.uncertainty || input.uncertainty.method !== PROJ.CONTRACT.uncertainty.method || input.uncertainty.statistical_confidence_interval !== false) {
    fail('RISK_PROJECTION_UNCERTAINTY_INVALID');
  }
  const halfWidth = safeInteger(input.uncertainty.half_width_minor, 'RISK_PROJECTION_UNCERTAINTY_INVALID');
  if (halfWidth < 0) fail('RISK_PROJECTION_UNCERTAINTY_INVALID');
  const observedCompleteMonths = safeInteger(input.observed_complete_months, 'RISK_PROJECTION_HISTORY_INVALID');
  if (observedCompleteMonths < PROJ.CONTRACT.observed_input.minimum_complete_months) fail('RISK_PROJECTION_HISTORY_INVALID');
  exactKeys(input.observed_range, ['start', 'end'], 'RISK_PROJECTION_RANGE_INVALID');
  if (!MONTH_RE.test(String(input.observed_range.start || '')) || !MONTH_RE.test(String(input.observed_range.end || '')) ||
      input.observed_range.end !== PROJ.addMonths(input.observed_range.start, observedCompleteMonths)) {
    fail('RISK_PROJECTION_RANGE_INVALID');
  }
  exactKeys(input.backtest, ['mode', 'window_months', 'sample_count', 'mean_absolute_error_minor', 'mean_error_minor', 'points'], 'RISK_PROJECTION_BACKTEST_INVALID');
  const window = PROJ.CONTRACT.backtest.window_months;
  const expectedSamples = observedCompleteMonths - window;
  const sampleCount = safeInteger(input.backtest.sample_count, 'RISK_PROJECTION_BACKTEST_INVALID');
  if (input.backtest.mode !== PROJ.CONTRACT.backtest.mode || input.backtest.window_months !== window ||
      sampleCount !== expectedSamples || sampleCount < PROJ.CONTRACT.backtest.minimum_samples || !Array.isArray(input.backtest.points) || input.backtest.points.length !== sampleCount) {
    fail('RISK_PROJECTION_BACKTEST_INVALID');
  }
  let absoluteErrorSum = 0;
  let errorSum = 0;
  const backtestPoints = input.backtest.points.map((point, index) => {
    exactKeys(point, ['month', 'prediction_minor', 'actual_minor', 'error_minor'], 'RISK_PROJECTION_BACKTEST_POINT_INVALID');
    if (point.month !== PROJ.addMonths(input.observed_range.start, window + index)) fail('RISK_PROJECTION_BACKTEST_SEQUENCE_INVALID');
    const prediction = safeInteger(point.prediction_minor, 'RISK_PROJECTION_BACKTEST_VALUE_INVALID');
    const actual = safeInteger(point.actual_minor, 'RISK_PROJECTION_BACKTEST_VALUE_INVALID');
    const error = safeInteger(point.error_minor, 'RISK_PROJECTION_BACKTEST_VALUE_INVALID');
    if (error !== safeAdd(actual, -prediction)) fail('RISK_PROJECTION_BACKTEST_ARITHMETIC_INVALID');
    absoluteErrorSum = safeAdd(absoluteErrorSum, Math.abs(error));
    errorSum = safeAdd(errorSum, error);
    if (index >= window) {
      const expectedPrediction = PROJ.meanMinor(input.backtest.points.slice(index - window, index).map((prior) => safeInteger(prior.actual_minor, 'RISK_PROJECTION_BACKTEST_VALUE_INVALID')));
      if (prediction !== expectedPrediction) fail('RISK_PROJECTION_BACKTEST_ROLLING_WINDOW_INVALID');
    }
    return deepFreeze({ month: point.month, prediction_minor: prediction, actual_minor: actual, error_minor: error });
  });
  const meanAbsoluteError = PROJ.roundDivideHalfAwayFromZero(absoluteErrorSum, sampleCount);
  const meanError = PROJ.roundDivideHalfAwayFromZero(errorSum, sampleCount);
  if (safeInteger(input.backtest.mean_absolute_error_minor, 'RISK_PROJECTION_BACKTEST_INVALID') !== meanAbsoluteError ||
      safeInteger(input.backtest.mean_error_minor, 'RISK_PROJECTION_BACKTEST_INVALID') !== meanError || halfWidth !== meanAbsoluteError) {
    fail('RISK_PROJECTION_BACKTEST_METRICS_INVALID');
  }
  if (!Array.isArray(input.forecast) || input.forecast.length !== scenario.horizon_months) fail('RISK_PROJECTION_FORECAST_INVALID');
  const oneOffs = new Map(scenario.one_off_adjustments.map((item) => [item.month, item.delta_minor]));
  let baseline = null;
  const forecast = input.forecast.map((row, index) => {
    exactKeys(row, ['month', 'baseline_cash_flow_minor', 'scenario_adjustment_minor', 'projected_cash_flow_minor', 'uncertainty_lower_minor', 'uncertainty_upper_minor'], 'RISK_PROJECTION_ROW_SHAPE_INVALID');
    const month = String(row.month || '');
    if (month !== PROJ.addMonths(input.observed_range.end, index)) fail('RISK_PROJECTION_MONTH_SEQUENCE_INVALID');
    const baselineMinor = safeInteger(row.baseline_cash_flow_minor, 'RISK_PROJECTION_VALUE_INVALID');
    const scenarioAdjustment = safeInteger(row.scenario_adjustment_minor, 'RISK_PROJECTION_VALUE_INVALID');
    const projected = safeInteger(row.projected_cash_flow_minor, 'RISK_PROJECTION_VALUE_INVALID');
    const lower = safeInteger(row.uncertainty_lower_minor, 'RISK_PROJECTION_VALUE_INVALID');
    const upper = safeInteger(row.uncertainty_upper_minor, 'RISK_PROJECTION_VALUE_INVALID');
    if (baseline == null) {
      baseline = baselineMinor;
      const originActuals = backtestPoints.slice(-window).map((point) => point.actual_minor);
      if (originActuals.length !== window || baseline !== PROJ.meanMinor(originActuals)) fail('RISK_PROJECTION_FIXED_ORIGIN_INVALID');
    }
    if (baselineMinor !== baseline) fail('RISK_PROJECTION_FIXED_ORIGIN_INVALID');
    const expectedAdjustment = safeAdd(scenario.monthly_adjustment_minor, oneOffs.get(month) || 0);
    if (scenarioAdjustment !== expectedAdjustment || projected !== safeAdd(baselineMinor, scenarioAdjustment)) fail('RISK_PROJECTION_ARITHMETIC_INVALID');
    if (lower !== safeAdd(projected, -halfWidth) || upper !== safeAdd(projected, halfWidth)) fail('RISK_PROJECTION_UNCERTAINTY_ARITHMETIC_INVALID');
    return deepFreeze({
      month,
      baseline_cash_flow_minor: baselineMinor,
      scenario_adjustment_minor: scenarioAdjustment,
      projected_cash_flow_minor: projected,
      uncertainty_lower_minor: lower,
      uncertainty_upper_minor: upper
    });
  });
  const provenance = input.provenance || {};
  exactKeys(provenance, ['projection_contract', 'trend_contract', 'period_engine', 'analytics_contract', 'kpi_dictionary', 'financial_truth_policy', 'financial_truth', 'projection_not_observation', 'future_fact_access', 'scenario_separate_from_observed', 'canonical_mutation'], 'RISK_PROJECTION_PROVENANCE_INVALID');
  if (provenance.projection_contract !== `${PROJ.SCHEMA}@${PROJ.VERSION}` ||
      provenance.trend_contract !== PROJ.CONTRACT.upstream.trend || provenance.period_engine !== PROJ.CONTRACT.upstream.period_engine ||
      provenance.analytics_contract !== PROJ.CONTRACT.upstream.analytics_contract || provenance.kpi_dictionary !== PROJ.CONTRACT.upstream.kpi_dictionary ||
      provenance.financial_truth_policy !== PROJ.CONTRACT.upstream.financial_truth_policy || provenance.financial_truth !== false ||
      provenance.projection_not_observation !== true || provenance.future_fact_access !== false ||
      provenance.scenario_separate_from_observed !== true || provenance.canonical_mutation !== false) {
    fail('RISK_PROJECTION_PROVENANCE_INVALID');
  }
  return deepFreeze({
    source: input,
    scenario,
    forecast: deepFreeze(forecast),
    observed_complete_months: observedCompleteMonths,
    observed_range: deepFreeze({ start: input.observed_range.start, end: input.observed_range.end }),
    half_width_minor: halfWidth
  });
}

function normalizeEssentialOutflow(input) {
  exactKeys(input, ['amount_minor', 'provenance'], 'RISK_ESSENTIAL_OUTFLOW_SHAPE_INVALID');
  if (input.amount_minor == null) {
    if (input.provenance != null) fail('RISK_ESSENTIAL_OUTFLOW_PROVENANCE_WITHOUT_AMOUNT');
    return deepFreeze({ amount_minor: null, provenance: null });
  }
  const amount = safeInteger(input.amount_minor, 'RISK_ESSENTIAL_OUTFLOW_INVALID');
  if (amount <= 0) fail('RISK_ESSENTIAL_OUTFLOW_INVALID');
  exactKeys(input.provenance, ['source_kind', 'source_record_id', 'source_fingerprint'], 'RISK_ESSENTIAL_OUTFLOW_PROVENANCE_INVALID');
  const sourceKind = String(input.provenance.source_kind || '');
  if (!CONTRACT.essential_outflow_policy.source_kinds.includes(sourceKind)) fail('RISK_ESSENTIAL_OUTFLOW_SOURCE_INVALID');
  const sourceRecordId = String(input.provenance.source_record_id == null ? '' : input.provenance.source_record_id).trim();
  if (sourceRecordId.length < 3 || sourceRecordId.length > 192) fail('RISK_ESSENTIAL_OUTFLOW_SOURCE_RECORD_ID_INVALID');
  const fingerprint = String(input.provenance.source_fingerprint || '');
  if (!SHA256_RE.test(fingerprint)) fail('RISK_ESSENTIAL_OUTFLOW_FINGERPRINT_INVALID');
  return deepFreeze({ amount_minor: amount, provenance: deepFreeze({ source_kind: sourceKind, source_record_id: sourceRecordId, source_fingerprint: fingerprint }) });
}

function normalizeLiquidSelection(input, netWorthResult) {
  if (input == null) return null;
  if (!Array.isArray(input)) fail('RISK_LIQUID_SELECTION_INVALID');
  const ids = input.map((value) => opaqueId(value, 'RISK_LIQUID_POSITION_ID_INVALID')).sort();
  if (new Set(ids).size !== ids.length) fail('RISK_LIQUID_POSITION_DUPLICATE');
  const byId = new Map(netWorthResult.snapshot.positions.map((position) => [position.position_id, position]));
  let currentLiquidity = 0;
  for (const id of ids) {
    const position = byId.get(id);
    if (!position) fail('RISK_LIQUID_POSITION_NOT_FOUND');
    if (!CONTRACT.liquidity_policy.allowed_position_types.includes(position.type) || position.value_minor <= 0) fail('RISK_LIQUID_POSITION_NOT_ELIGIBLE');
    currentLiquidity = safeAdd(currentLiquidity, position.value_minor);
  }
  return deepFreeze({ ids: deepFreeze(ids), current_liquidity_minor: currentLiquidity });
}

function periodDistanceDays(valuationDate, firstForecastMonth) {
  const valuation = new Date(`${valuationDate}T00:00:00Z`);
  const forecast = new Date(`${firstForecastMonth}T00:00:00Z`);
  if (!Number.isFinite(valuation.getTime()) || !Number.isFinite(forecast.getTime())) fail('RISK_PERIOD_CONTEXT_INVALID');
  return Math.floor((forecast.getTime() - valuation.getTime()) / 86400000);
}

function normalizeAssessmentInput(input) {
  assertContract();
  exactKeys(input, ['schema', 'version', 'currency', 'projection_currency', 'net_worth_result', 'projection_result', 'liquid_position_ids', 'essential_monthly_outflow'], 'RISK_INPUT_SHAPE_INVALID');
  if (input.schema !== INPUT_SCHEMA || input.version !== VERSION) fail('RISK_INPUT_VERSION_INVALID');
  const assessmentCurrency = currency(input.currency);
  const projectionCurrency = currency(input.projection_currency);
  if (assessmentCurrency !== projectionCurrency) fail('RISK_PROJECTION_CURRENCY_MISMATCH');
  const netWorthResult = validateNetWorthResult(input.net_worth_result);
  if (netWorthResult.snapshot.currency !== assessmentCurrency) fail('RISK_NET_WORTH_CURRENCY_MISMATCH');
  const projection = normalizeProjectionResult(input.projection_result);
  const snapshotAgeDays = periodDistanceDays(netWorthResult.snapshot.valuation_date, projection.forecast[0].month);
  if (snapshotAgeDays < 0 || snapshotAgeDays > CONTRACT.period_policy.max_snapshot_age_days_before_first_forecast_month) {
    fail('RISK_PERIOD_CONTEXT_MISMATCH');
  }
  const selection = normalizeLiquidSelection(input.liquid_position_ids, netWorthResult);
  const essential = normalizeEssentialOutflow(input.essential_monthly_outflow);
  return deepFreeze({
    schema: INPUT_SCHEMA,
    version: VERSION,
    currency: assessmentCurrency,
    projection_currency: projectionCurrency,
    net_worth_result: netWorthResult,
    projection_result: projection.source,
    projection,
    liquid_selection: selection,
    essential_monthly_outflow: essential,
    snapshot_age_days_before_forecast: snapshotAgeDays
  });
}

function ratioBasisPoints(numerator, denominator) {
  const n = safeInteger(numerator, 'RISK_RATIO_NUMERATOR_INVALID');
  const d = safeInteger(denominator, 'RISK_RATIO_DENOMINATOR_INVALID');
  if (n < 0 || d <= 0) fail('RISK_RATIO_INPUT_INVALID');
  const value = (BigInt(n) * BigInt(CONTRACT.emergency_runway.basis_points_per_month)) / BigInt(d);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail('RISK_RATIO_OVERFLOW');
  return Number(value);
}

function runwayState(monthsBasisPoints) {
  if (monthsBasisPoints == null) return 'INSUFFICIENT_DATA';
  if (monthsBasisPoints < CONTRACT.emergency_runway.critical_below_months_basis_points) return 'CRITICAL';
  if (monthsBasisPoints < CONTRACT.emergency_runway.warning_below_months_basis_points) return 'WARNING';
  return 'OK';
}

function scenarioState(shortfallDetected, minimumLiquidity, essentialAmount) {
  if (shortfallDetected) return 'SHORTFALL';
  if (essentialAmount == null) return 'BURN_RATE_REQUIRED';
  const buffer = ratioBasisPoints(minimumLiquidity, essentialAmount);
  if (buffer < CONTRACT.emergency_runway.critical_below_months_basis_points) return 'BUFFER_CRITICAL';
  if (buffer < CONTRACT.emergency_runway.warning_below_months_basis_points) return 'BUFFER_WARNING';
  return 'STABLE';
}

function evaluateLiquidityRisk(input) {
  const normalized = normalizeAssessmentInput(input);
  const projectionHash = sha256(PROJ.stableStringify(normalized.projection_result));
  const netWorthId = normalized.net_worth_result.net_worth_id;

  if (normalized.liquid_selection == null) {
    const result = {
      schema: RESULT_SCHEMA,
      version: VERSION,
      assessment_id: `risk-${sha256(stableStringify({ currency: normalized.currency, net_worth_id: netWorthId, projection_hash: projectionHash, liquid_selection: null })).slice(0, 48)}`,
      status: 'INSUFFICIENT_DATA',
      reason_code: 'LIQUIDITY_SELECTION_REQUIRED',
      currency: normalized.currency,
      liquidity: null,
      emergency_runway: deepFreeze({ formula_id: CONTRACT.emergency_runway.formula_id, months_basis_points: null, state: 'INSUFFICIENT_DATA', threshold_policy: CONTRACT.emergency_runway.threshold_policy }),
      scenario_risk: deepFreeze({ formula_id: CONTRACT.scenario_liquidity.formula_id, state: 'LIQUIDITY_SELECTION_REQUIRED', first_shortfall_month: null, minimum_buffer_months_basis_points: null }),
      evidence: null,
      provenance: deepFreeze({
        net_worth_contract: CONTRACT.dependencies.net_worth,
        cash_flow_projection_contract: CONTRACT.dependencies.cash_flow_projection,
        financial_truth_policy: CONTRACT.dependencies.financial_truth_policy,
        financial_truth: false,
        projection_currency_binding: CONTRACT.currency_policy.projection_currency_binding,
        cash_flow_as_current_balance_proxy: false,
        essential_outflow_financial_truth: false,
        fx_conversion_used: false,
        canonical_mutation: false,
        financial_write: false,
        reconciliation_review_required: false
      })
    };
    result.evidence = riskEvidenceDescriptor(result, { net_worth_id: netWorthId, projection_hash: projectionHash, liquid_selection_hash: null });
    return deepFreeze(result);
  }

  const currentLiquidity = normalized.liquid_selection.current_liquidity_minor;
  const positionsById = new Map(normalized.net_worth_result.snapshot.positions.map((position) => [position.position_id, position]));
  const reconciliationReviewRequired = normalized.liquid_selection.ids.some((id) => {
    const position = positionsById.get(id);
    return position.type === 'ACCOUNT' && position.provenance.reconciliation_state === 'MISMATCH';
  });
  let runningLiquidity = currentLiquidity;
  let minimumLiquidity = currentLiquidity;
  let cumulativeProjected = 0;
  let firstShortfallMonth = null;
  let negativeCashFlowMonthCount = 0;
  const path = [];
  for (const row of normalized.projection.forecast) {
    cumulativeProjected = safeAdd(cumulativeProjected, row.projected_cash_flow_minor);
    runningLiquidity = safeAdd(runningLiquidity, row.projected_cash_flow_minor);
    minimumLiquidity = Math.min(minimumLiquidity, runningLiquidity);
    if (row.projected_cash_flow_minor < 0) negativeCashFlowMonthCount += 1;
    if (runningLiquidity < 0 && firstShortfallMonth == null) firstShortfallMonth = row.month;
    path.push(deepFreeze({ month: row.month, projected_liquidity_minor: runningLiquidity }));
  }

  const essentialAmount = normalized.essential_monthly_outflow.amount_minor;
  const runway = essentialAmount == null ? null : ratioBasisPoints(currentLiquidity, essentialAmount);
  const emergencyState = runwayState(runway);
  const shortfallDetected = firstShortfallMonth != null;
  const minBuffer = essentialAmount == null || minimumLiquidity < 0 ? null : ratioBasisPoints(minimumLiquidity, essentialAmount);
  const riskState = scenarioState(shortfallDetected, Math.max(minimumLiquidity, 0), essentialAmount);
  const status = reconciliationReviewRequired ? 'REVIEW_REQUIRED' : (essentialAmount == null ? 'PARTIAL' : 'READY');
  const reasonCode = reconciliationReviewRequired ? 'NET_WORTH_RECONCILIATION_REVIEW_REQUIRED' : (essentialAmount == null ? 'ESSENTIAL_OUTFLOW_REQUIRED_FOR_RUNWAY' : 'OK');
  const liquidSelectionHash = sha256(stableStringify(normalized.liquid_selection.ids));
  const assessmentId = `risk-${sha256(stableStringify({
    currency: normalized.currency,
    net_worth_id: netWorthId,
    projection_hash: projectionHash,
    liquid_selection_hash: liquidSelectionHash,
    essential_amount_minor: essentialAmount,
    essential_provenance: normalized.essential_monthly_outflow.provenance
  })).slice(0, 48)}`;

  const result = {
    schema: RESULT_SCHEMA,
    version: VERSION,
    assessment_id: assessmentId,
    status,
    reason_code: reasonCode,
    currency: normalized.currency,
    liquidity: deepFreeze({
      selected_position_count: normalized.liquid_selection.ids.length,
      current_liquidity_minor: currentLiquidity,
      cumulative_projected_cash_flow_minor: cumulativeProjected,
      projected_end_liquidity_minor: runningLiquidity,
      minimum_projected_liquidity_minor: minimumLiquidity,
      negative_cash_flow_month_count: negativeCashFlowMonthCount,
      first_shortfall_month: firstShortfallMonth,
      path: deepFreeze(path)
    }),
    emergency_runway: deepFreeze({
      formula_id: CONTRACT.emergency_runway.formula_id,
      months_basis_points: runway,
      state: emergencyState,
      threshold_policy: CONTRACT.emergency_runway.threshold_policy
    }),
    scenario_risk: deepFreeze({
      formula_id: CONTRACT.scenario_liquidity.formula_id,
      state: riskState,
      first_shortfall_month: firstShortfallMonth,
      minimum_buffer_months_basis_points: minBuffer
    }),
    evidence: null,
    provenance: deepFreeze({
      net_worth_contract: CONTRACT.dependencies.net_worth,
      cash_flow_projection_contract: CONTRACT.dependencies.cash_flow_projection,
      financial_truth_policy: CONTRACT.dependencies.financial_truth_policy,
      financial_truth: false,
      projection_currency_binding: CONTRACT.currency_policy.projection_currency_binding,
      essential_outflow_financial_truth: false,
      cash_flow_as_current_balance_proxy: false,
      fx_conversion_used: false,
      canonical_mutation: false,
      financial_write: false,
      reconciliation_review_required: reconciliationReviewRequired
    })
  };
  result.evidence = riskEvidenceDescriptor(result, { net_worth_id: netWorthId, projection_hash: projectionHash, liquid_selection_hash: liquidSelectionHash });
  return deepFreeze(result);
}

function riskEvidenceDescriptor(result, identities) {
  if (!result || result.schema !== RESULT_SCHEMA || result.version !== VERSION) fail('RISK_RESULT_INVALID');
  if (!identities || typeof identities !== 'object') fail('RISK_EVIDENCE_IDENTITIES_INVALID');
  const netWorthId = opaqueId(identities.net_worth_id, 'RISK_EVIDENCE_NET_WORTH_ID_INVALID');
  const projectionHash = String(identities.projection_hash || '');
  if (!SHA256_RE.test(projectionHash)) fail('RISK_EVIDENCE_PROJECTION_HASH_INVALID');
  const selectionHash = identities.liquid_selection_hash == null ? null : String(identities.liquid_selection_hash);
  if (selectionHash != null && !SHA256_RE.test(selectionHash)) fail('RISK_EVIDENCE_SELECTION_HASH_INVALID');
  return deepFreeze({
    schema: EVIDENCE_SCHEMA,
    version: VERSION,
    assessment_id: result.assessment_id,
    net_worth_id: netWorthId,
    projection_sha256: projectionHash,
    liquid_selection_sha256: selectionHash,
    read_only: true,
    mutation_authority: false,
    financial_payload_embedded: false
  });
}

function riskTelemetry(result) {
  if (!result || result.schema !== RESULT_SCHEMA || result.version !== VERSION) fail('RISK_RESULT_INVALID');
  const output = {
    schema: TELEMETRY_SCHEMA,
    version: VERSION,
    status: result.status,
    reason_code: result.reason_code,
    liquid_position_count: result.liquidity ? result.liquidity.selected_position_count : 0,
    projection_month_count: result.liquidity ? result.liquidity.path.length : 0,
    essential_outflow_present: result.emergency_runway.months_basis_points != null,
    emergency_runway_state: result.emergency_runway.state,
    scenario_risk_state: result.scenario_risk.state,
    shortfall_detected: result.scenario_risk.first_shortfall_month != null,
    reconciliation_review_required: result.provenance.reconciliation_review_required === true
  };
  const extra = Object.keys(output).filter((key) => !CONTRACT.telemetry_allowlist.includes(key));
  if (extra.length) fail('RISK_TELEMETRY_FIELD_FORBIDDEN', extra.join(','));
  return deepFreeze(output);
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  INPUT_SCHEMA,
  RESULT_SCHEMA,
  EVIDENCE_SCHEMA,
  TELEMETRY_SCHEMA,
  assertContract,
  stableStringify,
  normalizeProjectionResult,
  normalizeAssessmentInput,
  ratioBasisPoints,
  evaluateLiquidityRisk,
  riskEvidenceDescriptor,
  riskTelemetry
});
