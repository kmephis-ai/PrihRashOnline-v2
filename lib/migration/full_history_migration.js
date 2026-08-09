'use strict';

const crypto = require('crypto');
const CONTRACT = require('./full_history_migration.v1.json');
const {
  TRANSFORM_VERSION,
  REASON,
  normalizeSourceRecord,
  sourceFingerprint,
  reconcileMigrations,
  planIdempotentImport
} = require('./migration_reconciliation');
const {
  normalizeCanonicalTransaction,
  validateCanonicalCollection,
  fromMigrationCanonicalRecord
} = require('../domain/canonical_transaction');
const { repositoryRevision } = require('../repository/transaction_repository');

const MIGRATION_SCHEMA = 'PRH_FULL_HISTORY_MIGRATION_V1';
const MIGRATION_VERSION = '1.0.0';
const RESUME_SCHEMA = 'PRH_MIGRATION_RESUME_V1';
const EVIDENCE_SCHEMA = 'MIG-010-EVIDENCE-v1';
const MAX_BATCH_SIZE = 100;
const DEFAULT_BACKUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SHA256_RE = /^[0-9a-f]{64}$/;

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value), 'utf8').digest('hex');
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== MIGRATION_SCHEMA || CONTRACT.version !== MIGRATION_VERSION) {
    fail('MIGRATION_CONTRACT_VERSION_INVALID');
  }
  if (CONTRACT.batch.max_size !== MAX_BATCH_SIZE || CONTRACT.resume.integrity !== 'HMAC-SHA256') {
    fail('MIGRATION_CONTRACT_POLICY_INVALID');
  }
  if (CONTRACT.pre_write.public_ci_can_authorize_real_write !== false) {
    fail('MIGRATION_PUBLIC_CI_AUTHORITY_INVALID');
  }
  return true;
}

function sourceRevision(sourceInputs) {
  if (!Array.isArray(sourceInputs)) fail('MIGRATION_SOURCE_COLLECTION_INVALID');
  const identities = sourceInputs.map((raw, index) => {
    try {
      const source = normalizeSourceRecord(raw);
      return { fingerprint: sourceFingerprint(source), quality: source.source_quality };
    } catch (error) {
      return { invalid_index: index, reason: REASON.SOURCE_INVALID };
    }
  }).sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
  return sha256({ transform_version: TRANSFORM_VERSION, identities });
}

function canonicalToMigrationRecord(input) {
  const tx = normalizeCanonicalTransaction(input);
  const match = /^row:(\d+)$/.exec(String(tx.provenance.source_position || ''));
  if (!match) fail('MIGRATION_CANONICAL_SOURCE_POSITION_REQUIRED');
  return {
    transaction_id: tx.transaction_id,
    source_system: tx.provenance.source_system,
    source_sheet: tx.provenance.source_container || 'UNKNOWN',
    source_row: Number(match[1]),
    transform_version: tx.provenance.transform_version,
    occurred_at: tx.occurred_at,
    type: tx.type,
    amount_minor: tx.amount_minor,
    currency: tx.currency,
    account_id: tx.account_id,
    destination_account_id: tx.destination_account_id || '',
    category_id: tx.category_id,
    name: tx.description || ''
  };
}

function defaultSourceToCanonical(raw) {
  const source = normalizeSourceRecord(raw);
  if (source.source_quality !== 'VALID') fail('MIGRATION_SOURCE_QUALITY_INVALID');
  const fingerprint = sourceFingerprint(source);
  const migrationRecord = {
    transaction_id: `mig-${fingerprint.slice(0, 40)}`,
    source_system: source.source_system,
    source_sheet: source.source_sheet,
    source_row: source.source_row,
    transform_version: source.transform_version,
    occurred_at: source.occurred_at,
    type: source.type,
    status: 'posted',
    amount_minor: source.amount_minor,
    currency: source.currency,
    account_id: source.account_id,
    destination_account_id: source.destination_account_id,
    category_id: source.category_id,
    name: source.name,
    member_id: null,
    project_id: null,
    tags: [],
    counterparty: null,
    description: source.name || null,
    reverses_transaction_id: null,
    adjustment_semantics: source.type === 'refund' ? 'expense_reduction' : null
  };
  return fromMigrationCanonicalRecord(migrationRecord);
}

function normalizeBackupBinding(binding) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) fail('MIGRATION_BACKUP_BINDING_REQUIRED');
  const hash = String(binding.backupCipherSha256 || '');
  if (binding.schema !== 'DR-001-EVIDENCE-v1' || binding.status !== 'PASS' || binding.checksum !== 'PASS' || !SHA256_RE.test(hash)) {
    fail('MIGRATION_BACKUP_BINDING_INVALID');
  }
  return Object.freeze({
    schema: binding.schema,
    status: binding.status,
    checksum: binding.checksum,
    backupCipherSha256: hash
  });
}

function buildMigrationPlan(input) {
  assertContract();
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('MIGRATION_PLAN_INPUT_INVALID');
  const sources = Array.isArray(input.source_records) ? input.source_records : fail('MIGRATION_SOURCE_COLLECTION_INVALID');
  const target = validateCanonicalCollection(Array.isArray(input.canonical_records) ? input.canonical_records : []);
  const batchSize = input.batch_size == null ? MAX_BATCH_SIZE : Number(input.batch_size);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) fail('MIGRATION_BATCH_SIZE_INVALID');
  const mappingVersion = String(input.mapping_version || '').trim();
  if (!mappingVersion || mappingVersion.length > 80) fail('MIGRATION_MAPPING_VERSION_INVALID');
  const backup = normalizeBackupBinding(input.backup_binding);
  const transformer = typeof input.transformer === 'function' ? input.transformer : defaultSourceToCanonical;
  const targetMigration = target.map(canonicalToMigrationRecord);
  const dryRun = planIdempotentImport(sources, targetMigration);
  const blocked = dryRun.filter((item) => item.action === 'BLOCK');
  const sourceRev = sourceRevision(sources);
  const targetRev = repositoryRevision(target);

  const inserts = [];
  if (blocked.length === 0) {
    dryRun.forEach((item) => {
      if (item.action !== 'INSERT') return;
      const tx = normalizeCanonicalTransaction(transformer(sources[item.index]));
      const expectedFingerprint = sourceFingerprint(sources[item.index]);
      if (tx.provenance.source_fingerprint !== expectedFingerprint) fail('MIGRATION_TRANSFORM_FINGERPRINT_MISMATCH');
      inserts.push(tx);
    });
  }
  inserts.sort((a, b) => a.provenance.source_fingerprint.localeCompare(b.provenance.source_fingerprint));

  const identity = {
    schema: MIGRATION_SCHEMA,
    version: MIGRATION_VERSION,
    source_revision: sourceRev,
    initial_target_revision: targetRev,
    transform_version: TRANSFORM_VERSION,
    mapping_version: mappingVersion,
    backup_cipher_sha256: backup.backupCipherSha256,
    batch_size: batchSize,
    dry_run: dryRun.map((item) => ({ action: item.action, reason: item.reason, fingerprint: item.fingerprint || null })),
    insert_identities: inserts.map((tx) => ({
      transaction_id: tx.transaction_id,
      source_fingerprint: tx.provenance.source_fingerprint
    }))
  };
  const planHash = sha256(identity);
  const batches = [];
  for (let offset = 0; offset < inserts.length; offset += batchSize) {
    batches.push(Object.freeze(inserts.slice(offset, offset + batchSize)));
  }

  return Object.freeze({
    schema: MIGRATION_SCHEMA,
    version: MIGRATION_VERSION,
    status: blocked.length === 0 ? 'READY' : 'BLOCKED',
    source_revision: sourceRev,
    initial_target_revision: targetRev,
    transform_version: TRANSFORM_VERSION,
    mapping_version: mappingVersion,
    backup_binding: backup,
    batch_size: batchSize,
    plan_hash: planHash,
    dry_run: Object.freeze(dryRun.map((item) => Object.freeze({ ...item }))),
    blocked_reasons: Object.freeze(blocked.map((item) => item.reason).sort()),
    batches: Object.freeze(batches),
    private_source_records: sources
  });
}

function normalizeResumeSecret(secret) {
  const value = Buffer.isBuffer(secret) ? secret : Buffer.from(String(secret || ''), 'utf8');
  if (value.length < 32) fail('MIGRATION_RESUME_SECRET_TOO_SHORT');
  return value;
}

function encodeResumePayload(payload, secret) {
  const body = Buffer.from(stableStringify(payload), 'utf8').toString('base64url');
  const mac = crypto.createHmac('sha256', normalizeResumeSecret(secret)).update(body, 'utf8').digest('base64url');
  return `${body}.${mac}`;
}

function decodeResumeToken(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) fail('MIGRATION_RESUME_TOKEN_INVALID');
  const expected = crypto.createHmac('sha256', normalizeResumeSecret(secret)).update(parts[0], 'utf8').digest();
  let actual;
  try { actual = Buffer.from(parts[1], 'base64url'); } catch (error) { fail('MIGRATION_RESUME_TOKEN_INVALID'); }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) fail('MIGRATION_RESUME_TOKEN_TAMPERED');
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch (error) { fail('MIGRATION_RESUME_TOKEN_INVALID'); }
  if (!payload || payload.schema !== RESUME_SCHEMA || !SHA256_RE.test(String(payload.plan_hash || '')) ||
      !Number.isInteger(payload.next_batch) || payload.next_batch < 0 || !SHA256_RE.test(String(payload.expected_revision || ''))) {
    fail('MIGRATION_RESUME_PAYLOAD_INVALID');
  }
  return Object.freeze(payload);
}

function createInitialResumeToken(plan, secret) {
  if (!plan || plan.schema !== MIGRATION_SCHEMA || plan.status !== 'READY') fail('MIGRATION_PLAN_NOT_READY');
  return encodeResumePayload({
    schema: RESUME_SCHEMA,
    plan_hash: plan.plan_hash,
    next_batch: 0,
    expected_revision: plan.initial_target_revision
  }, secret);
}

function authorizeRealWrite(plan, authorization, nowMs = Date.now()) {
  if (!plan || plan.schema !== MIGRATION_SCHEMA || plan.status !== 'READY') fail('MIGRATION_PLAN_NOT_READY');
  if (!authorization || typeof authorization !== 'object' || Array.isArray(authorization)) fail('MIGRATION_AUTHORIZATION_REQUIRED');
  if (authorization.authorization !== 'IRREVERSIBLE_ACTION_AUTHORIZED') fail('MIGRATION_IRREVERSIBLE_ACTION_NOT_AUTHORIZED');
  if (authorization.plan_hash !== plan.plan_hash) fail('MIGRATION_AUTHORIZATION_PLAN_MISMATCH');
  const backup = normalizeBackupBinding(authorization.backup);
  if (backup.backupCipherSha256 !== plan.backup_binding.backupCipherSha256) fail('MIGRATION_AUTHORIZATION_BACKUP_MISMATCH');
  const verifiedAt = Date.parse(String(authorization.backup_verified_at || ''));
  if (!Number.isFinite(verifiedAt)) fail('MIGRATION_BACKUP_VERIFIED_AT_INVALID');
  const maxAge = authorization.backup_max_age_ms == null ? DEFAULT_BACKUP_MAX_AGE_MS : Number(authorization.backup_max_age_ms);
  if (!Number.isInteger(maxAge) || maxAge < 1 || maxAge > DEFAULT_BACKUP_MAX_AGE_MS) fail('MIGRATION_BACKUP_MAX_AGE_INVALID');
  const age = nowMs - verifiedAt;
  if (age < 0 || age > maxAge) fail('MIGRATION_BACKUP_STALE');
  return Object.freeze({ status: 'AUTHORIZED', plan_hash: plan.plan_hash, backupCipherSha256: backup.backupCipherSha256 });
}

function executeNextBatch(input) {
  const { plan, repository, resume_token: token, resume_secret: secret, authorization } = input || {};
  authorizeRealWrite(plan, authorization, input && input.now_ms == null ? Date.now() : input.now_ms);
  if (!repository || repository.schema !== 'PRH_TRANSACTION_REPOSITORY_V1' ||
      typeof repository.getRevision !== 'function' || typeof repository.writeBatch !== 'function') {
    fail('MIGRATION_REPOSITORY_INVALID');
  }
  const resume = decodeResumeToken(token, secret);
  if (resume.plan_hash !== plan.plan_hash) fail('MIGRATION_RESUME_PLAN_MISMATCH');
  if (resume.next_batch > plan.batches.length) fail('MIGRATION_RESUME_OFFSET_INVALID');
  const currentRevision = repository.getRevision();
  if (currentRevision !== resume.expected_revision) fail('MIGRATION_TARGET_REVISION_CHANGED');
  if (resume.next_batch === plan.batches.length) {
    return Object.freeze({ status: 'COMPLETE', plan_hash: plan.plan_hash, final_revision: currentRevision, next_resume_token: token });
  }

  const batchIndex = resume.next_batch;
  const transactions = plan.batches[batchIndex];
  const idempotencyKey = `MIG010:${plan.plan_hash}:${batchIndex}`;
  const receipt = repository.writeBatch({
    idempotency_key: idempotencyKey,
    expected_revision: resume.expected_revision,
    operations: transactions.map((transaction) => ({ action: 'PUT', transaction }))
  });
  if (!receipt || receipt.status !== 'PASS' || !SHA256_RE.test(String(receipt.revision || ''))) {
    const reason = receipt && receipt.reason_code ? String(receipt.reason_code) : 'MIGRATION_BATCH_WRITE_FAILED';
    fail(reason);
  }
  const nextPayload = {
    schema: RESUME_SCHEMA,
    plan_hash: plan.plan_hash,
    next_batch: batchIndex + 1,
    expected_revision: receipt.revision
  };
  return Object.freeze({
    status: batchIndex + 1 === plan.batches.length ? 'BATCH_APPLIED_FINAL' : 'BATCH_APPLIED',
    plan_hash: plan.plan_hash,
    batch_index: batchIndex,
    revision: receipt.revision,
    next_resume_token: encodeResumePayload(nextPayload, secret)
  });
}

function verifyFullHistoryReconciliation(sourceInputs, canonicalInputs) {
  const canonical = validateCanonicalCollection(canonicalInputs);
  const projected = canonical.map(canonicalToMigrationRecord);
  const result = reconcileMigrations(sourceInputs, projected);
  const unexplainedMismatch = result.summary.review_count + result.summary.invalid_source_count;
  return Object.freeze({
    status: unexplainedMismatch === 0 && result.summary.source_count === result.summary.canonical_count ? 'PASS' : 'FAIL',
    unexplainedMismatch,
    source_revision: sourceRevision(sourceInputs),
    target_revision: repositoryRevision(canonical),
    private_result: result
  });
}

function publicMigrationEvidence(input) {
  const { plan, reconciliation, final_target_revision, duration_ms } = input || {};
  if (!plan || plan.schema !== MIGRATION_SCHEMA || !reconciliation) fail('MIGRATION_EVIDENCE_INPUT_INVALID');
  const finalRevision = String(final_target_revision || reconciliation.target_revision || '');
  if (!SHA256_RE.test(finalRevision)) fail('MIGRATION_EVIDENCE_FINAL_REVISION_INVALID');
  const duration = Number(duration_ms);
  if (!Number.isInteger(duration) || duration < 0) fail('MIGRATION_EVIDENCE_DURATION_INVALID');
  return Object.freeze({
    schema: EVIDENCE_SCHEMA,
    status: reconciliation.status,
    planHash: plan.plan_hash,
    sourceRevisionHash: plan.source_revision,
    initialTargetRevisionHash: plan.initial_target_revision,
    finalTargetRevisionHash: finalRevision,
    backupCipherSha256: plan.backup_binding.backupCipherSha256,
    unexplainedMismatch: reconciliation.unexplainedMismatch,
    durationMs: duration
  });
}

module.exports = {
  CONTRACT,
  MIGRATION_SCHEMA,
  MIGRATION_VERSION,
  RESUME_SCHEMA,
  EVIDENCE_SCHEMA,
  MAX_BATCH_SIZE,
  DEFAULT_BACKUP_MAX_AGE_MS,
  assertContract,
  stableStringify,
  sha256,
  sourceRevision,
  canonicalToMigrationRecord,
  defaultSourceToCanonical,
  buildMigrationPlan,
  createInitialResumeToken,
  decodeResumeToken,
  authorizeRealWrite,
  executeNextBatch,
  verifyFullHistoryReconciliation,
  publicMigrationEvidence
};
