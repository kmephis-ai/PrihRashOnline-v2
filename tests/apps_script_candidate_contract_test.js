'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildCandidate,
  verifyCandidate,
  listDeployFiles
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

const sha = 'a'.repeat(40);
const first = buildCandidate({ sourceRoot: source, outRoot: artifact, candidateSha: sha });
const second = buildCandidate({ sourceRoot: source, outRoot: expected, candidateSha: sha });
assert.deepStrictEqual(second, first, 'same tree + SHA must create the same manifest');
assert.strictEqual(first.fileCount, 3);
assert.strictEqual(first.candidateSha, sha);
assert(/^[0-9a-f]{64}$/.test(first.artifactHash));
assert.deepStrictEqual(verifyCandidate(artifact, expected, sha), {
  candidateSha: sha,
  artifactHash: first.artifactHash,
  fileCount: 3
});

fs.appendFileSync(path.join(artifact, 'files', 'Code.js'), '// tampered\n');
assert.throws(() => verifyCandidate(artifact, expected, sha), /differs from trusted reconstruction|hash mismatch/);

const rebuilt = buildCandidate({ sourceRoot: source, outRoot: artifact, candidateSha: sha });
assert.strictEqual(rebuilt.artifactHash, first.artifactHash);
assert.throws(() => verifyCandidate(artifact, expected, 'b'.repeat(40)), /SHA binding mismatch/);
assert.throws(() => buildCandidate({ sourceRoot: source, outRoot: artifact, candidateSha: 'not-a-sha' }), /40 lowercase hex/);

fs.rmSync(temp, { recursive: true, force: true });
console.log('apps_script_candidate_contract_test: OK');
