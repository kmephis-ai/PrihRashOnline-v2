'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'trusted-dev-deploy.yml'), 'utf8');

assert(workflow.includes('workflows: [PR Validation]'), 'trusted deploy must remain chained from PR Validation');
assert(workflow.includes('statuses: write'), 'trusted deploy requires only commit-status write visibility');
assert(workflow.includes('contents: read'), 'trusted deploy must retain read-only repository contents permission');
assert(!workflow.includes('contents: write'), 'trusted deploy must not gain repository content write permission');
assert(!workflow.includes('issues: write'), 'trusted deploy must not gain issue mutation permission');
assert(workflow.includes("context='trusted-dev-deploy'"), 'trusted deploy status must use a stable context');
assert(workflow.includes('statuses/${CANDIDATE_SHA}'), 'trusted deploy status must target exact immutable candidate SHA');
assert(workflow.includes("DESCRIPTION='CI-002 TRUSTED_DEPLOYED'"), 'successful deploy status must be static technical metadata');
assert(workflow.includes("DESCRIPTION='CI-002 TRUSTED_DEPLOY_FAILED'"), 'failed deploy status must be static technical metadata');
assert(workflow.includes('JOB_STATUS: ${{ job.status }}'), 'status must reflect fail-closed job outcome');

const statusBlock = workflow.slice(workflow.indexOf('- name: Publish machine-visible trusted deploy status'));
assert(!statusBlock.includes('CLASPRC_JSON'), 'deploy status block must not reference OAuth material');
assert(!statusBlock.includes('APPS_SCRIPT_ID'), 'deploy status block must not expose private script identity');
['amount','income','expense','balance','category','merchant','counterparty','payload','transaction','descriptionText'].forEach((field) => {
  assert(!statusBlock.toLowerCase().includes(field.toLowerCase()), `deploy status block includes forbidden payload class: ${field}`);
});

console.log('trusted_dev_deploy_observability_contract_test: OK', {
  exactCandidateStatus: true,
  successAndFailureVisible: true,
  financialPayload: false
});
