'use strict';

const assert = require('assert');
const {
  MIGRATION_SCHEMA,
  MIGRATION_VERSION,
  EVIDENCE_SCHEMA,
  MAX_BATCH_SIZE,
  DEFAULT_BACKUP_MAX_AGE_MS,
  assertContract,
  defaultSourceToCanonical,
  buildMigrationPlan,
  createInitialResumeToken,
  decodeResumeToken,
  authorizeRealWrite,
  executeNextBatch,
  verifyFullHistoryReconciliation,
  publicMigrationEvidence
} = require('../lib/migration/full_history_migration');
const { createFakeTransactionRepository } = require('../lib/repository/transaction_repository');

const BACKUP_HASH = 'b'.repeat(64);
const RESUME_SECRET = 'synthetic-mig010-resume-secret-0000000000000001';
const NOW = Date.parse('2026-08-09T08:00:00Z');

function source(index, overrides = {}) {
  const row = index + 2;
  return {
    source_system: 'SYN-FORM',
    source_sheet: 'SYN-FULL-HISTORY',
    source_row: row,
    transform_version: 'SOURCE-TRANSFORM-v1',
    occurred_at: `2025-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}T10:00:00Z`,
    type: index % 5 === 0 ? 'income' : 'expense',
    amount_minor: 1000 + index,
    currency: 'RUB',
    account_id: 'ACC-MAIN',
    destination_account_id: '',
    category_id: index % 5 === 0 ? 'CAT-INCOME' : 'CAT-HOME',
    name: `Synthetic migration row ${String(index).padStart(4, '0')}`,
    source_quality: 'VALID',
    ...overrides
  };
}

function backupBinding() {
  return {
    schema: 'DR-001-EVIDENCE-v1',
    status: 'PASS',
    checksum: 'PASS',
    backupCipherSha256: BACKUP_HASH
  };
}

function authorization(plan, verifiedAt = '2026-08-09T07:30:00Z') {
  return {
    authorization: 'IRREVERSIBLE_ACTION_AUTHORIZED',
    plan_hash: plan.plan_hash,
    backup: backupBinding(),
    backup_verified_at: verifiedAt,
    backup_max_age_ms: DEFAULT_BACKUP_MAX_AGE_MS
  };
}

assert.strictEqual(assertContract(), true);
assert.strictEqual(MIGRATION_SCHEMA, 'PRH_FULL_HISTORY_MIGRATION_V1');
assert.strictEqual(MIGRATION_VERSION, '1.0.0');
assert.strictEqual(MAX_BATCH_SIZE, 100);

const sources = Array.from({ length: 207 }, (_, index) => source(index));
const preexisting = sources.slice(0, 7).map(defaultSourceToCanonical);
const repository = createFakeTransactionRepository(preexisting, { synthetic_write_authority: true });

const plan = buildMigrationPlan({
  source_records: sources,
  canonical_records: repository.readAll(),
  mapping_version: 'SYN-MAPPING-v1',
  backup_binding: backupBinding(),
  batch_size: 100
});
assert.strictEqual(plan.status, 'READY');
assert.strictEqual(plan.batches.length, 2, '200 inserts must be split into two bounded batches');
assert.strictEqual(plan.batches[0].length, 100);
assert.strictEqual(plan.batches[1].length, 100);
assert.strictEqual(plan.dry_run.filter((item) => item.action === 'REUSE').length, 7);
assert.strictEqual(plan.dry_run.filter((item) => item.action === 'INSERT').length, 200);
assert.strictEqual(plan.blocked_reasons.length, 0);
assert(/^[0-9a-f]{64}$/.test(plan.plan_hash));

let token = createInitialResumeToken(plan, RESUME_SECRET);
let resume = decodeResumeToken(token, RESUME_SECRET);
assert.strictEqual(resume.next_batch, 0);
assert.strictEqual(resume.expected_revision, plan.initial_target_revision);
assert.throws(() => decodeResumeToken(token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A'), RESUME_SECRET), /MIGRATION_RESUME_TOKEN_TAMPERED|MIGRATION_RESUME_TOKEN_INVALID/);
assert.throws(() => decodeResumeToken(token, 'short'), /MIGRATION_RESUME_SECRET_TOO_SHORT/);

assert.throws(() => authorizeRealWrite(plan, { ...authorization(plan), authorization: 'NO' }, NOW), /MIGRATION_IRREVERSIBLE_ACTION_NOT_AUTHORIZED/);
assert.throws(() => authorizeRealWrite(plan, authorization(plan, '2026-08-08T06:00:00Z'), NOW), /MIGRATION_BACKUP_STALE/);
assert.throws(() => authorizeRealWrite(plan, { ...authorization(plan), plan_hash: 'a'.repeat(64) }, NOW), /MIGRATION_AUTHORIZATION_PLAN_MISMATCH/);
assert.strictEqual(authorizeRealWrite(plan, authorization(plan), NOW).status, 'AUTHORIZED');

// First bounded batch. Simulated process stops immediately afterwards.
let step = executeNextBatch({
  plan,
  repository,
  resume_token: token,
  resume_secret: RESUME_SECRET,
  authorization: authorization(plan),
  now_ms: NOW
});
assert.strictEqual(step.status, 'BATCH_APPLIED');
assert.strictEqual(step.batch_index, 0);
assert.strictEqual(repository.readAll().length, 107);
token = step.next_resume_token;

// Process restart: only the signed resume token + repository state are retained.
resume = decodeResumeToken(token, RESUME_SECRET);
assert.strictEqual(resume.next_batch, 1);
assert.strictEqual(resume.expected_revision, repository.getRevision());
step = executeNextBatch({
  plan,
  repository,
  resume_token: token,
  resume_secret: RESUME_SECRET,
  authorization: authorization(plan),
  now_ms: NOW
});
assert.strictEqual(step.status, 'BATCH_APPLIED_FINAL');
assert.strictEqual(step.batch_index, 1);
assert.strictEqual(repository.readAll().length, 207);
token = step.next_resume_token;

const complete = executeNextBatch({
  plan,
  repository,
  resume_token: token,
  resume_secret: RESUME_SECRET,
  authorization: authorization(plan),
  now_ms: NOW
});
assert.strictEqual(complete.status, 'COMPLETE');
assert.strictEqual(complete.final_revision, repository.getRevision());

const reconciliation = verifyFullHistoryReconciliation(sources, repository.readAll());
assert.strictEqual(reconciliation.status, 'PASS');
assert.strictEqual(reconciliation.unexplainedMismatch, 0);
assert.strictEqual(reconciliation.source_revision, plan.source_revision);

// Full rerun is reuse-only and does not create another write batch.
const rerunPlan = buildMigrationPlan({
  source_records: sources,
  canonical_records: repository.readAll(),
  mapping_version: 'SYN-MAPPING-v1',
  backup_binding: backupBinding(),
  batch_size: 100
});
assert.strictEqual(rerunPlan.status, 'READY');
assert.strictEqual(rerunPlan.batches.length, 0);
assert(rerunPlan.dry_run.every((item) => item.action === 'REUSE'));

// A duplicate source fingerprint blocks the entire plan before writes.
const duplicateSources = [source(500), source(501, {
  occurred_at: source(500).occurred_at,
  amount_minor: source(500).amount_minor,
  category_id: source(500).category_id,
  name: source(500).name
})];
const blockedPlan = buildMigrationPlan({
  source_records: duplicateSources,
  canonical_records: [],
  mapping_version: 'SYN-MAPPING-v1',
  backup_binding: backupBinding()
});
assert.strictEqual(blockedPlan.status, 'BLOCKED');
assert(blockedPlan.blocked_reasons.includes('SOURCE_DUPLICATE'));
assert.strictEqual(blockedPlan.batches.length, 0);
assert.throws(() => createInitialResumeToken(blockedPlan, RESUME_SECRET), /MIGRATION_PLAN_NOT_READY/);

// Stale target revision cannot consume a token generated for another target snapshot.
const divergentRepo = createFakeTransactionRepository([
  ...preexisting,
  defaultSourceToCanonical(source(900))
], { synthetic_write_authority: true });
assert.throws(() => executeNextBatch({
  plan,
  repository: divergentRepo,
  resume_token: createInitialResumeToken(plan, RESUME_SECRET),
  resume_secret: RESUME_SECRET,
  authorization: authorization(plan),
  now_ms: NOW
}), /MIGRATION_TARGET_REVISION_CHANGED/);

const evidence = publicMigrationEvidence({
  plan,
  reconciliation,
  final_target_revision: repository.getRevision(),
  duration_ms: 1234
});
assert.deepStrictEqual(Object.keys(evidence).sort(), [
  'backupCipherSha256', 'durationMs', 'finalTargetRevisionHash', 'initialTargetRevisionHash',
  'planHash', 'schema', 'sourceRevisionHash', 'status', 'unexplainedMismatch'
].sort());
assert.strictEqual(evidence.schema, EVIDENCE_SCHEMA);
assert.strictEqual(evidence.status, 'PASS');
assert.strictEqual(evidence.unexplainedMismatch, 0);
assert.strictEqual(evidence.backupCipherSha256, BACKUP_HASH);
assert(!JSON.stringify(evidence).includes('Synthetic migration row'));
assert(!Object.prototype.hasOwnProperty.call(evidence, 'source_count'));
assert(!Object.prototype.hasOwnProperty.call(evidence, 'canonical_count'));

console.log('full_history_migration_contract_test: OK', {
  schema: `${MIGRATION_SCHEMA}@${MIGRATION_VERSION}`,
  dryRun: true,
  boundedBatchMax: MAX_BATCH_SIZE,
  interruptionResume: 'PASS',
  resumeIntegrity: 'HMAC-SHA256',
  irreversibleActionGate: true,
  backupFreshnessGate: true,
  targetRevisionPrecondition: true,
  rerunIdempotent: true,
  reconciliation: 'PASS',
  unexplainedMismatch: 0,
  publicEvidencePayload: false
});
