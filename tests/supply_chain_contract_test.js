'use strict';

const assert = require('assert');
const { scanWorkflowContent } = require('../tools/supply-chain-scan');

const pinned = [
  'jobs:',
  '  test:',
  '    steps:',
  '      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683',
  '      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
  "        with: { node-version: '24' }",
  '      - run: npm ci --ignore-scripts --no-audit --no-fund',
  '      - run: npx --no-install clasp status'
].join('\n');
assert.deepStrictEqual(scanWorkflowContent('pinned.yml', pinned), []);

const floatingAction = 'steps:\n  - uses: actions/checkout@v4';
assert(scanWorkflowContent('floating.yml', floatingAction).some((f) => f.rule === 'third-party-action-not-full-sha'));

const oldNode = "steps:\n  - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020\n    with:\n      node-version: '20'";
assert(scanWorkflowContent('node20.yml', oldNode).some((f) => f.rule === 'node20-workflow-runtime'));

const mutableInstall = 'steps:\n  - run: npm install --no-audit --no-fund';
assert(scanWorkflowContent('install.yml', mutableInstall).some((f) => f.rule === 'npm-install-forbidden-use-npm-ci'));

const floatingClasp = 'steps:\n  - run: npm install @google/clasp@3';
const floatingFindings = scanWorkflowContent('clasp.yml', floatingClasp);
assert(floatingFindings.some((f) => f.rule === 'npm-install-forbidden-use-npm-ci'));
assert(floatingFindings.some((f) => f.rule === 'workflow-clasp-install-forbidden'));

const unlockedNpx = 'steps:\n  - run: npx clasp status';
assert(scanWorkflowContent('npx.yml', unlockedNpx).some((f) => f.rule === 'clasp-must-use-locked-local-cli'));

const localAction = 'steps:\n  - uses: ./\.github/actions/local-check';
assert.deepStrictEqual(scanWorkflowContent('local.yml', localAction), []);

console.log('supply_chain_contract_test: OK');
