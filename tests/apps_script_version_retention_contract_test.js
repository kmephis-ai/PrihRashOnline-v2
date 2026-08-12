'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_HIGH_WATER,
  DEFAULT_TARGET,
  DEFAULT_RECENT_UNUSED_RESERVE,
  candidateVersionDescription,
  planVersionRetention,
  pruneUnusedVersions,
  selectReusableVersion
} = require('../tools/apps-script-version-retention');

const root = path.join(__dirname, '..');
const promoter = fs.readFileSync(path.join(root, 'tools', 'apps-script-api-promote.js'), 'utf8');
const retentionSource = fs.readFileSync(path.join(root, 'tools', 'apps-script-version-retention.js'), 'utf8');
const deployWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'trusted-dev-deploy.yml'), 'utf8');
const retentionWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'apps-script-version-retention.yml'), 'utf8');

function versions(count) {
  return Array.from({ length: count }, (_, index) => ({ versionNumber: index + 1, description: `synthetic-${index + 1}` }));
}

function deployment(number) {
  return { deploymentConfig: { versionNumber: number } };
}

assert.strictEqual(DEFAULT_HIGH_WATER, 180);
assert.strictEqual(DEFAULT_TARGET, 160);
assert.strictEqual(DEFAULT_RECENT_UNUSED_RESERVE, 12);

const below = planVersionRetention({ versions: versions(180), deployments: [deployment(180)] });
assert.strictEqual(below.ok, true);
assert.strictEqual(below.reason, 'BELOW_HIGH_WATER');
assert.deepStrictEqual([...below.delete_version_numbers], []);

const saturated = planVersionRetention({
  versions: versions(194),
  deployments: [deployment(10), deployment(50), deployment(194)],
  extraProtectedVersions: [193]
});
assert.strictEqual(saturated.ok, true);
assert.strictEqual(saturated.reason, 'RETENTION_REQUIRED');
assert.strictEqual(saturated.before_count, 194);
assert.strictEqual(saturated.expected_after_count, 160);
assert.strictEqual(saturated.delete_version_numbers.length, 34);
for (const protectedVersion of [10, 50, 193, 194]) {
  assert(!saturated.delete_version_numbers.includes(protectedVersion), `active/protected version scheduled for deletion: ${protectedVersion}`);
}
for (let recent = 181; recent <= 192; recent += 1) {
  assert(!saturated.delete_version_numbers.includes(recent), `recent rollback reserve scheduled for deletion: ${recent}`);
}

const blocked = planVersionRetention({
  versions: versions(190),
  deployments: Array.from({ length: 170 }, (_, index) => deployment(index + 1))
});
assert.strictEqual(blocked.ok, false);
assert.strictEqual(blocked.reason, 'INSUFFICIENT_UNUSED_VERSION_CAPACITY');
assert.deepStrictEqual([...blocked.delete_version_numbers], []);

const sha = 'a'.repeat(40);
const tree = 'b'.repeat(64);
const description = candidateVersionDescription(sha, tree);
assert.strictEqual(description, `CI exact candidate ${sha} tree ${tree}`);
const reusable = [
  { versionNumber: 188, description },
  { versionNumber: 190, description },
  { versionNumber: 192, description: `CI exact candidate ${sha}` }
];
assert.strictEqual(selectReusableVersion(reusable, [deployment(188)], sha, tree), 188,
  'currently deployed exact candidate must win over a newer duplicate');
assert.strictEqual(selectReusableVersion(reusable, [], sha, tree), 192,
  'newest trusted exact-candidate version must be reused after a failed promotion');

assert.match(retentionSource, /method:\s*'DELETE'/);
assert.match(retentionSource, /VERSION_RETENTION_VERIFY_FAILED/);
assert.match(retentionSource, /extraProtectedVersions/);
assert.doesNotMatch(retentionSource.slice(retentionSource.indexOf('async function main')), /delete_version_numbers/,
  'CLI output must not publish individual Apps Script version numbers');

assert.match(promoter, /selectReusableVersion/);
assert.match(promoter, /pruneUnusedVersions/);
assert(promoter.indexOf('pruneUnusedVersions') < promoter.indexOf('method: \'POST\''),
  'retention must run before a new immutable version is created');
assert.match(promoter, /deploymentsChanged:\s*false/);
assert.match(deployWorkflow, /SOURCE_TREE_HASH/);
assert.match(deployWorkflow, /version_reused/);
assert.match(deployWorkflow, /versions_deleted/);

assert.match(retentionWorkflow, /workflows:\s*\[Main Verification\]/);
assert.match(retentionWorkflow, /workflow_dispatch:/);
assert.match(retentionWorkflow, /environment:\s*DEV/);
assert.match(retentionWorkflow, /apps-script-version-retention\.js --apply/);
assert.doesNotMatch(retentionWorkflow, /pull_request:/,
  'untrusted PR events must never receive owner retention credentials');
assert.doesNotMatch(retentionWorkflow, /contents:\s*write/);

async function verifyApplyPath() {
  const liveVersions = new Map(versions(194).map((version) => [version.versionNumber, version]));
  const deleted = [];
  const fetchImpl = async (url, options) => {
    const method = String(options && options.method || 'GET');
    const text = String(url);
    if (method === 'DELETE') {
      const number = Number(text.split('/').pop());
      assert(liveVersions.has(number), `synthetic delete target missing: ${number}`);
      liveVersions.delete(number);
      deleted.push(number);
      return { ok: true, status: 200, text: async () => '{}' };
    }
    if (method === 'GET' && text.includes('/versions')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ versions: [...liveVersions.values()] })
      };
    }
    throw new Error(`unexpected synthetic request: ${method}`);
  };
  const result = await pruneUnusedVersions({
    scriptId: 'SYNTHETIC_SCRIPT_ID_123456789',
    headers: { authorization: 'Bearer SYNTHETIC' },
    versions: versions(194),
    deployments: [deployment(10), deployment(50), deployment(194)],
    extraProtectedVersions: [193],
    fetchImpl
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.reason, 'RETENTION_APPLIED');
  assert.strictEqual(result.evidence.before_count, 194);
  assert.strictEqual(result.evidence.after_count, 160);
  assert.strictEqual(result.evidence.deleted_count, 34);
  assert.strictEqual(deleted.length, 34);
  for (const protectedVersion of [10, 50, 193, 194]) assert(liveVersions.has(protectedVersion));
}

verifyApplyPath().then(() => {
  console.log('apps_script_version_retention_contract_test: OK', {
    highWater: DEFAULT_HIGH_WATER,
    target: DEFAULT_TARGET,
    recentUnusedReserve: DEFAULT_RECENT_UNUSED_RESERVE,
    syntheticSaturatedBefore: saturated.before_count,
    syntheticSaturatedAfter: saturated.expected_after_count,
    protectedDeploymentVersions: true,
    exactCandidateReuse: true,
    deleteReadbackVerified: true,
    postMainCleanup: true,
    pullRequestSecretAccess: false
  });
}).catch((error) => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
