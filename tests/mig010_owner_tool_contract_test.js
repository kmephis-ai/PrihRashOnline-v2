'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { defaultSourceToCanonical } = require('../lib/migration/full_history_migration');
const { buildPortablePackage, writeEncryptedBackup } = require('../tools/private-backup');

const root = path.join(__dirname, '..');
const tool = path.join(root, 'tools', 'mig010-owner.js');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig010-owner-contract-'));
const secretPath = path.join(temp, 'resume.secret');
const backupKeyPath = path.join(temp, 'backup.key');
const backupPath = path.join(temp, 'owner-backup.prhbackup');
const mapperPath = path.join(temp, 'private-mapper.js');
const snapshotPath = path.join(temp, 'snapshot.private.json');
const backupEvidencePath = path.join(temp, 'backup-evidence.private.json');
const statePath = path.join(temp, 'migration-state.private.json');
const PRIVATE_DESCRIPTION = 'PRIVATE-SYNTHETIC-CANARY-DESCRIPTION';

function run(args) {
  const result = spawnSync(process.execPath, [tool, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env }
  });
  const stdout = String(result.stdout || '').trim();
  let payload = null;
  try { payload = JSON.parse(stdout); } catch (_) { /* asserted by caller */ }
  return { ...result, stdout, payload };
}

function source(index) {
  return {
    source_system: 'SYN-FORM',
    source_sheet: 'SYN-PRIVATE-SNAPSHOT',
    source_row: index + 2,
    transform_version: 'SOURCE-TRANSFORM-v1',
    occurred_at: `2025-01-${String(index + 1).padStart(2, '0')}T10:00:00Z`,
    type: index === 0 ? 'income' : 'expense',
    amount_minor: 10000 + index,
    currency: 'RUB',
    account_id: 'ACC-MAIN',
    destination_account_id: '',
    category_id: index === 0 ? 'CAT-INCOME' : 'CAT-HOME',
    name: `${PRIVATE_DESCRIPTION}-${index}`,
    source_quality: 'VALID'
  };
}

try {
  let result = run(['contract']);
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.payload.schema, 'MIG010_OWNER_TOOL_V1');
  assert.strictEqual(result.payload.snapshotFromEncryptedBackup, true);
  assert.strictEqual(result.payload.privatePathsOutsideRepository, true);
  assert.strictEqual(result.payload.writeCommandEnabled, false);
  assert.strictEqual(result.payload.irreversibleActionRequired, true);
  assert.strictEqual(result.payload.realFinancialPayloadStdout, false);

  result = run(['init-secret', '--out', path.join(root, '.mig010-must-not-exist')]);
  assert.notStrictEqual(result.status, 0);
  assert.strictEqual(result.payload.reason, 'MIG010_RESUME_SECRET_INSIDE_REPOSITORY');
  assert.strictEqual(fs.existsSync(path.join(root, '.mig010-must-not-exist')), false);

  result = run(['init-secret', '--out', secretPath]);
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.payload.status, 'SECRET_CREATED');
  assert.strictEqual(fs.existsSync(secretPath), true);

  const sources = [source(0), source(1), source(2)];
  const canonicalRecords = [defaultSourceToCanonical(sources[0])];

  const backupKey = crypto.randomBytes(32);
  fs.writeFileSync(backupKeyPath, `${backupKey.toString('base64')}\n`, { mode: 0o600 });
  const pkg = buildPortablePackage({
    format: 'PRH_BACKUP_SOURCE_V1',
    schemaVersion: 1,
    sheetCount: 1,
    sourceBuildSha: 'a'.repeat(40),
    sourceTreeHash: 'c'.repeat(64)
  }, [{
    metadata: { name: 'SYN-SHEET', index: 0, lastRow: 1, lastColumn: 1 },
    rows: [[{ t: 's', v: 'synthetic-cell' }]]
  }], '2026-08-09T07:30:00.000Z');
  const encrypted = writeEncryptedBackup(backupPath, pkg, backupKey);

  fs.writeFileSync(mapperPath, `'use strict';\n` +
    `module.exports = {\n` +
    `  schema: 'MIG010_OWNER_PRIVATE_MAPPER_V1',\n` +
    `  mappingVersion: 'SYN-PRIVATE-MAPPER-v1',\n` +
    `  buildSnapshot({ backupPackage, cellValue }) {\n` +
    `    if (backupPackage.format !== 'PRH_PORTABLE_BACKUP_V1') throw new Error('MAPPER_BACKUP_INVALID');\n` +
    `    if (cellValue(backupPackage.content.sheets[0].rows[0][0]) !== 'synthetic-cell') throw new Error('MAPPER_CELL_INVALID');\n` +
    `    return ${JSON.stringify({ source_records: sources, canonical_records: canonicalRecords })};\n` +
    `  }\n` +
    `};\n`, { mode: 0o600 });

  result = run([
    'snapshot-from-backup', '--backup', backupPath,
    '--key', backupKeyPath,
    '--mapper', mapperPath,
    '--out', snapshotPath
  ]);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(result.payload.schema, 'MIG010_OWNER_SNAPSHOT_V1');
  assert.strictEqual(result.payload.status, 'SNAPSHOT_CREATED');
  assert.strictEqual(result.payload.backupCipherSha256, encrypted.cipherSha256);
  assert.strictEqual(result.payload.financialPayloadStdout, false);
  assert(!result.stdout.includes(PRIVATE_DESCRIPTION));
  assert.strictEqual(fs.existsSync(snapshotPath), true);

  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  assert.strictEqual(snapshot.schema, 'MIG010_OWNER_PRIVATE_SNAPSHOT_V1');
  assert.strictEqual(snapshot.backup_cipher_sha256, encrypted.cipherSha256);
  assert.strictEqual(snapshot.source_records[0].name.includes(PRIVATE_DESCRIPTION), true);

  fs.writeFileSync(backupEvidencePath, `${JSON.stringify({
    schema: 'DR-001-EVIDENCE-v1',
    status: 'PASS',
    checksum: 'PASS',
    backupCipherSha256: encrypted.cipherSha256
  }, null, 2)}\n`, { mode: 0o600 });

  result = run([
    'dry-run', '--snapshot', snapshotPath,
    '--backup-evidence', backupEvidencePath,
    '--secret', secretPath,
    '--state', statePath,
    '--batch-size', '2'
  ]);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(result.payload.schema, 'MIG010_OWNER_DRY_RUN_V1');
  assert.strictEqual(result.payload.status, 'READY');
  assert.strictEqual(result.payload.writeAuthorized, false);
  assert.strictEqual(result.payload.stateWritten, true);
  assert.strictEqual(result.payload.backupCipherSha256, encrypted.cipherSha256);
  assert(/^[0-9a-f]{64}$/.test(result.payload.planHash));
  assert(!result.stdout.includes(PRIVATE_DESCRIPTION), 'stdout must not expose private source descriptions');
  assert(!result.stdout.includes('source_records'), 'stdout must not expose private source records');
  assert(!Object.prototype.hasOwnProperty.call(result.payload, 'sourceCount'));
  assert(!Object.prototype.hasOwnProperty.call(result.payload, 'insertCount'));
  assert.strictEqual(fs.existsSync(statePath), true);

  const privateState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.strictEqual(privateState.schema, 'MIG010_OWNER_PRIVATE_STATE_V1');
  assert.strictEqual(privateState.plan.status, 'READY');
  assert.strictEqual(privateState.plan.batches.length, 1);
  assert(privateState.plan.batches[0][0].description.includes(PRIVATE_DESCRIPTION), 'private state may retain payload owner-locally');

  result = run(['verify-state', '--state', statePath, '--secret', secretPath]);
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.payload.status, 'PASS');
  assert.strictEqual(result.payload.resumeBound, true);
  assert.strictEqual(result.payload.writeAuthorized, false);
  assert(!result.stdout.includes(PRIVATE_DESCRIPTION));

  const mismatchedEvidencePath = path.join(temp, 'mismatch-evidence.private.json');
  fs.writeFileSync(mismatchedEvidencePath, JSON.stringify({
    schema: 'DR-001-EVIDENCE-v1', status: 'PASS', checksum: 'PASS', backupCipherSha256: 'd'.repeat(64)
  }), { mode: 0o600 });
  result = run([
    'dry-run', '--snapshot', snapshotPath,
    '--backup-evidence', mismatchedEvidencePath,
    '--secret', secretPath,
    '--state', path.join(temp, 'must-not-write.private.json')
  ]);
  assert.notStrictEqual(result.status, 0);
  assert.strictEqual(result.payload.reason, 'MIG010_SNAPSHOT_BACKUP_MISMATCH');

  for (const command of ['execute', 'write', 'apply']) {
    result = run([command]);
    assert.notStrictEqual(result.status, 0);
    assert.deepStrictEqual(result.payload, {
      status: 'FAIL',
      reason: 'MIGRATION_IRREVERSIBLE_ACTION_TOOL_NOT_ENABLED'
    });
  }

  const corruptedState = { ...privateState, resume_token: `${privateState.resume_token}x` };
  const corruptedPath = path.join(temp, 'corrupted.private.json');
  fs.writeFileSync(corruptedPath, JSON.stringify(corruptedState), { mode: 0o600 });
  result = run(['verify-state', '--state', corruptedPath, '--secret', secretPath]);
  assert.notStrictEqual(result.status, 0);
  assert(['MIGRATION_RESUME_TOKEN_TAMPERED', 'MIGRATION_RESUME_TOKEN_INVALID'].includes(result.payload.reason));

  console.log('mig010_owner_tool_contract_test: OK', {
    snapshotFromEncryptedBackup: true,
    backupSnapshotBound: true,
    privateMapperOutsideRepository: true,
    privateStateOutsideRepository: true,
    dryRunOnly: true,
    stdoutPayload: false,
    resumeStateBound: true,
    writeCommandsEnabled: false,
    irreversibleActionGate: true
  });
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
