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
  classifyNoopWriteFailure,
  validateRemoteContent,
  remoteFilesForNoop,
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

assert.strictEqual(classifyNoopWriteFailure(400, { error: { status: 'INVALID_ARGUMENT' } }), 'APPS_SCRIPT_REMOTE_NOOP_INVALID_ARGUMENT');
assert.strictEqual(classifyNoopWriteFailure(403, { error: { status: 'PERMISSION_DENIED' } }), 'OAUTH_OR_CLOUD_PROJECT_PERMISSION_REQUIRED');
assert.strictEqual(classifyNoopWriteFailure(404, { error: { status: 'NOT_FOUND' } }), 'APPS_SCRIPT_PROJECT_UNAVAILABLE');
assert.strictEqual(classifyNoopWriteFailure(412, { error: { status: 'FAILED_PRECONDITION' } }), 'APPS_SCRIPT_REMOTE_NOOP_PRECONDITION_FAILED');
assert.strictEqual(classifyNoopWriteFailure(503, { error: { status: 'UNAVAILABLE' } }), 'APPS_SCRIPT_REMOTE_NOOP_HTTP_503_UNAVAILABLE');

const remoteOk = {
  files: [
    { name: 'ApplicationMenuService', type: 'SERVER_JS', source: 'private remote a', createTime: 'ignored' },
    { name: 'RuntimeHealth', type: 'SERVER_JS', source: 'private remote b', updateTime: 'ignored' },
    { name: 'appsscript', type: 'JSON', source: '{"private":"remote manifest"}', lastModifyUser: { name: 'ignored' } }
  ]
};
assert.strictEqual(validateRemoteContent(remoteOk, diagnosticFiles), '');
assert.strictEqual(validateRemoteContent({ files: [] }, diagnosticFiles), 'APPS_SCRIPT_REMOTE_CONTENT_INVALID');
assert.strictEqual(validateRemoteContent({ files: [{ name: 'Code', type: 'SERVER_JS' }] }, diagnosticFiles), 'APPS_SCRIPT_REMOTE_SOURCE_MISSING');
assert.strictEqual(validateRemoteContent({ files: [
  { name: 'appsscript', type: 'JSON', source: '{}' },
  { name: 'RuntimeHealth', type: 'HTML', source: '<p>x</p>' }
] }, diagnosticFiles), 'DEPLOY_REMOTE_TYPE_MISMATCH_RUNTIMEHEALTH');

assert.deepStrictEqual(remoteFilesForNoop(remoteOk), [
  { name: 'ApplicationMenuService', type: 'SERVER_JS', source: 'private remote a' },
  { name: 'RuntimeHealth', type: 'SERVER_JS', source: 'private remote b' },
  { name: 'appsscript', type: 'JSON', source: '{"private":"remote manifest"}' }
]);
assert.throws(() => remoteFilesForNoop({ files: [{ name: 'Code', type: 'SERVER_JS' }] }), /APPS_SCRIPT_REMOTE_CONTENT_INVALID/);

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
assert(source.includes('remoteFilesForNoop(remotePayload.json)'), 'trusted write path must construct a semantic no-op from accepted remote files');
assert(source.includes('const noopResponse = await fetch(contentUrl'), 'remote no-op PUT must run before the candidate PUT');
assert(source.includes('JSON.stringify({ files: noopFiles })'), 'no-op must send only accepted name/type/source remote content');
assert(source.includes('APPS_SCRIPT_REMOTE_NOOP_RESPONSE_INVALID'), 'no-op response must be verified fail-closed');
assert(source.includes('DEPLOY_CANDIDATE_INVALID_AFTER_REMOTE_NOOP_OK'), 'generic candidate invalidity after a successful no-op must become decisive machine evidence');
assert(source.indexOf('const noopResponse = await fetch(contentUrl') < source.indexOf('const pushResponse = await fetch(contentUrl'), 'no-op A/B proof must precede candidate replacement');
assert(source.includes('auth.tokens[profileName]'), 'push must use named clasp OAuth profile');
assert(source.includes('validateRemoteContent(remotePayload.json, files)'), 'remote accepted file metadata must be checked before any write');

// Raw Google/OAuth/remote source material may be inspected privately but never emitted/logged.
assert(!/emit\((pushPayload|projectPayload|remotePayload|noopPayload)/.test(source), 'raw API response must never be emitted');
assert(!/console\.log\([^\n]*(Payload|clientId|clientSecret|refreshToken|accessToken|noopFiles)/.test(source), 'raw API/OAuth/remote material must never be logged');
assert(!/emit\(\{[^}]*\b(raw|message|text|payload|description|source|clientId|clientSecret|refreshToken|accessToken)\s*:/.test(source), 'failure output must not contain raw API/OAuth/remote fields');

console.log('apps_script_api_push_contract_test: OK', {
  api: 'projects.updateContent',
  scriptProjectPreflight: true,
  remoteContentPreflight: true,
  remoteNoopWriteProof: true,
  outputOnlyRemoteMetadataStripped: true,
  candidateInvalidAfterNoopObservable: true,
  remoteSourcePublished: false,
  boundedErrors: true,
  credentialOutput: false,
  rawApiOutput: false
});
