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
assert(workflow.includes('run-function prhReleaseHealthCheckToken'), 'runtime health must execute authenticated Apps Script function');
assert(workflow.includes('sourceTreeHash'), 'runtime health must verify source tree build identity');
assert(workflow.includes('artifactHash'), 'runtime health must preserve immutable artifact evidence');
assert(workflow.includes('DEV_VERIFIED'), 'successful authenticated health must produce DEV_VERIFIED');
assert(workflow.includes('trusted-runtime-health failed closed'), 'health failure must block the gate');
assert(workflow.includes('statuses: write'), 'runtime health requires only commit-status write visibility');
assert(workflow.includes('statuses/${CANDIDATE_SHA}'), 'runtime result must target the exact candidate SHA');
assert(workflow.includes("context='trusted-runtime-health'"), 'runtime status must use stable machine-readable context');
assert(workflow.includes("STATE='success'"), 'verified runtime must publish success status');
assert(workflow.includes("STATE='failure'"), 'failed runtime must publish failure status');
assert(!workflow.includes('issues: write'), 'runtime health must not gain issue mutation permission');
assert(!workflow.includes('contents: write'), 'runtime health must not gain repository content write permission');
assert(!workflow.includes('curl -L'), 'anonymous Web App curl must not be authoritative');
assert(!workflow.includes('manual marker'), 'manual marker must not be a gate');
assert(!workflow.includes('HEALTH_OUTPUT}" >>'), 'raw authenticated health output must not be copied into evidence');

const forbiddenEvidence = ['amount','income','expense','balance','description','category','merchant','counterparty','payload','transaction'];
const evidenceObjectMatch = workflow.match(/'\{candidateSha:[^']+\}'/);
assert(evidenceObjectMatch, 'privacy-safe evidence JSON contract missing');
forbiddenEvidence.forEach((field) => assert(!evidenceObjectMatch[0].toLowerCase().includes(field), `runtime evidence includes forbidden field class: ${field}`));

const statusBlock = workflow.slice(workflow.indexOf('- name: Publish machine-visible runtime status'), workflow.indexOf('- name: Enforce authenticated runtime health'));
assert(statusBlock.includes('REASON_CODE'), 'commit status may expose only technical reason code');
assert(statusBlock.includes("DESCRIPTION='CI-002 DEV_VERIFIED'"), 'successful status description must be static technical metadata');
assert(statusBlock.includes('DESCRIPTION="CI-002 ${REASON_CODE:-HEALTH_STEP_NOT_COMPLETED}"'), 'failed status description must be limited to technical reason code');
assert(!statusBlock.includes('HEALTH_OUTPUT'), 'raw authenticated output must never enter commit status');
const forbiddenStatusPayload = ['amount','income','expense','balance','category','merchant','counterparty','payload','transaction'];
forbiddenStatusPayload.forEach((field) => assert(!statusBlock.toLowerCase().includes(field), `commit status block includes forbidden field class: ${field}`));

console.log('trusted_runtime_health_workflow_contract_test: OK', {
  webapp: 'MYSELF',
  executionApi: 'MYSELF',
  authentication: 'owner OAuth',
  exactBuild: true,
  machineVisibleStatus: true,
  manualMarker: false,
  anonymousCurl: false
});
