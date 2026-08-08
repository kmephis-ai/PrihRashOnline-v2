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
assert(workflow.includes('--json run-function prhReleaseHealthCheckToken'), 'runtime health must request structured clasp execution output');
assert(workflow.includes('RAW_STDOUT='), 'runtime health must retain clasp stdout privately for framing analysis');
assert(workflow.includes("awk 'found || /^[[:space:]]*\\{/ {found=1; print}'"), 'runtime health must isolate a JSON payload after harmless stdout framing');
assert(workflow.includes('PLAIN_TOKEN='), 'runtime health must also accept only an exact scalar technical token');
assert(workflow.includes("jq -r '.response // empty'"), 'runtime health must parse only structured response result');
assert(workflow.includes("jq -r '.error.code // empty'"), 'runtime health must inspect structured Apps Script execution errors');
assert(workflow.includes("jq -c '.error.details // []'"), 'runtime health must inspect structured error details without publishing them');
assert(workflow.includes('classify_failure'), 'all unstructured/structured failures must go through bounded classification');
assert(workflow.includes('RUNTIME_HEALTH_[A-Z_]+'), 'runtime health must preserve bounded internal reason codes');
assert(workflow.includes('AUTHENTICATED_EXECUTION_UNPARSEABLE'), 'unparseable output must fail closed with a bounded reason');
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
assert(!workflow.includes('RAW_STDOUT}" >>'), 'raw authenticated stdout must not be copied into evidence');
assert(!workflow.includes('JSON_BLOCK}" >>'), 'raw authenticated JSON must not be copied into evidence');
assert(!workflow.includes('SAFE_ERROR}" >>'), 'raw authenticated error text must not be copied into evidence');

const forbiddenEvidence = ['amount','income','expense','balance','description','category','merchant','counterparty','payload','transaction'];
const evidenceObjectMatch = workflow.match(/'\{candidateSha:[^']+\}'/);
assert(evidenceObjectMatch, 'privacy-safe evidence JSON contract missing');
forbiddenEvidence.forEach((field) => assert(!evidenceObjectMatch[0].toLowerCase().includes(field), `runtime evidence includes forbidden field class: ${field}`));

const statusBlock = workflow.slice(workflow.indexOf('- name: Publish machine-visible runtime status'), workflow.indexOf('- name: Enforce authenticated runtime health'));
assert(statusBlock.includes('REASON_CODE'), 'commit status may expose only technical reason code');
assert(statusBlock.includes("DESCRIPTION='CI-002 DEV_VERIFIED'"), 'successful status description must be static technical metadata');
assert(statusBlock.includes('DESCRIPTION="CI-002 ${REASON}"'), 'failed status description must be limited to technical reason code');
assert(statusBlock.includes("description='CI-002 technical reason'"), 'reason-coded status description must be static');
['RAW_STDOUT','JSON_BLOCK','SAFE_ERROR'].forEach((rawName) => assert(!statusBlock.includes(rawName), `${rawName} must never enter commit status`));
const forbiddenStatusPayload = ['amount','income','expense','balance','category','merchant','counterparty','payload','transaction'];
forbiddenStatusPayload.forEach((field) => assert(!statusBlock.toLowerCase().includes(field), `commit status block includes forbidden field class: ${field}`));

console.log('trusted_runtime_health_workflow_contract_test: OK', {
  webapp: 'MYSELF',
  executionApi: 'MYSELF',
  authentication: 'owner OAuth',
  structuredClaspJson: true,
  framingTolerant: true,
  exactBuild: true,
  machineVisibleStatus: true,
  machineVisibleReason: true,
  manualMarker: false,
  anonymousCurl: false
});
