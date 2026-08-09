'use strict';

const fs = require('fs');
const path = require('path');
const CONTRACT = require('./test_architecture.v1.json');

const ROOT = path.join(__dirname, '..', '..');
const TESTS_DIR = path.join(ROOT, 'tests');

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function assertContract() {
  if (CONTRACT.schema !== 'PRH_TEST_ARCHITECTURE_V1' || CONTRACT.version !== '1.0.0' ||
      CONTRACT.roadmap_id !== 'TEST-010') fail('TEST_ARCHITECTURE_CONTRACT_INVALID');
  if (CONTRACT.principles.unclassified_test !== 'FAIL' ||
      CONTRACT.principles.ambiguous_classification !== 'FAIL' ||
      CONTRACT.principles.duplicate_machine_authority !== 'FAIL' ||
      CONTRACT.principles.public_finance_data !== 'SYNTHETIC_ONLY' ||
      CONTRACT.principles.paid_dependency_required !== false ||
      CONTRACT.principles.red_gate_bypass_allowed !== false) {
    fail('TEST_ARCHITECTURE_PRINCIPLES_INVALID');
  }
  const ids = CONTRACT.layers.map((layer) => layer.id);
  if (new Set(ids).size !== ids.length) fail('TEST_ARCHITECTURE_LAYER_DUPLICATE');
  return true;
}

function trackedTestFiles() {
  return fs.readdirSync(TESTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('_test.js'))
    .map((entry) => entry.name)
    .sort();
}

function matchingLayers(filename) {
  return CONTRACT.layers.filter((layer) =>
    layer.patterns.some((source) => new RegExp(source).test(filename))
  );
}

function classifyTestFile(filename) {
  const matches = matchingLayers(filename);
  if (matches.length === 0) fail('TEST_ARCHITECTURE_UNCLASSIFIED', filename);
  if (matches.length > 1) fail('TEST_ARCHITECTURE_AMBIGUOUS', `${filename}:${matches.map((item) => item.id).join(',')}`);
  return matches[0].id;
}

function buildInventory() {
  assertContract();
  const files = trackedTestFiles();
  const records = [];
  const counts = Object.fromEntries(CONTRACT.layers.map((layer) => [layer.id, 0]));
  for (const filename of files) {
    const layer = classifyTestFile(filename);
    counts[layer] += 1;
    records.push(Object.freeze({ filename, layer }));
  }
  for (const layer of CONTRACT.layers) {
    if (counts[layer.id] > layer.budget.max_files) {
      fail('TEST_ARCHITECTURE_FILE_BUDGET_EXCEEDED', `${layer.id}:${counts[layer.id]}>${layer.budget.max_files}`);
    }
  }
  return Object.freeze({
    schema: CONTRACT.schema,
    version: CONTRACT.version,
    files: Object.freeze(records),
    counts: Object.freeze(counts)
  });
}

function suiteFiles(suiteName) {
  const suite = CONTRACT.suites[suiteName];
  if (!suite) fail('TEST_ARCHITECTURE_SUITE_UNKNOWN', suiteName);
  const allowed = new Set(suite.layers);
  return Object.freeze(buildInventory().files
    .filter((record) => allowed.has(record.layer))
    .map((record) => record.filename)
    .sort());
}

function assertPureSourceBoundary() {
  const pureLayer = CONTRACT.layers.find((layer) => layer.id === 'PURE_DOMAIN_APPLICATION');
  const files = suiteFiles('pure');
  for (const filename of files) {
    const source = fs.readFileSync(path.join(TESTS_DIR, filename), 'utf8');
    for (const token of pureLayer.forbidden_source_tokens) {
      if (source.includes(token)) fail('TEST_ARCHITECTURE_PURE_PLATFORM_DEPENDENCY', `${filename}:${token}`);
    }
  }
  return true;
}

module.exports = {
  CONTRACT,
  ROOT,
  TESTS_DIR,
  assertContract,
  trackedTestFiles,
  matchingLayers,
  classifyTestFile,
  buildInventory,
  suiteFiles,
  assertPureSourceBoundary
};
