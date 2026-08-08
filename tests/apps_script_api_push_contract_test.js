'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { classifyFailure, toApiFile, readDeployFiles } = require('../tools/apps-script-api-push');

assert.deepStrictEqual(toApiFile('appsscript.json', '{}'), { name: 'appsscript', type: 'JSON', source: '{}' });
assert.deepStrictEqual(toApiFile('RuntimeHealth.js', 'function x(){}'), { name: 'RuntimeHealth', type: 'SERVER_JS', source: 'function x(){}' });
assert.deepStrictEqual(toApiFile('DashboardWebApp.html', '<p>x</p>'), { name: 'DashboardWebApp', type: 'HTML', source: '<p>x</p>' });
assert.throws(() => toApiFile('secret.txt', 'x'), /UNSUPPORTED_DEPLOY_FILE/);

assert.strictEqual(classifyFailure(403, 'User has not enabled the Apps Script API. Enable it by visiting https://script.google.com/home/usersettings'), 'APPS_SCRIPT_API_USER_SETTING_REQUIRED');
assert.strictEqual(classifyFailure(403, 'Request had insufficient authentication scopes'), 'OAUTH_PROJECT_SCOPES_REQUIRED');
assert.strictEqual(classifyFailure(403, 'PERMISSION_DENIED'), 'OAUTH_OR_CLOUD_PROJECT_PERMISSION_REQUIRED');
assert.strictEqual(classifyFailure(404, 'NOT_FOUND'), 'APPS_SCRIPT_PROJECT_UNAVAILABLE');
assert.strictEqual(classifyFailure(400, 'invalid manifest'), 'DEPLOY_CONTENT_INVALID');
assert.strictEqual(classifyFailure(500, 'opaque'), 'APPS_SCRIPT_CONTENT_PUSH_FAILED');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'prh-api-push-'));
fs.writeFileSync(path.join(temp, 'appsscript.json'), '{}');
fs.writeFileSync(path.join(temp, 'Code.js'), 'function x(){}');
fs.writeFileSync(path.join(temp, 'Ui.html'), '<p>x</p>');
fs.writeFileSync(path.join(temp, '.clasp.json'), '{"scriptId":"ignored"}');
const files = readDeployFiles(temp);
assert.deepStrictEqual(files.map((file) => [file.name, file.type]), [
  ['appsscript', 'JSON'],
  ['Code', 'SERVER_JS'],
  ['Ui', 'HTML']
]);
fs.rmSync(temp, { recursive: true, force: true });

const source = fs.readFileSync(path.join(__dirname, '..', 'tools', 'apps-script-api-push.js'), 'utf8');
assert(source.includes('https://oauth2.googleapis.com/token'), 'push must privately refresh owner OAuth');
assert(source.includes('https://script.googleapis.com/v1/projects/'), 'push must use official Apps Script project content endpoint');
assert(source.includes("method: 'PUT'"), 'content update must use PUT');
assert(source.includes('auth.tokens[profileName]'), 'push must use named clasp OAuth profile');
assert(!/emit\([^\n]*(clientId|clientSecret|refreshToken|accessToken)/.test(source), 'credential material must never be emitted');

console.log('apps_script_api_push_contract_test: OK', {
  api: 'projects.updateContent',
  deterministicFileMapping: true,
  manifestRequired: true,
  boundedErrors: true,
  credentialOutput: false
});
