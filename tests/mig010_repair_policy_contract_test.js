'use strict';

const assert = require('assert');
const {
  defaultSourceToCanonical,
  sourceRevision
} = require('../lib/migration/full_history_migration');
const {
  buildRepairProposal,
  applyRepairResolution,
  PROPOSAL_SCHEMA,
  RESOLUTION_SCHEMA,
  RESOLVED_SCHEMA,
  OCCURRENCE_IDENTITY
} = require('../lib/migration/mig010_repair_policy');

function source(row, overrides = {}) {
  return {
    source_system: 'SYN-FORM',
    source_sheet: 'SYN-LEGACY',
    source_row: row,
    transform_version: 'SOURCE-TRANSFORM-v1',
    occurred_at: '2025-03-01T10:00:00Z',
    type: 'expense',
    amount_minor: 1234,
    currency: 'RUB',
    account_id: 'ACC-MAIN',
    destination_account_id: '',
    category_id: 'CAT-HOME',
    name: 'Synthetic repair fixture',
    source_quality: 'VALID',
    ...overrides
  };
}

const unique = source(2, { occurred_at: '2025-03-01T09:00:00Z', amount_minor: 5000, name: 'Unique' });
const duplicateA = source(3);
const duplicateB = source(4);
const invalid = {
  source_system: 'SYN-FORM',
  source_sheet: 'SYN-LEGACY',
  source_row: 5,
  transform_version: 'SOURCE-TRANSFORM-v1',
  source_quality: 'INVALID'
};
const sources = [unique, duplicateA, duplicateB, invalid];
const existing = [defaultSourceToCanonical(unique)];
const binding = {
  source_records: sources,
  canonical_records: existing,
  plan_hash: 'a'.repeat(64),
  source_revision: sourceRevision(sources),
  target_revision: 'b'.repeat(64),
  backup_cipher_sha256: 'c'.repeat(64),
  mapping_version: 'SYN-REPAIR-v1'
};

const proposal = buildRepairProposal(binding);
assert.strictEqual(proposal.schema, PROPOSAL_SCHEMA);
assert.strictEqual(proposal.policy_version, '1.1.0');
assert.strictEqual(proposal.status, 'OWNER_DECISION_REQUIRED');
assert.strictEqual(proposal.strategy, 'REBUILD_LEGACY_SLICE_V1');
assert.strictEqual(proposal.manual_decision_required, true);
assert.strictEqual(proposal.write_authorized, false);
assert.strictEqual(proposal.duplicate_groups.length, 1);
assert.strictEqual(proposal.duplicate_groups[0].members.length, 2);
assert.deepStrictEqual(proposal.duplicate_groups[0].members.map((item) => item.source_row), [3, 4]);
assert.strictEqual(proposal.invalid_quarantine.length, 1);
assert.strictEqual(proposal.invalid_quarantine[0].source_row, 5);
assert.strictEqual(proposal.unique_candidate.length, 1);
assert.strictEqual(proposal.target_scope.length, 1);

const duplicateFingerprint = proposal.duplicate_groups[0].fingerprint;
const resolution = {
  schema: RESOLUTION_SCHEMA,
  proposal_hash: proposal.proposal_hash,
  source_revision: proposal.source_revision,
  duplicate_decisions: [{
    fingerprint: duplicateFingerprint,
    decision: 'DEDUPLICATE_KEEP_ONE',
    keep_source_row: 3
  }]
};
const resolved = applyRepairResolution({ proposal, source_records: sources, resolution });
assert.strictEqual(resolved.schema, RESOLVED_SCHEMA);
assert.strictEqual(resolved.status, 'READY_FOR_REBUILD_DRY_RUN');
assert.strictEqual(resolved.write_authorized, false);
assert.strictEqual(resolved.blockers.length, 0);
assert.strictEqual(resolved.canonical_candidate.length, 2);
assert.strictEqual(resolved.quarantine.some((item) => item.reason === 'SOURCE_INVALID' || item.disposition === 'QUARANTINE_EXPLAINED'), true);
assert.strictEqual(resolved.quarantine.some((item) => item.reason === 'OWNER_CONFIRMED_DUPLICATE_RESUBMISSION' && item.source_row === 4), true);
assert.strictEqual(resolved.canonical_candidate.some((tx) => tx.provenance.source_position === 'row:3'), true);
assert.strictEqual(resolved.canonical_candidate.some((tx) => tx.provenance.source_position === 'row:4'), false);
assert.strictEqual(resolved.occurrence_identity_strategy, null);

const preserveAll = applyRepairResolution({
  proposal,
  source_records: sources,
  resolution: {
    schema: RESOLUTION_SCHEMA,
    proposal_hash: proposal.proposal_hash,
    source_revision: proposal.source_revision,
    duplicate_decisions: [{ fingerprint: duplicateFingerprint, decision: 'PRESERVE_ALL' }]
  }
});
assert.strictEqual(preserveAll.status, 'READY_FOR_REBUILD_DRY_RUN');
assert.strictEqual(preserveAll.blockers.length, 0);
assert.strictEqual(preserveAll.canonical_candidate.length, 3);
assert.strictEqual(preserveAll.occurrence_identity_strategy, OCCURRENCE_IDENTITY);
const preservedDuplicates = preserveAll.canonical_candidate.filter((tx) => tx.provenance.source_fingerprint === duplicateFingerprint);
assert.strictEqual(preservedDuplicates.length, 2);
assert(preservedDuplicates.every((tx) => tx.provenance.identity_strategy === OCCURRENCE_IDENTITY));
assert.notStrictEqual(preservedDuplicates[0].transaction_id, preservedDuplicates[1].transaction_id);
assert.notStrictEqual(preservedDuplicates[0].provenance.source_record_id, preservedDuplicates[1].provenance.source_record_id);
assert.strictEqual(preserveAll.quarantine.some((item) => item.reason === 'OWNER_CONFIRMED_DUPLICATE_RESUBMISSION'), false);

const preserveAllAgain = applyRepairResolution({
  proposal,
  source_records: sources,
  resolution: {
    schema: RESOLUTION_SCHEMA,
    proposal_hash: proposal.proposal_hash,
    source_revision: proposal.source_revision,
    duplicate_decisions: [{ fingerprint: duplicateFingerprint, decision: 'PRESERVE_ALL' }]
  }
});
assert.strictEqual(preserveAllAgain.resolved_hash, preserveAll.resolved_hash,
  'owner-confirmed occurrence rebuild must be deterministic');
assert.deepStrictEqual(
  preserveAllAgain.canonical_candidate.map((tx) => tx.transaction_id),
  preserveAll.canonical_candidate.map((tx) => tx.transaction_id)
);

const unresolved = applyRepairResolution({
  proposal,
  source_records: sources,
  resolution: {
    schema: RESOLUTION_SCHEMA,
    proposal_hash: proposal.proposal_hash,
    source_revision: proposal.source_revision,
    duplicate_decisions: [{ fingerprint: duplicateFingerprint, decision: 'UNRESOLVED' }]
  }
});
assert.strictEqual(unresolved.status, 'BLOCKED');
assert(unresolved.blockers.includes('SOURCE_DUPLICATE_OWNER_DECISION_REQUIRED'));

assert.throws(() => applyRepairResolution({
  proposal,
  source_records: sources,
  resolution: {
    schema: RESOLUTION_SCHEMA,
    proposal_hash: 'd'.repeat(64),
    source_revision: proposal.source_revision,
    duplicate_decisions: []
  }
}), /MIG010_REPAIR_RESOLUTION_PROPOSAL_MISMATCH/);

console.log('mig010_repair_policy_contract_test: OK', {
  strategy: proposal.strategy,
  targetLegacyRebuild: true,
  invalidSourceQuarantine: true,
  duplicateOwnerDecisionRequired: true,
  deduplicateKeepOne: true,
  preserveAllOccurrenceIdentity: true,
  preserveAllDeterministic: true,
  occurrenceIdentityStrategy: OCCURRENCE_IDENTITY,
  writeAuthority: false
});
