'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  buildRepairProposal,
  applyRepairResolution,
  RESOLUTION_SCHEMA
} = require('../lib/migration/mig010_repair_policy');
const { sourceRevision } = require('../lib/migration/full_history_migration');

const root = path.join(__dirname, '..');
const tool = path.join(root, 'tools', 'mig010-rebuild-dry-run.js');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig010-rebuild-dry-run-'));
const snapshotPath = path.join(temp, 'snapshot.private.json');
const proposalPath = path.join(temp, 'proposal.private.json');
const resolutionPath = path.join(temp, 'resolution.private.json');
const resolvedPath = path.join(temp, 'resolved.private.json');
const tamperedPath = path.join(temp, 'tampered.private.json');
const CANARY = 'PRIVATE-REBUILD-CANARY';

function source(row, overrides = {}) {
  return {
    source_system: 'SYN-FORM', source_sheet: 'SYN-LEGACY', source_row: row,
    transform_version: 'SOURCE-TRANSFORM-v1', occurred_at: '2025-06-01T10:00:00Z',
    type: 'expense', amount_minor: 2500, currency: 'RUB', account_id: 'ACC-MAIN',
    destination_account_id: '', category_id: 'CAT-HOME', name: CANARY,
    source_quality: 'VALID', ...overrides
  };
}

function run(args) {
  const result = spawnSync(process.execPath, [tool, ...args], { cwd: root, encoding: 'utf8' });
  const stdout = String(result.stdout || '').trim();
  let payload = null;
  try { payload = JSON.parse(stdout); } catch (_) { /* asserted below */ }
  return { ...result, stdout, payload };
}

try {
  let result = run(['contract']);
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.payload.schema, 'MIG010_REBUILD_DRY_RUN_TOOL_V1');
  assert.strictEqual(result.payload.writeCommandEnabled, false);
  assert.strictEqual(result.payload.financialPayloadStdout, false);

  const unique = source(2, { occurred_at: '2025-06-01T09:00:00Z', name: 'Unique synthetic' });
  const duplicateA = source(3);
  const duplicateB = source(4);
  const invalid = {
    source_system: 'SYN-FORM', source_sheet: 'SYN-LEGACY', source_row: 5,
    transform_version: 'SOURCE-TRANSFORM-v1', source_quality: 'INVALID'
  };
  const sources = [unique, duplicateA, duplicateB, invalid];
  const snapshot = {
    schema: 'MIG010_OWNER_PRIVATE_SNAPSHOT_V1',
    mapping_version: 'SYN-REBUILD-v1',
    backup_cipher_sha256: 'c'.repeat(64),
    source_records: sources,
    canonical_records: []
  };
  const proposal = buildRepairProposal({
    source_records: sources,
    canonical_records: [],
    plan_hash: 'a'.repeat(64),
    source_revision: sourceRevision(sources),
    target_revision: 'b'.repeat(64),
    backup_cipher_sha256: snapshot.backup_cipher_sha256,
    mapping_version: snapshot.mapping_version
  });
  const resolution = {
    schema: RESOLUTION_SCHEMA,
    proposal_hash: proposal.proposal_hash,
    source_revision: proposal.source_revision,
    duplicate_decisions: [{
      fingerprint: proposal.duplicate_groups[0].fingerprint,
      decision: 'PRESERVE_ALL'
    }]
  };
  const resolved = applyRepairResolution({ proposal, source_records: sources, resolution });
  assert.strictEqual(resolved.status, 'READY_FOR_REBUILD_DRY_RUN');
  assert.strictEqual(resolved.write_authorized, false);

  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
  fs.writeFileSync(proposalPath, JSON.stringify(proposal, null, 2), { mode: 0o600 });
  fs.writeFileSync(resolutionPath, JSON.stringify(resolution, null, 2), { mode: 0o600 });
  fs.writeFileSync(resolvedPath, JSON.stringify(resolved, null, 2), { mode: 0o600 });

  result = run([
    'verify', '--snapshot', snapshotPath, '--proposal', proposalPath,
    '--resolution', resolutionPath, '--resolved', resolvedPath
  ]);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(result.payload.schema, 'MIG010_OWNER_REBUILD_DRY_RUN_V1');
  assert.strictEqual(result.payload.status, 'PASS');
  assert.strictEqual(result.payload.reconciliationReady, true);
  assert.strictEqual(result.payload.writeAuthorized, false);
  assert.strictEqual(result.payload.financialPayloadStdout, false);
  assert(/^[0-9a-f]{64}$/.test(result.payload.candidateRevisionHash));
  assert(!result.stdout.includes(CANARY));
  assert(!Object.prototype.hasOwnProperty.call(result.payload, 'candidateCount'));
  assert(!Object.prototype.hasOwnProperty.call(result.payload, 'quarantineCount'));

  fs.writeFileSync(tamperedPath, JSON.stringify({ ...resolved, resolved_hash: 'd'.repeat(64) }, null, 2), { mode: 0o600 });
  result = run([
    'verify', '--snapshot', snapshotPath, '--proposal', proposalPath,
    '--resolution', resolutionPath, '--resolved', tamperedPath
  ]);
  assert.notStrictEqual(result.status, 0);
  assert.strictEqual(result.payload.reason, 'MIG010_REBUILD_RESOLVED_BINDING_INVALID');

  for (const command of ['execute', 'write', 'apply']) {
    result = run([command]);
    assert.notStrictEqual(result.status, 0);
    assert.strictEqual(result.payload.reason, 'MIGRATION_IRREVERSIBLE_ACTION_TOOL_NOT_ENABLED');
  }

  console.log('mig010_rebuild_dry_run_contract_test: OK', {
    ownerResolutionRecomputed: true,
    exactResolvedBinding: true,
    occurrenceCanonicalValidation: true,
    migrationFingerprintParity: true,
    stdoutPayload: false,
    writeCommandsEnabled: false
  });
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
