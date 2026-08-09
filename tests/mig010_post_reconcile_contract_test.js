'use strict';

const assert = require('assert');
const {
  buildRepairProposal,
  applyRepairResolution,
  RESOLUTION_SCHEMA
} = require('../lib/migration/mig010_repair_policy');
const { sourceRevision } = require('../lib/migration/full_history_migration');
const { repositoryRevision } = require('../lib/repository/transaction_repository');
const { rawTableHash } = require('../tools/mig010-execution-package');
const {
  EVIDENCE_SCHEMA,
  verifyPostReconciliation,
  commandContract
} = require('../tools/mig010-post-reconcile');

function source(row, amount = 4200) {
  return {
    source_system: 'SYN-FORM',
    source_sheet: 'SYN-LEGACY',
    source_row: row,
    transform_version: 'SOURCE-TRANSFORM-v1',
    occurred_at: '2025-07-01T10:00:00Z',
    type: 'expense',
    amount_minor: amount,
    currency: 'RUB',
    account_id: 'ACC-MAIN',
    destination_account_id: '',
    category_id: 'CAT-HOME',
    name: 'Synthetic post reconcile',
    source_quality: 'VALID'
  };
}
function sc(value) { return { t: 's', v: String(value) }; }
function nc(value) { return { t: 'n', v: value }; }

const sources = [source(10), source(11)];
const proposal = buildRepairProposal({
  source_records: sources,
  canonical_records: [],
  plan_hash: 'a'.repeat(64),
  source_revision: sourceRevision(sources),
  target_revision: 'b'.repeat(64),
  backup_cipher_sha256: 'c'.repeat(64),
  mapping_version: 'SYN-POST-v1'
});
const resolution = {
  schema: RESOLUTION_SCHEMA,
  proposal_hash: proposal.proposal_hash,
  source_revision: proposal.source_revision,
  duplicate_decisions: proposal.duplicate_groups.map((group) => ({ fingerprint: group.fingerprint, decision: 'PRESERVE_ALL' }))
};
const resolved = applyRepairResolution({ proposal, source_records: sources, resolution });
assert.strictEqual(resolved.status, 'READY_FOR_REBUILD_DRY_RUN');

const targetRows = [
  Array.from({ length: 20 }, (_, index) => sc(`H${index + 1}`)),
  [sc('SYN-TX'), sc('2025-07-01'), sc(''), sc(''), sc('Расход'), nc(42), sc('A'), sc(''), sc('C'), sc(''), sc('N'), sc(''), sc(''), sc(''), sc(''), sc(''), sc('SYN'), nc(10), sc('Перенесено'), sc('Расход')]
];
const finalRaw = rawTableHash(targetRows);
const packageValue = {
  schema: 'MIG010_OWNER_EXECUTION_PACKAGE_V1',
  package_hash: 'd'.repeat(64),
  resolved_hash: resolved.resolved_hash,
  source_revision_hash: sourceRevision(sources),
  candidate_revision_hash: repositoryRevision(resolved.canonical_candidate),
  final_raw_table_hash: finalRaw,
  target_sheet_name: 'SYN-TARGET',
  write_authorized: false
};
const pkg = {
  format: 'PRH_PORTABLE_BACKUP_V1',
  content: { sheets: [{ metadata: { name: 'SYN-TARGET' }, rows: targetRows }] }
};
const mapper = { buildSnapshot: () => ({ source_records: sources, canonical_records: [] }) };

const evidence = verifyPostReconciliation({
  pkg,
  freshCipherSha256: 'e'.repeat(64),
  mapper,
  mappingVersion: 'SYN-POST-v1',
  packageValue,
  proposal,
  resolution,
  resolved
});
assert.strictEqual(evidence.schema, EVIDENCE_SCHEMA);
assert.strictEqual(evidence.status, 'PASS');
assert.strictEqual(evidence.unexplainedMismatch, 0);
assert.strictEqual(evidence.provenanceComplete, true);
assert.strictEqual(evidence.idempotentRerunNoop, true);
assert.strictEqual(evidence.rollbackCanBeReleased, true);
assert.strictEqual(evidence.financialPayloadStdout, false);

assert.throws(
  () => verifyPostReconciliation({
    pkg: { ...pkg, content: { sheets: [{ metadata: { name: 'SYN-TARGET' }, rows: [targetRows[0], [...targetRows[1].slice(0, 5), nc(43), ...targetRows[1].slice(6)]] }] } },
    freshCipherSha256: 'e'.repeat(64), mapper, mappingVersion: 'SYN-POST-v1', packageValue, proposal, resolution, resolved
  }),
  /MIG010_POST_RECONCILE_FINAL_RAW_HASH_MISMATCH/
);

const changedSources = [source(10), source(11, 4300)];
assert.throws(
  () => verifyPostReconciliation({
    pkg,
    freshCipherSha256: 'e'.repeat(64),
    mapper: { buildSnapshot: () => ({ source_records: changedSources, canonical_records: [] }) },
    mappingVersion: 'SYN-POST-v1', packageValue, proposal, resolution, resolved
  }),
  /MIG010_POST_RECONCILE_SOURCE_REVISION_CHANGED/
);

const contract = commandContract();
assert.strictEqual(contract.freshEncryptedBackupRequired, true);
assert.strictEqual(contract.requiredUnexplainedMismatch, 0);
assert.strictEqual(contract.idempotentRerunNoopRequired, true);
assert.strictEqual(contract.writeCommandEnabled, false);

console.log('mig010_post_reconcile_contract_test: OK', {
  freshBackupRequired: true,
  sourceRevisionBound: true,
  resolvedCandidateBound: true,
  finalRawTableBound: true,
  unexplainedMismatch: 0,
  idempotentRerunNoop: true,
  rollbackReleaseAfterPassOnly: true
});
