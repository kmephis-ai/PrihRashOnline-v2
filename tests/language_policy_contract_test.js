'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const POLICY = require('../lib/documentation/language_policy');
const CONTRACT = require('../lib/documentation/language_policy.v1.json');

assert.strictEqual(CONTRACT.schema, 'PRH_LANGUAGE_POLICY_V1');
assert.strictEqual(CONTRACT.version, '1.0.0');
assert.strictEqual(CONTRACT.roadmap_id, 'DOC-002');
assert.strictEqual(CONTRACT.normative_human_language, 'ru');
assert.strictEqual(CONTRACT.policy.single_human_source_of_truth, true);
assert.strictEqual(CONTRACT.policy.parallel_english_normative_source_allowed, false);
assert.strictEqual(CONTRACT.policy.machine_identifiers_translated, false);
assert.strictEqual(CONTRACT.policy.technical_standards_names_translated, false);
assert.strictEqual(CONTRACT.policy.free_only, true);
assert(Object.values(CONTRACT.authority).every((value) => value === false));

const inventory = POLICY.evaluateInventory();
assert.strictEqual(inventory.length, CONTRACT.normative_inventory.length);
assert(inventory.every((item) => item.cyrillic_letters > 0));

const russianWithTech = [
  '# Политика',
  'Русский язык является нормативным для human-facing текста проекта.',
  'Machine identifiers вроде PRH_CANONICAL_TRANSACTION_V1, OAuth, GitHub Actions, RFC 2104 и HMAC-SHA256 не переводятся.',
  '```json',
  '{"schema":"PRH_TEST_V1","language":"machine-value"}',
  '```'
].join('\n');
assert.strictEqual(POLICY.evaluateHumanText(russianWithTech, { min_cyrillic_letters: 40 }).status, 'PASS');

const englishOnly = [
  '# Documentation policy',
  'This document is the normative human-facing source of truth for the project.',
  'It explains requirements and release behavior to contributors.'
].join('\n');
const englishEval = POLICY.evaluateHumanText(englishOnly, { min_cyrillic_letters: 10 });
assert.strictEqual(englishEval.status, 'FAIL');
assert.strictEqual(englishEval.reason_code, 'LANG_RU_INSUFFICIENT_RUSSIAN_HUMAN_TEXT');

assert.doesNotThrow(() => POLICY.assertNoParallelEnglishPath('docs/security/FAMILY_AUTHORIZATION.md'));
assert.throws(() => POLICY.assertNoParallelEnglishPath('docs/en/security-policy.md'), /LANG_POLICY_PARALLEL_ENGLISH_SOURCE/);
assert.throws(() => POLICY.assertNoParallelEnglishPath('README_EN.md'), /LANG_POLICY_PARALLEL_ENGLISH_SOURCE/);
assert.throws(() => POLICY.scanTrackedPaths(['README.md', 'docs/english/roadmap.md']), /LANG_POLICY_PARALLEL_ENGLISH_SOURCE/);

for (const [file, markers] of Object.entries(CONTRACT.required_markers)) {
  const text = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  for (const marker of markers) assert(text.includes(marker), `${file} missing marker ${marker}`);
}

for (const template of ['.github/ISSUE_TEMPLATE/roadmap.yml','.github/PULL_REQUEST_TEMPLATE.md','.github/RELEASE_TEMPLATE.md']) {
  const text = fs.readFileSync(path.join(__dirname, '..', template), 'utf8');
  assert(text.includes('language: ru'), `${template} must declare language: ru`);
  assert(POLICY.countCyrillic(text) >= 40, `${template} must contain substantive Russian human-facing text`);
}

const scanner = fs.readFileSync(path.join(__dirname, '..', 'tools', 'language-policy-scan.js'), 'utf8');
assert(scanner.includes("git', ['ls-files']"), 'Scanner must inspect tracked path inventory');
assert(scanner.includes('scanTrackedPaths'), 'Scanner must reject parallel English normative paths');
assert(scanner.includes('evaluateInventory'), 'Scanner must verify normative inventory');
assert(!/UrlFetchApp|SpreadsheetApp|fetch\s*\(|XMLHttpRequest/.test(scanner), 'Language scanner must be local/offline');

console.log('language_policy_contract_test: OK', {
  contract: `${CONTRACT.schema}@${CONTRACT.version}`,
  normativeLanguage: CONTRACT.normative_human_language,
  inventoryPaths: inventory.length,
  russianHumanTextRequired: true,
  technicalIdentifiersAllowed: true,
  parallelEnglishNormativeSourceAllowed: false,
  templatesRussian: true,
  runtimeAuthority: false,
  financialWriteAuthority: false,
  freeOnly: true
});
