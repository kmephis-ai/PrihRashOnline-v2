'use strict';

const crypto = require('crypto');
const CONTRACT = require('./studio_scale_performance.v1.json');
const PLANNER = require('./analytics_query_planner_cache.v1.json');
const STUDIO = require('../studio/analytics_studio_shell.v1.json');
const VIZ = require('../visualization/advanced_visualization_pack.v1.json');

const SCHEMA = 'PRH_STUDIO_SCALE_PERFORMANCE_V1';
const VERSION = '1.0.0';
const HASH_RE = /^[0-9a-f]{64}$/;
const VISIBILITY = new Set(['VISIBLE', 'HIDDEN', 'OFFSCREEN']);

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function safeInteger(value, reason) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) fail(reason);
  return normalized;
}

function hashPrefix(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}

function assertContract() {
  if (CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'PERF-090') {
    fail('STUDIO_SCALE_CONTRACT_IDENTITY_INVALID');
  }
  if (`${PLANNER.schema}@${PLANNER.version}` !== CONTRACT.upstream.query_planner_cache ||
      `${STUDIO.schema}@${STUDIO.version}` !== CONTRACT.upstream.analytics_studio_shell ||
      `${VIZ.schema}@${VIZ.version}` !== CONTRACT.upstream.advanced_visualization_pack) {
    fail('STUDIO_SCALE_UPSTREAM_CONTRACT_MISMATCH');
  }
  const authority = CONTRACT.authority || {};
  for (const key of ['financial_truth', 'financial_write', 'query_semantics', 'canonical_result_mutation', 'storage', 'network', 'deployment', 'paid_dependency_required']) {
    if (authority[key] !== false) fail('STUDIO_SCALE_AUTHORITY_INVALID');
  }
  if (CONTRACT.scheduler.same_query !== 'DELEGATE_TO_PERF_070_COALESCE_INFLIGHT' ||
      CONTRACT.scheduler.stale_render_commit !== false ||
      CONTRACT.visibility.deferred_query_requests !== 0 ||
      CONTRACT.visibility.deferred_render_commits !== 0 ||
      CONTRACT.presentation.downsampling_query_hash_mutation !== false ||
      CONTRACT.presentation.downsampling_canonical_result_mutation !== false ||
      CONTRACT.presentation.accessible_fallback_required !== true) {
    fail('STUDIO_SCALE_SAFETY_CONTRACT_INVALID');
  }
  return true;
}

function normalizeConcurrency(value) {
  const normalized = value == null ? CONTRACT.scheduler.max_concurrency_default : Number(value);
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > CONTRACT.scheduler.max_concurrency_limit) {
    fail('STUDIO_SCALE_CONCURRENCY_INVALID');
  }
  return normalized;
}

function normalizeWidget(input, index) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('STUDIO_SCALE_WIDGET_INVALID');
  const widgetId = String(input.widget_id || '');
  if (!widgetId) fail('STUDIO_SCALE_WIDGET_ID_REQUIRED');
  const visibility = String(input.visibility || '');
  if (!VISIBILITY.has(visibility)) fail('STUDIO_SCALE_VISIBILITY_INVALID');
  if (visibility === 'VISIBLE' && (!input.query || typeof input.query !== 'object' || Array.isArray(input.query))) {
    fail('STUDIO_SCALE_VISIBLE_QUERY_REQUIRED');
  }
  const presentation = input.presentation && typeof input.presentation === 'object' && !Array.isArray(input.presentation)
    ? input.presentation
    : {};
  return Object.freeze({
    index,
    widget_id: widgetId,
    visibility,
    query: input.query || null,
    presentation: Object.freeze({
      semantic_downsampling_safe: presentation.semantic_downsampling_safe === true,
      accessible_table: presentation.accessible_table !== false
    })
  });
}

function resultDescriptor(execution) {
  if (!execution || typeof execution !== 'object') fail('STUDIO_SCALE_EXECUTION_INVALID');
  if (execution.status !== 'READY') return null;
  const result = execution.result;
  if (!result || result.schema !== 'PRH_ANALYTICS_RESULT_V1') fail('STUDIO_SCALE_ANALYTICS_RESULT_INVALID');
  if (!HASH_RE.test(String(execution.query_hash || '')) || result.query_hash !== execution.query_hash) {
    fail('STUDIO_SCALE_QUERY_IDENTITY_MISMATCH');
  }
  const rowCount = safeInteger(result.total_rows, 'STUDIO_SCALE_ROW_COUNT_INVALID');
  if (result.truncated === true) fail('STUDIO_SCALE_TRUNCATED_RESULT_FORBIDDEN');
  return Object.freeze({ query_hash: execution.query_hash, row_count: rowCount });
}

function planPresentation(descriptorInput, presentationInput = {}) {
  assertContract();
  const descriptor = descriptorInput && typeof descriptorInput === 'object' ? descriptorInput : fail('STUDIO_SCALE_RESULT_DESCRIPTOR_INVALID');
  const queryHash = String(descriptor.query_hash || '');
  if (!HASH_RE.test(queryHash)) fail('STUDIO_SCALE_QUERY_HASH_INVALID');
  const rowCount = safeInteger(descriptor.row_count, 'STUDIO_SCALE_ROW_COUNT_INVALID');
  const safeDownsample = presentationInput.semantic_downsampling_safe === true;
  const accessibleTable = presentationInput.accessible_table !== false;
  if (!accessibleTable) fail('STUDIO_SCALE_ACCESSIBLE_FALLBACK_REQUIRED');

  if (rowCount <= CONTRACT.presentation.direct_render_row_limit) {
    return Object.freeze({
      mode: 'DIRECT',
      source_rows: rowCount,
      render_rows: rowCount,
      accessible_table: true,
      query_hash: queryHash,
      query_hash_unchanged: true,
      canonical_result_mutated: false
    });
  }
  if (safeDownsample) {
    return Object.freeze({
      mode: 'VIEW_ONLY_DOWNSAMPLE',
      source_rows: rowCount,
      render_rows: CONTRACT.presentation.direct_render_row_limit,
      accessible_table: true,
      query_hash: queryHash,
      query_hash_unchanged: true,
      canonical_result_mutated: false
    });
  }
  return Object.freeze({
    mode: 'VIRTUALIZED_ACCESSIBLE_TABLE',
    source_rows: rowCount,
    render_rows: CONTRACT.presentation.virtualized_table_window_rows,
    accessible_table: true,
    query_hash: queryHash,
    query_hash_unchanged: true,
    canonical_result_mutated: false
  });
}

function createStudioScaleCoordinator(options = {}) {
  assertContract();
  const executeQuery = options.execute_query;
  const getQueryGeneration = options.get_query_generation;
  const advanceQueryGeneration = options.advance_query_generation;
  const getRevision = options.get_revision;
  const commitRender = typeof options.commit_render === 'function' ? options.commit_render : async () => ({ status: 'COMMITTED' });
  if (typeof executeQuery !== 'function' || typeof getQueryGeneration !== 'function' ||
      typeof advanceQueryGeneration !== 'function' || typeof getRevision !== 'function') {
    fail('STUDIO_SCALE_PERF070_ADAPTER_REQUIRED');
  }
  const maxConcurrency = normalizeConcurrency(options.max_concurrency);
  let runSequence = 0;
  let lastTelemetry = null;

  function advanceGeneration() {
    return advanceQueryGeneration();
  }

  async function run(widgetsInput, runOptions = {}) {
    if (!Array.isArray(widgetsInput) || widgetsInput.length < 1) fail('STUDIO_SCALE_WIDGETS_REQUIRED');
    const widgets = widgetsInput.map(normalizeWidget);
    if (new Set(widgets.map((item) => item.widget_id)).size !== widgets.length) fail('STUDIO_SCALE_DUPLICATE_WIDGET_ID');
    const startGeneration = Number(getQueryGeneration());
    if (!Number.isInteger(startGeneration) || startGeneration < 1) fail('STUDIO_SCALE_GENERATION_INVALID');
    const startRevision = String(getRevision() || '');
    if (!HASH_RE.test(startRevision)) fail('STUDIO_SCALE_REVISION_INVALID');
    const startedAt = typeof runOptions.now_ms === 'function' ? runOptions.now_ms() : Date.now();
    const nowMs = typeof runOptions.now_ms === 'function' ? runOptions.now_ms : () => Date.now();
    const profile = String(runOptions.profile || 'CUSTOM');
    runSequence += 1;

    const states = new Array(widgets.length);
    const queue = [];
    let active = 0;
    let highWater = 0;
    let queryRequests = 0;
    let renderCommits = 0;
    let staleDiscards = 0;
    let downsamplePlans = 0;
    let virtualizedPlans = 0;
    let cursor = 0;

    for (const widget of widgets) {
      if (widget.visibility !== 'VISIBLE') {
        states[widget.index] = Object.freeze({
          widget_id: widget.widget_id,
          status: 'DEFERRED',
          reason: widget.visibility === 'HIDDEN' ? 'HIDDEN_NO_QUERY' : 'OFFSCREEN_NO_QUERY',
          render_committed: false,
          query_requested: false,
          presentation: null
        });
      } else {
        queue.push(widget);
      }
    }

    async function processWidget(widget) {
      active += 1;
      highWater = Math.max(highWater, active);
      queryRequests += 1;
      try {
        const execution = await executeQuery(widget.query, { generation: startGeneration });
        const generationStillCurrent = Number(getQueryGeneration()) === startGeneration;
        const revisionStillCurrent = String(getRevision()) === startRevision;
        if (!execution || execution.status === 'DISCARDED_STALE' || !generationStillCurrent || !revisionStillCurrent) {
          staleDiscards += 1;
          states[widget.index] = Object.freeze({
            widget_id: widget.widget_id,
            status: 'DISCARDED_STALE',
            reason: execution && execution.reason ? execution.reason : 'COORDINATOR_GENERATION_OR_REVISION_STALE',
            render_committed: false,
            query_requested: true,
            presentation: null
          });
          return;
        }
        const descriptor = resultDescriptor(execution);
        const presentation = planPresentation(descriptor, widget.presentation);
        if (presentation.mode === 'VIEW_ONLY_DOWNSAMPLE') downsamplePlans += 1;
        if (presentation.mode === 'VIRTUALIZED_ACCESSIBLE_TABLE') virtualizedPlans += 1;
        if (Number(getQueryGeneration()) !== startGeneration || String(getRevision()) !== startRevision) {
          staleDiscards += 1;
          states[widget.index] = Object.freeze({
            widget_id: widget.widget_id,
            status: 'DISCARDED_STALE',
            reason: 'PRE_RENDER_GENERATION_OR_REVISION_STALE',
            render_committed: false,
            query_requested: true,
            presentation
          });
          return;
        }
        const commit = await commitRender(widget, execution, presentation);
        if (Number(getQueryGeneration()) !== startGeneration || String(getRevision()) !== startRevision) {
          staleDiscards += 1;
          states[widget.index] = Object.freeze({
            widget_id: widget.widget_id,
            status: 'DISCARDED_STALE',
            reason: 'POST_RENDER_GENERATION_OR_REVISION_STALE',
            render_committed: false,
            query_requested: true,
            presentation
          });
          return;
        }
        if (!commit || commit.status !== 'COMMITTED') fail('STUDIO_SCALE_RENDER_COMMIT_INVALID');
        renderCommits += 1;
        states[widget.index] = Object.freeze({
          widget_id: widget.widget_id,
          status: 'READY',
          reason: execution.reason || 'OK',
          render_committed: true,
          query_requested: true,
          presentation
        });
      } finally {
        active -= 1;
      }
    }

    async function worker() {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= queue.length) return;
        await processWidget(queue[index]);
      }
    }

    await Promise.all(Array.from({ length: Math.min(maxConcurrency, queue.length || 1) }, () => worker()));
    const elapsed = Math.max(0, Number(nowMs()) - Number(startedAt));
    const deferred = widgets.length - queue.length;
    lastTelemetry = Object.freeze({
      schema: SCHEMA,
      version: VERSION,
      status: staleDiscards > 0 ? 'DEGRADED_STALE_DISCARDED' : 'PASS',
      reason: staleDiscards > 0 ? 'STALE_COMPLETION_DISCARDED' : 'OK',
      profile,
      generation: startGeneration,
      revision_hash_prefix: hashPrefix(startRevision),
      widget_count: widgets.length,
      visible_widgets: queue.length,
      deferred_widgets: deferred,
      query_requests: queryRequests,
      render_commits: renderCommits,
      stale_discards: staleDiscards,
      high_water_concurrency: highWater,
      downsample_plans: downsamplePlans,
      virtualized_plans: virtualizedPlans,
      elapsed_ms: elapsed
    });
    if (JSON.stringify(Object.keys(lastTelemetry).sort()) !== JSON.stringify(CONTRACT.telemetry_allowlist.slice().sort())) {
      fail('STUDIO_SCALE_TELEMETRY_CONTRACT_MISMATCH');
    }
    return Object.freeze({
      schema: SCHEMA,
      contract_version: VERSION,
      run_id: runSequence,
      generation: startGeneration,
      revision: startRevision,
      states: Object.freeze(states.slice()),
      telemetry: lastTelemetry,
      financial_write: false,
      query_semantics_changed: false,
      canonical_result_mutated: false
    });
  }

  return Object.freeze({
    schema: SCHEMA,
    contract_version: VERSION,
    run,
    advanceGeneration,
    getTelemetry: () => lastTelemetry,
    capabilities: Object.freeze({
      lazy_visibility: true,
      bounded_concurrency: true,
      perf070_delegation: true,
      stale_discard: true,
      presentation_only_high_density: true,
      financial_write: false,
      query_authority: false
    })
  });
}

module.exports = Object.freeze({
  SCHEMA,
  VERSION,
  CONTRACT,
  assertContract,
  planPresentation,
  createStudioScaleCoordinator
});
