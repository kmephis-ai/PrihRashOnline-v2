'use strict';

const fs = require('fs');
const path = require('path');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'appsscript.json'), 'utf8'));
const service = fs.readFileSync(path.join(root, 'DashboardWebDataService.js'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'chat-driven-dev-release.yml'), 'utf8');

expect(manifest.webapp, 'appsscript.json must declare webapp configuration');
expect(manifest.webapp.access === 'MYSELF', 'DEV Web App must remain private to the deploying owner');
expect(manifest.webapp.executeAs === 'USER_DEPLOYING', 'DEV Web App must execute as the deployer');
expect(/function\s+doGet\s*\(/.test(service), 'DashboardWebDataService.js must expose doGet(e)');
expect(workflow.includes('@google/clasp@3.3.0'), 'Release workflow must pin the verified clasp version');
expect(workflow.includes('create-deployment --deploymentId'), 'Release workflow must redeploy an existing verified Web App with clasp v3');
expect(workflow.includes('clasp --json open-web-app "${deployment_id}"'), 'Release workflow must resolve WEB_APP entry points through clasp / Apps Script API');
expect(workflow.includes('has no WEB_APP entry point; creating a fresh verified Web App deployment'), 'Release workflow must replace historical deployments without WEB_APP entry points');
expect(!workflow.includes('clasp update-deployment'), 'Release workflow must not use the obsolete deployment form');
expect(!workflow.includes('WEB_APP_URL="https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec"'), 'Release workflow must not synthesize a Web App URL from deploymentId');
expect(workflow.includes('MANUAL_RUNTIME_APPROVED=${{ steps.source.outputs.sha }}'), 'Private runtime approval must be bound to the exact candidate SHA');
expect(workflow.includes("RUNTIME_MODE='private-auth'"), 'MYSELF Web App must expose a private-auth runtime state');
expect(workflow.includes("RUNTIME_MODE='dashboard-marker'"), 'Release workflow must retain direct Dashboard marker verification when available');
expect(workflow.includes('Google Drive file-not-found'), 'Release workflow must fail closed on the known Drive file-not-found response');
expect(workflow.includes('Invalid or unexpected token'), 'Release workflow must fail closed on Apps Script runtime syntax errors');

console.log('apps_script_webapp_manifest_contract_test: OK');
