'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const contractPath = path.join(root, 'lib/local_first/local_first_runtime.v1.json');
const architecturePath = path.join(root, 'docs/architecture/LOCAL_FIRST_RUNTIME.md');
const roadmapPath = path.join(root, 'docs/ROADMAP_LOCAL_FIRST_RECOVERY.md');

const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const architecture = fs.readFileSync(architecturePath, 'utf8');
const roadmap = fs.readFileSync(roadmapPath, 'utf8');

assert.strictEqual(contract.schema, 'PRH_LOCAL_FIRST_RUNTIME_V1');
assert.strictEqual(contract.version, '1.0.0');
assert.strictEqual(contract.roadmap_id, 'ARCH-LF-001');
assert.strictEqual(contract.cost_class, 'FREE_ONLY');
assert.strictEqual(contract.authorities.financial_truth, false);
assert.strictEqual(contract.authorities.canonical_write, false);
assert.strictEqual(contract.authorities.renderer_financial_authority, false);
assert.strictEqual(contract.authorities.google_authoritative_source_during_transition, true);
assert.strictEqual(contract.authorities.future_ydb_write_authority, false);

assert.strictEqual(contract.local_read_model.storage, 'INDEXEDDB');
assert.strictEqual(contract.local_read_model.canonical_revision_format, 'SHA256_HEX_64');
assert.strictEqual(contract.local_read_model.immutable_generation, true);
assert.strictEqual(contract.local_read_model.partial_generation_visible, false);
assert.strictEqual(contract.local_read_model.incompatible_schema_action, 'REBUILD');
assert.strictEqual(contract.local_read_model.corruption_action, 'REBUILD');
assert.deepStrictEqual(contract.local_read_model.stores,
  ['meta', 'transactions', 'dimensions', 'aggregates', 'sync_journal']);

assert.strictEqual(contract.spa.single_document_shell, true);
assert.strictEqual(contract.spa.client_side_history, true);
assert.strictEqual(contract.spa.warm_route_requires_network, false);
assert.strictEqual(contract.spa.warm_filter_requires_network, false);
assert.strictEqual(contract.spa.warm_chart_requires_network, false);
assert.strictEqual(contract.spa.warm_google_sheets_reads, 0);

assert.strictEqual(contract.worker.off_main_thread, true);
assert.strictEqual(contract.worker.network_authority, false);
assert.strictEqual(contract.worker.storage_authority, false);
assert.strictEqual(contract.worker.financial_write_authority, false);
assert.strictEqual(contract.worker.revision_bound, true);
assert.strictEqual(contract.worker.generation_bound, true);
assert.strictEqual(contract.worker.stale_completion, 'DISCARD');
assert(contract.worker.messages_in.includes('ANALYTICS_QUERY'));
assert(contract.worker.messages_out.includes('STALE_DISCARDED'));

assert.strictEqual(contract.sync.blocking_ready_ui, false);
assert.strictEqual(contract.sync.same_revision, 'NOOP');
assert.strictEqual(contract.sync.partial_bootstrap_commit, false);
assert.strictEqual(contract.sync.atomic_generation_switch, true);
assert.strictEqual(contract.sync.delta_requires_exact_base_revision, true);
assert.strictEqual(contract.sync.delta_apply_idempotent, true);
assert.strictEqual(contract.sync.delta_chain_unproven, 'FULL_REBUILD');
assert.strictEqual(contract.sync.network_failure_with_verified_local, 'DEGRADED_LOCAL');

assert(contract.product_slo_targets_ms.warm_route_switch_p95 <= 100);
assert(contract.product_slo_targets_ms.filter_kpi_update_p95 <= 200);
assert(contract.product_slo_targets_ms.chart_repaint_desktop_p95 <= 300);
assert(contract.product_slo_targets_ms.chart_repaint_mobile_p95 <= 500);
assert(contract.product_slo_targets_ms.back_forward_p95 <= 100);
assert(contract.product_slo_targets_ms.cached_first_meaningful_paint_p95 <= 800);
assert.strictEqual(contract.measurement_rules.server_health_latency_is_product_sla, false);
assert.strictEqual(contract.measurement_rules.cold_bootstrap_is_warm_interaction_sla, false);
assert.strictEqual(contract.measurement_rules.warm_interaction_must_prove_zero_required_network, true);
assert.strictEqual(contract.measurement_rules.warm_interaction_must_prove_zero_google_sheet_reads, true);

assert.strictEqual(contract.privacy.financial_payload_in_public_telemetry, false);
assert.strictEqual(contract.privacy.financial_payload_in_url_history, false);
assert.strictEqual(contract.privacy.indexeddb_synced_to_public_artifacts, false);
assert.strictEqual(contract.ydb_ladder.required_for_local_first_product_ready, false);
assert.strictEqual(contract.ydb_ladder.big_bang_cutover_allowed, false);
assert.strictEqual(contract.ydb_ladder.paid_overage_allowed, false);
assert.strictEqual(contract.ydb_ladder.unknown_billing_state, 'BLOCKED');
assert.deepStrictEqual(contract.ydb_ladder.stages, [
  'GOOGLE_AUTHORITATIVE_LOCAL_FIRST',
  'YDB_SHADOW_REPLICA',
  'DUAL_READ_COMPARE',
  'YDB_READ_CANARY',
  'YDB_READ_AUTHORITY',
  'FUTURE_SEPARATE_WRITE_CUTOVER'
]);

for (const required of [
  'Local-first', 'IndexedDB', 'Web Worker', 'background', 'YDB',
  'zero mandatory network requests', 'Big-bang cutover запрещён'
]) {
  assert(architecture.includes(required) || roadmap.includes(required),
    `missing normative Local-first concept: ${required}`);
}

for (const id of [
  'ARCH-LF-001', 'SPA-LF-001', 'STORE-LF-001', 'WORKER-LF-001',
  'SYNC-LF-001', 'DELTA-LF-001', 'FIN-LF-001', 'DATA-LF-001',
  'PERF-LF-001', 'E2E-LF-001', 'YDB-LF-001', 'YDB-LF-002'
]) {
  assert(roadmap.includes(id), `Local-first Roadmap missing ${id}`);
}

console.log('Local-first architecture policy contract: PASS');
