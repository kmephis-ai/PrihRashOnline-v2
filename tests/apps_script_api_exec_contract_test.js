'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { classifyFailure, ALLOWED_FUNCTIONS } = require('../tools/apps-script-api-exec');

const source = fs.readFileSync(path.join(__dirname, '..', 'tools', 'apps-script-api-exec.js'), 'utf8');

assert(ALLOWED_FUNCTIONS.has('prhRuntimeTransportPing'));
assert(ALLOWED_FUNCTIONS.has('prhReleaseHealthCheckToken'));
assert.strictEqual(ALLOWED_FUNCTIONS.size, 2, 'direct executor must allow only CI-002 health entrypoints');

assert.strictEqual(classifyFailure(200, 'Error: RUNTIME_HEALTH_BUILD_MISMATCH'), 'RUNTIME_HEALTH_BUILD_MISMATCH');
assert.strictEqual(classifyFailure(404, 'not found'), 'API_EXECUTABLE_UNAVAILABLE');
assert.strictEqual(classifyFailure(403, 'PERMISSION_DENIED'), 'OAUTH_OR_CLOUD_PROJECT_PERMISSION_REQUIRED');
assert.strictEqual(classifyFailure(400, 'Request had insufficient authentication scopes'), 'OAUTH_PROJECT_SCOPES_REQUIRED');
assert.strictEqual(classifyFailure(400, 'script and caller must use the same Cloud Platform project'), 'COMMON_STANDARD_CLOUD_PROJECT_REQUIRED');
assert.strictEqual(classifyFailure(500, 'opaque transport failure'), 'AUTHENTICATED_EXECUTION_FAILED');

assert(source.includes("auth.tokens[profileName]"), 'executor must resolve the named clasp credential profile');
assert(source.includes("profile.client_id"), 'executor must refresh using the user-provided OAuth client id privately');
assert(source.includes("profile.client_secret"), 'executor must refresh using the user-provided OAuth client secret privately');
assert(source.includes("profile.refresh_token"), 'executor must refresh using the private refresh token');
assert(source.includes('https://oauth2.googleapis.com/token'), 'executor must refresh OAuth before scripts.run');
assert(source.includes('https://script.googleapis.com/v1/scripts/'), 'executor must call the official Apps Script scripts.run endpoint');
assert(source.includes('devMode: false'), 'runtime proof must execute the deployed immutable version, not development mode');
assert(source.includes("API_EXECUTABLE_ID_INVALID"), 'deployment id must be validated fail-closed');
assert(source.includes("OAUTH_TOKEN_REFRESH_FAILED"), 'OAuth refresh failure must use a bounded reason');
assert(source.includes("AUTHENTICATED_EXECUTION_INTERNAL_ERROR"), 'unexpected failures must stay bounded');

const forbiddenOutputPatterns = [
  /emit\([^\n]*(clientId|clientSecret|refreshToken|accessToken)/,
  /console\.log\([^\n]*(clientId|clientSecret|refreshToken|accessToken)/,
  /process\.stdout\.write\([^\n]*(clientId|clientSecret|refreshToken|accessToken)/
];
forbiddenOutputPatterns.forEach((pattern) => assert(!pattern.test(source), 'OAuth credential material must never be emitted'));

console.log('apps_script_api_exec_contract_test: OK', {
  transport: 'direct scripts.run',
  devMode: false,
  namedProfile: true,
  boundedErrors: true,
  credentialOutput: false
});
