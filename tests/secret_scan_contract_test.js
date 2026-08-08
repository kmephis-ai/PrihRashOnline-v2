'use strict';

const assert = require('assert');
const { isBlockedPath, scanContent } = require('../tools/secret-scan');

assert.strictEqual(isBlockedPath('.env'), true);
assert.strictEqual(isBlockedPath('.env.local'), true);
assert.strictEqual(isBlockedPath('.clasprc.json'), true);
assert.strictEqual(isBlockedPath('.clasp.json'), true);
assert.strictEqual(isBlockedPath('config/service-account.json'), true);
assert.strictEqual(isBlockedPath('.clasp.json.example'), false);

const privateKey = ['-----BEGIN ', 'PRIVATE KEY-----', 'synthetic-body', '-----END ', 'PRIVATE KEY-----'].join('');
assert(scanContent('fixture.txt', privateKey).some((finding) => finding.rule === 'private-key'));

const githubToken = ['gh', 'p_', 'A'.repeat(36)].join('');
assert(scanContent('fixture.txt', githubToken).some((finding) => finding.rule === 'github-token'));

const clientSecret = ['{"client', '_secret":"', 'synthetic-secret-value-123', '"}'].join('');
assert(scanContent('fixture.json', clientSecret).some((finding) => finding.rule === 'oauth-client-secret'));

const harmless = '{"scriptId":"SYNTHETIC_PLACEHOLDER","rootDir":""}';
assert.deepStrictEqual(scanContent('.clasp.json.example', harmless), []);

console.log('secret_scan_contract_test: OK');
