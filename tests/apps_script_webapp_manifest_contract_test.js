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
expect(workflow.includes('create-deployment --deploymentId'), 'Release workflow must redeploy the existing Web App with clasp v3');
expect(!workflow.includes('clasp update-deployment'), 'Release workflow must not use unavailable clasp v3 update-deployment');
expect(!workflow.includes('open-web-app'), 'Release workflow must not depend on unavailable clasp v3 open-web-app');
expect(workflow.includes('PrihRashOnline Web Dashboard DEV WebApp'), 'Release workflow must use the dedicated DEV Web App deployment');
expect(workflow.includes('WEB_APP_URL="https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec"'), 'Release workflow must derive the canonical /exec URL from the verified deployment id');
expect(workflow.includes('^https://script\\.google\\.com/macros/s/'), 'Release workflow must validate the canonical Apps Script Web App URL shape');
expect(workflow.includes('Google Drive file-not-found'), 'Release workflow must fail closed on the known Drive file-not-found response');
expect(workflow.includes('Invalid or unexpected token'), 'Release workflow must fail closed on Apps Script runtime syntax errors');
expect(workflow.includes('anonymous CI smoke did not execute doGet'), 'Private Web App authentication must never be treated as runtime success');

console.log('apps_script_webapp_manifest_contract_test: OK');
