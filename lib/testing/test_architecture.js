'use strict';

const fs = require('fs');
const path = require('path');
const CONTRACT = require('./test_architecture.v1.json');

const ROOT = path.join(__dirname, '..', '..');
const TESTS_DIR = path.join(ROOT, 'tests');
const MAX_DIAGNOSTIC_ITEMS = 80;

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function layerById(id) {
  return CONTRACT.layers.find((layer) => layer.id === id) || null;
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
  if (!CONTRACT.exact_overrides || typeof CONTRACT.exact_overrides !== 'object' || Array.isArray(CONTRACT.exact_overrides)) {
    fail('TEST_ARCHITECTURE_OVERRIDES_INVALID');
  }
  for (const [filename, layerId] of Object.entries(CONTRACT.exact_overrides)) {
    if (!filename.endsWith('_test.js') || !layerById(layerId)) {
      fail('TEST_ARCHITECTURE_OVERRIDE_INVALID', `${filename}:${layerId}`);
    }
  }
  return true;
}

function trackedTestFiles() {
  return fs.readdirSync(TESTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('_test.js'))
    .map((entry) => entry.name)
    .sort();
}

function matchingLayers(filename) {
  const exactLayerId = CONTRACT.exact_overrides[filename];
  if (exactLayerId) return [layerById(exactLayerId)];
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

function boundedList(items) {
  const visible = items.slice(0, MAX_DIAGNOSTIC_ITEMS);
  const suffix = items.length > visible.length ? `,+${items.length - visible.length}_more` : '';
  return visible.join(',') + suffix;
}

function buildInventory() {
  assertContract();
  const files = trackedTestFiles();
  const fileSet = new Set(files);
  const staleOverrides = Object.keys(CONTRACT.exact_overrides).filter((filename) => !fileSet.has(filename));
  if (staleOverrides.length) {
    fail('TEST_ARCHITECTURE_STALE_OVERRIDE', boundedList(staleOverrides));
  }

  const records = [];
  const counts = Object.fromEntries(CONTRACT.layers.map((layer) => [layer.id, 0]));
  const unclassified = [];
  const ambiguous = [];

  for (const filename of files) {
    const matches = matchingLayers(filename);
    if (matches.length === 0) {
      unclassified.push(filename);
      continue;
    }
    if (matches.length > 1) {
      ambiguous.push(`${filename}=>${matches.map((item) => item.id).join('+')}`);
      continue;
    }
    const layer = matches[0].id;
    counts[layer] += 1;
    records.push(Object.freeze({ filename, layer, exactOverride: Object.hasOwn(CONTRACT.exact_overrides, filename) }));
  }

  if (unclassified.length || ambiguous.length) {
    const parts = [];
    if (unclassified.length) parts.push(`unclassified=[${boundedList(unclassified)}]`);
    if (ambiguous.length) parts.push(`ambiguous=[${boundedList(ambiguous)}]`);
    fail('TEST_ARCHITECTURE_CLASSIFICATION_INVALID', parts.join(';'));
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
    counts: Object.freeze(counts),
    exactOverrides: Object.keys(CONTRACT.exact_overrides).length
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
  MAX_DIAGNOSTIC_ITEMS,
  assertContract,
  trackedTestFiles,
  matchingLayers,
  classifyTestFile,
  buildInventory,
  suiteFiles,
  assertPureSourceBoundary
};
