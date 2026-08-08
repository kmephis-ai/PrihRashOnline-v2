'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'trusted-runtime-health.yml'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'appsscript.json'), 'utf8'));

assert.strictEqual(manifest.webapp.access, 'MYSELF', 'private Web App access must not be weakened');
assert.strictEqual(manifest.webapp.executeAs, 'USER_DEPLOYING');
assert(manifest.executionApi, 'Apps Script API executable must be declared');
assert.strictEqual(manifest.executionApi.access, 'MYSELF', 'Execution API must remain owner-only');

assert(workflow.includes('workflows: [Trusted DEV Deploy]'), 'runtime health must chain from trusted deploy');
assert(workflow.includes("github.event.workflow_run.conclusion == 'success'"), 'runtime health must require successful trusted deploy');
assert(workflow.includes('environment: DEV'), 'runtime health must use trusted DEV environment credentials');
assert(workflow.includes('secrets.CLASPRC_JSON'), 'runtime health requires owner OAuth from DEV environment');
assert(workflow.includes('secrets.APPS_SCRIPT_API_DEPLOYMENT_ID'), 'runtime health requires the private API executable deployment id');
assert(workflow.includes('CLASP_USER: prihrash-ci'), 'runtime health must bind to the named owner OAuth profile');

assert(workflow.includes('show-authorized-user --user "${CLASP_USER}" --json'), 'runtime health must inspect the named clasp OAuth client type before scripts.run');
assert(workflow.includes("jq -r '.clientType // empty'"), 'OAuth preflight must read only the client type');
assert(/CLIENT_TYPE[^\n]+==[^\n]+'google-provided'/.test(workflow), 'google-provided clasp credentials must be detected');
assert(/CLIENT_TYPE[^\n]+!=[^\n]+'user-provided'/.test(workflow), 'only user-provided OAuth credentials may proceed to scripts.run');
assert(workflow.includes('CUSTOM_OAUTH_CLIENT_REQUIRED'), 'google-provided credentials must fail with an actionable bounded reason');
assert(workflow.includes('OAUTH_CLIENT_PREFLIGHT_FAILED'), 'OAuth metadata read failure must fail closed');
assert(workflow.includes('OAUTH_CLIENT_TYPE_UNSUPPORTED'), 'unknown OAuth client type must fail closed');
assert(!workflow.includes("jq -r '.clientId"), 'OAuth preflight must never parse clientId for evidence or decisions');

assert(workflow.includes('tools/apps-script-api-exec.js'), 'runtime health must use the trusted direct scripts.run executor');
assert(workflow.includes("prhRuntimeTransportPing '[]'"), 'runtime health must first prove authenticated Execution API transport');
assert(/PING_TOKEN[^\n]+!=[^\n]+'PRH_TRANSPORT_V1\|OK'/.test(workflow), 'transport ping must accept only its exact scalar response');
assert(workflow.includes('prhReleaseHealthCheckToken "${PARAMS}"'), 'runtime health must then execute exact-build workbook health');
assert(!workflow.includes('run-function prhRuntimeTransportPing'), 'clasp run-function must not be authoritative for owner-only executionApi');
assert(!workflow.includes('run-function prhReleaseHealthCheckToken'), 'exact-build health must use direct scripts.run, not clasp run-function');
assert(workflow.includes('TOKEN_PATTERN='), 'exact health token format must remain SHA/tree bound');
assert(workflow.includes('sourceTreeHash'), 'runtime health must verify source tree build identity');
assert(workflow.includes('artifactHash'), 'runtime health must preserve immutable artifact evidence');
assert(workflow.includes('DEV_VERIFIED'), 'successful authenticated health must produce DEV_VERIFIED');
assert(workflow.includes('trusted-runtime-health failed closed'), 'health failure must block the gate');

assert(workflow.includes('statuses: write'), 'runtime health requires commit-status visibility');
assert(workflow.includes('contents: write'), 'CI-003 runtime gate needs repository content write permission solely for exact-head merge and repository dispatch');
assert(workflow.includes('pull-requests: read'), 'CI-003 must re-read PR identity before merge');
assert(workflow.includes('issues: read'), 'CI-003 must validate the linked Roadmap Issue without mutating it');
assert(!workflow.includes('issues: write'), 'secret-bearing runtime workflow must not mutate Issues; Main Verification owns closure');
assert(workflow.includes('statuses/${CANDIDATE_SHA}'), 'runtime result must target the exact candidate SHA');
assert(workflow.includes("context='trusted-runtime-health'"), 'runtime status must use stable machine-readable context');
assert(workflow.includes('trusted-runtime-health-reason:${REASON}'), 'runtime status must expose technical reason code as a second context');
assert(workflow.includes("STATE='success'"), 'verified runtime must publish success status');
assert(workflow.includes("STATE='failure'"), 'failed runtime must publish failure status');
assert(!workflow.includes('curl -L'), 'anonymous Web App curl must not be authoritative');
assert(!workflow.includes('manual marker'), 'manual marker must not be a gate');

assert(workflow.includes("steps.probe.outputs.result == 'PASS'"), 'autonomous merge must be gated on authenticated runtime PASS');
assert(workflow.includes("merge_method='squash'"), 'autonomous merge must be squash');
assert(workflow.includes('-f sha="${CANDIDATE_SHA}"'), 'merge request must atomically match the exact candidate head');
assert(workflow.includes('head.repo.full_name') && workflow.includes('base.ref') && workflow.includes('head.sha'), 'same-repository/main/exact-head must be revalidated');
assert(workflow.includes("context='autonomous-merge'"), 'CI-003 merge result must be machine-visible on the candidate');
assert(workflow.includes('ci003-main-verification'), 'successful merge must dispatch secret-free main verification');
assert(!/\bgit\s+push\b/.test(workflow), 'runtime workflow must never directly push post-merge commits');
assert(!/--admin\b/.test(workflow), 'autonomous merge must not bypass branch policy with admin mode');

const forbiddenEvidence = ['amount','income','expense','balance','description','category','merchant','counterparty','payload','transaction','clientid','email','user'];
const evidenceObjectMatch = workflow.match(/'\{candidateSha:[^']+\}'/);
assert(evidenceObjectMatch, 'privacy-safe evidence JSON contract missing');
forbiddenEvidence.forEach((field) => assert(!evidenceObjectMatch[0].toLowerCase().includes(field), `runtime evidence includes forbidden field class: ${field}`));

const statusBlock = workflow.slice(workflow.indexOf('- name: Publish machine-visible runtime status'), workflow.indexOf('- name: Resolve autonomous roadmap merge eligibility'));
assert(statusBlock.includes('REASON_CODE'), 'commit status may expose only technical reason code');
assert(statusBlock.includes("DESCRIPTION='CI-002 DEV_VERIFIED'"), 'successful status description must be static technical metadata');
assert(statusBlock.includes('DESCRIPTION="CI-002 ${REASON}"'), 'failed status description must be limited to technical reason code');
assert(statusBlock.includes("description='CI-002 technical reason'"), 'reason-coded status description must be static');
['AUTH_OUTPUT','CLIENT_TYPE','PING_JSON','HEALTH_JSON','clientId','clientSecret','refreshToken','accessToken'].forEach((rawName) => {
  assert(!statusBlock.includes(rawName), `${rawName} must never enter commit status`);
});
const forbiddenStatusPayload = ['amount','income','expense','balance','category','merchant','counterparty','payload','transaction','email'];
forbiddenStatusPayload.forEach((field) => assert(!statusBlock.toLowerCase().includes(field), `commit status block includes forbidden field class: ${field}`));

console.log('trusted_runtime_health_workflow_contract_test: OK', {
  webapp: 'MYSELF',
  executionApi: 'MYSELF',
  authentication: 'owner OAuth',
  oauthClientPreflight: true,
  directScriptsRun: true,
  exactBuild: true,
  machineVisibleStatus: true,
  machineVisibleReason: true,
  autonomousMerge: 'health-gated exact-head squash',
  issueMutation: 'Main Verification only',
  manualMarker: false,
  anonymousCurl: false
});
