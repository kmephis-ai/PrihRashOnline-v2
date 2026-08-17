'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { currentRoadmapWriters, parseProjectStatusEntries } = require('../lib/testing/structured_contract_parsers');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const contract = JSON.parse(read('lib/analytics/analytics_contract.v1.json'));
const engine = read('lib/analytics/analytics_engine.js');
const doc = read('docs/analytics/ANALYTICS_EXTENSION_CONTRACT.md');
const status = read('docs/PROJECT_STATUS.md');
const context = read('.ai-context/PROJECT_CONTEXT.md');
const llms = read('llms.txt');

function match(text, pattern, message) { assert(pattern.test(text), message); }

assert.strictEqual(contract.schema, 'PRH_ANALYTICS_CONTRACT_V1');
assert.strictEqual(contract.version, '1.0.0');
assert.strictEqual(contract.query_schema, 'PRH_ANALYTICS_QUERY_V1');
assert.strictEqual(contract.result_schema, 'PRH_ANALYTICS_RESULT_V1');
assert.strictEqual(contract.canonical_transaction_schema, 'PRH_CANONICAL_TRANSACTION_V1');
assert.strictEqual(contract.kpi_dictionary_schema, 'PRH_KPI_DICTIONARY_V1');
assert.strictEqual(contract.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(contract.renderer_neutral, true);
assert.strictEqual(contract.storage_neutral, true);
assert.strictEqual(contract.ui_logic_authoritative, false);
assert.strictEqual(contract.authorities.io, false);
assert.strictEqual(contract.authorities.network, false);
assert.strictEqual(contract.authorities.financial_write, false);
assert.strictEqual(contract.authorities.ui, false);

match(doc, /PRH_ANALYTICS_CONTRACT_V1@1\.0\.0/, 'doc must identify contract version');
match(doc, /PRH_ANALYTICS_QUERY_V1/, 'doc must identify query schema');
match(doc, /PRH_ANALYTICS_RESULT_V1/, 'doc must identify result schema');
match(doc, /FIN-010[\s\S]{0,300}evaluateKpis\(\)/i, 'doc must delegate financial semantics to FIN-010');
match(doc, /\[start,end\)/, 'doc must define half-open period');
match(doc, /PREVIOUS_PERIOD/, 'doc must define comparison v1');
match(doc, /dimensions: \[\][^\n]{0,160}ungrouped query/i, 'doc must define empty dimensions');
match(doc, /BUDGET_VARIANCE[\s\S]{0,500}ungrouped `grain=NONE`/i, 'doc must bound budget allocation semantics');
match(doc, /(?:empty scoped dataset|scoped dataset пуст)[\s\S]{0,250}budget_minor/i,
  'doc must preserve empty budget parity');
match(doc, /renderer\/storage-neutral/i, 'doc must preserve renderer/storage neutrality');
match(doc, /financial write authority|financial-write authority/i, 'doc must deny financial write authority');
match(doc, /independently generated synthetic/i, 'doc must enforce synthetic-only public tests');
match(doc, /ChartSpec|WidgetSpec/, 'doc must keep visualization spec out of ANL-010');

const statusEntries = parseProjectStatusEntries(status);
const statusById = new Map(statusEntries.map((entry) => [entry.id, entry.lifecycle]));
assert.strictEqual(statusById.get('MIG-010'), 'DONE', 'status must keep MIG-010 DONE');
assert.strictEqual(statusById.get('ANL-010'), 'DONE', 'ANL-010 must remain DONE after handoff');
const currentWriters = currentRoadmapWriters(status);
assert.strictEqual(currentWriters.length, 1, 'status must expose exactly one current writer');
assert.notStrictEqual(currentWriters[0], 'ANL-010', 'completed ANL-010 must not remain lifecycle authority');
match(status, /PRH_ANALYTICS_CONTRACT_V1@1\.0\.0/, 'status must expose analytics contract');
match(context, /ANL-010[^\n]{0,220}DONE/i, 'AI context must preserve ANL-010 completion');
match(context, /MIG-010[^\n]{0,220}DONE/i, 'AI context must preserve predecessor completion');
match(context, /financial_write=false/, 'AI context must deny analytics financial write authority');

for (const required of [
  'docs/analytics/ANALYTICS_EXTENSION_CONTRACT.md',
  'lib/analytics/analytics_contract.v1.json',
  'lib/analytics/analytics_engine.js',
  'tests/analytics_extension_contract_test.js',
  'tests/analytics_query_edge_contract_test.js',
  'tests/analytics_documentation_contract_test.js'
]) assert(llms.includes(required), `llms.txt missing ${required}`);

assert(!/SpreadsheetApp|HtmlService|DocumentApp|UrlFetchApp|XMLHttpRequest|\bdocument\.|\bwindow\./.test(engine),
  'analytics engine must remain pure/platform neutral');
assert(!/writeBatch|setValues|appendRow|financial_write_authority\s*[:=]\s*true/.test(engine),
  'analytics engine must not gain financial write authority');

for (const [name, value] of [['doc', doc], ['status', status], ['context', context], ['llms', llms]]) {
  assert(!/script\.google\.com\/macros\/s\/|\bAKfy[A-Za-z0-9_-]+\b/.test(value), `${name} contains private runtime locator`);
  assert(!/[A-Z]:\\(?:YandexDisk|PrihRashOnline-Keys|PrihRashOnline(?:\\|$))/i.test(value), `${name} contains owner-private path`);
}

console.log('analytics_documentation_contract_test: OK', {
  roadmapId: 'ANL-010',
  contract: 'PRH_ANALYTICS_CONTRACT_V1@1.0.0',
  lifecycle: 'DONE',
  currentWriter: currentWriters[0],
  predecessorMigration: 'DONE',
  structuredLifecycleState: true,
  rendererNeutral: true,
  storageNeutral: true,
  financialWriteAuthority: false,
  publicFinanceFixtures: 'SYNTHETIC_ONLY'
});
