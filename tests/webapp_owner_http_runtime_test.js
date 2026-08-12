'use strict';

const assert = require('assert');
const {
  validateWebUrl,
  isAllowedContentRedirect,
  isLoginRedirect,
  probeOwnerHttp
} = require('../tools/trusted-webapp-owner-http-probe');

const valid = validateWebUrl('https://script.google.com/macros/s/AKfySYNTHETIC_123456789/exec?private=forbidden');
assert(valid);
assert.strictEqual(valid.hostname, 'script.google.com');
assert.strictEqual(valid.search, '');
assert.strictEqual(validateWebUrl('https://evil.example/macros/s/AKfySYNTHETIC_123456789/exec'), null);
assert.strictEqual(validateWebUrl('https://script.google.com/not-a-webapp'), null);
assert.strictEqual(isLoginRedirect('https://accounts.google.com/ServiceLogin?continue=PRIVATE'), true);
assert.strictEqual(isLoginRedirect('https://script.google.com/macros/s/x/exec'), false);
assert.strictEqual(isAllowedContentRedirect('https://script.googleusercontent.com/macros/echo?private=token'), true);
assert.strictEqual(isAllowedContentRedirect('https://evil.example/redirect'), false);

function mockResponse(status, body, location) {
  return {
    status,
    headers: { get(name) { return String(name).toLowerCase() === 'location' ? (location || '') : null; } },
    async text() { return body || ''; }
  };
}

async function authenticated200() {
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls += 1;
    assert.strictEqual(url.hostname, 'script.google.com');
    assert.strictEqual(url.searchParams.get('surface'), 'home');
    assert.strictEqual(options.headers.authorization, 'Bearer SYNTHETIC_OWNER_TOKEN');
    return mockResponse(200, '<html><body data-prh-canonical-r2-shell="1"><h1>Финансовый дом</h1></body></html>');
  };
  const result = await probeOwnerHttp(
    new URL('https://script.google.com/macros/s/AKfySYNTHETIC_123456789/exec'),
    'SYNTHETIC_OWNER_TOKEN',
    fetchImpl
  );
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.reason, 'OWNER_HTTP_AUTHENTICATED_200');
  assert.strictEqual(result.http_status, 200);
  assert.strictEqual(result.canonical_shell, true);
  assert.strictEqual(result.russian_home_source, true);
  assert.strictEqual(calls, 1);
}

async function loginRequired() {
  const result = await probeOwnerHttp(
    new URL('https://script.google.com/macros/s/AKfySYNTHETIC_123456789/exec'),
    'SYNTHETIC_OWNER_TOKEN',
    async () => mockResponse(302, '', 'https://accounts.google.com/ServiceLogin?continue=PRIVATE')
  );
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'BROWSER_SESSION_REQUIRED');
  assert.strictEqual(result.redirect_count, 1);
  assert(!JSON.stringify(result).includes('PRIVATE'));
}

async function googleContentRedirect() {
  let call = 0;
  const result = await probeOwnerHttp(
    new URL('https://script.google.com/macros/s/AKfySYNTHETIC_123456789/exec'),
    'SYNTHETIC_OWNER_TOKEN',
    async (url, options) => {
      call += 1;
      if (call === 1) {
        assert.strictEqual(options.headers.authorization, 'Bearer SYNTHETIC_OWNER_TOKEN');
        return mockResponse(302, '', 'https://script.googleusercontent.com/macros/echo?user_content_key=PRIVATE');
      }
      assert.strictEqual(url.hostname, 'script.googleusercontent.com');
      assert.strictEqual(options.headers.authorization, undefined, 'OAuth bearer must not be forwarded cross-host');
      return mockResponse(200, '<html><body data-prh-canonical-r2-shell="1"><h1>Финансовый дом</h1></body></html>');
    }
  );
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.redirect_count, 1);
  assert.strictEqual(call, 2);
}

Promise.all([authenticated200(), loginRequired(), googleContentRedirect()]).then(() => {
  console.log('trusted_webapp_owner_http_probe_test: OK', {
    privateUrlPublished: false,
    bearerCrossHostForwarded: false,
    browserSessionClassification: true,
    canonicalSourceProbe: true
  });
}).catch((error) => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
