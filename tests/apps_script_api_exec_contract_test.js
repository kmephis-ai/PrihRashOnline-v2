'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyFailure,
  executionErrorReason,
  safeToken,
  ALLOWED_FUNCTIONS
} = require('../tools/apps-script-api-exec');

const source = fs.readFileSync(path.join(__dirname, '..', 'tools', 'apps-script-api-exec.js'), 'utf8');

assert(ALLOWED_FUNCTIONS.has('prhRuntimeTransportPing'));
assert(ALLOWED_FUNCTIONS.has('prhReleaseHealthCheckToken'));
assert.strictEqual(ALLOWED_FUNCTIONS.size, 2, 'direct executor must allow only CI-002 health entrypoints');
assert.strictEqual(safeToken('prhReleaseHealthCheck', 28), 'PRHRELEASEHEALTHCHECK');
assert.strictEqual(safeToken('../bad value', 28), 'BAD_VALUE');

const runtimeMismatch = {
  error: {
    code: 3,
    message: 'ScriptError',
    details: [{
      '@type': 'type.googleapis.com/google.apps.script.v1.ExecutionError',
      errorMessage: 'Error: RUNTIME_HEALTH_BUILD_MISMATCH',
      errorType: 'ScriptError',
      scriptStackTraceElements: [{ function: 'prhReleaseHealthCheck', lineNumber: 24 }]
    }]
  }
};
assert.strictEqual(executionErrorReason(runtimeMismatch), 'RUNTIME_HEALTH_BUILD_MISMATCH');
assert.strictEqual(classifyFailure(200, JSON.stringify(runtimeMismatch.error), runtimeMismatch), 'RUNTIME_HEALTH_BUILD_MISMATCH');

const runtimeAuth = {
  error: {
    code: 3,
    message: 'ScriptError',
    details: [{
      '@type': 'type.googleapis.com/google.apps.script.v1.ExecutionError',
      errorMessage: 'Exception: Authorization is required to perform that action.',
      errorType: 'Exception',
      scriptStackTraceElements: [{ function: 'prhReleaseHealthCheck', lineNumber: 42 }]
    }]
  }
};
assert.strictEqual(executionErrorReason(runtimeAuth), 'OAUTH_SCRIPT_RUNTIME_SCOPES_REQUIRED');

const runtimeReference = {
  error: {
    code: 3,
    message: 'ScriptError',
    details: [{
      '@type': 'type.googleapis.com/google.apps.script.v1.ExecutionError',
      errorMessage: 'ReferenceError: opaque private developer detail',
      errorType: 'ReferenceError',
      scriptStackTraceElements: [{ function: 'prhReleaseHealthCheck', lineNumber: 37 }]
    }]
  }
};
assert.strictEqual(executionErrorReason(runtimeReference), 'SCRIPT_EXECUTION_REFERENCEERROR_PRHRELEASEHEALTHCHECK_L37');
assert.strictEqual(executionErrorReason({ error: { code: 10, details: [] } }), 'SCRIPT_EXECUTION_TIMEOUT');
assert.strictEqual(executionErrorReason({ error: { code: 1, details: [] } }), 'SCRIPT_EXECUTION_CANCELLED');
assert.strictEqual(executionErrorReason({ error: { code: 3, details: [] } }), 'SCRIPT_EXECUTION_INVALID_ARGUMENT');

assert.strictEqual(classifyFailure(404, 'not found'), 'API_EXECUTABLE_UNAVAILABLE');
assert.strictEqual(classifyFailure(403, 'PERMISSION_DENIED'), 'OAUTH_OR_CLOUD_PROJECT_PERMISSION_REQUIRED');
assert.strictEqual(classifyFailure(400, 'Request had insufficient authentication scopes'), 'OAUTH_PROJECT_SCOPES_REQUIRED');
assert.strictEqual(classifyFailure(400, 'script and caller must use the same Cloud Platform project'), 'COMMON_STANDARD_CLOUD_PROJECT_REQUIRED');
assert.strictEqual(classifyFailure(400, 'INVALID_ARGUMENT'), 'AUTHENTICATED_EXECUTION_INVALID_REQUEST');
assert.strictEqual(classifyFailure(429, 'RESOURCE_EXHAUSTED'), 'AUTHENTICATED_EXECUTION_RATE_LIMITED');
assert.strictEqual(classifyFailure(503, 'UNAVAILABLE'), 'AUTHENTICATED_EXECUTION_SERVER_ERROR');
assert.strictEqual(classifyFailure(418, 'opaque transport failure'), 'AUTHENTICATED_EXECUTION_FAILED');

assert(source.includes('auth.tokens[profileName]'), 'executor must resolve the named clasp credential profile');
assert(source.includes('profile.client_id'), 'executor must refresh using the user-provided OAuth client id privately');
assert(source.includes('profile.client_secret'), 'executor must refresh using the user-provided OAuth client secret privately');
assert(source.includes('profile.refresh_token'), 'executor must refresh using the private refresh token');
assert(source.includes('https://oauth2.googleapis.com/token'), 'executor must refresh OAuth before scripts.run');
assert(source.includes('https://script.googleapis.com/v1/scripts/'), 'executor must call the official Apps Script scripts.run endpoint');
assert(source.includes('devMode: false'), 'runtime proof must execute the deployed immutable version, not development mode');
assert(source.includes('scriptStackTraceElements'), 'executor must inspect structured Apps Script ExecutionError details privately');
assert(source.includes('errorMessage'), 'executor may classify structured runtime errors privately');
assert(source.includes('AUTHENTICATED_EXECUTION_NOT_COMPLETED'), 'unexpected incomplete operation must fail closed');
assert(source.includes('OAUTH_SCRIPT_RUNTIME_SCOPES_REQUIRED'), 'runtime scope failures need a bounded machine reason');
assert(source.includes('API_EXECUTABLE_ID_INVALID'), 'deployment id must be validated fail-closed');
assert(source.includes('OAUTH_TOKEN_REFRESH_FAILED'), 'OAuth refresh failure must use a bounded reason');
assert(source.includes('AUTHENTICATED_EXECUTION_INTERNAL_ERROR'), 'unexpected failures must stay bounded');

const forbiddenOutputPatterns = [
  /emit\([^\n]*(clientId|clientSecret|refreshToken|accessToken|errorMessage|scriptStackTraceElements)/,
  /console\.log\([^\n]*(clientId|clientSecret|refreshToken|accessToken|errorMessage|scriptStackTraceElements)/,
  /process\.stdout\.write\([^\n]*(clientId|clientSecret|refreshToken|accessToken|errorMessage|scriptStackTraceElements)/
];
forbiddenOutputPatterns.forEach((pattern) => assert(!pattern.test(source), 'OAuth/raw ExecutionError material must never be emitted'));

console.log('apps_script_api_exec_contract_test: OK', {
  transport: 'direct scripts.run',
  devMode: false,
  structuredExecutionError: true,
  runtimeScopeClassification: true,
  boundedStackLocalization: true,
  namedProfile: true,
  boundedErrors: true,
  credentialOutput: false,
  rawExecutionErrorOutput: false
});
