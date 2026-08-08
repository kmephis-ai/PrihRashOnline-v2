'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'appsscript.json'), 'utf8'));
const trusted = fs.readFileSync(path.join(root, '.github', 'workflows', 'trusted-dev-deploy.yml'), 'utf8');
const prValidation = fs.readFileSync(path.join(root, '.github', 'workflows', 'pr-validation.yml'), 'utf8');
const legacy = fs.readFileSync(path.join(root, '.github', 'workflows', 'chat-driven-dev-release.yml'), 'utf8');
const webService = fs.readFileSync(path.join(root, 'DashboardWebDataService.js'), 'utf8');

assert(manifest.webapp, 'appsscript.json must declare webapp configuration');
assert.strictEqual(manifest.webapp.access, 'MYSELF', 'DEV Web App must remain private to the deploying owner');
assert.strictEqual(manifest.webapp.executeAs, 'USER_DEPLOYING', 'DEV Web App must execute as the deploying owner');
assert(/function\s+doGet\s*\(/.test(webService), 'DashboardWebDataService.js must expose doGet');

assert(trusted.includes('workflow_run:'), 'Trusted deploy must be triggered from successful PR Validation completion');
assert(trusted.includes('workflows: [PR Validation]'), 'Trusted deploy must consume PR Validation as its source gate');
assert(trusted.includes('PrihRashOnline Web Dashboard DEV WebApp'), 'Trusted deploy must keep a stable DEV Web App deployment identity');
assert(trusted.includes('update-deployment'), 'Trusted deploy must update an existing stable DEV deployment when present');
assert(trusted.includes('create-deployment'), 'Trusted deploy must create the stable DEV deployment when absent');
assert(trusted.includes('DEPLOYED_AWAITING_AUTHENTICATED_HEALTH'), 'CI-001 must explicitly defer authoritative runtime health to CI-002');
assert(!trusted.includes('curl -L'), 'Trusted deploy must not use anonymous curl as authoritative private Web App health');
assert(!trusted.includes('open-web-app'), 'CI-001 must not treat a public URL as runtime proof');

assert(!prValidation.includes('${{ secrets.'), 'PR Validation must not reference deployment secrets');
assert(!/\bclasp\s+push\b/.test(prValidation), 'PR Validation must not deploy candidate code');
assert(!legacy.includes('${{ secrets.'), 'Legacy release workflow must remain unprivileged');
assert(!/\bclasp\s+push\b/.test(legacy), 'Legacy release workflow must not retain a deployment path');

console.log('apps_script_webapp_manifest_contract_test: OK', {
  access: manifest.webapp.access,
  executeAs: manifest.webapp.executeAs,
  trustedPromotion: 'workflow_run',
  runtimeHealthOwner: 'CI-002'
});
