'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  SOURCE_FORMAT,
  SOURCE_SCHEMA_VERSION,
  API_DEPLOYMENT_DESCRIPTION,
  boundedReason,
  knownSourceReason
} = require('../tools/private-backup-stage-probe');

assert.strictEqual(SOURCE_FORMAT, 'PRH_BACKUP_SOURCE_V1');
assert.strictEqual(SOURCE_SCHEMA_VERSION, 1);
assert.strictEqual(API_DEPLOYMENT_DESCRIPTION, 'CI-002 authenticated runtime verification');
assert.strictEqual(boundedReason('DEPLOYMENT_LIST', 403), 'DEPLOYMENT_LIST_HTTP_403');
assert.strictEqual(boundedReason('DESCRIBE', 500), 'DESCRIBE_HTTP_500');
assert.strictEqual(
  knownSourceReason({ error: { details: [{ errorMessage: 'Error: BACKUP_SOURCE_SPREADSHEET_UNAVAILABLE' }] } }, 'DESCRIBE_EXECUTION_FAILED'),
  'BACKUP_SOURCE_SPREADSHEET_UNAVAILABLE'
);
assert.strictEqual(
  knownSourceReason({ error: { details: [{ errorMessage: 'private row content must not surface' }] } }, 'CHUNK_EXECUTION_FAILED'),
  'CHUNK_EXECUTION_FAILED'
);

const source = fs.readFileSync(path.join(__dirname, '..', 'tools', 'private-backup-stage-probe.js'), 'utf8');
assert(source.includes("stages.push('CONFIG')"));
assert(source.includes("stages.push('OAUTH')"));
assert(source.includes("stages.push('DEPLOYMENT')"));
assert(source.includes("stages.push('DESCRIBE')"));
assert(source.includes("stages.push('CHUNK')"));
assert(source.includes("'prhBackupDescribe'"));
assert(source.includes("'prhBackupReadChunk'"));
assert(source.includes('devMode: false'));
assert(!source.includes('console.log'));
assert(!/emit\([^\n]*(clientId|clientSecret|refreshToken|accessToken|deploymentId|scriptId|sheetName)/.test(source));
assert(!/process\.stdout\.write\([^\n]*(clientId|clientSecret|refreshToken|accessToken|deploymentId|scriptId|sheetName)/.test(source));
assert(!source.includes('payload.error.details[0].errorMessage || message'));

console.log('private_backup_stage_probe_contract_test: OK', {
  boundedStages: true,
  rawPayloadOutput: false,
  credentialOutput: false,
  financialRowOutput: false
});
