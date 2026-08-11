'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  GENERATED_BUILD_INFO,
  GENERATED_RUNTIME_BUNDLE,
  RUNTIME_BUNDLE_MARKER,
  RUNTIME_BUNDLE_MARKER_SCHEMA,
  buildCandidate,
  verifyCandidate,
  listDeployFiles
} = require('../tools/build-apps-script-candidate');

const repositoryRoot = path.join(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'prh-candidate-'));
const source = path.join(temp, 'source');
const artifact = path.join(temp, 'artifact');
const expected = path.join(temp, 'expected');
fs.mkdirSync(source, { recursive: true });
fs.writeFileSync(path.join(source, 'appsscript.json'), '{"timeZone":"Etc/UTC"}\n');
fs.writeFileSync(path.join(source, 'Code.js'), 'function doGet(){return "synthetic";}\n');
fs.writeFileSync(path.join(source, 'Dashboard.html'), '<!doctype html><title>Synthetic</title>\n');
fs.writeFileSync(path.join(source, 'package.json'), '{"private":true}\n');
fs.mkdirSync(path.join(source, 'tests'));
fs.writeFileSync(path.join(source, 'tests', 'not-deployed.js'), 'throw new Error("not deployed");\n');

assert.deepStrictEqual(listDeployFiles(source), ['Code.js', 'Dashboard.html', 'appsscript.json']);

const sha = 'a'.repeat(40);
const first = buildCandidate({ sourceRoot: source, outRoot: artifact, candidateSha: sha });
const second = buildCandidate({ sourceRoot: source, outRoot: expected, candidateSha: sha });
assert.deepStrictEqual(second, first, 'same legacy tree + SHA must create the same manifest');
assert.strictEqual(first.fileCount, 4);
assert.strictEqual(first.candidateSha, sha);
assert.strictEqual(first.generatedRuntimeBundle, undefined, 'legacy manifest shape must remain unchanged without marker');
assert.strictEqual(first.runtimeBundleMarker, undefined, 'legacy marker metadata must be absent');
assert(/^[0-9a-f]{64}$/.test(first.sourceTreeHash));
assert(/^[0-9a-f]{64}$/.test(first.artifactHash));
assert(first.files.some((item) => item.path === GENERATED_BUILD_INFO), 'generated BuildInfo.js must be deployed');
assert(!first.files.some((item) => item.path === GENERATED_RUNTIME_BUNDLE), 'legacy candidate must not add runtime bundle');
const buildInfo = fs.readFileSync(path.join(artifact, 'files', GENERATED_BUILD_INFO), 'utf8');
assert(buildInfo.includes(sha), 'BuildInfo must contain exact immutable candidate SHA');
assert(buildInfo.includes(first.sourceTreeHash), 'BuildInfo must contain deterministic source tree hash');
assert.deepStrictEqual(verifyCandidate(artifact, expected, sha), {
  candidateSha: sha,
  sourceTreeHash: first.sourceTreeHash,
  artifactHash: first.artifactHash,
  fileCount: 4,
  generatedRuntimeBundle: null
});

fs.appendFileSync(path.join(artifact, 'files', 'Code.js'), '// tampered\n');
assert.throws(() => verifyCandidate(artifact, expected, sha), /differs from trusted reconstruction|hash mismatch/);

const rebuilt = buildCandidate({ sourceRoot: source, outRoot: artifact, candidateSha: sha });
assert.strictEqual(rebuilt.sourceTreeHash, first.sourceTreeHash);
assert.strictEqual(rebuilt.artifactHash, first.artifactHash);
fs.appendFileSync(path.join(source, 'Code.js'), '// source changed\n');
const changed = buildCandidate({ sourceRoot: source, outRoot: path.join(temp, 'changed'), candidateSha: sha });
assert.notStrictEqual(changed.sourceTreeHash, first.sourceTreeHash, 'source tree hash must change with deploy source');

// Marker-enabled mode is intentionally opt-in. The marker itself is not deployed;
// it instructs the trusted packager to derive one runtime file from canonical lib/**.
fs.writeFileSync(path.join(source, RUNTIME_BUNDLE_MARKER), JSON.stringify({
  schema: RUNTIME_BUNDLE_MARKER_SCHEMA,
  version: '1.0.0',
  enabled: true
}) + '\n');
assert.deepStrictEqual(listDeployFiles(source), ['Code.js', 'Dashboard.html', 'appsscript.json']);
const enabledArtifact = path.join(temp, 'enabled-artifact');
const enabledExpected = path.join(temp, 'enabled-expected');
const enabledFirst = buildCandidate({ sourceRoot: source, repositoryRoot, outRoot: enabledArtifact, candidateSha: sha });
const enabledSecond = buildCandidate({ sourceRoot: source, repositoryRoot, outRoot: enabledExpected, candidateSha: sha });
assert.deepStrictEqual(enabledSecond, enabledFirst, 'marker-enabled candidate must reconstruct deterministically');
assert.strictEqual(enabledFirst.fileCount, 5);
assert.strictEqual(enabledFirst.generatedRuntimeBundle, GENERATED_RUNTIME_BUNDLE);
assert.deepStrictEqual(enabledFirst.runtimeBundleMarker, { schema: RUNTIME_BUNDLE_MARKER_SCHEMA, version: '1.0.0' });
assert(enabledFirst.files.some((item) => item.path === GENERATED_RUNTIME_BUNDLE));
assert(!enabledFirst.files.some((item) => item.path === RUNTIME_BUNDLE_MARKER), 'marker must not be deployed');
const generatedRuntime = fs.readFileSync(path.join(enabledArtifact, 'files', GENERATED_RUNTIME_BUNDLE), 'utf8');
assert(generatedRuntime.includes('PRH_R2_CANONICAL_RUNTIME_BUNDLE_V1'));
assert(generatedRuntime.includes('generated_from_canonical_lib:true'));
assert(generatedRuntime.includes('financial_formula_copy:false'));
assert.deepStrictEqual(verifyCandidate(enabledArtifact, enabledExpected, sha), {
  candidateSha: sha,
  sourceTreeHash: enabledFirst.sourceTreeHash,
  artifactHash: enabledFirst.artifactHash,
  fileCount: 5,
  generatedRuntimeBundle: GENERATED_RUNTIME_BUNDLE
});

fs.writeFileSync(path.join(source, RUNTIME_BUNDLE_MARKER), '{"schema":"WRONG","version":"1.0.0","enabled":true}\n');
assert.throws(() => buildCandidate({ sourceRoot: source, repositoryRoot, outRoot: path.join(temp, 'invalid-marker'), candidateSha: sha }), /marker is invalid/);
fs.rmSync(path.join(source, RUNTIME_BUNDLE_MARKER));

assert.throws(() => verifyCandidate(artifact, expected, 'b'.repeat(40)), /SHA binding mismatch/);
assert.throws(() => buildCandidate({ sourceRoot: source, outRoot: artifact, candidateSha: 'not-a-sha' }), /40 lowercase hex/);
fs.writeFileSync(path.join(source, GENERATED_BUILD_INFO), 'reserved\n');
assert.throws(() => listDeployFiles(source), /reserved/);
fs.rmSync(path.join(source, GENERATED_BUILD_INFO));
fs.writeFileSync(path.join(source, GENERATED_RUNTIME_BUNDLE), 'reserved\n');
assert.throws(() => listDeployFiles(source), /reserved/);

fs.rmSync(temp, { recursive: true, force: true });
console.log('apps_script_candidate_contract_test: OK', {
  legacyManifestCompatible: true,
  markerGatedRuntimeBundle: true,
  generatedRuntimeBundle: GENERATED_RUNTIME_BUNDLE,
  deterministic: true
});
