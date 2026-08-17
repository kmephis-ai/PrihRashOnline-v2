'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PORTABLE = require('../lib/dashboard/dashboard_portable_spec');
const SAVED = require('../lib/dashboard/dashboard_saved_views');
const COMPOSER = require('../lib/dashboard/dashboard_composer');
const FACTORY = require('../lib/dashboard/widget_factory');
const CUSTOM = require('../lib/dashboard/dashboard_visual_customization');
const ANALYTICS = require('../lib/analytics/analytics_engine');

PORTABLE.assertContract();
assert.strictEqual(PORTABLE.SCHEMA, 'PRH_DASHBOARD_PORTABLE_SPEC_V1');
assert.strictEqual(PORTABLE.VERSION, '1.0.0');
assert.strictEqual(PORTABLE.CONTRACT.roadmap_id, 'DASH-086');
assert.strictEqual(PORTABLE.CONTRACT.principles.import_dry_run_only, true);
assert.strictEqual(PORTABLE.CONTRACT.principles.import_persists, false);
assert.strictEqual(PORTABLE.CONTRACT.principles.import_executes_code, false);
assert.strictEqual(PORTABLE.CONTRACT.principles.upstream_identities_recomputed, true);
assert.strictEqual(PORTABLE.CONTRACT.principles.public_safe_by_default, false);
assert.strictEqual(PORTABLE.CONTRACT.privacy.classification, 'PRIVATE_CONFIGURATION');
assert.strictEqual(PORTABLE.CONTRACT.limits.max_widgets, COMPOSER.CONTRACT.grid.max_widgets);
assert(Object.values(PORTABLE.CONTRACT.authority).every((value) => value === false));

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error && error.code === code, `expected ${code}`);
}

function rawQuery(overrides = {}) {
  return {
    schema: ANALYTICS.QUERY_SCHEMA,
    contract_version: ANALYTICS.CONTRACT_VERSION,
    currency: 'RUB',
    measures: ['EXPENSE'],
    dimensions: [],
    filters: [{ field: 'category_id', operator: 'IN', values: ['synthetic-private-category'] }],
    time_range: null,
    grain: 'NONE',
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 5000,
    ...overrides
  };
}

function boundKpi(spec, widgetId = 'w-0001') {
  const placeholder = spec.widgets.find((widget) => widget.id === widgetId);
  return FACTORY.bindPlaceholder(placeholder, {
    schema: FACTORY.BINDING_SCHEMA,
    contract_version: FACTORY.VERSION,
    widget_id: widgetId,
    kind: 'KPI',
    query: rawQuery(),
    presentation: {
      schema: FACTORY.VALUE_PRESENTATION_SCHEMA,
      contract_version: FACTORY.VERSION,
      title: 'Расходы',
      show_comparison: false
    }
  });
}

function configuration() {
  const spec = COMPOSER.defaultSpec();
  return {
    schema: SAVED.CONFIG_SCHEMA,
    contract_version: SAVED.VERSION,
    dashboard_spec: spec,
    bound_widgets: [boundKpi(spec)]
  };
}

function kpiCustomization(overrides = {}) {
  return {
    schema: CUSTOM.CUSTOMIZATION_SCHEMA,
    contract_version: CUSTOM.VERSION,
    theme: 'DARK',
    palette: 'DEFAULT',
    chart_type: null,
    axes: null,
    labels: 'AUTO',
    legend: 'HIDE',
    stack: 'OFF',
    sort: { direction: 'NONE', by: 'VALUE' },
    top_n: null,
    number_format: { style: 'AUTO', fraction_digits: 0, sign: 'AUTO' },
    density: 'COMPACT',
    ...overrides
  };
}

function customizationDescriptors() {
  return [{ widget_id: 'w-0001', customization: kpiCustomization() }];
}

function refreshOuterChecksums(envelope) {
  envelope.payload_hash = sha256(PORTABLE.stableStringify(envelope.payload));
  const identity = {
    schema: envelope.schema,
    contract_version: envelope.contract_version,
    manifest: envelope.manifest,
    payload: envelope.payload,
    payload_hash: envelope.payload_hash,
    counts: envelope.counts
  };
  envelope.portable_hash = sha256(PORTABLE.stableStringify(identity));
  envelope.checksum = `sha256:${envelope.portable_hash}`;
  return envelope;
}

const cfg = configuration();
const envelope = PORTABLE.buildEnvelope(cfg, customizationDescriptors());
assert.strictEqual(envelope.schema, PORTABLE.SCHEMA);
assert.strictEqual(envelope.contract_version, PORTABLE.VERSION);
assert.strictEqual(envelope.manifest.public_safe, false);
assert.strictEqual(envelope.manifest.privacy_class, 'PRIVATE_CONFIGURATION');
assert.strictEqual(envelope.manifest.warning_code, 'PRIVATE_CONFIGURATION_NOT_PUBLIC_SAFE');
assert.match(envelope.manifest.warning_ru, /Не публикуйте portable JSON/);
assert.strictEqual(envelope.manifest.contains_financial_dataset, false);
assert.strictEqual(envelope.manifest.contains_financial_values, false);
assert.strictEqual(envelope.manifest.contains_credentials, false);
assert.strictEqual(envelope.manifest.contains_runtime_locator, false);
assert.strictEqual(envelope.manifest.dry_run_import_only, true);
assert.match(envelope.payload_hash, /^[0-9a-f]{64}$/);
assert.match(envelope.portable_hash, /^[0-9a-f]{64}$/);
assert.strictEqual(envelope.checksum, `sha256:${envelope.portable_hash}`);
assert.strictEqual(envelope.counts.widget_count, cfg.dashboard_spec.widgets.length);
assert.strictEqual(envelope.counts.binding_count, 1);
assert.strictEqual(envelope.counts.customization_count, 1);

// Private query/filter identifiers may be transported, but the file is explicitly PRIVATE_CONFIGURATION.
assert.strictEqual(
  envelope.payload.configuration.bound_widgets[0].binding.query.filters[0].values[0],
  'synthetic-private-category'
);

// Canonical round-trip is byte-identical and import remains validation-only.
const serialized = PORTABLE.serializePortable(envelope);
const imported = PORTABLE.importPortableJson(serialized);
assert.strictEqual(imported.schema, PORTABLE.IMPORT_RESULT_SCHEMA);
assert.strictEqual(imported.status, 'VALID');
assert.strictEqual(imported.decision, 'DRY_RUN_ONLY');
assert.strictEqual(imported.persistence_performed, false);
assert.strictEqual(imported.persistence_authority, false);
assert.strictEqual(imported.persistence_requires, 'DASH-084_SAVED_VIEW_LIFECYCLE_EXPLICIT_CALL');
assert.strictEqual(imported.payload_hash, envelope.payload_hash);
assert.strictEqual(imported.portable_hash, envelope.portable_hash);
assert.strictEqual(imported.configuration.bound_widgets[0].binding.query.filters[0].values[0], 'synthetic-private-category');
const reexported = PORTABLE.reexportImported(imported);
assert.strictEqual(PORTABLE.stableStringify(reexported), serialized);

// Object key order does not affect canonical identity.
const reorderedCfg = {
  bound_widgets: cfg.bound_widgets,
  dashboard_spec: cfg.dashboard_spec,
  contract_version: SAVED.VERSION,
  schema: SAVED.CONFIG_SCHEMA
};
const reorderedCustomization = [{
  customization: {
    density: 'COMPACT',
    number_format: { sign: 'AUTO', fraction_digits: 0, style: 'AUTO' },
    top_n: null,
    sort: { by: 'VALUE', direction: 'NONE' },
    stack: 'OFF',
    legend: 'HIDE',
    labels: 'AUTO',
    axes: null,
    chart_type: null,
    palette: 'DEFAULT',
    theme: 'DARK',
    contract_version: CUSTOM.VERSION,
    schema: CUSTOM.CUSTOMIZATION_SCHEMA
  },
  widget_id: 'w-0001'
}];
const reorderedEnvelope = PORTABLE.buildEnvelope(reorderedCfg, reorderedCustomization);
assert.strictEqual(reorderedEnvelope.payload_hash, envelope.payload_hash);
assert.strictEqual(reorderedEnvelope.portable_hash, envelope.portable_hash);
assert.strictEqual(PORTABLE.serializePortable(reorderedEnvelope), serialized);

// Checksum is verified before semantic validation.
const checksumTampered = JSON.parse(serialized);
checksumTampered.payload.configuration.dashboard_spec.title = 'Подменённый заголовок';
expectCode(() => PORTABLE.importPortableJson(JSON.stringify(checksumTampered)), 'DASH086_PAYLOAD_CHECKSUM_MISMATCH');

// Even a correctly re-checksummed hostile derived identity is rejected by upstream recomputation.
const identityTampered = JSON.parse(serialized);
identityTampered.payload.configuration.bound_widgets[0].binding.binding_hash = '0'.repeat(64);
refreshOuterChecksums(identityTampered);
expectCode(() => PORTABLE.importPortableJson(JSON.stringify(identityTampered)), 'DASH084_BINDING_DERIVED_STATE_MISMATCH');

// Unknown top-level fields fail closed.
const extraTopLevel = JSON.parse(serialized);
extraTopLevel.untrusted = true;
expectCode(() => PORTABLE.validateEnvelopeObject(extraTopLevel), 'DASH086_ENVELOPE_SHAPE_INVALID');

// Duplicate JSON keys and prototype-pollution keys are rejected by the bounded parser itself.
expectCode(() => PORTABLE.parseBoundedJson('{"schema":"A","schema":"B"}'), 'DASH086_JSON_DUPLICATE_KEY');
expectCode(() => PORTABLE.parseBoundedJson('{"__proto__":{"polluted":true}}'), 'DASH086_PROTOTYPE_KEY_FORBIDDEN');
expectCode(() => PORTABLE.parseBoundedJson('{"constructor":{"prototype":{"polluted":true}}}'), 'DASH086_PROTOTYPE_KEY_FORBIDDEN');
assert.strictEqual({}.polluted, undefined);

// Unknown/future schemas never silently downgrade.
expectCode(() => PORTABLE.importPortableJson('{"schema":"PRH_DASHBOARD_PORTABLE_SPEC_V99"}'), 'DASH086_SCHEMA_UNSUPPORTED');

// Transport limits are checked before unbounded parsing or semantic work.
expectCode(() => PORTABLE.importPortableJson(' '.repeat(PORTABLE.CONTRACT.limits.max_portable_bytes + 1)), 'DASH086_PORTABLE_SIZE_LIMIT');
const deepJson = '['.repeat(PORTABLE.CONTRACT.limits.max_json_depth + 3) + '0' + ']'.repeat(PORTABLE.CONTRACT.limits.max_json_depth + 3);
expectCode(() => PORTABLE.parseBoundedJson(deepJson), 'DASH086_JSON_DEPTH_LIMIT');
const tooLongString = JSON.stringify('x'.repeat(PORTABLE.CONTRACT.limits.max_string_length + 1));
expectCode(() => PORTABLE.parseBoundedJson(tooLongString), 'DASH086_JSON_STRING_LIMIT');
expectCode(
  () => PORTABLE.buildEnvelope(cfg, Array.from({ length: PORTABLE.CONTRACT.limits.max_customizations + 1 }, () => customizationDescriptors()[0])),
  'DASH086_CUSTOMIZATION_COUNT_LIMIT'
);

// Hostile financial/result/secret/runtime/executable payloads fail closed.
for (const hostile of [
  { transaction_rows: [] },
  { analytics_result: { rows: [] } },
  { amount_minor: 123 },
  { balance_minor: 456 },
  { access_token: 'secret-token' },
  { refresh_token: 'secret-refresh' },
  { deployment_url: 'private-runtime' },
  { script_id: 'private-script' },
  { css: 'display:none' },
  { html: '<b>unsafe</b>' },
  { formatter: 'function(x){return x}' },
  { nested: { arbitrary: 'javascript:alert(1)' } },
  { nested: { arbitrary: 'https://example.invalid/evil' } }
]) {
  assert.throws(() => PORTABLE.assertNoForbiddenPayload(hostile), /DASH086_/);
}

// Upstream validation remains authoritative.
expectCode(
  () => PORTABLE.buildEnvelope(cfg, [{ widget_id: 'w-9999', customization: kpiCustomization() }]),
  'DASH086_CUSTOMIZATION_WIDGET_NOT_BOUND'
);
expectCode(
  () => PORTABLE.buildEnvelope(cfg, [{ widget_id: 'w-0001', customization: kpiCustomization({ theme: 'NEON' }) }]),
  'DASH085_THEME_INVALID'
);
assert.throws(
  () => PORTABLE.buildEnvelope({ ...cfg, dashboard_spec: { ...cfg.dashboard_spec, unexpected: true } }, customizationDescriptors()),
  /DASH080_|DASH084_/
);

// Explicit legacy V0 -> V1 migration is deterministic and remains dry-run.
const legacy = {
  schema: PORTABLE.LEGACY_SCHEMA,
  contract_version: PORTABLE.LEGACY_VERSION,
  dashboard_spec: cfg.dashboard_spec,
  bound_widgets: cfg.bound_widgets,
  customizations: customizationDescriptors()
};
const migratedA = PORTABLE.migrateLegacyObject(legacy);
const migratedB = PORTABLE.migrateLegacyObject({
  customizations: legacy.customizations,
  bound_widgets: legacy.bound_widgets,
  dashboard_spec: legacy.dashboard_spec,
  contract_version: legacy.contract_version,
  schema: legacy.schema
});
assert.strictEqual(migratedA.receipt.status, 'PASS');
assert.strictEqual(migratedA.receipt.migration_hash, migratedB.receipt.migration_hash);
assert.strictEqual(migratedA.envelope.portable_hash, migratedB.envelope.portable_hash);
const importedLegacy = PORTABLE.importPortableJson(PORTABLE.stableStringify(legacy));
assert(importedLegacy.migration_receipt);
assert.strictEqual(importedLegacy.migration_receipt.status, 'PASS');
assert.strictEqual(importedLegacy.persistence_performed, false);
assert.strictEqual(importedLegacy.portable_hash, migratedA.envelope.portable_hash);
expectCode(
  () => PORTABLE.migrateLegacyObject({ ...legacy, contract_version: '99.0.0' }),
  'DASH086_MIGRATION_SOURCE_UNSUPPORTED'
);

// Telemetry is allowlisted and cannot expose private query/widget/financial values.
const telemetry = PORTABLE.telemetry('EXPORT', envelope);
assert.deepStrictEqual(Object.keys(telemetry).sort(), PORTABLE.CONTRACT.telemetry_allowlist.slice().sort());
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['synthetic-private-category', 'w-0001', 'RUB', 'EXPENSE', 'Расходы']) {
  assert(!telemetryText.includes(forbidden), `telemetry leak: ${forbidden}`);
}

// Core module has no platform persistence/network/write dependency.
const source = fs.readFileSync(path.join(__dirname, '..', 'lib/dashboard/dashboard_portable_spec.js'), 'utf8');
for (const forbidden of [
  'PropertiesService', 'SpreadsheetApp', 'UrlFetchApp', 'DashboardSavedViewsStorageService',
  'setProperties(', 'getUserProperties(', 'createView(', 'saveVersion('
]) {
  assert(!source.includes(forbidden), `portable core gained persistence/write authority: ${forbidden}`);
}

console.log('dashboard_safe_import_export_contract_test: OK', {
  schema: `${PORTABLE.SCHEMA}@${PORTABLE.VERSION}`,
  portableHashPrefix: envelope.portable_hash.slice(0, 12),
  privateConfiguration: true,
  persistencePerformed: false,
  legacyMigration: true,
  prototypePollutionBlocked: true
});
