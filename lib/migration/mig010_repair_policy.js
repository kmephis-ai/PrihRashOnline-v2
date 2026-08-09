'use strict';

const POLICY = require('./mig010_repair_policy.v1.json');
const {
  normalizeSourceRecord,
  sourceFingerprint
} = require('./migration_reconciliation');
const {
  defaultSourceToCanonical,
  sha256,
  sourceRevision
} = require('./full_history_migration');
const {
  validateCanonicalCollection,
  fromMigrationCanonicalOccurrenceRecord
} = require('../domain/canonical_transaction');

const PROPOSAL_SCHEMA = 'MIG010_OWNER_PRIVATE_REPAIR_PROPOSAL_V1';
const RESOLUTION_SCHEMA = 'MIG010_OWNER_PRIVATE_REPAIR_RESOLUTION_V1';
const RESOLVED_SCHEMA = 'MIG010_OWNER_PRIVATE_REPAIR_RESOLVED_V1';
const SHA256_RE = /^[0-9a-f]{64}$/;
const OCCURRENCE_IDENTITY = 'CONTENT_FINGERPRINT_OCCURRENCE_V1';

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function text(value) {
  return String(value == null ? '' : value).trim();
}

function assertPolicy() {
  if (!POLICY || POLICY.schema !== 'MIG010_REPAIR_POLICY_V1' || POLICY.version !== '1.1.0') {
    fail('MIG010_REPAIR_POLICY_VERSION_INVALID');
  }
  if (POLICY.strategy !== 'REBUILD_LEGACY_SLICE_V1' || POLICY.write_authority !== false ||
      POLICY.source_duplicate.public_ci_can_decide !== false ||
      POLICY.source_duplicate.preserve_all_identity_strategy !== OCCURRENCE_IDENTITY) {
    fail('MIG010_REPAIR_POLICY_INVALID');
  }
  return true;
}

function sourceLocator(raw, index) {
  const row = Number(raw && raw.source_row);
  return Object.freeze({
    index,
    source_system: text(raw && raw.source_system),
    source_sheet: text(raw && raw.source_sheet),
    source_row: Number.isInteger(row) && row >= 2 ? row : null
  });
}

function classifySources(sourceRecords) {
  if (!Array.isArray(sourceRecords)) fail('MIG010_REPAIR_SOURCE_COLLECTION_INVALID');
  const invalid = [];
  const byFingerprint = new Map();

  sourceRecords.forEach((raw, index) => {
    let normalized;
    try {
      normalized = normalizeSourceRecord(raw);
    } catch (_) {
      invalid.push(Object.freeze({ ...sourceLocator(raw, index), reason: 'SOURCE_INVALID' }));
      return;
    }
    if (normalized.source_quality !== 'VALID') {
      invalid.push(Object.freeze({ ...sourceLocator(raw, index), reason: 'SOURCE_INVALID' }));
      return;
    }
    const fingerprint = sourceFingerprint(normalized);
    const item = Object.freeze({ index, raw, normalized, fingerprint });
    if (!byFingerprint.has(fingerprint)) byFingerprint.set(fingerprint, []);
    byFingerprint.get(fingerprint).push(item);
  });

  const unique = [];
  const duplicateGroups = [];
  for (const [fingerprint, items] of byFingerprint.entries()) {
    if (items.length === 1) {
      unique.push(items[0]);
      continue;
    }
    const members = items
      .map((item) => Object.freeze({ ...sourceLocator(item.raw, item.index) }))
      .sort((a, b) => (a.source_row || 0) - (b.source_row || 0) || a.index - b.index);
    duplicateGroups.push(Object.freeze({ fingerprint, members: Object.freeze(members) }));
  }
  unique.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint) || a.index - b.index);
  duplicateGroups.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
  invalid.sort((a, b) => a.index - b.index);

  return Object.freeze({
    unique: Object.freeze(unique),
    duplicate_groups: Object.freeze(duplicateGroups),
    invalid: Object.freeze(invalid)
  });
}

function targetScope(canonicalRecords) {
  const canonical = validateCanonicalCollection(Array.isArray(canonicalRecords) ? canonicalRecords : []);
  return Object.freeze(canonical.map((tx) => Object.freeze({
    transaction_id: tx.transaction_id,
    source_system: tx.provenance.source_system,
    source_container: tx.provenance.source_container,
    source_record_id: tx.provenance.source_record_id,
    source_fingerprint: tx.provenance.source_fingerprint,
    source_position: tx.provenance.source_position
  })).sort((a, b) => a.transaction_id.localeCompare(b.transaction_id)));
}

function assertBinding(input) {
  const planHash = text(input && input.plan_hash);
  const targetRevision = text(input && input.target_revision);
  const backupHash = text(input && input.backup_cipher_sha256);
  const mappingVersion = text(input && input.mapping_version);
  if (!SHA256_RE.test(planHash)) fail('MIG010_REPAIR_PLAN_HASH_INVALID');
  if (!SHA256_RE.test(targetRevision)) fail('MIG010_REPAIR_TARGET_REVISION_INVALID');
  if (!SHA256_RE.test(backupHash)) fail('MIG010_REPAIR_BACKUP_HASH_INVALID');
  if (!mappingVersion || mappingVersion.length > 80) fail('MIG010_REPAIR_MAPPING_VERSION_INVALID');
  return { planHash, targetRevision, backupHash, mappingVersion };
}

function buildRepairProposal(input) {
  assertPolicy();
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('MIG010_REPAIR_INPUT_INVALID');
  const sourceRecords = Array.isArray(input.source_records) ? input.source_records : fail('MIG010_REPAIR_SOURCE_COLLECTION_INVALID');
  const canonicalRecords = Array.isArray(input.canonical_records) ? input.canonical_records : fail('MIG010_REPAIR_TARGET_COLLECTION_INVALID');
  const binding = assertBinding(input);
  const actualSourceRevision = sourceRevision(sourceRecords);
  if (input.source_revision && text(input.source_revision) !== actualSourceRevision) fail('MIG010_REPAIR_SOURCE_REVISION_MISMATCH');

  const classified = classifySources(sourceRecords);
  const scopedTarget = targetScope(canonicalRecords);
  const uniqueCandidate = validateCanonicalCollection(classified.unique.map((item) => defaultSourceToCanonical(item.raw)));
  const status = classified.duplicate_groups.length > 0 ? 'OWNER_DECISION_REQUIRED' : 'READY_FOR_REBUILD_DRY_RUN';
  const identity = {
    policy_schema: POLICY.schema,
    policy_version: POLICY.version,
    strategy: POLICY.strategy,
    plan_hash: binding.planHash,
    source_revision: actualSourceRevision,
    target_revision: binding.targetRevision,
    backup_cipher_sha256: binding.backupHash,
    mapping_version: binding.mappingVersion,
    target_scope: scopedTarget,
    invalid_quarantine: classified.invalid,
    duplicate_groups: classified.duplicate_groups,
    unique_candidate_identities: uniqueCandidate.map((tx) => ({
      transaction_id: tx.transaction_id,
      source_record_id: tx.provenance.source_record_id,
      source_fingerprint: tx.provenance.source_fingerprint
    }))
  };
  const proposalHash = sha256(identity);

  return Object.freeze({
    schema: PROPOSAL_SCHEMA,
    policy_schema: POLICY.schema,
    policy_version: POLICY.version,
    strategy: POLICY.strategy,
    status,
    proposal_hash: proposalHash,
    plan_hash: binding.planHash,
    source_revision: actualSourceRevision,
    target_revision: binding.targetRevision,
    backup_cipher_sha256: binding.backupHash,
    mapping_version: binding.mappingVersion,
    target_scope: scopedTarget,
    auto_target_policy: Object.freeze({
      CORE_MISMATCH: 'REBUILD_SCOPED_TARGET',
      SOURCE_MISSING: 'REBUILD_SCOPED_TARGET',
      SOURCE_ROW_MOVED: 'REBUILD_SCOPED_TARGET'
    }),
    invalid_quarantine: classified.invalid,
    duplicate_groups: classified.duplicate_groups,
    unique_candidate: uniqueCandidate,
    manual_decision_required: classified.duplicate_groups.length > 0,
    write_authorized: false
  });
}

function normalizeResolution(resolution, proposal) {
  if (!resolution || typeof resolution !== 'object' || Array.isArray(resolution) || resolution.schema !== RESOLUTION_SCHEMA) {
    fail('MIG010_REPAIR_RESOLUTION_INVALID');
  }
  if (resolution.proposal_hash !== proposal.proposal_hash) fail('MIG010_REPAIR_RESOLUTION_PROPOSAL_MISMATCH');
  if (resolution.source_revision !== proposal.source_revision) fail('MIG010_REPAIR_RESOLUTION_SOURCE_MISMATCH');
  if (!Array.isArray(resolution.duplicate_decisions)) fail('MIG010_REPAIR_DUPLICATE_DECISIONS_INVALID');
  const allowed = new Set(POLICY.source_duplicate.allowed_decisions);
  const seen = new Set();
  const decisions = resolution.duplicate_decisions.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail('MIG010_REPAIR_DUPLICATE_DECISION_INVALID');
    const fingerprint = text(entry.fingerprint);
    const decision = text(entry.decision);
    if (!SHA256_RE.test(fingerprint) || !allowed.has(decision) || seen.has(fingerprint)) {
      fail('MIG010_REPAIR_DUPLICATE_DECISION_INVALID');
    }
    seen.add(fingerprint);
    const keepSourceRow = entry.keep_source_row == null ? null : Number(entry.keep_source_row);
    if (decision === 'DEDUPLICATE_KEEP_ONE' && (!Number.isInteger(keepSourceRow) || keepSourceRow < 2)) {
      fail('MIG010_REPAIR_DUPLICATE_KEEP_ROW_REQUIRED');
    }
    if (decision !== 'DEDUPLICATE_KEEP_ONE' && keepSourceRow !== null) {
      fail('MIG010_REPAIR_DUPLICATE_KEEP_ROW_FORBIDDEN');
    }
    return Object.freeze({ fingerprint, decision, keep_source_row: keepSourceRow });
  });
  return Object.freeze({ schema: RESOLUTION_SCHEMA, duplicate_decisions: Object.freeze(decisions) });
}

function findSelectedDuplicateSource(sourceRecords, fingerprint, sourceRow) {
  for (let index = 0; index < sourceRecords.length; index += 1) {
    const raw = sourceRecords[index];
    try {
      const normalized = normalizeSourceRecord(raw);
      if (normalized.source_quality !== 'VALID') continue;
      if (normalized.source_row !== sourceRow) continue;
      if (sourceFingerprint(normalized) !== fingerprint) continue;
      return Object.freeze({ index, raw, normalized, fingerprint });
    } catch (_) { /* invalid sources cannot satisfy a duplicate decision */ }
  }
  return null;
}

function duplicateSourceItems(sourceRecords, group) {
  return group.members.map((member) => {
    const item = findSelectedDuplicateSource(sourceRecords, group.fingerprint, member.source_row);
    if (!item) fail('MIG010_REPAIR_DUPLICATE_SOURCE_NOT_FOUND');
    return item;
  });
}

function occurrenceCanonicalFromSourceItem(item, occurrenceOrdinal) {
  const source = item.normalized;
  return fromMigrationCanonicalOccurrenceRecord({
    transaction_id: `migbase-${item.fingerprint.slice(0, 40)}`,
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
  }, occurrenceOrdinal);
}

function applyRepairResolution(input) {
  assertPolicy();
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('MIG010_REPAIR_RESOLVE_INPUT_INVALID');
  const proposal = input.proposal;
  if (!proposal || proposal.schema !== PROPOSAL_SCHEMA || !SHA256_RE.test(String(proposal.proposal_hash || ''))) {
    fail('MIG010_REPAIR_PROPOSAL_INVALID');
  }
  const sourceRecords = Array.isArray(input.source_records) ? input.source_records : fail('MIG010_REPAIR_SOURCE_COLLECTION_INVALID');
  if (sourceRevision(sourceRecords) !== proposal.source_revision) fail('MIG010_REPAIR_SOURCE_REVISION_MISMATCH');
  const resolution = normalizeResolution(input.resolution, proposal);
  const classified = classifySources(sourceRecords);
  const decisions = new Map(resolution.duplicate_decisions.map((entry) => [entry.fingerprint, entry]));
  const blockers = [];
  const selected = classified.unique.slice();
  const occurrenceSelected = [];
  const duplicateQuarantine = [];

  for (const group of classified.duplicate_groups) {
    const decision = decisions.get(group.fingerprint);
    if (!decision || decision.decision === 'UNRESOLVED') {
      blockers.push('SOURCE_DUPLICATE_OWNER_DECISION_REQUIRED');
      continue;
    }
    if (decision.decision === 'PRESERVE_ALL') {
      const items = duplicateSourceItems(sourceRecords, group);
      items.forEach((item, index) => {
        occurrenceSelected.push(Object.freeze({ item, occurrence_ordinal: index + 1 }));
      });
      continue;
    }
    const member = group.members.find((candidate) => candidate.source_row === decision.keep_source_row);
    if (!member) fail('MIG010_REPAIR_DUPLICATE_KEEP_ROW_NOT_IN_GROUP');
    const selectedItem = findSelectedDuplicateSource(sourceRecords, group.fingerprint, decision.keep_source_row);
    if (!selectedItem) fail('MIG010_REPAIR_DUPLICATE_SELECTED_SOURCE_NOT_FOUND');
    selected.push(selectedItem);
    group.members.forEach((candidate) => {
      if (candidate.source_row === decision.keep_source_row) return;
      duplicateQuarantine.push(Object.freeze({
        ...candidate,
        reason: 'OWNER_CONFIRMED_DUPLICATE_RESUBMISSION',
        source_fingerprint: group.fingerprint
      }));
    });
  }

  const sortedBlockers = Array.from(new Set(blockers)).sort();
  const ordinaryCandidate = selected.map((item) => defaultSourceToCanonical(item.raw));
  const occurrenceCandidate = occurrenceSelected.map(({ item, occurrence_ordinal: ordinal }) =>
    occurrenceCanonicalFromSourceItem(item, ordinal));
  const candidate = sortedBlockers.length === 0
    ? validateCanonicalCollection([...ordinaryCandidate, ...occurrenceCandidate])
    : Object.freeze([]);
  const quarantine = Object.freeze([
    ...classified.invalid.map((item) => Object.freeze({ ...item, disposition: 'QUARANTINE_EXPLAINED' })),
    ...duplicateQuarantine
  ]);
  const identity = {
    proposal_hash: proposal.proposal_hash,
    source_revision: proposal.source_revision,
    target_revision: proposal.target_revision,
    strategy: proposal.strategy,
    blockers: sortedBlockers,
    resolution: resolution.duplicate_decisions,
    candidate_identities: candidate.map((tx) => ({
      transaction_id: tx.transaction_id,
      source_record_id: tx.provenance.source_record_id,
      source_fingerprint: tx.provenance.source_fingerprint,
      identity_strategy: tx.provenance.identity_strategy,
      source_position: tx.provenance.source_position
    })),
    quarantine
  };

  return Object.freeze({
    schema: RESOLVED_SCHEMA,
    status: sortedBlockers.length === 0 ? 'READY_FOR_REBUILD_DRY_RUN' : 'BLOCKED',
    resolved_hash: sha256(identity),
    proposal_hash: proposal.proposal_hash,
    source_revision: proposal.source_revision,
    target_revision: proposal.target_revision,
    strategy: proposal.strategy,
    blockers: Object.freeze(sortedBlockers),
    canonical_candidate: candidate,
    quarantine,
    target_scope: proposal.target_scope,
    occurrence_identity_strategy: occurrenceSelected.length > 0 ? OCCURRENCE_IDENTITY : null,
    write_authorized: false
  });
}

module.exports = {
  POLICY,
  PROPOSAL_SCHEMA,
  RESOLUTION_SCHEMA,
  RESOLVED_SCHEMA,
  OCCURRENCE_IDENTITY,
  assertPolicy,
  classifySources,
  buildRepairProposal,
  findSelectedDuplicateSource,
  duplicateSourceItems,
  occurrenceCanonicalFromSourceItem,
  applyRepairResolution
};
