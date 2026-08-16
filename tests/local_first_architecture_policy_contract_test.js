'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

const contract = readJson('lib/local_first/local_first_runtime.v1.json');
const roadmapContract = readJson('lib/local_first/local_first_roadmap.v1.json');
const architecture = read('docs/architecture/LOCAL_FIRST_RUNTIME.md');
const roadmap = read('docs/ROADMAP_LOCAL_FIRST_RECOVERY.md');
const adr = read('docs/adr/ADR-ARCH-LF-001-LOCAL-FIRST-RUNTIME.md');

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

assert.strictEqual(roadmapContract.schema, 'PRH_LOCAL_FIRST_ROADMAP_V1');
assert.strictEqual(roadmapContract.version, '1.1.0');
assert.strictEqual(roadmapContract.freeze_until_gate, 'MASTER-LF-PRODUCT');
assert.strictEqual(roadmapContract.freeze_gate_status, 'DONE');
assert.strictEqual(roadmapContract.feature_expansion_frozen, false);
assert.strictEqual(roadmapContract.base_roadmap, 'docs/ROADMAP.md@v2.5');
assert.strictEqual(roadmapContract.amendment_status, 'CONSOLIDATED_HISTORICAL');
assert.strictEqual(roadmapContract.protocol.task_schema, 'PRH_ROADMAP_TASK_V2');
assert.strictEqual(roadmapContract.protocol.local_first_protocol_wave, 'R2R');
assert.strictEqual(roadmapContract.protocol.future_ydb_protocol_wave, 'R4');
assert.strictEqual(roadmapContract.protocol.one_active_writer, true);
assert.strictEqual(roadmapContract.protocol.paid_dependency_required, false);

const expectedIds = [
  'ARCH-LF-001', 'SPA-LF-001', 'STORE-LF-001', 'WORKER-LF-001',
  'SYNC-LF-001', 'DELTA-LF-001', 'PACK-LF-001', 'FIN-LF-001', 'DATA-LF-001',
  'PERF-LF-001', 'E2E-LF-001', 'YDB-LF-001', 'YDB-LF-002'
];
assert.deepStrictEqual(roadmapContract.items.map((item) => item.id), expectedIds);
assert.deepStrictEqual(roadmapContract.items.map((item) => item.order),
  expectedIds.map((_, index) => index + 1));
assert.strictEqual(new Set(expectedIds).size, expectedIds.length);

assert(roadmapContract.items
  .filter((item) => item.phase !== 'FUTURE')
  .every((item) => item.lifecycle_status === 'DONE'), 'LF0..LF4 must be recorded as completed after MASTER-LF-PRODUCT');
assert(roadmapContract.items
  .filter((item) => item.phase === 'FUTURE')
  .every((item) => item.lifecycle_status === 'BLOCKED'), 'future YDB lane must remain fail-closed');
assert.strictEqual(roadmapContract.trust_anchor.roadmap_id, 'E2E-LF-001');
assert.strictEqual(roadmapContract.trust_anchor.gate, 'MASTER-LF-PRODUCT');
assert.strictEqual(roadmapContract.trust_anchor.status, 'DONE');
assert.strictEqual(roadmapContract.post_lf.governance_item, 'GOV-LF-001');
assert.strictEqual(roadmapContract.post_lf.next_ready_after_governance, 'PLAN-REC-001');
assert.strictEqual(roadmapContract.post_lf.exactly_one_ready_required, true);
const postLfDisposition = new Map(roadmapContract.post_lf.legacy_recovery_disposition.map((entry) => [entry.id, entry]));
assert.strictEqual(postLfDisposition.get('PLAN-REC-001').status_after_governance, 'READY');
assert.strictEqual(postLfDisposition.get('VIZ-REC-001').status_after_governance, 'BLOCKED');
assert.strictEqual(postLfDisposition.get('E2E-REC-001').disposition, 'SUPERSEDED_BY_E2E-LF-001');
assert.strictEqual(postLfDisposition.get('STUDIO-REC-001').status_after_governance, 'BACKLOG');
assert.strictEqual(roadmapContract.post_lf.legacy_recovery_disposition
  .filter((entry) => entry.status_after_governance === 'READY').length, 1,
'exactly one post-LF recovery item may be READY after governance');
assert(roadmapContract.post_lf.external_blockers.every((entry) => entry.status === 'BLOCKED'));

const itemIndex = new Map(roadmapContract.items.map((item) => [item.id, item]));
const externalDoneDependencies = new Set(['GOV-REC-001', 'DATA-REC-001', 'YC-040']);
for (const item of roadmapContract.items) {
  assert(['R2R', 'R4'].includes(item.protocol_wave), `unsupported protocol wave: ${item.id}`);
  assert(['P0', 'P1'].includes(item.priority), `unsupported priority: ${item.id}`);
  assert(['engineering', 'user_facing'].includes(item.work_class), `bad work class: ${item.id}`);
  for (const dependency of item.depends_on) {
    if (externalDoneDependencies.has(dependency)) continue;
    assert(itemIndex.has(dependency), `unknown Local-first dependency ${dependency}`);
    assert(itemIndex.get(dependency).order < item.order,
      `dependency must precede consumer: ${dependency} -> ${item.id}`);
  }
}

assert(roadmapContract.items
  .filter((item) => item.phase !== 'FUTURE')
  .every((item) => item.protocol_wave === 'R2R' && item.priority === 'P0'));
assert(roadmapContract.items
  .filter((item) => item.phase === 'FUTURE')
  .every((item) => item.protocol_wave === 'R4' && item.priority === 'P1'));

assert(adr.includes('Статус: **APPROVED**'));
assert(adr.includes('PRH_LOCAL_FIRST_RUNTIME_V1@1.0.0'));
assert(adr.includes('Local-first SPA + IndexedDB Local Read Model + Web Worker analytics'));
assert(adr.includes('Немедленный big-bang YDB migration — отклонено'));

for (const required of [
  'Local-first', 'IndexedDB', 'Web Worker', 'background', 'YDB',
  'zero mandatory network requests'
]) {
  assert(architecture.includes(required) || roadmap.includes(required) || adr.includes(required),
    `missing normative Local-first concept: ${required}`);
}
// Big-bang prohibition is machine-authoritative; wording in human docs may vary.
assert.strictEqual(contract.ydb_ladder.big_bang_cutover_allowed, false);

for (const id of expectedIds) {
  assert(roadmap.includes(id), `Local-first Roadmap missing ${id}`);
}
assert(roadmap.includes('| ARCH-LF-001 | LF0 | R2R | P0 |'));
assert(roadmap.includes('| YDB-LF-001 | FUTURE | R4 | P1 |'));

console.log('Local-first architecture policy contract: PASS', {
  contract: 'PRH_LOCAL_FIRST_RUNTIME_V1@1.0.0',
  roadmap: 'PRH_LOCAL_FIRST_ROADMAP_V1@1.1.0',
  items: expectedIds.length,
  warmRequiredNetwork: false,
  warmGoogleSheetsReads: 0,
  futureYdbBigBang: false,
  freeOnly: true
});
