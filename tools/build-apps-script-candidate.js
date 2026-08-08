'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const POLICY_VERSION = 'apps-script-top-level-v1';
const SHA_RE = /^[0-9a-f]{40}$/;

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function parseArgs(argv) {
  const result = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key || !key.startsWith('--') || value == null) throw new Error('usage: --source <dir> --out <dir> --sha <40-char-sha>');
    result[key.slice(2)] = value;
  }
  return result;
}

function listDeployFiles(sourceRoot) {
  const entries = fs.readdirSync(sourceRoot, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && (entry.name === 'appsscript.json' || entry.name.endsWith('.js') || entry.name.endsWith('.html')))
    .map((entry) => entry.name)
    .sort();
  if (!files.includes('appsscript.json')) throw new Error('appsscript.json is required');
  if (!files.some((name) => name.endsWith('.js'))) throw new Error('at least one Apps Script .js file is required');
  return files;
}

function stableManifestHash(files) {
  const payload = files.map((item) => `${item.path}\0${item.sha256}\0${item.size}`).join('\n');
  return sha256(Buffer.from(payload, 'utf8'));
}

function buildCandidate({ sourceRoot, outRoot, candidateSha }) {
  if (!SHA_RE.test(String(candidateSha || ''))) throw new Error('candidate SHA must be exactly 40 lowercase hex characters');
  const source = path.resolve(sourceRoot);
  const out = path.resolve(outRoot);
  const filesRoot = path.join(out, 'files');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(filesRoot, { recursive: true });

  const names = listDeployFiles(source);
  const manifestFiles = names.map((name) => {
    const sourcePath = path.join(source, name);
    const stat = fs.lstatSync(sourcePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`deploy file must be a regular file: ${name}`);
    const bytes = fs.readFileSync(sourcePath);
    fs.writeFileSync(path.join(filesRoot, name), bytes);
    return { path: name, sha256: sha256(bytes), size: bytes.length };
  });

  const manifest = {
    schemaVersion: 1,
    policyVersion: POLICY_VERSION,
    candidateSha,
    fileCount: manifestFiles.length,
    files: manifestFiles,
    artifactHash: stableManifestHash(manifestFiles)
  };
  fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

function verifyCandidate(candidateRoot, expectedRoot, expectedSha) {
  const actualManifestPath = path.join(candidateRoot, 'manifest.json');
  const expectedManifestPath = path.join(expectedRoot, 'manifest.json');
  const actual = JSON.parse(fs.readFileSync(actualManifestPath, 'utf8'));
  const expected = JSON.parse(fs.readFileSync(expectedManifestPath, 'utf8'));
  if (actual.candidateSha !== expectedSha || expected.candidateSha !== expectedSha) throw new Error('candidate SHA binding mismatch');
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('candidate manifest differs from trusted reconstruction');

  const actualFilesRoot = path.join(candidateRoot, 'files');
  const expectedFilesRoot = path.join(expectedRoot, 'files');
  const actualNames = fs.readdirSync(actualFilesRoot).sort();
  const expectedNames = fs.readdirSync(expectedFilesRoot).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) throw new Error('candidate file set differs from trusted reconstruction');
  expected.files.forEach((item) => {
    const actualBytes = fs.readFileSync(path.join(actualFilesRoot, item.path));
    const expectedBytes = fs.readFileSync(path.join(expectedFilesRoot, item.path));
    if (!actualBytes.equals(expectedBytes)) throw new Error(`candidate file differs from trusted reconstruction: ${item.path}`);
    if (sha256(actualBytes) !== item.sha256) throw new Error(`candidate file hash mismatch: ${item.path}`);
  });
  return { candidateSha: actual.candidateSha, artifactHash: actual.artifactHash, fileCount: actual.fileCount };
}

if (require.main === module) {
  const args = parseArgs(process.argv);
  if (args.verify) {
    const result = verifyCandidate(path.resolve(args.verify), path.resolve(args.expected), args.sha);
    console.log('apps-script-candidate: VERIFIED', result);
  } else {
    const manifest = buildCandidate({ sourceRoot: args.source, outRoot: args.out, candidateSha: args.sha });
    console.log('apps-script-candidate: BUILT', { candidateSha: manifest.candidateSha, artifactHash: manifest.artifactHash, fileCount: manifest.fileCount });
  }
}

module.exports = { POLICY_VERSION, SHA_RE, sha256, listDeployFiles, stableManifestHash, buildCandidate, verifyCandidate };
