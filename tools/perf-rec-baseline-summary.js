'use strict';

const fs = require('fs');

const SAMPLE_SCHEMA = 'PRH_PERF_REC_TELEMETRY_V1';
const EVIDENCE_SCHEMA = 'PRH_PERF_REC_BASELINE_EVIDENCE_V1';
const ROADMAP_ID = 'PERF-REC-001';
const EXPECTED_PER_MODE = 20;
const PHASE_KEYS = Object.freeze([
  'revision_probe_ms', 'cache_read_ms', 'cache_write_ms', 'settings_read_ms',
  'sheet_read_ms', 'canonical_snapshot_ms', 'home_build_ms', 'total_ms'
]);
const COUNT_KEYS = Object.freeze([
  'source_revision_probe_count', 'gateway_call_count', 'range_read_count',
  'cell_read_count', 'canonical_snapshot_read_count', 'snapshot_reuse_count',
  'unique_dimension_hash_count', 'dimension_hash_memo_hit_count',
  'cache_payload_utf8_bytes'
]);

function percentile(values, quantile) {
  if (!Array.isArray(values) || values.length === 0) throw new Error('PERF_BASELINE_VALUES_EMPTY');
  const sorted = values.map(Number).sort((a, b) => a - b);
  if (sorted.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('PERF_BASELINE_VALUE_INVALID');
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(quantile * sorted.length) - 1));
  return sorted[index];
}

function stats(values) {
  return {
    min: Math.min(...values),
    p50: percentile(values, 0.50),
    p95: percentile(values, 0.95),
    max: Math.max(...values)
  };
}

function parseNdjson(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.map((line, index) => {
    try { return JSON.parse(line); } catch (_) { throw new Error(`PERF_BASELINE_NDJSON_INVALID_${index + 1}`); }
  });
}

function assertSample(sample, candidateSha, expectedMode, index) {
  if (!sample || typeof sample !== 'object' || Array.isArray(sample) || sample.ok !== true) {
    throw new Error(`PERF_BASELINE_SAMPLE_INVALID_${index + 1}`);
  }
  if (sample.schema !== SAMPLE_SCHEMA || sample.roadmap_id !== ROADMAP_ID || sample.candidate_sha !== candidateSha) {
    throw new Error(`PERF_BASELINE_SAMPLE_IDENTITY_INVALID_${index + 1}`);
  }
  if (sample.mode !== expectedMode) throw new Error(`PERF_BASELINE_SAMPLE_ORDER_INVALID_${index + 1}`);
  if (!/^[0-9a-f]{12}$/.test(String(sample.source_revision_hash_prefix || ''))) {
    throw new Error(`PERF_BASELINE_SOURCE_REVISION_INVALID_${index + 1}`);
  }
  if (!sample.phase_ms || typeof sample.phase_ms !== 'object' || Array.isArray(sample.phase_ms)) {
    throw new Error(`PERF_BASELINE_PHASES_INVALID_${index + 1}`);
  }
  for (const key of PHASE_KEYS) {
    if (!Number.isFinite(Number(sample.phase_ms[key])) || Number(sample.phase_ms[key]) < 0) {
      throw new Error(`PERF_BASELINE_PHASE_INVALID_${index + 1}_${key}`);
    }
  }
  for (const key of COUNT_KEYS) {
    if (!Number.isFinite(Number(sample[key])) || Number(sample[key]) < 0) {
      throw new Error(`PERF_BASELINE_COUNTER_INVALID_${index + 1}_${key}`);
    }
  }
  if (!Number.isFinite(Number(sample.execution_wall_ms)) || Number(sample.execution_wall_ms) < 0) {
    throw new Error(`PERF_BASELINE_WALL_INVALID_${index + 1}`);
  }
}

function modeAggregate(samples) {
  const phases = {};
  for (const key of PHASE_KEYS) phases[key] = stats(samples.map((sample) => Number(sample.phase_ms[key])));
  const counters = {};
  for (const key of COUNT_KEYS) counters[key] = stats(samples.map((sample) => Number(sample[key])));
  return {
    samples: samples.length,
    phase_ms: phases,
    counters,
    transport_wall_ms: stats(samples.map((sample) => Number(sample.execution_wall_ms)))
  };
}

function summarize(samples, candidateSha) {
  if (!/^[0-9a-f]{40}$/.test(String(candidateSha || ''))) throw new Error('PERF_BASELINE_CANDIDATE_SHA_INVALID');
  if (!Array.isArray(samples) || samples.length !== EXPECTED_PER_MODE * 2) {
    throw new Error('PERF_BASELINE_SAMPLE_COUNT_INVALID');
  }

  const cold = [];
  const warm = [];
  const invariantFailures = [];
  for (let pair = 0; pair < EXPECTED_PER_MODE; pair += 1) {
    const coldSample = samples[pair * 2];
    const warmSample = samples[pair * 2 + 1];
    assertSample(coldSample, candidateSha, 'COLD', pair * 2);
    assertSample(warmSample, candidateSha, 'WARM', pair * 2 + 1);
    cold.push(coldSample);
    warm.push(warmSample);

    if (coldSample.source_revision_hash_prefix !== warmSample.source_revision_hash_prefix) {
      invariantFailures.push(`PAIR_${pair + 1}_SOURCE_REVISION_CHANGED`);
    }
    if (coldSample.cache_status !== 'MISS' || coldSample.reason_code !== 'COLD_SINGLE_SCAN_BUILT' ||
        Number(coldSample.gateway_call_count) !== 1 || Number(coldSample.canonical_snapshot_read_count) !== 1) {
      invariantFailures.push(`PAIR_${pair + 1}_COLD_PATH_INVALID`);
    }
    if (warmSample.cache_status !== 'HIT' || warmSample.reason_code !== 'EXACT_SOURCE_REVISION_MATCH' ||
        Number(warmSample.gateway_call_count) !== 0 || Number(warmSample.canonical_snapshot_read_count) !== 0) {
      invariantFailures.push(`PAIR_${pair + 1}_WARM_PATH_INVALID`);
    }
  }

  const coldAggregate = modeAggregate(cold);
  const warmAggregate = modeAggregate(warm);
  const coldP95 = coldAggregate.phase_ms.total_ms.p95;
  const warmP95 = warmAggregate.phase_ms.total_ms.p95;
  const maxRuntime = Math.max(coldAggregate.phase_ms.total_ms.max, warmAggregate.phase_ms.total_ms.max);
  const coldSnapshotReads = cold.map((sample) => Number(sample.canonical_snapshot_read_count));
  const warmSnapshotReads = warm.map((sample) => Number(sample.canonical_snapshot_read_count));
  const uniqueHashes = cold.map((sample) => Number(sample.unique_dimension_hash_count));
  const memoHits = cold.map((sample) => Number(sample.dimension_hash_memo_hit_count));

  const slo = {
    scope: 'FINANCIAL_HOME_RUNTIME',
    product_slo_authority: true,
    cold_first_usable_p95_ms: { threshold: 8000, observed: coldP95, pass: coldP95 <= 8000 },
    warm_home_p95_ms: { threshold: 3000, observed: warmP95, pass: warmP95 <= 3000 },
    runtime_hang_gt_15000_ms: { threshold: 15000, observed_max: maxRuntime, pass: maxRuntime <= 15000 },
    warm_route_switch_p95_ms: { threshold: 2000, status: 'NOT_MEASURED_BY_HOME_BASELINE', product_slo_authority: false }
  };

  const optimization = {
    canonical_snapshot_reads: {
      cold_observed_total: coldSnapshotReads.reduce((sum, value) => sum + value, 0),
      warm_observed_total: warmSnapshotReads.reduce((sum, value) => sum + value, 0),
      prior_path_counterfactual_per_40_requests: 40,
      recovered_path_observed_per_40_requests: coldSnapshotReads.reduce((sum, value) => sum + value, 0) + warmSnapshotReads.reduce((sum, value) => sum + value, 0),
      model: 'PRIOR_HOME_READALL_EACH_REQUEST_VS_EXACT_REVISION_CACHE'
    },
    dimension_hashing: {
      cold_unique_hashes_p50: percentile(uniqueHashes, 0.50),
      cold_memo_hits_p50: percentile(memoHits, 0.50),
      prior_hash_calls_counterfactual_p50: percentile(uniqueHashes.map((value, index) => value + memoHits[index]), 0.50),
      recovered_hash_calls_observed_p50: percentile(uniqueHashes, 0.50),
      model: 'COUNTERFACTUAL_FROM_EXACT_SOURCE_COLD_COUNTERS'
    }
  };

  const homeSloPass = slo.cold_first_usable_p95_ms.pass && slo.warm_home_p95_ms.pass && slo.runtime_hang_gt_15000_ms.pass;
  const invariantsPass = invariantFailures.length === 0;
  return {
    ok: homeSloPass && invariantsPass,
    schema: EVIDENCE_SCHEMA,
    roadmap_id: ROADMAP_ID,
    candidate_sha: candidateSha,
    sample_counts: { cold: cold.length, warm: warm.length, paired: EXPECTED_PER_MODE },
    runtime: { cold: coldAggregate, warm: warmAggregate },
    slo,
    invariants: {
      pass: invariantsPass,
      source_revision_stable_within_pairs: !invariantFailures.some((item) => item.includes('SOURCE_REVISION_CHANGED')),
      one_canonical_snapshot_per_cold: !invariantFailures.some((item) => item.includes('COLD_PATH_INVALID')),
      zero_canonical_snapshot_reads_per_warm: !invariantFailures.some((item) => item.includes('WARM_PATH_INVALID')),
      failures: invariantFailures
    },
    optimization,
    evidence_scope: {
      owner_authenticated: true,
      exact_sha: true,
      cold_warm_p50_p95: true,
      phase_and_read_counters: true,
      route_switch_measured: false,
      financial_payload_included: false,
      row_values_included: false,
      labels_or_ids_included: false,
      web_app_locator_included: false,
      revision_hash_prefixes_published: false
    }
  };
}

function main(argv = process.argv.slice(2)) {
  const [inputPath, candidateSha, outputPath] = argv;
  if (!inputPath || !candidateSha || !outputPath) throw new Error('PERF_BASELINE_USAGE_INVALID');
  let summary;
  try {
    summary = summarize(parseNdjson(fs.readFileSync(inputPath, 'utf8')), candidateSha);
  } catch (error) {
    summary = {
      ok: false,
      schema: EVIDENCE_SCHEMA,
      roadmap_id: ROADMAP_ID,
      candidate_sha: /^[0-9a-f]{40}$/.test(String(candidateSha || '')) ? candidateSha : null,
      reason: /^[A-Z0-9_]+$/.test(String(error && error.message || '')) ? String(error.message) : 'PERF_BASELINE_SUMMARY_FAILED',
      evidence_scope: { financial_payload_included: false, revision_hash_prefixes_published: false }
    };
  }
  fs.mkdirSync(require('path').dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ ok: summary.ok === true, reason: summary.ok === true ? 'OK' : (summary.reason || 'PERF_BASELINE_ACCEPTANCE_FAILED') })}\n`);
  if (summary.ok !== true) process.exitCode = 1;
  return summary;
}

if (require.main === module) {
  try { main(); } catch (_) { process.stdout.write('{"ok":false,"reason":"PERF_BASELINE_SUMMARY_FAILED"}\n'); process.exitCode = 1; }
}

module.exports = { percentile, stats, parseNdjson, summarize, main, PHASE_KEYS, COUNT_KEYS, EVIDENCE_SCHEMA };
