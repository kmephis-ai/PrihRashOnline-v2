'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  TASK_SCHEMA,
  REQUIRED_DELIVERY_GATES,
  normalizeRoadmapItem,
  resolveContinuation,
  validateLifecycleTransition,
  assertPublicSafe
} = require('../tools/roadmap-task-protocol');
const {
  ROADMAP_ID_RE,
  parseProjectStatusEntries,
  currentRoadmapWriters,
  branchRoadmapId
} = require('../lib/testing/structured_contract_parsers');

function item(overrides = {}) {
  return {
    roadmap_id: 'AIENG-002',
    issue: 70,
    status: 'READY',
    priority: 'P1',
    wave: 'R0',
    order: 20,
    branch_slug: 'roadmap-task-protocol',
    goal: 'Resolve continuation to one concrete task.',
    non_goals: ['Do not implement multi-AI review.'],
    depends_on: ['AIENG-001'],
    data_touched: 'none',
    privacy_class: 'public-safe',
    cost_class: 'FREE_ONLY',
    acceptance: ['Concrete Roadmap ID is selected.'],
    evidence_required: ['Protocol contracts PASS.'],
    rollback: 'Revert protocol files.',
    ...overrides
  };
}

function done(id, issue, order = 1) {
  return item({
    roadmap_id: id,
    issue,
    status: 'DONE',
    priority: 'P1',
    order,
    branch_slug: 'done-item',
    depends_on: []
  });
}

assert.strictEqual(TASK_SCHEMA, 'PRH_ROADMAP_TASK_V1');
assert.deepStrictEqual(REQUIRED_DELIVERY_GATES, [
  'PR_VALIDATION',
  'TRUSTED_DEV_DEPLOY',
  'TRUSTED_RUNTIME_HEALTH',
  'AUTONOMOUS_MERGE',
  'MAIN_VERIFICATION'
]);

// Structured lifecycle parsers must support canonical multi-segment Roadmap IDs.
assert.strictEqual(ROADMAP_ID_RE.test('GOAL-030'), true);
assert.strictEqual(ROADMAP_ID_RE.test('UI-MIG-020'), true);
assert.strictEqual(ROADMAP_ID_RE.test('ABC-DEF-GHI-123'), true);
assert.strictEqual(ROADMAP_ID_RE.test('UI--MIG-020'), false);
assert.strictEqual(ROADMAP_ID_RE.test('ui-MIG-020'), false);
{
  const statusMarkdown = [
    '- `NW-030` — **DONE**, Issue #171.',
    '- `UI-MIG-020` — **IN_PROGRESS**, Issue #172, branch `agent/UI-MIG-020-canonical-r2-cutover`.'
  ].join('\n');
  assert.deepStrictEqual(parseProjectStatusEntries(statusMarkdown).map((entry) => [entry.id, entry.lifecycle]), [
    ['NW-030', 'DONE'],
    ['UI-MIG-020', 'IN_PROGRESS']
  ]);
  assert.deepStrictEqual(currentRoadmapWriters(statusMarkdown), ['UI-MIG-020']);
  assert.strictEqual(branchRoadmapId({ GITHUB_HEAD_REF: 'agent/UI-MIG-020-canonical-r2-cutover' }), 'UI-MIG-020');
  assert.strictEqual(branchRoadmapId({ GITHUB_HEAD_REF: 'agent/GOAL-030-goals-wishlist' }), 'GOAL-030');
  assert.strictEqual(branchRoadmapId({ GITHUB_HEAD_REF: 'agent/UI--MIG-020-invalid' }), '');
}

{
  const normalized = normalizeRoadmapItem(item({
    roadmap_id: 'UI-MIG-020',
    issue: 172,
    status: 'READY',
    priority: 'P1',
    wave: 'R2',
    order: 999,
    branch_slug: 'canonical-r2-cutover',
    depends_on: []
  }));
  assert.strictEqual(normalized.roadmap_id, 'UI-MIG-020');
}

{
  const result = resolveContinuation([
    done('AIENG-001', 68),
    item(),
    item({
      roadmap_id: 'FIN-010',
      issue: 80,
      status: 'READY',
      priority: 'P0',
      wave: 'R1',
      order: 1,
      branch_slug: 'kpi-dictionary',
      depends_on: []
    })
  ]);
  assert.strictEqual(result.status, 'RESOLVED');
  assert.strictEqual(result.action, 'START_READY');
  assert.strictEqual(result.roadmap_id, 'FIN-010', 'highest priority READY item must win even in a later wave');
  assert.strictEqual(result.task.schema, TASK_SCHEMA);
  assert.strictEqual(result.task.issue, 80);
  assert.strictEqual(result.task.branch, 'agent/FIN-010-kpi-dictionary');
  assert.strictEqual(result.task.pr_close_line, 'Closes #80');
  assert.strictEqual(result.task.cost_class, 'FREE_ONLY');
  assert.strictEqual(result.task.one_active_writer, true);
  assert.deepStrictEqual(result.task.required_delivery_gates, REQUIRED_DELIVERY_GATES);
}

{
  const result = resolveContinuation([
    done('AIENG-001', 68),
    item({ status: 'IN_PROGRESS' }),
    item({
      roadmap_id: 'FIN-010',
      issue: 80,
      status: 'READY',
      priority: 'P0',
      wave: 'R1',
      branch_slug: 'kpi-dictionary',
      depends_on: []
    })
  ]);
  assert.strictEqual(result.status, 'RESOLVED');
  assert.strictEqual(result.action, 'CONTINUE_ACTIVE');
  assert.strictEqual(result.roadmap_id, 'AIENG-002', 'active writer must be resumed; lower/other work must not start');
}

{
  const result = resolveContinuation([
    done('AIENG-001', 68),
    item({ status: 'IN_PROGRESS' }),
    item({
      roadmap_id: 'AIENG-003',
      issue: 72,
      status: 'IN_PROGRESS',
      order: 30,
      branch_slug: 'multi-ai-review',
      depends_on: ['AIENG-001']
    })
  ]);
  assert.deepStrictEqual(result, {
    status: 'BLOCKED',
    action: 'NONE',
    roadmap_id: '',
    reason: 'MULTIPLE_ACTIVE_WRITERS'
  });
}

{
  const result = resolveContinuation([
    item({
      roadmap_id: 'AIENG-001',
      issue: 68,
      status: 'READY',
      order: 10,
      branch_slug: 'repository-ai-contract',
      depends_on: []
    }),
    item()
  ]);
  assert.strictEqual(result.status, 'RESOLVED');
  assert.strictEqual(result.roadmap_id, 'AIENG-001');
  const blockedChild = resolveContinuation([
    item({
      roadmap_id: 'AIENG-001',
      issue: 68,
      status: 'BLOCKED',
      order: 10,
      branch_slug: 'repository-ai-contract',
      depends_on: []
    }),
    item()
  ]);
  assert.strictEqual(blockedChild.status, 'BLOCKED');
  assert.strictEqual(blockedChild.reason, 'NO_DEPENDENCY_READY_ITEM');
}

{
  const result = resolveContinuation([
    done('AIENG-001', 68),
    item({ roadmap_id: 'OBS-010', issue: 81, priority: 'P1', order: 2, branch_slug: 'slos', depends_on: [] }),
    item({ roadmap_id: 'ARCH-010', issue: 82, priority: 'P1', order: 1, branch_slug: 'domain-core', depends_on: [] }),
    item({ roadmap_id: 'ANL-010', issue: 83, priority: 'P1', order: 1, branch_slug: 'read-api', depends_on: [] })
  ]);
  assert.strictEqual(result.roadmap_id, 'ANL-010', 'priority/wave/order/roadmap_id ordering must be deterministic');
}

{
  const result = resolveContinuation([
    done('AIENG-001', 68),
    item()
  ]);
  assert.strictEqual(result.task.roadmap_id, 'AIENG-002');
  assert.deepStrictEqual(result.task.dependencies, [{ roadmap_id: 'AIENG-001', status: 'DONE', issue: 68 }]);
  assert.deepStrictEqual(result.task.non_goals, ['Do not implement multi-AI review.']);
  assert.strictEqual(result.task.data_touched, 'none');
  assert.strictEqual(result.task.privacy_class, 'public-safe');
  assert.deepStrictEqual(result.task.acceptance, ['Concrete Roadmap ID is selected.']);
  assert.deepStrictEqual(result.task.evidence_required, ['Protocol contracts PASS.']);
  assert.strictEqual(result.task.rollback, 'Revert protocol files.');
}

assert.strictEqual(validateLifecycleTransition('READY', 'IN_PROGRESS'), true);
assert.strictEqual(validateLifecycleTransition('READY', 'BLOCKED'), true);
assert.strictEqual(validateLifecycleTransition('BLOCKED', 'READY'), true);
assert.strictEqual(validateLifecycleTransition('IN_PROGRESS', 'BLOCKED'), true);
assert.throws(() => validateLifecycleTransition('READY', 'DONE'), /ROADMAP_LIFECYCLE_TRANSITION_INVALID/);
assert.throws(() => validateLifecycleTransition('DONE', 'IN_PROGRESS'), /ROADMAP_LIFECYCLE_TRANSITION_INVALID/);
assert.throws(() => validateLifecycleTransition('IN_PROGRESS', 'DONE', {
  prValidation: 'PASS',
  trustedDevDeploy: 'PASS',
  trustedRuntimeHealth: 'PASS',
  autonomousMerge: 'PASS'
}), /ROADMAP_DONE_EVIDENCE_INCOMPLETE/);
assert.strictEqual(validateLifecycleTransition('IN_PROGRESS', 'DONE', {
  prValidation: 'PASS',
  trustedDevDeploy: 'PASS',
  trustedRuntimeHealth: 'PASS',
  autonomousMerge: 'PASS',
  mainVerification: 'PASS'
}), true);

assert.strictEqual(assertPublicSafe({ roadmap_id: 'AIENG-002', reason: 'OK' }), true);
assert.throws(() => assertPublicSafe({ locator: 'https://script.google.com/macros/s/PRIVATE/exec' }),
  /ROADMAP_TASK_PRIVATE_CONTEXT_FORBIDDEN/);
assert.throws(() => assertPublicSafe({ deployment: `AKfy${'x'.repeat(30)}` }),
  /ROADMAP_TASK_PRIVATE_CONTEXT_FORBIDDEN/);
assert.throws(() => assertPublicSafe({ refresh: `1//${'x'.repeat(30)}` }),
  /ROADMAP_TASK_PRIVATE_CONTEXT_FORBIDDEN/);
assert.throws(() => assertPublicSafe({ path: 'G:\\PrihRashOnline-Keys\\private.key' }),
  /ROADMAP_TASK_PRIVATE_CONTEXT_FORBIDDEN/);

assert.throws(() => normalizeRoadmapItem(item({ cost_class: 'PAID_ALLOWED' })), /ROADMAP_COST_CLASS_NOT_FREE_ONLY/);
assert.throws(() => normalizeRoadmapItem(item({ branch_slug: 'Bad_Slug' })), /ROADMAP_BRANCH_SLUG_INVALID/);
assert.throws(() => normalizeRoadmapItem(item({ acceptance: [] })), /ROADMAP_ACCEPTANCE_INVALID/);

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.ai-context', 'roadmap-task-packet.schema.json'), 'utf8'));
assert.strictEqual(schema.properties.schema.const, TASK_SCHEMA);
assert(schema.required.includes('goal'));
assert(schema.required.includes('non_goals'));
assert(schema.required.includes('dependencies'));
assert(schema.required.includes('data_touched'));
assert(schema.required.includes('privacy_class'));
assert(schema.required.includes('acceptance'));
assert(schema.required.includes('evidence_required'));
assert(schema.required.includes('branch'));
assert(schema.required.includes('pr_close_line'));

console.log('roadmap_task_protocol_contract_test: OK', {
  concreteReadyResolution: true,
  activeWriterResume: true,
  oneWriterFailClosed: true,
  dependencyEvidence: true,
  deterministicOrdering: true,
  completeTaskPacket: true,
  multiSegmentRoadmapIds: true,
  multiSegmentWriterBranch: true,
  mainVerificationRequiredForDone: true,
  privateContextRejected: true
});
