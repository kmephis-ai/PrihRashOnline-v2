'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const product = readJson('lib/local_first/local_first_product_ready.v1.json');
const roadmap = readJson('lib/local_first/local_first_roadmap.v1.json');
const runtime = readJson('lib/local_first/local_first_runtime.v1.json');
const spa = readJson('lib/local_first/spa_shell.v1.json');
const finance = readJson('lib/local_first/local_finance_runtime.v1.json');
const data = readJson('lib/local_first/local_data_runtime.v1.json');
const perf = readJson('lib/local_first/local_first_performance.v1.json');
const ownerUatWorkflow = read('.github/workflows/owner-product-uat-attestation.yml');
const ownerUatDocs = read('docs/OWNER_UAT_PROFILES.md');
const performanceNode = require('../pwa/local_first_performance');
const financeRuntimeSource = read('pwa/local_finance_runtime.js');
const spaServiceSource = read('LocalFirstSpaService.js');

assert.strictEqual(product.schema, 'PRH_LOCAL_FIRST_PRODUCT_READY_V1');
assert.strictEqual(product.version, '1.0.0');
assert.strictEqual(product.roadmap_id, 'E2E-LF-001');
assert.strictEqual(product.phase, 'LF4');
assert.strictEqual(product.protocol_wave, 'R2R');
assert.strictEqual(product.priority, 'P0');
assert.strictEqual(product.work_class, 'user_facing');
assert.strictEqual(product.exit_gate, 'MASTER-LF-PRODUCT');
assert.strictEqual(product.product_gate, 'PRODUCT_READY_E2E');
assert.strictEqual(product.cost_class, 'FREE_ONLY');

const roadmapItem = roadmap.items.find((item) => item.id === product.roadmap_id);
assert(roadmapItem, 'E2E-LF-001 must exist in Local-first Roadmap');
assert.strictEqual(roadmapItem.phase, product.phase);
assert.strictEqual(roadmapItem.protocol_wave, product.protocol_wave);
assert.strictEqual(roadmapItem.priority, product.priority);
assert.strictEqual(roadmapItem.work_class, product.work_class);
assert.deepStrictEqual(roadmapItem.depends_on, ['PERF-LF-001']);
assert.strictEqual(roadmapItem.exit_gate, product.exit_gate);
assert.strictEqual(roadmap.freeze_until_gate, product.exit_gate);
assert.strictEqual(roadmap.freeze_gate_status, 'DONE');
assert.strictEqual(roadmap.feature_expansion_frozen, false);
assert.strictEqual(roadmap.trust_anchor.roadmap_id, product.roadmap_id);
assert.strictEqual(roadmap.trust_anchor.gate, product.exit_gate);
assert.strictEqual(roadmap.trust_anchor.status, 'DONE');

assert.strictEqual(product.local_read_model.storage_namespace, data.local_read_model.storage_namespace, 'Product Ready must use DATA-LF canonical Local Read Model namespace');
assert.strictEqual(product.local_read_model.storage_namespace, performanceNode.storeName, 'cached-FMP probe must read the active Product Ready Local Read Model namespace');
assert(financeRuntimeSource.includes("var CANONICAL_LOCAL_DB = '" + product.local_read_model.storage_namespace + "';"), 'finance startup cache must read the active Product Ready Local Read Model namespace');
assert(spaServiceSource.includes("ACTIVE_BOOT_TOKEN: \"name:'" + product.local_read_model.storage_namespace + "'\""), 'trusted renderer active cache namespace must match Product Ready contract');
assert.strictEqual(product.local_read_model.same_namespace_for_finance_startup_cache, true);
assert.strictEqual(product.local_read_model.same_namespace_for_performance_probe, true);

assert.deepStrictEqual(product.journey.route_order, [
  'home', 'expenses', 'income', 'cash-flow', 'transactions', 'data-quality'
]);
assert(product.journey.route_order.every((route) => spa.routes.includes(route)), 'historical MASTER-LF-PRODUCT journey must remain available after post-LF route expansion');
assert(finance.routes.every((route) => product.journey.route_order.includes(route)), 'all finance routes must be in Product Ready journey');
assert(data.routes.every((route) => product.journey.route_order.includes(route)), 'all Data routes must be in Product Ready journey');
assert.strictEqual(product.journey.single_document, true);
assert.strictEqual(spa.lifecycle.single_html_document, true);
assert.strictEqual(product.journey.request_per_view_primary_path, false);
assert.strictEqual(product.journey.shared_finance_filter_context, true);
assert.strictEqual(finance.filter_context.session_shared, true);
assert.strictEqual(finance.filter_context.route_switch_preserves_context, true);
assert.strictEqual(product.journey.finance_filter_required, true);
assert.strictEqual(product.journey.transaction_filter_required, true);
assert.strictEqual(product.journey.transaction_drill_required, true);
assert.strictEqual(data.transactions.read_only, true);
assert.strictEqual(data.navigation.back_forward, true);
assert.strictEqual(product.journey.sync_refresh_required, true);
assert.strictEqual(product.journey.back_forward_required, true);
assert.strictEqual(product.journey.canonical_financial_write, false);

for (const scenario of [
  'READY_LOCAL_FULL_JOURNEY',
  'FILTER_CONTEXT_PERSISTS_ACROSS_FINANCE_ROUTES',
  'TRANSACTION_FILTER_AND_DRILL',
  'BACK_FORWARD_WITHOUT_DOCUMENT_RELOAD',
  'BACKGROUND_SYNC_REFRESH',
  'REMOTE_FAILURE_WITH_VERIFIED_LOCAL_DEGRADED',
  'REMOTE_RECOVERY_TO_VERIFIED_READY',
  'OFFLINE_LOCAL_READ_AVAILABLE',
  'NO_ACTIVE_SNAPSHOT_FAILS_CLOSED',
  'STALE_GENERATION_COMPLETION_DISCARDED'
]) {
  assert(product.required_scenarios.includes(scenario), `missing Product Ready scenario ${scenario}`);
}
assert.strictEqual(product.state_truth.loading_visible, true);
assert.strictEqual(product.state_truth.degraded_sync_visible, true);
assert.strictEqual(product.state_truth.recovery_visible, true);
assert.strictEqual(product.state_truth.remote_failure_may_masquerade_as_success, false);
assert.strictEqual(product.state_truth.verified_local_remains_readable_on_remote_failure, true);
assert.strictEqual(runtime.sync.network_failure_with_verified_local, 'DEGRADED_LOCAL');
assert.strictEqual(product.state_truth.stale_generation_acceptance, false);
assert.strictEqual(runtime.worker.stale_completion, 'DISCARD');
assert.strictEqual(product.state_truth.fatal_runtime_errors_allowed, false);
assert.strictEqual(product.state_truth.duplicate_app_shell_allowed, false);
assert.strictEqual(product.state_truth.developer_only_markers_owner_visible, false);

assert.strictEqual(product.financial_truth.canonical_worker_only, true);
assert.strictEqual(product.financial_truth.ui_financial_formula_allowed, false);
assert.strictEqual(product.financial_truth.exact_revision_provenance_required, true);
assert.strictEqual(product.financial_truth.fin_parity_required, true);
assert.strictEqual(product.financial_truth.canonical_financial_write, false);
assert.strictEqual(finance.queries.executor, 'CANONICAL_WEB_WORKER_ONLY');
assert.strictEqual(finance.queries.main_thread_financial_formula, false);
assert(finance.invariants.includes('EXACT_REVISION_PROVENANCE'));
assert.strictEqual(runtime.authorities.canonical_write, false);

const expectedPerf = {
  warm_route_switch_p95_ms: perf.metrics.warm_route_switch_p95.threshold_ms,
  filter_kpi_update_p95_ms: perf.metrics.filter_kpi_update_p95.threshold_ms,
  chart_repaint_desktop_p95_ms: perf.metrics.chart_repaint_desktop_p95.threshold_ms,
  chart_repaint_mobile_p95_ms: perf.metrics.chart_repaint_mobile_p95.threshold_ms,
  back_forward_p95_ms: perf.metrics.back_forward_p95.threshold_ms,
  cached_first_meaningful_paint_p95_ms: perf.metrics.cached_first_meaningful_paint_p95.threshold_ms,
  warm_mandatory_network_requests: perf.warm_invariants.mandatory_network_requests,
  warm_google_sheets_reads: perf.warm_invariants.google_sheets_reads,
  warm_server_document_reloads: perf.warm_invariants.server_document_reload
};
assert.deepStrictEqual(product.performance, expectedPerf, 'E2E gate must retain MASTER-LF-PERF thresholds and zero-network invariants');
assert.deepStrictEqual(runtime.product_slo_targets_ms, {
  warm_route_switch_p95: product.performance.warm_route_switch_p95_ms,
  filter_kpi_update_p95: product.performance.filter_kpi_update_p95_ms,
  chart_repaint_desktop_p95: product.performance.chart_repaint_desktop_p95_ms,
  chart_repaint_mobile_p95: product.performance.chart_repaint_mobile_p95_ms,
  back_forward_p95: product.performance.back_forward_p95_ms,
  cached_first_meaningful_paint_p95: product.performance.cached_first_meaningful_paint_p95_ms
});
assert.strictEqual(runtime.measurement_rules.warm_interaction_must_prove_zero_required_network, true);
assert.strictEqual(runtime.measurement_rules.warm_interaction_must_prove_zero_google_sheet_reads, true);

assert.strictEqual(product.machine_evidence.real_chromium_required, true);
assert.strictEqual(product.machine_evidence.public_finance_data, 'SYNTHETIC_ONLY');
assert.strictEqual(product.machine_evidence.desktop_full_journey_required, true);
assert.strictEqual(product.machine_evidence.representative_mobile_full_journey_required, true);
assert.strictEqual(product.machine_evidence.real_indexeddb_required, true);
assert.strictEqual(product.machine_evidence.worker_runtime_required, true);
assert.strictEqual(product.machine_evidence.navigation_history_required, true);
assert.strictEqual(product.machine_evidence.sync_degraded_recovery_required, true);
assert.strictEqual(product.machine_evidence.performance_contract_retained, true);
assert.deepStrictEqual(product.devices.machine_e2e, ['DESKTOP', 'REPRESENTATIVE_MOBILE']);
assert.deepStrictEqual(product.devices.owner_uat, ['DESKTOP', 'MOBILE']);

assert.strictEqual(product.candidate.exact_sha_required, true);
assert.strictEqual(product.candidate.authenticated_dev_deploy_required, true);
assert.strictEqual(product.candidate.trusted_runtime_health_required, true);
assert.strictEqual(product.candidate.pr_validation_required, true);
assert.strictEqual(product.candidate.owner_uat_profile, 'GENERIC_V1');
assert.strictEqual(product.candidate.owner_authentication_required, true);
assert.strictEqual(product.candidate.assistant_self_attestation_allowed, false);
assert.strictEqual(product.candidate.machine_mobile_replaces_owner_mobile, false);
assert.strictEqual(product.owner_uat.profile, 'GENERIC_V1');
assert.strictEqual(product.owner_uat.all_required_fields_must_pass, true);
assert.strictEqual(product.owner_uat.exact_candidate_required, true);
assert.strictEqual(product.owner_uat.deployed_health_required, true);

const expectedOwnerFields = [
  'owner_uat_desktop',
  'owner_uat_mobile',
  'owner_uat_visible_actions',
  'owner_uat_russian_ui',
  'owner_uat_no_developer_markers',
  'owner_uat_visual_truth',
  'owner_uat_visual_acceptance',
  'owner_uat_back_forward',
  'owner_uat_loading_error_states',
  'owner_uat_route_switch_p95_ms'
];
assert.deepStrictEqual(product.owner_uat.required_fields, expectedOwnerFields);
for (const field of expectedOwnerFields) {
  assert(ownerUatWorkflow.includes(field), `Owner UAT workflow missing ${field}`);
}
assert(ownerUatWorkflow.includes("UAT_PROFILE='GENERIC_V1'"));
assert(ownerUatWorkflow.includes("context='product-ready-e2e'"));
assert(ownerUatDocs.includes('полного Local-first Product Ready journey'));
assert(ownerUatDocs.includes('desktop + mobile authenticated product journey'));

assert.strictEqual(product.privacy.financial_payload_in_public_evidence, false);
assert.strictEqual(product.privacy.private_labels_in_public_evidence, false);
assert.strictEqual(product.privacy.private_ids_in_public_evidence, false);
assert.strictEqual(product.privacy.private_urls_in_public_evidence, false);
for (const field of [
  'route_id', 'action_id', 'runtime_state', 'sync_state', 'device_class',
  'sample_count', 'p95_ms', 'threshold_ms', 'mandatory_network_requests',
  'google_sheets_reads', 'document_loads', 'candidate_sha_prefix',
  'source_tree_hash_prefix', 'revision_hash_prefix', 'generation_hash_prefix'
]) {
  assert(product.privacy.allowed_evidence_fields.includes(field), `privacy allowlist missing ${field}`);
}
const publicFields = product.privacy.allowed_evidence_fields.join('|');
assert(!/(amount|category|member|account|project|transaction_id|url|href|description|counterparty)/i.test(publicFields), 'public Product Ready evidence fields must not expose owner finance payload or locators');

assert.strictEqual(product.authorities.canonical_financial_write, false);
assert.strictEqual(product.authorities.canonical_source_mutation, false);
assert.strictEqual(product.authorities.new_financial_formula, false);
assert.strictEqual(product.authorities.paid_dependency_required, false);
assert.strictEqual(product.authorities.ydb_prerequisite, false);
assert.strictEqual(runtime.ydb_ladder.required_for_local_first_product_ready, false);

assert.strictEqual(product.completion.pr_validation, 'PASS_EXACT_HEAD');
assert.strictEqual(product.completion.trusted_dev_deploy, 'PASS_EXACT_CANDIDATE');
assert.strictEqual(product.completion.trusted_runtime_health, 'PASS_EXACT_CANDIDATE');
assert.strictEqual(product.completion.owner_product_uat, 'PASS_GENERIC_V1_EXACT_CANDIDATE');
assert.strictEqual(product.completion.product_ready_e2e_status, 'SUCCESS_EXACT_CANDIDATE');
assert.strictEqual(product.completion.autonomous_merge_before_product_ready, false);
assert.strictEqual(product.completion.main_verification_required, true);
assert.strictEqual(product.completion.issue_target_state, 'DONE');

console.log('local_first_product_ready_runtime_test: PASS', {
  contract: 'PRH_LOCAL_FIRST_PRODUCT_READY_V1@1.0.0',
  routeCount: product.journey.route_order.length,
  machineDevices: product.devices.machine_e2e,
  ownerDevices: product.devices.owner_uat,
  requiredScenarios: product.required_scenarios.length,
  ownerProfile: product.owner_uat.profile,
  exactCandidate: true,
  freeOnly: true,
  ydbPrerequisite: false
});
