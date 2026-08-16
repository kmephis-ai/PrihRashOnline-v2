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
  'PACK-VIZ-LF-002 must teach trusted main the exact visualization adapter path');
assert.strictEqual(contract.allowed_browser_modules.includes(MODULE), true,
  'marker contract must match the trusted visualization adapter allow-list');

const currentRoot = localFirstBrowserRuntimeConfig(ROOT);
assert.strictEqual(currentRoot.enabled, true, 'current Local-first root marker must remain valid');
assert.strictEqual(currentRoot.marker.modules.includes(MODULE), false,
  'PACK-VIZ-LF-002 bootstrap must not activate visualization adapter in the real root');
assert.strictEqual(fs.existsSync(path.join(ROOT, 'pwa', 'local_visualization_adapter.js')), false,
  'engineering-only bootstrap must not ship feature adapter bytes in the real root');

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

  console.log('local_first_visualization_packager_adapter_test: PASS', {
    exactAllowedModule: MODULE,
    rootActivationChanged: false,
    featureBytesShippedByBootstrap: false,
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
