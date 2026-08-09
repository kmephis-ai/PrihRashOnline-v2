'use strict';

const assert = require('assert');
const {
  buildRepairProposal,
  applyRepairResolution,
  RESOLUTION_SCHEMA,
  OCCURRENCE_IDENTITY,
  COMPATIBLE_PROPOSAL_POLICY_VERSIONS,
  assertProposalPolicyCompatibility
} = require('../lib/migration/mig010_repair_policy');
const { sourceRevision } = require('../lib/migration/full_history_migration');

function source(row) {
  return {
    source_system: 'SYN-FORM',
    source_sheet: 'SYN-LEGACY',
    source_row: row,
    transform_version: 'SOURCE-TRANSFORM-v1',
    occurred_at: '2025-07-01T10:00:00Z',
    type: 'expense',
    amount_minor: 4200,
    currency: 'RUB',
    account_id: 'ACC-MAIN',
    destination_account_id: '',
    category_id: 'CAT-HOME',
    name: 'Synthetic compatibility occurrence',
    source_quality: 'VALID'
  };
}

assert.deepStrictEqual(COMPATIBLE_PROPOSAL_POLICY_VERSIONS, ['1.0.0', '1.1.0']);

const sources = [source(10), source(11)];
const current = buildRepairProposal({
  source_records: sources,
  canonical_records: [],
  plan_hash: 'a'.repeat(64),
  source_revision: sourceRevision(sources),
  target_revision: 'b'.repeat(64),
  backup_cipher_sha256: 'c'.repeat(64),
  mapping_version: 'SYN-COMPAT-v1'
});
assert.strictEqual(current.policy_version, '1.1.0');
assert.strictEqual(assertProposalPolicyCompatibility(current), true);

// Simulate an exact owner-private proposal created under the previous repair policy.
// The proposal hash is preserved exactly; the current engine does not rewrite it.
const legacyProposal = Object.freeze({ ...current, policy_version: '1.0.0' });
assert.strictEqual(assertProposalPolicyCompatibility(legacyProposal), true);

const preserveAll = {
  schema: RESOLUTION_SCHEMA,
  proposal_hash: legacyProposal.proposal_hash,
  source_revision: legacyProposal.source_revision,
  duplicate_decisions: legacyProposal.duplicate_groups.map((group) => ({
    fingerprint: group.fingerprint,
    decision: 'PRESERVE_ALL'
  }))
};
const resolved = applyRepairResolution({
  proposal: legacyProposal,
  source_records: sources,
  resolution: preserveAll
});
assert.strictEqual(resolved.status, 'READY_FOR_REBUILD_DRY_RUN');
assert.strictEqual(resolved.proposal_hash, legacyProposal.proposal_hash);
assert.strictEqual(resolved.proposal_policy_version, '1.0.0');
assert.strictEqual(resolved.occurrence_identity_strategy, OCCURRENCE_IDENTITY);
assert.strictEqual(resolved.canonical_candidate.length, 2);
assert.strictEqual(resolved.write_authorized, false);
assert(resolved.canonical_candidate.every((tx) => tx.provenance.identity_strategy === OCCURRENCE_IDENTITY));

assert.throws(
  () => assertProposalPolicyCompatibility({ ...legacyProposal, policy_version: '9.9.9' }),
  /MIG010_REPAIR_PROPOSAL_POLICY_INCOMPATIBLE/
);
assert.throws(
  () => applyRepairResolution({
    proposal: { ...legacyProposal, policy_schema: 'UNKNOWN_POLICY' },
    source_records: sources,
    resolution: preserveAll
  }),
  /MIG010_REPAIR_PROPOSAL_POLICY_INCOMPATIBLE/
);

console.log('mig010_repair_policy_compatibility_contract_test: OK', {
  acceptedProposalVersions: COMPATIBLE_PROPOSAL_POLICY_VERSIONS,
  legacyOwnerResolutionReused: true,
  exactProposalHashPreserved: true,
  preserveAllOccurrenceIdentity: true,
  unknownPolicyVersionRejected: true,
  writeAuthority: false
});
