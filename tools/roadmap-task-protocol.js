'use strict';

const fs = require('fs');

const TASK_SCHEMA = 'PRH_ROADMAP_TASK_V1';
const REQUIRED_DELIVERY_GATES = Object.freeze([
  'PR_VALIDATION',
  'TRUSTED_DEV_DEPLOY',
  'TRUSTED_RUNTIME_HEALTH',
  'AUTONOMOUS_MERGE',
  'MAIN_VERIFICATION'
]);
const PRIORITY_ORDER = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });
const ITEM_STATUSES = new Set(['BACKLOG', 'READY', 'IN_PROGRESS', 'BLOCKED', 'DONE']);
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

function normalizeStringArray(value, field) {
  if (!Array.isArray(value)) fail(`ROADMAP_${field}_INVALID`);
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
  const priority = String(item.priority || '').trim();
  if (!Object.prototype.hasOwnProperty.call(PRIORITY_ORDER, priority)) fail('ROADMAP_PRIORITY_INVALID');
  const wave = String(item.wave || '').trim();
  if (!/^R[0-9]+$/.test(wave)) fail('ROADMAP_WAVE_INVALID');
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

  return {
    roadmap_id: roadmapId,
    issue,
    status,
    priority,
    wave,
    order,
    branch_slug: branchSlug,
    goal,
    non_goals: normalizeStringArray(item.non_goals || [], 'NON_GOALS'),
    depends_on: normalizeStringArray(item.depends_on || [], 'DEPENDENCIES'),
    data_touched: dataTouched,
    privacy_class: privacyClass,
    cost_class: costClass,
    acceptance: normalizeStringArray(item.acceptance, 'ACCEPTANCE'),
    evidence_required: normalizeStringArray(item.evidence_required, 'EVIDENCE'),
    rollback
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

function dependencyEvidence(item, index) {
  return item.depends_on.map((roadmapId) => {
    const dependency = index.get(roadmapId);
    if (!dependency) fail('ROADMAP_DEPENDENCY_MISSING');
    return {
      roadmap_id: roadmapId,
      status: dependency.status,
      issue: dependency.issue || null
    };
  });
}

function dependenciesDone(item, index) {
  return dependencyEvidence(item, index).every((entry) => entry.status === 'DONE');
}

function waveNumber(wave) {
  return Number(String(wave).slice(1));
}

function compareReadyItems(a, b) {
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    || waveNumber(a.wave) - waveNumber(b.wave)
    || a.order - b.order
    || a.roadmap_id.localeCompare(b.roadmap_id);
}

function assertPublicSafe(value) {
  const serialized = JSON.stringify(value);
  const forbidden = [
    /script\.google\.com\/macros\/s\//i,
    /\bAKfy[A-Za-z0-9_-]{20,}\b/,
    /\bya29\.[A-Za-z0-9._-]+\b/,
    /\b1\/\/[A-Za-z0-9_-]{20,}\b/,
    /-----BEGIN (?:RSA |EC |)PRIVATE KEY-----/,
    /[A-Z]:\\(?:YandexDisk|PrihRashOnline-Keys|PrihRashOnline\\)/i
  ];
  if (forbidden.some((pattern) => pattern.test(serialized))) fail('ROADMAP_TASK_PRIVATE_CONTEXT_FORBIDDEN');
  return true;
}

function buildTaskPacket(item, index, action) {
  const dependencies = dependencyEvidence(item, index);
  if (!dependencies.every((entry) => entry.status === 'DONE')) fail('ROADMAP_DEPENDENCY_NOT_DONE');
  const packet = {
    schema: TASK_SCHEMA,
    action,
    roadmap_id: item.roadmap_id,
    issue: item.issue,
    goal: item.goal,
    non_goals: item.non_goals.slice(),
    dependencies: dependencies.map((entry) => ({
      roadmap_id: entry.roadmap_id,
      status: 'DONE',
      issue: entry.issue
    })),
    data_touched: item.data_touched,
    privacy_class: item.privacy_class,
    cost_class: item.cost_class,
    acceptance: item.acceptance.slice(),
    evidence_required: item.evidence_required.slice(),
    rollback: item.rollback,
    branch: `agent/${item.roadmap_id}-${item.branch_slug}`,
    pr_close_line: `Closes #${item.issue}`,
    required_delivery_gates: REQUIRED_DELIVERY_GATES.slice(),
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
  if (String(packet.cost_class || '') !== 'FREE_ONLY') fail('ROADMAP_TASK_COST_CLASS_INVALID');
  if (!Array.isArray(packet.acceptance) || packet.acceptance.length === 0) fail('ROADMAP_TASK_ACCEPTANCE_INVALID');
  if (!Array.isArray(packet.evidence_required) || packet.evidence_required.length === 0) fail('ROADMAP_TASK_EVIDENCE_INVALID');
  if (!Array.isArray(packet.required_delivery_gates)
      || JSON.stringify(packet.required_delivery_gates) !== JSON.stringify(REQUIRED_DELIVERY_GATES)) {
    fail('ROADMAP_TASK_GATES_INVALID');
  }
  if (packet.one_active_writer !== true) fail('ROADMAP_TASK_WRITER_POLICY_INVALID');
  if (packet.branch !== `agent/${packet.roadmap_id}-${packet.branch.split('-').slice(2).join('-')}`
      || !packet.branch.startsWith(`agent/${packet.roadmap_id}-`)) {
    fail('ROADMAP_TASK_BRANCH_INVALID');
  }
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
  REQUIRED_DELIVERY_GATES,
  PRIORITY_ORDER,
  normalizeRoadmapItem,
  normalizeItems,
  stateIndex,
  dependencyEvidence,
  dependenciesDone,
  compareReadyItems,
  assertPublicSafe,
  buildTaskPacket,
  assertTaskPacket,
  resolveContinuation,
  validateLifecycleTransition
};
