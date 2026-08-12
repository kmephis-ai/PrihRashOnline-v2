'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  ECHARTS_VENDOR_MARKER,
  ECHARTS_VENDOR_SCHEMA,
  ECHARTS_TARGET_HTML,
  gitBlobSha1,
  echartsVendorConfig,
  echartsRawUrl,
  localEchartsScriptTag
} = require('../tools/build-apps-script-candidate');

const root = path.join(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, ECHARTS_VENDOR_MARKER), 'utf8'));
const config = echartsVendorConfig(root);

assert.strictEqual(config.enabled, true);
assert.strictEqual(lock.schema, ECHARTS_VENDOR_SCHEMA);
assert.strictEqual(lock.version, '1.0.0');
assert.strictEqual(lock.enabled, true);
assert.strictEqual(lock.vendor, 'Apache ECharts');
assert.strictEqual(lock.package, 'echarts');
assert.strictEqual(lock.package_version, '6.1.0');
assert.strictEqual(lock.license, 'Apache-2.0');
assert.strictEqual(lock.upstream_repository, 'apache/echarts');
assert.strictEqual(lock.upstream_commit, 'c5a48f5f97d23e5379720870b8444cd05b50ffb4');
assert.strictEqual(lock.distribution_path, 'dist/echarts.min.js');
assert.strictEqual(lock.git_blob_sha1, '8ac18b077043908716189eb2d52365e0c5bf2215');
assert.strictEqual(lock.byte_size, 1112576);
assert.strictEqual(lock.delivery, 'LOCAL_ONLY');
assert.strictEqual(lock.runtime_network_required, false);
assert.strictEqual(lock.external_cdn_required, false);
assert.strictEqual(lock.cost_class, 'FREE_ONLY');
assert.strictEqual(ECHARTS_TARGET_HTML, 'FinancialHomeWebApp.html');
assert.strictEqual(
  echartsRawUrl(lock),
  'https://raw.githubusercontent.com/apache/echarts/c5a48f5f97d23e5379720870b8444cd05b50ffb4/dist/echarts.min.js'
);

const syntheticBytes = Buffer.from('window.echarts={version:"SYN"};</script><script>window.x=1;', 'utf8');
const syntheticMarker = {
  package_version: 'SYN',
  byte_size: syntheticBytes.length,
  git_blob_sha1: gitBlobSha1(syntheticBytes)
};
const tag = localEchartsScriptTag(syntheticMarker, syntheticBytes);
assert(tag.startsWith('<script data-prh-vendor="apache-echarts"'));
assert(tag.includes('data-delivery="LOCAL_ONLY"'));
assert(tag.includes('data-version="SYN"'));
assert(!tag.includes('</script><script>window.x=1;'), 'embedded vendor source must escape script-closing sequences');
assert(tag.includes('<\\/script><script>window.x=1;'));

const buildSource = fs.readFileSync(path.join(root, 'tools', 'build-apps-script-candidate.js'), 'utf8');
assert.match(buildSource, /gitBlobSha1\(bytes\).*marker\.git_blob_sha1/s,
  'candidate packaging must verify the Git blob identity');
assert.match(buildSource, /bytes\.length !== marker\.byte_size/,
  'candidate packaging must verify upstream byte size');
assert.match(buildSource, /--proto', '=https'/,
  'candidate fetch must be restricted to HTTPS');
assert.doesNotMatch(buildSource, /cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare/,
  'runtime/CDN vendor sources are forbidden');

console.log('echarts_supply_chain_contract_test: OK', {
  renderer: 'Apache ECharts 6.1.0',
  upstreamCommit: lock.upstream_commit,
  gitBlobSha1: lock.git_blob_sha1,
  byteSize: lock.byte_size,
  targetHtml: ECHARTS_TARGET_HTML,
  delivery: lock.delivery,
  runtimeNetworkRequired: false,
  externalCdnRequired: false,
  freeOnly: true
});
