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
  RUNTIME_SCHEMA,
  WORKER_ENTRY,
  ALLOWED_INERT_HTTP_URIS,
  localFirstBrowserRuntimeConfig,
  assertNoExternalRuntimeLoaders
} = require('../tools/build-local-first-browser-runtime');
const { buildCandidate, verifyCandidate } = require('../tools/build-apps-script-candidate');

const ROOT = path.resolve(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/local_first/local_first_browser_runtime_marker.v1.json'), 'utf8'));
const SHA = '3'.repeat(40);

assert.strictEqual(contract.schema, 'PRH_LOCAL_FIRST_BROWSER_RUNTIME_MARKER_CONTRACT_V1');
assert.strictEqual(contract.version, '1.0.0');
assert.strictEqual(contract.roadmap_id, 'PACK-LF-001');
assert.strictEqual(contract.marker_file, MARKER_FILE);
assert.strictEqual(contract.marker_schema, MARKER_SCHEMA);
assert.strictEqual(contract.marker_version, MARKER_VERSION);
assert.strictEqual(contract.default_state, 'DISABLED_WHEN_ABSENT');
assert.strictEqual(contract.trust_bootstrap.candidate_packager_self_attestation_allowed, false);
assert.strictEqual(contract.trust_bootstrap.disabled_mode_must_preserve_legacy_artifact_shape, true);
assert.strictEqual(contract.trust_bootstrap.marker_must_not_be_present_in_PACK_LF_001_root, true);
assert.strictEqual(fs.existsSync(path.join(ROOT, MARKER_FILE)), false, 'PACK-LF-001 root must not activate the marker');
assert.deepStrictEqual(localFirstBrowserRuntimeConfig(ROOT), { enabled:false, marker:null });

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'prh-pack-lf-'));
const source = path.join(temp, 'source');
fs.mkdirSync(source, { recursive:true });
fs.writeFileSync(path.join(source, 'appsscript.json'), '{"timeZone":"Etc/UTC"}\n');
fs.writeFileSync(path.join(source, 'Code.js'), 'function doGet(){return "PACK-LF synthetic";}\n');
fs.writeFileSync(path.join(source, TARGET_HTML), `<!doctype html><html><head><title>PACK-LF</title></head><body>${PLACEHOLDER}<main>synthetic</main></body></html>\n`);

function marker(overrides = {}) {
  return Object.assign({
    schema: MARKER_SCHEMA,
    version: MARKER_VERSION,
    enabled: true,
    target_html: TARGET_HTML,
    modules: [
      'pwa/local_read_model_store.js',
      'pwa/local_first_sync.js',
      'pwa/local_first_delta.js'
    ],
    worker_entry: WORKER_ENTRY,
    runtime_network_required_for_warm_route: false,
    external_cdn_required: false,
    cost_class: 'FREE_ONLY'
  }, overrides);
}

try {
  const disabledA = path.join(temp, 'disabled-a');
  const disabledB = path.join(temp, 'disabled-b');
  const firstDisabled = buildCandidate({ sourceRoot:source, repositoryRoot:ROOT, outRoot:disabledA, candidateSha:SHA });
  const secondDisabled = buildCandidate({ sourceRoot:source, repositoryRoot:ROOT, outRoot:disabledB, candidateSha:SHA });
  assert.deepStrictEqual(secondDisabled, firstDisabled, 'disabled packager must remain deterministic');
  assert.strictEqual(firstDisabled.localFirstBrowserRuntime, undefined, 'absent marker must not change manifest shape');
  const disabledHtml = fs.readFileSync(path.join(disabledA, 'files', TARGET_HTML), 'utf8');
  assert.strictEqual(disabledHtml.includes(PLACEHOLDER), true, 'absent marker must not mutate target HTML');
  assert.strictEqual(disabledHtml.includes('data-prh-local-first-runtime'), false);
  assert.deepStrictEqual(verifyCandidate(disabledA, disabledB, SHA), {
    candidateSha: SHA,
    sourceTreeHash:firstDisabled.sourceTreeHash,
    artifactHash:firstDisabled.artifactHash,
    fileCount:firstDisabled.fileCount,
    generatedRuntimeBundle:null,
    echartsVendor:null
  }, 'disabled verify return shape must remain legacy-compatible');

  fs.writeFileSync(path.join(source, MARKER_FILE), JSON.stringify(marker(), null, 2) + '\n');
  const config = localFirstBrowserRuntimeConfig(source);
  assert.strictEqual(config.enabled, true);
  assert.strictEqual(config.marker.schema, MARKER_SCHEMA);
  assert.deepStrictEqual(Array.from(config.marker.modules), marker().modules);

  const enabledA = path.join(temp, 'enabled-a');
  const enabledB = path.join(temp, 'enabled-b');
  const firstEnabled = buildCandidate({ sourceRoot:source, repositoryRoot:ROOT, outRoot:enabledA, candidateSha:SHA });
  const secondEnabled = buildCandidate({ sourceRoot:source, repositoryRoot:ROOT, outRoot:enabledB, candidateSha:SHA });
  assert.deepStrictEqual(secondEnabled, firstEnabled, 'marker-enabled bundle must reconstruct deterministically');
  assert(firstEnabled.localFirstBrowserRuntime, 'enabled marker must bind runtime metadata');
  assert.strictEqual(firstEnabled.localFirstBrowserRuntime.schema, RUNTIME_SCHEMA);
  assert.strictEqual(firstEnabled.localFirstBrowserRuntime.markerSchema, MARKER_SCHEMA);
  assert.strictEqual(firstEnabled.localFirstBrowserRuntime.markerVersion, MARKER_VERSION);
  assert.strictEqual(firstEnabled.localFirstBrowserRuntime.runtimeNetworkRequiredForWarmRoute, false);
  assert.strictEqual(firstEnabled.localFirstBrowserRuntime.externalCdnRequired, false);
  assert.strictEqual(firstEnabled.localFirstBrowserRuntime.costClass, 'FREE_ONLY');
  assert.deepStrictEqual(firstEnabled.localFirstBrowserRuntime.modules.map((item)=>item.path), marker().modules);
  const enabledHtml = fs.readFileSync(path.join(enabledA, 'files', TARGET_HTML), 'utf8');
  assert.strictEqual(enabledHtml.includes(PLACEHOLDER), false);
  assert(enabledHtml.includes('data-prh-local-first-runtime="1.0.0"'));
  assert(enabledHtml.includes('PRH_LOCAL_READ_MODEL_V1'));
  assert(enabledHtml.includes('PRH_LOCAL_FIRST_SYNC_V1'));
  assert(enabledHtml.includes('PRH_LOCAL_FIRST_DELTA_V1'));
  assertNoExternalRuntimeLoaders(enabledHtml);
  const seenUris = Array.from(new Set(Array.from(enabledHtml.matchAll(/https?:\/\/[^\s'"<\\]+/gi), (match)=>match[0]))).sort();
  assert.deepStrictEqual(seenUris, Array.from(ALLOWED_INERT_HTTP_URIS).sort(), 'only inert canonical schema URIs may remain embedded');
  const verifiedEnabled = verifyCandidate(enabledA, enabledB, SHA);
  assert.strictEqual(verifiedEnabled.localFirstBrowserRuntime.runtimeSha256, firstEnabled.localFirstBrowserRuntime.runtimeSha256);

  fs.writeFileSync(path.join(source, MARKER_FILE), JSON.stringify(marker({ unexpected:true })) + '\n');
  assert.throws(() => buildCandidate({ sourceRoot:source, repositoryRoot:ROOT, outRoot:path.join(temp,'invalid-shape'), candidateSha:SHA }), /LOCAL_FIRST_RUNTIME_MARKER_SHAPE_INVALID/);

  fs.writeFileSync(path.join(source, MARKER_FILE), JSON.stringify(marker({ modules:['pwa/local_read_model_store.js','pwa/evil.js'] })) + '\n');
  assert.throws(() => buildCandidate({ sourceRoot:source, repositoryRoot:ROOT, outRoot:path.join(temp,'invalid-module'), candidateSha:SHA }), /LOCAL_FIRST_RUNTIME_MODULE_FORBIDDEN/);

  fs.writeFileSync(path.join(source, MARKER_FILE), JSON.stringify(marker({ external_cdn_required:true })) + '\n');
  assert.throws(() => buildCandidate({ sourceRoot:source, repositoryRoot:ROOT, outRoot:path.join(temp,'invalid-policy'), candidateSha:SHA }), /LOCAL_FIRST_RUNTIME_MARKER_POLICY_INVALID/);

  console.log('local_first_packager_bootstrap_contract_test: PASS', {
    rootMarkerAbsent:true,
    disabledManifestLegacyCompatible:true,
    markerEnabledDeterministic:true,
    enabledModules:marker().modules.length,
    candidateSelfAttestationAllowed:false,
    externalCdnRequired:false,
    freeOnly:true
  });
} finally {
  fs.rmSync(temp, { recursive:true, force:true });
}
