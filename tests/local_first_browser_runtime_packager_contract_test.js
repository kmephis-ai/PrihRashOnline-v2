'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  TARGET_HTML,
  PLACEHOLDER,
  RUNTIME_SCHEMA,
  RUNTIME_VERSION,
  TRACKED_BROWSER_MODULES,
  buildLocalFirstRuntimeInjection,
  injectIntoHtml
} = require('../tools/build-local-first-browser-runtime');
const { buildCandidate, verifyCandidate } = require('../tools/build-apps-script-candidate');

const ROOT = path.resolve(__dirname, '..');
const SHA = '1'.repeat(40);
const sourceHtml = fs.readFileSync(path.join(ROOT, TARGET_HTML), 'utf8');
const ALLOWED_INERT_SCHEMA_URIS = Object.freeze([
  'https://github.com/kmephis-ai/PrihRashOnline-v2/lib/domain/canonical_transaction.v1.schema.json',
  'https://json-schema.org/draft/2020-12/schema'
]);

function embeddedHttpUris(text) {
  return Array.from(String(text).matchAll(/https?:\/\/[^\s'"<\\]+/gi), (match) => match[0]);
}

function assertNoExternalRuntimeLoaders(text) {
  const source = String(text);
  assert.doesNotMatch(source, /<(?:script|link)\b[^>]*(?:src|href)\s*=\s*["']https?:\/\//i,
    'embedded Local-first runtime must not load external script/link resources');
  assert.doesNotMatch(source, /\b(?:fetch|importScripts)\s*\(\s*["']https?:\/\//i,
    'embedded Local-first runtime must not call external HTTP loaders');
  assert.doesNotMatch(source, /\bnew\s+(?:Worker|SharedWorker|WebSocket)\s*\(\s*["']https?:\/\//i,
    'embedded Local-first runtime must not construct external network workers/sockets');
  assert.doesNotMatch(source, /\.open\s*\(\s*["'][A-Z]+["']\s*,\s*["']https?:\/\//i,
    'embedded Local-first runtime must not open external XHR URLs');
}

assert.strictEqual(sourceHtml.split(PLACEHOLDER).length - 1, 1, 'source SPA must have exactly one trusted runtime placeholder');
const runtimeA = buildLocalFirstRuntimeInjection({ repositoryRoot: ROOT });
const runtimeB = buildLocalFirstRuntimeInjection({ repositoryRoot: ROOT });
assert.strictEqual(runtimeA.schema, RUNTIME_SCHEMA);
assert.strictEqual(runtimeA.version, RUNTIME_VERSION);
assert.strictEqual(runtimeA.runtime_sha256, runtimeB.runtime_sha256, 'runtime bundle must be deterministic');
assert.strictEqual(runtimeA.worker_sha256, runtimeB.worker_sha256, 'worker bundle must be deterministic');
assert.deepStrictEqual(runtimeA.modules.map((item) => item.path), Array.from(TRACKED_BROWSER_MODULES));
assert(runtimeA.worker_module_count > 1, 'canonical worker graph must contain multiple tracked modules');
assert.match(runtimeA.html, /data-prh-local-first-runtime="1\.0\.0"/);
assert.match(runtimeA.html, /window\.__PRH_LF_WORKER_BUNDLE_SOURCE__/);
assert.match(runtimeA.html, /PRH_LOCAL_READ_MODEL_V1/);
assert.match(runtimeA.html, /PRH_LOCAL_FIRST_SYNC_V1/);
assert.match(runtimeA.html, /PRH_LOCAL_FIRST_DELTA_V1/);
assert.match(runtimeA.html, /PRH_LOCAL_FINANCE_RUNTIME_V1/);

// JSON Schema carries standards/document identity URIs as inert data inside the
// canonical Worker dependency graph. They are not runtime resource locators.
// Keep this allow-list exact and fail closed on any newly introduced HTTP URI.
assert.deepStrictEqual(
  Array.from(new Set(embeddedHttpUris(runtimeA.html))).sort(),
  Array.from(ALLOWED_INERT_SCHEMA_URIS).sort(),
  'embedded browser runtime may contain only the exact inert canonical JSON Schema URIs'
);
assertNoExternalRuntimeLoaders(runtimeA.html);

const injected = injectIntoHtml(sourceHtml, runtimeA);
assert(!injected.includes(PLACEHOLDER));
assert(injected.includes('data-prh-local-first-runtime="1.0.0"'));
assert(injected.indexOf('data-prh-local-first-runtime="1.0.0"') < injected.indexOf('<script>\n(function(){'), 'browser modules must load before SPA boot');
assertNoExternalRuntimeLoaders(injected);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prh-fin-lf-packager-'));
const outA = path.join(tmp, 'candidate-a');
const outB = path.join(tmp, 'candidate-b');
try {
  const manifestA = buildCandidate({ sourceRoot: ROOT, repositoryRoot: ROOT, outRoot: outA, candidateSha: SHA });
  const manifestB = buildCandidate({ sourceRoot: ROOT, repositoryRoot: ROOT, outRoot: outB, candidateSha: SHA });
  assert.strictEqual(manifestA.artifactHash, manifestB.artifactHash, 'exact candidate packaging must be reproducible');
  assert.strictEqual(manifestA.sourceTreeHash, manifestB.sourceTreeHash);
  assert(manifestA.localFirstBrowserRuntime, 'candidate manifest must bind Local-first browser runtime');
  assert.strictEqual(manifestA.localFirstBrowserRuntime.schema, RUNTIME_SCHEMA);
  assert.strictEqual(manifestA.localFirstBrowserRuntime.version, RUNTIME_VERSION);
  assert.strictEqual(manifestA.localFirstBrowserRuntime.runtimeSha256, runtimeA.runtime_sha256);
  assert.strictEqual(manifestA.localFirstBrowserRuntime.workerSha256, runtimeA.worker_sha256);
  assert.strictEqual(manifestA.localFirstBrowserRuntime.targetHtml, TARGET_HTML);
  assert.strictEqual(manifestA.localFirstBrowserRuntime.runtimeNetworkRequiredForWarmRoute, false);
  assert.strictEqual(manifestA.localFirstBrowserRuntime.externalCdnRequired, false);
  const candidateHtml = fs.readFileSync(path.join(outA, 'files', TARGET_HTML), 'utf8');
  assert(!candidateHtml.includes(PLACEHOLDER));
  assert(candidateHtml.includes('data-prh-local-first-runtime="1.0.0"'));
  assert(candidateHtml.includes('window.__PRH_LF_WORKER_BUNDLE_SOURCE__'));
  assert(candidateHtml.includes('PrhLocalReadModelStore'));
  assert(candidateHtml.includes('PrhLocalFirstSync'));
  assert(candidateHtml.includes('PrhLocalFirstDelta'));
  assert(candidateHtml.includes('PrhLocalFinanceRuntime'));
  assertNoExternalRuntimeLoaders(candidateHtml);
  const verified = verifyCandidate(outA, outB, SHA);
  assert.strictEqual(verified.candidateSha, SHA);
  assert.strictEqual(verified.localFirstBrowserRuntime.runtimeSha256, runtimeA.runtime_sha256);
  console.log('local_first_browser_runtime_packager_contract_test: PASS', {
    trackedModules: runtimeA.modules.length,
    workerModules: runtimeA.worker_module_count,
    inertSchemaUris: ALLOWED_INERT_SCHEMA_URIS.length,
    externalRuntimeLoaders: 0,
    runtimeSha256Prefix: runtimeA.runtime_sha256.slice(0, 12),
    deterministicArtifact: true
  });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}