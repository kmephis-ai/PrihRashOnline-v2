'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const CONTRACT = require('../lib/pwa/pwa_baseline.v1.json');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pwa', 'manifest.webmanifest'), 'utf8'));
const sw = fs.readFileSync(path.join(__dirname, '..', 'pwa', 'service-worker.js'), 'utf8');
const shell = fs.readFileSync(path.join(__dirname, '..', 'pwa', 'index.html'), 'utf8');

assert.strictEqual(CONTRACT.schema, 'PRH_PWA_BASELINE_V1');
assert.strictEqual(CONTRACT.version, '1.0.0');
assert.strictEqual(CONTRACT.roadmap_id, 'PWA-020');
assert.strictEqual(CONTRACT.bundle.cache_version, 'prh-pwa-shell-v1');
assert.strictEqual(CONTRACT.bundle.supported_host_requirement, 'SECURE_ORIGIN_OR_LOCALHOST');
assert.strictEqual(CONTRACT.bundle.current_apps_script_host_activation, 'NOT_PROVEN_CURRENT_HOST');
assert.strictEqual(CONTRACT.cache_policy.default, 'NETWORK_ONLY');
assert.strictEqual(CONTRACT.cache_policy.shell_strategy, 'CACHE_FIRST_EXPLICIT_ALLOWLIST');
assert.strictEqual(CONTRACT.cache_policy.private_strategy, 'NETWORK_ONLY_NO_CACHE_FALLBACK');
assert.strictEqual(CONTRACT.cache_policy.cross_origin, 'NETWORK_ONLY');
assert.strictEqual(CONTRACT.cache_policy.non_get, 'NETWORK_ONLY');
assert.strictEqual(CONTRACT.cache_policy.financial_payload_cache_allowed, false);
assert.strictEqual(CONTRACT.cache_policy.authenticated_response_cache_allowed, false);
assert.strictEqual(CONTRACT.update_strategy.stale_cache_reuse, false);
assert.strictEqual(CONTRACT.update_strategy.runtime_financial_cache_migration, false);
assert(Object.values(CONTRACT.authority).every((value) => value === false));
assert.strictEqual(CONTRACT.privacy.public_finance_data, 'INDEPENDENTLY_GENERATED_SYNTHETIC_ONLY');
assert.strictEqual(CONTRACT.privacy.offline_shell_financial_payload, false);
assert.strictEqual(CONTRACT.privacy.private_runtime_locator_public, false);
assert.strictEqual(CONTRACT.cost.mode, 'FREE_ONLY');
assert.strictEqual(CONTRACT.cost.external_provider_required, false);
assert.strictEqual(CONTRACT.cost.cdn_required, false);

for (const field of ['name','short_name','start_url','scope','display','background_color','theme_color','icons']) {
  assert(Object.prototype.hasOwnProperty.call(manifest, field), `Manifest field missing: ${field}`);
}
assert.strictEqual(manifest.start_url, './');
assert.strictEqual(manifest.scope, './');
assert.strictEqual(manifest.display, 'standalone');
assert.deepStrictEqual(manifest.icons.map((item) => item.sizes).sort(), ['192x192','512x512']);
for (const icon of manifest.icons) {
  assert(icon.src.startsWith('./icons/'));
  assert(fs.existsSync(path.join(__dirname, '..', 'pwa', icon.src.replace('./',''))), `Icon missing: ${icon.src}`);
}

const allowed = CONTRACT.cache_policy.allowed_shell_paths;
assert.deepStrictEqual(allowed, ['./','./index.html','./manifest.webmanifest','./icons/icon-192.svg','./icons/icon-512.svg']);
for (const item of allowed) assert(sw.includes(`'${item}'`), `SW shell allowlist missing ${item}`);
for (const token of CONTRACT.cache_policy.private_path_tokens) assert(sw.includes(`'${token}'`), `SW private token missing ${token}`);
assert(sw.includes("const CACHE_VERSION = 'prh-pwa-shell-v1'"));
assert(sw.includes("name.startsWith('prh-pwa-shell-') && name !== CACHE_VERSION"), 'Old cache deletion rule missing');
assert(sw.includes('await self.clients.claim()'), 'clients.claim update rule missing');
assert(sw.includes("request.method !== 'GET'"), 'Non-GET network-only rule missing');
assert(sw.includes('url.origin !== self.location.origin'), 'Cross-origin network-only rule missing');
assert(sw.includes('if (isPrivateUrl(url))'), 'Private-route branch missing');
assert(sw.includes('event.respondWith(fetch(request))'), 'Network-only response missing');
assert(sw.includes('shellUrls().has(url.href)'), 'Explicit shell-only cache branch missing');
assert(sw.includes('cache.put(request, response.clone())'), 'Shell refresh cache write missing');

assert(shell.includes('rel="manifest" href="./manifest.webmanifest"'));
assert(shell.includes("navigator.serviceWorker.register('./service-worker.js',{scope:'./'})"));
assert(shell.includes('NOT_PROVEN_CURRENT_HOST'));
assert(shell.includes('не сохраняются в CacheStorage'));
assert(!/https?:\/\/(?:cdn\.|unpkg\.|jsdelivr\.)/i.test(shell), 'External CDN forbidden');
assert(!/script[^>]+src=["']https?:/i.test(shell), 'External runtime script forbidden');
assert(!/deployments?\/[A-Za-z0-9_-]{10,}/i.test(shell), 'Private deployment locator forbidden');

console.log('pwa_baseline_contract_test: OK', {
  contract: `${CONTRACT.schema}@${CONTRACT.version}`,
  shellAllowlist: allowed.length,
  privateRouteTokens: CONTRACT.cache_policy.private_path_tokens.length,
  appsScriptHost: CONTRACT.bundle.current_apps_script_host_activation,
  financialPayloadCache: false,
  freeOnly: true
});
