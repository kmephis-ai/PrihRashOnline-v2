'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const suite = require('../lib/ai/ai_eval_suite');
const runner = require('../tools/ai-eval-runner');
const baseline = require('./fixtures/ai_eval_baseline.v1.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

assert.strictEqual(suite.CONTRACT.schema, 'PRH_AI_EVAL_SUITE_V1');
assert.strictEqual(suite.CONTRACT.version, '1.0.0');
assert.strictEqual(suite.CONTRACT.roadmap_id, 'AIENG-005');
assert.strictEqual(suite.CONTRACT.mode, 'LOCAL_DETERMINISTIC_GOLDEN_EVAL');
assert.strictEqual(suite.CONTRACT.principles.external_model_required, false);
assert.strictEqual(suite.CONTRACT.principles.network_required, false);
assert.strictEqual(suite.CONTRACT.principles.paid_dependency_required, false);
assert.strictEqual(suite.CONTRACT.principles.production_financial_data_allowed, false);
assert.strictEqual(suite.CONTRACT.principles.public_evidence, 'SYNTHETIC_ONLY');
assert.strictEqual(suite.CONTRACT.principles.red_eval_bypass_allowed, false);
assert.strictEqual(suite.CONTRACT.principles.eval_grants_authority, false);
assert.strictEqual(suite.CONTRACT.principles.free_only, true);
assert.ok(Object.values(suite.CONTRACT.authorities).every((value) => value === false));

const dimensions = new Set(suite.CONTRACT.tasks.map((task) => task.dimension));
assert.deepStrictEqual([...dimensions].sort(), suite.CONTRACT.dimensions.slice().sort());
assert.strictEqual(suite.CONTRACT.tasks.length, 12);
assert.strictEqual(new Set(suite.CONTRACT.tasks.map((task) => task.id)).size, 12);

const expected = suite.expectedResults();
const evaluation = suite.evaluateResults(expected);
assert.strictEqual(evaluation.status, 'PASS');
assert.strictEqual(evaluation.task_count, 12);
assert.deepStrictEqual(evaluation.failed_task_ids, []);

const baselineLoaded = suite.loadBaseline(path.join(__dirname, '..'));
assert.strictEqual(baselineLoaded.evaluation.status, 'PASS');
assert.strictEqual(baselineLoaded.baseline.external_model_used, false);
assert.strictEqual(baselineLoaded.baseline.paid_dependency_required, false);
assert.strictEqual(baselineLoaded.baseline.public_finance_data, 'SYNTHETIC_ONLY');

const runnerReport = runner.run(['node', 'ai-eval-runner.js']);
assert.strictEqual(runnerReport.status, 'PASS');
assert.strictEqual(runnerReport.baseline_parity, true);
assert.strictEqual(runnerReport.external_model_used, false);
assert.strictEqual(runnerReport.paid_dependency_required, false);

const changedAction = clone(baseline.results);
changedAction.find((item) => item.task_id === 'SCOPE-001').action = 'SELECT_READY';
const changedActionReport = suite.compareCandidateToBaseline(changedAction, path.join(__dirname, '..'));
assert.strictEqual(changedActionReport.status, 'FAIL');
assert.deepStrictEqual(changedActionReport.failed_task_ids, ['SCOPE-001']);
assert.strictEqual(changedActionReport.baseline_parity, false);

const changedTests = clone(baseline.results);
changedTests.find((item) => item.task_id === 'TEST-001').tests = ['AI contract'];
const changedTestsReport = suite.compareCandidateToBaseline(changedTests, path.join(__dirname, '..'));
assert.strictEqual(changedTestsReport.status, 'FAIL');
assert.deepStrictEqual(changedTestsReport.failed_task_ids, ['TEST-001']);

const changedPrivacy = clone(baseline.results);
changedPrivacy.find((item) => item.task_id === 'PRIV-001').evidence_class = 'SYNTHETIC_ONLY';
const changedPrivacyReport = suite.compareCandidateToBaseline(changedPrivacy, path.join(__dirname, '..'));
assert.strictEqual(changedPrivacyReport.status, 'FAIL');
assert.deepStrictEqual(changedPrivacyReport.failed_task_ids, ['PRIV-001']);

const changedReview = clone(baseline.results);
changedReview.find((item) => item.task_id === 'REVIEW-001').finding_fields = ['severity'];
const changedReviewReport = suite.compareCandidateToBaseline(changedReview, path.join(__dirname, '..'));
assert.strictEqual(changedReviewReport.status, 'FAIL');
assert.deepStrictEqual(changedReviewReport.failed_task_ids, ['REVIEW-001']);

const missing = clone(baseline.results).filter((item) => item.task_id !== 'DOCS-001');
assert.throws(() => suite.evaluateResults(missing), (error) => error && error.code === 'AI_EVAL_MISSING_TASK');

const unknown = clone(baseline.results);
unknown.push({ ...clone(unknown[0]), task_id: 'UNKNOWN-999' });
assert.throws(() => suite.evaluateResults(unknown), (error) => error && error.code === 'AI_EVAL_UNKNOWN_TASK');

const paid = clone(baseline.results);
paid[0].paid_dependency_required = true;
assert.throws(() => suite.evaluateResults(paid), (error) => error && error.code === 'AI_EVAL_POLICY_FIELD_INVALID');

const extra = clone(baseline.results);
extra[0].unexpected = true;
assert.throws(() => suite.evaluateResults(extra), (error) => error && error.code === 'AI_EVAL_RESULT_SHAPE_INVALID');

const duplicateSetValue = clone(baseline.results);
duplicateSetValue.find((item) => item.task_id === 'TEST-001').tests.push('AI contract');
assert.throws(() => suite.evaluateResults(duplicateSetValue), (error) => error && error.code === 'AI_EVAL_RESULT_DUPLICATE_VALUE');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prh-ai-eval-'));
try {
  const fixturePath = path.join(tempRoot, 'tests', 'fixtures');
  fs.mkdirSync(fixturePath, { recursive: true });
  const unsafeBaseline = clone(baseline);
  unsafeBaseline.paid_dependency_required = true;
  fs.writeFileSync(path.join(fixturePath, 'ai_eval_baseline.v1.json'), JSON.stringify(unsafeBaseline), 'utf8');
  assert.throws(() => suite.loadBaseline(tempRoot), (error) => error && error.code === 'AI_EVAL_BASELINE_BOUNDARY_INVALID');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('ai-regression-eval-contract: PASS', {
  schema: suite.CONTRACT.schema,
  version: suite.CONTRACT.version,
  tasks: suite.CONTRACT.tasks.length,
  dimensions: [...dimensions].sort(),
  baselineParity: runnerReport.baseline_parity,
  externalModelRequired: suite.CONTRACT.principles.external_model_required,
  paidDependencyRequired: suite.CONTRACT.principles.paid_dependency_required,
  publicFinanceData: suite.CONTRACT.principles.public_evidence,
  authorityGranted: false,
  freeOnly: suite.CONTRACT.principles.free_only
});
