'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/owner-product-uat-attestation.yml'), 'utf8');
const docs = fs.readFileSync(path.join(ROOT, 'docs/OWNER_UAT_PROFILES.md'), 'utf8');

// Generic Product Ready remains the default and keeps the full owner-facing declaration.
assert(workflow.includes("[[ -n \"${UAT_PROFILE}\" ]] || UAT_PROFILE='GENERIC_V1'"));
for (const key of [
  'owner_uat_mobile',
  'owner_uat_visible_actions',
  'owner_uat_russian_ui',
  'owner_uat_no_developer_markers',
  'owner_uat_visual_truth',
  'owner_uat_visual_acceptance',
  'owner_uat_back_forward',
  'owner_uat_loading_error_states'
]) {
  assert(workflow.includes(key), `generic owner UAT field missing: ${key}`);
}
assert(workflow.includes("[[ \"${UAT_MOBILE}\" == 'PASS' ]]"));
assert(workflow.includes("[[ \"${UAT_BACK_FORWARD}\" == 'PASS' && \"${UAT_LOADING}\" == 'PASS' ]]"));

// PERF profile is deliberately narrow and cannot be reused by another Roadmap item.
assert(workflow.includes('PERF_LF_V1)'));
assert(workflow.includes("[[ \"${ROADMAP_ID}\" == 'PERF-LF-001' ]]"));
assert(workflow.includes("[[ \"${UAT_MOBILE}\" == 'MACHINE_DERIVED' ]]"));
assert(workflow.includes("REASON_CODE='OWNER_PERF_UAT_EXACT_SHA_PASS'"));

// PERF-LF-001 thresholds are enforced in trusted owner attestation; they are not relaxed to generic limits.
for (const boundary of [
  'positive_number_leq "${ROUTE_P95}" 100',
  'positive_number_leq "${FILTER_KPI_P95}" 200',
  'positive_number_leq "${CHART_DESKTOP_P95}" 300',
  'positive_number_leq "${BACK_FORWARD_P95}" 100',
  'positive_number_leq "${CACHED_FMP_P95}" 800'
]) {
  assert(workflow.includes(boundary), `PERF boundary missing: ${boundary}`);
}
for (const zeroInvariant of [
  'zero_number "${NETWORK_REQUESTS}"',
  'zero_number "${SHEETS_READS}"',
  'zero_number "${OBSERVED_RESOURCES}"'
]) {
  assert(workflow.includes(zeroInvariant), `zero invariant missing: ${zeroInvariant}`);
}

// Machine-derived representative mobile evidence must resolve to a successful PR Validation on the same exact head.
assert(workflow.includes('actions/workflows/pr-validation.yml/runs'));
assert(workflow.includes('.head_sha == $sha and .conclusion == "success"'));
assert(workflow.includes('PERF_LF_V1 requires exact-head successful PR Validation for representative-mobile machine evidence.'));

// Both profiles remain exact-candidate, deployed and healthy before Product Ready status can be published.
assert(workflow.includes('Owner UAT candidate does not match exact open PR head.'));
assert(workflow.includes("DEPLOY_STATE}" + " == 'success'"));
assert(workflow.includes("HEALTH_STATE}" + " == 'success'"));
assert(workflow.includes("context='product-ready-e2e'"));

// Documentation must make the scope boundary explicit: PERF does not impersonate full Local-first E2E Product Ready.
assert(docs.includes('только** для `roadmap_id=PERF-LF-001`'));
assert(docs.includes('не** означает и не заменяет `MASTER-LF-PRODUCT`'));
assert(docs.includes('не утверждает generic mobile/error/accessibility/visual checks'));
assert(docs.includes('E2E-LF-001 / MASTER-LF-PRODUCT'));

console.log('owner_uat_attestation_policy_contract_test: PASS');
