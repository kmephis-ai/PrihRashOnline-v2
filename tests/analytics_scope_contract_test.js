'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { normalizeCanonicalTransaction } = require('../lib/domain/canonical_transaction');
const { evaluateAnalytics } = require('../lib/analytics/analytics_engine');
const scope = require('../lib/analytics/analytics_scope');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function tx(id, type, accountId, amountMinor, overrides = {}) {
  const destinationAccountId = type === 'transfer' ? overrides.destination_account_id : null;
  return normalizeCanonicalTransaction({
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: id,
    occurred_at: overrides.occurred_at || '2026-06-15T12:00:00Z',
    type,
    status: 'posted',
    amount_minor: amountMinor,
    currency: 'USD',
    account_id: accountId,
    destination_account_id: destinationAccountId,
    category_id: overrides.category_id || (type === 'income' ? 'income-main' : type === 'transfer' ? 'transfer' : 'expense-main'),
    member_id: overrides.member_id || null,
    project_id: overrides.project_id || null,
    tags: overrides.tags || [],
    counterparty: null,
    description: null,
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC',
      source_container: 'fixture:scope-070',
      source_record_id: id,
      source_fingerprint: sha256(`scope-source:${id}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SCOPE-070-SYNTHETIC-v1',
      source_position: null
    }
  });
}

const canonical = [
  tx('SCP-TX-001', 'expense', 'acct-a', 1200, { tags: ['EXCLUDE_FROM_ANALYSIS', 'free-user-tag'] }),
  tx('SCP-TX-002', 'income', 'acct-b', 9000),
  tx('SCP-TX-003', 'transfer', 'acct-a', 2500, { destination_account_id: 'acct-emergency' }),
  tx('SCP-TX-004', 'expense', 'acct-emergency', 700),
  tx('SCP-TX-005', 'expense', 'acct-c', 1100),
  tx('SCP-TX-006', 'expense', 'acct-b', 500)
];

const assignments = {
  schema: scope.ASSIGNMENTS_SCHEMA,
  contract_version: scope.VERSION,
  account: [
    { account_id: 'acct-emergency', system_tags: ['EMERGENCY_FUND'] },
    { account_id: 'acct-c', system_tags: ['EXCLUDE_FROM_ANALYSIS'] }
  ],
  transaction: [
    { transaction_id: 'SCP-TX-005', system_tags: ['EMERGENCY_FUND'] },
    { transaction_id: 'SCP-TX-006', system_tags: ['EXCLUDE_FROM_ANALYSIS'] }
  ]
};

assert.strictEqual(scope.assertScopeContract(), true);
assert.deepStrictEqual(scope.SYSTEM_TAGS.slice().sort(), ['EMERGENCY_FUND', 'EXCLUDE_FROM_ANALYSIS']);
assert.strictEqual(scope.CONTRACT.principles.canonical_truth_mutated, false);
assert.strictEqual(scope.CONTRACT.principles.canonical_user_tags_authoritative_for_system_scope, false);
assert.strictEqual(scope.CONTRACT.principles.system_assignments_separate_overlay, true);
assert.ok(Object.values(scope.CONTRACT.authorities).every((value) => value === false));

const all = scope.builtInScope('ALL_CANONICAL');
const defaultAnalysis = scope.builtInScope('DEFAULT_ANALYSIS');
const emergency = scope.builtInScope('EMERGENCY_FUND_ONLY');
assert.deepStrictEqual(all.include_any_system_tags, []);
assert.deepStrictEqual(all.exclude_any_system_tags, []);
assert.deepStrictEqual(defaultAnalysis.exclude_any_system_tags, ['EXCLUDE_FROM_ANALYSIS']);
assert.deepStrictEqual(emergency.include_any_system_tags, ['EMERGENCY_FUND']);
assert.deepStrictEqual(emergency.exclude_any_system_tags, ['EXCLUDE_FROM_ANALYSIS']);

const canonicalBefore = JSON.stringify(canonical);
const allView = scope.applyAnalyticsScope(canonical, assignments, all);
assert.strictEqual(allView.transactions.length, canonical.length);
assert.strictEqual(allView.report.excluded_count, 0);
assert.strictEqual(JSON.stringify(canonical), canonicalBefore);

const defaultView = scope.applyAnalyticsScope(canonical, assignments, defaultAnalysis);
assert.deepStrictEqual(defaultView.transactions.map((row) => row.transaction_id), [
  'SCP-TX-001', 'SCP-TX-002', 'SCP-TX-003', 'SCP-TX-004'
]);
assert.strictEqual(defaultView.report.included_count, 4);
assert.strictEqual(defaultView.report.excluded_count, 2);
// A user tag with the same text is intentionally not system authority.
assert(defaultView.transactions.some((row) => row.transaction_id === 'SCP-TX-001'));
assert.deepStrictEqual(canonical[0].tags, ['EXCLUDE_FROM_ANALYSIS', 'free-user-tag']);
assert.strictEqual(JSON.stringify(canonical), canonicalBefore);

const emergencyView = scope.applyAnalyticsScope(canonical, assignments, emergency);
assert.deepStrictEqual(emergencyView.transactions.map((row) => row.transaction_id), ['SCP-TX-003', 'SCP-TX-004']);
// SCP-TX-003 matches through destination account; SCP-TX-004 through source account.
assert(emergencyView.transactions.some((row) => row.transaction_id === 'SCP-TX-003'));
assert(emergencyView.transactions.some((row) => row.transaction_id === 'SCP-TX-004'));
// SCP-TX-005 has EMERGENCY_FUND on transaction but EXCLUDE on its account: deny wins.
assert.strictEqual(emergencyView.transactions.some((row) => row.transaction_id === 'SCP-TX-005'), false);
assert.strictEqual(JSON.stringify(canonical), canonicalBefore);

const customA = scope.normalizeScopeSpec({
  schema: scope.SPEC_SCHEMA,
  contract_version: scope.VERSION,
  scope_id: 'CUSTOM_POLICY',
  include_any_system_tags: ['EMERGENCY_FUND'],
  exclude_any_system_tags: ['EXCLUDE_FROM_ANALYSIS']
});
const customB = scope.normalizeScopeSpec({
  schema: scope.SPEC_SCHEMA,
  contract_version: scope.VERSION,
  scope_id: 'CUSTOM_POLICY',
  include_any_system_tags: ['EMERGENCY_FUND'],
  exclude_any_system_tags: ['EXCLUDE_FROM_ANALYSIS']
});
assert.strictEqual(scope.serializeScopeSpec(customA), scope.serializeScopeSpec(customB));
assert.strictEqual(scope.serializeScopeSpec(customA).includes('acct-'), false);
assert.strictEqual(scope.serializeScopeSpec(customA).includes('SCP-TX-'), false);
assert.strictEqual(scope.serializeScopeSpec(customA).includes('amount_minor'), false);

assert.throws(() => scope.normalizeScopeSpec({
  schema: scope.SPEC_SCHEMA,
  contract_version: scope.VERSION,
  scope_id: 'CUSTOM_POLICY',
  include_any_system_tags: ['UNKNOWN_TAG'],
  exclude_any_system_tags: []
}), /SCOPE_SYSTEM_TAG_UNKNOWN/);
assert.throws(() => scope.normalizeScopeSpec({
  schema: scope.SPEC_SCHEMA,
  contract_version: scope.VERSION,
  scope_id: 'CUSTOM_POLICY',
  include_any_system_tags: ['EMERGENCY_FUND', 'EMERGENCY_FUND'],
  exclude_any_system_tags: []
}), /SCOPE_SYSTEM_TAG_DUPLICATE/);
assert.throws(() => scope.normalizeScopeSpec({
  schema: scope.SPEC_SCHEMA,
  contract_version: scope.VERSION,
  scope_id: 'CUSTOM_POLICY',
  include_any_system_tags: ['EMERGENCY_FUND'],
  exclude_any_system_tags: ['EMERGENCY_FUND']
}), /SCOPE_INCLUDE_EXCLUDE_OVERLAP/);
assert.throws(() => scope.normalizeScopeSpec({
  schema: scope.SPEC_SCHEMA,
  contract_version: scope.VERSION,
  scope_id: 'DEFAULT_ANALYSIS',
  include_any_system_tags: [],
  exclude_any_system_tags: []
}), /SCOPE_BUILTIN_POLICY_MISMATCH/);
assert.throws(() => scope.normalizeScopeSpec({
  schema: scope.SPEC_SCHEMA,
  contract_version: scope.VERSION,
  scope_id: 'CUSTOM_POLICY',
  include_any_system_tags: [],
  exclude_any_system_tags: [],
  account_ids: ['acct-a']
}), /SCOPE_SPEC_SHAPE_INVALID/);

assert.throws(() => scope.normalizeAssignments(canonical, {
  ...assignments,
  account: [{ account_id: 'missing-account', system_tags: ['EMERGENCY_FUND'] }]
}), /SCOPE_ASSIGNMENT_TARGET_UNKNOWN/);
assert.throws(() => scope.normalizeAssignments(canonical, {
  ...assignments,
  transaction: [{ transaction_id: 'missing-transaction', system_tags: ['EMERGENCY_FUND'] }]
}), /SCOPE_ASSIGNMENT_TARGET_UNKNOWN/);
assert.throws(() => scope.normalizeAssignments(canonical, {
  ...assignments,
  account: [{ account_id: 'acct-a', system_tags: ['UNKNOWN_TAG'] }]
}), /SCOPE_SYSTEM_TAG_UNKNOWN/);
assert.throws(() => scope.normalizeAssignments(canonical, {
  ...assignments,
  account: [
    { account_id: 'acct-a', system_tags: ['EMERGENCY_FUND'] },
    { account_id: 'acct-a', system_tags: ['EXCLUDE_FROM_ANALYSIS'] }
  ]
}), /SCOPE_ASSIGNMENT_TARGET_DUPLICATE/);
assert.throws(() => scope.normalizeAssignments(canonical, {
  ...assignments,
  transaction: [{ transaction_id: 'SCP-TX-001', system_tags: ['EMERGENCY_FUND', 'EMERGENCY_FUND'] }]
}), /SCOPE_SYSTEM_TAG_DUPLICATE/);

const reversedAssignments = {
  ...assignments,
  account: assignments.account.slice().reverse(),
  transaction: assignments.transaction.slice().reverse()
};
const reversedCanonical = canonical.slice().reverse();
const orderedIds = scope.applyAnalyticsScope(canonical, assignments, emergency).transactions.map((row) => row.transaction_id).sort();
const reversedIds = scope.applyAnalyticsScope(reversedCanonical, reversedAssignments, emergency).transactions.map((row) => row.transaction_id).sort();
assert.deepStrictEqual(reversedIds, orderedIds);

const query = {
  schema: 'PRH_ANALYTICS_QUERY_V1',
  contract_version: '1.0.0',
  currency: 'USD',
  measures: ['EXPENSE'],
  dimensions: [],
  filters: [],
  time_range: null,
  grain: 'NONE',
  comparison: { mode: 'NONE' },
  sort: [],
  parameters: {},
  limit: 100
};
const direct = evaluateAnalytics(canonical, query);
const scopedAll = scope.evaluateScopedAnalytics(canonical, assignments, all, query);
assert.deepStrictEqual(scopedAll.analytics_result, direct);
assert.strictEqual(scopedAll.analytics_result.provenance.financial_truth_policy, 'FIN-TRUTH-v1');
const scopedDefault = scope.evaluateScopedAnalytics(canonical, assignments, defaultAnalysis, query);
assert.strictEqual(scopedDefault.analytics_result.provenance.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(JSON.stringify(canonical), canonicalBefore);

const telemetry = scope.scopeTelemetry(defaultView.report);
assert.deepStrictEqual(Object.keys(telemetry).sort(), [
  'schema', 'version', 'scope_id', 'decision', 'reason', 'include_system_tags',
  'exclude_system_tags', 'included_count', 'excluded_count'
].sort());
const telemetryText = JSON.stringify(telemetry).toLowerCase();
for (const forbidden of ['acct-', 'scp-tx-', 'amount_minor', 'currency', 'description', 'counterparty', 'provenance', 'source_record_id']) {
  assert.strictEqual(telemetryText.includes(forbidden), false, forbidden);
}

console.log('analytics-scope: PASS', {
  contract: `${scope.SCHEMA}@${scope.VERSION}`,
  systemTags: scope.SYSTEM_TAGS,
  canonicalCount: canonical.length,
  defaultIncluded: defaultView.report.included_count,
  emergencyIncluded: emergencyView.report.included_count,
  userTagsRemainFree: true,
  destinationAccountScope: true,
  denyWins: true,
  canonicalMutation: false,
  financialTruth: false,
  financialWrite: false,
  freeOnly: scope.CONTRACT.principles.free_only
});
