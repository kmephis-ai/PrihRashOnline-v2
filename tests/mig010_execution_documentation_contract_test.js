'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const status = read('docs/PROJECT_STATUS.md');
const context = read('.ai-context/PROJECT_CONTEXT.md');
const runbook = read('docs/operations/MIG010_AUTHORIZED_EXECUTION.md');
const llms = read('llms.txt');
const packageTool = read('tools/mig010-execution-package.js');
const gateway = read('Mig010ExecutionGateway.js');
const typedWriter = read('Mig010ExecutionTypedWrite.js');
const executor = read('tools/mig010-authorized-executor.js');
const post = read('tools/mig010-post-reconcile.js');
const genericGateway = read('GoogleTransactionRepositoryGateway.js');
const policy = JSON.parse(read('lib/migration/mig010_execution_policy.v1.json'));

function match(text, pattern, message) { assert(pattern.test(text), message); }

match(status, /MIG-010[^\n]{0,300}DONE[^\n]{0,300}OWNER_VERIFIED/i,
  'project status must preserve completed OWNER_VERIFIED MIG lifecycle');
match(status, /post-write reconciliation[^\n]{0,160}PASS/i,
  'status must record private post-write reconciliation PASS');
match(status, /unexplainedMismatch=0/,
  'status must record zero unexplained mismatch');
match(status, /ANL-010[^\n]{0,260}IN_PROGRESS/i,
  'status must identify successor Roadmap writer');

match(context, /MIG-010[^\n]{0,220}DONE/i,
  'AI context must preserve MIG completion');
match(context, /OWNER_VERIFIED/,
  'AI context must preserve private verified evidence');
match(context, /MIG010_EXECUTION_POLICY_V1@1\.0\.0/,
  'AI context must identify execution policy');
match(context, /FINALIZED_PENDING_RECONCILIATION|post-write reconciliation/i,
  'AI context must preserve finalize/reconciliation boundary');
match(context, /Generic|generic[\s\S]{0,300}GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED/i,
  'AI context must keep generic repository write blocked');

assert.strictEqual(policy.schema, 'MIG010_EXECUTION_POLICY_V1');
assert.strictEqual(policy.version, '1.0.0');
assert.strictEqual(policy.strategy, 'STAGE_VERIFY_REPLACE_WITH_ROLLBACK_V1');
assert.strictEqual(policy.authorization, 'IRREVERSIBLE_ACTION_AUTHORIZED');
assert.strictEqual(policy.batch.max_rows, 100);
assert.strictEqual(policy.batch.readback_required, true);
assert.strictEqual(policy.mutation.rollback_copy_required, true);
assert.strictEqual(policy.mutation.staging_sheet_required, true);
assert.strictEqual(policy.mutation.rollback_on_finalize_failure, true);
assert.strictEqual(policy.public_ci_can_authorize_real_write, false);
assert.strictEqual(policy.write_authority_default, false);

match(runbook, /EXECUTION_PACKAGE[\s\S]{0,900}AUTHORIZATION_REQUEST[\s\S]{0,900}AUTHORIZATION_REQUIRED[\s\S]{0,1600}STAGING[\s\S]{0,1600}POST-WRITE RECONCILIATION/,
  'authorized execution runbook state machine incomplete');
match(runbook, /IRREVERSIBLE_ACTION_AUTHORIZED/,
  'runbook must require literal irreversible authorization');
match(runbook, /manifest\.createdAt[\s\S]{0,260}24 часов/i,
  'runbook must enforce creation age of encrypted backup copy');
match(runbook, /MIG010_EXECUTOR_BACKUP_COPY_STALE/,
  'runbook must expose stale-copy reason');
match(runbook, /backup_created_at[\s\S]{0,500}backup_verified_at/,
  'runbook must bind backup timestamps separately');
match(runbook, /hidden rollback copy/i,
  'runbook must require rollback copy');
match(runbook, /hidden staging/i,
  'runbook must require staging');
match(runbook, /<=100|не превышает 100|максимум 100/i,
  'runbook must bound batches to 100');
match(runbook, /SpreadsheetApp\.flush\(\)[\s\S]{0,160}readback hash/i,
  'runbook must require staging readback');
match(runbook, /adaptive existing-format-first/i,
  'runbook must document adaptive type preservation');
match(runbook, /contentsOnly:true[\s\S]{0,220}formulas/i,
  'runbook must document formula-preserving finalize/rollback semantics');
match(runbook, /FINALIZED_PENDING_RECONCILIATION/,
  'runbook must preserve finalize boundary');
match(runbook, /OWNER_VERIFIED/,
  'runbook must record verified owner execution');
match(runbook, /unexplainedMismatch = 0/,
  'runbook must require zero unexplained mismatch');

match(packageTool, /writeCommandEnabled:\s*false/,
  'execution-package builder must not have write command');
match(packageTool, /retainNonScopedTargetRows:\s*true/,
  'package builder must retain non-scoped target rows');
match(packageTool, /formulaLikeTextFailClosed:\s*true/,
  'package builder must fail closed on formula-like source text');

for (const pattern of [
  /prhMig010BeginAuthorizedExecution/,
  /prhMig010WriteAuthorizedBatch/,
  /prhMig010FinalizeAuthorizedExecution/,
  /prhMig010RollbackAuthorizedExecution/,
  /MIG010_EXECUTION_TARGET_CHANGED_SINCE_BACKUP/,
  /MIG010_EXECUTION_BACKUP_COPY_STALE/,
  /MIG010_EXECUTION_BACKUP_VERIFICATION_STALE/,
  /MIG010_EXECUTION_BATCH_READBACK_MISMATCH/,
  /prhMig010RestoreFromRollback_/,
  /fresh_backup_copy_required:\s*true/,
  /fresh_backup_verification_required:\s*true/,
  /generic_repository_write_authorized:\s*false/
]) assert(pattern.test(gateway), `gateway contract missing ${pattern}`);

match(typedWriter, /MIG010_TYPED_STAGING_WRITE_V2/,
  'typed writer must expose adaptive v2 contract');
match(typedWriter, /adaptiveExistingFormatFirst:\s*true/,
  'typed writer must prefer existing formats when exact');
match(typedWriter, /explicitStringTypePreservation:\s*true/,
  'typed writer must preserve strings');
match(typedWriter, /explicitDateTypePreservation:\s*true/,
  'typed writer must preserve dates');
match(typedWriter, /exactReadbackStillRequired:\s*true/,
  'typed writer must keep exact readback mandatory');
match(typedWriter, /genericRepositoryWriteAuthorized:\s*false/,
  'typed writer must not grant generic authority');

match(executor, /MIG010_OWNER_IRREVERSIBLE_AUTHORIZATION_V1/,
  'executor must require private authorization schema');
match(executor, /IRREVERSIBLE_ACTION_AUTHORIZED/,
  'executor must require literal owner authorization');
match(executor, /MAX_BACKUP_AGE_MS = 24 \* 60 \* 60 \* 1000/,
  'executor must enforce fresh backup');
match(executor, /MIG010_EXECUTOR_BACKUP_COPY_STALE/,
  'executor must reject old backup copy independently of verify time');
match(executor, /freshEncryptedBackupCopyRequired:\s*true/,
  'executor must advertise fresh backup-copy requirement');
match(executor, /freshEncryptedBackupVerifyRequired:\s*true/,
  'executor must advertise fresh verification requirement');
match(executor, /publicCiCanAuthorize:\s*false/,
  'executor must deny public CI authorization');
match(executor, /FINALIZED_PENDING_RECONCILIATION/,
  'executor must stop at pending reconciliation');
match(executor, /financialPayloadStdout:\s*false/,
  'executor must not expose financial payload');

match(post, /freshEncryptedBackupRequired:\s*true/,
  'post reconciliation must require fresh encrypted backup');
match(post, /requiredUnexplainedMismatch:\s*0/,
  'post reconciliation must require zero unexplained mismatch');
match(post, /idempotentRerunNoopRequired:\s*true/,
  'post reconciliation must require idempotent rerun');
match(post, /writeCommandEnabled:\s*false/,
  'post reconciliation must stay read-only');

match(genericGateway, /GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED/,
  'generic repository gateway write guard must remain in place');

for (const required of [
  'docs/operations/MIG010_AUTHORIZED_EXECUTION.md',
  'lib/migration/mig010_execution_policy.v1.json',
  'Mig010ExecutionGateway.js',
  'Mig010ExecutionTypedWrite.js',
  'tools/mig010-execution-package.js',
  'tools/mig010-authorized-executor.js',
  'tools/mig010-post-reconcile.js',
  'tests/mig010_execution_package_contract_test.js',
  'tests/mig010_execution_gateway_contract_test.js',
  'tests/mig010_authorized_executor_contract_test.js',
  'tests/mig010_typed_staging_write_contract_test.js',
  'tests/mig010_post_reconcile_contract_test.js'
]) assert(llms.includes(required), `llms.txt missing ${required}`);

for (const [name, value] of [['status', status], ['context', context], ['runbook', runbook], ['llms', llms]]) {
  assert(!/script\.google\.com\/macros\/s\/|\bAKfy[A-Za-z0-9_-]+\b/.test(value), `${name} contains private deployment locator`);
  assert(!/[A-Z]:\\(?:YandexDisk|PrihRashOnline-Keys|PrihRashOnline(?:\\|$))/i.test(value), `${name} contains owner-private path`);
}

console.log('mig010_execution_documentation_contract_test: OK', {
  privateStage: 'OWNER_VERIFIED',
  githubLifecycle: 'DONE',
  successorWriter: 'ANL-010',
  executionPolicy: 'MIG010_EXECUTION_POLICY_V1@1.0.0',
  genericRepositoryWriteAuthorized: false,
  publicCiCanAuthorize: false,
  staging: true,
  adaptiveTypePreservation: true,
  formulasPreserved: true,
  freshBackupCopyRequired: true,
  freshBackupVerificationRequired: true,
  rollback: true,
  postWriteFreshBackup: true,
  unexplainedMismatchRequired: 0,
  realMigrationExecuted: true,
  realMigrationVerified: true
});
