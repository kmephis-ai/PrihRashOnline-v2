'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  buildMigrationPlan,
  defaultSourceToCanonical
} = require('../lib/migration/full_history_migration');

const root = path.join(__dirname, '..');
const tool = path.join(root, 'tools', 'mig010-repair.js');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig010-repair-tool-'));
const snapshotPath = path.join(temp, 'snapshot.private.json');
const statePath = path.join(temp, 'state.private.json');
const diagnosticPath = path.join(temp, 'diagnostic.private.json');
const proposalPath = path.join(temp, 'proposal.private.json');
const reviewPath = path.join(temp, 'review.private.html');
const resolutionPath = path.join(temp, 'resolution.private.json');
const resolvedPath = path.join(temp, 'resolved.private.json');
const CANARY = 'PRIVATE-REPAIR-CANARY-DESCRIPTION';

function run(args) {
  const result = spawnSync(process.execPath, [tool, ...args], { cwd: root, encoding: 'utf8' });
  const stdout = String(result.stdout || '').trim();
  let payload = null;
  try { payload = JSON.parse(stdout); } catch (_) { /* asserted below */ }
  return { ...result, stdout, payload };
}

function source(row, overrides = {}) {
  return {
    source_system: 'SYN-FORM', source_sheet: 'SYN-LEGACY', source_row: row,
    transform_version: 'SOURCE-TRANSFORM-v1', occurred_at: '2025-04-01T10:00:00Z',
    type: 'expense', amount_minor: 3333, currency: 'RUB', account_id: 'ACC-MAIN',
    destination_account_id: '', category_id: 'CAT-HOME', name: CANARY,
    source_quality: 'VALID', ...overrides
  };
}

try {
  let result = run(['contract']);
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.payload.schema, 'MIG010_REPAIR_TOOL_V1');
  assert.strictEqual(result.payload.writeCommandEnabled, false);
  assert.strictEqual(result.payload.offlineDuplicateReview, true);

  const unique = source(2, { occurred_at: '2025-04-01T09:00:00Z', name: 'Unique synthetic' });
  const duplicateA = source(3);
  const duplicateB = source(4);
  const invalid = {
    source_system: 'SYN-FORM', source_sheet: 'SYN-LEGACY', source_row: 5,
    transform_version: 'SOURCE-TRANSFORM-v1', source_quality: 'INVALID'
  };
  const sources = [unique, duplicateA, duplicateB, invalid];
  const target = [defaultSourceToCanonical(unique)];
  const backupHash = 'c'.repeat(64);
  const plan = buildMigrationPlan({
    source_records: sources,
    canonical_records: target,
    mapping_version: 'SYN-REPAIR-TOOL-v1',
    backup_binding: { schema: 'DR-001-EVIDENCE-v1', status: 'PASS', checksum: 'PASS', backupCipherSha256: backupHash }
  });
  assert.strictEqual(plan.status, 'BLOCKED');

  fs.writeFileSync(snapshotPath, JSON.stringify({
    schema: 'MIG010_OWNER_PRIVATE_SNAPSHOT_V1', mapping_version: 'SYN-REPAIR-TOOL-v1',
    backup_cipher_sha256: backupHash, source_records: sources, canonical_records: target
  }, null, 2), { mode: 0o600 });
  fs.writeFileSync(statePath, JSON.stringify({
    schema: 'MIG010_OWNER_PRIVATE_STATE_V1',
    plan: {
      schema: plan.schema, version: plan.version, status: plan.status,
      source_revision: plan.source_revision, initial_target_revision: plan.initial_target_revision,
      transform_version: plan.transform_version, mapping_version: plan.mapping_version,
      backup_binding: plan.backup_binding, batch_size: plan.batch_size, plan_hash: plan.plan_hash,
      dry_run: plan.dry_run, blocked_reasons: plan.blocked_reasons, batches: plan.batches
    },
    resume_token: null
  }, null, 2), { mode: 0o600 });
  fs.writeFileSync(diagnosticPath, JSON.stringify({
    schema: 'MIG010_OWNER_PRIVATE_DIAGNOSTIC_V1', plan_hash: plan.plan_hash,
    source_revision: plan.source_revision, target_revision: plan.initial_target_revision,
    plan_status: 'BLOCKED', blocked_reasons: ['SOURCE_DUPLICATE', 'SOURCE_INVALID'],
    source_findings: [], target_findings: [], reconciliation_summary: {}, write_authorized: false
  }, null, 2), { mode: 0o600 });

  result = run([
    'propose', '--snapshot', snapshotPath, '--state', statePath, '--diagnostic', diagnosticPath,
    '--proposal', proposalPath, '--review', reviewPath
  ]);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(result.payload.schema, 'MIG010_OWNER_REPAIR_PROPOSAL_V1');
  assert.strictEqual(result.payload.status, 'OWNER_DECISION_REQUIRED');
  assert.strictEqual(result.payload.manualDecisionRequired, true);
  assert.strictEqual(result.payload.reviewWritten, true);
  assert.strictEqual(result.payload.financialPayloadStdout, false);
  assert.strictEqual(result.payload.writeAuthorized, false);
  assert(!result.stdout.includes(CANARY));
  assert.strictEqual(fs.existsSync(proposalPath), true);
  assert.strictEqual(fs.existsSync(reviewPath), true);
  const review = fs.readFileSync(reviewPath, 'utf8');
  assert(review.includes(CANARY), 'private offline review should contain private duplicate context');
  assert(review.includes('MIG010_OWNER_PRIVATE_REPAIR_RESOLUTION_V1'));
  assert(!/https?:\/\//.test(review), 'offline review must not depend on network resources');

  const proposal = JSON.parse(fs.readFileSync(proposalPath, 'utf8'));
  assert.strictEqual(proposal.write_authorized, false);
  assert.strictEqual(proposal.duplicate_groups.length, 1);
  fs.writeFileSync(resolutionPath, JSON.stringify({
    schema: 'MIG010_OWNER_PRIVATE_REPAIR_RESOLUTION_V1',
    proposal_hash: proposal.proposal_hash,
    source_revision: proposal.source_revision,
    duplicate_decisions: [{
      fingerprint: proposal.duplicate_groups[0].fingerprint,
      decision: 'DEDUPLICATE_KEEP_ONE',
      keep_source_row: 3
    }]
  }, null, 2), { mode: 0o600 });

  result = run([
    'resolve', '--snapshot', snapshotPath, '--proposal', proposalPath,
    '--resolution', resolutionPath, '--out', resolvedPath
  ]);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(result.payload.schema, 'MIG010_OWNER_REPAIR_RESOLVE_V1');
  assert.strictEqual(result.payload.status, 'READY_FOR_REBUILD_DRY_RUN');
  assert.strictEqual(result.payload.targetRebuild, true);
  assert.strictEqual(result.payload.quarantinePresent, true);
  assert.strictEqual(result.payload.writeAuthorized, false);
  assert(!result.stdout.includes(CANARY));
  const resolved = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  assert.strictEqual(resolved.status, 'READY_FOR_REBUILD_DRY_RUN');
  assert.strictEqual(resolved.canonical_candidate.length, 2);
  assert.strictEqual(resolved.write_authorized, false);

  for (const command of ['execute', 'write', 'apply']) {
    result = run([command]);
    assert.notStrictEqual(result.status, 0);
    assert.strictEqual(result.payload.reason, 'MIGRATION_IRREVERSIBLE_ACTION_TOOL_NOT_ENABLED');
  }

  console.log('mig010_repair_tool_contract_test: OK', {
    privateProposal: true,
    offlineDuplicateReview: true,
    networkDependency: false,
    stdoutPayload: false,
    ownerResolutionBound: true,
    quarantine: true,
    targetRebuild: true,
    writeCommandsEnabled: false
  });
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
