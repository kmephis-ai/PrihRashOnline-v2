'use strict';

const crypto = require('crypto');
const CONTRACT = require('./dashboard_drill.v1.json');
const FACTORY = require('./widget_factory');
const EXPLORATION = require('../analytics/exploration_state');
const VIZ = require('../visualization/visualization_foundation');
const SCOPE = require('../analytics/analytics_scope');
const TX = require('../explorer/transaction_explorer');
const KPI = require('../finance/kpi_dictionary');
const { validateCanonicalCollection } = require('../domain/canonical_transaction');

const SCHEMA = 'PRH_DASHBOARD_DRILL_V1';
const VERSION = '1.0.0';
const HIERARCHY_SCHEMA = 'PRH_DASHBOARD_DRILL_HIERARCHY_REGISTRY_V1';
const STATE_SCHEMA = 'PRH_DASHBOARD_DRILL_STATE_V1';
const ACTION_SCHEMA = 'PRH_DASHBOARD_DRILL_ACTION_V1';
const SESSION_SCHEMA = 'PRH_DASHBOARD_DRILL_SESSION_V1';
const REQUEST_SCHEMA = 'PRH_DASHBOARD_DRILL_THROUGH_REQUEST_V1';
const RECONCILIATION_SCHEMA = 'PRH_DASHBOARD_DRILL_RECONCILIATION_V1';
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TIME_LEVELS = Object.freeze(CONTRACT.time_hierarchy.levels.slice());
const SUPPORTED_MEASURES = Object.freeze(CONTRACT.supported_reconciliation_measures.slice());

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function exactKeys(value, keys, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(keys.slice().sort())) fail(reason);
  return value;
}

function safeId(value, reason) {
  const text = String(value == null ? '' : value).trim();
  if (!ID_RE.test(text)) fail(reason);
  return text;
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'DASH-083' ||
      CONTRACT.hierarchy_registry_schema !== HIERARCHY_SCHEMA || CONTRACT.drill_state_schema !== STATE_SCHEMA ||
      CONTRACT.action_schema !== ACTION_SCHEMA || CONTRACT.request_schema !== REQUEST_SCHEMA ||
      CONTRACT.reconciliation_schema !== RECONCILIATION_SCHEMA) fail('DASH083_CONTRACT_INVALID');
  FACTORY.assertContract();
  EXPLORATION.assertContract();
  VIZ.assertContract();
  SCOPE.assertScopeContract();
  KPI.validateDictionary();
  const upstream = CONTRACT.upstream || {};
  if (upstream.widget_factory !== `${FACTORY.SCHEMA}@${FACTORY.VERSION}` ||
      upstream.exploration_state !== `${EXPLORATION.SCHEMA}@${EXPLORATION.VERSION}` ||
      upstream.filter_context !== `${VIZ.FILTER_CONTEXT_SCHEMA}@${VIZ.VERSION}` ||
      upstream.drill_context !== `${VIZ.DRILL_CONTEXT_SCHEMA}@${VIZ.VERSION}` ||
      upstream.transaction_explorer !== `${TX.CONTRACT.schema}@${TX.CONTRACT.version}` ||
      upstream.kpi_dictionary !== `${KPI.KPI_SCHEMA}@${KPI.DICTIONARY.version}` ||
      upstream.financial_truth_policy !== 'FIN-TRUTH-v1') fail('DASH083_UPSTREAM_CONTRACT_INVALID');
  if (!CONTRACT.authority || Object.values(CONTRACT.authority).some((value) => value !== false)) fail('DASH083_AUTHORITY_INVALID');
  const p = CONTRACT.principles || {};
  if (p.configuration_orchestration_only !== true || p.financial_truth_redefined !== false ||
      p.transaction_query_semantics_redefined !== false || p.exploration_history_redefined !== false ||
      p.navigation_financial_payload_allowed !== false || p.private_runtime_rows_public_evidence !== false ||
      p.reconciliation_uses_kpi_authority !== true || p.reconciliation_mismatch_fail_closed !== true ||
      p.financial_write !== false || p.free_only !== true) fail('DASH083_BOUNDARY_INVALID');
  return true;
}

function rawFactoryPresentation(binding) {
  const p = binding.presentation;
  if ((binding.kind === 'KPI' || binding.kind === 'CARD') && p && p.mode === binding.kind) {
    return { schema: p.schema, contract_version: p.contract_version, title: p.title, show_comparison: p.show_comparison };
  }
  return p;
}

function normalizeBoundDescriptor(input) {
  exactKeys(input, ['schema', 'contract_version', 'widget_id', 'semantic_binding_status', 'layout_identity_authority', 'geometry_mutation', 'binding'], 'DASH083_BOUND_DESCRIPTOR_SHAPE_INVALID');
  if (input.schema !== FACTORY.BOUND_DESCRIPTOR_SCHEMA || input.contract_version !== FACTORY.VERSION ||
      input.semantic_binding_status !== 'BOUND' || input.layout_identity_authority !== false || input.geometry_mutation !== false) {
    fail('DASH083_BOUND_DESCRIPTOR_INVALID');
  }
  const raw = input.binding;
  if (!raw || typeof raw !== 'object') fail('DASH083_BINDING_INVALID');
  const normalized = FACTORY.normalizeBinding({
    schema: raw.schema,
    contract_version: raw.contract_version,
    widget_id: raw.widget_id,
    kind: raw.kind,
    query: raw.query,
    presentation: rawFactoryPresentation(raw)
  });
  if (stableStringify(normalized) !== stableStringify(raw)) fail('DASH083_BINDING_DERIVED_STATE_MISMATCH');
  if (input.widget_id !== normalized.widget_id) fail('DASH083_BOUND_DESCRIPTOR_ID_MISMATCH');
  return deepFreeze({ ...input, binding: normalized });
}

function normalizeHierarchyRegistry(input) {
  assertContract();
  exactKeys(input, ['schema', 'contract_version', 'hierarchies'], 'DASH083_HIERARCHY_REGISTRY_SHAPE_INVALID');
  if (input.schema !== HIERARCHY_SCHEMA || input.contract_version !== VERSION || !Array.isArray(input.hierarchies)) {
    fail('DASH083_HIERARCHY_REGISTRY_VERSION_INVALID');
  }
  const allowedIds = new Set(CONTRACT.runtime_hierarchies.ids);
  const seen = new Set();
  const hierarchies = input.hierarchies.map((raw) => {
    exactKeys(raw, ['id', 'dimension', 'levels', 'nodes'], 'DASH083_HIERARCHY_SHAPE_INVALID');
    const id = String(raw.id || '').toUpperCase();
    if (!allowedIds.has(id) || seen.has(id)) fail('DASH083_HIERARCHY_ID_INVALID');
    seen.add(id);
    const dimension = CONTRACT.runtime_hierarchies.dimensions[id];
    if (raw.dimension !== dimension) fail('DASH083_HIERARCHY_DIMENSION_INVALID');
    if (!Array.isArray(raw.levels) || raw.levels.length < 2 || raw.levels.length > CONTRACT.runtime_hierarchies.max_levels) {
      fail('DASH083_HIERARCHY_LEVELS_INVALID');
    }
    const levels = raw.levels.map((level) => safeId(level, 'DASH083_HIERARCHY_LEVEL_INVALID'));
    if (new Set(levels).size !== levels.length) fail('DASH083_HIERARCHY_LEVEL_DUPLICATE');
    if (!Array.isArray(raw.nodes) || raw.nodes.length < 1 || raw.nodes.length > CONTRACT.runtime_hierarchies.max_nodes) {
      fail('DASH083_HIERARCHY_NODES_INVALID');
    }
    const nodeIds = new Set();
    const nodes = raw.nodes.map((node) => {
      exactKeys(node, ['node_id', 'level', 'parent_id'], 'DASH083_HIERARCHY_NODE_SHAPE_INVALID');
      const nodeId = safeId(node.node_id, 'DASH083_HIERARCHY_NODE_ID_INVALID');
      if (nodeIds.has(nodeId)) fail('DASH083_HIERARCHY_NODE_DUPLICATE');
      nodeIds.add(nodeId);
      const level = safeId(node.level, 'DASH083_HIERARCHY_NODE_LEVEL_INVALID');
      const index = levels.indexOf(level);
      if (index < 0) fail('DASH083_HIERARCHY_NODE_LEVEL_UNKNOWN');
      const parentId = node.parent_id == null ? null : safeId(node.parent_id, 'DASH083_HIERARCHY_PARENT_INVALID');
      if (index === 0 && parentId !== null) fail('DASH083_HIERARCHY_ROOT_PARENT_FORBIDDEN');
      if (index > 0 && parentId === null) fail('DASH083_HIERARCHY_PARENT_REQUIRED');
      return { node_id: nodeId, level, parent_id: parentId };
    });
    const byId = new Map(nodes.map((node) => [node.node_id, node]));
    for (const node of nodes) {
      const index = levels.indexOf(node.level);
      if (index === 0) continue;
      const parent = byId.get(node.parent_id);
      if (!parent || levels.indexOf(parent.level) !== index - 1) fail('DASH083_HIERARCHY_PARENT_LEVEL_INVALID');
    }
    nodes.sort((a, b) => a.node_id.localeCompare(b.node_id));
    return deepFreeze({ id, dimension, levels: Object.freeze(levels), nodes: Object.freeze(nodes) });
  }).sort((a, b) => a.id.localeCompare(b.id));
  const body = deepFreeze({ schema: HIERARCHY_SCHEMA, contract_version: VERSION, hierarchies: Object.freeze(hierarchies) });
  return deepFreeze({ ...body, registry_hash: sha256(stableStringify(body)) });
}

function hierarchy(registry, hierarchyId) {
  const id = String(hierarchyId || '').toUpperCase();
  if (id === 'TIME') return deepFreeze({
    id: 'TIME', dimension: 'time_bucket', levels: Object.freeze(TIME_LEVELS.slice()), nodes: null
  });
  const found = registry.hierarchies.find((item) => item.id === id);
  if (!found) fail('DASH083_HIERARCHY_UNKNOWN');
  return found;
}

function hierarchyTransition(registry, hierarchyId, fromLevel, toLevel) {
  const h = hierarchy(registry, hierarchyId);
  const from = String(fromLevel || '');
  const to = String(toLevel || '');
  const fromIndex = h.levels.indexOf(from);
  const toIndex = h.levels.indexOf(to);
  if (fromIndex < 0 || toIndex < 0) fail('DASH083_HIERARCHY_LEVEL_UNKNOWN');
  if (toIndex !== fromIndex + 1) fail('DASH083_HIERARCHY_TRANSITION_INVALID');
  return h;
}

function isoDay(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function timeSelectionWindow(level, selection) {
  const text = String(selection || '');
  let m;
  if (level === 'YEAR' && (m = /^(\d{4})$/.exec(text))) {
    const y = Number(m[1]); return { start: `${m[1]}-01-01`, end: `${y + 1}-01-01` };
  }
  if (level === 'QUARTER' && (m = /^(\d{4})-Q([1-4])$/.exec(text))) {
    const y = Number(m[1]); const q = Number(m[2]); const month = (q - 1) * 3 + 1;
    const nextMonth = month + 3;
    return { start: isoDay(y, month, 1), end: nextMonth > 12 ? isoDay(y + 1, 1, 1) : isoDay(y, nextMonth, 1) };
  }
  if (level === 'MONTH' && (m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(text))) {
    const y = Number(m[1]); const month = Number(m[2]);
    return { start: isoDay(y, month, 1), end: month === 12 ? isoDay(y + 1, 1, 1) : isoDay(y, month + 1, 1) };
  }
  if (level === 'DAY' && /^(\d{4})-(\d{2})-(\d{2})$/.test(text)) {
    const d = new Date(`${text}T00:00:00Z`);
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== text) fail('DASH083_TIME_SELECTION_INVALID');
    const next = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);
    return { start: text, end: next };
  }
  fail('DASH083_TIME_SELECTION_INVALID');
}

function descendantLeaves(h, nodeId) {
  const leafLevel = h.levels[h.levels.length - 1];
  const byParent = new Map();
  for (const node of h.nodes) {
    if (node.parent_id == null) continue;
    if (!byParent.has(node.parent_id)) byParent.set(node.parent_id, []);
    byParent.get(node.parent_id).push(node);
  }
  const start = h.nodes.find((node) => node.node_id === nodeId);
  if (!start) fail('DASH083_HIERARCHY_SELECTION_UNKNOWN');
  const leaves = [];
  const stack = [start];
  while (stack.length) {
    const node = stack.pop();
    if (node.level === leafLevel) leaves.push(node.node_id);
    else (byParent.get(node.node_id) || []).forEach((child) => stack.push(child));
  }
  leaves.sort();
  if (leaves.length < 1 || leaves.length > CONTRACT.limits.max_descendant_leaf_ids) fail('DASH083_HIERARCHY_DESCENDANTS_INVALID');
  return Object.freeze(leaves);
}

function emptyRawFilterContext() {
  return { schema: VIZ.FILTER_CONTEXT_SCHEMA, contract_version: VIZ.VERSION, filters: [] };
}

function rawFilterContext(normalized) {
  return {
    schema: normalized.schema,
    contract_version: normalized.contract_version,
    filters: normalized.filters.map((item) => ({ kind: item.kind, field: item.field, operator: item.operator, values: item.values.slice() }))
  };
}

function drillFilterForSelection(h, selectionId) {
  if (h.id === 'TIME') {
    return VIZ.normalizeFilterContext({
      schema: VIZ.FILTER_CONTEXT_SCHEMA,
      contract_version: VIZ.VERSION,
      filters: [{ kind: 'DIMENSION', field: 'time_bucket', operator: 'INCLUDE', values: [selectionId] }]
    });
  }
  const leaves = descendantLeaves(h, selectionId);
  return VIZ.normalizeFilterContext({
    schema: VIZ.FILTER_CONTEXT_SCHEMA,
    contract_version: VIZ.VERSION,
    filters: [{ kind: 'DIMENSION', field: h.dimension, operator: 'INCLUDE', values: leaves.slice() }]
  });
}

function normalizeAction(input) {
  exactKeys(input, ['schema', 'contract_version', 'action', 'source_widget_id', 'hierarchy_id', 'from_level', 'to_level', 'selection_id', 'measure_id'], 'DASH083_ACTION_SHAPE_INVALID');
  if (input.schema !== ACTION_SCHEMA || input.contract_version !== VERSION) fail('DASH083_ACTION_VERSION_INVALID');
  const action = String(input.action || '').toUpperCase();
  if (!CONTRACT.drill_actions.includes(action)) fail('DASH083_ACTION_INVALID');
  if (action === 'BACK' || action === 'RESET') {
    if ([input.source_widget_id, input.hierarchy_id, input.from_level, input.to_level, input.selection_id, input.measure_id].some((value) => value != null)) {
      fail('DASH083_SYSTEM_ACTION_SHAPE_INVALID');
    }
    return deepFreeze({ schema: ACTION_SCHEMA, contract_version: VERSION, action, source_widget_id: null, hierarchy_id: null, from_level: null, to_level: null, selection_id: null, measure_id: null });
  }
  const sourceWidgetId = safeId(input.source_widget_id, 'DASH083_SOURCE_WIDGET_INVALID');
  const hierarchyId = String(input.hierarchy_id || '').toUpperCase();
  const fromLevel = safeId(input.from_level, 'DASH083_FROM_LEVEL_INVALID');
  const toLevel = action === 'DOWN' ? safeId(input.to_level, 'DASH083_TO_LEVEL_INVALID') : null;
  if (action === 'THROUGH' && input.to_level != null) fail('DASH083_THROUGH_TO_LEVEL_FORBIDDEN');
  const selectionId = safeId(input.selection_id, 'DASH083_SELECTION_INVALID');
  const measureId = String(input.measure_id || '').toUpperCase();
  if (!SUPPORTED_MEASURES.includes(measureId)) fail('DASH083_MEASURE_UNSUPPORTED');
  return deepFreeze({ schema: ACTION_SCHEMA, contract_version: VERSION, action, source_widget_id: sourceWidgetId, hierarchy_id: hierarchyId, from_level: fromLevel, to_level: toLevel, selection_id: selectionId, measure_id: measureId });
}

function ensureSourceCompatibility(bound, h, action) {
  const q = bound.binding.query;
  if (!q.measures.includes(action.measure_id)) fail('DASH083_SOURCE_MEASURE_NOT_BOUND');
  if (h.id === 'TIME') {
    if (q.grain === 'NONE') fail('DASH083_SOURCE_TIME_NOT_BOUND');
  } else if (!q.dimensions.includes(h.dimension)) {
    fail('DASH083_SOURCE_DIMENSION_NOT_BOUND');
  }
}

function stateBody(input) {
  return {
    schema: STATE_SCHEMA,
    contract_version: VERSION,
    source_widget_id: input.source_widget_id,
    hierarchy_id: input.hierarchy_id,
    level: input.level,
    selection_id: input.selection_id,
    measure_id: input.measure_id,
    time_window: input.time_window,
    drill_context_hash: input.drill_context_hash
  };
}

function makeState(input) {
  const body = deepFreeze(stateBody(input));
  return deepFreeze({ ...body, drill_hash: sha256(stableStringify(body)) });
}

function normalizeState(input) {
  if (input == null) return null;
  exactKeys(input, ['schema', 'contract_version', 'source_widget_id', 'hierarchy_id', 'level', 'selection_id', 'measure_id', 'time_window', 'drill_context_hash', 'drill_hash'], 'DASH083_STATE_SHAPE_INVALID');
  if (input.schema !== STATE_SCHEMA || input.contract_version !== VERSION) fail('DASH083_STATE_VERSION_INVALID');
  const body = stateBody(input);
  const normalized = makeState(body);
  if (normalized.drill_hash !== input.drill_hash) fail('DASH083_STATE_HASH_MISMATCH');
  return normalized;
}

function makeSession(explorationSession, present, history) {
  const body = deepFreeze({
    schema: SESSION_SCHEMA,
    contract_version: VERSION,
    exploration_session: EXPLORATION.normalizeSession(explorationSession),
    present: normalizeState(present),
    history: Object.freeze(history.map(normalizeState))
  });
  return deepFreeze({ ...body, session_hash: sha256(stableStringify(body)) });
}

function createSession(explorationSession = EXPLORATION.createSession()) {
  return makeSession(explorationSession, null, []);
}

function normalizeSession(input) {
  exactKeys(input, ['schema', 'contract_version', 'exploration_session', 'present', 'history', 'session_hash'], 'DASH083_SESSION_SHAPE_INVALID');
  if (input.schema !== SESSION_SCHEMA || input.contract_version !== VERSION || !Array.isArray(input.history)) fail('DASH083_SESSION_VERSION_INVALID');
  const normalized = makeSession(input.exploration_session, input.present, input.history);
  if (normalized.session_hash !== input.session_hash) fail('DASH083_SESSION_HASH_MISMATCH');
  return normalized;
}

function nextMetadata(session, nextState) {
  const history = session.history.slice();
  if (stableStringify(session.present) !== stableStringify(nextState)) history.push(session.present);
  return { present: nextState, history };
}

function rawDrillContext(widgetId, filterContext, target = 'DETAILS') {
  return {
    schema: VIZ.DRILL_CONTEXT_SCHEMA,
    contract_version: VIZ.VERSION,
    source_widget_id: widgetId,
    target,
    filter_context: rawFilterContext(filterContext)
  };
}

function dispatch(sessionInput, boundInput, registryInput, actionInput) {
  assertContract();
  const session = normalizeSession(sessionInput);
  const action = normalizeAction(actionInput);
  if (action.action === 'BACK') {
    const exploration = EXPLORATION.dispatch(session.exploration_session, { type: 'BACK' });
    if (session.history.length === 0) return makeSession(exploration, session.present, []);
    return makeSession(exploration, session.history[session.history.length - 1], session.history.slice(0, -1));
  }
  if (action.action === 'RESET') {
    const exploration = EXPLORATION.dispatch(session.exploration_session, { type: 'RESET' });
    const meta = nextMetadata(session, null);
    return makeSession(exploration, meta.present, meta.history);
  }
  const bound = normalizeBoundDescriptor(boundInput);
  if (bound.widget_id !== action.source_widget_id) fail('DASH083_SOURCE_WIDGET_MISMATCH');
  const registry = normalizeHierarchyRegistry(registryInput);
  const h = hierarchy(registry, action.hierarchy_id);
  ensureSourceCompatibility(bound, h, action);

  if (action.action === 'DOWN') hierarchyTransition(registry, h.id, action.from_level, action.to_level);
  else if (!h.levels.includes(action.from_level)) fail('DASH083_HIERARCHY_LEVEL_UNKNOWN');

  if (session.present) {
    if (session.present.source_widget_id !== action.source_widget_id || session.present.hierarchy_id !== h.id || session.present.level !== action.from_level) {
      fail('DASH083_DRILL_CONTINUITY_INVALID');
    }
    if (h.id !== 'TIME') {
      const selected = h.nodes.find((node) => node.node_id === action.selection_id);
      if (!selected || selected.level !== action.from_level || selected.parent_id !== session.present.selection_id) fail('DASH083_DRILL_SELECTION_NOT_CHILD');
    } else if (session.present.time_window) {
      const childWindow = timeSelectionWindow(action.from_level, action.selection_id);
      if (childWindow.start < session.present.time_window.start || childWindow.end > session.present.time_window.end) fail('DASH083_TIME_DRILL_OUTSIDE_PARENT');
    }
  } else if (h.id === 'TIME') {
    if (bound.binding.query.grain !== action.from_level) fail('DASH083_INITIAL_TIME_LEVEL_MISMATCH');
  } else {
    const selected = h.nodes.find((node) => node.node_id === action.selection_id);
    if (!selected || selected.level !== action.from_level || h.levels.indexOf(action.from_level) !== 0) fail('DASH083_INITIAL_HIERARCHY_SELECTION_INVALID');
  }

  const selectionFilter = drillFilterForSelection(h, action.selection_id);
  const target = action.action === 'THROUGH' ? 'TRANSACTION_EXPLORER' : 'DETAILS';
  const drillContext = VIZ.normalizeDrillContext(rawDrillContext(bound.widget_id, selectionFilter, target));
  const before = session.exploration_session.present;
  const exploration = EXPLORATION.dispatch(session.exploration_session, {
    type: 'SET_DRILL_CONTEXT',
    drill_context: rawDrillContext(bound.widget_id, selectionFilter, target)
  });
  if (stableStringify(exploration.present.global_context) !== stableStringify(before.global_context) ||
      stableStringify(exploration.present.widget_contexts) !== stableStringify(before.widget_contexts)) {
    fail('DASH083_EXPLORATION_CONTEXT_MUTATION_DETECTED');
  }
  const period = h.id === 'TIME' ? timeSelectionWindow(action.from_level, action.selection_id) : (session.present ? session.present.time_window : null);
  const nextLevel = action.action === 'DOWN' ? action.to_level : action.from_level;
  const next = makeState({
    source_widget_id: bound.widget_id,
    hierarchy_id: h.id,
    level: nextLevel,
    selection_id: action.selection_id,
    measure_id: action.measure_id,
    time_window: period,
    drill_context_hash: drillContext.context_hash
  });
  const meta = nextMetadata(session, next);
  return makeSession(exploration, meta.present, meta.history);
}

function sourceQueryFilterContext(query) {
  const filters = (query.filters || []).map((item) => ({
    kind: 'DIMENSION',
    field: item.field,
    operator: 'INCLUDE',
    values: item.values.slice()
  }));
  return VIZ.normalizeFilterContext({ schema: VIZ.FILTER_CONTEXT_SCHEMA, contract_version: VIZ.VERSION, filters });
}

function intersectWindow(left, right) {
  if (!left && !right) return null;
  if (!left) return { start: right.start, end: right.end };
  if (!right) return { start: left.start, end: left.end };
  const start = left.start > right.start ? left.start : right.start;
  const end = left.end < right.end ? left.end : right.end;
  if (start >= end) fail('DASH083_TIME_WINDOW_CONTRADICTION');
  return { start, end };
}

function txIncludes(filters, field) {
  const includes = filters.filter((item) => item.field === field && item.operator === 'INCLUDE');
  if (includes.length === 0) return [];
  let values = new Set(includes[0].values);
  for (const item of includes.slice(1)) values = new Set([...values].filter((value) => item.values.includes(value)));
  return [...values].sort();
}

function buildDrillThroughRequest(sessionInput, boundInput) {
  const session = normalizeSession(sessionInput);
  const bound = normalizeBoundDescriptor(boundInput);
  const state = session.present;
  if (!state || state.source_widget_id !== bound.widget_id) fail('DASH083_DRILL_STATE_REQUIRED');
  if (!SUPPORTED_MEASURES.includes(state.measure_id)) fail('DASH083_MEASURE_UNSUPPORTED');
  const effective = EXPLORATION.effectiveWidgetContext(session.exploration_session.present, bound.widget_id);
  const drill = EXPLORATION.effectiveDrillContext(session.exploration_session.present);
  const drillFilters = drill ? drill.filter_context : VIZ.normalizeFilterContext(emptyRawFilterContext());
  const sourceFilters = sourceQueryFilterContext(bound.binding.query);
  const merged = EXPLORATION.mergeFilterContexts(rawFilterContext(effective.filter_context), rawFilterContext(sourceFilters), rawFilterContext(drillFilters));
  const mergedRaw = rawFilterContext(merged);
  const qRange = bound.binding.query.time_range ? { start: bound.binding.query.time_range.start, end: bound.binding.query.time_range.end } : null;
  const period = intersectWindow(qRange, state.time_window);
  const txQuery = TX.normalizeQuery({
    date_from: period ? period.start : null,
    date_to: period ? period.end : null,
    account_ids: txIncludes(merged.filters, 'account_id'),
    category_ids: txIncludes(merged.filters, 'category_id'),
    member_ids: txIncludes(merged.filters, 'member_id'),
    types: txIncludes(merged.filters, 'type'),
    statuses: txIncludes(merged.filters, 'status'),
    text: '',
    sort: { field: 'occurred_at', direction: 'DESC' },
    offset: 0,
    limit: CONTRACT.limits.transaction_page_limit
  });
  const body = deepFreeze({
    schema: REQUEST_SCHEMA,
    contract_version: VERSION,
    source_widget_id: bound.widget_id,
    measure_id: state.measure_id,
    currency: bound.binding.query.currency,
    period,
    scope_spec: effective.scope_spec,
    filter_context: mergedRaw,
    tx_query: {
      date_from: txQuery.date_from,
      date_to: txQuery.date_to,
      account_ids: txQuery.account_ids.slice(),
      category_ids: txQuery.category_ids.slice(),
      member_ids: txQuery.member_ids.slice(),
      types: txQuery.types.slice(),
      statuses: txQuery.statuses.slice(),
      text: txQuery.text,
      sort: { field: txQuery.sort.field, direction: txQuery.sort.direction },
      offset: 0,
      limit: txQuery.limit
    },
    context_hash: merged.context_hash,
    drill_hash: state.drill_hash
  });
  return deepFreeze({ ...body, request_hash: sha256(stableStringify(body)) });
}

function normalizeRequest(input) {
  exactKeys(input, ['schema', 'contract_version', 'source_widget_id', 'measure_id', 'currency', 'period', 'scope_spec', 'filter_context', 'tx_query', 'context_hash', 'drill_hash', 'request_hash'], 'DASH083_REQUEST_SHAPE_INVALID');
  if (input.schema !== REQUEST_SCHEMA || input.contract_version !== VERSION || !SUPPORTED_MEASURES.includes(input.measure_id)) fail('DASH083_REQUEST_INVALID');
  const merged = VIZ.normalizeFilterContext(input.filter_context);
  if (merged.context_hash !== input.context_hash) fail('DASH083_REQUEST_CONTEXT_HASH_MISMATCH');
  SCOPE.normalizeScopeSpec(input.scope_spec);
  TX.normalizeQuery(input.tx_query);
  const body = { ...input }; delete body.request_hash;
  if (sha256(stableStringify(body)) !== input.request_hash) fail('DASH083_REQUEST_HASH_MISMATCH');
  return input;
}

function fieldValues(tx, field) {
  if (field === 'tag') return tx.tags;
  const value = tx[field];
  return value == null ? [null] : [String(value)];
}

function filterByContext(transactions, filterContext) {
  const context = VIZ.normalizeFilterContext(filterContext);
  return transactions.filter((tx) => context.filters.every((item) => {
    if (item.field === 'time_bucket') return true;
    const values = fieldValues(tx, item.field);
    const hit = values.some((value) => item.values.includes(value));
    return item.operator === 'INCLUDE' ? hit : !hit;
  }));
}

function collectTxSelection(inputs, txQueryInput) {
  const canonical = validateCanonicalCollection(inputs);
  const base = TX.normalizeQuery(txQueryInput);
  const first = TX.exploreTransactions(canonical, { ...txQueryInput, offset: 0, limit: CONTRACT.limits.transaction_page_limit }, () => 0);
  if (first.matched_count > CONTRACT.limits.max_reconciliation_matches) fail('DASH083_RECONCILIATION_MATCH_LIMIT_EXCEEDED');
  const ids = [];
  for (let offset = 0; offset < first.matched_count; offset += CONTRACT.limits.transaction_page_limit) {
    const page = TX.exploreTransactions(canonical, { ...txQueryInput, offset, limit: CONTRACT.limits.transaction_page_limit }, () => 0);
    page.rows.forEach((row) => ids.push(row.transaction_id));
  }
  const byId = new Map(canonical.map((tx) => [tx.transaction_id, tx]));
  const selected = ids.map((id) => byId.get(id));
  if (selected.some((tx) => !tx) || selected.length !== first.matched_count) fail('DASH083_TX_SELECTION_IDENTITY_MISMATCH');
  return { query: base, transactions: selected, first_page: first };
}

function reconcileDrillThrough(transactionsInput, scopeAssignmentsInput, requestInput, expectedTotalMinor) {
  assertContract();
  const request = normalizeRequest(requestInput);
  if (!Number.isSafeInteger(expectedTotalMinor)) fail('DASH083_EXPECTED_TOTAL_INVALID');
  const canonical = validateCanonicalCollection(transactionsInput);
  const assignments = scopeAssignmentsInput == null ? SCOPE.emptyAssignments() : scopeAssignmentsInput;
  const scoped = SCOPE.applyAnalyticsScope(canonical, assignments, request.scope_spec).transactions;
  const contextFiltered = filterByContext(scoped, request.filter_context);
  const selected = collectTxSelection(contextFiltered, request.tx_query);
  const fin = KPI.evaluateKpi(request.measure_id, selected.transactions, { currency: request.currency });
  const match = fin.value_minor === expectedTotalMinor;
  const body = deepFreeze({
    schema: RECONCILIATION_SCHEMA,
    contract_version: VERSION,
    request_hash: request.request_hash,
    measure_id: request.measure_id,
    currency: request.currency,
    expected_total_minor: expectedTotalMinor,
    actual_total_minor: fin.value_minor,
    result_count: selected.transactions.length,
    status: match ? 'PASS' : 'MISMATCH',
    reason: match ? 'OK' : 'DASH083_TOTAL_RECONCILIATION_MISMATCH',
    financial_truth_policy: fin.financial_truth_policy,
    kpi_dictionary_version: fin.dictionary_version,
    rows_reconciled: match,
    financial_write_authorized: false
  });
  return deepFreeze({ ...body, reconciliation_hash: sha256(stableStringify(body)), explorer_result: match ? selected.first_page : null });
}

function telemetry(action, result) {
  const session = result && result.schema === SESSION_SCHEMA ? result : null;
  const request = result && result.schema === REQUEST_SCHEMA ? result : null;
  const receipt = result && result.schema === RECONCILIATION_SCHEMA ? result : null;
  const output = Object.freeze({
    schema: SCHEMA,
    version: VERSION,
    action: String(action || 'NONE'),
    widget_hash_prefix: sha256(session?.present?.source_widget_id || request?.source_widget_id || '').slice(0, 12),
    context_hash_prefix: String(request?.context_hash || '').slice(0, 12),
    drill_hash_prefix: String(session?.present?.drill_hash || request?.drill_hash || '').slice(0, 12),
    request_hash_prefix: String(request?.request_hash || receipt?.request_hash || '').slice(0, 12),
    result_count: receipt?.result_count == null ? 0 : receipt.result_count,
    decision: receipt ? (receipt.status === 'PASS' ? 'PASS' : 'DENY') : 'APPLIED',
    reason: receipt ? receipt.reason : 'OK'
  });
  if (JSON.stringify(Object.keys(output).sort()) !== JSON.stringify(CONTRACT.telemetry_allowlist.slice().sort())) fail('DASH083_TELEMETRY_SHAPE_INVALID');
  return output;
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  HIERARCHY_SCHEMA,
  STATE_SCHEMA,
  ACTION_SCHEMA,
  SESSION_SCHEMA,
  REQUEST_SCHEMA,
  RECONCILIATION_SCHEMA,
  assertContract,
  normalizeHierarchyRegistry,
  timeSelectionWindow,
  createSession,
  normalizeSession,
  normalizeAction,
  dispatch,
  buildDrillThroughRequest,
  reconcileDrillThrough,
  telemetry
});
