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

function annotationDetail(result) {
  const stderr = String(result && result.stderr || '').trim();
  if (!stderr) return '';
  return stderr
    .replace(/[\r\n]+/g, ' | ')
    .replace(/[%]/g, ' percent ')
    .slice(0, 1200);
}

function annotateFailure(filename, status, result) {
  const safeFilename = String(filename || 'unknown_test.js').replace(/[\r\n,%]/g, '_');
  const safeStatus = String(status == null ? 'unknown' : status).replace(/[\r\n,%]/g, '_');
  const detail = annotationDetail(result);
  process.stderr.write(
    `::error file=tests/${safeFilename},title=Layered test failed::${safeFilename} exited with status ${safeStatus}${detail ? ` | ${detail}` : ''}\n`
  );
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
      encoding: 'utf8',
      env: process.env
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) {
      annotateFailure(filename, 'execution-error', result);
      fail('TEST_ARCHITECTURE_EXECUTION_ERROR', filename);
    }
    if (result.status !== 0) {
      annotateFailure(filename, result.status, result);
      fail('TEST_ARCHITECTURE_TEST_FAILED', filename);
    }
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
