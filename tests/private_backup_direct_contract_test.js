'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  SOURCE_FORMAT,
  SOURCE_SCHEMA_VERSION,
  MAX_CHUNK_ROWS,
  safeReason,
  localSourceTreeHash,
  validateDescribe
} = require('../tools/private-backup-direct');

assert.strictEqual(SOURCE_FORMAT, 'PRH_BACKUP_SOURCE_V1');
assert.strictEqual(SOURCE_SCHEMA_VERSION, 1);
assert.strictEqual(MAX_CHUNK_ROWS, 200);
assert.strictEqual(safeReason(new Error('BACKUP_SOURCE_METADATA_INVALID'), 'FALLBACK'), 'BACKUP_SOURCE_METADATA_INVALID');
assert.strictEqual(safeReason(new Error('private value'), 'BACKUP_DIRECT_FAILED'), 'BACKUP_DIRECT_FAILED');

const repoRoot = path.join(__dirname, '..');
const sourceTreeHash = localSourceTreeHash(repoRoot);
assert(/^[0-9a-f]{64}$/.test(sourceTreeHash));

assert.strictEqual(validateDescribe({
  format: SOURCE_FORMAT,
  schemaVersion: SOURCE_SCHEMA_VERSION,
  sourceBuildSha: 'a'.repeat(40),
  sourceTreeHash,
  sheetCount: 0,
  sheets: []
}, sourceTreeHash), true);

assert.throws(() => validateDescribe({
  format: SOURCE_FORMAT,
  schemaVersion: SOURCE_SCHEMA_VERSION,
  sourceBuildSha: 'a'.repeat(40),
  sourceTreeHash: 'b'.repeat(64),
  sheetCount: 0,
  sheets: []
}, sourceTreeHash), /BACKUP_RUNTIME_SOURCE_TREE_MISMATCH/);

const source = fs.readFileSync(path.join(repoRoot, 'tools', 'private-backup-direct.js'), 'utf8');
assert(source.includes("'prhBackupDescribe'"));
assert(source.includes("'prhBackupReadChunk'"));
assert(source.includes('devMode: false'));
assert(source.includes('runtimeSourceTreeBound: true'));
assert(source.includes('writeEncryptedBackup'));
assert(!source.includes('/deployments'));
assert(!source.includes('console.log'));
assert(!/process\.stdout\.write\([^\n]*(clientId|clientSecret|refreshToken|accessToken|deploymentId|sheetName)/.test(source));

console.log('private_backup_direct_contract_test: OK', {
  managementApiDependency: false,
  runtimeSourceTreeBinding: true,
  encryptionBeforeOutput: true,
  credentialOutput: false
});
