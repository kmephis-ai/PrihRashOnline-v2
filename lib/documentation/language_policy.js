'use strict';

const fs = require('fs');
const path = require('path');
const CONTRACT = require('./language_policy.v1.json');

const ROOT = path.join(__dirname, '..', '..');
const CYRILLIC_RE = /[А-Яа-яЁё]/g;

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function stripMachineText(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]+`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
}

function countCyrillic(text) {
  const matches = stripMachineText(text).match(CYRILLIC_RE);
  return matches ? matches.length : 0;
}

function evaluateHumanText(text, options = {}) {
  const minimum = Number(options.min_cyrillic_letters || 1);
  const cyrillicLetters = countCyrillic(text);
  return Object.freeze({
    status: cyrillicLetters >= minimum ? 'PASS' : 'FAIL',
    reason_code: cyrillicLetters >= minimum ? 'LANG_RU_OK' : 'LANG_RU_INSUFFICIENT_RUSSIAN_HUMAN_TEXT',
    cyrillic_letters: cyrillicLetters,
    minimum_cyrillic_letters: minimum
  });
}

function assertContract() {
  if (CONTRACT.schema !== 'PRH_LANGUAGE_POLICY_V1' || CONTRACT.version !== '1.0.0' || CONTRACT.roadmap_id !== 'DOC-002') {
    fail('LANG_POLICY_CONTRACT_INVALID');
  }
  if (CONTRACT.normative_human_language !== 'ru' || CONTRACT.policy.single_human_source_of_truth !== true ||
      CONTRACT.policy.parallel_english_normative_source_allowed !== false || CONTRACT.policy.free_only !== true) {
    fail('LANG_POLICY_RULES_INVALID');
  }
  if (!Array.isArray(CONTRACT.normative_inventory) || CONTRACT.normative_inventory.length < 5) {
    fail('LANG_POLICY_INVENTORY_INVALID');
  }
  return true;
}

function assertNoParallelEnglishPath(relativePath) {
  for (const source of CONTRACT.parallel_english_normative_path_patterns) {
    if (new RegExp(source, 'i').test(relativePath)) fail('LANG_POLICY_PARALLEL_ENGLISH_SOURCE', relativePath);
  }
  return true;
}

function evaluateInventory(root = ROOT) {
  assertContract();
  const records = [];
  for (const item of CONTRACT.normative_inventory) {
    assertNoParallelEnglishPath(item.path);
    const absolute = path.join(root, item.path);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) fail('LANG_POLICY_INVENTORY_PATH_MISSING', item.path);
    const text = fs.readFileSync(absolute, 'utf8');
    const evaluation = evaluateHumanText(text, item);
    if (evaluation.status !== 'PASS') fail(evaluation.reason_code, item.path);
    const markers = CONTRACT.required_markers[item.path] || [];
    for (const marker of markers) {
      if (!text.includes(marker)) fail('LANG_POLICY_REQUIRED_MARKER_MISSING', `${item.path}:${marker}`);
    }
    records.push(Object.freeze({ path: item.path, kind: item.kind, cyrillic_letters: evaluation.cyrillic_letters }));
  }
  return Object.freeze(records);
}

function scanTrackedPaths(paths) {
  assertContract();
  for (const relativePath of paths) assertNoParallelEnglishPath(String(relativePath));
  return true;
}

module.exports = Object.freeze({
  CONTRACT,
  ROOT,
  stripMachineText,
  countCyrillic,
  evaluateHumanText,
  assertContract,
  assertNoParallelEnglishPath,
  evaluateInventory,
  scanTrackedPaths
});
