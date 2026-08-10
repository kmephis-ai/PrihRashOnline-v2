'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const scanner = require('../tools/ai-playbook-scan');
const catalog = require('../lib/ai/ai_playbook_catalog.v1.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeFixture(mutator) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prh-ai-playbooks-'));
  const fixtureCatalog = clone(catalog);
  fs.mkdirSync(path.join(root, 'lib', 'ai'), { recursive: true });
  fs.mkdirSync(path.join(root, '.ai-context', 'playbooks'), { recursive: true });
  for (const entry of Object.values(catalog.playbooks)) {
    const source = path.join(__dirname, '..', entry.file);
    const target = path.join(root, entry.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  if (mutator) mutator({ root, catalog: fixtureCatalog });
  fs.writeFileSync(path.join(root, scanner.CATALOG_PATH), JSON.stringify(fixtureCatalog, null, 2) + '\n', 'utf8');
  return root;
}

function expectFixtureFailure(expectedCode, mutator) {
  const root = makeFixture(mutator);
  try {
    assert.throws(() => scanner.scanPlaybooks({ root }), (error) => error && error.code === expectedCode, expectedCode);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const result = scanner.scanPlaybooks({ root: path.join(__dirname, '..') });
assert.strictEqual(result.schema, 'PRH_AI_PLAYBOOK_CATALOG_V1');
assert.strictEqual(result.version, '1.0.0');
assert.strictEqual(result.playbook_count, 5);
assert.deepStrictEqual(result.results.map((item) => item.id).sort(), scanner.EXPECTED_IDS.slice().sort());
assert(result.results.every((item) => item.status === 'PASS'));

assert.strictEqual(catalog.principles.catalog_grants_authority, false);
assert.strictEqual(catalog.principles.existing_authority_required, true);
assert.strictEqual(catalog.principles.source_of_truth_duplicated, false);
assert.strictEqual(catalog.principles.public_finance_data, 'SYNTHETIC_ONLY');
assert.strictEqual(catalog.principles.paid_dependency_required, false);
assert.strictEqual(catalog.principles.red_machine_gate_bypass_allowed, false);
assert.strictEqual(catalog.principles.one_writer_preserved, true);
assert.strictEqual(catalog.principles.free_only, true);
assert.ok(Object.values(catalog.authorities).every((value) => value === false));

for (const [id, entry] of Object.entries(catalog.playbooks)) {
  assert.strictEqual(entry.version, '1.0.0', id);
  assert.ok(entry.file.startsWith('.ai-context/playbooks/'), id);
  assert.ok(entry.required_inputs.length > 0, id);
  assert.ok(entry.ordered_steps.length > 0, id);
  assert.ok(entry.stop_conditions.length > 0, id);
  assert.ok(entry.outputs.length > 0, id);
  assert.ok(Object.values(entry.authority_grants).every((value) => value === false), id);
}
assert.strictEqual(catalog.playbooks.PR_REVIEW.mode, 'READ_ONLY');
assert.strictEqual(catalog.playbooks.MIGRATION_REVIEW.mode, 'READ_ONLY');
assert.strictEqual(catalog.playbooks.ROADMAP_EXECUTION.authority_grants.merge, false);
assert.strictEqual(catalog.playbooks.RELEASE.authority_grants.merge, false);
assert.strictEqual(catalog.playbooks.RELEASE.authority_grants.deploy, false);
assert.strictEqual(catalog.playbooks.MIGRATION_REVIEW.authority_grants.financial_write, false);

expectFixtureFailure('AI_PLAYBOOK_FILE_MISSING', ({ root }) => {
  fs.unlinkSync(path.join(root, catalog.playbooks.DOCS_DRIFT.file));
});

expectFixtureFailure('AI_PLAYBOOK_FILE_DUPLICATE', ({ catalog: fixtureCatalog }) => {
  fixtureCatalog.playbooks.PR_REVIEW.file = fixtureCatalog.playbooks.ROADMAP_EXECUTION.file;
});

expectFixtureFailure('AI_PLAYBOOK_AUTHORITY_GRANT_FORBIDDEN', ({ catalog: fixtureCatalog }) => {
  fixtureCatalog.playbooks.RELEASE.authority_grants.merge = true;
});

expectFixtureFailure('AI_PLAYBOOK_REQUIRED_MARKER_MISSING', ({ root }) => {
  const file = path.join(root, catalog.playbooks.RELEASE.file);
  const text = fs.readFileSync(file, 'utf8').replace('Main Verification', 'Main-Verification-removed');
  fs.writeFileSync(file, text, 'utf8');
});

expectFixtureFailure('AI_PLAYBOOK_META_MISMATCH', ({ root }) => {
  const file = path.join(root, catalog.playbooks.PR_REVIEW.file);
  const text = fs.readFileSync(file, 'utf8').replace('"mode":"READ_ONLY"', '"mode":"ACTIVE_WRITER"');
  fs.writeFileSync(file, text, 'utf8');
});

expectFixtureFailure('AI_PLAYBOOK_RUSSIAN_TEXT_INSUFFICIENT', ({ root, catalog: fixtureCatalog }) => {
  const entry = fixtureCatalog.playbooks.PR_REVIEW;
  const meta = `<!-- PRH_AI_PLAYBOOK_META_V1\n${JSON.stringify({
    playbook_id: 'PR_REVIEW', version: '1.0.0', language: 'ru', mode: 'READ_ONLY',
    catalog: 'PRH_AI_PLAYBOOK_CATALOG_V1@1.0.0', authority_granted_by_playbook: false
  })}\n-->`;
  const markers = entry.required_markers.join('\n');
  fs.writeFileSync(path.join(root, entry.file), `# Review\n\n${meta}\n\n${markers}\n`, 'utf8');
});

expectFixtureFailure('AI_PLAYBOOK_OVERSIZED', ({ root, catalog: fixtureCatalog }) => {
  const entry = fixtureCatalog.playbooks.DOCS_DRIFT;
  const file = path.join(root, entry.file);
  fs.appendFileSync(file, '\n' + 'я'.repeat(entry.max_bytes + 100), 'utf8');
});

expectFixtureFailure('AI_PLAYBOOK_CATALOG_AUTHORITY_INVALID', ({ catalog: fixtureCatalog }) => {
  fixtureCatalog.authorities.merge = true;
});

console.log('ai-playbook-contract: PASS', {
  schema: catalog.schema,
  version: catalog.version,
  playbooks: result.playbook_count,
  modes: Object.fromEntries(Object.entries(catalog.playbooks).map(([id, entry]) => [id, entry.mode])),
  authorityGranted: false,
  paidDependencyRequired: catalog.principles.paid_dependency_required,
  publicFinanceData: catalog.principles.public_finance_data,
  freeOnly: catalog.principles.free_only
});
