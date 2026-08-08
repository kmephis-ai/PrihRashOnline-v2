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
assert(workflow.includes('secrets.APPS_SCRIPT_ID'), 'runtime health requires owner script identity from DEV environment');
assert(workflow.includes('secrets.CLASPRC_JSON'), 'runtime health requires owner OAuth from DEV environment');

assert(workflow.includes('show-authorized-user --json'), 'runtime health must inspect clasp OAuth client type before scripts.run');
assert(workflow.includes("jq -r '.clientType // empty'"), 'OAuth preflight must read only the client type');
assert(/CLIENT_TYPE[^\n]+==[^\n]+'google-provided'/.test(workflow), 'google-provided clasp credentials must be detected');
assert(/CLIENT_TYPE[^\n]+!=[^\n]+'user-provided'/.test(workflow), 'only user-provided OAuth credentials may proceed to scripts.run');
assert(workflow.includes('CUSTOM_OAUTH_CLIENT_REQUIRED'), 'google-provided credentials must fail with an actionable bounded reason');
assert(workflow.includes('OAUTH_CLIENT_PREFLIGHT_FAILED'), 'OAuth metadata read failure must fail closed');
assert(workflow.includes('OAUTH_CLIENT_TYPE_UNSUPPORTED'), 'unknown OAuth client type must fail closed');
assert(!workflow.includes("jq -r '.clientId"), 'OAuth preflight must never parse clientId for evidence or decisions');

assert(workflow.includes('run-function prhRuntimeTransportPing'), 'runtime health must first prove authenticated Execution API transport');
assert(workflow.includes("grep -Fx 'PRH_TRANSPORT_V1|OK'"), 'transport ping must accept only its exact scalar response');
assert(workflow.includes('AUTHENTICATED_TRANSPORT_PING_FAILED'), 'transport failure must have a bounded reason');
assert(workflow.includes('COMMON_STANDARD_CLOUD_PROJECT_REQUIRED'), 'shared standard Cloud project failure must have a bounded reason');
assert(workflow.includes('OAUTH_PROJECT_SCOPES_REQUIRED'), 'insufficient OAuth project scopes must have a bounded reason');
assert(workflow.includes('OAUTH_OR_CLOUD_PROJECT_PERMISSION_REQUIRED'), 'remaining authorization/project permission failures must be bounded');
assert(workflow.includes('run-function prhReleaseHealthCheckToken'), 'runtime health must then execute exact-build workbook health');
assert(workflow.includes('HEALTH_STATUS='), 'workbook health must capture clasp status');
assert(workflow.includes('HEALTH_OUTPUT='), 'workbook health must inspect output privately even when clasp exits zero');
assert(workflow.includes("classify_failure \"${HEALTH_OUTPUT}\" 'HEALTH_TOKEN_MISSING_OR_MISMATCH'"), 'token absence must always classify Apps Script error output');
assert(workflow.includes('RUNTIME_HEALTH_[A-Z_]+'), 'runtime health must preserve bounded internal reason codes');
assert(workflow.includes('sourceTreeHash'), 'runtime health must verify source tree build identity');
assert(workflow.includes('artifactHash'), 'runtime health must preserve immutable artifact evidence');
assert(workflow.includes('DEV_VERIFIED'), 'successful authenticated health must produce DEV_VERIFIED');
assert(workflow.includes('trusted-runtime-health failed closed'), 'health failure must block the gate');
assert(workflow.includes('statuses: write'), 'runtime health requires only commit-status write visibility');
assert(workflow.includes('statuses/${CANDIDATE_SHA}'), 'runtime result must target the exact candidate SHA');
assert(workflow.includes("context='trusted-runtime-health'"), 'runtime status must use stable machine-readable context');
assert(workflow.includes('trusted-runtime-health-reason:${REASON}'), 'runtime status must expose technical reason code as a second context');
assert(workflow.includes("STATE='success'"), 'verified runtime must publish success status');
assert(workflow.includes("STATE='failure'"), 'failed runtime must publish failure status');
assert(!workflow.includes('issues: write'), 'runtime health must not gain issue mutation permission');
assert(!workflow.includes('contents: write'), 'runtime health must not gain repository content write permission');
assert(!workflow.includes('curl -L'), 'anonymous Web App curl must not be authoritative');
assert(!workflow.includes('manual marker'), 'manual marker must not be a gate');

const forbiddenEvidence = ['amount','income','expense','balance','description','category','merchant','counterparty','payload','transaction','clientid','email','user'];
const evidenceObjectMatch = workflow.match(/'\{candidateSha:[^']+\}'/);
assert(evidenceObjectMatch, 'privacy-safe evidence JSON contract missing');
forbiddenEvidence.forEach((field) => assert(!evidenceObjectMatch[0].toLowerCase().includes(field), `runtime evidence includes forbidden field class: ${field}`));

const statusBlock = workflow.slice(workflow.indexOf('- name: Publish machine-visible runtime status'), workflow.indexOf('- name: Enforce authenticated runtime health'));
assert(statusBlock.includes('REASON_CODE'), 'commit status may expose only technical reason code');
assert(statusBlock.includes("DESCRIPTION='CI-002 DEV_VERIFIED'"), 'successful status description must be static technical metadata');
assert(statusBlock.includes('DESCRIPTION="CI-002 ${REASON}"'), 'failed status description must be limited to technical reason code');
assert(statusBlock.includes("description='CI-002 technical reason'"), 'reason-coded status description must be static');
['AUTH_OUTPUT','CLIENT_TYPE','PING_OUTPUT','HEALTH_OUTPUT','SAFE_ERROR','clientId'].forEach((rawName) => assert(!statusBlock.includes(rawName), `${rawName} must never enter commit status`));
const forbiddenStatusPayload = ['amount','income','expense','balance','category','merchant','counterparty','payload','transaction','email'];
forbiddenStatusPayload.forEach((field) => assert(!statusBlock.toLowerCase().includes(field), `commit status block includes forbidden field class: ${field}`));

console.log('trusted_runtime_health_workflow_contract_test: OK', {
  webapp: 'MYSELF',
  executionApi: 'MYSELF',
  authentication: 'owner OAuth',
  oauthClientPreflight: true,
  customOAuthRequiredForRun: true,
  transportPing: true,
  executionErrorOnExitZeroHandled: true,
  exactBuild: true,
  machineVisibleStatus: true,
  machineVisibleReason: true,
  manualMarker: false,
  anonymousCurl: false
});
