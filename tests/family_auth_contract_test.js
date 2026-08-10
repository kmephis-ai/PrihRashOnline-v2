'use strict';

const assert = require('assert');
const AUTH = require('../lib/auth/family_auth');
const CONTRACT = require('../lib/auth/family_auth.v1.json');

const KEY = Buffer.alloc(32, 0x5a);
const OTHER_KEY = Buffer.alloc(32, 0x33);
const NOW = 1786305600;
const AUDIENCE = 'prihrashonline-private';

function rawIdentity(overrides={}) {
  return { external_payload: 'synthetic-only', ...overrides };
}
function verifierFor(overrides={}) {
  return () => ({
    schema: 'PRH_VERIFIED_IDENTITY_ASSERTION_V1',
    verified: true,
    issuer: 'SYNTHETIC_IDP',
    subject_id: 'USER-A',
    household_id: 'HOUSE-A',
    audience: AUDIENCE,
    issued_at: NOW - 10,
    expires_at: NOW + 600,
    role: 'EDITOR',
    ...overrides
  });
}
function deterministicRandom(byte) {
  return (size) => Buffer.alloc(size, byte);
}
function expectCode(fn, code) {
  let error = null;
  try { fn(); } catch (caught) { error = caught; }
  assert(error, `Expected ${code}`);
  assert.strictEqual(error.code, code, `Expected ${code}, got ${error.code}`);
}

assert.strictEqual(CONTRACT.schema, 'PRH_FAMILY_AUTH_V1');
assert.strictEqual(CONTRACT.mode, 'PROVIDER_NEUTRAL_REFERENCE_POLICY');
assert.strictEqual(CONTRACT.identity.raw_assertion_trusted, false);
assert.strictEqual(CONTRACT.session.integrity, 'HMAC_SHA256_RUNTIME_INJECTED_KEY');
assert(CONTRACT.session.minimum_key_bytes >= 32);
assert.strictEqual(CONTRACT.session.constant_time_signature_compare, true);
assert.strictEqual(CONTRACT.mutation_nonce.single_use, true);
assert.strictEqual(CONTRACT.isolation.cross_household, 'DENY');
assert.strictEqual(CONTRACT.authorization.backend_financial_write_granted, false);
assert.strictEqual(CONTRACT.authorization.google_write_policy_still_required, 'GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED');
assert.strictEqual(CONTRACT.current_runtime.apps_script_access, 'MYSELF');
assert.strictEqual(CONTRACT.current_runtime.public_exposure_change, false);
assert(Object.values(CONTRACT.authority).every((value) => value === false));
assert.strictEqual(CONTRACT.cost.mode, 'FREE_ONLY');

expectCode(() => AUTH.verifyIdentityAssertion(rawIdentity(), null, { now_seconds: NOW, expected_audience: AUDIENCE }), 'AUTH_IDENTITY_VERIFIER_REQUIRED');
expectCode(() => AUTH.verifyIdentityAssertion(rawIdentity(), verifierFor({ verified:false }), { now_seconds: NOW, expected_audience: AUDIENCE }), 'AUTH_IDENTITY_UNVERIFIED');
expectCode(() => AUTH.verifyIdentityAssertion(rawIdentity(), verifierFor({ audience:'other-app' }), { now_seconds: NOW, expected_audience: AUDIENCE }), 'AUTH_AUDIENCE_MISMATCH');
expectCode(() => AUTH.verifyIdentityAssertion(rawIdentity(), verifierFor({ expires_at:NOW }), { now_seconds: NOW, expected_audience: AUDIENCE }), 'AUTH_IDENTITY_EXPIRED');
expectCode(() => AUTH.verifyIdentityAssertion(rawIdentity(), verifierFor({ role:'ROOT' }), { now_seconds: NOW, expected_audience: AUDIENCE }), 'AUTH_ROLE_UNKNOWN');

const principal = AUTH.verifyIdentityAssertion(rawIdentity(), verifierFor(), { now_seconds: NOW, expected_audience: AUDIENCE });
assert.strictEqual(principal.schema, 'PRH_FAMILY_PRINCIPAL_V1');
assert.strictEqual(principal.role, 'EDITOR');
assert.strictEqual(principal.household_id, 'HOUSE-A');

const store = AUTH.createSessionStore();
const started = AUTH.startSession(principal, KEY, store, { now_seconds: NOW, random_bytes: deterministicRandom(0x11) });
assert.strictEqual(store.size(), 1);
assert(started.token.includes('.'));
const verified = AUTH.verifySession(started.token, KEY, store, { now_seconds: NOW + 60 });
assert.strictEqual(verified.session_state, 'ACTIVE');
assert.strictEqual(verified.role, 'EDITOR');
assert.strictEqual(verified.household_id, 'HOUSE-A');

const tampered = `${started.token.slice(0, -1)}${started.token.endsWith('A') ? 'B' : 'A'}`;
expectCode(() => AUTH.verifySession(tampered, KEY, store, { now_seconds: NOW + 60 }), 'AUTH_SESSION_SIGNATURE_INVALID');
expectCode(() => AUTH.verifySession(started.token, OTHER_KEY, store, { now_seconds: NOW + 60 }), 'AUTH_SESSION_SIGNATURE_INVALID');
expectCode(() => AUTH.startSession(principal, Buffer.alloc(16, 1), AUTH.createSessionStore(), { now_seconds: NOW, random_bytes: deterministicRandom(0x12) }), 'AUTH_SESSION_KEY_INVALID');
expectCode(() => AUTH.verifySession(started.token, KEY, store, { now_seconds: NOW + CONTRACT.session.idle_timeout_seconds }), 'AUTH_SESSION_IDLE_EXPIRED');

const rotateStore = AUTH.createSessionStore();
const rotateStarted = AUTH.startSession(principal, KEY, rotateStore, { now_seconds: NOW, random_bytes: deterministicRandom(0x22) });
const rotated = AUTH.rotateSession(rotateStarted.token, KEY, rotateStore, { now_seconds: NOW + 100 });
assert.strictEqual(rotated.session.session_version, 2);
expectCode(() => AUTH.verifySession(rotateStarted.token, KEY, rotateStore, { now_seconds: NOW + 101 }), 'AUTH_SESSION_VERSION_STALE');
assert.strictEqual(AUTH.verifySession(rotated.token, KEY, rotateStore, { now_seconds: NOW + 101 }).session_version, 2);
expectCode(() => AUTH.verifySession(rotated.token, KEY, rotateStore, { now_seconds: NOW + CONTRACT.session.absolute_lifetime_seconds }), 'AUTH_SESSION_ABSOLUTE_EXPIRED');

const readDecision = AUTH.authorize(started.token, { capability:'FINANCE_READ', resource_household_id:'HOUSE-A' }, KEY, store, { now_seconds: NOW + 120 });
assert.strictEqual(readDecision.decision, 'ALLOW');
assert.strictEqual(readDecision.backend_financial_write_granted, false);
assert.strictEqual(readDecision.google_write_policy, 'GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED');

const crossHouse = AUTH.authorize(started.token, { capability:'FINANCE_READ', resource_household_id:'HOUSE-B' }, KEY, store, { now_seconds: NOW + 120 });
assert.strictEqual(crossHouse.decision, 'DENY');
assert.strictEqual(crossHouse.reason_code, 'AUTH_HOUSEHOLD_ISOLATION_DENY');

const unknownCapability = AUTH.authorize(started.token, { capability:'CAN_DO_EVERYTHING', resource_household_id:'HOUSE-A' }, KEY, store, { now_seconds: NOW + 120 });
assert.strictEqual(unknownCapability.decision, 'DENY');
assert.strictEqual(unknownCapability.reason_code, 'AUTH_CAPABILITY_UNKNOWN');

const viewer = AUTH.verifyIdentityAssertion(rawIdentity(), verifierFor({ subject_id:'USER-V', role:'VIEWER' }), { now_seconds: NOW, expected_audience: AUDIENCE });
const viewerStore = AUTH.createSessionStore();
const viewerSession = AUTH.startSession(viewer, KEY, viewerStore, { now_seconds: NOW, random_bytes: deterministicRandom(0x33) });
const viewerEdit = AUTH.authorize(viewerSession.token, { capability:'BUDGET_PLAN_EDIT', resource_household_id:'HOUSE-A' }, KEY, viewerStore, { now_seconds: NOW + 30 });
assert.strictEqual(viewerEdit.decision, 'DENY');
assert.strictEqual(viewerEdit.reason_code, 'AUTH_CAPABILITY_NOT_GRANTED');

const missingNonce = AUTH.authorize(started.token, { capability:'BUDGET_PLAN_EDIT', resource_household_id:'HOUSE-A' }, KEY, store, { now_seconds: NOW + 130 });
assert.strictEqual(missingNonce.decision, 'DENY');
assert.strictEqual(missingNonce.reason_code, 'AUTH_MUTATION_NONCE_SIGNATURE_INVALID');

const nonce = AUTH.issueMutationNonce(started.token, 'BUDGET_PLAN_EDIT', KEY, store, { now_seconds: NOW + 130, random_bytes: deterministicRandom(0x44) });
const editDecision = AUTH.authorize(started.token, { capability:'BUDGET_PLAN_EDIT', resource_household_id:'HOUSE-A', mutation_nonce:nonce }, KEY, store, { now_seconds: NOW + 131 });
assert.strictEqual(editDecision.decision, 'ALLOW');
assert.strictEqual(editDecision.backend_financial_write_granted, false);
const replay = AUTH.authorize(started.token, { capability:'BUDGET_PLAN_EDIT', resource_household_id:'HOUSE-A', mutation_nonce:nonce }, KEY, store, { now_seconds: NOW + 132 });
assert.strictEqual(replay.decision, 'DENY');
assert.strictEqual(replay.reason_code, 'AUTH_MUTATION_NONCE_REPLAYED');

const nonceCross = AUTH.issueMutationNonce(started.token, 'PROFILE_EDIT', KEY, store, { now_seconds: NOW + 140, random_bytes: deterministicRandom(0x55) });
const crossBeforeConsume = AUTH.authorize(started.token, { capability:'PROFILE_EDIT', resource_household_id:'HOUSE-B', mutation_nonce:nonceCross }, KEY, store, { now_seconds: NOW + 141 });
assert.strictEqual(crossBeforeConsume.decision, 'DENY');
assert.strictEqual(crossBeforeConsume.reason_code, 'AUTH_HOUSEHOLD_ISOLATION_DENY');
const ownAfterCrossDeny = AUTH.authorize(started.token, { capability:'PROFILE_EDIT', resource_household_id:'HOUSE-A', mutation_nonce:nonceCross }, KEY, store, { now_seconds: NOW + 142 });
assert.strictEqual(ownAfterCrossDeny.decision, 'ALLOW', 'Cross-household denial must not consume a valid own-household nonce');

const telemetry = AUTH.decisionTelemetry(editDecision, started.token, principal, 7);
assert.deepStrictEqual(Object.keys(telemetry).sort(), CONTRACT.telemetry.allowlist.slice().sort());
assert.strictEqual(telemetry.decision, 'ALLOW');
assert.strictEqual(telemetry.role, 'EDITOR');
assert.strictEqual(telemetry.capability, 'BUDGET_PLAN_EDIT');
assert(/^[0-9a-f]{64}$/.test(telemetry.principal_hash));
assert(/^[0-9a-f]{64}$/.test(telemetry.household_hash));
assert(/^[0-9a-f]{64}$/.test(telemetry.session_hash));
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['USER-A','HOUSE-A',started.token,'external_payload','amount_minor','Synthetic']) assert(!telemetryText.includes(forbidden), `Telemetry leaked ${forbidden}`);

console.log('family_auth_contract_test: OK', {
  contract: `${CONTRACT.schema}@${CONTRACT.version}`,
  verifierBoundary: true,
  hmacSession: true,
  constantTimeVerify: true,
  idleAndAbsoluteExpiry: true,
  rotationInvalidatesOldVersion: true,
  leastPrivilege: true,
  householdIsolation: true,
  singleUseMutationNonce: true,
  backendFinancialWriteGranted: false,
  currentAppsScriptAccess: CONTRACT.current_runtime.apps_script_access,
  publicTelemetryRawIdentity: false,
  freeOnly: true
});
