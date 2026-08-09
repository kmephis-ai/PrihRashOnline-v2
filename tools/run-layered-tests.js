'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const {
  ROOT,
  CONTRACT,
  buildInventory,
  suiteFiles,
  assertPureSourceBoundary
} = require('../lib/testing/test_architecture');

function fail(code, detail) {
  process.stderr.write(`${code}${detail ? ` ${detail}` : ''}\n`);
  process.exit(1);
}

function runSuite(name) {
  const suite = CONTRACT.suites[name];
  if (!suite) fail('TEST_ARCHITECTURE_SUITE_UNKNOWN', name);
  const inventory = buildInventory();
  if (name === 'pure') assertPureSourceBoundary();
  const files = suiteFiles(name);
  if (!files.length) fail('TEST_ARCHITECTURE_SUITE_EMPTY', name);

  const started = Date.now();
  for (const filename of files) {
    const result = spawnSync(process.execPath, [path.join('tests', filename)], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env
    });
    if (result.error) fail('TEST_ARCHITECTURE_EXECUTION_ERROR', filename);
    if (result.status !== 0) fail('TEST_ARCHITECTURE_TEST_FAILED', filename);
  }
  const durationMs = Date.now() - started;
  console.log('layered-test-runner: PASS', {
    suite: name,
    files: files.length,
    inventoryFiles: inventory.files.length,
    layers: suite.layers,
    durationMs,
    deterministicOrder: true,
    unclassifiedFailClosed: true
  });
}

runSuite(process.argv[2] || 'full');
