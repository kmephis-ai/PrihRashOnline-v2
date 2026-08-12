'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const workflow = fs.readFileSync(
  path.join(__dirname, '..', '.github', 'workflows', 'owner-product-uat-attestation.yml'),
  'utf8'
);

assert.match(workflow, /issues:\s*\n\s*types:\s*\[edited\]/);
assert.match(workflow, /github\.actor == github\.repository_owner/,
  'only repository-owner issue edits may produce Product UAT attestation');
assert.match(workflow, /statuses:\s*write/);
assert.match(workflow, /actions:\s*write/);
assert.doesNotMatch(workflow, /secrets\./,
  'owner UAT attestation must not require deployment or OAuth secrets');
assert.doesNotMatch(workflow, /pull_request_target:/);
assert.match(workflow, /work_class.*user_facing/);
assert.match(workflow, /engineering_status/);
assert.match(workflow, /PRODUCT_READY/);
assert.match(workflow, /owner_uat_candidate_sha/);
assert.match(workflow, /owner_uat_desktop/);
assert.match(workflow, /owner_uat_mobile/);
assert.match(workflow, /owner_uat_visible_actions/);
assert.match(workflow, /owner_uat_russian_ui/);
assert.match(workflow, /owner_uat_no_developer_markers/);
assert.match(workflow, /owner_uat_visual_truth/);
assert.match(workflow, /owner_uat_visual_acceptance/);
assert.match(workflow, /owner_uat_back_forward/);
assert.match(workflow, /owner_uat_loading_error_states/);
assert.match(workflow, /owner_uat_route_switch_p95_ms/);
assert.match(workflow, /ROUTE_P95.*-le 2000/,
  'route switch owner evidence must remain <= 2000 ms');
assert.match(workflow, /trusted-dev-deploy/);
assert.match(workflow, /trusted-runtime-health/);
assert.match(workflow, /context='product-ready-e2e'/);
assert.match(workflow, /OWNER_UAT_EXACT_SHA_PASS/);
assert.match(workflow, /gh run rerun .*--failed/,
  'successful owner attestation must re-enter the trusted autonomous merge gate');
assert.doesNotMatch(workflow, /merge_pull_request|gh pr merge|\/merges/,
  'attestation must never merge directly');

console.log('owner_product_uat_attestation_policy_test: OK', {
  ownerOnly: true,
  exactSha: true,
  deployedHealthRequired: true,
  routeP95LimitMs: 2000,
  productStatusProducer: true,
  directMergeAuthority: false,
  secretsRequired: false
});
