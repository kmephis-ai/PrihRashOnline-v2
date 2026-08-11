'use strict';

const crypto = require('crypto');
const CONTRACT = require('./dashboard_portable_spec.v1.json');
const SAVED = require('./dashboard_saved_views');
const CUSTOM = require('./dashboard_visual_customization');
const COMPOSER = require('./dashboard_composer');
const FACTORY = require('./widget_factory');

const SCHEMA = 'PRH_DASHBOARD_PORTABLE_SPEC_V1';
const VERSION = '1.0.0';
const MANIFEST_SCHEMA = 'PRH_DASHBOARD_PORTABLE_MANIFEST_V1';
const PAYLOAD_SCHEMA = 'PRH_DASHBOARD_PORTABLE_PAYLOAD_V1';
const CUSTOMIZATION_DESCRIPTOR_SCHEMA = 'PRH_DASHBOARD_PORTABLE_CUSTOMIZATION_V1';
const IMPORT_RESULT_SCHEMA = 'PRH_DASHBOARD_PORTABLE_IMPORT_RESULT_V1';
const MIGRATION_SCHEMA = 'PRH_DASHBOARD_PORTABLE_MIGRATION_V1';
const LEGACY_SCHEMA = 'PRH_DASHBOARD_PORTABLE_SPEC_V0';
const LEGACY_VERSION = '0.9.0';

const PROTOTYPE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const FORBIDDEN_KEYS = new Set([
  'analytics_result', 'analytics_results', 'result_rows', 'transaction_rows', 'transactions', 'transaction',
  'dataset', 'datasets', 'financial_values', 'financial_value', 'amount', 'amount_minor', 'value_minor',
  'balance', 'balance_minor', 'income_minor', 'expense_minor', 'cash_flow_minor', 'savings_minor',
  'gross_expense_minor', 'refund_minor', 'transfer_minor', 'actual_total_minor', 'expected_total_minor',
  'oauth_token', 'access_token', 'refresh_token', 'id_token', 'credential', 'credentials', 'secret', 'secrets',
  'password', 'api_key', 'runtime_locator', 'deployment_url', 'deployment_id', 'script_id', 'apps_script_id',
  'spreadsheet_id', 'web_app_url', 'url', 'href', 'src', 'css', 'html', 'script', 'javascript', 'code',
  'function', 'formatter', 'callback'
]);
const HOSTILE_STRING_RE = /(?:<\/?script\b|javascript\s*:|data\s*:\s*text\/html|url\s*\(|https?:\/\/|script\.google\.com\/macros\/|\bAKfy[A-Za-z0-9_-]{8,}\b)/i;

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function byteLength(value) {
  return Buffer.byteLength(typeof value === 'string' ? value : stableStringify(value), 'utf8');
}

function exactKeys(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(keys.slice().sort())) fail(code);
  return value;
}

function assertNoForbiddenPayload(value, path = 'payload') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenPayload(item, `${path}[${index}]`));
    return true;
  }
  if (value == null || typeof value !== 'object') {
    if (typeof value === 'string' && HOSTILE_STRING_RE.test(value)) fail('DASH086_EXECUTABLE_OR_RUNTIME_VALUE_FORBIDDEN', path);
    return true;
  }
  for (const [key, child] of Object.entries(value)) {
    const normalized = String(key).toLowerCase();
    if (PROTOTYPE_KEYS.has(normalized)) fail('DASH086_PROTOTYPE_KEY_FORBIDDEN', `${path}.${key}`);
    if (FORBIDDEN_KEYS.has(normalized) || normalized.endsWith('_amount') || normalized.endsWith('_amount_minor') ||
        normalized.endsWith('_balance') || normalized.endsWith('_balance_minor') || normalized.endsWith('_token') ||
        normalized.endsWith('_secret') || normalized.endsWith('_url')) {
      fail('DASH086_FORBIDDEN_PAYLOAD_KEY', `${path}.${key}`);
    }
    assertNoForbiddenPayload(child, `${path}.${key}`);
  }
  return true;
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'DASH-086') {
    fail('DASH086_CONTRACT_INVALID');
  }
  SAVED.assertContract();
  CUSTOM.assertContract();
  COMPOSER.assertContract();
  FACTORY.assertContract();
  const schemas = CONTRACT.schemas || {};
  if (schemas.envelope !== SCHEMA || schemas.manifest !== MANIFEST_SCHEMA || schemas.payload !== PAYLOAD_SCHEMA ||
      schemas.customization_descriptor !== CUSTOMIZATION_DESCRIPTOR_SCHEMA || schemas.import_result !== IMPORT_RESULT_SCHEMA ||
      schemas.migration_receipt !== MIGRATION_SCHEMA || schemas.legacy !== LEGACY_SCHEMA) fail('DASH086_SCHEMA_CONTRACT_INVALID');
  const upstream = CONTRACT.upstream || {};
  if (upstream.saved_views !== `${SAVED.SCHEMA}@${SAVED.VERSION}` ||
      upstream.visual_customization !== `${CUSTOM.SCHEMA}@${CUSTOM.VERSION}` ||
      upstream.dashboard_composer !== `${COMPOSER.SCHEMA}@${COMPOSER.VERSION}` ||
      upstream.widget_factory !== `${FACTORY.SCHEMA}@${FACTORY.VERSION}` ||
      upstream.security_policy !== 'SEC-002' || upstream.financial_truth_policy !== 'FIN-TRUTH-v1') {
    fail('DASH086_UPSTREAM_CONTRACT_INVALID');
  }
  const p = CONTRACT.principles || {};
  if (p.configuration_only !== true || p.financial_dataset_snapshot_allowed !== false ||
      p.analytics_result_snapshot_allowed !== false || p.financial_output_values_allowed !== false ||
      p.credentials_allowed !== false || p.runtime_locator_allowed !== false || p.executable_payload_allowed !== false ||
      p.import_executes_code !== false || p.import_persists !== false || p.import_dry_run_only !== true ||
      p.upstream_identities_recomputed !== true || p.timestamps_in_identity !== false ||
      p.private_identifier_export_allowed !== true || p.public_safe_by_default !== false || p.free_only !== true) {
    fail('DASH086_BOUNDARY_INVALID');
  }
  if (!CONTRACT.authority || Object.values(CONTRACT.authority).some((value) => value !== false)) fail('DASH086_AUTHORITY_INVALID');
  if (CONTRACT.limits.max_widgets !== COMPOSER.CONTRACT.grid.max_widgets ||
      CONTRACT.limits.max_bindings !== COMPOSER.CONTRACT.grid.max_widgets ||
      CONTRACT.limits.max_customizations !== COMPOSER.CONTRACT.grid.max_widgets ||
      CONTRACT.limits.max_portable_bytes < SAVED.CONTRACT.limits.max_configuration_bytes) fail('DASH086_LIMIT_CONTRACT_INVALID');
  return true;
}

function rawConfiguration(configuration) {
  return deepFreeze({
    schema: SAVED.CONFIG_SCHEMA,
    contract_version: SAVED.VERSION,
    dashboard_spec: configuration.dashboard_spec,
    bound_widgets: configuration.bound_widgets
  });
}

function boundMap(configuration) {
  return new Map(configuration.bound_widgets.map((descriptor) => [descriptor.widget_id, descriptor.binding]));
}

function rawFactoryPresentation(binding) {
  const presentation = binding.presentation;
  if ((binding.kind === 'KPI' || binding.kind === 'CARD') && presentation && presentation.mode === binding.kind) {
    return {
      schema: presentation.schema,
      contract_version: presentation.contract_version,
      title: presentation.title,
      show_comparison: presentation.show_comparison
    };
  }
  return presentation;
}

function rawFactoryBinding(binding) {
  return {
    schema: binding.schema,
    contract_version: binding.contract_version,
    widget_id: binding.widget_id,
    kind: binding.kind,
    query: binding.query,
    presentation: rawFactoryPresentation(binding)
  };
}

function rawCustomizationForInput(binding, normalized) {
  return deepFreeze({
    schema: normalized.schema,
    contract_version: normalized.contract_version,
    theme: normalized.theme,
    palette: normalized.palette,
    chart_type: binding.kind === 'CHART' ? normalized.chart_type : null,
    axes: binding.kind === 'CHART' ? normalized.axes : null,
    labels: normalized.labels,
    legend: normalized.legend,
    stack: normalized.stack,
    sort: normalized.sort,
    top_n: normalized.top_n == null ? null : { n: normalized.top_n.n, remainder: normalized.top_n.remainder },
    number_format: normalized.number_format,
    density: normalized.density
  });
}

function rawCustomizationDescriptor(descriptor) {
  return deepFreeze({ widget_id: descriptor.widget_id, customization: descriptor.customization });
}

function normalizeExportCustomizationDescriptors(input, configuration) {
  if (!Array.isArray(input) || input.length > CONTRACT.limits.max_customizations) fail('DASH086_CUSTOMIZATION_COUNT_LIMIT');
  const bindings = boundMap(configuration);
  const seen = new Set();
  const normalized = input.map((descriptor) => {
    exactKeys(descriptor, ['widget_id', 'customization'], 'DASH086_EXPORT_CUSTOMIZATION_SHAPE_INVALID');
    const widgetId = String(descriptor.widget_id || '');
    if (seen.has(widgetId)) fail('DASH086_CUSTOMIZATION_DUPLICATE', widgetId);
    seen.add(widgetId);
    const binding = bindings.get(widgetId);
    if (!binding) fail('DASH086_CUSTOMIZATION_WIDGET_NOT_BOUND', widgetId);
    assertNoForbiddenPayload(descriptor.customization, `customizations.${widgetId}`);
    const applied = CUSTOM.applyCustomization(rawFactoryBinding(binding), descriptor.customization);
    if (applied.query_hash !== binding.query_hash || applied.query_modified !== false || applied.binding_hash !== binding.binding_hash) {
      fail('DASH086_CUSTOMIZATION_QUERY_IDENTITY_CHANGED', widgetId);
    }
    return deepFreeze({
      schema: CUSTOMIZATION_DESCRIPTOR_SCHEMA,
      contract_version: VERSION,
      widget_id: widgetId,
      customization: rawCustomizationForInput(binding, applied.customization)
    });
  });
  normalized.sort((a, b) => a.widget_id.localeCompare(b.widget_id));
  return deepFreeze(normalized);
}

function normalizeImportedCustomizationDescriptors(input, configuration) {
  if (!Array.isArray(input) || input.length > CONTRACT.limits.max_customizations) fail('DASH086_CUSTOMIZATION_COUNT_LIMIT');
  return normalizeExportCustomizationDescriptors(input.map((descriptor) => {
    exactKeys(descriptor, ['schema', 'contract_version', 'widget_id', 'customization'], 'DASH086_CUSTOMIZATION_DESCRIPTOR_SHAPE_INVALID');
    if (descriptor.schema !== CUSTOMIZATION_DESCRIPTOR_SCHEMA || descriptor.contract_version !== VERSION) fail('DASH086_CUSTOMIZATION_DESCRIPTOR_VERSION_INVALID');
    return { widget_id: descriptor.widget_id, customization: descriptor.customization };
  }), configuration);
}

function countPayload(configuration, customizations, byteCount) {
  const counts = deepFreeze({
    byte_count: byteCount,
    widget_count: configuration.dashboard_spec.widgets.length,
    binding_count: configuration.bound_widgets.length,
    customization_count: customizations.length
  });
  if (counts.widget_count > CONTRACT.limits.max_widgets) fail('DASH086_WIDGET_COUNT_LIMIT');
  if (counts.binding_count > CONTRACT.limits.max_bindings) fail('DASH086_BINDING_COUNT_LIMIT');
  if (counts.customization_count > CONTRACT.limits.max_customizations) fail('DASH086_CUSTOMIZATION_COUNT_LIMIT');
  return counts;
}

function createdBy() {
  return deepFreeze({
    portable_spec: `${SCHEMA}@${VERSION}`,
    saved_views: `${SAVED.SCHEMA}@${SAVED.VERSION}`,
    visual_customization: `${CUSTOM.SCHEMA}@${CUSTOM.VERSION}`,
    dashboard_composer: `${COMPOSER.SCHEMA}@${COMPOSER.VERSION}`,
    widget_factory: `${FACTORY.SCHEMA}@${FACTORY.VERSION}`
  });
}

function manifest() {
  return deepFreeze({
    schema: MANIFEST_SCHEMA,
    contract_version: VERSION,
    created_by: createdBy(),
    privacy_class: CONTRACT.privacy.classification,
    warning_code: CONTRACT.privacy.warning_code,
    warning_ru: CONTRACT.privacy.warning_ru,
    public_safe: false,
    contains_financial_dataset: false,
    contains_financial_values: false,
    contains_credentials: false,
    contains_runtime_locator: false,
    dry_run_import_only: true
  });
}

function buildEnvelope(configurationInput, customizationsInput = []) {
  assertContract();
  assertNoForbiddenPayload(configurationInput, 'configuration');
  const configuration = SAVED.normalizeConfiguration(configurationInput);
  const customizations = normalizeExportCustomizationDescriptors(customizationsInput, configuration);
  const payload = deepFreeze({
    schema: PAYLOAD_SCHEMA,
    contract_version: VERSION,
    configuration: rawConfiguration(configuration),
    customizations
  });
  assertNoForbiddenPayload(payload);
  const payloadText = stableStringify(payload);
  const payloadHash = sha256(payloadText);
  const counts = countPayload(configuration, customizations, byteLength(payloadText));
  const identity = deepFreeze({
    schema: SCHEMA,
    contract_version: VERSION,
    manifest: manifest(),
    payload,
    payload_hash: payloadHash,
    counts
  });
  const portableHash = sha256(stableStringify(identity));
  const envelope = deepFreeze({
    ...identity,
    portable_hash: portableHash,
    checksum: `${CONTRACT.checksum.prefix}${portableHash}`
  });
  if (byteLength(envelope) > CONTRACT.limits.max_portable_bytes) fail('DASH086_PORTABLE_SIZE_LIMIT');
  return envelope;
}

function serializePortable(envelopeInput) {
  const validated = validateEnvelopeObject(envelopeInput);
  const text = stableStringify(validated.envelope);
  if (byteLength(text) > CONTRACT.limits.max_portable_bytes) fail('DASH086_PORTABLE_SIZE_LIMIT');
  return text;
}

class JsonParser {
  constructor(text) { this.text = text; this.index = 0; }
  error(code) { fail(code, `offset=${this.index}`); }
  skipWhitespace() { while (this.index < this.text.length && /\s/.test(this.text[this.index])) this.index += 1; }
  parse() {
    this.skipWhitespace();
    const value = this.parseValue(0);
    this.skipWhitespace();
    if (this.index !== this.text.length) this.error('DASH086_JSON_TRAILING_CONTENT');
    return value;
  }
  parseValue(depth) {
    if (depth > CONTRACT.limits.max_json_depth) this.error('DASH086_JSON_DEPTH_LIMIT');
    this.skipWhitespace();
    const c = this.text[this.index];
    if (c === '{') return this.parseObject(depth + 1);
    if (c === '[') return this.parseArray(depth + 1);
    if (c === '"') return this.parseString();
    if (c === '-' || (c >= '0' && c <= '9')) return this.parseNumber();
    if (this.text.startsWith('true', this.index)) { this.index += 4; return true; }
    if (this.text.startsWith('false', this.index)) { this.index += 5; return false; }
    if (this.text.startsWith('null', this.index)) { this.index += 4; return null; }
    this.error('DASH086_JSON_VALUE_INVALID');
  }
  parseString() {
    const start = this.index;
    this.index += 1;
    let escaped = false;
    while (this.index < this.text.length) {
      const c = this.text[this.index];
      if (!escaped && c === '"') {
        this.index += 1;
        const raw = this.text.slice(start, this.index);
        let value;
        try { value = JSON.parse(raw); } catch (_) { this.error('DASH086_JSON_STRING_INVALID'); }
        if (value.length > CONTRACT.limits.max_string_length) this.error('DASH086_JSON_STRING_LIMIT');
        return value;
      }
      if (!escaped && c.charCodeAt(0) < 0x20) this.error('DASH086_JSON_STRING_CONTROL_CHAR');
      if (!escaped && c === '\\') escaped = true; else escaped = false;
      this.index += 1;
    }
    this.error('DASH086_JSON_STRING_UNTERMINATED');
  }
  parseNumber() {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.text.slice(this.index));
    if (!match) this.error('DASH086_JSON_NUMBER_INVALID');
    this.index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) this.error('DASH086_JSON_NUMBER_INVALID');
    return value;
  }
  parseArray(depth) {
    this.index += 1;
    const output = [];
    this.skipWhitespace();
    if (this.text[this.index] === ']') { this.index += 1; return output; }
    while (true) {
      output.push(this.parseValue(depth));
      this.skipWhitespace();
      const c = this.text[this.index];
      if (c === ']') { this.index += 1; return output; }
      if (c !== ',') this.error('DASH086_JSON_ARRAY_SEPARATOR_INVALID');
      this.index += 1;
    }
  }
  parseObject(depth) {
    this.index += 1;
    const output = Object.create(null);
    const keys = new Set();
    this.skipWhitespace();
    if (this.text[this.index] === '}') { this.index += 1; return output; }
    while (true) {
      this.skipWhitespace();
      if (this.text[this.index] !== '"') this.error('DASH086_JSON_OBJECT_KEY_INVALID');
      const key = this.parseString();
      const normalized = key.toLowerCase();
      if (keys.has(key)) fail('DASH086_JSON_DUPLICATE_KEY', key);
      if (PROTOTYPE_KEYS.has(normalized)) fail('DASH086_PROTOTYPE_KEY_FORBIDDEN', key);
      keys.add(key);
      this.skipWhitespace();
      if (this.text[this.index] !== ':') this.error('DASH086_JSON_OBJECT_COLON_INVALID');
      this.index += 1;
      output[key] = this.parseValue(depth);
      this.skipWhitespace();
      const c = this.text[this.index];
      if (c === '}') { this.index += 1; return output; }
      if (c !== ',') this.error('DASH086_JSON_OBJECT_SEPARATOR_INVALID');
      this.index += 1;
    }
  }
}

function parseBoundedJson(textInput) {
  assertContract();
  if (typeof textInput !== 'string') fail('DASH086_JSON_TEXT_REQUIRED');
  if (byteLength(textInput) > CONTRACT.limits.max_portable_bytes) fail('DASH086_PORTABLE_SIZE_LIMIT');
  return new JsonParser(textInput).parse();
}

function normalizeManifest(input) {
  exactKeys(input, [
    'schema', 'contract_version', 'created_by', 'privacy_class', 'warning_code', 'warning_ru', 'public_safe',
    'contains_financial_dataset', 'contains_financial_values', 'contains_credentials', 'contains_runtime_locator',
    'dry_run_import_only'
  ], 'DASH086_MANIFEST_SHAPE_INVALID');
  exactKeys(input.created_by, ['portable_spec', 'saved_views', 'visual_customization', 'dashboard_composer', 'widget_factory'], 'DASH086_CREATED_BY_SHAPE_INVALID');
  const expected = manifest();
  if (stableStringify(input) !== stableStringify(expected)) fail('DASH086_MANIFEST_INVALID');
  return expected;
}

function normalizePayload(input) {
  exactKeys(input, ['schema', 'contract_version', 'configuration', 'customizations'], 'DASH086_PAYLOAD_SHAPE_INVALID');
  if (input.schema !== PAYLOAD_SCHEMA || input.contract_version !== VERSION) fail('DASH086_PAYLOAD_VERSION_INVALID');
  assertNoForbiddenPayload(input);
  const configuration = SAVED.normalizeConfiguration(input.configuration);
  const customizations = normalizeImportedCustomizationDescriptors(input.customizations, configuration);
  return deepFreeze({ schema: PAYLOAD_SCHEMA, contract_version: VERSION, configuration: rawConfiguration(configuration), customizations });
}

function validateEnvelopeObject(input) {
  assertContract();
  exactKeys(input, ['schema', 'contract_version', 'manifest', 'payload', 'payload_hash', 'counts', 'portable_hash', 'checksum'], 'DASH086_ENVELOPE_SHAPE_INVALID');
  if (input.schema !== SCHEMA || input.contract_version !== VERSION) fail('DASH086_ENVELOPE_VERSION_INVALID');
  exactKeys(input.counts, ['byte_count', 'widget_count', 'binding_count', 'customization_count'], 'DASH086_COUNTS_SHAPE_INVALID');
  normalizeManifest(input.manifest);
  const rawPayloadHash = sha256(stableStringify(input.payload));
  if (input.payload_hash !== rawPayloadHash) fail('DASH086_PAYLOAD_CHECKSUM_MISMATCH');
  const rawIdentity = { schema: input.schema, contract_version: input.contract_version, manifest: input.manifest, payload: input.payload, payload_hash: input.payload_hash, counts: input.counts };
  const rawPortableHash = sha256(stableStringify(rawIdentity));
  if (input.portable_hash !== rawPortableHash || input.checksum !== `${CONTRACT.checksum.prefix}${rawPortableHash}`) fail('DASH086_ENVELOPE_CHECKSUM_MISMATCH');
  const payload = normalizePayload(input.payload);
  const configuration = SAVED.normalizeConfiguration(payload.configuration);
  const counts = countPayload(configuration, payload.customizations, byteLength(stableStringify(payload)));
  if (stableStringify(counts) !== stableStringify(input.counts)) fail('DASH086_COUNT_MISMATCH');
  if (stableStringify(payload) !== stableStringify(input.payload)) fail('DASH086_NON_CANONICAL_PAYLOAD');
  const canonical = buildEnvelope(payload.configuration, payload.customizations.map(rawCustomizationDescriptor));
  if (canonical.payload_hash !== input.payload_hash || canonical.portable_hash !== input.portable_hash || canonical.checksum !== input.checksum) fail('DASH086_REEXPORT_IDENTITY_MISMATCH');
  return deepFreeze({ envelope: canonical, configuration, customizations: payload.customizations, counts });
}

function importResult(validated, migrationReceipt = null) {
  return deepFreeze({
    schema: IMPORT_RESULT_SCHEMA,
    contract_version: VERSION,
    status: 'VALID',
    decision: 'DRY_RUN_ONLY',
    persistence_performed: false,
    persistence_authority: false,
    persistence_requires: 'DASH-084_SAVED_VIEW_LIFECYCLE_EXPLICIT_CALL',
    privacy_class: CONTRACT.privacy.classification,
    warning_code: CONTRACT.privacy.warning_code,
    warning_ru: CONTRACT.privacy.warning_ru,
    payload_hash: validated.envelope.payload_hash,
    portable_hash: validated.envelope.portable_hash,
    counts: validated.counts,
    configuration: rawConfiguration(validated.configuration),
    customizations: validated.customizations,
    migration_receipt: migrationReceipt
  });
}

function migrateLegacyObject(legacyInput) {
  exactKeys(legacyInput, ['schema', 'contract_version', 'dashboard_spec', 'bound_widgets', 'customizations'], 'DASH086_LEGACY_SHAPE_INVALID');
  if (legacyInput.schema !== LEGACY_SCHEMA || legacyInput.contract_version !== LEGACY_VERSION) fail('DASH086_MIGRATION_SOURCE_UNSUPPORTED');
  assertNoForbiddenPayload(legacyInput, 'legacy');
  if (!Array.isArray(legacyInput.customizations)) fail('DASH086_LEGACY_CUSTOMIZATIONS_INVALID');
  const configurationInput = { schema: SAVED.CONFIG_SCHEMA, contract_version: SAVED.VERSION, dashboard_spec: legacyInput.dashboard_spec, bound_widgets: legacyInput.bound_widgets };
  const envelope = buildEnvelope(configurationInput, legacyInput.customizations);
  const receiptBody = deepFreeze({
    schema: MIGRATION_SCHEMA, contract_version: VERSION, from_schema: LEGACY_SCHEMA, from_version: LEGACY_VERSION,
    to_schema: SCHEMA, to_version: VERSION, source_hash: sha256(stableStringify(legacyInput)), target_portable_hash: envelope.portable_hash, status: 'PASS'
  });
  const receipt = deepFreeze({ ...receiptBody, migration_hash: sha256(stableStringify(receiptBody)) });
  return deepFreeze({ envelope, receipt });
}

function importPortableJson(textInput) {
  const parsed = parseBoundedJson(textInput);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('DASH086_ROOT_OBJECT_REQUIRED');
  if (parsed.schema === LEGACY_SCHEMA) {
    const migrated = migrateLegacyObject(parsed);
    return importResult(validateEnvelopeObject(migrated.envelope), migrated.receipt);
  }
  if (parsed.schema !== SCHEMA) fail('DASH086_SCHEMA_UNSUPPORTED');
  return importResult(validateEnvelopeObject(parsed), null);
}

function reexportImported(imported) {
  exactKeys(imported, [
    'schema', 'contract_version', 'status', 'decision', 'persistence_performed', 'persistence_authority',
    'persistence_requires', 'privacy_class', 'warning_code', 'warning_ru', 'payload_hash', 'portable_hash',
    'counts', 'configuration', 'customizations', 'migration_receipt'
  ], 'DASH086_IMPORT_RESULT_SHAPE_INVALID');
  if (imported.schema !== IMPORT_RESULT_SCHEMA || imported.contract_version !== VERSION || imported.status !== 'VALID' ||
      imported.decision !== 'DRY_RUN_ONLY' || imported.persistence_performed !== false || imported.persistence_authority !== false) fail('DASH086_IMPORT_RESULT_INVALID');
  return buildEnvelope(imported.configuration, imported.customizations.map(rawCustomizationDescriptor));
}

function telemetry(action, source, decision = 'ACCEPTED', reason = 'OK') {
  assertContract();
  const envelope = source && source.schema === IMPORT_RESULT_SCHEMA ? reexportImported(source) : validateEnvelopeObject(source).envelope;
  const output = deepFreeze({
    schema: SCHEMA, version: VERSION, action: String(action || '').toUpperCase(), payload_hash_prefix: envelope.payload_hash.slice(0, 12),
    byte_count: envelope.counts.byte_count, widget_count: envelope.counts.widget_count, binding_count: envelope.counts.binding_count,
    customization_count: envelope.counts.customization_count, decision: String(decision || '').toUpperCase(), reason: String(reason || '').toUpperCase()
  });
  if (JSON.stringify(Object.keys(output).sort()) !== JSON.stringify(CONTRACT.telemetry_allowlist.slice().sort())) fail('DASH086_TELEMETRY_SHAPE_INVALID');
  return output;
}

assertContract();

module.exports = Object.freeze({
  CONTRACT, SCHEMA, VERSION, MANIFEST_SCHEMA, PAYLOAD_SCHEMA, CUSTOMIZATION_DESCRIPTOR_SCHEMA, IMPORT_RESULT_SCHEMA,
  MIGRATION_SCHEMA, LEGACY_SCHEMA, LEGACY_VERSION, assertContract, assertNoForbiddenPayload, buildEnvelope, serializePortable,
  parseBoundedJson, validateEnvelopeObject, importPortableJson, migrateLegacyObject, reexportImported, telemetry, stableStringify
});
