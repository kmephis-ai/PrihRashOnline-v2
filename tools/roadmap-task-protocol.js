'use strict';

const fs = require('fs');

const TASK_SCHEMA = 'PRH_ROADMAP_TASK_V2';
const ENGINEERING_DELIVERY_GATES = Object.freeze([
  'PR_VALIDATION',
  'TRUSTED_DEV_DEPLOY',
  'TRUSTED_RUNTIME_HEALTH',
  'AUTONOMOUS_MERGE',
  'MAIN_VERIFICATION'
]);
const PRODUCT_READY_GATE = 'PRODUCT_READY_E2E';
const REQUIRED_DELIVERY_GATES = ENGINEERING_DELIVERY_GATES;
const PRIORITY_ORDER = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });
const ITEM_STATUSES = new Set(['BACKLOG', 'READY', 'IN_PROGRESS', 'BLOCKED', 'DONE']);
const WORK_CLASSES = new Set(['engineering', 'user_facing']);
const ENGINEERING_STATUSES = new Set(['BACKLOG', 'IN_PROGRESS', 'CODE_COMPLETE', 'DONE_ENGINEERING']);
const PRODUCT_STAGE_ORDER = Object.freeze({
  NOT_APPLICABLE: -1,
  NOT_STARTED: 0,
  CODE_COMPLETE: 1,
  RUNTIME_INTEGRATED: 2,
  REAL_E2E_VERIFIED: 3,
  PRODUCT_READY: 4,
  DONE: 5
});
const PRODUCT_STAGES = new Set(Object.keys(PRODUCT_STAGE_ORDER));
const TARGET_STAGES = new Set(['DONE_ENGINEERING', 'DONE']);
const ROADMAP_ID_RE = /^[A-Z][A-Z0-9-]*-[0-9]{3}$/;
const BRANCH_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function boundedReason(error, fallback) {
  const raw = String(error && (error.code || error.message) || '');
  return /^[A-Z][A-Z0-9_]{2,79}$/.test(raw) ? raw : fallback;
}

function normalizeStringArray(value, field, allowEmpty) {
  if (!Array.isArray(value)) fail(`ROADMAP_${field}_INVALID`);
  if (!allowEmpty && value.length === 0) fail(`ROADMAP_${field}_INVALID`);
  return value.map((entry) => {
    const text = String(entry || '').trim();
    if (!text) fail(`ROADMAP_${field}_INVALID`);
    return text;
  });
}

function normalizeRoadmapItem(input) {
  const item = input && typeof input === 'object' ? input : {};
  const roadmapId = String(item.roadmap_id || '').trim();
  if (!ROADMAP_ID_RE.test(roadmapId)) fail('ROADMAP_ID_INVALID');
  const issue = Number(item.issue);
  if (!Number.isInteger(issue) || issue < 1) fail('ROADMAP_ISSUE_INVALID');
  const status = String(item.status || '').trim();
  if (!ITEM_STATUSES.has(status)) fail('ROADMAP_STATUS_INVALID');
  const workClass = String(item.work_class || '').trim();
  if (!WORK_CLASSES.has(workClass)) fail('ROADMAP_WORK_CLASS_INVALID');
  const engineeringStatus = String(item.engineering_status || '').trim();
  if (!ENGINEERING_STATUSES.has(engineeringStatus)) fail('ROADMAP_ENGINEERING_STATUS_INVALID');
  const productStage = String(item.product_stage || '').trim();
  if (!PRODUCT_STAGES.has(productStage)) fail('ROADMAP_PRODUCT_STAGE_INVALID');
  const targetStage = String(item.target_stage || '').trim();
  if (!TARGET_STAGES.has(targetStage)) fail('ROADMAP_TARGET_STAGE_INVALID');
  if (workClass === 'engineering' && targetStage !== 'DONE_ENGINEERING') fail('ROADMAP_ENGINEERING_TARGET_INVALID');
  if (workClass === 'user_facing' && targetStage !== 'DONE') fail('ROADMAP_PRODUCT_TARGET_INVALID');
  if (workClass === 'engineering' && !['NOT_APPLICABLE', 'CODE_COMPLETE'].includes(productStage)) {
    fail('ROADMAP_ENGINEERING_PRODUCT_STAGE_INVALID');
  }
  if (workClass === 'user_facing' && productStage === 'NOT_APPLICABLE') fail('ROADMAP_PRODUCT_STAGE_REQUIRED');
  const priority = String(item.priority || '').trim();
  if (!Object.prototype.hasOwnProperty.call(PRIORITY_ORDER, priority)) fail('ROADMAP_PRIORITY_INVALID');
  const wave = String(item.wave || '').trim();
  if (!/^R(?:[0-9]+|[0-9]+R)$/.test(wave)) fail('ROADMAP_WAVE_INVALID');
  const order = item.order === undefined ? 999999 : Number(item.order);
  if (!Number.isInteger(order) || order < 0) fail('ROADMAP_ORDER_INVALID');
  const branchSlug = String(item.branch_slug || '').trim();
  if (!BRANCH_SLUG_RE.test(branchSlug)) fail('ROADMAP_BRANCH_SLUG_INVALID');
  const goal = String(item.goal || '').trim();
  if (!goal) fail('ROADMAP_GOAL_INVALID');
  const dataTouched = String(item.data_touched || '').trim();
  if (!dataTouched) fail('ROADMAP_DATA_CLASS_INVALID');
  const privacyClass = String(item.privacy_class || '').trim();
  if (!privacyClass) fail('ROADMAP_PRIVACY_CLASS_INVALID');
  const costClass = String(item.cost_class || '').trim();
  if (costClass !== 'FREE_ONLY') fail('ROADMAP_COST_CLASS_NOT_FREE_ONLY');
  const rollback = String(item.rollback || '').trim();
  if (!rollback) fail('ROADMAP_ROLLBACK_INVALID');
  const blockingProductGate = String(item.blocking_product_gate || '').trim();
  if (!blockingProductGate) fail('ROADMAP_BLOCKING_PRODUCT_GATE_INVALID');
  if (workClass === 'user_facing' && blockingProductGate.toLowerCase() === 'n/a') {
    fail('ROADMAP_PRODUCT_GATE_REQUIRED');
  }

  const dependsOn = normalizeStringArray(item.depends_on || [], 'DEPENDENCIES', true);
  const runtimeDependencies = normalizeStringArray(item.depends_on_runtime_integrated || [], 'RUNTIME_DEPENDENCIES', true);
  const productDependencies = normalizeStringArray(item.depends_on_product_ready || [], 'PRODUCT_DEPENDENCIES', true);
  const allDependencies = dependsOn.concat(runtimeDependencies, productDependencies);
  if (new Set(allDependencies).size !== allDependencies.length) fail('ROADMAP_DEPENDENCY_DUPLICATE');

  return {
    roadmap_id: roadmapId,
    issue,
    status,
    work_class: workClass,
    engineering_status: engineeringStatus,
    product_stage: productStage,
    target_stage: targetStage,
    priority,
    wave,
    order,
    branch_slug: branchSlug,
    goal,
    non_goals: normalizeStringArray(item.non_goals, 'NON_GOALS', false),
    depends_on: dependsOn,
    depends_on_runtime_integrated: runtimeDependencies,
    depends_on_product_ready: productDependencies,
    data_touched: dataTouched,
    privacy_class: privacyClass,
    cost_class: costClass,
    acceptance: normalizeStringArray(item.acceptance, 'ACCEPTANCE', false),
    evidence_required: normalizeStringArray(item.evidence_required, 'EVIDENCE', false),
    rollback,
    blocking_product_gate: blockingProductGate
  };
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) fail('ROADMAP_ITEMS_INVALID');
  const normalized = items.map(normalizeRoadmapItem);
  const seen = new Set();
  for (const item of normalized) {
    if (seen.has(item.roadmap_id)) fail('ROADMAP_ID_DUPLICATE');
    seen.add(item.roadmap_id);
  }
  return normalized;
}

function stateIndex(items) {
  const index = new Map();
  for (const item of items) index.set(item.roadmap_id, item);
  return index;
}

function productStageAtLeast(actual, required) {
  if (!Object.prototype.hasOwnProperty.call(PRODUCT_STAGE_ORDER, actual)
      || !Object.prototype.hasOwnProperty.call(PRODUCT_STAGE_ORDER, required)) return false;
  return PRODUCT_STAGE_ORDER[actual] >= PRODUCT_STAGE_ORDER[required];
}

function dependencyEvidence(item, index) {
  const ordinary = item.depends_on.map((roadmapId) => ({ roadmapId, requiredStage: 'DONE_ENGINEERING' }));
  const runtime = item.depends_on_runtime_integrated.map((roadmapId) => ({ roadmapId, requiredStage: 'RUNTIME_INTEGRATED' }));
  const product = item.depends_on_product_ready.map((roadmapId) => ({ roadmapId, requiredStage: 'PRODUCT_READY' }));
  return ordinary.concat(runtime, product).map(({ roadmapId, requiredStage }) => {
    const dependency = index.get(roadmapId);
    if (!dependency) fail('ROADMAP_DEPENDENCY_MISSING');
    return {
      roadmap_id: roadmapId,
      status: dependency.status,
      issue: dependency.issue || null,
      work_class: dependency.work_class,
      engineering_status: dependency.engineering_status,
      product_stage: dependency.product_stage,
      required_stage: requiredStage
    };
  });
}

function dependenciesDone(item, index) {
  return dependencyEvidence(item, index).every((entry) => {
    if (entry.required_stage === 'RUNTIME_INTEGRATED') {
      return entry.work_class === 'user_facing'
        && ['IN_PROGRESS', 'BLOCKED', 'DONE'].includes(entry.status)
        && productStageAtLeast(entry.product_stage, 'RUNTIME_INTEGRATED');
    }
    if (entry.status !== 'DONE') return false;
    if (entry.required_stage === 'PRODUCT_READY') return entry.product_stage === 'DONE';
    return true;
  });
}

function waveNumber(wave) {
  const value = String(wave).slice(1);
  return value.endsWith('R') ? Number(value.slice(0, -1)) + 0.5 : Number(value);
}

function requiredDeliveryGates(item) {
  return item.work_class === 'user_facing'
    ? ENGINEERING_DELIVERY_GATES.concat(PRODUCT_READY_GATE)
    : ENGINEERING_DELIVERY_GATES.slice();
}

function compareReadyItems(a, b) {
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    || waveNumber(a.wave) - waveNumber(b.wave)
    || a.order - b.order
    || a.roadmap_id.localeCompare(b.roadmap_id);
}

function assertPublicSafe(value) {
  const forbidden = [
    /script\.google\.com\/macros\/s\//i,
    /\bAKfy[A-Za-z0-9_-]{20,}\b/,
    /\bya29\.[A-Za-z0-9._-]+\b/,
    /\b1\/\/[A-Za-z0-9_-]{20,}\b/,
    /-----BEGIN (?:RSA |EC |)PRIVATE KEY-----/,
    /[A-Z]:\\(?:YandexDisk|PrihRashOnline-Keys|PrihRashOnline(?:\\|$))/i
  ];
  const stack = [value];
  while (stack.length) {
    const current = stack.pop();
    if (typeof current === 'string') {
      if (forbidden.some((pattern) => pattern.test(current))) fail('ROADMAP_TASK_PRIVATE_CONTEXT_FORBIDDEN');
      continue;
    }
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    if (current && typeof current === 'object') {
      for (const [key, nested] of Object.entries(current)) {
        stack.push(key, nested);
      }
    }
  }
  return true;
}

function buildTaskPacket(item, index, action) {
  const dependencies = dependencyEvidence(item, index);
  if (!dependenciesDone(item, index)) fail('ROADMAP_DEPENDENCY_NOT_DONE');
  const packet = {
    schema: TASK_SCHEMA,
    action,
    roadmap_id: item.roadmap_id,
    issue: item.issue,
    work_class: item.work_class,
    engineering_status: item.engineering_status,
    product_stage: item.product_stage,
    target_stage: item.target_stage,
    goal: item.goal,
    non_goals: item.non_goals.slice(),
    dependencies: dependencies.map((entry) => ({
      roadmap_id: entry.roadmap_id,
      status: entry.status,
      issue: entry.issue,
      product_stage: entry.product_stage,
      required_stage: entry.required_stage
    })),
    data_touched: item.data_touched,
    privacy_class: item.privacy_class,
    cost_class: item.cost_class,
    acceptance: item.acceptance.slice(),
    evidence_required: item.evidence_required.slice(),
    rollback: item.rollback,
    blocking_product_gate: item.blocking_product_gate,
    branch: `agent/${item.roadmap_id}-${item.branch_slug}`,
    pr_close_line: `Closes #${item.issue}`,
    required_delivery_gates: requiredDeliveryGates(item),
    one_active_writer: true
  };
  assertTaskPacket(packet);
  return packet;
}

function assertTaskPacket(packet) {
  if (!packet || packet.schema !== TASK_SCHEMA) fail('ROADMAP_TASK_SCHEMA_INVALID');
  if (!['START_READY', 'CONTINUE_ACTIVE'].includes(packet.action)) fail('ROADMAP_TASK_ACTION_INVALID');
  if (!ROADMAP_ID_RE.test(String(packet.roadmap_id || ''))) fail('ROADMAP_TASK_ID_INVALID');
  if (!Number.isInteger(packet.issue) || packet.issue < 1) fail('ROADMAP_TASK_ISSUE_INVALID');
  if (!WORK_CLASSES.has(String(packet.work_class || ''))) fail('ROADMAP_TASK_WORK_CLASS_INVALID');
  if (!ENGINEERING_STATUSES.has(String(packet.engineering_status || ''))) fail('ROADMAP_TASK_ENGINEERING_STATUS_INVALID');
  if (!PRODUCT_STAGES.has(String(packet.product_stage || ''))) fail('ROADMAP_TASK_PRODUCT_STAGE_INVALID');
  if (!TARGET_STAGES.has(String(packet.target_stage || ''))) fail('ROADMAP_TASK_TARGET_STAGE_INVALID');
  if (!Array.isArray(packet.non_goals) || packet.non_goals.length === 0) fail('ROADMAP_TASK_NON_GOALS_INVALID');
  if (!Array.isArray(packet.dependencies)) fail('ROADMAP_TASK_DEPENDENCIES_INVALID');
  for (const dependency of packet.dependencies) {
    if (!ROADMAP_ID_RE.test(String(dependency && dependency.roadmap_id || ''))) fail('ROADMAP_TASK_DEPENDENCIES_INVALID');
    if (!['IN_PROGRESS', 'BLOCKED', 'DONE'].includes(String(dependency.status || ''))) fail('ROADMAP_TASK_DEPENDENCIES_INVALID');
    if (!PRODUCT_STAGES.has(String(dependency.product_stage || ''))) fail('ROADMAP_TASK_DEPENDENCIES_INVALID');
    if (!['DONE_ENGINEERING', 'RUNTIME_INTEGRATED', 'PRODUCT_READY'].includes(String(dependency.required_stage || ''))) {
      fail('ROADMAP_TASK_DEPENDENCIES_INVALID');
    }
    if (dependency.required_stage !== 'RUNTIME_INTEGRATED' && dependency.status !== 'DONE') {
      fail('ROADMAP_TASK_DEPENDENCIES_INVALID');
    }
  }
  if (String(packet.cost_class || '') !== 'FREE_ONLY') fail('ROADMAP_TASK_COST_CLASS_INVALID');
  if (!Array.isArray(packet.acceptance) || packet.acceptance.length === 0) fail('ROADMAP_TASK_ACCEPTANCE_INVALID');
  if (!Array.isArray(packet.evidence_required) || packet.evidence_required.length === 0) fail('ROADMAP_TASK_EVIDENCE_INVALID');
  const expectedGates = packet.work_class === 'user_facing'
    ? ENGINEERING_DELIVERY_GATES.concat(PRODUCT_READY_GATE)
    : ENGINEERING_DELIVERY_GATES;
  if (!Array.isArray(packet.required_delivery_gates)
      || JSON.stringify(packet.required_delivery_gates) !== JSON.stringify(expectedGates)) {
    fail('ROADMAP_TASK_GATES_INVALID');
  }
  if (!String(packet.blocking_product_gate || '').trim()) fail('ROADMAP_TASK_PRODUCT_GATE_INVALID');
  if (packet.work_class === 'user_facing' && String(packet.blocking_product_gate).toLowerCase() === 'n/a') {
    fail('ROADMAP_TASK_PRODUCT_GATE_INVALID');
  }
  if (packet.one_active_writer !== true) fail('ROADMAP_TASK_WRITER_POLICY_INVALID');
  const branchPattern = new RegExp(`^agent/${packet.roadmap_id}-[a-z0-9][a-z0-9-]{1,63}$`);
  if (!branchPattern.test(String(packet.branch || ''))) fail('ROADMAP_TASK_BRANCH_INVALID');
  if (packet.pr_close_line !== `Closes #${packet.issue}`) fail('ROADMAP_TASK_PR_CLOSE_INVALID');
  assertPublicSafe(packet);
  return true;
}

function resolveContinuation(itemsInput) {
  try {
    const items = normalizeItems(itemsInput);
    const index = stateIndex(items);
    const active = items.filter((item) => item.status === 'IN_PROGRESS');
    if (active.length > 1) return { status: 'BLOCKED', action: 'NONE', roadmap_id: '', reason: 'MULTIPLE_ACTIVE_WRITERS' };
    if (active.length === 1) {
      const item = active[0];
      if (!dependenciesDone(item, index)) {
        return { status: 'BLOCKED', action: 'NONE', roadmap_id: item.roadmap_id, reason: 'ACTIVE_WRITER_DEPENDENCY_NOT_DONE' };
      }
      return { status: 'RESOLVED', action: 'CONTINUE_ACTIVE', roadmap_id: item.roadmap_id, task: buildTaskPacket(item, index, 'CONTINUE_ACTIVE') };
    }

    const ready = items
      .filter((item) => item.status === 'READY')
      .filter((item) => dependenciesDone(item, index))
      .sort(compareReadyItems);
    if (ready.length === 0) return { status: 'BLOCKED', action: 'NONE', roadmap_id: '', reason: 'NO_DEPENDENCY_READY_ITEM' };
    const selected = ready[0];
    return { status: 'RESOLVED', action: 'START_READY', roadmap_id: selected.roadmap_id, task: buildTaskPacket(selected, index, 'START_READY') };
  } catch (error) {
    return { status: 'BLOCKED', action: 'NONE', roadmap_id: '', reason: boundedReason(error, 'ROADMAP_PROTOCOL_FAILED') };
  }
}

function validateLifecycleTransition(from, to, evidence) {
  const current = String(from || '');
  const next = String(to || '');
  const allowed = new Set([
    'BACKLOG->READY',
    'READY->IN_PROGRESS',
    'READY->BLOCKED',
    'BLOCKED->READY',
    'IN_PROGRESS->BLOCKED',
    'IN_PROGRESS->DONE'
  ]);
  if (!allowed.has(`${current}->${next}`)) fail('ROADMAP_LIFECYCLE_TRANSITION_INVALID');
  if (current === 'IN_PROGRESS' && next === 'DONE') {
    const proof = evidence && typeof evidence === 'object' ? evidence : {};
    const required = ['prValidation', 'trustedDevDeploy', 'trustedRuntimeHealth', 'autonomousMerge', 'mainVerification'];
    if (!required.every((key) => String(proof[key] || '') === 'PASS')) fail('ROADMAP_DONE_EVIDENCE_INCOMPLETE');
    const workClass = String(proof.workClass || '');
    if (!WORK_CLASSES.has(workClass)) fail('ROADMAP_DONE_WORK_CLASS_INVALID');
    if (workClass === 'engineering') {
      if (String(proof.targetStage || '') !== 'DONE_ENGINEERING') fail('ROADMAP_DONE_TARGET_INVALID');
    } else if (String(proof.targetStage || '') !== 'DONE'
      || String(proof.productStage || '') !== 'PRODUCT_READY'
      || String(proof.productReadyE2E || '') !== 'PASS') {
      fail('ROADMAP_PRODUCT_DONE_EVIDENCE_INCOMPLETE');
    }
  }
  return true;
}

function parseInputFile(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!parsed || !Array.isArray(parsed.items)) fail('ROADMAP_INPUT_INVALID');
  assertPublicSafe(parsed);
  return parsed.items;
}

function main() {
  const command = process.argv[2];
  const filePath = process.argv[3];
  try {
    if (command !== 'resolve' || !filePath) fail('ROADMAP_COMMAND_INVALID');
    const result = resolveContinuation(parseInputFile(filePath));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.status !== 'RESOLVED') process.exitCode = 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'BLOCKED', action: 'NONE', roadmap_id: '', reason: boundedReason(error, 'ROADMAP_PROTOCOL_FAILED') })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  TASK_SCHEMA,
  ENGINEERING_DELIVERY_GATES,
  PRODUCT_READY_GATE,
  REQUIRED_DELIVERY_GATES,
  PRIORITY_ORDER,
  PRODUCT_STAGE_ORDER,
  normalizeRoadmapItem,
  normalizeItems,
  stateIndex,
  productStageAtLeast,
  dependencyEvidence,
  dependenciesDone,
  requiredDeliveryGates,
  compareReadyItems,
  assertPublicSafe,
  buildTaskPacket,
  assertTaskPacket,
  resolveContinuation,
  validateLifecycleTransition
};