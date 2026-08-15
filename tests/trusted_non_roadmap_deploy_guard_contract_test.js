'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const deploy = fs.readFileSync(path.join(root, '.github', 'workflows', 'trusted-dev-deploy.yml'), 'utf8');
const health = fs.readFileSync(path.join(root, '.github', 'workflows', 'trusted-runtime-health.yml'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs', 'TRUSTED_DELIVERY_RUNTIME_ISOLATION.md'), 'utf8');

const DEPLOY_MODE = 'ROADMAP_EXACT_CANDIDATE';
const N_A_MODE = 'NOT_APPLICABLE_NON_ROADMAP';

assert(deploy.includes("mapfile -t ISSUE_REFS"), 'trusted deploy must classify standalone Roadmap issue references before mutation');
assert(deploy.includes("if [[ \"${#ISSUE_REFS[@]}\" -eq 0 ]]"), 'zero Roadmap references must be explicitly classified');
assert(deploy.includes(`deployment_mode=${N_A_MODE}`), 'non-Roadmap mode must be a machine output');
assert(deploy.includes(`deployment_mode=${DEPLOY_MODE}`), 'Roadmap exact-candidate mode must be a machine output');
assert(deploy.includes('ROADMAP_ISSUE_REFERENCE_AMBIGUOUS'), 'ambiguous Roadmap-like PR must fail closed');
assert(deploy.includes('ROADMAP_ISSUE_STATE_INVALID'), 'invalid linked Roadmap metadata must fail closed');
assert(deploy.includes('ROADMAP_WRITER_BRANCH_MISMATCH'), 'writer branch mismatch must fail closed');
assert(deploy.includes('writer_branch:[[:space:]]*agent/'), 'trusted classification must require canonical agent writer branch');

for (const step of [
  'Set up trusted Node.js',
  'Install trusted locked tooling',
  'Download verified candidate artifact',
  'Checkout exact candidate without credentials',
  'Verify candidate artifact against trusted reconstruction',
  'Prepare verified deploy directory',
  'Push verified candidate through Apps Script API',
  'Promote exact Apps Script version to stable deployments'
]) {
  const start = deploy.indexOf(`- name: ${step}`);
  assert(start >= 0, `missing trusted deploy step: ${step}`);
  const next = deploy.indexOf('\n      - name:', start + 1);
  const block = deploy.slice(start, next < 0 ? deploy.length : next);
  assert(block.includes("if: steps.source.outputs.deploy_required == 'true'"), `${step} must be Roadmap-only`);
}

const prepareStart = deploy.indexOf('- name: Prepare verified deploy directory');
const prepareEnd = deploy.indexOf('\n      - name:', prepareStart + 1);
const prepareBlock = deploy.slice(prepareStart, prepareEnd);
assert(prepareBlock.includes('secrets.APPS_SCRIPT_ID') && prepareBlock.includes('secrets.CLASPRC_JSON'), 'credential-bearing deploy preparation must stay inside the gated Roadmap step');
assert(deploy.includes(`--arg deploymentMode '${N_A_MODE}'`), 'N/A deploy evidence must state its mode');
assert(deploy.includes("artifactHash:null,versionNumber:null"), 'N/A deploy evidence must not claim a deployed artifact/version');
assert(deploy.includes(`DESCRIPTION='CI-002 ${N_A_MODE}'`), 'N/A deploy status must be machine visible');
assert(deploy.includes('DEPLOYMENT_MODE_INVALID'), 'unknown deploy mode must fail closed');

assert(health.includes(`steps.candidate.outputs.deployment_mode == '${DEPLOY_MODE}'`), 'credential-bearing health path must require Roadmap deployment mode');
for (const step of ['Set up trusted Node.js', 'Install trusted locked tooling', 'Configure authenticated Apps Script execution', 'Run authenticated exact-build health']) {
  const start = health.indexOf(`- name: ${step}`);
  assert(start >= 0, `missing runtime health step: ${step}`);
  const next = health.indexOf('\n      - name:', start + 1);
  const block = health.slice(start, next < 0 ? health.length : next);
  assert(block.includes(`if: steps.candidate.outputs.deployment_mode == '${DEPLOY_MODE}'`), `${step} must be Roadmap-only`);
}

const healthNABranch = health.indexOf(`if [[ \"${DEPLOYMENT_MODE}\" == '${N_A_MODE}' ]]`);
assert(healthNABranch >= 0, 'runtime health must explicitly handle non-Roadmap N/A evidence');
assert(health.includes(`DESCRIPTION='CI-002 ${N_A_MODE}'`), 'runtime N/A status must be machine visible');
assert(health.includes(`PASS (${N_A_MODE}; no runtime mutation/probe)`), 'final health enforcement must accept only explicit non-Roadmap N/A mode');
assert(health.includes(`if: steps.candidate.outputs.deployment_mode == '${DEPLOY_MODE}' && steps.probe.outputs.result == 'PASS'`), 'CI-003 autonomy must never execute for non-Roadmap mode');
assert(health.includes('trusted-runtime-health failed closed: DEPLOYMENT_MODE_INVALID'), 'unknown runtime mode must fail closed');

assert(docs.includes('не pushится'), 'contract must explicitly forbid Apps Script push for non-Roadmap PR');
assert(docs.includes('не продвигается'), 'contract must explicitly forbid stable deployment promotion for non-Roadmap PR');
assert(docs.includes('не может перезаписать DEV runtime'), 'Owner UAT runtime-isolation invariant must be documented');

console.log('trusted_non_roadmap_deploy_guard_contract_test: PASS', {
  nonRoadmapMode: N_A_MODE,
  roadmapMode: DEPLOY_MODE,
  nonRoadmapRuntimeMutation: false,
  nonRoadmapCredentialSteps: false,
  roadmapExactCandidatePath: true,
  unknownModeFailClosed: true
});