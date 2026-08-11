'use strict';

const assert = require('assert');
const PRIVACY = require('../lib/privacy/privacy_presentation');

assert.strictEqual(PRIVACY.assertContract(), true);
assert.deepStrictEqual(PRIVACY.MODES, ['NORMAL', 'MASKED', 'DEMO', 'ZEN']);
assert.strictEqual(PRIVACY.CONTRACT.default_mode, 'NORMAL');
assert.strictEqual(PRIVACY.CONTRACT.invalid_mode_fail_safe, 'MASKED');
assert.strictEqual(PRIVACY.CONTRACT.security_boundary, false);
assert.strictEqual(PRIVACY.CONTRACT.authorization_boundary, false);
assert.ok(Object.values(PRIVACY.CONTRACT.authority).every((value) => value === false));
assert.strictEqual(PRIVACY.CONTRACT.free_only, true);

const defaultPreference = PRIVACY.normalizePreference({});
assert.deepStrictEqual(defaultPreference, {
  schema: PRIVACY.PREFERENCE_SCHEMA,
  version: PRIVACY.VERSION,
  mode: 'NORMAL'
});
assert.strictEqual(PRIVACY.normalizePreference({ mode: 'masked' }).mode, 'MASKED');
assert.strictEqual(PRIVACY.normalizePreference({ mode: 'demo' }).mode, 'DEMO');
assert.strictEqual(PRIVACY.normalizePreference({ mode: 'zen' }).mode, 'ZEN');
assert.throws(() => PRIVACY.normalizePreference({ mode: 'BROKEN' }), /PRIV080_MODE_INVALID/);
assert.throws(() => PRIVACY.normalizePreference({ mode: 'MASKED', amount_minor: 1 }), /PRIV080_PREFERENCE_PAYLOAD_FORBIDDEN/);
assert.throws(() => PRIVACY.normalizePreference({ mode: 'MASKED', query: {} }), /PRIV080_PREFERENCE_PAYLOAD_FORBIDDEN/);
assert.throws(() => PRIVACY.normalizePreference({ mode: 'MASKED', filters: [] }), /PRIV080_PREFERENCE_PAYLOAD_FORBIDDEN/);
assert.throws(() => PRIVACY.normalizePreference({ mode: 'MASKED', account_id: 'private' }), /PRIV080_PREFERENCE_PAYLOAD_FORBIDDEN/);

assert.deepStrictEqual(PRIVACY.resolveMode(), { mode: 'NORMAL', source: 'DEFAULT', explicit_invalid: false });
assert.deepStrictEqual(PRIVACY.resolveMode({ stored_preference: { mode: 'ZEN' } }), { mode: 'ZEN', source: 'PREFERENCE', explicit_invalid: false });
assert.deepStrictEqual(PRIVACY.resolveMode({ url_mode: 'demo', stored_preference: { mode: 'NORMAL' } }), { mode: 'DEMO', source: 'URL', explicit_invalid: false });
assert.deepStrictEqual(PRIVACY.resolveMode({ url_mode: 'unknown', stored_preference: { mode: 'NORMAL' } }), { mode: 'MASKED', source: 'URL_FAIL_SAFE', explicit_invalid: true });
assert.deepStrictEqual(PRIVACY.resolveMode({ stored_preference: { mode: 'UNKNOWN' } }), { mode: 'MASKED', source: 'PREFERENCE_FAIL_SAFE', explicit_invalid: false });

const privatePayload = {
  schema: 'PRH_PRIVATE_PRESENTATION_FIXTURE_V1',
  contract_version: '1.0.0',
  status: 'READY',
  currency: 'RUB',
  total_count: 2,
  configured: true,
  filter_context: {
    schema: 'PRH_FILTER_CONTEXT_V1',
    filters: [{ field: 'account_id', values: ['SECRET_FILTER_VALUE'] }]
  },
  cards: {
    income: { state: 'READY', income_minor: 918273645, currency: 'RUB', account_name: 'SECRET_ACCOUNT_ALPHA' },
    expense: { state: 'READY', expense_minor: 817263544, category_name: 'SECRET_CATEGORY_BETA' },
    cash: { state: 'READY', cash_flow_minor: 101010101, member_name: 'SECRET_MEMBER_GAMMA' }
  },
  rows: [
    {
      transaction_id: 'SECRET_TX_001',
      amount_minor: 123456789,
      account_id: 'SECRET_ACCOUNT_ID',
      category_id: 'SECRET_CATEGORY_ID',
      project_id: 'SECRET_PROJECT_ID',
      counterparty: 'SECRET_MERCHANT_DELTA',
      note: 'SECRET_NOTE_EPSILON'
    }
  ],
  visual_data: {
    cash_flow_minor: [321321321],
    expense_mix: [['SECRET_MIX_CATEGORY', 654654654]]
  },
  widgets: [{ query_ref: 'SECRET_QUERY_REF', title: 'SECRET_WIDGET_LABEL' }],
  nested: {
    summary: {
      balance_minor: 99887766,
      target_minor: 11223344,
      description: 'SECRET_DESCRIPTION_ZETA',
      alert_count: 3,
      available: true
    },
    tags: ['SECRET_TAG_A', 'SECRET_TAG_B']
  }
};
const privateBefore = JSON.stringify(privatePayload);
const secretTokens = [
  '918273645', '817263544', '101010101', '123456789', '99887766', '11223344',
  '321321321', '654654654', 'SECRET_FILTER_VALUE', 'SECRET_MIX_CATEGORY', 'SECRET_QUERY_REF', 'SECRET_WIDGET_LABEL',
  'SECRET_ACCOUNT_ALPHA', 'SECRET_CATEGORY_BETA', 'SECRET_MEMBER_GAMMA', 'SECRET_TX_001',
  'SECRET_ACCOUNT_ID', 'SECRET_CATEGORY_ID', 'SECRET_PROJECT_ID', 'SECRET_MERCHANT_DELTA',
  'SECRET_NOTE_EPSILON', 'SECRET_DESCRIPTION_ZETA', 'SECRET_TAG_A', 'SECRET_TAG_B'
];

const normal = PRIVACY.transformPresentation(privatePayload, { mode: 'NORMAL', source: 'PRIVATE_AUTHORIZED_PRESENTATION' });
assert.deepStrictEqual(normal.payload, privatePayload);
assert.notStrictEqual(normal.payload, privatePayload);
assert.strictEqual(normal.financial_truth_surface, true);
assert.strictEqual(normal.security_boundary, false);
assert.strictEqual(JSON.stringify(privatePayload), privateBefore);

const masked = PRIVACY.transformPresentation(privatePayload, { mode: 'MASKED', source: 'PRIVATE_AUTHORIZED_PRESENTATION' });
assert.strictEqual(masked.financial_truth_surface, false);
assert(masked.evidence.suppressed_count > 10);
assert.strictEqual(masked.payload.cards.income.income_minor, null);
assert.strictEqual(masked.payload.cards.income.account_name, null);
assert.deepStrictEqual(masked.payload.rows, []);
assert.deepStrictEqual(masked.payload.filter_context.filters, []);
assert.deepStrictEqual(masked.payload.visual_data.cash_flow_minor, []);
assert.deepStrictEqual(masked.payload.visual_data.expense_mix, []);
assert.deepStrictEqual(masked.payload.widgets, []);
assert.strictEqual(masked.payload.nested.summary.balance_minor, null);
assert.deepStrictEqual(masked.payload.nested.tags, []);
const maskedText = JSON.stringify(masked);
for (const token of secretTokens) assert.strictEqual(maskedText.includes(token), false, `masked leak: ${token}`);
assert.strictEqual(JSON.stringify(privatePayload), privateBefore);

const zen = PRIVACY.transformPresentation(privatePayload, { mode: 'ZEN', source: 'PRIVATE_AUTHORIZED_PRESENTATION' });
assert.strictEqual(zen.financial_truth_surface, false);
assert.strictEqual(zen.payload.schema, privatePayload.schema);
assert.strictEqual(zen.payload.contract_version, privatePayload.contract_version);
assert.strictEqual(zen.payload.status, 'READY');
assert.strictEqual(zen.payload.currency, 'RUB');
assert.strictEqual(zen.payload.total_count, 2);
assert.strictEqual(zen.payload.configured, true);
assert.strictEqual(Object.prototype.hasOwnProperty.call(zen.payload, 'cards'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(zen.payload, 'rows'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(zen.payload, 'filter_context'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(zen.payload, 'visual_data'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(zen.payload, 'widgets'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(zen.payload, 'nested'), false);
const zenText = JSON.stringify(zen);
for (const token of secretTokens) assert.strictEqual(zenText.includes(token), false, `zen leak: ${token}`);

const syntheticDemoPayload = {
  schema: 'PRH_PUBLIC_SYNTHETIC_PRIVACY_DEMO_V1',
  contract_version: '1.0.0',
  status: 'READY',
  currency: 'RUB',
  synthetic_only: true,
  cards: {
    income: { income_minor: 420000, category_name: 'SYNTHETIC_CATEGORY_A' },
    expense: { expense_minor: 310000, account_name: 'SYNTHETIC_ACCOUNT_B' }
  }
};
assert.throws(
  () => PRIVACY.transformPresentation(privatePayload, { mode: 'DEMO', source: 'PRIVATE_AUTHORIZED_PRESENTATION' }),
  /PRIV080_DEMO_PRIVATE_SOURCE_FORBIDDEN/
);
const demo = PRIVACY.transformPresentation(syntheticDemoPayload, { mode: 'DEMO', source: 'PUBLIC_SYNTHETIC' });
assert.deepStrictEqual(demo.payload, syntheticDemoPayload);
assert.strictEqual(demo.synthetic_only, true);
assert.strictEqual(demo.financial_truth_surface, false);
assert.strictEqual(JSON.stringify(demo).includes('PUBLIC_SYNTHETIC'), true);

const maskedSynthetic = PRIVACY.transformPresentation(syntheticDemoPayload, { mode: 'MASKED', source: 'PUBLIC_SYNTHETIC' });
assert.strictEqual(maskedSynthetic.synthetic_only, true);
assert.strictEqual(maskedSynthetic.payload.cards.income.income_minor, null);
assert.strictEqual(maskedSynthetic.financial_truth_surface, false);

for (const key of ['amount_minor', 'balance_minor', 'category_name', 'account_id', 'custom_value_minor']) {
  assert.strictEqual(PRIVACY.isSensitiveKey(key), true, key);
}
for (const key of ['schema', 'status', 'currency', 'alert_count']) {
  assert.strictEqual(PRIVACY.isSensitiveKey(key), false, key);
}

const telemetry = PRIVACY.telemetry(masked);
assert.deepStrictEqual(Object.keys(telemetry).sort(), PRIVACY.CONTRACT.telemetry_allowlist.slice().sort());
assert.strictEqual(telemetry.mode, 'MASKED');
assert.strictEqual(telemetry.source, 'PRIVATE_AUTHORIZED_PRESENTATION');
assert.strictEqual(telemetry.synthetic_only, false);
const telemetryText = JSON.stringify(telemetry);
for (const token of secretTokens) assert.strictEqual(telemetryText.includes(token), false, `telemetry leak: ${token}`);
assert.strictEqual(/amount_minor|account_id|category_name|transaction_id/.test(telemetryText), false);

console.log('privacy-presentation-modes: PASS', {
  modes: PRIVACY.MODES,
  maskedSuppressed: masked.evidence.suppressed_count,
  maskedArraysDropped: true,
  zenSuppressed: zen.evidence.suppressed_count,
  demoSyntheticOnly: demo.synthetic_only,
  securityBoundary: false,
  freeOnly: true
});
