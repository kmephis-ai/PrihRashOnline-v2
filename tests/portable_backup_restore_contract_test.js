'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  BACKUP_FORMAT,
  ENVELOPE_FORMAT,
  EVIDENCE_SCHEMA,
  RPO_TARGET_MS,
  RTO_TARGET_MS,
  canonicalJson,
  encodeEnvelope,
  decodeEnvelope,
  computeControlTotals,
  buildPortablePackage,
  validatePortablePackage,
  writeEncryptedBackup,
  readEncryptedBackup,
  runRestoreDrill
} = require('../tools/private-backup');

const syntheticText = 'PUBLIC_SYNTHETIC_DR001_SENTINEL_NEVER_PLAINTEXT_ON_DISK';
const sourceMeta = {
  format: 'PRH_BACKUP_SOURCE_V1',
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  sourceBuildSha: 'a'.repeat(40),
  sourceTreeHash: 'b'.repeat(64),
  sheetCount: 2
};

const sheets = [
  {
    metadata: {
      name: '01 Операции',
      index: 0,
      lastRow: 3,
      lastColumn: 4,
      frozenRows: 1,
      frozenColumns: 0,
      hidden: false
    },
    rows: [
      [
        { t: 's', v: 'ID' },
        { t: 's', v: 'Сумма' },
        { t: 's', v: 'Описание' },
        { t: 's', v: 'Расчёт' }
      ],
      [
        { t: 's', v: 'SYN-001' },
        { t: 'n', v: 12.34 },
        { t: 's', v: syntheticText },
        { t: 'n', v: 24.68, f: '=B2*2' }
      ],
      [
        { t: 's', v: 'SYN-002' },
        { t: 'n', v: -5.67 },
        { t: 's', v: 'PUBLIC_SYNTHETIC_DR001_ROW_2' },
        { t: 'b', v: true }
      ]
    ]
  },
  {
    metadata: {
      name: '09 Настройки',
      index: 1,
      lastRow: 2,
      lastColumn: 2,
      frozenRows: 0,
      frozenColumns: 0,
      hidden: false
    },
    rows: [
      [{ t: 's', v: 'environment' }, { t: 's', v: 'SYNTHETIC' }],
      [{ t: 's', v: 'automation_write_operations' }, { t: 'b', v: false }]
    ]
  }
];

const createdAt = new Date(Date.now() - 1000).toISOString();
const pkg = buildPortablePackage(sourceMeta, sheets, createdAt);
assert.strictEqual(pkg.format, BACKUP_FORMAT);
assert.strictEqual(pkg.manifest.schemaVersion, 1);
assert.strictEqual(pkg.manifest.credentialsIncluded, false);
assert.strictEqual(pkg.manifest.sheetCount, 2);
assert.strictEqual(pkg.manifest.sheets.length, 2);
assert.strictEqual(pkg.manifest.sourceBuildSha, 'a'.repeat(40));
assert.strictEqual(pkg.manifest.sourceTreeHash, 'b'.repeat(64));
assert.strictEqual(validatePortablePackage(pkg), true);

const controls = computeControlTotals(sheets);
assert.strictEqual(controls.bySheet['01 Операции'].rowCount, 3);
assert.strictEqual(controls.operations.recordCount, 2);
assert.strictEqual(controls.operations.idCount, 2);
assert.strictEqual(controls.operations.amountMinorSum, 667);
assert.deepStrictEqual(pkg.manifest.controlTotals, controls);

const key = Buffer.alloc(32, 0x41);
const wrongKey = Buffer.alloc(32, 0x42);
const envelope = encodeEnvelope(pkg, key);
assert.strictEqual(envelope.format, ENVELOPE_FORMAT);
assert.strictEqual(envelope.cipher, 'AES-256-GCM');
const serializedEnvelope = canonicalJson(envelope);
assert(!serializedEnvelope.includes(syntheticText), 'encrypted envelope must not contain synthetic workbook plaintext');
assert(!serializedEnvelope.includes('SYN-001'), 'encrypted envelope must not contain synthetic operation identifiers in plaintext');
assert(!serializedEnvelope.includes('01 Операции'), 'encrypted envelope must not reveal sheet names in plaintext');
assert.deepStrictEqual(decodeEnvelope(envelope, key), pkg);
assert.throws(() => decodeEnvelope(envelope, wrongKey), /BACKUP_DECRYPT_FAILED/);

const tamperedEnvelope = JSON.parse(JSON.stringify(envelope));
const tamperedCipher = Buffer.from(tamperedEnvelope.ciphertext, 'base64');
tamperedCipher[0] ^= 0x01;
tamperedEnvelope.ciphertext = tamperedCipher.toString('base64');
assert.throws(() => decodeEnvelope(tamperedEnvelope, key), /BACKUP_DECRYPT_FAILED/);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prh-dr001-contract-'));
try {
  const backupPath = path.join(tempRoot, 'synthetic.prhbackup');
  const writeResult = writeEncryptedBackup(backupPath, pkg, key);
  assert(/^[0-9a-f]{64}$/.test(writeResult.cipherSha256));
  assert(fs.existsSync(backupPath));
  const onDisk = fs.readFileSync(backupPath, 'utf8');
  assert(!onDisk.includes(syntheticText), 'backup file must never contain workbook plaintext');
  assert(!onDisk.includes('SYN-001'), 'backup file must never contain synthetic operation identifiers in plaintext');
  assert(!onDisk.includes('01 Операции'), 'backup file must not reveal workbook sheet names');
  assert.throws(() => writeEncryptedBackup(backupPath, pkg, key), /BACKUP_OUTPUT_EXISTS/, 'backup tool must refuse overwrite');

  const reread = readEncryptedBackup(backupPath, key);
  assert.strictEqual(reread.cipherSha256, writeResult.cipherSha256);
  assert.strictEqual(validatePortablePackage(reread.pkg), true);
  assert.throws(() => readEncryptedBackup(backupPath, wrongKey), /BACKUP_DECRYPT_FAILED/);

  const workdir = path.join(tempRoot, 'isolated-restore');
  const evidence = runRestoreDrill(backupPath, key, { workdir });
  assert.strictEqual(evidence.schema, EVIDENCE_SCHEMA);
  assert.strictEqual(evidence.status, 'PASS');
  assert.strictEqual(evidence.checksum, 'PASS');
  assert.strictEqual(evidence.reconciliation, 'PASS');
  assert.strictEqual(evidence.unexplainedMismatch, 0);
  assert.strictEqual(evidence.temporaryTargetDestroyed, true);
  assert(evidence.rpoMs >= 0 && evidence.rpoMs <= RPO_TARGET_MS);
  assert(evidence.rtoMs >= 0 && evidence.rtoMs <= RTO_TARGET_MS);
  assert(/^[0-9a-f]{64}$/.test(evidence.backupCipherSha256));
  const remainingSqlite = fs.existsSync(workdir)
    ? fs.readdirSync(workdir).filter((name) => name.endsWith('.sqlite'))
    : [];
  assert.deepStrictEqual(remainingSqlite, [], 'isolated restore database must be destroyed after drill');

  const stalePkg = buildPortablePackage(sourceMeta, sheets, new Date(Date.now() - RPO_TARGET_MS - 60_000).toISOString());
  const stalePath = path.join(tempRoot, 'stale.prhbackup');
  writeEncryptedBackup(stalePath, stalePkg, key);
  assert.throws(() => runRestoreDrill(stalePath, key, { workdir: path.join(tempRoot, 'stale-drill') }), /RESTORE_RPO_TARGET_MISSED/);

  const mutatedPackage = JSON.parse(JSON.stringify(pkg));
  mutatedPackage.content.sheets[0].rows[1][2].v = 'PUBLIC_SYNTHETIC_TAMPER';
  assert.throws(() => validatePortablePackage(mutatedPackage), /BACKUP_CONTENT_CHECKSUM_MISMATCH/);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

const toolSource = fs.readFileSync(path.join(__dirname, '..', 'tools', 'private-backup.js'), 'utf8');
assert(toolSource.includes("require('node:sqlite')"), 'restore drill must use isolated local SQLite, not the primary Google workbook');
assert(toolSource.includes("crypto.createCipheriv(CIPHER"), 'backup must use authenticated encryption');
assert(toolSource.includes('cipher.getAuthTag()'), 'AES-GCM authentication tag is required');
assert(toolSource.includes('flag: \'wx\''), 'backup/key creation must fail closed on overwrite');
assert(toolSource.includes('fs.unlinkSync(sqlitePath)'), 'temporary restore target must be destroyed');
assert(!/SpreadsheetApp|DriveApp/.test(toolSource), 'local restore tool must not write the Google primary workbook');
assert(!/console\.log\(/.test(toolSource), 'private tool must not casually log workbook or credential objects');

console.log('portable_backup_restore_contract_test: OK', {
  syntheticOnly: true,
  encryptedBeforeDisk: true,
  tamperFailClosed: true,
  wrongKeyFailClosed: true,
  isolatedRestore: 'sqlite',
  reconciliationMismatch: 0,
  rpoTargetHours: RPO_TARGET_MS / 3600000,
  rtoTargetHours: RTO_TARGET_MS / 3600000,
  credentialsIncluded: false
});
