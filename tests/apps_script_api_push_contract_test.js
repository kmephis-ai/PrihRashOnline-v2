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

assert.strictEqual(classifyFailure(403, 'User has not enabled the Apps Script API. Enable it by visiting https://script.google.com/home/usersettings', 'PERMISSION_DENIED'), 'APPS_SCRIPT_API_USER_SETTING_REQUIRED');
assert.strictEqual(classifyFailure(403, 'Request had insufficient authentication scopes', 'PERMISSION_DENIED'), 'OAUTH_PROJECT_SCOPES_REQUIRED');
assert.strictEqual(classifyFailure(403, 'permission denied', 'PERMISSION_DENIED'), 'OAUTH_OR_CLOUD_PROJECT_PERMISSION_REQUIRED');
assert.strictEqual(classifyFailure(404, '', 'NOT_FOUND'), 'APPS_SCRIPT_PROJECT_UNAVAILABLE');
assert.strictEqual(classifyFailure(400, 'Syntax error: Unexpected token line: 12 file: RuntimeHealth', 'INVALID_ARGUMENT'), 'DEPLOY_SYNTAX_ERROR');
assert.strictEqual(classifyFailure(400, '', 'INVALID_ARGUMENT'), 'DEPLOY_CONTENT_INVALID');
assert.strictEqual(classifyFailure(413, '', ''), 'DEPLOY_CONTENT_TOO_LARGE');
assert.strictEqual(classifyFailure(409, '', 'FAILED_PRECONDITION'), 'APPS_SCRIPT_CONTENT_PRECONDITION_FAILED');
assert.strictEqual(classifyFailure(429, '', 'RESOURCE_EXHAUSTED'), 'APPS_SCRIPT_API_RATE_LIMITED');
assert.strictEqual(classifyFailure(503, '', 'UNAVAILABLE'), 'APPS_SCRIPT_API_SERVER_ERROR');
assert.strictEqual(classifyFailure(418, 'opaque', 'UNKNOWN'), 'APPS_SCRIPT_CONTENT_PUSH_FAILED');

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
assert(source.includes('pushPayload.json.error.status'), 'push must classify only the structured Google error status in addition to private message matching');

// The raw Google response may be inspected privately for classification, but it must
// never be emitted/logged. Emitted failure objects are restricted to ok + reason.
assert(!/emit\(pushPayload/.test(source), 'raw API response must never be emitted');
assert(!/console\.log\([^\n]*(pushPayload|clientId|clientSecret|refreshToken|accessToken)/.test(source), 'raw API/OAuth material must never be logged');
assert(!/emit\(\{[^}]*\b(raw|message|text|payload|clientId|clientSecret|refreshToken|accessToken)\s*:/.test(source), 'failure output must not contain raw API/OAuth fields');
assert(/emit\(\{ ok: false, reason: classifyFailure\(/.test(source), 'HTTP failure must emit only a bounded classified reason');

console.log('apps_script_api_push_contract_test: OK', {
  api: 'projects.updateContent',
  deterministicFileMapping: true,
  manifestRequired: true,
  structuredErrors: true,
  boundedErrors: true,
  credentialOutput: false,
  rawApiOutput: false
});
