'use strict';

const fs = require('fs');
const path = require('path');
const { currentRoadmapWriters, branchRoadmapId } = require('../lib/testing/structured_contract_parsers');
const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const agents = read('AGENTS.md');
const context = read('.ai-context/PROJECT_CONTEXT.md');
const llms = read('llms.txt');
const roadmap = read('docs/ROADMAP.md');
const status = read('docs/PROJECT_STATUS.md');
const repositoryPort = read('docs/architecture/TRANSACTION_REPOSITORY_PORT.md');
const workflow = read('.github/workflows/pr-validation.yml');
const reviewContext = read('.ai-context/MULTI_AI_REVIEW_CONTEXT.md');
const reviewDoc = read('docs/operations/AIENG003_MULTI_AI_REVIEW_PROTOCOL.md');
const failures = [];

function requireMatch(id, text, pattern, message) {
  if (!pattern.test(text)) failures.push({ id, message });
}
function forbidMatch(id, text, pattern, message) {
  if (pattern.test(text)) failures.push({ id, message });
}
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const activeIds = currentRoadmapWriters(status);
const branchItem = branchRoadmapId(process.env);
const currentRoadmapItem = branchItem || (activeIds.length === 1 ? activeIds[0] : '');
if (activeIds.length !== 1) {
  failures.push({ id: 'AI_SINGLE_CURRENT_WRITER', message: `Expected exactly one documented IN_PROGRESS item, got ${activeIds.join(',') || 'none'}` });
}
if (branchItem && activeIds.length === 1 && branchItem !== activeIds[0]) {
  failures.push({ id: 'AI_BRANCH_CURRENT_WRITER', message: `Branch writer ${branchItem} != documented writer ${activeIds[0]}` });
}

requireMatch('AI_PRODUCT_OBJECTIVE', agents, /Product objective[\s\S]{0,800}household-finance/i, 'product objective missing');
requireMatch('AI_SOURCE_PRECEDENCE', agents, /Sources of truth and precedence[\s\S]{0,1800}fail closed/i, 'source precedence/fail-closed rule missing');
requireMatch('AI_CANONICAL_ROADMAP_REFERENCE', agents, /docs\/ROADMAP\.md[\s\S]{0,220}Executable GitHub Roadmap v2\.4/i, 'repository Roadmap v2.4 authority missing');
requireMatch('AI_CANONICAL_EXTERNAL_CONTEXT', agents, /Master Audit v2\.1[\s\S]{0,220}AI Development Playbook v1\.0/i, 'external canonical context missing');
requireMatch('AI_CANONICAL_ROADMAP_FILE', roadmap, /^# PrihRashOnline-v2 — Executable GitHub Roadmap v2\.4$/m, 'docs/ROADMAP.md is not v2.4');
requireMatch('AI_PRODUCT_LIFECYCLE', agents, /CODE_COMPLETE[\s\S]{0,500}RUNTIME_INTEGRATED[\s\S]{0,500}REAL_E2E_VERIFIED[\s\S]{0,500}PRODUCT_READY[\s\S]{0,500}DONE/i, 'product lifecycle missing');
requireMatch('AI_PRODUCT_E2E_GATE', agents, /user_facing[\s\S]{0,600}product-ready-e2e|product-ready-e2e[\s\S]{0,600}user_facing/i, 'user-facing Product E2E gate missing');
requireMatch('AI_AUTONOMY_V2', agents, /Autonomy Contract v2/, 'Autonomy Contract v2 missing');
requireMatch('AI_ONE_WRITER', agents, /one Roadmap ID = one GitHub Issue = one active writer/i, 'one-writer rule missing');
requireMatch('AI_BRANCH_RULE', agents, /agent\/<ROADMAP-ID>-<slug>/, 'branch convention missing');
requireMatch('AI_ISSUE_LIFECYCLE', agents, /IN_PROGRESS[\s\S]{0,1200}DONE/, 'Issue lifecycle missing');
requireMatch('AI_CANONICAL_CLOSE', agents, /Closes #<Issue>/, 'canonical close line missing');

requireMatch('AI_PUBLIC_CLASS', agents, /### Public-safe/, 'public-safe class missing');
requireMatch('AI_PRIVATE_CLASS', agents, /### Private/, 'private class missing');
requireMatch('AI_REAL_DERIVED_FORBIDDEN', agents, /real-derived/, 'real-derived prohibition missing');
requireMatch('AI_NEVER_COMMIT', agents, /Never commit[\s\S]{0,1200}real transaction rows/i, 'never-commit finance rule missing');
requireMatch('AI_OAUTH_BACKUP_PRIVATE', agents, /OAuth[\s\S]{0,700}backup bytes[\s\S]{0,250}encryption keys/i, 'credential/backup privacy rule missing');

requireMatch('AI_FREE_ONLY', agents, /`?FREE_ONLY`? is an executable invariant/i, 'FREE_ONLY invariant missing');
requireMatch('AI_UNKNOWN_PROVIDER_FAIL_CLOSED', agents, /Unknown\/unconfigured billable provider fails closed/i, 'unknown provider fail-closed missing');
requireMatch('AI_PAID_OVERAGE_FORBIDDEN', agents, /Automatic paid overage is forbidden/i, 'paid overage prohibition missing');

const gateOrder = /PR Validation[\s\S]*Trusted DEV Deploy[\s\S]*Trusted Runtime Health[\s\S]*CI-003 autonomous squash merge[\s\S]*Main Verification/;
requireMatch('AI_EXACT_GATE_CHAIN', agents, gateOrder, 'machine gate chain missing');
requireMatch('AI_EXACT_SHA', agents, /exact PR head SHA|exact candidate SHA|exact candidate/i, 'exact candidate identity missing');
requireMatch('AI_DONE_MAIN_VERIFICATION', agents, /claim `DONE_ENGINEERING`[^\n]*user-facing `DONE`[^\n]*Main Verification/i, 'stage-aware DONE/Main Verification rule missing');

const financial = (agents.match(/## 9\. Financial-write policy([\s\S]*?)(?=\n## 10\.|$)/i) || [,''])[1];
for (const [id, pattern] of [
  ['AI_FINANCIAL_WRITE_IDEMPOTENCY', /idempotency/i],
  ['AI_FINANCIAL_WRITE_PRECONDITIONS', /preconditions/i],
  ['AI_FINANCIAL_WRITE_READBACK', /readback/i],
  ['AI_FINANCIAL_WRITE_RECONCILIATION', /reconciliation/i],
  ['AI_FINANCIAL_WRITE_ROLLBACK', /rollback/i]
]) requireMatch(id, financial, pattern, `${id} missing`);
requireMatch('AI_MIGRATION_COMPLETED_POLICY', agents, /MIG-010[\s\S]{0,1000}OWNER_VERIFIED/i, 'completed MIG-010 policy/evidence boundary missing');
requireMatch('AI_MIGRATION_NEW_WRITE_REAUTH', agents, /новый irreversible write[\s\S]{0,220}нового exact-bound owner authorization/i, 'future migration reauthorization rule missing');
requireMatch('AI_MIGRATION_INVARIANTS', agents, /deterministic, resumable and idempotent[\s\S]*provenance/i, 'migration invariants missing');

requireMatch('AI_NODE24', agents, /Node runtime:[^\n]*Node 24/i, 'Node 24 baseline missing');
requireMatch('AI_NPM_CI', agents, /package-lock\.json[\s\S]{0,160}npm ci/, 'lockfile/npm ci missing');
requireMatch('AI_PINNED_ACTIONS', agents, /GitHub Actions remain pinned to immutable commit SHAs/i, 'immutable Action pins missing');
requireMatch('AI_ADAPTER_BOUNDARY', agents, /Google adapter \| future YDB adapter/, 'adapter boundary missing');
requireMatch('AI_STRANGLER', agents, /shadow\/dual-read\/compare\/canary\/strangler/i, 'strangler migration rule missing');
requireMatch('AI_OBSERVABILITY_DOD', agents, /new failure mode[\s\S]{0,600}privacy-safe/i, 'failure observability missing');
requireMatch('AI_DOC_ADR_DOD', agents, /Documentation \/ ADR rule/i, 'docs/ADR rule missing');
requireMatch('AI_DEFINITION_OF_DONE', agents, /Definition of Done[\s\S]*Main Verification[\s\S]*status: DONE/, 'DoD machine completion missing');
requireMatch('AI_CI_RED_RECOVERY', agents, /CI-red recovery[\s\S]*same active Roadmap branch\/PR[\s\S]*Never bypass red CI/i, 'CI-red recovery missing');

requireMatch('AI_MULTI_REVIEW_SECTION', agents, /Multi-AI review[\s\S]*READ_ONLY[\s\S]*writer_authority=false/i, 'multi-AI read-only contract missing');
requireMatch('AI_MULTI_REVIEW_ROLES', agents, /ARCHITECTURE[\s\S]*SECURITY_PRIVACY[\s\S]*FINANCIAL_DATA[\s\S]*TEST_OPERATIONS/, 'required review roles missing');
requireMatch('AI_MULTI_REVIEW_SEVERITY', agents, /P0\/P1[\s\S]{0,140}BLOCKED[\s\S]{0,180}P2\/P3[\s\S]{0,100}advisory/i, 'review severity policy missing');
requireMatch('AI_MULTI_REVIEW_ARBITRATION', agents, /не голосование моделей|not model voting/i, 'review arbitration rule missing');
requireMatch('AI_MULTI_REVIEW_SUPPLEMENTARY', agents, /supplementary evidence[\s\S]{0,320}(?:не отменяет|never override|никогда не отменяет)/i, 'review must remain supplementary');

requireMatch('AI_CONTEXT_ROADMAP', context, /docs\/ROADMAP\.md[\s\S]{0,160}Executable GitHub Roadmap v2\.4/i, 'AI context Roadmap v2.4 authority missing');
requireMatch('AI_CONTEXT_RECOVERY', context, /R2R[\s\S]{0,800}MASTER-GUX/i, 'AI context Product Recovery scope missing');
requireMatch('AI_CONTEXT_CURRENT_R0', context, /Current R0 truth/, 'AI context current R0 section missing');
requireMatch('AI_CONTEXT_PRIVATE_BOUNDARY', context, /Real or real-derived household finance data[\s\S]{0,220}(?:stays|stay) private/i, 'AI context private boundary missing');
requireMatch('AI_CONTEXT_GATE_CHAIN', context, gateOrder, 'AI context machine chain drifted');
requireMatch('AI_CONTEXT_SCOPE_HANDOFF', context, /AIENG-001[\s\S]*AIENG-002[\s\S]*AIENG-003/, 'AIENG scope handoff missing');
requireMatch('AI_CONTEXT_MULTI_REVIEW', context, /Read-only multi-AI review[\s\S]*ARCHITECTURE[\s\S]*TEST_OPERATIONS/, 'AI context review map missing');
requireMatch('AI_CONTEXT_ARCH010_DONE', context, /ARCH-010[^\n]{0,180}DONE[^\n]{0,180}Issue #89/i, 'AI context must identify ARCH-010 as DONE with Main Verification issue');
requireMatch('AI_CONTEXT_ARCH011_DONE', context, /ARCH-011[^\n]{0,220}DONE/i, 'AI context must identify ARCH-011 as DONE');
requireMatch('AI_CONTEXT_MIG010_DONE', context, /MIG-010[^\n]{0,220}DONE/i, 'AI context must identify MIG-010 as DONE');
if (currentRoadmapItem) {
  const escaped = escapeRegExp(currentRoadmapItem);
  requireMatch('AI_CONTEXT_CURRENT_WRITER', context,
    new RegExp(escaped + '.*(?:current|текущ).*writer', 'i'),
    `AI context must identify ${currentRoadmapItem} as current writer`);
}
requireMatch('AI_CONTEXT_REPOSITORY_PORT', context, /PRH_TRANSACTION_REPOSITORY_V1[\s\S]{0,1800}GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED/i, 'AI context repository port/write boundary missing');

requireMatch('AI_REPOSITORY_PORT_SCHEMA', repositoryPort, /PRH_TRANSACTION_REPOSITORY_V1/, 'repository port machine schema missing');
requireMatch('AI_REPOSITORY_PORT_CANONICAL', repositoryPort, /PRH_CANONICAL_TRANSACTION_V1/, 'repository port canonical binding missing');
requireMatch('AI_REPOSITORY_PORT_WRITE_BLOCKED', repositoryPort, /GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED/, 'repository port Google write fail-closed rule missing');

requireMatch('AI_REVIEW_CONTEXT_READ_ONLY', reviewContext, /READ_ONLY[\s\S]*writer_authority/i, 'review context not read-only');
requireMatch('AI_REVIEW_DOC_MACHINE_AUTHORITY', reviewDoc, /supplementary evidence[\s\S]*Main Verification/i, 'review doc machine authority missing');

for (const required of [
  'AGENTS.md', 'docs/ROADMAP.md', '.ai-context/PROJECT_CONTEXT.md', '.ai-context/roadmap-task-packet.schema.json',
  '.ai-context/MULTI_AI_REVIEW_CONTEXT.md', '.ai-context/multi-ai-review-packet.schema.json',
  '.ai-context/multi-ai-review-report.schema.json', 'docs/operations/AIENG003_MULTI_AI_REVIEW_PROTOCOL.md',
  'docs/PROJECT_STATUS.md', 'docs/architecture.md', 'docs/architecture/TRANSACTION_REPOSITORY_PORT.md',
  'lib/repository/transaction_repository.v1.json', 'tests/repository_adapter_contract_test.js',
  'docs/RELEASE_PROCESS.md', 'docs/data-model.md'
]) {
  if (!llms.includes(required)) failures.push({ id: 'AI_LLMS_INDEX', message: `llms.txt missing ${required}` });
}

requireMatch('AI_STATUS_CONTRACT', status,
  /Root `AGENTS\.md` is the public-safe repository AI operating contract|Root `AGENTS\.md`[^\n]{0,80}public-safe[^\n]{0,80}(?:AI|ИИ)/i,
  'PROJECT_STATUS must acknowledge root AI contract');
requireMatch('AI_STATUS_CHAIN', status, /AIENG-001[\s\S]*AIENG-002[\s\S]*AIENG-003/, 'PROJECT_STATUS AIENG chain missing');
requireMatch('AI_STATUS_ARCH010_DONE', status, /ARCH-010[^\n]{0,180}DONE/i, 'PROJECT_STATUS must identify ARCH-010 as DONE');
requireMatch('AI_STATUS_ARCH011_DONE', status, /ARCH-011[^\n]{0,220}DONE/i, 'PROJECT_STATUS must identify ARCH-011 as DONE');
requireMatch('AI_STATUS_MIG010_DONE', status, /MIG-010[^\n]{0,260}DONE/i, 'PROJECT_STATUS must identify MIG-010 as DONE');
if (currentRoadmapItem) {
  const escaped = escapeRegExp(currentRoadmapItem);
  requireMatch('AI_STATUS_CURRENT_WRITER', status,
    new RegExp('^- .*' + escaped + '.*\\*\\*IN_PROGRESS\\*\\*', 'mi'),
    `PROJECT_STATUS must identify ${currentRoadmapItem} as the active R1 item`);
}
requireMatch('AI_STATUS_REPOSITORY_WRITE_BLOCKED', status, /GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED/, 'PROJECT_STATUS must preserve fail-closed Google repository write');
requireMatch('AI_WORKFLOW_GATE', workflow, /- name: AI contract\s+run: node tools\/ai-contract-scan\.js/m, 'AI contract PR gate missing');
requireMatch('AI_WORKFLOW_TASK_GATE', workflow, /- name: Roadmap task protocol\s+run: node tests\/roadmap_task_protocol_contract_test\.js/m, 'Roadmap task PR gate missing');
requireMatch('AI_WORKFLOW_REVIEW_GATE', workflow, /- name: Multi-AI review protocol\s+run: node tests\/multi_ai_review_protocol_contract_test\.js/m, 'Multi-AI review PR gate missing');
requireMatch('AI_WORKFLOW_REPOSITORY_GATE', workflow, /- name: Transaction repository adapter\s+run: node tests\/repository_adapter_contract_test\.js/m, 'Transaction repository adapter PR gate missing');

for (const [name, text] of [
  ['AGENTS.md', agents], ['.ai-context/PROJECT_CONTEXT.md', context], ['llms.txt', llms],
  ['.ai-context/MULTI_AI_REVIEW_CONTEXT.md', reviewContext]
]) {
  forbidMatch('AI_STALE_ROADMAP_REFERENCE', text, /Executable GitHub Roadmap v2\.(?:1|2|3)\b/i, `${name} contains stale Roadmap authority`);
  forbidMatch('AI_PUBLIC_RUNTIME_LOCATOR', text, /script\.google\.com\/macros\/s\/|\bAKfy[A-Za-z0-9_-]+\b/, `${name} contains runtime locator`);
  forbidMatch('AI_OWNER_PRIVATE_PATH', text, /[A-Z]:\\(?:YandexDisk|PrihRashOnline-Keys|PrihRashOnline(?:\\|$))/i, `${name} contains owner-private path`);
}

if (failures.length) {
  for (const failure of failures) process.stderr.write(`ai-contract: FAIL ${failure.id} ${failure.message}\n`);
  process.exitCode = 1;
} else {
  console.log('ai-contract: PASS', {
    roadmap: 'repository-v2.4',
    autonomyContract: 'v2',
    privacySafeContext: true,
    currentRoadmapItem,
    repositoryPort: 'PRH_TRANSACTION_REPOSITORY_V1',
    mig010: 'DONE_OWNER_VERIFIED',
    googleCanonicalWriteAuthorized: false,
    freeOnly: true,
    exactMachineGates: true,
    roadmapTaskProtocol: true,
    multiAiReview: 'READ_ONLY_EXACT_CANDIDATE',
    reviewerWriterAuthority: false
  });
}
