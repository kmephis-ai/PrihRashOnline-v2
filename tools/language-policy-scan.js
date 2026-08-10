'use strict';

const { execFileSync } = require('child_process');
const POLICY = require('../lib/documentation/language_policy');

function trackedFiles() {
  const output = execFileSync('git', ['ls-files'], { encoding: 'utf8' });
  return output.split(/\r?\n/).filter(Boolean);
}

try {
  const files = trackedFiles();
  POLICY.scanTrackedPaths(files);
  const inventory = POLICY.evaluateInventory();
  console.log('language-policy: PASS', {
    schema: POLICY.CONTRACT.schema,
    version: POLICY.CONTRACT.version,
    normativeLanguage: POLICY.CONTRACT.normative_human_language,
    inventoryPaths: inventory.length,
    parallelEnglishNormativeSource: false,
    freeOnly: POLICY.CONTRACT.policy.free_only,
    paths: inventory.map((item) => item.path)
  });
} catch (error) {
  console.error('language-policy: FAIL', error.code || 'LANG_POLICY_UNKNOWN', String(error.message || '').slice(0, 300));
  process.exitCode = 1;
}
