'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ECHARTS_VENDOR_MARKER,
  ECHARTS_VENDOR_SCHEMA,
  ECHARTS_TARGET_HTML,
  gitBlobSha1,
  buildCandidate
} = require('../tools/build-apps-script-candidate');

assert.strictEqual(
  ECHARTS_TARGET_HTML,
  'LocalFirstSpaWebApp.html',
  'trusted ECharts vendor target must be the canonical Local-first SPA'
);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'prh-lf-echarts-packager-'));
const source = path.join(temp, 'source');
const artifact = path.join(temp, 'artifact');
const noMarkerArtifact = path.join(temp, 'no-marker-artifact');
const missingTargetArtifact = path.join(temp, 'missing-target-artifact');
fs.mkdirSync(source, { recursive: true });

fs.writeFileSync(path.join(source, 'appsscript.json'), '{"timeZone":"Etc/UTC"}\n');
fs.writeFileSync(path.join(source, 'Code.js'), 'function doGet(){return "synthetic";}\n');
const localFirstOriginal = '<!doctype html><html><head><!-- PRH_LOCAL_ECHARTS_VENDOR --></head><body>LOCAL_FIRST</body></html>\n';
const legacyOriginal = '<!doctype html><html><head></head><body>LEGACY_FINANCIAL_HOME</body></html>\n';
fs.writeFileSync(path.join(source, 'LocalFirstSpaWebApp.html'), localFirstOriginal);
fs.writeFileSync(path.join(source, 'FinancialHomeWebApp.html'), legacyOriginal);

const vendorBytes = Buffer.from('window.echarts=Object.freeze({init:function(){return "synthetic-echarts";}});', 'utf8');
const marker = {
  schema: ECHARTS_VENDOR_SCHEMA,
  version: '1.0.0',
  enabled: true,
  vendor: 'Apache ECharts',
  package: 'echarts',
  package_version: '6.1.0',
  license: 'Apache-2.0',
  upstream_repository: 'apache/echarts',
  upstream_commit: 'c5a48f5f97d23e5379720870b8444cd05b50ffb4',
  distribution_path: 'dist/echarts.simple.min.js',
  git_blob_sha1: gitBlobSha1(vendorBytes),
  byte_size: vendorBytes.length,
  delivery: 'LOCAL_ONLY',
  runtime_network_required: false,
  external_cdn_required: false,
  cost_class: 'FREE_ONLY'
};
fs.writeFileSync(path.join(source, ECHARTS_VENDOR_MARKER), `${JSON.stringify(marker, null, 2)}\n`);

let fetchCalls = 0;
const manifest = buildCandidate({
  sourceRoot: source,
  outRoot: artifact,
  candidateSha: 'a'.repeat(40),
  vendorFetcher: (receivedMarker) => {
    fetchCalls += 1;
    assert.strictEqual(receivedMarker.git_blob_sha1, marker.git_blob_sha1);
    assert.strictEqual(receivedMarker.delivery, 'LOCAL_ONLY');
    assert.strictEqual(receivedMarker.runtime_network_required, false);
    assert.strictEqual(receivedMarker.external_cdn_required, false);
    return vendorBytes;
  }
});

assert.strictEqual(fetchCalls, 1, 'enabled marker must fetch pinned bytes exactly once during build');
assert(manifest.echartsVendor, 'manifest must expose truthful ECharts vendor metadata');
assert.deepStrictEqual(
  {
    package: manifest.echartsVendor.package,
    packageVersion: manifest.echartsVendor.packageVersion,
    upstreamCommit: manifest.echartsVendor.upstreamCommit,
    gitBlobSha1: manifest.echartsVendor.gitBlobSha1,
    upstreamByteSize: manifest.echartsVendor.upstreamByteSize,
    delivery: manifest.echartsVendor.delivery,
    runtimeNetworkRequired: manifest.echartsVendor.runtimeNetworkRequired,
    externalCdnRequired: manifest.echartsVendor.externalCdnRequired,
    targetHtml: manifest.echartsVendor.targetHtml
  },
  {
    package: 'echarts',
    packageVersion: '6.1.0',
    upstreamCommit: marker.upstream_commit,
    gitBlobSha1: marker.git_blob_sha1,
    upstreamByteSize: vendorBytes.length,
    delivery: 'LOCAL_ONLY',
    runtimeNetworkRequired: false,
    externalCdnRequired: false,
    targetHtml: 'LocalFirstSpaWebApp.html'
  }
);
assert(!manifest.files.some((item) => item.path === ECHARTS_VENDOR_MARKER), 'vendor marker must never be deployed');

const localFirstBuilt = fs.readFileSync(path.join(artifact, 'files', 'LocalFirstSpaWebApp.html'), 'utf8');
const legacyBuilt = fs.readFileSync(path.join(artifact, 'files', 'FinancialHomeWebApp.html'), 'utf8');
assert(localFirstBuilt.includes('data-prh-vendor="apache-echarts"'));
assert(localFirstBuilt.includes('data-version="6.1.0"'));
assert(localFirstBuilt.includes('data-delivery="LOCAL_ONLY"'));
assert(localFirstBuilt.includes('synthetic-echarts'));
assert(!localFirstBuilt.includes('PRH_LOCAL_ECHARTS_VENDOR'));
assert(!/https?:\/\//i.test(localFirstBuilt), 'runtime HTML must not gain an external URL from vendor injection');
assert.strictEqual(legacyBuilt, legacyOriginal, 'legacy FinancialHomeWebApp must remain untouched');

fs.rmSync(path.join(source, ECHARTS_VENDOR_MARKER));
const withoutMarker = buildCandidate({
  sourceRoot: source,
  outRoot: noMarkerArtifact,
  candidateSha: 'b'.repeat(40),
  vendorFetcher: () => {
    throw new Error('vendor fetch must not happen without explicit marker');
  }
});
assert.strictEqual(withoutMarker.echartsVendor, undefined, 'bootstrap must not activate ECharts without marker');
assert.strictEqual(
  fs.readFileSync(path.join(noMarkerArtifact, 'files', 'LocalFirstSpaWebApp.html'), 'utf8'),
  localFirstOriginal,
  'no-marker Local-first candidate must remain byte-identical apart from generated BuildInfo'
);

fs.writeFileSync(path.join(source, ECHARTS_VENDOR_MARKER), `${JSON.stringify(marker)}\n`);
fs.rmSync(path.join(source, 'LocalFirstSpaWebApp.html'));
assert.throws(
  () => buildCandidate({
    sourceRoot: source,
    outRoot: missingTargetArtifact,
    candidateSha: 'c'.repeat(40),
    vendorFetcher: () => vendorBytes
  }),
  /LocalFirstSpaWebApp\.html is required when ECharts vendor is enabled/,
  'marker activation must fail closed when canonical Local-first target is missing'
);

fs.rmSync(temp, { recursive: true, force: true });
console.log('local_first_echarts_runtime_contract_test: OK', {
  target: 'LocalFirstSpaWebApp.html',
  activation: 'EXPLICIT_MARKER_ONLY',
  delivery: 'LOCAL_ONLY',
  runtimeNetworkRequired: false,
  externalCdnRequired: false,
  legacyFinancialHomeUntouched: true,
  missingTarget: 'FAIL_CLOSED'
});
