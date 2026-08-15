'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOCK = path.join(ROOT, '.ai-context', 'adwf-local-git-mirror.lock.json');

function fail(message) {
  console.error(`ADWF_LOCAL_GIT_MIRROR_VENDOR_FAIL: ${message}`);
  process.exit(2);
}

function gitBlobSha1(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(header).update(buffer).digest('hex');
}

if (!fs.existsSync(LOCK)) fail('lock file missing');
const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
if (lock.schema_version !== 1 || lock.skill_id !== 'adwf-local-git-mirror') fail('lock schema or skill id invalid');
if (!lock.upstream || !/^[0-9a-f]{40}$/.test(String(lock.upstream.sha || ''))) fail('upstream exact SHA invalid');

const entries = Object.entries(lock.files || {});
if (!entries.length) fail('no locked files');
for (const [relative, expected] of entries) {
  if (!/^[0-9a-f]{40}$/.test(String(expected))) fail(`invalid expected blob SHA for ${relative}`);
  const absolute = path.resolve(ROOT, relative);
  if (!absolute.startsWith(ROOT + path.sep)) fail(`path escapes repository: ${relative}`);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) fail(`missing file: ${relative}`);
  const actual = gitBlobSha1(fs.readFileSync(absolute));
  if (actual !== expected) fail(`blob mismatch: ${relative}; expected=${expected}; actual=${actual}`);
}

console.log(`ADWF_LOCAL_GIT_MIRROR_VENDOR_PASS upstream=${lock.upstream.repository}@${lock.upstream.sha} files=${entries.length}`);
