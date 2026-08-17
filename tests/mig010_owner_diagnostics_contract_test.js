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
const { normalizeCanonicalTransaction } = require('../lib/domain/canonical_transaction');
const { privateStateFromPlan } = require('../tools/mig010-owner');

const root = path.join(__dirname, '..');
const tool = path.join(root, 'tools', 'mig010-owner.js');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig010-owner-diagnostics-'));
const snapshotPath = path.join(temp, 'snapshot.private.json');
const statePath = path.join(temp, 'state.private.json');
const diagnosticPath = path.join(temp, 'diagnostic.private.json');
const PRIVATE_SOURCE_SHEET = 'PRIVATE-SYNTHETIC-SOURCE-CANARY';
const PRIVATE_TRANSACTION_ID = 'PRIVATE-SYNTHETIC-TX-CANARY';

function source(row, overrides = {}) {
  return {
    source_system: 'SYN-FORM',
    source_sheet: PRIVATE_SOURCE_SHEET,
    source_row: row,
    transform_version: 'SOURCE-TRANSFORM-v1',
    occurred_at: '2025-01-01T10:00:00Z',
    type: 'expense',
    amount_minor: 2500,
    currency: 'RUB',
    account_id: 'ACC-MAIN',
    destination_account_id: '',
    category_id: 'CAT-HOME',
    name: 'PRIVATE-SYNTHETIC-DESCRIPTION',
    source_quality: 'VALID',
    ...overrides
  };
}

function run(args) {
  const result = spawnSync(process.execPath, [tool, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env }
  });
  const stdout = String(result.stdout || '').trim();
  let payload = null;
  try { payload = JSON.parse(stdout); } catch (_) { /* caller asserts */ }
  return { ...result, stdout, payload };
}

try {
  const coreSource = source(2, { name: 'PRIVATE-CORE-SOURCE' });
  const duplicateA = source(3, { name: 'PRIVATE-DUPLICATE-SOURCE', amount_minor: 3300 });
  const duplicateB = source(4, { name: 'PRIVATE-DUPLICATE-SOURCE', amount_minor: 3300 });
  const invalidSource = {
    source_system: 'SYN-FORM',
    source_sheet: PRIVATE_SOURCE_SHEET,
    source_row: 5,
    transform_version: 'SOURCE-TRANSFORM-v1',
    source_quality: 'INVALID'
  };
  const absentSource = source(99, { name: 'PRIVATE-MISSING-SOURCE', amount_minor: 9900 });

  const coreCanonical = normalizeCanonicalTransaction({
    ...defaultSourceToCanonical(coreSource),
    transaction_id: PRIVATE_TRANSACTION_ID,
    amount_minor: coreSource.amount_minor + 1
  });
  const missingCanonical = defaultSourceToCanonical(absentSource);
  const sources = [coreSource, duplicateA, duplicateB, invalidSource];
  const canonicals = [coreCanonical, missingCanonical];
  const backupHash = 'c'.repeat(64);

  const plan = buildMigrationPlan({
    source_records: sources,
    canonical_records: canonicals,
    mapping_version: 'SYN-DIAGNOSTIC-v1',
    backup_binding: {
      schema: 'DR-001-EVIDENCE-v1',
      status: 'PASS',
      checksum: 'PASS',
      backupCipherSha256: backupHash
    },
    batch_size: 100
  });
  assert.strictEqual(plan.status, 'BLOCKED');
  for (const reason of ['CORE_MISMATCH', 'SOURCE_DUPLICATE', 'SOURCE_INVALID', 'SOURCE_MISSING']) {
    assert(plan.blocked_reasons.includes(reason), `missing synthetic blocker ${reason}`);
  }
  assert.strictEqual(plan.batches.length, 0);

  fs.writeFileSync(snapshotPath, `${JSON.stringify({
    schema: 'MIG010_OWNER_PRIVATE_SNAPSHOT_V1',
    mapping_version: 'SYN-DIAGNOSTIC-v1',
    backup_cipher_sha256: backupHash,
    source_records: sources,
    canonical_records: canonicals
  }, null, 2)}\n`, { mode: 0o600 });
  fs.writeFileSync(statePath, `${JSON.stringify(privateStateFromPlan(plan, null), null, 2)}\n`, { mode: 0o600 });

  let result = run(['diagnose', '--snapshot', snapshotPath, '--state', statePath, '--out', diagnosticPath]);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(result.payload.schema, 'MIG010_OWNER_DIAGNOSTIC_V1');
  assert.strictEqual(result.payload.status, 'DIAGNOSTIC_WRITTEN');
  assert.strictEqual(result.payload.planHash, plan.plan_hash);
  assert.deepStrictEqual(result.payload.blockedReasons, [...plan.blocked_reasons].sort());
  assert.strictEqual(result.payload.diagnosticWritten, true);
  assert.strictEqual(result.payload.detailedFindingsStdout, false);
  assert.strictEqual(result.payload.financialPayloadStdout, false);
  assert.strictEqual(result.payload.writeAuthorized, false);
  assert(!result.stdout.includes(PRIVATE_SOURCE_SHEET));
  assert(!result.stdout.includes(PRIVATE_TRANSACTION_ID));
  assert(!result.stdout.includes('source_row'));
  assert(!result.stdout.includes('core_diff_fields'));
  assert(!Object.prototype.hasOwnProperty.call(result.payload, 'sourceFindingCount'));
  assert(!Object.prototype.hasOwnProperty.call(result.payload, 'targetFindingCount'));

  const diagnostic = JSON.parse(fs.readFileSync(diagnosticPath, 'utf8'));
  assert.strictEqual(diagnostic.schema, 'MIG010_OWNER_PRIVATE_DIAGNOSTIC_V1');
  assert.strictEqual(diagnostic.plan_hash, plan.plan_hash);
  assert.strictEqual(diagnostic.plan_status, 'BLOCKED');
  assert.strictEqual(diagnostic.write_authorized, false);
  assert(diagnostic.source_findings.some((item) => item.reason === 'SOURCE_DUPLICATE'));
  assert(diagnostic.source_findings.some((item) => item.reason === 'SOURCE_INVALID'));
  assert(diagnostic.target_findings.some((item) => item.reason === 'CORE_MISMATCH'));
  assert(diagnostic.target_findings.some((item) => item.reason === 'SOURCE_MISSING'));
  assert(diagnostic.target_findings.some((item) => item.transaction_id === PRIVATE_TRANSACTION_ID));

  const tamperedState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  tamperedState.plan.plan_hash = 'd'.repeat(64);
  const tamperedPath = path.join(temp, 'tampered-state.private.json');
  fs.writeFileSync(tamperedPath, JSON.stringify(tamperedState), { mode: 0o600 });
  result = run(['diagnose', '--snapshot', snapshotPath, '--state', tamperedPath, '--out', path.join(temp, 'must-not-write.private.json')]);
  assert.notStrictEqual(result.status, 0);
  assert.strictEqual(result.payload.reason, 'MIG010_DIAGNOSTIC_STATE_BINDING_INVALID');

  result = run(['diagnose', '--snapshot', snapshotPath, '--state', statePath, '--out', path.join(root, '.mig010-diagnostic-must-not-exist')]);
  assert.notStrictEqual(result.status, 0);
  assert.strictEqual(result.payload.reason, 'MIG010_PRIVATE_DIAGNOSTIC_INSIDE_REPOSITORY');
  assert.strictEqual(fs.existsSync(path.join(root, '.mig010-diagnostic-must-not-exist')), false);

  console.log('mig010_owner_diagnostics_contract_test: OK', {
    exactPlanBinding: true,
    blockedReasonsPublicSafe: true,
    detailedFindingsPrivateOnly: true,
    privateDiagnosticOutsideRepository: true,
    writeAuthorized: false
  });
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
