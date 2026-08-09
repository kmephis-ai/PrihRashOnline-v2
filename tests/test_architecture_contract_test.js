'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  CONTRACT,
  ROOT,
  buildInventory,
  suiteFiles,
  assertPureSourceBoundary
} = require('../lib/testing/test_architecture');
const {
  parseProjectStatusEntries,
  currentRoadmapWriters,
  branchRoadmapId,
  parseWorkflowSteps,
  workflowStepMap
} = require('../lib/testing/structured_contract_parsers');

const workflowText = fs.readFileSync(path.join(ROOT, '.github/workflows/pr-validation.yml'), 'utf8');
const statusText = fs.readFileSync(path.join(ROOT, 'docs/PROJECT_STATUS.md'), 'utf8');

assert.strictEqual(CONTRACT.schema, 'PRH_TEST_ARCHITECTURE_V1');
assert.strictEqual(CONTRACT.version, '1.0.0');
assert.strictEqual(CONTRACT.roadmap_id, 'TEST-010');
assert.strictEqual(CONTRACT.principles.unclassified_test, 'FAIL');
assert.strictEqual(CONTRACT.principles.ambiguous_classification, 'FAIL');
assert.strictEqual(CONTRACT.principles.duplicate_machine_authority, 'FAIL');
assert.strictEqual(CONTRACT.principles.public_finance_data, 'SYNTHETIC_ONLY');
assert.strictEqual(CONTRACT.principles.paid_dependency_required, false);
assert.strictEqual(CONTRACT.principles.red_gate_bypass_allowed, false);

const inventory = buildInventory();
assert(inventory.files.length > 0, 'test inventory must not be empty');
assert.strictEqual(new Set(inventory.files.map((item) => item.filename)).size, inventory.files.length);
assert(inventory.files.every((item) => CONTRACT.layers.some((layer) => layer.id === item.layer)));

const pureFiles = suiteFiles('pure');
assert(pureFiles.includes('financial_reconciliation_contract_test.js'));
assert(pureFiles.includes('kpi_dictionary_contract_test.js'));
assert(pureFiles.includes('canonical_transaction_schema_contract_test.js'));
assert(pureFiles.includes('pure_domain_application_core_contract_test.js'));
assert(pureFiles.includes('analytics_extension_contract_test.js'));
assertPureSourceBoundary();

const statusFixture = [
  '# status',
  '- `ARCH-010` Core — **DONE**.',
  '- `TEST-010` Layered tests — **IN_PROGRESS**, Issue #100.',
  '- `OBS-010` SLO — BACKLOG.'
].join('\n');
assert.deepStrictEqual(parseProjectStatusEntries(statusFixture).map((item) => [item.id, item.lifecycle]), [
  ['ARCH-010', 'DONE'], ['TEST-010', 'IN_PROGRESS'], ['OBS-010', 'BACKLOG']
]);
assert.deepStrictEqual([...currentRoadmapWriters(statusFixture)], ['TEST-010']);
assert.strictEqual(branchRoadmapId({ GITHUB_HEAD_REF: 'agent/TEST-010-layered-test-architecture' }), 'TEST-010');
assert.strictEqual(branchRoadmapId({ GITHUB_REF_NAME: 'main' }), '');

const workflowFixture = [
  'steps:',
  '  - name: First gate',
  '    shell: bash',
  '    run: |',
  '      node first.js',
  '      node second.js',
  '  - name: "Second gate"',
  "    run: 'node third.js'"
].join('\n');
const parsedFixture = parseWorkflowSteps(workflowFixture);
assert.strictEqual(parsedFixture.length, 2);
assert.strictEqual(parsedFixture[0].name, 'First gate');
assert.strictEqual(parsedFixture[0].run, 'node first.js\nnode second.js');
assert.strictEqual(parsedFixture[1].name, 'Second gate');
assert.strictEqual(parsedFixture[1].run, 'node third.js');

const stepMap = workflowStepMap(workflowText);
for (const gate of CONTRACT.workflow_required_gates) {
  assert(stepMap.has(gate.name), `PR Validation missing required structured gate: ${gate.name}`);
}
const layeredStep = stepMap.get('Layered test architecture');
assert(layeredStep.run.includes('node tests/test_architecture_contract_test.js'),
  'Layered test architecture gate must execute its behavioral contract');
const fullStep = stepMap.get('Run all contract tests');
assert(fullStep && /node tools\/run-layered-tests\.js full/.test(fullStep.run),
  'full contract gate must delegate to deterministic layered runner');

const documentedWriters = currentRoadmapWriters(statusText);
assert.strictEqual(documentedWriters.length, 1, 'PROJECT_STATUS must have exactly one current writer');
assert.strictEqual(documentedWriters[0], 'TEST-010', 'TEST-010 must be current writer on this branch');

console.log('test_architecture_contract_test: OK', {
  schema: CONTRACT.schema,
  version: CONTRACT.version,
  layers: CONTRACT.layers.map((layer) => layer.id),
  trackedTests: inventory.files.length,
  pureTests: pureFiles.length,
  structuredStatusParser: true,
  structuredWorkflowParser: true,
  unclassifiedFailClosed: true,
  ambiguousFailClosed: true,
  syntheticOnly: true,
  paidDependencyRequired: false
});
