'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const status = read('docs/PROJECT_STATUS.md');
const context = read('.ai-context/PROJECT_CONTEXT.md');
const architecture = read('docs/architecture.md');
const canonicalDoc = read('docs/data/CANONICAL_TRANSACTION_SCHEMA.md');
const occurrenceAdr = read('docs/adr/ADR-MIG-010-OCCURRENCE-IDENTITY.md');
const runbook = read('docs/operations/MIG010_FULL_HISTORY_MIGRATION.md');
const repairRunbook = read('docs/operations/MIG010_REPAIR_POLICY.md');
const llms = read('llms.txt');
const workflow = read('.github/workflows/pr-validation.yml');
const ownerTool = read('tools/mig010-owner.js');
const repairTool = read('tools/mig010-repair.js');
const contract = JSON.parse(read('lib/migration/full_history_migration.v1.json'));
const repairPolicy = JSON.parse(read('lib/migration/mig010_repair_policy.v1.json'));
const canonicalSchema = JSON.parse(read('lib/domain/canonical_transaction.v1.schema.json'));

function match(text, pattern, message) {
  assert(pattern.test(text), message);
}

match(status, /ARCH-011[^\n]{0,220}\*\*DONE\*\*|ARCH-011[^\n]{0,220}DONE/i,
  'ARCH-011 must be DONE in current status');
match(status, /MIG-010[^\n]{0,220}\*\*IN_PROGRESS\*\*|MIG-010[^\n]{0,220}IN_PROGRESS/i,
  'MIG-010 must be current IN_PROGRESS item');
match(status, /Private full-history migration[^\n]{0,180}(?:не выполнена|not)/i,
  'status must not claim owner-private migration complete');
match(status, /IRREVERSIBLE_ACTION_AUTHORIZED/,
  'status must expose separate irreversible-action boundary');
match(status, /CONTENT_FINGERPRINT_OCCURRENCE_V1/,
  'status must expose occurrence identity capability without private resolution payload');

match(context, /MIG-010[^\n]{0,180}current P0 writer[^\n]{0,120}Issue #96/i,
  'AI context must identify current MIG-010 writer');
match(context, /ARCH-011[^\n]{0,180}(?:now DONE|DONE)/i,
  'AI context must preserve ARCH-011 completion');
match(context, /GitHub Actions[^\n]{0,220}cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`/i,
  'AI context must deny autonomous irreversible authorization');
match(context, /CONTENT_FINGERPRINT_OCCURRENCE_V1/,
  'AI context must expose owner-confirmed occurrence identity capability');

match(architecture, /PRH_FULL_HISTORY_MIGRATION_V1/,
  'architecture must identify migration machine contract');
match(architecture, /Current write authority = false/i,
  'architecture must keep current real-write authority false');
match(architecture, /MIGRATION_IRREVERSIBLE_ACTION_TOOL_NOT_ENABLED/,
  'architecture must expose disabled real-write command');

match(canonicalDoc, /CONTENT_FINGERPRINT_OCCURRENCE_V1/,
  'canonical documentation must define occurrence identity strategy');
match(canonicalDoc, /owner-confirmed/i,
  'occurrence identity must be owner-confirmed, not heuristic');
match(canonicalDoc, /schema_version[^\n]{0,120}(?:остаётся|1)/i,
  'canonical documentation must preserve schema version 1');
match(occurrenceAdr, /CONTENT_FINGERPRINT_OCCURRENCE_V1/,
  'occurrence identity ADR must name the strategy');
match(occurrenceAdr, /write authority: false/i,
  'occurrence identity ADR must keep write authority false');
match(occurrenceAdr, /AI\/CI[^\n]{0,180}PRESERVE_ALL/i,
  'occurrence ADR must deny AI/CI owner decision authority');

match(runbook, /CODE_READY[\s\S]{0,700}OWNER_PRIVATE_SNAPSHOT[\s\S]{0,700}OWNER_DRY_RUN[\s\S]{0,700}AUTHORIZATION_REQUIRED[\s\S]{0,700}PRIVATE_RECONCILIATION/,
  'runbook migration state machine missing');
match(runbook, /OWNER_PRIVATE_DIAGNOSTICS/,
  'runbook must expose blocked owner-private diagnostics path');
match(runbook, /MIG010_OWNER_PRIVATE_DIAGNOSTIC_V1/,
  'runbook must identify private diagnostic schema');
match(runbook, /detailedFindingsStdout=false/,
  'runbook must keep detailed diagnostic findings out of stdout');
match(runbook, /owner tool[^\n]{0,240}(?:не содержит[^\n]{0,120}(?:write|команд)|write[^\n]{0,120}(?:disabled|выключ|не содержит))/i,
  'runbook must keep owner tool write disabled');
match(runbook, /private mapper/i,
  'runbook must identify private mapper');
match(runbook, /вне Git repository/i,
  'runbook must keep owner-private files outside repository');
match(runbook, /unexplainedMismatch = 0/,
  'runbook must require zero unexplained mismatch');

match(repairRunbook, /MIG010_REPAIR_POLICY_V1@1\.1\.0/,
  'repair runbook must identify current versioned repair policy');
match(repairRunbook, /REBUILD_LEGACY_SLICE_V1/,
  'repair runbook must define scoped legacy rebuild strategy');
match(repairRunbook, /SOURCE_INVALID -> QUARANTINE_EXPLAINED/,
  'invalid source must be quarantined rather than silently lost');
match(repairRunbook, /DEDUPLICATE_KEEP_ONE[\s\S]{0,1000}PRESERVE_ALL[\s\S]{0,1000}UNRESOLVED/,
  'repair runbook must expose bounded duplicate owner decisions');
match(repairRunbook, /PRESERVE_ALL[\s\S]{0,900}CONTENT_FINGERPRINT_OCCURRENCE_V1/,
  'preserve-all duplicate decision must use occurrence-aware identity');
match(repairRunbook, /не имеют права автоматически выбирать `DEDUPLICATE_KEEP_ONE` или `PRESERVE_ALL`/,
  'AI/CI must not decide financial duplicate semantics');
match(repairRunbook, /write_authority: false/,
  'repair stage must have no write authority');

assert.strictEqual(contract.schema, 'PRH_FULL_HISTORY_MIGRATION_V1');
assert.strictEqual(contract.batch.max_size, 100);
assert.strictEqual(contract.resume.integrity, 'HMAC-SHA256');
assert.strictEqual(contract.pre_write.authorization, 'IRREVERSIBLE_ACTION_AUTHORIZED');
assert.strictEqual(contract.pre_write.public_ci_can_authorize_real_write, false);
assert.strictEqual(contract.reconciliation.required_unexplained_mismatch, 0);

assert.strictEqual(repairPolicy.schema, 'MIG010_REPAIR_POLICY_V1');
assert.strictEqual(repairPolicy.version, '1.1.0');
assert.strictEqual(repairPolicy.strategy, 'REBUILD_LEGACY_SLICE_V1');
assert.strictEqual(repairPolicy.source_invalid.action, 'QUARANTINE_EXPLAINED');
assert.strictEqual(repairPolicy.source_duplicate.action, 'OWNER_DECISION_REQUIRED');
assert.strictEqual(repairPolicy.source_duplicate.preserve_all_identity_strategy, 'CONTENT_FINGERPRINT_OCCURRENCE_V1');
assert.strictEqual(repairPolicy.source_duplicate.public_ci_can_decide, false);
assert.strictEqual(repairPolicy.write_authority, false);
assert(canonicalSchema.properties.provenance.properties.identity_strategy.enum.includes('CONTENT_FINGERPRINT_OCCURRENCE_V1'));

match(ownerTool, /writeCommandEnabled:\s*false/,
  'owner tool contract must advertise write disabled');
match(ownerTool, /privateDiagnostics:\s*true/,
  'owner tool contract must advertise private diagnostics');
match(ownerTool, /MIG010_OWNER_PRIVATE_DIAGNOSTIC_V1/,
  'owner tool must define private diagnostic schema');
match(ownerTool, /detailedFindingsStdout:\s*false/,
  'owner diagnostic stdout must exclude detailed findings');
match(ownerTool, /MIGRATION_IRREVERSIBLE_ACTION_TOOL_NOT_ENABLED/,
  'owner tool must fail closed on write command');
match(ownerTool, /MIG010_PRIVATE_MAPPER_INSIDE_REPOSITORY/,
  'owner tool must reject private mapper inside repository');
match(ownerTool, /MIG010_PRIVATE_DIAGNOSTIC_INSIDE_REPOSITORY/,
  'owner tool must reject private diagnostic output inside repository');
match(ownerTool, /MIG010_SNAPSHOT_BACKUP_MISMATCH/,
  'owner tool must bind snapshot to backup evidence');

match(repairTool, /offlineDuplicateReview:\s*true/,
  'repair tool contract must advertise offline duplicate review');
match(repairTool, /preserveAllOccurrenceIdentity:\s*OCCURRENCE_IDENTITY/,
  'repair tool contract must advertise occurrence-aware preserve-all');
match(repairTool, /writeCommandEnabled:\s*false/,
  'repair tool contract must keep write disabled');
match(repairTool, /MIGRATION_IRREVERSIBLE_ACTION_TOOL_NOT_ENABLED/,
  'repair tool write commands must fail closed');
match(repairTool, /financialPayloadStdout:\s*false/,
  'repair tool stdout must exclude financial payload');

match(workflow, /- name: Full-history migration protocol[\s\S]{0,1500}mig010_occurrence_identity_contract_test\.js[\s\S]{0,700}mig010_repair_policy_contract_test\.js[\s\S]{0,700}mig010_repair_tool_contract_test\.js[\s\S]{0,700}mig010_documentation_contract_test\.js/m,
  'PR Validation must have named migration occurrence + repair gate');

for (const required of [
  'docs/data/CANONICAL_TRANSACTION_SCHEMA.md',
  'docs/adr/ADR-MIG-010-OCCURRENCE-IDENTITY.md',
  'docs/operations/MIG010_FULL_HISTORY_MIGRATION.md',
  'docs/operations/MIG010_REPAIR_POLICY.md',
  'lib/migration/full_history_migration.v1.json',
  'lib/migration/full_history_migration.js',
  'lib/migration/mig010_repair_policy.v1.json',
  'lib/migration/mig010_repair_policy.js',
  'tests/full_history_migration_contract_test.js',
  'tests/mig010_occurrence_identity_contract_test.js',
  'tools/mig010-owner.js',
  'tools/mig010-repair.js',
  'tests/mig010_owner_tool_contract_test.js',
  'tests/mig010_owner_diagnostics_contract_test.js',
  'tests/mig010_repair_policy_contract_test.js',
  'tests/mig010_repair_tool_contract_test.js'
]) {
  assert(llms.includes(required), `llms.txt missing ${required}`);
}

for (const [name, text] of [
  ['status', status], ['context', context], ['architecture', architecture],
  ['canonicalDoc', canonicalDoc], ['occurrenceAdr', occurrenceAdr],
  ['runbook', runbook], ['repairRunbook', repairRunbook], ['llms', llms]
]) {
  assert(!/script\.google\.com\/macros\/s\/|\bAKfy[A-Za-z0-9_-]+\b/.test(text), `${name} contains private runtime locator`);
  assert(!/[A-Z]:\\(?:YandexDisk|PrihRashOnline-Keys|PrihRashOnline(?:\\|$))/i.test(text), `${name} contains owner-private path`);
}

console.log('mig010_documentation_contract_test: OK', {
  currentWriter: 'MIG-010',
  arch011: 'DONE',
  realWriteAuthority: false,
  publicCiCanAuthorizeWrite: false,
  privatePathsOutsideRepository: true,
  privateDiagnostics: true,
  repairPolicy: 'MIG010_REPAIR_POLICY_V1@1.1.0',
  duplicateOwnerDecision: true,
  preserveAllOccurrenceIdentity: true,
  occurrenceIdentityStrategy: 'CONTENT_FINGERPRINT_OCCURRENCE_V1',
  detailedFindingsStdout: false,
  unexplainedMismatchRequired: 0
});
