'use strict';

const CONTRACT = require('./privacy_presentation.v1.json');

const SCHEMA = 'PRH_PRIVACY_PRESENTATION_V1';
const VERSION = '1.0.0';
const PREFERENCE_SCHEMA = 'PRH_PRIVACY_MODE_PREFERENCE_V1';
const RESULT_SCHEMA = 'PRH_PRIVACY_TRANSFORM_RESULT_V1';
const TELEMETRY_SCHEMA = 'PRH_PRIVACY_PRESENTATION_TELEMETRY_V1';
const MODES = Object.freeze(CONTRACT.modes.slice());
const EXACT = new Set(CONTRACT.sensitive_key_exact.map((key) => String(key).toLowerCase()));
const SUFFIXES = Object.freeze(CONTRACT.sensitive_key_suffixes.map((key) => String(key).toLowerCase()));
const SAFE_ZEN = new Set(CONTRACT.safe_structural_keys.map((key) => String(key).toLowerCase()));

function fail(reason, detail) {
  const error = new Error(detail ? `${reason}:${detail}` : reason);
  error.code = reason;
  throw error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function clone(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(clone);
  const output = {};
  for (const [key, child] of Object.entries(value)) output[key] = clone(child);
  return output;
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'PRIV-080') {
    fail('PRIV080_CONTRACT_VERSION_INVALID');
  }
  if (CONTRACT.security_boundary !== false || CONTRACT.authorization_boundary !== false || CONTRACT.free_only !== true) {
    fail('PRIV080_BOUNDARY_INVALID');
  }
  if (JSON.stringify(MODES) !== JSON.stringify(['NORMAL', 'MASKED', 'DEMO', 'ZEN']) ||
      CONTRACT.default_mode !== 'NORMAL' || CONTRACT.invalid_mode_fail_safe !== 'MASKED') {
    fail('PRIV080_MODE_CONTRACT_INVALID');
  }
  if (!CONTRACT.preference || CONTRACT.preference.schema !== PREFERENCE_SCHEMA ||
      JSON.stringify(CONTRACT.preference.stored_fields) !== JSON.stringify(['schema', 'version', 'mode']) ||
      CONTRACT.preference.url_override_priority !== true || CONTRACT.preference.financial_payload_allowed !== false ||
      CONTRACT.preference.query_payload_allowed !== false || CONTRACT.preference.filter_payload_allowed !== false ||
      CONTRACT.preference.private_identifier_allowed !== false) {
    fail('PRIV080_PREFERENCE_BOUNDARY_INVALID');
  }
  if (CONTRACT.provenance.private !== 'PRIVATE_AUTHORIZED_PRESENTATION' ||
      CONTRACT.provenance.synthetic !== 'PUBLIC_SYNTHETIC' || CONTRACT.provenance.demo_requires_synthetic !== true ||
      CONTRACT.provenance.mixed_private_synthetic_allowed !== false) {
    fail('PRIV080_PROVENANCE_INVALID');
  }
  if (Object.values(CONTRACT.authority || {}).some((value) => value !== false)) fail('PRIV080_AUTHORITY_INVALID');
  return true;
}

function normalizeMode(value, { failSafe = false } = {}) {
  const mode = String(value == null ? '' : value).trim().toUpperCase();
  if (MODES.includes(mode)) return mode;
  if (failSafe) return CONTRACT.invalid_mode_fail_safe;
  fail('PRIV080_MODE_INVALID');
}

function forbiddenPreferenceKey(key) {
  const value = String(key || '').toLowerCase();
  return EXACT.has(value) || SUFFIXES.some((suffix) => value.endsWith(suffix)) ||
    ['query', 'analytics_query', 'filters', 'filter_context', 'scope', 'scope_spec', 'rows', 'dataset', 'payload', 'token', 'credential', 'runtime_locator'].includes(value);
}

function normalizePreference(input = {}) {
  assertContract();
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('PRIV080_PREFERENCE_SHAPE_INVALID');
  const allowed = new Set(['schema', 'version', 'mode']);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      if (forbiddenPreferenceKey(key)) fail('PRIV080_PREFERENCE_PAYLOAD_FORBIDDEN', key);
      fail('PRIV080_PREFERENCE_SHAPE_INVALID', key);
    }
  }
  if (input.schema != null && input.schema !== PREFERENCE_SCHEMA) fail('PRIV080_PREFERENCE_SCHEMA_INVALID');
  if (input.version != null && input.version !== VERSION) fail('PRIV080_PREFERENCE_VERSION_INVALID');
  return deepFreeze({
    schema: PREFERENCE_SCHEMA,
    version: VERSION,
    mode: normalizeMode(input.mode == null ? CONTRACT.default_mode : input.mode)
  });
}

function safeStoredPreference(input) {
  try {
    return normalizePreference(input || {});
  } catch (_) {
    return normalizePreference({ mode: CONTRACT.invalid_mode_fail_safe });
  }
}

function resolveMode({ url_mode = null, stored_preference = null } = {}) {
  assertContract();
  const explicit = String(url_mode == null ? '' : url_mode).trim();
  if (explicit) {
    const upper = explicit.toUpperCase();
    return deepFreeze({
      mode: MODES.includes(upper) ? upper : CONTRACT.invalid_mode_fail_safe,
      source: MODES.includes(upper) ? 'URL' : 'URL_FAIL_SAFE',
      explicit_invalid: !MODES.includes(upper)
    });
  }
  if (stored_preference) {
    const preference = safeStoredPreference(stored_preference);
    const valid = (() => { try { normalizePreference(stored_preference); return true; } catch (_) { return false; } })();
    return deepFreeze({ mode: preference.mode, source: valid ? 'PREFERENCE' : 'PREFERENCE_FAIL_SAFE', explicit_invalid: false });
  }
  return deepFreeze({ mode: CONTRACT.default_mode, source: 'DEFAULT', explicit_invalid: false });
}

function isSensitiveKey(key) {
  const normalized = String(key || '').toLowerCase();
  return EXACT.has(normalized) || SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function isZenSafeKey(key) {
  const normalized = String(key || '').toLowerCase();
  return SAFE_ZEN.has(normalized) || normalized.endsWith('_count') || normalized.endsWith('_available') || normalized.endsWith('_configured');
}

function transformMasked(value, evidence, parentSensitive = false) {
  if (parentSensitive) {
    evidence.suppressed_count += 1;
    return null;
  }
  if (Array.isArray(value)) return value.map((item) => transformMasked(item, evidence, false));
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    evidence.field_count += 1;
    if (isSensitiveKey(key)) {
      evidence.suppressed_count += 1;
      output[key] = null;
      continue;
    }
    output[key] = transformMasked(child, evidence, false);
  }
  return output;
}

function transformZen(value, evidence, keyHint = null) {
  if (Array.isArray(value)) {
    if (keyHint && !isZenSafeKey(keyHint)) {
      evidence.suppressed_count += value.length || 1;
      return [];
    }
    return value.map((item) => transformZen(item, evidence, keyHint));
  }
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    evidence.field_count += 1;
    if (isSensitiveKey(key) || !isZenSafeKey(key)) {
      evidence.suppressed_count += 1;
      continue;
    }
    output[key] = transformZen(child, evidence, key);
  }
  return output;
}

function validateSource(mode, source) {
  const normalized = String(source || '').trim().toUpperCase();
  if (!['PRIVATE_AUTHORIZED_PRESENTATION', 'PUBLIC_SYNTHETIC'].includes(normalized)) fail('PRIV080_SOURCE_INVALID');
  if (mode === 'DEMO' && normalized !== 'PUBLIC_SYNTHETIC') fail('PRIV080_DEMO_PRIVATE_SOURCE_FORBIDDEN');
  return normalized;
}

function transformPresentation(payload, { mode = CONTRACT.default_mode, source = CONTRACT.provenance.private } = {}) {
  assertContract();
  const normalizedMode = normalizeMode(mode);
  const normalizedSource = validateSource(normalizedMode, source);
  const before = clone(payload);
  const evidence = { field_count: 0, suppressed_count: 0 };
  let transformed;
  if (normalizedMode === 'NORMAL' || normalizedMode === 'DEMO') {
    transformed = clone(payload);
  } else if (normalizedMode === 'MASKED') {
    transformed = transformMasked(payload, evidence);
  } else {
    transformed = transformZen(payload, evidence);
  }
  const result = {
    schema: RESULT_SCHEMA,
    version: VERSION,
    mode: normalizedMode,
    source: normalizedSource,
    synthetic_only: normalizedSource === 'PUBLIC_SYNTHETIC',
    financial_truth_surface: normalizedMode === 'NORMAL' && normalizedSource === 'PRIVATE_AUTHORIZED_PRESENTATION',
    security_boundary: false,
    payload: transformed,
    evidence: { field_count: evidence.field_count, suppressed_count: evidence.suppressed_count }
  };
  if (JSON.stringify(payload) !== JSON.stringify(before)) fail('PRIV080_SOURCE_MUTATED');
  return deepFreeze(result);
}

function telemetry(result, { decision = 'ALLOW', reason = 'OK' } = {}) {
  if (!result || result.schema !== RESULT_SCHEMA || result.version !== VERSION) fail('PRIV080_RESULT_INVALID');
  const output = deepFreeze({
    schema: TELEMETRY_SCHEMA,
    version: VERSION,
    mode: result.mode,
    source: result.source,
    decision: String(decision || '').trim().toUpperCase(),
    reason: String(reason || '').trim().toUpperCase(),
    field_count: result.evidence.field_count,
    suppressed_count: result.evidence.suppressed_count,
    synthetic_only: result.synthetic_only
  });
  if (JSON.stringify(Object.keys(output).sort()) !== JSON.stringify(CONTRACT.telemetry_allowlist.slice().sort())) {
    fail('PRIV080_TELEMETRY_SHAPE_INVALID');
  }
  return output;
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  PREFERENCE_SCHEMA,
  RESULT_SCHEMA,
  TELEMETRY_SCHEMA,
  MODES,
  assertContract,
  normalizeMode,
  normalizePreference,
  resolveMode,
  isSensitiveKey,
  transformPresentation,
  telemetry
});
