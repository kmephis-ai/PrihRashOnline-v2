'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  MARKER_FILE,
  MARKER_SCHEMA,
  MARKER_VERSION,
  TARGET_HTML,
  PLACEHOLDER,
  WORKER_ENTRY,
  ALLOWED_BROWSER_MODULES,
  localFirstBrowserRuntimeConfig,
  assertNoExternalRuntimeLoaders
} = require('../tools/build-local-first-browser-runtime');
const { buildCandidate, verifyCandidate } = require('../tools/build-apps-script-candidate');

const ROOT = path.resolve(__dirname, '..');
const MODULE = 'pwa/local_visualization_adapter.js';
const SHA = '4'.repeat(40);
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/local_first/local_first_browser_runtime_marker.v1.json'), 'utf8'));

assert.strictEqual(ALLOWED_BROWSER_MODULES.includes(MODULE), true,
  'trusted main must allow the exact visualization adapter path before feature activation');
assert.strictEqual(contract.allowed_browser_modules.includes(MODULE), true,
  'marker contract must match the trusted visualization adapter allow-list');

const currentRoot = localFirstBrowserRuntimeConfig(ROOT);
assert.strictEqual(currentRoot.enabled, true, 'current Local-first root marker must remain valid');
assert.strictEqual(currentRoot.marker.modules.includes(MODULE), true,
  'VIZ-REC-001 activation must use the exact adapter path already trusted by main');
assert.strictEqual(currentRoot.marker.runtime_network_required_for_warm_route, false,
  'visualization activation must not require warm-route network');
assert.strictEqual(currentRoot.marker.external_cdn_required, false,
  'visualization activation must not require an external CDN');
assert.strictEqual(currentRoot.marker.cost_class, 'FREE_ONLY',
  'visualization activation must remain FREE_ONLY');

const adapterPath = path.join(ROOT, 'pwa', 'local_visualization_adapter.js');
assert.strictEqual(fs.existsSync(adapterPath), true,
  'activated trusted visualization adapter must exist as a tracked regular file');
const adapterStat = fs.lstatSync(adapterPath);
assert(adapterStat.isFile() && !adapterStat.isSymbolicLink(),
  'activated visualization adapter must be a regular non-symlink file');
const adapterSource = fs.readFileSync(adapterPath, 'utf8');
assertNoExternalRuntimeLoaders(adapterSource);
for (const forbidden of [
  'google.script.run', 'fetch(', 'XMLHttpRequest(', 'UrlFetchApp.',
  'setValues(', 'appendRow(', 'deleteRow(', 'insertRowAfter('
]) {
  assert(!adapterSource.includes(forbidden),
    `display-only visualization adapter gained forbidden authority: ${forbidden}`);
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'prh-pack-viz-lf-002-'));
const repository = path.join(temp, 'repository');
const source = path.join(temp, 'source');
fs.mkdirSync(path.join(repository, 'pwa'), { recursive:true });
fs.mkdirSync(source, { recursive:true });

fs.writeFileSync(path.join(repository, 'pwa', 'local_visualization_adapter.js'),
  `'use strict';\nwindow.__PRH_SYNTHETIC_VISUALIZATION_ADAPTER__=Object.freeze({schema:'PRH_SYNTHETIC_VISUALIZATION_ADAPTER_V1',financialWrite:false,networkRequired:false});\n`);
fs.writeFileSync(path.join(repository, 'pwa', 'local_analytics_worker_entry.js'),
  `'use strict';\nself.onmessage=function(){};\n`);
fs.writeFileSync(path.join(source, 'appsscript.json'), '{"timeZone":"Etc/UTC"}\n');
fs.writeFileSync(path.join(source, 'Code.js'), 'function doGet(){return "PACK-VIZ-LF-002 synthetic";}\n');
fs.writeFileSync(path.join(source, TARGET_HTML),
  `<!doctype html><html><body>${PLACEHOLDER}<main>visualization bootstrap</main></body></html>\n`);
fs.writeFileSync(path.join(source, MARKER_FILE), JSON.stringify({
  schema: MARKER_SCHEMA,
  version: MARKER_VERSION,
  enabled: true,
  target_html: TARGET_HTML,
  modules: [MODULE],
  worker_entry: WORKER_ENTRY,
  runtime_network_required_for_warm_route: false,
  external_cdn_required: false,
  cost_class: 'FREE_ONLY'
}, null, 2) + '\n');

try {
  const firstDir = path.join(temp, 'candidate-a');
  const secondDir = path.join(temp, 'candidate-b');
  const first = buildCandidate({
    sourceRoot: source,
    repositoryRoot: repository,
    outRoot: firstDir,
    candidateSha: SHA
  });
  const second = buildCandidate({
    sourceRoot: source,
    repositoryRoot: repository,
    outRoot: secondDir,
    candidateSha: SHA
  });

  assert.deepStrictEqual(second, first, 'visualization adapter packaging must be deterministic');
  assert(first.localFirstBrowserRuntime, 'synthetic activation must create trusted Local-first runtime metadata');
  assert.deepStrictEqual(first.localFirstBrowserRuntime.modules.map((item) => item.path), [MODULE]);
  assert.strictEqual(first.localFirstBrowserRuntime.runtimeNetworkRequiredForWarmRoute, false);
  assert.strictEqual(first.localFirstBrowserRuntime.externalCdnRequired, false);
  assert.strictEqual(first.localFirstBrowserRuntime.costClass, 'FREE_ONLY');

  const html = fs.readFileSync(path.join(firstDir, 'files', TARGET_HTML), 'utf8');
  assert(html.includes('__PRH_SYNTHETIC_VISUALIZATION_ADAPTER__'));
  assert(html.includes('financialWrite:false'));
  assert(html.includes('networkRequired:false'));
  assertNoExternalRuntimeLoaders(html);

  const verified = verifyCandidate(firstDir, secondDir, SHA);
  assert.strictEqual(verified.localFirstBrowserRuntime.runtimeSha256,
    first.localFirstBrowserRuntime.runtimeSha256);

  const missingRepository = path.join(temp, 'missing-repository');
  fs.mkdirSync(path.join(missingRepository, 'pwa'), { recursive:true });
  fs.writeFileSync(path.join(missingRepository, 'pwa', 'local_analytics_worker_entry.js'),
    `'use strict';\nself.onmessage=function(){};\n`);
  assert.throws(() => buildCandidate({
    sourceRoot: source,
    repositoryRoot: missingRepository,
    outRoot: path.join(temp, 'candidate-missing'),
    candidateSha: SHA
  }), /LOCAL_FIRST_RUNTIME_FILE_MISSING:pwa\/local_visualization_adapter\.js/,
  'allow-listed visualization adapter must fail closed when tracked bytes are absent');

  console.log('local_first_runtime_packager_contract_test: PASS', {
    exactAllowedModule: MODULE,
    rootActivationTrusted: true,
    trackedAdapterRequired: true,
    displayOnlyAuthority: true,
    deterministic: true,
    missingFileFailClosed: true,
    runtimeNetworkRequired: false,
    externalCdnRequired: false,
    financialWriteAuthorized: false,
    freeOnly: true
  });
} finally {
  fs.rmSync(temp, { recursive:true, force:true });
}
