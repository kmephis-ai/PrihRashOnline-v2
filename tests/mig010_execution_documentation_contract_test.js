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
const executor = read('tools/mig010-authorized-executor.js');
const post = read('tools/mig010-post-reconcile.js');
const genericGateway = read('GoogleTransactionRepositoryGateway.js');
const policy = JSON.parse(read('lib/migration/mig010_execution_policy.v1.json'));

function match(text, pattern, message) { assert(pattern.test(text), message); }

match(status, /MIG-010[^\n]{0,260}IN_PROGRESS[^\n]{0,260}AUTHORIZATION_REQUIRED/i,
  'project status must identify MIG-010 AUTHORIZATION_REQUIRED while still IN_PROGRESS');
match(status, /repair resolve[^\n]{0,180}READY_FOR_REBUILD_DRY_RUN/i,
  'project status must preserve owner repair resolve checkpoint');
match(status, /resolved rebuild dry-run[^\n]{0,120}PASS/i,
  'project status must preserve owner rebuild verification PASS');
match(status, /real migration batch[^\n]{0,120}(?:не выполнялся|not)/i,
  'status must not claim authorized migration executed');
match(status, /unexplainedMismatch=0[^\n]{0,180}(?:ещё не доказан|not)/i,
  'status must not claim post-write reconciliation before execution');

match(context, /owner-private stage = `AUTHORIZATION_REQUIRED`/,
  'AI context must identify current irreversible stage');
match(context, /MIG010_EXECUTION_POLICY_V1@1\.0\.0/,
  'AI context must identify execution policy');
match(context, /FINALIZED_PENDING_RECONCILIATION/,
  'AI context must keep finalize separate from DONE');
match(context, /new encrypted backup after finalize|нов[^\n]{0,120}encrypted backup/i,
  'AI context must require post-write backup');
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
  'runbook must bind backup creation and verification timestamps separately');
match(runbook, /hidden rollback copy/i,
  'runbook must require rollback copy');
match(runbook, /hidden staging/i,
  'runbook must require staging');
match(runbook, /<=100|не превышает 100|максимум 100/i,
  'runbook must bound batches to 100');
match(runbook, /SpreadsheetApp\.flush\(\)[\s\S]{0,160}readback hash/i,
  'runbook must require staging readback');
match(runbook, /contentsOnly:true[\s\S]{0,220}formulas/i,
  'runbook must document formula-preserving finalize/rollback semantics');
match(runbook, /FINALIZED_PENDING_RECONCILIATION/,
  'runbook must not equate finalize with DONE');
match(runbook, /unexplainedMismatch = 0/,
  'runbook must require zero unexplained mismatch');

match(packageTool, /writeCommandEnabled:\s*false/,
  'execution-package builder must not have write command');
match(packageTool, /retainNonScopedTargetRows:\s*true/,
  'package builder must retain non-scoped target rows');
match(packageTool, /formulaLikeTextFailClosed:\s*true/,
  'package builder must fail closed on formula-like source text');

match(gateway, /prhMig010BeginAuthorizedExecution/,
  'gateway missing begin');
match(gateway, /prhMig010WriteAuthorizedBatch/,
  'gateway missing batch write');
match(gateway, /prhMig010FinalizeAuthorizedExecution/,
  'gateway missing finalize');
match(gateway, /prhMig010RollbackAuthorizedExecution/,
  'gateway missing rollback');
match(gateway, /MIG010_EXECUTION_TARGET_CHANGED_SINCE_BACKUP/,
  'gateway must detect target drift');
match(gateway, /MIG010_EXECUTION_BACKUP_COPY_STALE/,
  'gateway must reject stale backup copy');
match(gateway, /MIG010_EXECUTION_BACKUP_VERIFICATION_STALE/,
  'gateway must reject stale backup verification');
match(gateway, /MIG010_EXECUTION_BATCH_READBACK_MISMATCH/,
  'gateway must fail on batch readback mismatch');
match(gateway, /prhMig010RestoreFromRollback_/,
  'gateway must implement verified rollback');
match(gateway, /fresh_backup_copy_required:\s*true/,
  'gateway metadata must expose fresh backup copy requirement');
match(gateway, /fresh_backup_verification_required:\s*true/,
  'gateway metadata must expose fresh backup verification requirement');
match(gateway, /generic_repository_write_authorized:\s*false/,
  'migration gateway must not grant generic repository authority');

match(executor, /MIG010_OWNER_IRREVERSIBLE_AUTHORIZATION_V1/,
  'executor must require private authorization schema');
match(executor, /IRREVERSIBLE_ACTION_AUTHORIZED/,
  'executor must require literal owner authorization');
match(executor, /MAX_BACKUP_AGE_MS = 24 \* 60 \* 60 \* 1000/,
  'executor must enforce fresh backup');
match(executor, /MIG010_EXECUTOR_BACKUP_COPY_STALE/,
  'executor must reject old backup copy independently of verify time');
match(executor, /freshEncryptedBackupCopyRequired:\s*true/,
  'executor contract must advertise fresh backup-copy requirement');
match(executor, /freshEncryptedBackupVerifyRequired:\s*true/,
  'executor contract must advertise fresh verification requirement');
match(executor, /publicCiCanAuthorize:\s*false/,
  'executor contract must deny public CI authorization');
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
  'tools/mig010-execution-package.js',
  'tools/mig010-authorized-executor.js',
  'tools/mig010-post-reconcile.js',
  'tests/mig010_execution_package_contract_test.js',
  'tests/mig010_execution_gateway_contract_test.js',
  'tests/mig010_authorized_executor_contract_test.js',
  'tests/mig010_post_reconcile_contract_test.js'
]) {
  assert(llms.includes(required), `llms.txt missing ${required}`);
}

for (const [name, value] of [['status', status], ['context', context], ['runbook', runbook], ['llms', llms]]) {
  assert(!/script\.google\.com\/macros\/s\/|\bAKfy[A-Za-z0-9_-]+\b/.test(value), `${name} contains private deployment locator`);
  assert(!/[A-Z]:\\(?:YandexDisk|PrihRashOnline-Keys|PrihRashOnline(?:\\|$))/i.test(value), `${name} contains owner-private path`);
}

console.log('mig010_execution_documentation_contract_test: OK', {
  stage: 'AUTHORIZATION_REQUIRED',
  executionPolicy: 'MIG010_EXECUTION_POLICY_V1@1.0.0',
  genericRepositoryWriteAuthorized: false,
  publicCiCanAuthorize: false,
  staging: true,
  formulasPreserved: true,
  freshBackupCopyRequired: true,
  freshBackupVerificationRequired: true,
  rollback: true,
  postWriteFreshBackup: true,
  unexplainedMismatchRequired: 0,
  realMigrationExecuted: false
});
