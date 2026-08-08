'use strict';

const assert = require('assert');
const {
  scanPrWorkflow,
  scanTrustedWorkflow,
  scanLegacyWorkflow
} = require('../tools/ci-trust-boundary-scan');

const prSafe = `
permissions:\n  contents: read
steps:
  - name: Build immutable Apps Script candidate
    run: node tools/build-apps-script-candidate.js
  - uses: actions/upload-artifact@${'a'.repeat(40)}
    with:
      name: apps-script-candidate-\${{ github.event.pull_request.head.sha }}
`;
assert.deepStrictEqual(scanPrWorkflow(prSafe), []);
assert(scanPrWorkflow(`${prSafe}\n- run: clasp push\n`).includes('pr-contains-deploy-capability'));
assert(scanPrWorkflow(`${prSafe}\nenv:\n  TOKEN: \${{ secrets.DEPLOY_TOKEN }}\n`).includes('pr-references-secrets'));

const trustedSafe = `
on:
  workflow_run:
    workflows: [PR Validation]
    types: [completed]
jobs:
  deploy:
    if: github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'pull_request'
    environment: DEV
    env:
      CANDIDATE_SHA: \${{ github.event.workflow_run.head_sha }}
    steps:
      - name: Verify source PR
        run: |
          echo head.repo.full_name
          echo base.ref
      - name: Verify candidate artifact against trusted reconstruction
        run: node trusted/tools/build-apps-script-candidate.js --verify promoted --expected expected --sha "$CANDIDATE_SHA"
      - name: Configure trusted deploy
        env:
          APPS_SCRIPT_ID: \${{ secrets.APPS_SCRIPT_ID }}
          CLASPRC_JSON: \${{ secrets.CLASPRC_JSON }}
        run: echo trusted
`;
assert.deepStrictEqual(scanTrustedWorkflow(trustedSafe), []);
assert(scanTrustedWorkflow(trustedSafe.replace("github.event.workflow_run.conclusion == 'success'", 'true')).includes('trusted-does-not-require-success'));
assert(scanTrustedWorkflow(`${trustedSafe}\n- run: node candidate-source/evil.js\n`).includes('trusted-executes-candidate-code'));

const legacySafe = `
name: Legacy release disabled
on: workflow_dispatch
permissions:\n  contents: read
jobs:
  redirect:
    runs-on: ubuntu-latest
    steps:
      - run: echo 'Use Trusted DEV Deploy after PR Validation.'
`;
assert.deepStrictEqual(scanLegacyWorkflow(legacySafe), []);
assert(scanLegacyWorkflow(`${legacySafe}\n# \${{ secrets.APPS_SCRIPT_ID }}\n`).includes('legacy-still-references-secrets'));

console.log('ci_trust_boundary_contract_test: OK');
