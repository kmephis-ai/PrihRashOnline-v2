'use strict';

const crypto = require('crypto');
const CONTRACT = require('./household_preferences.v1.json');
const DESIGN = require('../design/design_system.v1.json');
const AUTH = require('../auth/family_auth.v1.json');

const SCHEMA = 'PRH_HOUSEHOLD_PREFERENCES_V1';
const VERSION = '1.0.0';
const CONFIG_SCHEMA = CONTRACT.schemas.configuration;
const PREF_SCHEMA = CONTRACT.schemas.preferences;
const PLAN_SCHEMA = CONTRACT.schemas.mutation_plan;
const TELEMETRY_SCHEMA = CONTRACT.schemas.telemetry;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const FINANCIAL_KEYS = new Set([
  'amount', 'amount_minor', 'transaction', 'transactions', 'account', 'accounts', 'category', 'categories',
  'income', 'expense', 'cash_flow', 'savings', 'budget_variance', 'kpi', 'kpis', 'rows', 'dataset', 'results'
]);

function fail(reason, detail) {
  const error = new Error(detail ? `${reason}:${detail}` : reason);
  error.code = reason;
  throw error;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function assertContract() {
  if (CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'PROF-020') fail('PROFILE_CONTRACT_VERSION_INVALID');
  if (DESIGN.schema !== 'PRH_DESIGN_SYSTEM_V1' || DESIGN.version !== '1.0.0') fail('PROFILE_DESIGN_UPSTREAM_INVALID');
  if (AUTH.schema !== 'PRH_FAMILY_AUTH_V1' || AUTH.version !== '1.0.0') fail('PROFILE_AUTH_UPSTREAM_INVALID');
  const designThemes = Object.keys(DESIGN.themes || {}).map((item) => item.toUpperCase()).sort();
  if (stableStringify(designThemes) !== stableStringify(['DARK', 'LIGHT'])) fail('PROFILE_THEME_UPSTREAM_INVALID');
  const authRoles = Object.keys(AUTH.roles || {}).sort();
  if (stableStringify(authRoles) !== stableStringify(CONTRACT.profile.member_roles.slice().sort())) fail('PROFILE_ROLE_UPSTREAM_INVALID');
  for (const [action, capability] of Object.entries(CONTRACT.actions || {})) {
    const known = Object.values(AUTH.roles || {}).some((capabilities) => capabilities.includes(capability));
    if (!known) fail('PROFILE_CAPABILITY_UPSTREAM_INVALID', `${action}:${capability}`);
  }
  if (Object.values(CONTRACT.authority || {}).some((value) => value !== false)) fail('PROFILE_AUTHORITY_INVALID');
  const inv = CONTRACT.invariants || {};
  if (inv.configuration_separate_from_financial_domain !== true || inv.canonical_financial_data_mutation !== false ||
      inv.identity_provider_provisioning !== false || inv.public_runtime_exposure_change !== false ||
      inv.storage_authority !== false || inv.network_authority !== false || inv.financial_write !== false || inv.free_only !== true) {
    fail('PROFILE_INVARIANT_INVALID');
  }
  if (CONTRACT.cost.mode !== 'FREE_ONLY' || CONTRACT.cost.paid_dependency_required !== false) fail('PROFILE_COST_INVALID');
  return true;
}

function exactKeys(value, allowed, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length) fail(reason, extra.join(','));
}

function assertNoFinancialPayload(value, path = 'configuration') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoFinancialPayload(item, `${path}[${index}]`));
    return true;
  }
  if (!value || typeof value !== 'object') return true;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (FINANCIAL_KEYS.has(normalized) || normalized.endsWith('_amount') || normalized.endsWith('_amount_minor') ||
        normalized.includes('token') || normalized.includes('credential') || normalized.includes('runtime_locator') ||
        normalized.includes('scope_assignment')) {
      fail('PROFILE_FORBIDDEN_PAYLOAD_KEY', `${path}.${key}`);
    }
    assertNoFinancialPayload(child, `${path}.${key}`);
  }
  return true;
}

function opaqueId(value, reason) {
  const text = String(value || '').trim();
  if (!ID_RE.test(text)) fail(reason);
  return text;
}

function displayText(value, max, reason) {
  const text = String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  if (!text || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) fail(reason);
  return text;
}

function enumValue(value, allowed, reason) {
  const text = String(value || '').trim().toUpperCase();
  if (!allowed.includes(text)) fail(reason);
  return text;
}

function normalizeTextScale(value) {
  const policy = CONTRACT.preferences.text_scale;
  const number = value == null ? policy.default : Number(value);
  if (!Number.isFinite(number) || number < policy.minimum || number > policy.maximum) fail('PROFILE_TEXT_SCALE_INVALID');
  const units = Math.round((number - policy.minimum) / policy.step);
  const snapped = Number((policy.minimum + units * policy.step).toFixed(2));
  if (Math.abs(snapped - number) > 1e-9) fail('PROFILE_TEXT_SCALE_STEP_INVALID');
  return snapped;
}

function normalizePreferences(input = {}) {
  assertContract();
  assertNoFinancialPayload(input, 'preferences');
  exactKeys(input, ['schema', 'version', 'theme', 'density', 'locale', 'reduced_motion', 'high_contrast', 'text_scale', 'default_landing_zone'], 'PROFILE_PREFERENCES_SHAPE_INVALID');
  if (input.schema != null && input.schema !== PREF_SCHEMA) fail('PROFILE_PREFERENCES_SCHEMA_INVALID');
  if (input.version != null && input.version !== VERSION) fail('PROFILE_PREFERENCES_VERSION_INVALID');
  const output = {
    schema: PREF_SCHEMA,
    version: VERSION,
    theme: enumValue(input.theme == null ? 'SYSTEM' : input.theme, CONTRACT.preferences.theme, 'PROFILE_THEME_INVALID'),
    density: enumValue(input.density == null ? 'COMFORTABLE' : input.density, CONTRACT.preferences.density, 'PROFILE_DENSITY_INVALID'),
    locale: String(input.locale == null ? 'ru-RU' : input.locale),
    reduced_motion: enumValue(input.reduced_motion == null ? 'SYSTEM' : input.reduced_motion, CONTRACT.preferences.reduced_motion, 'PROFILE_REDUCED_MOTION_INVALID'),
    high_contrast: enumValue(input.high_contrast == null ? 'SYSTEM' : input.high_contrast, CONTRACT.preferences.high_contrast, 'PROFILE_HIGH_CONTRAST_INVALID'),
    text_scale: normalizeTextScale(input.text_scale),
    default_landing_zone: enumValue(input.default_landing_zone == null ? 'HOME' : input.default_landing_zone, CONTRACT.preferences.default_landing_zone, 'PROFILE_LANDING_ZONE_INVALID')
  };
  if (!CONTRACT.preferences.locale.includes(output.locale)) fail('PROFILE_LOCALE_INVALID');
  return deepFreeze(output);
}

function normalizeMember(input) {
  assertNoFinancialPayload(input, 'member');
  exactKeys(input, ['id', 'display_name', 'role', 'state', 'preferences'], 'PROFILE_MEMBER_SHAPE_INVALID');
  return deepFreeze({
    id: opaqueId(input.id, 'PROFILE_MEMBER_ID_INVALID'),
    display_name: displayText(input.display_name, CONTRACT.profile.display_name_max_length, 'PROFILE_MEMBER_NAME_INVALID'),
    role: enumValue(input.role, CONTRACT.profile.member_roles, 'PROFILE_MEMBER_ROLE_INVALID'),
    state: enumValue(input.state == null ? 'ACTIVE' : input.state, CONTRACT.profile.member_states, 'PROFILE_MEMBER_STATE_INVALID'),
    preferences: normalizePreferences(input.preferences || {})
  });
}

function normalizeConfiguration(input) {
  assertContract();
  assertNoFinancialPayload(input);
  exactKeys(input, ['schema', 'version', 'household', 'members'], 'PROFILE_CONFIGURATION_SHAPE_INVALID');
  if (input.schema !== CONFIG_SCHEMA || input.version !== VERSION) fail('PROFILE_CONFIGURATION_VERSION_INVALID');
  exactKeys(input.household, ['id', 'display_name'], 'PROFILE_HOUSEHOLD_SHAPE_INVALID');
  if (!Array.isArray(input.members) || input.members.length < 1 || input.members.length > CONTRACT.profile.maximum_members) fail('PROFILE_MEMBER_COUNT_INVALID');
  const members = input.members.map(normalizeMember).sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(members.map((member) => member.id)).size !== members.length) fail('PROFILE_MEMBER_ID_DUPLICATE');
  if (members.filter((member) => member.role === 'OWNER' && member.state === 'ACTIVE').length < 1) fail('PROFILE_ACTIVE_OWNER_REQUIRED');
  return deepFreeze({
    schema: CONFIG_SCHEMA,
    version: VERSION,
    household: deepFreeze({
      id: opaqueId(input.household.id, 'PROFILE_HOUSEHOLD_ID_INVALID'),
      display_name: displayText(input.household.display_name, CONTRACT.profile.household_name_max_length, 'PROFILE_HOUSEHOLD_NAME_INVALID')
    }),
    members: deepFreeze(members)
  });
}

function serializeConfiguration(input) {
  const normalized = normalizeConfiguration(input);
  return stableStringify(normalized);
}

function requiredCapability(action) {
  const normalizedAction = String(action || '').trim().toUpperCase();
  const capability = CONTRACT.actions[normalizedAction];
  if (!capability) fail('PROFILE_ACTION_UNSUPPORTED');
  return Object.freeze({ action: normalizedAction, required_capability: capability });
}

function planMutation(input) {
  assertContract();
  assertNoFinancialPayload(input, 'mutation');
  exactKeys(input, ['action', 'actor_member_id', 'target_member_id'], 'PROFILE_MUTATION_SHAPE_INVALID');
  const rule = requiredCapability(input.action);
  const actor = opaqueId(input.actor_member_id, 'PROFILE_ACTOR_ID_INVALID');
  const target = input.target_member_id == null ? actor : opaqueId(input.target_member_id, 'PROFILE_TARGET_ID_INVALID');
  if ((rule.action === 'UPDATE_SELF_PROFILE' || rule.action === 'UPDATE_SELF_PREFERENCES') && target !== actor) fail('PROFILE_SELF_ACTION_TARGET_MISMATCH');
  return deepFreeze({
    schema: PLAN_SCHEMA,
    version: VERSION,
    action: rule.action,
    actor_member_id: actor,
    target_member_id: target,
    required_capability: rule.required_capability,
    authorization_granted: false,
    mutation_executed: false,
    financial_write: false
  });
}

function hmacId(value, key) {
  const bytes = Buffer.isBuffer(key) ? key : Buffer.from(String(key || ''), 'utf8');
  if (bytes.length < CONTRACT.privacy.minimum_telemetry_key_bytes) fail('PROFILE_TELEMETRY_KEY_TOO_SHORT');
  return crypto.createHmac('sha256', bytes).update(String(value), 'utf8').digest('hex');
}

function telemetry(configurationInput, { key, action = 'READ', member_id = null, decision = 'ALLOW', reason_code = 'OK' } = {}) {
  const config = normalizeConfiguration(configurationInput);
  const actionText = String(action || '').trim().toUpperCase();
  const allowedAction = actionText === 'READ' ? null : requiredCapability(actionText);
  const selected = member_id == null ? null : config.members.find((member) => member.id === member_id);
  if (member_id != null && !selected) fail('PROFILE_TELEMETRY_MEMBER_UNKNOWN');
  const firstPreferences = selected ? selected.preferences : config.members[0].preferences;
  const output = {
    schema: TELEMETRY_SCHEMA,
    version: VERSION,
    action: actionText,
    required_capability: allowedAction ? allowedAction.required_capability : null,
    theme: firstPreferences.theme,
    density: firstPreferences.density,
    reduced_motion: firstPreferences.reduced_motion,
    high_contrast: firstPreferences.high_contrast,
    member_count: config.members.length,
    household_hash: hmacId(config.household.id, key),
    member_hash: selected ? hmacId(selected.id, key) : null,
    decision: String(decision || '').trim().toUpperCase(),
    reason_code: String(reason_code || '').trim().toUpperCase()
  };
  const extra = Object.keys(output).filter((field) => !CONTRACT.privacy.telemetry_allowlist.includes(field));
  if (extra.length) fail('PROFILE_TELEMETRY_FIELD_FORBIDDEN', extra.join(','));
  return deepFreeze(output);
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  CONFIG_SCHEMA,
  PREF_SCHEMA,
  PLAN_SCHEMA,
  TELEMETRY_SCHEMA,
  stableStringify,
  assertContract,
  assertNoFinancialPayload,
  normalizePreferences,
  normalizeMember,
  normalizeConfiguration,
  serializeConfiguration,
  requiredCapability,
  planMutation,
  telemetry
});
