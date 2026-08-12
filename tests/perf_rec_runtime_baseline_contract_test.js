'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { summarize, EVIDENCE_SCHEMA } = require('../tools/perf-rec-baseline-summary');
const executor = require('../tools/perf-rec-baseline-exec');

const root = path.join(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/trusted-perf-rec-baseline.yml'), 'utf8');
const executorSource = fs.readFileSync(path.join(root, 'tools/perf-rec-baseline-exec.js'), 'utf8');
const sha = 'b'.repeat(40);

function sample(mode, pair, totalMs) {
  const cold = mode === 'COLD';
  return {
    ok: true,
    schema: 'PRH_PERF_REC_TELEMETRY_V1',
    roadmap_id: 'PERF-REC-001',
    candidate_sha: sha,
    mode,
    cache_status: cold ? 'MISS' : 'HIT',
    reason_code: cold ? 'COLD_PROJECTED_HOME_BUILT' : 'EXACT_SOURCE_REVISION_MATCH',
    phase_ms: {
      revision_probe_ms: 5, cache_read_ms: cold ? 0 : 2, cache_write_ms: cold ? 3 : 0,
      settings_read_ms: cold ? 5 : 0, sheet_read_ms: cold ? 40 : 0,
      canonical_snapshot_ms: cold ? 70 : 0, home_build_ms: cold ? 50 : 0, total_ms: totalMs
    },
    source_revision_probe_count: cold ? 3 : 2,
    gateway_call_count: cold ? 2 : 0,
    range_read_count: cold ? 5 : 0,
    cell_read_count: cold ? 700 : 0,
    canonical_snapshot_read_count: cold ? 1 : 0,
    snapshot_reuse_count: cold ? 0 : 1,
    unique_dimension_hash_count: cold ? 11 : 0,
    dimension_hash_memo_hit_count: cold ? 89 : 0,
    cache_payload_utf8_bytes: 5000,
    source_revision_hash_prefix: `abcdef${String(pair).padStart(6, '0')}`,
    canonical_revision_hash_prefix: '123456abcdef',
    execution_wall_ms: totalMs + 25
  };
}

const samples = [];
for (let pair = 1; pair <= 20; pair += 1) {
  samples.push(sample('COLD', pair, 1000 + pair));
  samples.push(sample('WARM', pair, 300 + pair));
}
const summary = summarize(samples, sha);
assert.strictEqual(summary.ok, true);
assert.strictEqual(summary.schema, EVIDENCE_SCHEMA);
assert.deepStrictEqual(summary.sample_counts, { cold: 20, warm: 20, paired: 20 });
assert.strictEqual(summary.invariants.pass, true);
assert.strictEqual(summary.invariants.projected_home_reads_per_cold, true);
assert.strictEqual(summary.slo.cold_first_usable_p95_ms.pass, true);
assert.strictEqual(summary.slo.warm_home_p95_ms.pass, true);
assert.strictEqual(summary.slo.runtime_hang_gt_15000_ms.pass, true);
assert.strictEqual(summary.slo.warm_route_switch_p95_ms.status, 'NOT_MEASURED_BY_HOME_BASELINE');
assert.strictEqual(summary.evidence_scope.route_switch_measured, false);
assert.strictEqual(summary.optimization.canonical_snapshot_reads.cold_observed_total, 20);
assert.strictEqual(summary.optimization.canonical_snapshot_reads.warm_observed_total, 0);
assert.strictEqual(summary.optimization.canonical_snapshot_reads.prior_path_counterfactual_per_40_requests, 40);
assert.strictEqual(summary.optimization.canonical_snapshot_reads.recovered_path_observed_per_40_requests, 20);
assert.strictEqual(summary.optimization.dimension_hashing.prior_hash_calls_counterfactual_p50, 100);
assert.strictEqual(summary.optimization.dimension_hashing.recovered_hash_calls_observed_p50, 11);
assert.strictEqual(summary.optimization.projected_io.cold_gateway_calls_p50, 2);
assert.strictEqual(summary.optimization.projected_io.cold_cell_reads_p50, 700);

const serialized = JSON.stringify(summary);
for (const forbidden of ['source_revision_hash_prefix','canonical_revision_hash_prefix','abcdef000001','123456abcdef']) {
  assert(!serialized.includes(forbidden), `public baseline summary leaked private revision evidence: ${forbidden}`);
}
assert(!serialized.includes('cards'));
assert(!serialized.includes('visual_data'));

const slow = samples.map((entry) => JSON.parse(JSON.stringify(entry)));
slow[36].phase_ms.total_ms = 16001;
const slowSummary = summarize(slow, sha);
assert.strictEqual(slowSummary.ok, false);
assert.strictEqual(slowSummary.slo.runtime_hang_gt_15000_ms.pass, false);

const stale = samples.map((entry) => JSON.parse(JSON.stringify(entry)));
stale[1].source_revision_hash_prefix = 'fedcba654321';
const staleSummary = summarize(stale, sha);
assert.strictEqual(staleSummary.ok, false);
assert.strictEqual(staleSummary.invariants.source_revision_stable_within_pairs, false);
assert(!JSON.stringify(staleSummary).includes('fedcba654321'));

const fullScanMasquerade = samples.map((entry) => JSON.parse(JSON.stringify(entry)));
fullScanMasquerade[0].reason_code = 'COLD_SINGLE_SCAN_BUILT';
const fullScanSummary = summarize(fullScanMasquerade, sha);
assert.strictEqual(fullScanSummary.ok, false);
assert.strictEqual(fullScanSummary.invariants.projected_home_reads_per_cold, false);

assert.strictEqual(executor.FUNCTION_NAME, 'prhPerfRecBaselineProbeJson');
assert.match(executorSource, /const FUNCTION_NAME = 'prhPerfRecBaselineProbeJson'/);
assert.doesNotMatch(executorSource, /process\.argv\[3\].*function/i);
assert.doesNotMatch(executorSource, /console\.log\(runPayload/);
assert.match(workflow, /workflow_run:/);
assert.match(workflow, /workflows: \[Trusted DEV Deploy\]/);
assert.match(workflow, /environment: DEV/);
assert.match(workflow, /seq 1 20/);
assert.match(workflow, /perf-rec-baseline/);
assert.doesNotMatch(workflow, /pull_request_target/);

console.log('perf_rec_runtime_baseline_contract_test: OK', {
  schema: EVIDENCE_SCHEMA,
  samples: '20C+20W',
  exactSha: true,
  privacySafeSummary: true,
  projectedHomeTruth: true,
  routeSwitchOverclaim: false,
  trustedExecutorNarrow: true,
  homeSloGate: true
});