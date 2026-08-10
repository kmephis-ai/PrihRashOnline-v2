'use strict';

const fs = require('fs');
const path = require('path');
const CONTRACT = require('./ai_eval_suite.v1.json');

const SCHEMA = 'PRH_AI_EVAL_SUITE_V1';
const VERSION = '1.0.0';
const RESULT_KEYS = Object.freeze(CONTRACT.result_schema.exact_keys.slice().sort());
const SET_FIELDS = new Set(['tests', 'docs', 'finding_fields']);

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

function assertContract() {
  if (CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'AIENG-005') fail('AI_EVAL_CONTRACT_VERSION_INVALID');
  const p = CONTRACT.principles || {};
  if (p.external_model_required !== false || p.network_required !== false || p.paid_dependency_required !== false ||
      p.production_financial_data_allowed !== false || p.public_evidence !== 'SYNTHETIC_ONLY' ||
      p.red_eval_bypass_allowed !== false || p.eval_grants_authority !== false || p.free_only !== true) {
    fail('AI_EVAL_BOUNDARY_INVALID');
  }
  if (!Array.isArray(CONTRACT.tasks) || CONTRACT.tasks.length !== 12) fail('AI_EVAL_TASK_COUNT_INVALID');
  const ids = CONTRACT.tasks.map((task) => task.id);
  if (new Set(ids).size !== ids.length) fail('AI_EVAL_TASK_ID_DUPLICATE');
  if (Object.values(CONTRACT.authorities || {}).some((value) => value !== false)) fail('AI_EVAL_AUTHORITY_INVALID');
  return true;
}

function normalizeStringArray(value, field, taskId) {
  if (!Array.isArray(value)) fail('AI_EVAL_RESULT_FIELD_INVALID', `${taskId}:${field}`);
  const normalized = value.map((item) => String(item || '').trim());
  if (normalized.some((item) => !item)) fail('AI_EVAL_RESULT_FIELD_INVALID', `${taskId}:${field}`);
  if (new Set(normalized).size !== normalized.length) fail('AI_EVAL_RESULT_DUPLICATE_VALUE', `${taskId}:${field}`);
  return Object.freeze(normalized.slice().sort());
}

function normalizeResult(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('AI_EVAL_RESULT_INVALID');
  const keys = Object.keys(input).sort();
  if (JSON.stringify(keys) !== JSON.stringify(RESULT_KEYS)) fail('AI_EVAL_RESULT_SHAPE_INVALID', input.task_id || 'unknown');
  const taskId = String(input.task_id || '').trim();
  if (!taskId) fail('AI_EVAL_TASK_ID_INVALID');
  const action = String(input.action || '');
  const reviewMode = String(input.review_mode || '');
  const evidenceClass = String(input.evidence_class || '');
  if (!CONTRACT.result_schema.actions.includes(action)) fail('AI_EVAL_ACTION_INVALID', taskId);
  if (!CONTRACT.result_schema.review_modes.includes(reviewMode)) fail('AI_EVAL_REVIEW_MODE_INVALID', taskId);
  if (!CONTRACT.result_schema.evidence_classes.includes(evidenceClass)) fail('AI_EVAL_EVIDENCE_CLASS_INVALID', taskId);
  if (typeof input.policy_stop !== 'boolean' || input.paid_dependency_required !== false) fail('AI_EVAL_POLICY_FIELD_INVALID', taskId);
  const roadmapId = input.roadmap_id == null ? null : String(input.roadmap_id).trim();
  if (input.roadmap_id != null && !roadmapId) fail('AI_EVAL_ROADMAP_ID_INVALID', taskId);
  const output = {
    task_id: taskId,
    action,
    roadmap_id: roadmapId,
    tests: normalizeStringArray(input.tests, 'tests', taskId),
    docs: normalizeStringArray(input.docs, 'docs', taskId),
    evidence_class: evidenceClass,
    review_mode: reviewMode,
    finding_fields: normalizeStringArray(input.finding_fields, 'finding_fields', taskId),
    policy_stop: input.policy_stop,
    paid_dependency_required: false
  };
  return Object.freeze(output);
}

function taskMap() {
  return new Map(CONTRACT.tasks.map((task) => [task.id, task]));
}

function normalizeResultList(results) {
  if (!Array.isArray(results)) fail('AI_EVAL_RESULTS_INVALID');
  const normalized = results.map(normalizeResult);
  const ids = normalized.map((item) => item.task_id);
  if (new Set(ids).size !== ids.length) fail('AI_EVAL_RESULT_TASK_DUPLICATE');
  return normalized.sort((a, b) => a.task_id.localeCompare(b.task_id));
}

function evaluateResults(results) {
  assertContract();
  const expectedById = taskMap();
  const normalized = normalizeResultList(results);
  const actualIds = normalized.map((item) => item.task_id);
  const expectedIds = [...expectedById.keys()].sort();
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    const unknown = actualIds.filter((id) => !expectedById.has(id));
    if (unknown.length) fail('AI_EVAL_UNKNOWN_TASK', unknown.join(','));
    fail('AI_EVAL_MISSING_TASK', expectedIds.filter((id) => !actualIds.includes(id)).join(','));
  }
  const taskResults = normalized.map((actual) => {
    const expected = normalizeResult(expectedById.get(actual.task_id).expected);
    const pass = stableStringify(actual) === stableStringify(expected);
    return Object.freeze({ task_id: actual.task_id, dimension: expectedById.get(actual.task_id).dimension, status: pass ? 'PASS' : 'FAIL' });
  });
  const failed = taskResults.filter((item) => item.status !== 'PASS');
  return Object.freeze({
    schema: SCHEMA,
    version: VERSION,
    status: failed.length ? 'FAIL' : 'PASS',
    task_count: taskResults.length,
    failed_task_ids: Object.freeze(failed.map((item) => item.task_id)),
    results: Object.freeze(taskResults)
  });
}

function expectedResults() {
  assertContract();
  return CONTRACT.tasks.map((task) => normalizeResult(task.expected)).sort((a, b) => a.task_id.localeCompare(b.task_id));
}

function loadBaseline(root = path.join(__dirname, '..', '..')) {
  const baselinePath = path.join(root, CONTRACT.baseline.path);
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  if (baseline.schema !== 'PRH_AI_EVAL_BASELINE_V1' || baseline.version !== VERSION || baseline.suite !== `${SCHEMA}@${VERSION}`) {
    fail('AI_EVAL_BASELINE_VERSION_INVALID');
  }
  if (baseline.public_finance_data !== 'SYNTHETIC_ONLY' || baseline.external_model_used !== false || baseline.paid_dependency_required !== false) {
    fail('AI_EVAL_BASELINE_BOUNDARY_INVALID');
  }
  const evaluation = evaluateResults(baseline.results);
  if (evaluation.status !== 'PASS') fail('AI_EVAL_BASELINE_REGRESSION', evaluation.failed_task_ids.join(','));
  return Object.freeze({ baseline, evaluation });
}

function compareCandidateToBaseline(candidateResults, root) {
  const { baseline } = loadBaseline(root);
  const candidateEvaluation = evaluateResults(candidateResults);
  const baselineNormalized = normalizeResultList(baseline.results);
  const candidateNormalized = normalizeResultList(candidateResults);
  const baselineParity = stableStringify(candidateNormalized) === stableStringify(baselineNormalized);
  return Object.freeze({
    schema: 'PRH_AI_EVAL_REPORT_V1',
    version: VERSION,
    status: candidateEvaluation.status === 'PASS' && baselineParity ? 'PASS' : 'FAIL',
    task_count: candidateEvaluation.task_count,
    failed_task_ids: candidateEvaluation.failed_task_ids,
    baseline_parity: baselineParity,
    external_model_used: false,
    paid_dependency_required: false,
    public_finance_data: 'SYNTHETIC_ONLY'
  });
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  SET_FIELDS,
  stableStringify,
  assertContract,
  normalizeResult,
  normalizeResultList,
  evaluateResults,
  expectedResults,
  loadBaseline,
  compareCandidateToBaseline
});
