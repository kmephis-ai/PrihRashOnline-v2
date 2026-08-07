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
expect(workflow.includes('open-web-app'), 'Release workflow must resolve URL through clasp open-web-app / deployments.get');
expect(workflow.includes('WEB_APP'), 'Release workflow must require a verified WEB_APP entry point');
expect(workflow.includes('PrihRashOnline Web Dashboard DEV WebApp'), 'Release workflow must use the dedicated verified Web App deployment, not the historical generic deployment');
expect(!workflow.includes('WEB_APP_URL="https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec"'), 'Release workflow must never synthesize /exec from deploymentId');
expect(workflow.includes('^https://script\\.google\\.com/macros/s/'), 'Release workflow must accept the canonical Apps Script Web App URL shape without an extra path segment');
expect(!workflow.includes('^https://script\\.google\\.com/.*/macros/s/'), 'Release workflow must not require a fictitious path segment before /macros');
expect(workflow.includes('Google Drive file-not-found'), 'Release workflow must fail closed on the known Drive file-not-found response');

console.log('apps_script_webapp_manifest_contract_test: OK');
