'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { defaultSourceToCanonical } = require('../lib/migration/full_history_migration');

const root = path.join(__dirname, '..');
const tool = path.join(root, 'tools', 'mig010-owner.js');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig010-owner-contract-'));
const secretPath = path.join(temp, 'resume.secret');
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
  assert.strictEqual(result.payload.writeCommandEnabled, false);
  assert.strictEqual(result.payload.irreversibleActionRequired, true);
  assert.strictEqual(result.payload.realFinancialPayloadStdout, false);

  result = run(['init-secret', '--out', secretPath]);
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.payload.status, 'SECRET_CREATED');
  assert.strictEqual(fs.existsSync(secretPath), true);

  const sources = [source(0), source(1), source(2)];
  fs.writeFileSync(snapshotPath, `${JSON.stringify({
    schema: 'MIG010_OWNER_PRIVATE_SNAPSHOT_V1',
    mapping_version: 'SYN-PRIVATE-MAPPER-v1',
    source_records: sources,
    canonical_records: [defaultSourceToCanonical(sources[0])]
  }, null, 2)}\n`, { mode: 0o600 });
  fs.writeFileSync(backupEvidencePath, `${JSON.stringify({
    schema: 'DR-001-EVIDENCE-v1',
    status: 'PASS',
    checksum: 'PASS',
    backupCipherSha256: 'b'.repeat(64)
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
    dryRunOnly: true,
    privateStateLocal: true,
    stdoutPayload: false,
    resumeStateBound: true,
    writeCommandsEnabled: false,
    irreversibleActionGate: true
  });
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
