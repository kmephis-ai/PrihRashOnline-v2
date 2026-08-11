'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  GENERATED_BUILD_INFO,
  GENERATED_RUNTIME_BUNDLE,
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
const options = { sourceRoot: source, repositoryRoot, candidateSha: sha };
const first = buildCandidate({ ...options, outRoot: artifact });
const second = buildCandidate({ ...options, outRoot: expected });
assert.deepStrictEqual(second, first, 'same deploy tree + canonical repository + SHA must create the same manifest');
assert.strictEqual(first.fileCount, 5);
assert.strictEqual(first.candidateSha, sha);
assert.strictEqual(first.generatedRuntimeBundle, GENERATED_RUNTIME_BUNDLE);
assert(/^[0-9a-f]{64}$/.test(first.sourceTreeHash));
assert(/^[0-9a-f]{64}$/.test(first.artifactHash));
assert(first.files.some((item) => item.path === GENERATED_BUILD_INFO), 'generated BuildInfo.js must be deployed');
assert(first.files.some((item) => item.path === GENERATED_RUNTIME_BUNDLE), 'generated canonical runtime bundle must be deployed');
const buildInfo = fs.readFileSync(path.join(artifact, 'files', GENERATED_BUILD_INFO), 'utf8');
const runtimeBundle = fs.readFileSync(path.join(artifact, 'files', GENERATED_RUNTIME_BUNDLE), 'utf8');
assert(buildInfo.includes(sha), 'BuildInfo must contain exact immutable candidate SHA');
assert(buildInfo.includes(first.sourceTreeHash), 'BuildInfo must contain deterministic source tree hash');
assert(runtimeBundle.includes('PRH_R2_CANONICAL_RUNTIME_BUNDLE_V1'), 'runtime bundle schema marker missing');
assert(runtimeBundle.includes('generated_from_canonical_lib:true'), 'runtime bundle must declare canonical-lib generation');
assert(runtimeBundle.includes('financial_formula_copy:false'), 'runtime bundle must reject duplicate financial formula authority');
assert.deepStrictEqual(verifyCandidate(artifact, expected, sha), {
  candidateSha: sha,
  sourceTreeHash: first.sourceTreeHash,
  artifactHash: first.artifactHash,
  fileCount: 5,
  generatedRuntimeBundle: GENERATED_RUNTIME_BUNDLE
});

fs.appendFileSync(path.join(artifact, 'files', 'Code.js'), '// tampered\n');
assert.throws(() => verifyCandidate(artifact, expected, sha), /differs from trusted reconstruction|hash mismatch/);

const rebuilt = buildCandidate({ ...options, outRoot: artifact });
assert.strictEqual(rebuilt.sourceTreeHash, first.sourceTreeHash);
assert.strictEqual(rebuilt.artifactHash, first.artifactHash);
fs.appendFileSync(path.join(source, 'Code.js'), '// source changed\n');
const changed = buildCandidate({ ...options, outRoot: path.join(temp, 'changed') });
assert.notStrictEqual(changed.sourceTreeHash, first.sourceTreeHash, 'source tree hash must change with deploy source');
assert.throws(() => verifyCandidate(artifact, expected, 'b'.repeat(40)), /SHA binding mismatch/);
assert.throws(() => buildCandidate({ sourceRoot: source, repositoryRoot, outRoot: artifact, candidateSha: 'not-a-sha' }), /40 lowercase hex/);
fs.writeFileSync(path.join(source, GENERATED_BUILD_INFO), 'reserved\n');
assert.throws(() => listDeployFiles(source), /reserved/);
fs.rmSync(path.join(source, GENERATED_BUILD_INFO));
fs.writeFileSync(path.join(source, GENERATED_RUNTIME_BUNDLE), 'reserved\n');
assert.throws(() => listDeployFiles(source), /reserved/);

fs.rmSync(temp, { recursive: true, force: true });
console.log('apps_script_candidate_contract_test: OK', {
  deploySourceSeparatedFromRepositoryRoot: true,
  generatedRuntimeBundle: GENERATED_RUNTIME_BUNDLE,
  exactSha: true,
  deterministic: true
});
