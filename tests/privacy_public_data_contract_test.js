'use strict';

const assert = require('assert');
const { classifyPath, scanContent } = require('../tools/privacy-public-data-scan');

const safeFixture = [
  "const FIXTURE={synthetic:true,privacyClass:'PUBLIC_SYNTHETIC',",
  'yearlyIncome:[{year:2026,value:120000}],',
  "monthStructure:[{label:'SYN-ALPHA',value:10000}]};"
].join('');
assert.deepStrictEqual(scanContent('DashboardWebApp.html', safeFixture), []);

const provenanceLeak = 'fixture generated from ' + 'real DEV ' + 'analytics';
assert(scanContent('tools/example.js', provenanceLeak).some((item) => item.rule === 'real-dev-provenance'));

const sourceIdLeak = 'source_external_id=' + 'OP-' + 'F11-' + '999';
assert(scanContent('tests/example.js', sourceIdLeak).some((item) => item.rule === 'operation-source-id'));

const unmarkedFinanceFixture = 'const x={yearlyIncome:[{year:2026,value:1}],selectedYearIncome:1};';
assert(scanContent('tests/example.js', unmarkedFinanceFixture).some((item) => item.rule === 'financial-fixture-without-synthetic-provenance'));

assert.strictEqual(classifyPath('private-export.xlsx').blocked, true);
assert.strictEqual(classifyPath('exports/transactions.csv').blocked, true);
assert.strictEqual(classifyPath('tests/fixtures/synthetic/example.csv').blocked, false);
assert.strictEqual(classifyPath('artifacts/runtime.html').blocked, true);

console.log('privacy_public_data_contract_test: OK');
