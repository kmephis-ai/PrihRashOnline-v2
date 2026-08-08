'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  boundedHttpReason,
  safeFileToken,
  extractInvalidContentReason,
  classifyFailure,
  classifyProjectLookupFailure,
  validateRemoteContent,
  toApiFile,
  readDeployFiles
} = require('../tools/apps-script-api-push');

assert.deepStrictEqual(toApiFile('appsscript.json', '{}'), { name: 'appsscript', type: 'JSON', source: '{}' });
assert.deepStrictEqual(toApiFile('RuntimeHealth.js', 'function x(){}'), { name: 'RuntimeHealth', type: 'SERVER_JS', source: 'function x(){}' });
assert.deepStrictEqual(toApiFile('DashboardWebApp.html', '<p>x</p>'), { name: 'DashboardWebApp', type: 'HTML', source: '<p>x</p>' });
assert.throws(() => toApiFile('secret.txt', 'x'), /UNSUPPORTED_DEPLOY_FILE/);
assert.strictEqual(safeFileToken('DashboardWebApp'), 'DASHBOARDWEBAPP');
assert.strictEqual(safeFileToken('../bad name'), 'BAD_NAME');

const diagnosticFiles = [
  { name: 'ApplicationMenuService', type: 'SERVER_JS', source: 'private source a' },
  { name: 'RuntimeHealth', type: 'SERVER_JS', source: 'private source b' },
  { name: 'appsscript', type: 'JSON', source: '{"private":"manifest"}' }
];
const fieldViolationPayload = {
  error: {
    status: 'INVALID_ARGUMENT',
    message: 'Request contains an invalid argument.',
    details: [{
      '@type': 'type.googleapis.com/google.rpc.BadRequest',
      fieldViolations: [{ field: 'files[1].source', description: 'private diagnostic text' }]
    }]
  }
};
assert.strictEqual(extractInvalidContentReason(fieldViolationPayload, diagnosticFiles), 'DEPLOY_INVALID_RUNTIMEHEALTH_SOURCE');
assert.strictEqual(classifyFailure(400, JSON.stringify(fieldViolationPayload), 'INVALID_ARGUMENT', fieldViolationPayload, diagnosticFiles), 'DEPLOY_INVALID_RUNTIMEHEALTH_SOURCE');

const messagePayload = {
  error: {
    status: 'INVALID_ARGUMENT',
    message: 'Syntax error in RuntimeHealth.gs line: 27 with private detail'
  }
};
assert.strictEqual(extractInvalidContentReason(messagePayload, diagnosticFiles), 'DEPLOY_INVALID_RUNTIMEHEALTH_L27');
assert.strictEqual(classifyFailure(400, JSON.stringify(messagePayload), 'INVALID_ARGUMENT', messagePayload, diagnosticFiles), 'DEPLOY_INVALID_RUNTIMEHEALTH_L27');
assert.strictEqual(extractInvalidContentReason({ error: { message: 'Invalid script manifest.' } }, diagnosticFiles), 'DEPLOY_MANIFEST_INVALID');
assert.strictEqual(extractInvalidContentReason({ error: { message: 'Request contains an invalid argument.' } }, diagnosticFiles), 'DEPLOY_INVALID_ARGUMENT_UNLOCATED');

assert.strictEqual(classifyProjectLookupFailure(400, { error: { status: 'INVALID_ARGUMENT' } }), 'APPS_SCRIPT_ID_OR_PROJECT_LOOKUP_INVALID');
assert.strictEqual(classifyProjectLookupFailure(403, { error: { status: 'PERMISSION_DENIED' } }), 'OAUTH_OR_CLOUD_PROJECT_PERMISSION_REQUIRED');
assert.strictEqual(classifyProjectLookupFailure(404, { error: { status: 'NOT_FOUND' } }), 'APPS_SCRIPT_PROJECT_UNAVAILABLE');
assert.strictEqual(classifyProjectLookupFailure(503, { error: { status: 'UNAVAILABLE' } }), 'APPS_SCRIPT_PROJECT_LOOKUP_HTTP_503_UNAVAILABLE');

const remoteOk = {
  files: [
    { name: 'ApplicationMenuService', type: 'SERVER_JS', source: 'private remote a' },
    { name: 'RuntimeHealth', type: 'SERVER_JS', source: 'private remote b' },
    { name: 'appsscript', type: 'JSON', source: '{"private":"remote manifest"}' }
  ]
};
assert.strictEqual(validateRemoteContent(remoteOk, diagnosticFiles), '');
assert.strictEqual(validateRemoteContent({ files: [] }, diagnosticFiles), 'APPS_SCRIPT_REMOTE_CONTENT_INVALID');
assert.strictEqual(validateRemoteContent({ files: [{ name: 'Code', type: 'SERVER_JS' }] }, diagnosticFiles), 'APPS_SCRIPT_REMOTE_MANIFEST_INVALID');
assert.strictEqual(validateRemoteContent({ files: [
  { name: 'appsscript', type: 'JSON' },
  { name: 'RuntimeHealth', type: 'HTML' }
] }, diagnosticFiles), 'DEPLOY_REMOTE_TYPE_MISMATCH_RUNTIMEHEALTH');

assert.strictEqual(classifyFailure(403, 'User has not enabled the Apps Script API. Enable it by visiting https://script.google.com/home/usersettings', 'PERMISSION_DENIED'), 'APPS_SCRIPT_API_USER_SETTING_REQUIRED');
assert.strictEqual(classifyFailure(403, 'Request had insufficient authentication scopes', 'PERMISSION_DENIED'), 'OAUTH_PROJECT_SCOPES_REQUIRED');
assert.strictEqual(classifyFailure(403, 'permission denied', 'PERMISSION_DENIED'), 'OAUTH_OR_CLOUD_PROJECT_PERMISSION_REQUIRED');
assert.strictEqual(classifyFailure(404, '', 'NOT_FOUND'), 'APPS_SCRIPT_PROJECT_UNAVAILABLE');
assert.strictEqual(classifyFailure(400, '', 'INVALID_ARGUMENT'), 'DEPLOY_CONTENT_INVALID');
assert.strictEqual(classifyFailure(413, '', ''), 'DEPLOY_CONTENT_TOO_LARGE');
assert.strictEqual(classifyFailure(409, '', 'FAILED_PRECONDITION'), 'APPS_SCRIPT_CONTENT_PRECONDITION_FAILED');
assert.strictEqual(classifyFailure(429, '', 'RESOURCE_EXHAUSTED'), 'APPS_SCRIPT_API_RATE_LIMITED');
assert.strictEqual(classifyFailure(503, '', 'UNAVAILABLE'), 'APPS_SCRIPT_API_SERVER_ERROR');
assert.strictEqual(classifyFailure(405, 'opaque', 'METHOD_NOT_ALLOWED'), 'APPS_SCRIPT_CONTENT_HTTP_405_METHOD_NOT_ALLOWED');
assert.strictEqual(classifyFailure(418, 'opaque', 'unknown value with spaces'), 'APPS_SCRIPT_CONTENT_HTTP_418_UNKNOWN');
assert.strictEqual(boundedHttpReason('not-a-code', 'UNKNOWN'), 'APPS_SCRIPT_CONTENT_HTTP_0_UNKNOWN');
assert.strictEqual(boundedHttpReason(422, 'UNPROCESSABLE_ENTITY'), 'APPS_SCRIPT_CONTENT_HTTP_422_UNPROCESSABLE_ENTITY');

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
assert(source.includes("method: 'GET'"), 'push must read-only preflight the Script project before content replacement');
assert(source.includes('/content'), 'push must read current Apps Script content before replacement');
assert(source.includes("method: 'PUT'"), 'content update must use PUT only after read-only preflight');
assert(source.includes('auth.tokens[profileName]'), 'push must use named clasp OAuth profile');
assert(source.includes('validateRemoteContent(remotePayload.json, files)'), 'remote accepted file metadata must be checked before candidate replacement');
assert(source.includes('pushPayload.json.error.status'), 'push must inspect structured Google error status privately');
assert(source.includes('fieldViolations'), 'push may localize invalid request field without publishing descriptions');

// Raw Google/OAuth material may be inspected privately for classification, but it must
// never be emitted/logged. Emitted failure objects are restricted to ok + bounded reason.
assert(!/emit\((pushPayload|projectPayload|remotePayload)/.test(source), 'raw API response must never be emitted');
assert(!/console\.log\([^\n]*(Payload|clientId|clientSecret|refreshToken|accessToken)/.test(source), 'raw API/OAuth material must never be logged');
assert(!/emit\(\{[^}]*\b(raw|message|text|payload|description|clientId|clientSecret|refreshToken|accessToken)\s*:/.test(source), 'failure output must not contain raw API/OAuth fields');

console.log('apps_script_api_push_contract_test: OK', {
  api: 'projects.updateContent',
  scriptProjectPreflight: true,
  remoteContentPreflight: true,
  remoteSourcePublished: false,
  safeInvalidFileLocalization: true,
  boundedErrors: true,
  credentialOutput: false,
  rawApiOutput: false
});
