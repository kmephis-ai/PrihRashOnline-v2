'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'QualityApplyService.js'), 'utf8');

assert.match(source, /VERSION:\s*'0\.4\.1'/, 'service version must be 0.4.1');
assert.match(source, /MAX_BATCH:\s*10/, 'batch limit must remain 10');
assert.match(source, /MISSING_CATEGORY:true/, 'category cleanup must be explicitly allowed');
assert.match(source, /MISSING_DESCRIPTION:true/, 'description cleanup must be explicitly allowed');
assert.doesNotMatch(source, /INVALID_AMOUNT:true|MISSING_DATE:true|POSSIBLE_DUPLICATE:true/, 'dates, amounts and duplicates must not be auto-applied');
assert.match(source, /typeof PR_CONFIG==='undefined'\|\|PR_CONFIG\.ALLOW_OPERATION_WRITES!==true/, 'operation writes must fail closed');
assert.match(source, /if\(!item\.proposedValue\)/, 'empty proposals must be rejected');
assert.match(source, /Статус резерва/, 'backup lifecycle status must be recorded');

const backupIndex = source.indexOf('prhAppendQualityBackup_(context.backup,backupRow)');
const writeIndex = source.indexOf('cell.setValue(item.proposedValue)');
assert.ok(backupIndex >= 0 && writeIndex >= 0 && backupIndex < writeIndex, 'backup must be persisted before operation write');

assert.match(source, /SpreadsheetApp\.flush\(\);\n\s*var writtenDisplay=/, 'write must be verified after flush');
assert.match(source, /cell\.setValue\(oldRaw\); SpreadsheetApp\.flush\(\);/, 'failed write must attempt rollback');
assert.match(source, /ROLLBACK_FAILED/, 'failed rollback must be marked explicitly');

console.log('Quality Apply static safety tests passed.');
