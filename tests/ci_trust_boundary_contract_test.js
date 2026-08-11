'use strict';

const assert = require('assert');
const {
  scanPrWorkflow,
  scanTrustedWorkflow,
  scanRuntimeWorkflow,
  scanMainVerification,
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
assert(scanPrWorkflow(`${prSafe}\nif: \${{ !startsWith(github.head_ref, 'agent/release/') }}\n`).includes('pr-release-branch-skipped'));

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
          echo '.draft // false' SOURCE_PR_DRAFT
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
assert(scanTrustedWorkflow(trustedSafe.replace("echo '.draft // false' SOURCE_PR_DRAFT", 'echo draft guard omitted')).includes('trusted-draft-pr-deploy-guard-missing'));
assert(scanTrustedWorkflow(`${trustedSafe}\n- run: node candidate-source/evil.js\n`).includes('trusted-executes-candidate-code'));

const runtimeSafe = `
on:
  workflow_run:
    workflows: [Trusted DEV Deploy]
    types: [completed]
permissions:
  contents: write
  actions: read
  issues: read
  pull-requests: read
  statuses: write
jobs:
  health:
    if: github.event.workflow_run.conclusion == 'success'
    environment: DEV
    steps:
      - id: probe
        run: echo health notProductE2e:true
      - name: Resolve autonomous roadmap merge eligibility
        if: steps.probe.outputs.result == 'PASS'
        run: |
          echo head.repo.full_name
          echo base.ref
          echo head.sha
          echo 'Closes #123'
          echo 'status: IN_PROGRESS'
          echo work_class target_stage engineering_status product_stage
          echo product-ready-e2e PRODUCT_READY_E2E_NOT_PROVEN
      - name: Autonomous exact-head squash merge
        run: |
          echo trusted-dev-deploy trusted-runtime-health
          gh api --method PUT repos/x/y/pulls/1/merge -f merge_method='squash' -f sha="\${CANDIDATE_SHA}"
      - name: Dispatch main verification
        run: gh api --method POST "repos/\${GITHUB_REPOSITORY}/dispatches" -f event_type='ci003-main-verification'
`;
assert.deepStrictEqual(scanRuntimeWorkflow(runtimeSafe), []);
assert(scanRuntimeWorkflow(runtimeSafe.replace("steps.probe.outputs.result == 'PASS'", 'true')).includes('runtime-automerge-not-health-gated'));
assert(scanRuntimeWorkflow(runtimeSafe.replace('product-ready-e2e PRODUCT_READY_E2E_NOT_PROVEN', 'product gate omitted')).includes('runtime-product-e2e-premerge-gate-missing'));
assert(scanRuntimeWorkflow(`${runtimeSafe}\n# git push origin main\n`).includes('runtime-legacy-or-bypass-gate-present'));

const mainVerifySafe = `
on:
  repository_dispatch:
    types: [ci003-main-verification]
permissions:
  contents: read
  issues: write
  pull-requests: read
  statuses: write
jobs:
  verify:
    steps:
      - run: |
          echo merge_commit_sha
          echo merged_by.login github-actions[bot]
          echo trusted-dev-deploy trusted-runtime-health autonomous-merge
          echo merge_base_commit.sha
          echo work_class target_stage engineering_status product_stage
          echo product-ready-e2e PRODUCT_READY_E2E_NOT_PROVEN
          echo 'status: DONE'
          echo 'engineering_status: DONE_ENGINEERING'
          echo 'product_stage: DONE'
          echo '{state:"closed",state_reason:"completed"}'
`;
assert.deepStrictEqual(scanMainVerification(mainVerifySafe), []);
assert(scanMainVerification(`${mainVerifySafe}\nenv:\n  TOKEN: \${{ secrets.PRIVATE_TOKEN }}\n`).includes('main-verification-must-be-secret-free'));
assert(scanMainVerification(`${mainVerifySafe}\n# git push origin main\n`).includes('main-verification-post-merge-direct-commit-or-legacy-gate'));

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

console.log('ci_trust_boundary_contract_test: OK', {
  pr: 'all-main-targeting branches, no secrets',
  trustedDeploy: 'exact candidate',
  runtime: 'health-gated exact-head squash',
  mainVerification: 'secret-free issue close'
});
