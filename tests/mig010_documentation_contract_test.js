'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseProjectStatusEntries, currentRoadmapWriters } = require('../lib/testing/structured_contract_parsers');

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
const rebuildTool = read('tools/mig010-rebuild-dry-run.js');
const contract = JSON.parse(read('lib/migration/full_history_migration.v1.json'));
const repairPolicy = JSON.parse(read('lib/migration/mig010_repair_policy.v1.json'));
const canonicalSchema = JSON.parse(read('lib/domain/canonical_transaction.v1.schema.json'));

function match(text, pattern, message) {
  assert(pattern.test(text), message);
}
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const statusEntries = parseProjectStatusEntries(status);
const statusById = new Map(statusEntries.map((entry) => [entry.id, entry.lifecycle]));
const currentWriters = currentRoadmapWriters(status);
assert.strictEqual(statusById.get('ARCH-011'), 'DONE', 'ARCH-011 must be DONE in current status');
assert.strictEqual(statusById.get('MIG-010'), 'DONE', 'MIG-010 must be DONE after Main Verification');
assert.strictEqual(currentWriters.length, 1, 'status must expose exactly one active successor writer');
assert.notStrictEqual(currentWriters[0], 'MIG-010', 'completed MIG-010 must not remain current writer');
const currentWriter = currentWriters[0];

match(status, /MIG-010[^\n]{0,360}OWNER_VERIFIED/i,
  'status must preserve owner-private verified evidence');
match(status, /MIG010_OWNER_POST_RECONCILIATION_V1|post-write reconciliation/i,
  'status must preserve completed private reconciliation evidence');
match(status, /unexplainedMismatch=0/,
  'status must preserve zero unexplained mismatch evidence');
match(status, /IRREVERSIBLE_ACTION_AUTHORIZED/,
  'status must expose separate irreversible-action boundary');
match(status, /CONTENT_FINGERPRINT_OCCURRENCE_V1/,
  'status must expose occurrence identity capability without private resolution payload');

match(context, /MIG-010[^\n]{0,220}DONE/i,
  'AI context must preserve MIG-010 completion');
match(context, /private stage `OWNER_VERIFIED`|OWNER_VERIFIED/i,
  'AI context must preserve owner-verified private stage');
match(context, new RegExp(`${escapeRegExp(currentWriter)}[^\\n]{0,240}(?:current|writer|IN_PROGRESS)`, 'i'),
  'AI context must identify the same current writer as structured project status');
match(context, /ARCH-011[^\n]{0,180}DONE/i,
  'AI context must preserve ARCH-011 completion');
match(context, /GitHub Actions[^\n]{0,220}cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`/i,
  'AI context must deny autonomous irreversible authorization');
match(context, /CONTENT_FINGERPRINT_OCCURRENCE_V1/,
  'AI context must expose owner-confirmed occurrence identity capability');

match(architecture, /PRH_FULL_HISTORY_MIGRATION_V1/,
  'architecture must identify migration machine contract');
match(architecture, /Current write authority = false/i,
  'architecture must keep generic current write authority false');
match(architecture, /owner-verified MIG-010 private full-history reconciliation/i,
  'architecture must record verified private reconciliation');

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

match(runbook, /CODE_READY[\s\S]{0,1500}OWNER_PRIVATE_SNAPSHOT[\s\S]{0,1500}OWNER_DRY_RUN[\s\S]{0,1500}RESOLVED_REBUILD_DRY_RUN[\s\S]{0,1500}AUTHORIZATION_REQUIRED[\s\S]{0,1500}PRIVATE_RECONCILIATION/,
  'runbook migration/repair/rebuild state machine missing');
match(runbook, /OWNER_PRIVATE_DIAGNOSTICS/,
  'runbook must expose blocked owner-private diagnostics path');
match(runbook, /MIG010_OWNER_PRIVATE_DIAGNOSTIC_V1/,
  'runbook must identify private diagnostic schema');
match(runbook, /tools\/mig010-rebuild-dry-run\.js verify/,
  'runbook must require resolved rebuild dry-run');
match(runbook, /proposal policy `1\.0\.0` или `1\.1\.0`/,
  'runbook must document bounded previous proposal compatibility');
match(runbook, /detailedFindingsStdout=false/,
  'runbook must keep detailed diagnostic findings out of stdout');
match(runbook, /owner\/repair\/rebuild tools[^\n]{0,240}не содержат активной команды write/i,
  'runbook must keep owner/repair/rebuild tools write disabled');
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
match(repairRunbook, /MIG010_REPAIR_POLICY_V1@1\.0\.0[\s\S]{0,500}MIG010_REPAIR_POLICY_V1@1\.1\.0/,
  'repair runbook must document exact previous/current proposal compatibility');
match(repairRunbook, /MIG010_REPAIR_PROPOSAL_POLICY_INCOMPATIBLE/,
  'unknown proposal policy version must fail closed');
match(repairRunbook, /tools\/mig010-rebuild-dry-run\.js verify/,
  'repair runbook must require rebuild verification after resolve');
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

match(rebuildTool, /schema:\s*'MIG010_REBUILD_DRY_RUN_TOOL_V1'/,
  'rebuild tool must expose versioned contract');
match(rebuildTool, /exactResolvedBinding:\s*true/,
  'rebuild tool must verify exact resolved binding');
match(rebuildTool, /canonicalValidation:\s*true/,
  'rebuild tool must revalidate canonical candidate');
match(rebuildTool, /migrationFingerprintParity:\s*true/,
  'rebuild tool must validate migration fingerprint parity');
match(rebuildTool, /writeCommandEnabled:\s*false/,
  'rebuild verifier must keep write disabled');
match(rebuildTool, /MIGRATION_IRREVERSIBLE_ACTION_TOOL_NOT_ENABLED/,
  'rebuild tool write commands must fail closed');
match(rebuildTool, /financialPayloadStdout:\s*false/,
  'rebuild stdout must exclude financial payload');

match(workflow, /- name: Full-history migration protocol[\s\S]{0,2600}mig010_occurrence_identity_contract_test\.js[\s\S]{0,900}mig010_repair_policy_contract_test\.js[\s\S]{0,900}mig010_repair_policy_compatibility_contract_test\.js[\s\S]{0,900}mig010_repair_tool_contract_test\.js[\s\S]{0,900}mig010_rebuild_dry_run_contract_test\.js[\s\S]{0,900}mig010_documentation_contract_test\.js/m,
  'PR Validation must preserve named historical migration regression gate');

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
  'tests/mig010_repair_policy_compatibility_contract_test.js',
  'tools/mig010-owner.js',
  'tools/mig010-repair.js',
  'tools/mig010-rebuild-dry-run.js',
  'tests/mig010_owner_tool_contract_test.js',
  'tests/mig010_owner_diagnostics_contract_test.js',
  'tests/mig010_repair_policy_contract_test.js',
  'tests/mig010_repair_tool_contract_test.js',
  'tests/mig010_rebuild_dry_run_contract_test.js'
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
  lifecycle: 'DONE',
  successorWriter: currentWriter,
  structuredLifecycleState: true,
  ownerPrivateStage: 'OWNER_VERIFIED',
  arch011: 'DONE',
  genericRealWriteAuthority: false,
  publicCiCanAuthorizeWrite: false,
  privatePathsOutsideRepository: true,
  privateDiagnostics: true,
  repairPolicy: 'MIG010_REPAIR_POLICY_V1@1.1.0',
  compatibleProposalPolicies: ['1.0.0', '1.1.0'],
  duplicateOwnerDecision: true,
  preserveAllOccurrenceIdentity: true,
  occurrenceIdentityStrategy: 'CONTENT_FINGERPRINT_OCCURRENCE_V1',
  resolvedRebuildDryRun: true,
  privateMigrationVerified: true,
  detailedFindingsStdout: false,
  unexplainedMismatchRequired: 0
});
