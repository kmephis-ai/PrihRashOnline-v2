'use strict';

const assert = require('assert');
const profile = require('../lib/profile/household_preferences');
const DESIGN = require('../lib/design/design_system.v1.json');
const AUTH = require('../lib/auth/family_auth.v1.json');

function fixture() {
  return {
    schema: profile.CONFIG_SCHEMA,
    version: profile.VERSION,
    household: { id: 'hh-synthetic-01', display_name: 'Тестовая семья' },
    members: [
      { id: 'member-owner', display_name: 'Владелец', role: 'OWNER', state: 'ACTIVE', preferences: {} },
      { id: 'member-viewer', display_name: 'Участник', role: 'VIEWER', state: 'ACTIVE', preferences: { theme: 'DARK', density: 'COMPACT', text_scale: 1.1, default_landing_zone: 'TRANSACTIONS' } }
    ]
  };
}

assert.strictEqual(profile.CONTRACT.schema, 'PRH_HOUSEHOLD_PREFERENCES_V1');
assert.strictEqual(profile.CONTRACT.version, '1.0.0');
assert.strictEqual(profile.CONTRACT.roadmap_id, 'PROF-020');
assert.strictEqual(profile.CONTRACT.invariants.financial_write, false);
assert.strictEqual(profile.CONTRACT.cost.mode, 'FREE_ONLY');
assert.strictEqual(profile.CONTRACT.cost.paid_dependency_required, false);
assert.ok(Object.values(profile.CONTRACT.authority).every((value) => value === false));
assert.deepStrictEqual(Object.keys(AUTH.roles).sort(), profile.CONTRACT.profile.member_roles.slice().sort());
assert.deepStrictEqual(Object.keys(DESIGN.themes).map((item) => item.toUpperCase()).sort(), ['DARK', 'LIGHT']);

const defaults = profile.normalizePreferences({});
assert.strictEqual(defaults.theme, 'SYSTEM');
assert.strictEqual(defaults.density, 'COMFORTABLE');
assert.strictEqual(defaults.locale, 'ru-RU');
assert.strictEqual(defaults.reduced_motion, 'SYSTEM');
assert.strictEqual(defaults.high_contrast, 'SYSTEM');
assert.strictEqual(defaults.text_scale, 1);
assert.strictEqual(defaults.default_landing_zone, 'HOME');
assert(Object.isFrozen(defaults));

const normalized = profile.normalizeConfiguration(fixture());
assert.strictEqual(normalized.members.length, 2);
assert.strictEqual(normalized.members[1].preferences.theme, 'DARK');
assert(Object.isFrozen(normalized));
assert(Object.isFrozen(normalized.members));
assert(Object.isFrozen(normalized.members[0].preferences));

const reordered = fixture();
reordered.members.reverse();
assert.strictEqual(profile.serializeConfiguration(fixture()), profile.serializeConfiguration(reordered));

assert.throws(() => profile.normalizePreferences({ theme: 'UNKNOWN' }), (error) => error.code === 'PROFILE_THEME_INVALID');
assert.throws(() => profile.normalizePreferences({ locale: 'xx-XX' }), (error) => error.code === 'PROFILE_LOCALE_INVALID');
assert.throws(() => profile.normalizePreferences({ text_scale: 1.17 }), (error) => error.code === 'PROFILE_TEXT_SCALE_STEP_INVALID');
assert.throws(() => profile.normalizePreferences({ text_scale: 1.35 }), (error) => error.code === 'PROFILE_TEXT_SCALE_INVALID');
assert.throws(() => profile.normalizePreferences({ default_landing_zone: 'UNKNOWN' }), (error) => error.code === 'PROFILE_LANDING_ZONE_INVALID');
assert.throws(() => profile.normalizePreferences({ amount_minor: 123 }), (error) => error.code === 'PROFILE_FORBIDDEN_PAYLOAD_KEY');

const badRole = fixture();
badRole.members[1].role = 'ADMIN';
assert.throws(() => profile.normalizeConfiguration(badRole), (error) => error.code === 'PROFILE_MEMBER_ROLE_INVALID');

const duplicate = fixture();
duplicate.members[1].id = 'member-owner';
assert.throws(() => profile.normalizeConfiguration(duplicate), (error) => error.code === 'PROFILE_MEMBER_ID_DUPLICATE');

const noOwner = fixture();
noOwner.members[0].role = 'EDITOR';
assert.throws(() => profile.normalizeConfiguration(noOwner), (error) => error.code === 'PROFILE_ACTIVE_OWNER_REQUIRED');

assert.deepStrictEqual(profile.requiredCapability('UPDATE_SELF_PROFILE'), { action: 'UPDATE_SELF_PROFILE', required_capability: 'PROFILE_EDIT' });
assert.deepStrictEqual(profile.requiredCapability('CHANGE_MEMBER_ROLE'), { action: 'CHANGE_MEMBER_ROLE', required_capability: 'HOUSEHOLD_ADMIN' });
assert.throws(() => profile.requiredCapability('UNKNOWN'), (error) => error.code === 'PROFILE_ACTION_UNSUPPORTED');

const selfPlan = profile.planMutation({ action: 'UPDATE_SELF_PREFERENCES', actor_member_id: 'member-owner', target_member_id: 'member-owner' });
assert.strictEqual(selfPlan.required_capability, 'PROFILE_EDIT');
assert.strictEqual(selfPlan.authorization_granted, false);
assert.strictEqual(selfPlan.mutation_executed, false);
assert.strictEqual(selfPlan.financial_write, false);
assert.throws(() => profile.planMutation({ action: 'UPDATE_SELF_PROFILE', actor_member_id: 'member-owner', target_member_id: 'member-viewer' }), (error) => error.code === 'PROFILE_SELF_ACTION_TARGET_MISMATCH');

const adminPlan = profile.planMutation({ action: 'CHANGE_MEMBER_ROLE', actor_member_id: 'member-owner', target_member_id: 'member-viewer' });
assert.strictEqual(adminPlan.required_capability, 'HOUSEHOLD_ADMIN');
assert.strictEqual(adminPlan.authorization_granted, false);

const key = Buffer.alloc(32, 7);
const event = profile.telemetry(fixture(), { key, action: 'CHANGE_MEMBER_ROLE', member_id: 'member-viewer', decision: 'DENY', reason_code: 'CAPABILITY_REQUIRED' });
assert.strictEqual(event.schema, 'PRH_PROFILE_TELEMETRY_V1');
assert.strictEqual(event.member_count, 2);
assert.strictEqual(event.required_capability, 'HOUSEHOLD_ADMIN');
assert.match(event.household_hash, /^[a-f0-9]{64}$/);
assert.match(event.member_hash, /^[a-f0-9]{64}$/);
const eventText = JSON.stringify(event);
assert(!eventText.includes('hh-synthetic-01'));
assert(!eventText.includes('member-viewer'));
assert(!eventText.includes('Тестовая семья'));
assert.throws(() => profile.telemetry(fixture(), { key: 'short' }), (error) => error.code === 'PROFILE_TELEMETRY_KEY_TOO_SHORT');
assert.throws(() => profile.telemetry(fixture(), { key, member_id: 'missing' }), (error) => error.code === 'PROFILE_TELEMETRY_MEMBER_UNKNOWN');

console.log('household-preferences-contract: PASS', {
  schema: profile.CONTRACT.schema,
  version: profile.CONTRACT.version,
  members: normalized.members.length,
  defaultTheme: defaults.theme,
  authRoles: profile.CONTRACT.profile.member_roles,
  authorizationGrantedByPlanner: false,
  financialWrite: profile.CONTRACT.invariants.financial_write,
  freeOnly: profile.CONTRACT.cost.mode
});
