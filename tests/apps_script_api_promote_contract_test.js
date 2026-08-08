'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  WEB_DESCRIPTION,
  API_DESCRIPTION,
  VERIFY_ATTEMPTS,
  VERIFY_DELAY_MS,
  safeStatus,
  classifyApiFailure,
  hasEntryPoint,
  deploymentVersion,
  deploymentDescription,
  deploymentConfig,
  waitForDeploymentVersion
} = require('../tools/apps-script-api-promote');

assert.strictEqual(WEB_DESCRIPTION, 'PrihRashOnline Web Dashboard DEV WebApp');
assert.strictEqual(API_DESCRIPTION, 'CI-002 authenticated runtime verification');
assert(Number.isInteger(VERIFY_ATTEMPTS) && VERIFY_ATTEMPTS >= 3 && VERIFY_ATTEMPTS <= 20, 'deployment visibility retries must remain bounded');
assert(Number.isInteger(VERIFY_DELAY_MS) && VERIFY_DELAY_MS >= 500 && VERIFY_DELAY_MS <= 5000, 'deployment visibility retry delay must remain bounded');
assert.strictEqual(typeof waitForDeploymentVersion, 'function');
assert.strictEqual(safeStatus({ error: { status: 'PERMISSION_DENIED' } }), 'PERMISSION_DENIED');
assert.strictEqual(safeStatus({ error: { status: 'bad status' } }), 'UNKNOWN');
assert.strictEqual(classifyApiFailure('PROMOTE', { status: 403 }, { error: { status: 'PERMISSION_DENIED' } }), 'PROMOTE_OAUTH_OR_PERMISSION_REQUIRED');
assert.strictEqual(classifyApiFailure('PROMOTE', { status: 404 }, { error: { status: 'NOT_FOUND' } }), 'PROMOTE_NOT_FOUND');
assert.strictEqual(classifyApiFailure('PROMOTE', { status: 429 }, { error: { status: 'RESOURCE_EXHAUSTED' } }), 'PROMOTE_RATE_LIMITED');

const web = {
  deploymentId: 'AKfyWeb',
  deploymentConfig: { versionNumber: 27, description: WEB_DESCRIPTION },
  entryPoints: [{ entryPointType: 'WEB_APP' }]
};
const api = {
  deploymentId: 'AKfyApi',
  deploymentConfig: { versionNumber: 27, description: API_DESCRIPTION },
  entryPoints: [{ entryPointType: 'EXECUTION_API' }]
};
assert(hasEntryPoint(web, 'WEB_APP'));
assert(!hasEntryPoint(web, 'EXECUTION_API'));
assert(hasEntryPoint(api, 'EXECUTION_API'));
assert.strictEqual(deploymentVersion(web), 27);
assert.strictEqual(deploymentDescription(web), WEB_DESCRIPTION);
assert.deepStrictEqual(deploymentConfig('script123', 28, 'desc'), {
  deploymentConfig: {
    scriptId: 'script123',
    versionNumber: 28,
    manifestFileName: 'appsscript',
    description: 'desc'
  }
});

const source = fs.readFileSync(path.join(__dirname, '..', 'tools', 'apps-script-api-promote.js'), 'utf8');
assert(source.includes('https://oauth2.googleapis.com/token'), 'promotion must privately refresh owner OAuth');
assert(source.includes('/deployments`'), 'promotion must list deployments through official Apps Script API');
assert(source.includes('/versions`'), 'promotion must create an immutable version through official Apps Script API');
assert(source.includes("method: 'POST'"), 'version creation must use POST');
assert(source.includes("method: 'PUT'"), 'deployment promotion must use PUT');
assert(source.includes("entryPointType === type"), 'deployment identity must be entry-point typed');
assert(source.includes("'EXECUTION_API'"), 'API executable identity must be validated');
assert(source.includes("'WEB_APP'"), 'Web App identity must be validated');
assert(source.includes('previousApiVersion') && source.includes('previousWebVersion'), 'promotion must retain rollback versions');
assert(source.includes('waitForDeploymentVersion'), 'post-update exact-version verification must tolerate only bounded read propagation');
assert(source.includes('for (let attempt = 1; attempt <= attempts; attempt += 1)'), 'deployment verification must use an explicit bounded attempt loop');
assert(source.includes("`${prefix}_VERSION_NOT_VISIBLE`"), 'exhausted propagation must fail with a bounded deployment-specific reason');
assert(source.includes('rollbackDeployments'), 'failed exact-version visibility must roll both stable deployments back');
assert(source.includes('DEPLOYMENT_EXACT_VERSION_VERIFY_FAILED'), 'generic exact-version failure fallback must remain bounded');
assert(source.includes('auth.tokens[profileName]'), 'promotion must use the named owner OAuth profile');

assert(!/while\s*\(true\)/.test(source), 'deployment verification must never poll without a bound');
assert(!/console\.log\([^\n]*(clientId|clientSecret|refreshToken|accessToken)/.test(source), 'OAuth material must never be logged');
assert(!/emit\(\{[^}]*\b(clientId|clientSecret|refreshToken|accessToken|deploymentId|scriptId)\s*:/.test(source), 'public output must not expose OAuth or deployment identifiers');

console.log('apps_script_api_promote_contract_test: OK', {
  immutableVersion: true,
  exactVersionBothDeployments: true,
  typedDeploymentIdentity: true,
  boundedPropagationRetry: true,
  rollbackOnVisibilityFailure: true,
  boundedOutput: true,
  credentialOutput: false
});
