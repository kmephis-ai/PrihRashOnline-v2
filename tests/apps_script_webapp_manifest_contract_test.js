'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'appsscript.json'), 'utf8'));
const trusted = fs.readFileSync(path.join(root, '.github', 'workflows', 'trusted-dev-deploy.yml'), 'utf8');
const promoter = fs.readFileSync(path.join(root, 'tools', 'apps-script-api-promote.js'), 'utf8');
const prValidation = fs.readFileSync(path.join(root, '.github', 'workflows', 'pr-validation.yml'), 'utf8');
const legacyWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'chat-driven-dev-release.yml'), 'utf8');
const legacyWebService = fs.readFileSync(path.join(root, 'DashboardWebDataService.js'), 'utf8');
const canonicalRouter = fs.readFileSync(path.join(root, 'CanonicalR2WebAppService.js'), 'utf8');

assert(manifest.webapp, 'appsscript.json must declare webapp configuration');
assert.strictEqual(manifest.webapp.access, 'MYSELF', 'DEV Web App must remain private to the deploying owner');
assert.strictEqual(manifest.webapp.executeAs, 'USER_DEPLOYING', 'DEV Web App must execute as the deploying owner');

const canonicalDoGets = canonicalRouter.match(/function\s+doGet\s*\(/g) || [];
const legacyDoGets = legacyWebService.match(/function\s+doGet\s*\(/g) || [];
assert.strictEqual(canonicalDoGets.length, 1, 'CanonicalR2WebAppService.js must expose the single canonical doGet');
assert.strictEqual(legacyDoGets.length, 0, 'DashboardWebDataService.js must not retain default doGet authority after UI-MIG-020');
assert(/DEFAULT_SURFACE:\s*'home'/.test(canonicalRouter), 'Canonical Web App default route must be R2 Financial Home');
assert(/\?surface=legacy/.test(canonicalRouter), 'Legacy Dashboard must remain a bounded explicit rollback route');
assert(/prhRenderWebDashboard_/.test(legacyWebService), 'Legacy renderer must remain deployable for bounded rollback');

assert(trusted.includes('workflow_run:'), 'Trusted deploy must be triggered from successful PR Validation completion');
assert(trusted.includes('workflows: [PR Validation]'), 'Trusted deploy must consume PR Validation as its source gate');
assert(trusted.includes('tools/apps-script-api-promote.js'), 'Trusted deploy must use the direct exact-version promotion helper');
assert(trusted.includes('steps.version_promote.outputs.version_number'), 'Trusted evidence must bind promotion to the explicit immutable version number');
assert(!trusted.includes('update-deployment'), 'Trusted mutation path must not depend on clasp deployment updates');
assert(!trusted.includes('create-deployment'), 'Trusted mutation path must not silently create replacement deployment identities');

assert(promoter.includes("WEB_DESCRIPTION = 'PrihRashOnline Web Dashboard DEV WebApp'"), 'Stable DEV Web App description must remain canonical');
assert(promoter.includes("entryPointType === type"), 'Stable deployment identity must be entry-point typed');
assert(promoter.includes("'WEB_APP'"), 'Promoter must require the Web App entry point');
assert(promoter.includes('WEB_DEPLOYMENT_IDENTITY_INVALID'), 'Missing/ambiguous stable Web App must fail closed');
assert(promoter.includes('/versions`'), 'Promoter must create an immutable Apps Script version');
assert(promoter.includes("method: 'PUT'"), 'Promoter must explicitly update stable deployments to that version');
assert(promoter.includes('DEPLOYMENT_EXACT_VERSION_VERIFY_FAILED'), 'Promoter must re-read and verify the exact version after update');
assert(trusted.includes('DEPLOYED_AWAITING_AUTHENTICATED_HEALTH'), 'CI-001 must explicitly defer authoritative runtime health to CI-002');
assert(!trusted.includes('curl -L'), 'Trusted deploy must not use anonymous curl as authoritative private Web App health');
assert(!trusted.includes('open-web-app'), 'CI-001 must not treat a public URL as runtime proof');

assert(!prValidation.includes('${{ secrets.'), 'PR Validation must not reference deployment secrets');
assert(!/\bclasp\s+push\b/.test(prValidation), 'PR Validation must not deploy candidate code');
assert(!legacyWorkflow.includes('${{ secrets.'), 'Legacy release workflow must remain unprivileged');
assert(!/\bclasp\s+push\b/.test(legacyWorkflow), 'Legacy release workflow must not retain a deployment path');

console.log('apps_script_webapp_manifest_contract_test: OK', {
  access: manifest.webapp.access,
  executeAs: manifest.webapp.executeAs,
  canonicalEntryPoint: 'CanonicalR2WebAppService.doGet',
  defaultSurface: 'home',
  legacyRollback: true,
  trustedPromotion: 'workflow_run+exact-rest-version',
  stableWebIdentity: 'description+WEB_APP',
  runtimeHealthOwner: 'CI-002'
});
