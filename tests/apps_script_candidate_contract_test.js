'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  GENERATED_BUILD_INFO,
  buildCandidate,
  verifyCandidate,
  listDeployFiles,
  stableFileSetHash,
  sha256,
  runtimeBundleEnabled
} = require('../tools/build-apps-script-candidate');

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
assert.strictEqual(runtimeBundleEnabled(source), false, 'runtime bundle must remain dormant without the explicit R2 marker');

const legacyIdentityDescriptors = listDeployFiles(source).map((name) => {
  const bytes = fs.readFileSync(path.join(source, name));
  return { path: name, sha256: sha256(bytes), size: bytes.length };
});
const legacySourceTreeHash = stableFileSetHash(legacyIdentityDescriptors);

const sha = 'a'.repeat(40);
const first = buildCandidate({ sourceRoot: source, outRoot: artifact, candidateSha: sha });
const second = buildCandidate({ sourceRoot: source, outRoot: expected, candidateSha: sha });
assert.deepStrictEqual(second, first, 'same tree + SHA must create the same manifest');
assert.strictEqual(first.fileCount, 4);
assert.strictEqual(first.candidateSha, sha);
assert.strictEqual(first.sourceTreeHash, legacySourceTreeHash,
  'dormant runtime capability must preserve the exact legacy sourceTreeHash ordering');
assert.strictEqual(first.generatedRuntimeBundle, undefined,
  'dormant runtime capability must not alter the legacy candidate manifest');
assert(/^[0-9a-f]{64}$/.test(first.sourceTreeHash));
assert(/^[0-9a-f]{64}$/.test(first.artifactHash));
assert(first.files.some((item) => item.path === GENERATED_BUILD_INFO), 'generated BuildInfo.js must be deployed');
const buildInfo = fs.readFileSync(path.join(artifact, 'files', GENERATED_BUILD_INFO), 'utf8');
assert(buildInfo.includes(sha), 'BuildInfo must contain exact immutable candidate SHA');
assert(buildInfo.includes(first.sourceTreeHash), 'BuildInfo must contain deterministic source tree hash');
assert.deepStrictEqual(verifyCandidate(artifact, expected, sha), {
  candidateSha: sha,
  sourceTreeHash: first.sourceTreeHash,
  artifactHash: first.artifactHash,
  fileCount: 4
});

fs.appendFileSync(path.join(artifact, 'files', 'Code.js'), '// tampered\n');
assert.throws(() => verifyCandidate(artifact, expected, sha), /differs from trusted reconstruction|hash mismatch/);

const rebuilt = buildCandidate({ sourceRoot: source, outRoot: artifact, candidateSha: sha });
assert.strictEqual(rebuilt.sourceTreeHash, first.sourceTreeHash);
assert.strictEqual(rebuilt.artifactHash, first.artifactHash);
fs.appendFileSync(path.join(source, 'Code.js'), '// source changed\n');
const changed = buildCandidate({ sourceRoot: source, outRoot: path.join(temp, 'changed'), candidateSha: sha });
assert.notStrictEqual(changed.sourceTreeHash, first.sourceTreeHash, 'source tree hash must change with deploy source');
assert.throws(() => verifyCandidate(artifact, expected, 'b'.repeat(40)), /SHA binding mismatch/);
assert.throws(() => buildCandidate({ sourceRoot: source, outRoot: artifact, candidateSha: 'not-a-sha' }), /40 lowercase hex/);
fs.writeFileSync(path.join(source, GENERATED_BUILD_INFO), 'reserved\n');
assert.throws(() => listDeployFiles(source), /reserved/);

fs.rmSync(temp, { recursive: true, force: true });
console.log('apps_script_candidate_contract_test: OK');
