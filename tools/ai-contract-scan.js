'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const agents = read('AGENTS.md');
const context = read('.ai-context/PROJECT_CONTEXT.md');
const llms = read('llms.txt');
const status = read('docs/PROJECT_STATUS.md');
const workflow = read('.github/workflows/pr-validation.yml');

const failures = [];
function requireMatch(id, text, pattern, message) {
  if (!pattern.test(text)) failures.push({ id, message });
}
function forbidMatch(id, text, pattern, message) {
  if (pattern.test(text)) failures.push({ id, message });
}

requireMatch('AI_PRODUCT_OBJECTIVE', agents, /Product objective[\s\S]{0,700}household-finance/i,
  'AGENTS.md must define product objective');
requireMatch('AI_SOURCE_PRECEDENCE', agents, /Sources of truth and precedence[\s\S]{0,1800}fail closed/i,
  'source precedence/fail-closed conflict rule missing');
requireMatch('AI_CANONICAL_CONTEXT', agents, /Master Audit v2\.1[\s\S]{0,160}Executable GitHub Roadmap v2\.1[\s\S]{0,160}AI Development Playbook v1\.0/,
  'canonical external context names missing');
requireMatch('AI_AUTONOMY_V2', agents, /Autonomy Contract v2/,
  'Autonomy Contract v2 heading missing');
requireMatch('AI_ONE_WRITER', agents, /one Roadmap ID = one GitHub Issue = one active writer/i,
  'one-writer lifecycle missing');
requireMatch('AI_BRANCH_RULE', agents, /agent\/<ROADMAP-ID>-<slug>/,
  'agent branch convention missing');
requireMatch('AI_ISSUE_LIFECYCLE', agents, /IN_PROGRESS[\s\S]{0,900}DONE/,
  'Issue IN_PROGRESS -> DONE lifecycle missing');
requireMatch('AI_CANONICAL_CLOSE', agents, /Closes #<Issue>/,
  'canonical PR close line missing');

requireMatch('AI_PUBLIC_CLASS', agents, /### Public-safe/,
  'public-safe data classification missing');
requireMatch('AI_PRIVATE_CLASS', agents, /### Private/,
  'private data classification missing');
requireMatch('AI_REAL_DERIVED_FORBIDDEN', agents, /real-derived/,
  'real-derived finance prohibition missing');
requireMatch('AI_NEVER_COMMIT', agents, /Never commit[\s\S]{0,1000}real transaction rows/i,
  'never-commit private finance rule missing');
requireMatch('AI_OAUTH_BACKUP_PRIVATE', agents, /OAuth[\s\S]{0,500}backup bytes[\s\S]{0,200}encryption keys/i,
  'credential/backup privacy rules missing');

requireMatch('AI_FREE_ONLY', agents, /FREE_ONLY is an executable invariant/i,
  'FREE_ONLY invariant missing');
requireMatch('AI_UNKNOWN_PROVIDER_FAIL_CLOSED', agents, /Unknown\/unconfigured billable provider fails closed/i,
  'unknown billable provider fail-closed rule missing');
requireMatch('AI_PAID_OVERAGE_FORBIDDEN', agents, /Automatic paid overage is forbidden/i,
  'automatic paid overage prohibition missing');

const gateOrder = /PR Validation[\s\S]*Trusted DEV Deploy[\s\S]*Trusted Runtime Health[\s\S]*CI-003 autonomous squash merge[\s\S]*Main Verification/;
requireMatch('AI_EXACT_GATE_CHAIN', agents, gateOrder,
  'canonical machine gate chain missing');
requireMatch('AI_EXACT_SHA', agents, /exact PR head SHA|exact candidate SHA|exact candidate/i,
  'exact candidate identity rule missing');
requireMatch('AI_DONE_MAIN_VERIFICATION', agents, /claim `DONE` only after Main Verification/i,
  'DONE must require Main Verification');

requireMatch('AI_FINANCIAL_WRITE_POLICY', agents,
  /Financial-write policy[\s\S]*idempotency[\s\S]*preconditions[\s\S]*readback[\s\S]*reconciliation[\s\S]*rollback/i,
  'financial write contract is incomplete');
requireMatch('AI_MIGRATION_POLICY', agents, /Full-history migration is not currently declared complete/i,
  'full-history migration status missing');
requireMatch('AI_MIGRATION_INVARIANTS', agents, /deterministic, resumable and idempotent[\s\S]*provenance/i,
  'migration invariants missing');

requireMatch('AI_NODE24', agents, /Node runtime:[^\n]*Node 24/i,
  'Node 24 reproducibility baseline missing');
requireMatch('AI_NPM_CI', agents, /package-lock\.json[\s\S]{0,120}npm ci/,
  'lockfile/npm ci rule missing');
requireMatch('AI_PINNED_ACTIONS', agents, /GitHub Actions remain pinned to immutable commit SHAs/i,
  'immutable Action pin rule missing');

requireMatch('AI_ADAPTER_BOUNDARY', agents, /Google adapter \| future YDB adapter/,
  'Google/future-YDB repository adapter boundary missing');
requireMatch('AI_STRANGLER', agents, /shadow\/dual-read\/compare\/canary\/strangler/i,
  'shadow/strangler migration rule missing');

requireMatch('AI_OBSERVABILITY_DOD', agents, /new failure mode[\s\S]{0,500}privacy-safe/i,
  'new-failure observability rule missing');
requireMatch('AI_DOC_ADR_DOD', agents, /Documentation \/ ADR rule/i,
  'documentation/ADR contract missing');
requireMatch('AI_DEFINITION_OF_DONE', agents, /Definition of Done[\s\S]*Main Verification[\s\S]*status: DONE/,
  'Definition of Done missing machine completion');
requireMatch('AI_CI_RED_RECOVERY', agents, /CI-red recovery[\s\S]*same active Roadmap branch\/PR[\s\S]*never bypass red CI/i,
  'CI-red recovery contract missing');

requireMatch('AI_CONTEXT_CURRENT_R0', context, /Current R0 truth/,
  'public-safe AI context lacks current R0 map');
requireMatch('AI_CONTEXT_PRIVATE_BOUNDARY', context, /Real or real-derived household finance data[\s\S]{0,200}stay private/i,
  'AI context private boundary missing');
requireMatch('AI_CONTEXT_GATE_CHAIN', context, gateOrder,
  'AI context machine chain drifted');
requireMatch('AI_CONTEXT_SCOPE_HANDOFF', context, /AIENG-001[\s\S]*AIENG-002[\s\S]*AIENG-003/,
  'AIENG scope handoff missing');

for (const required of [
  'AGENTS.md',
  '.ai-context/PROJECT_CONTEXT.md',
  'docs/PROJECT_STATUS.md',
  'docs/architecture.md',
  'docs/RELEASE_PROCESS.md',
  'docs/data-model.md'
]) {
  if (!llms.includes(required)) failures.push({ id: 'AI_LLMS_INDEX', message: `llms.txt missing ${required}` });
}

requireMatch('AI_STATUS_CONTRACT', status, /Root `AGENTS\.md` is the public-safe repository AI operating contract/,
  'PROJECT_STATUS must acknowledge root AI contract');
requireMatch('AI_STATUS_REMAINING_CHAIN', status, /AIENG-002[\s\S]*AIENG-003/,
  'PROJECT_STATUS must preserve remaining AIENG dependency chain');
requireMatch('AI_WORKFLOW_GATE', workflow, /- name: AI contract\s+run: node tools\/ai-contract-scan\.js/m,
  'PR Validation must run the named AI contract gate');

for (const [name, text] of [
  ['AGENTS.md', agents],
  ['.ai-context/PROJECT_CONTEXT.md', context],
  ['llms.txt', llms]
]) {
  forbidMatch('AI_PUBLIC_RUNTIME_LOCATOR', text, /script\.google\.com\/macros\/s\/|\bAKfy[A-Za-z0-9_-]+\b/,
    `${name} contains a private runtime/deployment locator`);
  forbidMatch('AI_OWNER_PRIVATE_PATH', text, /[A-Z]:\\(?:YandexDisk|PrihRashOnline-Keys|PrihRashOnline\\)/,
    `${name} contains an owner-private Windows path`);
}

if (failures.length) {
  for (const failure of failures) {
    process.stderr.write(`ai-contract: FAIL ${failure.id} ${failure.message}\n`);
  }
  process.exitCode = 1;
} else {
  console.log('ai-contract: PASS', {
    rootContract: true,
    autonomyContract: 'v2',
    privacySafeContext: true,
    freeOnly: true,
    exactMachineGates: true,
    financialWritePolicy: true,
    migrationPolicy: true,
    reproducibility: 'NODE24_LOCKED',
    adapterBoundary: 'GOOGLE_TO_FUTURE_YDB',
    ciRedRecovery: true
  });
}
