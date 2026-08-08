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
assert(!workflow.includes('curl -L'), 'anonymous Web App curl must not be authoritative');
assert(!workflow.includes('manual marker'), 'manual marker must not be a gate');
assert(!workflow.includes('HEALTH_OUTPUT}" >>'), 'raw authenticated health output must not be copied into evidence');

const forbiddenEvidence = ['amount','income','expense','balance','description','category','merchant','counterparty','payload','transaction'];
const evidenceObjectMatch = workflow.match(/'\{candidateSha:[^']+\}'/);
assert(evidenceObjectMatch, 'privacy-safe evidence JSON contract missing');
forbiddenEvidence.forEach((field) => assert(!evidenceObjectMatch[0].toLowerCase().includes(field), `runtime evidence includes forbidden field class: ${field}`));

console.log('trusted_runtime_health_workflow_contract_test: OK', {
  webapp: 'MYSELF',
  executionApi: 'MYSELF',
  authentication: 'owner OAuth',
  exactBuild: true,
  manualMarker: false,
  anonymousCurl: false
});
