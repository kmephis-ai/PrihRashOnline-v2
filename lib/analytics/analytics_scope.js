'use strict';

const CONTRACT = require('./analytics_scope.v1.json');
const ANALYTICS = require('./analytics_contract.v1.json');
const SEMANTIC = require('./semantic_registry.v1.json');
const { validateCanonicalCollection } = require('../domain/canonical_transaction');
const { evaluateAnalytics } = require('./analytics_engine');

const SCHEMA = 'PRH_ANALYTICS_SCOPE_V1';
const VERSION = '1.0.0';
const ASSIGNMENTS_SCHEMA = 'PRH_ANALYTICS_SCOPE_ASSIGNMENTS_V1';
const SPEC_SCHEMA = 'PRH_ANALYTICS_SCOPE_SPEC_V1';
const SYSTEM_TAGS = Object.freeze(Object.keys(CONTRACT.system_tags));
const SCOPE_ID_RE = /^[A-Z][A-Z0-9_]{2,63}$/;

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function exactKeys(value, keys, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(reason);
  return value;
}

function setEqual(left, right) {
  return JSON.stringify(Array.from(left).slice().sort()) === JSON.stringify(Array.from(right).slice().sort());
}

function normalizeSystemTags(value, reason) {
  if (!Array.isArray(value)) fail(reason);
  const tags = value.map((item) => String(item || '').trim());
  if (tags.some((tag) => !SYSTEM_TAGS.includes(tag))) fail('SCOPE_SYSTEM_TAG_UNKNOWN');
  if (new Set(tags).size !== tags.length) fail('SCOPE_SYSTEM_TAG_DUPLICATE');
  return Object.freeze(tags.slice().sort());
}

function assertScopeContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION ||
      CONTRACT.assignments_schema !== ASSIGNMENTS_SCHEMA || CONTRACT.roadmap_id !== 'SCOPE-070') {
    fail('SCOPE_CONTRACT_VERSION_INVALID');
  }
  if (!CONTRACT.upstream ||
      CONTRACT.upstream.analytics_contract !== `${ANALYTICS.schema}@${ANALYTICS.version}` ||
      CONTRACT.upstream.semantic_registry !== `${SEMANTIC.schema}@${SEMANTIC.version}` ||
      CONTRACT.upstream.canonical_transaction !== 'PRH_CANONICAL_TRANSACTION_V1' ||
      CONTRACT.upstream.financial_truth_policy !== 'FIN-TRUTH-v1') {
    fail('SCOPE_UPSTREAM_CONTRACT_INVALID');
  }
  const principles = CONTRACT.principles || {};
  if (principles.canonical_truth_mutated !== false ||
      principles.canonical_user_tags_authoritative_for_system_scope !== false ||
      principles.system_assignments_separate_overlay !== true ||
      principles.assignment_overlay_private_by_default !== true ||
      principles.scope_spec_contains_private_ids !== false ||
      principles.deny_wins !== true || principles.renderer_neutral !== true ||
      principles.storage_neutral !== true || principles.free_only !== true) {
    fail('SCOPE_BOUNDARY_INVALID');
  }
  if (!CONTRACT.authorities || Object.values(CONTRACT.authorities).some((value) => value !== false)) {
    fail('SCOPE_AUTHORITY_INVALID');
  }
  if (!setEqual(SYSTEM_TAGS, ['EXCLUDE_FROM_ANALYSIS', 'EMERGENCY_FUND'])) {
    fail('SCOPE_SYSTEM_TAG_REGISTRY_INVALID');
  }
  for (const tag of SYSTEM_TAGS) {
    const definition = CONTRACT.system_tags[tag];
    if (definition.protected !== true ||
        !setEqual(definition.assignment_levels || [], ['ACCOUNT', 'TRANSACTION']) ||
        definition.canonical_user_tag_collision_authoritative !== false) {
      fail('SCOPE_SYSTEM_TAG_DEFINITION_INVALID');
    }
  }
  const builtins = CONTRACT.built_in_scopes || {};
  if (!builtins.ALL_CANONICAL || !builtins.DEFAULT_ANALYSIS || !builtins.EMERGENCY_FUND_ONLY ||
      builtins.ALL_CANONICAL.include_any_system_tags.length !== 0 || builtins.ALL_CANONICAL.exclude_any_system_tags.length !== 0 ||
      !setEqual(builtins.DEFAULT_ANALYSIS.exclude_any_system_tags, ['EXCLUDE_FROM_ANALYSIS']) ||
      !setEqual(builtins.EMERGENCY_FUND_ONLY.include_any_system_tags, ['EMERGENCY_FUND']) ||
      !setEqual(builtins.EMERGENCY_FUND_ONLY.exclude_any_system_tags, ['EXCLUDE_FROM_ANALYSIS'])) {
    fail('SCOPE_BUILTINS_INVALID');
  }
  return true;
}

function normalizeScopeSpec(input) {
  assertScopeContract();
  exactKeys(input, ['schema', 'contract_version', 'scope_id', 'include_any_system_tags', 'exclude_any_system_tags'], 'SCOPE_SPEC_SHAPE_INVALID');
  if (input.schema !== SPEC_SCHEMA || input.contract_version !== VERSION) fail('SCOPE_SPEC_VERSION_INVALID');
  const scopeId = String(input.scope_id || '').trim();
  if (!SCOPE_ID_RE.test(scopeId)) fail('SCOPE_ID_INVALID');
  const include = normalizeSystemTags(input.include_any_system_tags, 'SCOPE_INCLUDE_TAGS_INVALID');
  const exclude = normalizeSystemTags(input.exclude_any_system_tags, 'SCOPE_EXCLUDE_TAGS_INVALID');
  if (include.some((tag) => exclude.includes(tag))) fail('SCOPE_INCLUDE_EXCLUDE_OVERLAP');
  const builtIn = CONTRACT.built_in_scopes[scopeId];
  if (builtIn && (!setEqual(include, builtIn.include_any_system_tags) || !setEqual(exclude, builtIn.exclude_any_system_tags))) {
    fail('SCOPE_BUILTIN_POLICY_MISMATCH');
  }
  return Object.freeze({
    schema: SPEC_SCHEMA,
    contract_version: VERSION,
    scope_id: scopeId,
    include_any_system_tags: include,
    exclude_any_system_tags: exclude
  });
}

function builtInScope(scopeId) {
  assertScopeContract();
  const id = String(scopeId || '').trim();
  const definition = CONTRACT.built_in_scopes[id];
  if (!definition) fail('SCOPE_BUILTIN_UNKNOWN');
  return normalizeScopeSpec({
    schema: SPEC_SCHEMA,
    contract_version: VERSION,
    scope_id: id,
    include_any_system_tags: definition.include_any_system_tags,
    exclude_any_system_tags: definition.exclude_any_system_tags
  });
}

function serializeScopeSpec(input) {
  const normalized = normalizeScopeSpec(input);
  return stableStringify(normalized);
}

function normalizeAssignments(transactions, input) {
  assertScopeContract();
  const canonical = validateCanonicalCollection(transactions);
  exactKeys(input, ['schema', 'contract_version', 'account', 'transaction'], 'SCOPE_ASSIGNMENTS_SHAPE_INVALID');
  if (input.schema !== ASSIGNMENTS_SCHEMA || input.contract_version !== VERSION) fail('SCOPE_ASSIGNMENTS_VERSION_INVALID');
  if (!Array.isArray(input.account) || !Array.isArray(input.transaction)) fail('SCOPE_ASSIGNMENTS_COLLECTION_INVALID');

  const transactionIds = new Set(canonical.map((tx) => tx.transaction_id));
  const accountIds = new Set();
  for (const tx of canonical) {
    accountIds.add(tx.account_id);
    if (tx.destination_account_id != null) accountIds.add(tx.destination_account_id);
  }

  function normalizeLevel(entries, level) {
    const targetKey = level === 'ACCOUNT' ? 'account_id' : 'transaction_id';
    const known = level === 'ACCOUNT' ? accountIds : transactionIds;
    const seen = new Set();
    const normalized = entries.map((entry) => {
      exactKeys(entry, [targetKey, 'system_tags'], 'SCOPE_ASSIGNMENT_ENTRY_SHAPE_INVALID');
      const id = String(entry[targetKey] || '').trim();
      if (!known.has(id)) fail('SCOPE_ASSIGNMENT_TARGET_UNKNOWN');
      if (seen.has(id)) fail('SCOPE_ASSIGNMENT_TARGET_DUPLICATE');
      seen.add(id);
      const tags = normalizeSystemTags(entry.system_tags, 'SCOPE_ASSIGNMENT_TAGS_INVALID');
      if (tags.length === 0) fail('SCOPE_ASSIGNMENT_TAGS_EMPTY');
      return Object.freeze({ id, system_tags: tags });
    });
    normalized.sort((a, b) => a.id.localeCompare(b.id));
    return Object.freeze(normalized);
  }

  const account = normalizeLevel(input.account, 'ACCOUNT');
  const transaction = normalizeLevel(input.transaction, 'TRANSACTION');
  return Object.freeze({
    schema: ASSIGNMENTS_SCHEMA,
    contract_version: VERSION,
    account,
    transaction
  });
}

function assignmentMaps(normalized) {
  return {
    account: new Map(normalized.account.map((entry) => [entry.id, entry.system_tags])),
    transaction: new Map(normalized.transaction.map((entry) => [entry.id, entry.system_tags]))
  };
}

function systemTagsForTransaction(tx, maps) {
  const tags = new Set();
  const transactionTags = maps.transaction.get(tx.transaction_id) || [];
  const sourceTags = maps.account.get(tx.account_id) || [];
  const destinationTags = tx.destination_account_id == null ? [] : (maps.account.get(tx.destination_account_id) || []);
  for (const tag of [...transactionTags, ...sourceTags, ...destinationTags]) tags.add(tag);
  return Object.freeze(Array.from(tags).sort());
}

function scopeDecision(tx, maps, scope) {
  const systemTags = systemTagsForTransaction(tx, maps);
  const excluded = scope.exclude_any_system_tags.filter((tag) => systemTags.includes(tag));
  if (excluded.length > 0) {
    return Object.freeze({ include: false, reason: 'SCOPE_EXCLUDED_SYSTEM_TAG', matched_system_tags: Object.freeze(excluded) });
  }
  if (scope.include_any_system_tags.length > 0) {
    const included = scope.include_any_system_tags.filter((tag) => systemTags.includes(tag));
    if (included.length === 0) {
      return Object.freeze({ include: false, reason: 'SCOPE_INCLUDE_TAG_NOT_MATCHED', matched_system_tags: Object.freeze([]) });
    }
    return Object.freeze({ include: true, reason: 'OK', matched_system_tags: Object.freeze(included) });
  }
  return Object.freeze({ include: true, reason: 'OK', matched_system_tags: Object.freeze([]) });
}

function applyAnalyticsScope(transactions, assignmentsInput, scopeInput) {
  const canonical = validateCanonicalCollection(transactions);
  const assignments = normalizeAssignments(canonical, assignmentsInput);
  const scope = normalizeScopeSpec(scopeInput);
  const maps = assignmentMaps(assignments);
  const selected = [];
  let excludedCount = 0;
  for (const tx of canonical) {
    const result = scopeDecision(tx, maps, scope);
    if (result.include) selected.push(tx);
    else excludedCount += 1;
  }
  const report = Object.freeze({
    schema: SCHEMA,
    version: VERSION,
    scope_id: scope.scope_id,
    decision: 'APPLIED',
    reason: 'OK',
    include_system_tags: scope.include_any_system_tags,
    exclude_system_tags: scope.exclude_any_system_tags,
    included_count: selected.length,
    excluded_count: excludedCount
  });
  return Object.freeze({
    scope,
    transactions: Object.freeze(selected.slice()),
    report
  });
}

function evaluateScopedAnalytics(transactions, assignmentsInput, scopeInput, queryInput) {
  const scoped = applyAnalyticsScope(transactions, assignmentsInput, scopeInput);
  return Object.freeze({
    scope: scoped.scope,
    scope_report: scoped.report,
    analytics_result: evaluateAnalytics(scoped.transactions, queryInput)
  });
}

function scopeTelemetry(report) {
  exactKeys(report, ['schema', 'version', 'scope_id', 'decision', 'reason', 'include_system_tags', 'exclude_system_tags', 'included_count', 'excluded_count'], 'SCOPE_REPORT_SHAPE_INVALID');
  const output = {};
  for (const key of CONTRACT.telemetry_allowlist) {
    if (Object.prototype.hasOwnProperty.call(report, key)) output[key] = report[key];
  }
  return Object.freeze(output);
}

function emptyAssignments() {
  return Object.freeze({
    schema: ASSIGNMENTS_SCHEMA,
    contract_version: VERSION,
    account: Object.freeze([]),
    transaction: Object.freeze([])
  });
}

module.exports = Object.freeze({
  SCHEMA,
  VERSION,
  ASSIGNMENTS_SCHEMA,
  SPEC_SCHEMA,
  SYSTEM_TAGS,
  CONTRACT,
  assertScopeContract,
  normalizeScopeSpec,
  builtInScope,
  serializeScopeSpec,
  normalizeAssignments,
  systemTagsForTransaction,
  applyAnalyticsScope,
  evaluateScopedAnalytics,
  scopeTelemetry,
  emptyAssignments
});
