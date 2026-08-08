'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'trusted-dev-deploy.yml'), 'utf8');
const promoter = fs.readFileSync(path.join(root, 'tools', 'apps-script-api-promote.js'), 'utf8');

assert(workflow.includes('workflows: [PR Validation]'), 'trusted deploy must remain chained from PR Validation');
assert(workflow.includes('statuses: write'), 'trusted deploy requires only commit-status write visibility');
assert(workflow.includes('contents: read'), 'trusted deploy must retain read-only repository contents permission');
assert(!workflow.includes('contents: write'), 'trusted deploy must not gain repository content write permission');
assert(!workflow.includes('issues: write'), 'trusted deploy must not gain issue mutation permission');
assert(workflow.includes("context='trusted-dev-deploy'"), 'trusted deploy status must use a stable context');
assert(workflow.includes('trusted-dev-deploy-reason:${REASON}'), 'trusted deploy must expose a bounded technical reason context');
assert(workflow.includes('statuses/${CANDIDATE_SHA}'), 'trusted deploy status must target exact immutable candidate SHA');
assert(workflow.includes("DESCRIPTION='CI-002 TRUSTED_DEPLOYED'"), 'successful deploy status must be static technical metadata');
assert(workflow.includes("DESCRIPTION='CI-002 TRUSTED_DEPLOY_FAILED'"), 'failed deploy status must be static technical metadata');
assert(workflow.includes("description='CI-002 deploy technical reason'"), 'reason status description must be static');
assert(workflow.includes('JOB_STATUS: ${{ job.status }}'), 'status must reflect fail-closed job outcome');

assert(workflow.includes('CONTENT_PUSH_REASON: ${{ steps.content_push.outputs.reason }}'), 'direct content push must provide only a bounded reason to status publishing');
assert(workflow.includes("REASON=\"${CONTENT_PUSH_REASON:-APPS_SCRIPT_CONTENT_PUSH_FAILED}\""), 'content push failure must use bounded executor reason or static fallback');
assert(workflow.includes("[[ \"${REASON}\" =~ ^[A-Z0-9_]+$ ]] || REASON='APPS_SCRIPT_CONTENT_PUSH_FAILED'"), 'dynamic push reason must be constrained before entering commit status');

assert(workflow.includes('VERSION_PROMOTE_REASON: ${{ steps.version_promote.outputs.reason }}'), 'exact-version promotion must provide only a bounded reason to status publishing');
assert(workflow.includes("REASON=\"${VERSION_PROMOTE_REASON:-DEPLOYMENT_PROMOTION_FAILED}\""), 'promotion failure must use bounded promoter reason or static fallback');
assert(workflow.includes("[[ \"${REASON}\" =~ ^[A-Z0-9_]+$ ]] || REASON='DEPLOYMENT_PROMOTION_FAILED'"), 'dynamic promotion reason must be constrained before entering commit status');
assert(workflow.includes('versionNumber'), 'privacy-safe deploy evidence must include the immutable Apps Script version number');
assert(!workflow.includes('WEB_DEPLOY_UPDATE_FAILED'), 'legacy clasp Web deployment reason must be removed');
assert(!workflow.includes('API_DEPLOY_UPDATE_FAILED'), 'legacy clasp API deployment reason must be removed');

const workflowReasonCodes = [
  'TRUSTED_CHECKOUT_FAILED',
  'NODE_SETUP_FAILED',
  'SOURCE_VALIDATION_FAILED',
  'TOOLING_INSTALL_FAILED',
  'ARTIFACT_DOWNLOAD_FAILED',
  'CANDIDATE_CHECKOUT_FAILED',
  'CANDIDATE_VERIFY_FAILED',
  'DEPLOY_PREP_FAILED',
  'APPS_SCRIPT_CONTENT_PUSH_FAILED',
  'DEPLOYMENT_PROMOTION_FAILED',
  'DEPLOY_EVIDENCE_FAILED',
  'DEPLOY_ARTIFACT_UPLOAD_FAILED',
  'DEPLOY_STEP_UNKNOWN',
  'OK'
];
workflowReasonCodes.forEach((reason) => assert(workflow.includes(reason), `missing bounded deploy reason: ${reason}`));

const promoterReasonCodes = [
  'OAUTH_TOKEN_REFRESH_FAILED',
  'DEPLOYMENT_LIST_RESPONSE_INVALID',
  'DEPLOYMENT_LIST_PAGINATION_EXCEEDED',
  'API_DEPLOYMENT_IDENTITY_INVALID',
  'WEB_DEPLOYMENT_IDENTITY_INVALID',
  'DEPLOYMENT_PREVIOUS_VERSION_INVALID',
  'VERSION_CREATE_RESPONSE_INVALID',
  'DEPLOYMENT_EXACT_VERSION_VERIFY_FAILED',
  'DEPLOYMENT_PROMOTION_INTERNAL_ERROR'
];
promoterReasonCodes.forEach((reason) => assert(promoter.includes(reason), `missing bounded promotion reason: ${reason}`));
assert(promoter.includes("`${prefix}_OAUTH_OR_PERMISSION_REQUIRED`"), 'promotion permission failures must remain prefix-bounded');
assert(promoter.includes("`${prefix}_PRECONDITION_FAILED`"), 'promotion precondition failures must remain prefix-bounded');
assert(promoter.includes("`${prefix}_RATE_LIMITED`"), 'promotion rate-limit failures must remain prefix-bounded');
assert(promoter.includes("`${prefix}_SERVER_ERROR`"), 'promotion server failures must remain prefix-bounded');
assert(promoter.includes("`${prefix}_HTTP_${code}_${safeStatus(payload)}`"), 'unknown promotion HTTP failures must remain bounded by code/status enum');

const statusBlock = workflow.slice(workflow.indexOf('- name: Publish machine-visible trusted deploy status'));
assert(!statusBlock.includes('CLASPRC_JSON'), 'deploy status block must not reference OAuth material');
assert(!statusBlock.includes('APPS_SCRIPT_ID'), 'deploy status block must not expose private script identity');
assert(!statusBlock.includes('APPS_SCRIPT_API_DEPLOYMENT_ID'), 'deploy status block must not expose API executable identity');
assert(!/echo[^\n]*(stderr|stdout|output|token|secret)/i.test(statusBlock), 'deploy status must not publish raw command/OAuth output');
['amount','income','expense','balance','category','merchant','counterparty','payload','transaction','descriptionText','clientId','clientSecret','refreshToken','accessToken','email'].forEach((field) => {
  assert(!statusBlock.toLowerCase().includes(field.toLowerCase()), `deploy status block includes forbidden payload class: ${field}`);
});

console.log('trusted_dev_deploy_observability_contract_test: OK', {
  exactCandidateStatus: true,
  boundedReasonVisible: true,
  directContentPushReason: true,
  exactVersionPromotionReason: true,
  legacyClaspDeploymentReasons: false,
  successAndFailureVisible: true,
  financialPayload: false,
  oauthPayload: false
});
