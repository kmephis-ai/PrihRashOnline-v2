'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const contract = JSON.parse(read('lib/documentation/r1_documentation.v1.json'));
const workflow = read('.github/workflows/pr-validation.yml');
const readIfExists = (rel) => exists(rel) ? read(rel) : '';

function requireToken(text, token, message) {
  assert(text.includes(token), `${message}: ${token}`);
}

assert.strictEqual(contract.schema, 'PRH_R1_DOCUMENTATION_V1');
assert.strictEqual(contract.version, '1.0.0');
assert.strictEqual(contract.roadmap_id, 'DOC-010');
assert.strictEqual(contract.language, 'ru');
assert.strictEqual(contract.privacy_class, 'PUBLIC_SAFE');
assert.strictEqual(contract.cost_class, 'FREE_ONLY');
assert.strictEqual(contract.invariants.financial_truth_from_canonical_kpi_only, true);
assert.strictEqual(contract.invariants.generic_google_financial_write_authorized, false);
assert.strictEqual(contract.invariants.migration_authorization_reusable, false);
assert.strictEqual(contract.invariants.public_financial_payload_allowed, false);
assert.strictEqual(contract.invariants.private_runtime_locator_public, false);
assert.strictEqual(contract.invariants.paid_dependency_required, false);
assert.strictEqual(contract.invariants.documentation_can_override_red_gate, false);

for (const entry of contract.entry_points) {
  assert(exists(entry), `DOC-010 entry point missing: ${entry}`);
}

const areaIds = new Set();
for (const area of contract.areas) {
  assert(area && typeof area === 'object' && !Array.isArray(area));
  assert(/^[A-Z0-9_]+$/.test(area.id), `invalid documentation area id: ${area.id}`);
  assert(!areaIds.has(area.id), `duplicate documentation area: ${area.id}`);
  areaIds.add(area.id);
  for (const field of ['docs', 'contracts', 'sources', 'tests', 'checks']) {
    assert(Array.isArray(area[field]) && area[field].length > 0, `${area.id} must define ${field}`);
  }
  for (const rel of [...area.docs, ...area.sources, ...area.tests]) {
    assert(exists(rel), `${area.id} references missing path: ${rel}`);
  }
  const authorityText = [...area.docs, ...area.sources].map(readIfExists).join('\n');
  for (const id of area.contracts) {
    const token = String(id).replace(/@[0-9]+(?:\.[0-9]+){0,2}$/, '');
    assert(authorityText.includes(id) || authorityText.includes(token), `${area.id} contract not linked by docs/source: ${id}`);
  }
  for (const check of area.checks) {
    assert(workflow.includes(`name: ${check}`) || workflow.includes(`- name: ${check}`), `${area.id} named gate missing from PR Validation: ${check}`);
  }
}

for (const requiredArea of [
  'ARCHITECTURE_CONTEXT', 'CANONICAL_DATA', 'FINANCIAL_TRUTH', 'ANALYTICS',
  'PERFORMANCE_READ_PATH', 'MIGRATION_RECOVERY', 'OBSERVABILITY_SLO', 'DELIVERY_OPERATIONS'
]) {
  assert(areaIds.has(requiredArea), `required documentation area missing: ${requiredArea}`);
}

const readme = read('README.md');
const architecture = read('docs/architecture.md');
const dataModel = read('docs/data-model.md');
const c4 = read('docs/architecture/R1_C4_CONTEXT.md');
const lineage = read('docs/data/R1_DATA_LINEAGE.md');
const projectStatus = read('docs/PROJECT_STATUS.md');
const aiContext = read('.ai-context/PROJECT_CONTEXT.md');
const llms = read('llms.txt');

for (const token of [
  'docs/ROADMAP.md', 'docs/architecture/R1_C4_CONTEXT.md', 'docs/data/R1_DATA_LINEAGE.md'
]) requireToken(readme, token, 'README must link canonical DOC-010 entry point');

for (const token of [
  'PRH_APPLICATION_CORE_V1', 'PRH_TRANSACTION_REPOSITORY_V1', 'PRH_ANALYTICS_CONTRACT_V1@1.0.0',
  'PRH_SYNTHETIC_SCALE_GATE_V1@1.0.0', 'GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED', 'MYSELF', 'FREE_ONLY'
]) requireToken(c4, token, 'C4 context missing required boundary');

for (const token of [
  'PRH_CANONICAL_TRANSACTION_V1', 'PRH_KPI_DICTIONARY_V1', 'FIN-TRUTH-v1', 'PRH_ANALYTICS_CONTRACT_V1@1.0.0',
  'PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0', 'PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0',
  'PRH_SINGLE_SCAN_REFRESH_V1@1.0.0', 'PRH_INCREMENTAL_ANALYTICS_AGGREGATES_V1@1.0.0',
  'PRH_SYNTHETIC_SCALE_GATE_V1@1.0.0', 'MIG010_EXECUTION_POLICY_V1@1.0.0',
  'PRH_SLO_ERROR_BUDGET_V1@1.0.0', 'docs/RELEASE_PROCESS.md'
]) requireToken(lineage, token, 'R1 lineage missing required link');

for (const text of [architecture, dataModel, projectStatus, aiContext, llms]) {
  for (const id of ['PERF-010', 'PERF-011', 'PERF-012', 'PERF-013', 'PERF-014']) {
    const bad = new RegExp(`${id}[^\\n]{0,180}(?:IN_PROGRESS|current writer)`, 'i');
    assert(!bad.test(text), `stale completed performance lifecycle remains in normative documentation: ${id}`);
  }
}
assert(!/ANL-010[^\n]{0,180}(?:IN_PROGRESS|current writer)/i.test(architecture), 'architecture must not describe completed ANL-010 as current writer');
assert(!/ANL-010[^\n]{0,180}(?:IN_PROGRESS|current writer)/i.test(dataModel), 'data-model must not describe completed ANL-010 as current writer');

for (const text of [projectStatus, aiContext, llms]) {
  requireToken(text, 'DOC-010', 'current lifecycle docs must identify DOC-010');
}
assert(/DOC-010[^\n]{0,220}(?:IN_PROGRESS|current)/i.test(projectStatus), 'PROJECT_STATUS must identify DOC-010 as current writer');
assert(/DOC-010[^\n]{0,220}(?:IN_PROGRESS|current)/i.test(aiContext), 'AI context must identify DOC-010 as current writer');

const combinedCoreDocs = [readme, architecture, dataModel, c4, lineage, projectStatus, aiContext].join('\n');
for (const token of ['FREE_ONLY', 'GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED', 'IRREVERSIBLE_ACTION_AUTHORIZED']) {
  requireToken(combinedCoreDocs, token, 'R1 documentation must preserve safety boundary');
}
assert(/IRREVERSIBLE_ACTION_AUTHORIZED[\s\S]{0,500}(?:не.*повтор|не.*reuse|non-reusable|cannot.*reuse)/i.test(combinedCoreDocs) ||
       /(?:не.*повтор|не.*reuse|non-reusable|cannot.*reuse)[\s\S]{0,500}IRREVERSIBLE_ACTION_AUTHORIZED/i.test(combinedCoreDocs),
  'R1 documentation must state that historical irreversible authorization is non-reusable');

assert(workflow.includes('name: R1 documentation contract'), 'PR Validation must expose named DOC-010 gate');
assert(workflow.includes('node tests/r1_documentation_contract_test.js'), 'DOC-010 named gate must run exact contract test');

console.log('r1_documentation_contract_test: OK', {
  contract: 'PRH_R1_DOCUMENTATION_V1@1.0.0',
  areas: contract.areas.length,
  entryPoints: contract.entry_points.length,
  pathLinksVerified: true,
  contractLinksVerified: true,
  namedChecksVerified: true,
  staleLifecycleRejected: true,
  privacyBoundary: 'PUBLIC_SAFE',
  freeOnly: true,
  genericGoogleWriteAuthorized: false,
  migrationAuthorizationReusable: false
});
