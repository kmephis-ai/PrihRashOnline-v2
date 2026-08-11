'use strict';

const crypto = require('crypto');
const CONTRACT = require('./subscription_detection.v1.json');
const { validateCanonicalCollection } = require('../domain/canonical_transaction');
const obligations = require('../obligations/obligations');

const CONTRACT_SCHEMA = 'PRH_SUBSCRIPTION_DETECTION_V1';
const VERSION = '1.0.0';
const SIGNATURE_SCHEMA = 'PRH_SUBSCRIPTION_SIGNATURE_V1';
const RESULT_SCHEMA = 'PRH_SUBSCRIPTION_DETECTION_RESULT_V1';
const FINDING_SCHEMA = 'PRH_SUBSCRIPTION_FINDING_V1';
const LINK_SCHEMA = 'PRH_SUBSCRIPTION_OBLIGATION_LINK_V1';
const CADENCES = Object.freeze(['WEEKLY', 'MONTHLY']);
const FINDING_STATUSES = Object.freeze(['CANDIDATE', 'REVIEW', 'ALREADY_TRACKED']);

function fail(reason) { const error = new Error(reason); error.code = reason; throw error; }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => (out[key] = stable(value[key]), out), {});
  return value;
}
function sha256(value) { return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex'); }
function isoDay(value) { return String(value || '').slice(0, 10); }
function toDate(day) { const date = new Date(`${day}T00:00:00Z`); if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) fail('SUB_DATE_INVALID'); return date; }
function dayNumber(day) { return Math.floor(toDate(day).getTime() / 86400000); }
function daysBetween(a, b) { return dayNumber(b) - dayNumber(a); }
function monthIndex(day) { const d = toDate(day); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }
function monthDay(day) { return toDate(day).getUTCDate(); }
function daysInMonth(day) { const d = toDate(day); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); }

function assertContract() {
  if (CONTRACT.schema !== CONTRACT_SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'SUB-030') fail('SUB_CONTRACT_VERSION_INVALID');
  if (CONTRACT.upstream.canonical_transaction !== 'PRH_CANONICAL_TRANSACTION_V1' || CONTRACT.upstream.obligations !== `${obligations.CONTRACT_SCHEMA}@${obligations.VERSION}`) fail('SUB_UPSTREAM_CONTRACT_INVALID');
  if (CONTRACT.eligibility.type !== 'expense' || CONTRACT.eligibility.status !== 'posted') fail('SUB_ELIGIBILITY_POLICY_INVALID');
  if (CONTRACT.signature.schema !== SIGNATURE_SCHEMA || CONTRACT.signature.fuzzy_matching !== false) fail('SUB_SIGNATURE_POLICY_INVALID');
  if (CONTRACT.history.minimum_candidate_occurrences !== 3 || CONTRACT.history.max_group_occurrences !== 24 || CONTRACT.history.max_span_days !== 730) fail('SUB_HISTORY_POLICY_INVALID');
  if (JSON.stringify(CONTRACT.cadence.supported) !== JSON.stringify(CADENCES) || CONTRACT.cadence.all_intervals_must_match !== true) fail('SUB_CADENCE_POLICY_INVALID');
  if (CONTRACT.amount_stability.reference !== 'LOWER_MEDIAN_MINOR' || CONTRACT.amount_stability.financial_truth !== false) fail('SUB_AMOUNT_POLICY_INVALID');
  if (CONTRACT.review.auto_confirm !== false || CONTRACT.review.auto_create_obligation !== false || CONTRACT.review.canonical_mutation !== false || CONTRACT.review.financial_write !== false) fail('SUB_REVIEW_POLICY_INVALID');
  if (CONTRACT.obligation_comparison.mode !== 'EXPLICIT_SIGNATURE_HASH_TO_PLAN_ID_LINK_ONLY' || CONTRACT.obligation_comparison.fuzzy_plan_label_matching !== false || CONTRACT.obligation_comparison.mutation !== false) fail('SUB_OBLIGATION_POLICY_INVALID');
  if (CONTRACT.cost.class !== 'FREE_ONLY' || CONTRACT.cost.paid_dependency_required !== false || CONTRACT.cost.external_provider_required !== false) fail('SUB_COST_POLICY_INVALID');
  if (Object.values(CONTRACT.authority).some(Boolean)) fail('SUB_AUTHORITY_INVALID');
  return true;
}

function normalizeLabel(value) {
  const text = String(value == null ? '' : value).normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!text) return null;
  return Object.freeze({ display: text, normalized: text.toLowerCase() });
}

function subscriptionLabel(tx) {
  for (const field of CONTRACT.eligibility.label_source_priority) {
    const label = normalizeLabel(tx[field]);
    if (label) return Object.freeze({ field, ...label });
  }
  return null;
}

function signaturePayload(tx) {
  const label = subscriptionLabel(tx);
  if (!label) return null;
  return Object.freeze({
    schema: SIGNATURE_SCHEMA,
    normalized_label: label.normalized,
    currency: tx.currency,
    account_id: tx.account_id,
    category_id: tx.category_id
  });
}

function signatureHash(payload) {
  if (!payload || payload.schema !== SIGNATURE_SCHEMA) fail('SUB_SIGNATURE_INVALID');
  return sha256(`${SIGNATURE_SCHEMA}|${JSON.stringify(stable({
    normalized_label: payload.normalized_label,
    currency: payload.currency,
    account_id: payload.account_id,
    category_id: payload.category_id
  }))}`);
}

function eligibleOccurrence(tx) {
  if (tx.type !== CONTRACT.eligibility.type || tx.status !== CONTRACT.eligibility.status) return null;
  const signature = signaturePayload(tx);
  if (!signature) return null;
  return Object.freeze({
    transaction_id: tx.transaction_id,
    occurred_at: tx.occurred_at,
    day: isoDay(tx.occurred_at),
    amount_minor: tx.amount_minor,
    signature,
    signature_hash: signatureHash(signature),
    display_label: subscriptionLabel(tx).display
  });
}

function lowerMedian(values) {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => !Number.isSafeInteger(value) || value < 0)) fail('SUB_AMOUNT_SERIES_INVALID');
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

function amountEvidence(occurrences) {
  const amounts = occurrences.map((item) => item.amount_minor);
  const reference = lowerMedian(amounts);
  const relative = Math.floor(reference * CONTRACT.amount_stability.relative_tolerance_basis_points / 10000);
  const tolerance = Math.max(CONTRACT.amount_stability.absolute_tolerance_minor, relative);
  let maxDeviation = 0;
  for (const amount of amounts) maxDeviation = Math.max(maxDeviation, Math.abs(amount - reference));
  return Object.freeze({
    reference_minor: reference,
    tolerance_minor: tolerance,
    max_deviation_minor: maxDeviation,
    stable: maxDeviation <= tolerance
  });
}

function weeklyEvidence(days) {
  const expected = CONTRACT.cadence.weekly.expected_days;
  const tolerance = CONTRACT.cadence.weekly.tolerance_days;
  const intervals = [];
  let maxDeviation = 0;
  for (let i = 1; i < days.length; i += 1) {
    const interval = daysBetween(days[i - 1], days[i]);
    intervals.push(interval);
    maxDeviation = Math.max(maxDeviation, Math.abs(interval - expected));
  }
  return Object.freeze({ cadence: 'WEEKLY', matches: intervals.length > 0 && intervals.every((value) => Math.abs(value - expected) <= tolerance), max_deviation_days: maxDeviation, intervals: Object.freeze(intervals) });
}

function monthlyEvidence(days) {
  const tolerance = CONTRACT.cadence.monthly.day_of_month_tolerance;
  const nominalDay = Math.max(...days.map(monthDay));
  const deviations = [];
  let monthStepValid = true;
  for (let i = 1; i < days.length; i += 1) if (monthIndex(days[i]) - monthIndex(days[i - 1]) !== CONTRACT.cadence.monthly.required_month_step) monthStepValid = false;
  for (const day of days) {
    const expectedDay = Math.min(nominalDay, daysInMonth(day));
    deviations.push(Math.abs(monthDay(day) - expectedDay));
  }
  return Object.freeze({ cadence: 'MONTHLY', matches: monthStepValid && deviations.every((value) => value <= tolerance), nominal_day: nominalDay, max_deviation_days: Math.max(...deviations), deviations: Object.freeze(deviations) });
}

function cadenceEvidence(occurrences) {
  const days = occurrences.map((item) => item.day);
  const weekly = weeklyEvidence(days);
  const monthly = monthlyEvidence(days);
  const matches = [weekly, monthly].filter((item) => item.matches);
  return Object.freeze({
    cadence: matches.length === 1 ? matches[0].cadence : null,
    matched_count: matches.length,
    weekly,
    monthly,
    stable: matches.length === 1
  });
}

function normalizePlanLinks(linksInput, plansById) {
  const links = Array.isArray(linksInput) ? linksInput : [];
  const bySignature = new Map();
  for (const raw of links) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some((key) => !['schema', 'version', 'signature_hash', 'plan_id'].includes(key))) fail('SUB_PLAN_LINK_INVALID');
    if (raw.schema !== LINK_SCHEMA || raw.version !== VERSION || !/^[0-9a-f]{64}$/.test(String(raw.signature_hash || ''))) fail('SUB_PLAN_LINK_INVALID');
    const planId = String(raw.plan_id || '');
    if (!plansById.has(planId)) fail('SUB_PLAN_LINK_PLAN_UNKNOWN');
    if (bySignature.has(raw.signature_hash)) fail('SUB_PLAN_LINK_DUPLICATE');
    bySignature.set(raw.signature_hash, planId);
  }
  return bySignature;
}

function cadenceMatchesPlan(cadence, plan) {
  if (cadence === 'WEEKLY') return plan.recurrence.kind === 'WEEKLY' && plan.recurrence.interval_weeks === 1;
  if (cadence === 'MONTHLY') return plan.recurrence.kind === 'MONTHLY' && plan.recurrence.interval_months === 1;
  return false;
}

function analyzeGroup(groupInput, options = {}) {
  if (!Array.isArray(groupInput) || groupInput.length === 0) fail('SUB_GROUP_INVALID');
  const sorted = groupInput.slice().sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.transaction_id.localeCompare(b.transaction_id));
  if (new Set(sorted.map((item) => item.transaction_id)).size !== sorted.length) fail('SUB_GROUP_TRANSACTION_DUPLICATE');
  const signature = sorted[0].signature_hash;
  if (sorted.some((item) => item.signature_hash !== signature)) fail('SUB_GROUP_SIGNATURE_MISMATCH');
  const limited = sorted.length > CONTRACT.history.max_group_occurrences ? sorted.slice(-CONTRACT.history.max_group_occurrences) : sorted;
  const spanDays = limited.length > 1 ? daysBetween(limited[0].day, limited[limited.length - 1].day) : 0;
  if (spanDays > CONTRACT.history.max_span_days) fail('SUB_GROUP_HISTORY_SPAN_EXCEEDED');
  if (limited.length < CONTRACT.history.minimum_candidate_occurrences) {
    return Object.freeze({ status: 'NO_CANDIDATE', reason_codes: Object.freeze(['INSUFFICIENT_OCCURRENCES']), signature_hash: signature, occurrence_count: limited.length });
  }

  const cadence = cadenceEvidence(limited);
  const amount = amountEvidence(limited);
  const reasons = [];
  if (cadence.stable) reasons.push(`CADENCE_${cadence.cadence}_STABLE`); else reasons.push('CADENCE_AMBIGUOUS_OR_IRREGULAR');
  if (amount.stable) reasons.push('AMOUNT_STABLE'); else reasons.push('AMOUNT_UNSTABLE');
  let status = cadence.stable && amount.stable ? 'CANDIDATE' : 'REVIEW';
  let trackedPlanId = null;

  const planLinks = options.plan_links_by_signature || new Map();
  const plansById = options.plans_by_id || new Map();
  if (status === 'CANDIDATE' && planLinks.has(signature)) {
    const planId = planLinks.get(signature);
    const plan = plansById.get(planId);
    if (!plan || plan.direction !== CONTRACT.obligation_comparison.required_plan_direction) fail('SUB_TRACKED_PLAN_DIRECTION_INVALID');
    if (plan.currency !== limited[0].signature.currency) fail('SUB_TRACKED_PLAN_CURRENCY_MISMATCH');
    if (!cadenceMatchesPlan(cadence.cadence, plan)) fail('SUB_TRACKED_PLAN_CADENCE_MISMATCH');
    if (plan.amount_minor !== amount.reference_minor) fail('SUB_TRACKED_PLAN_AMOUNT_MISMATCH');
    status = 'ALREADY_TRACKED';
    trackedPlanId = planId;
    reasons.push('EXPLICIT_OBLIGATION_LINK_MATCH');
  }

  return Object.freeze({
    schema: FINDING_SCHEMA,
    contract_version: VERSION,
    finding_id: sha256(`${FINDING_SCHEMA}|${signature}|${cadence.cadence || 'NONE'}|${limited.map((item) => item.transaction_id).join('|')}`),
    signature_hash: signature,
    status,
    display_label: limited[0].display_label,
    currency: limited[0].signature.currency,
    account_id: limited[0].signature.account_id,
    category_id: limited[0].signature.category_id,
    cadence: cadence.cadence,
    occurrence_count: limited.length,
    first_day: limited[0].day,
    last_day: limited[limited.length - 1].day,
    history_truncated: sorted.length !== limited.length,
    amount_evidence: amount,
    cadence_evidence: cadence,
    reason_codes: Object.freeze(reasons),
    tracked_plan_id: trackedPlanId,
    review_required: status !== 'ALREADY_TRACKED',
    auto_confirmed: false,
    obligation_created: false,
    canonical_mutation: false,
    financial_write: false,
    financial_truth: false
  });
}

function detectSubscriptions(transactionsInput, options = {}) {
  assertContract();
  if (!Array.isArray(transactionsInput) || transactionsInput.length > CONTRACT.history.max_input_transactions) fail('SUB_TRANSACTIONS_INVALID');
  const transactions = validateCanonicalCollection(transactionsInput);
  const groups = new Map();
  for (const tx of transactions) {
    const occurrence = eligibleOccurrence(tx);
    if (!occurrence) continue;
    if (!groups.has(occurrence.signature_hash)) groups.set(occurrence.signature_hash, []);
    groups.get(occurrence.signature_hash).push(occurrence);
  }

  const normalizedPlans = (Array.isArray(options.existing_plans) ? options.existing_plans : []).map(obligations.normalizePlan);
  const plansById = new Map();
  for (const plan of normalizedPlans) {
    if (plansById.has(plan.plan_id)) fail('SUB_EXISTING_PLAN_ID_DUPLICATE');
    plansById.set(plan.plan_id, plan);
  }
  const planLinks = normalizePlanLinks(options.plan_links, plansById);

  const findings = [];
  let rejected = 0;
  const groupHashes = [...groups.keys()].sort();
  for (const hash of groupHashes) {
    const analysis = analyzeGroup(groups.get(hash), { plans_by_id: plansById, plan_links_by_signature: planLinks });
    if (analysis.status === 'NO_CANDIDATE') rejected += 1;
    else findings.push(analysis);
  }
  findings.sort((a, b) => a.status.localeCompare(b.status) || (a.cadence || '').localeCompare(b.cadence || '') || a.signature_hash.localeCompare(b.signature_hash));
  const counts = { CANDIDATE: 0, REVIEW: 0, ALREADY_TRACKED: 0 };
  const cadenceCount = { WEEKLY: 0, MONTHLY: 0 };
  for (const finding of findings) {
    counts[finding.status] += 1;
    if (finding.cadence) cadenceCount[finding.cadence] += 1;
  }
  const queryHash = sha256(JSON.stringify(stable({ signature_hashes: groupHashes, plan_links: [...planLinks.entries()].sort(), detector_version: VERSION })));
  const telemetry = Object.freeze({
    schema: CONTRACT_SCHEMA,
    version: VERSION,
    query_hash: queryHash,
    status: 'OK',
    reason_code: null,
    group_count: groups.size,
    candidate_count: counts.CANDIDATE,
    review_count: counts.REVIEW,
    already_tracked_count: counts.ALREADY_TRACKED,
    rejected_group_count: rejected,
    cadence_count: Object.freeze({ ...cadenceCount })
  });
  return Object.freeze({
    schema: RESULT_SCHEMA,
    contract_version: VERSION,
    findings: Object.freeze(findings),
    telemetry,
    proposal_only: true,
    auto_confirmed: false,
    obligation_created: false,
    canonical_mutation: false,
    financial_write: false,
    financial_truth: false,
    provenance: Object.freeze({ detector: `${CONTRACT_SCHEMA}@${VERSION}`, obligation_comparison: CONTRACT.obligation_comparison.mode, fuzzy_matching: false })
  });
}

assertContract();
module.exports = Object.freeze({
  CONTRACT, CONTRACT_SCHEMA, VERSION, SIGNATURE_SCHEMA, RESULT_SCHEMA, FINDING_SCHEMA, LINK_SCHEMA,
  assertContract, normalizeLabel, subscriptionLabel, signaturePayload, signatureHash, eligibleOccurrence,
  lowerMedian, amountEvidence, weeklyEvidence, monthlyEvidence, cadenceEvidence, analyzeGroup, detectSubscriptions
});
