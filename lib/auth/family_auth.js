'use strict';

const crypto = require('crypto');
const CONTRACT = require('./family_auth.v1.json');

const CONTRACT_SCHEMA = 'PRH_FAMILY_AUTH_V1';
const VERSION = '1.0.0';
const VERIFIED_SCHEMA = 'PRH_VERIFIED_IDENTITY_ASSERTION_V1';
const PRINCIPAL_SCHEMA = 'PRH_FAMILY_PRINCIPAL_V1';
const SESSION_SCHEMA = 'PRH_FAMILY_SESSION_V1';
const NONCE_SCHEMA = 'PRH_MUTATION_NONCE_V1';
const DECISION_SCHEMA = 'PRH_AUTHZ_DECISION_V1';
const TELEMETRY_SCHEMA = 'PRH_AUTH_TELEMETRY_V1';
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:@-]{1,127}$/;
const AUDIENCE_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,191}$/;
const CAPABILITIES = new Set(Object.values(CONTRACT.roles).flat());
const MUTATING = new Set(CONTRACT.mutating_capabilities);

function fail(reason) { const error = new Error(reason); error.code = reason; throw error; }
function base64url(value) { return Buffer.from(value).toString('base64url'); }
function decodeBase64url(value) { try { return Buffer.from(String(value), 'base64url'); } catch (error) { fail('AUTH_TOKEN_ENCODING_INVALID'); } }
function hmac(key, text) { return crypto.createHmac('sha256', key).update(String(text), 'utf8').digest(); }
function keyedHash(key, namespace, value) { return hmac(assertKey(key), `${namespace}\u0000${String(value)}`).toString('hex'); }
function safeId(value, reason) { const text=String(value||''); if(!ID_RE.test(text)) fail(reason); return text; }
function safeAudience(value) { const text=String(value||''); if(!AUDIENCE_RE.test(text)) fail('AUTH_AUDIENCE_INVALID'); return text; }
function safeEpoch(value, reason) { const n=Number(value); if(!Number.isSafeInteger(n)||n<0) fail(reason); return n; }
function assertKey(key) { if(!Buffer.isBuffer(key) || key.length < CONTRACT.session.minimum_key_bytes) fail('AUTH_SESSION_KEY_INVALID'); return key; }
function randomId(bytes, randomBytes=crypto.randomBytes) { const out=randomBytes(bytes); if(!Buffer.isBuffer(out)||out.length!==bytes) fail('AUTH_RANDOM_SOURCE_INVALID'); return out.toString('base64url'); }
function stableJson(value) { if(Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`; if(value&&typeof value==='object'){return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;} return JSON.stringify(value); }

function assertContract() {
  if(CONTRACT.schema!==CONTRACT_SCHEMA||CONTRACT.version!==VERSION||CONTRACT.roadmap_id!=='AUTH-040') fail('AUTH_CONTRACT_INVALID');
  if(CONTRACT.identity.raw_assertion_trusted!==false||CONTRACT.identity.injected_verifier_required!==true||CONTRACT.identity.live_provider_required_for_ci!==false) fail('AUTH_IDENTITY_POLICY_INVALID');
  if(CONTRACT.session.integrity!=='HMAC_SHA256_RUNTIME_INJECTED_KEY'||CONTRACT.session.minimum_key_bytes<32||CONTRACT.session.constant_time_signature_compare!==true||CONTRACT.session.token_identity_payload_allowed!==false||CONTRACT.session.idle_activity_state!=='SERVER_SIDE_STORE') fail('AUTH_SESSION_POLICY_INVALID');
  if(CONTRACT.mutation_nonce.single_use!==true||CONTRACT.mutation_nonce.session_and_version_bound!==true||CONTRACT.mutation_nonce.capability_bound!==true) fail('AUTH_NONCE_POLICY_INVALID');
  if(CONTRACT.isolation.household_match_required!==true||CONTRACT.isolation.cross_household!=='DENY') fail('AUTH_ISOLATION_POLICY_INVALID');
  if(CONTRACT.authorization.backend_financial_write_granted!==false||CONTRACT.authorization.google_write_policy_still_required!=='GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED') fail('AUTH_WRITE_BOUNDARY_INVALID');
  if(CONTRACT.current_runtime.apps_script_access!=='MYSELF'||CONTRACT.current_runtime.public_exposure_change!==false) fail('AUTH_RUNTIME_BOUNDARY_INVALID');
  if(CONTRACT.telemetry.pseudonymization!=='HMAC_SHA256_RUNTIME_INJECTED_KEY'||CONTRACT.telemetry.minimum_key_bytes<32||CONTRACT.telemetry.raw_token_allowed!==false||CONTRACT.telemetry.key_material_allowed!==false) fail('AUTH_TELEMETRY_POLICY_INVALID');
  if(Object.values(CONTRACT.authority).some(Boolean)) fail('AUTH_AUTHORITY_INVALID');
  if(CONTRACT.cost.mode!=='FREE_ONLY'||CONTRACT.cost.external_identity_provider_required_for_ci!==false||CONTRACT.cost.paid_dependency_required!==false) fail('AUTH_COST_POLICY_INVALID');
  return true;
}

function verifyIdentityAssertion(rawAssertion, verifier, options={}) {
  assertContract();
  if(typeof verifier!=='function') fail('AUTH_IDENTITY_VERIFIER_REQUIRED');
  const now=safeEpoch(options.now_seconds,'AUTH_NOW_INVALID');
  const expectedAudience=safeAudience(options.expected_audience);
  const verified=verifier(rawAssertion);
  if(!verified||typeof verified!=='object'||Array.isArray(verified)||verified.schema!==VERIFIED_SCHEMA||verified.verified!==true) fail('AUTH_IDENTITY_UNVERIFIED');
  const issuer=safeId(verified.issuer,'AUTH_ISSUER_INVALID');
  const subject=safeId(verified.subject_id,'AUTH_SUBJECT_INVALID');
  const household=safeId(verified.household_id,'AUTH_HOUSEHOLD_INVALID');
  const audience=safeAudience(verified.audience);
  if(audience!==expectedAudience) fail('AUTH_AUDIENCE_MISMATCH');
  const issuedAt=safeEpoch(verified.issued_at,'AUTH_IDENTITY_IAT_INVALID');
  const expiresAt=safeEpoch(verified.expires_at,'AUTH_IDENTITY_EXP_INVALID');
  if(issuedAt>now+60) fail('AUTH_IDENTITY_NOT_YET_VALID');
  if(expiresAt<=now||expiresAt<=issuedAt) fail('AUTH_IDENTITY_EXPIRED');
  const role=String(verified.role||'').toUpperCase();
  if(!Object.prototype.hasOwnProperty.call(CONTRACT.roles,role)) fail('AUTH_ROLE_UNKNOWN');
  return Object.freeze({schema:PRINCIPAL_SCHEMA,version:VERSION,issuer,subject_id:subject,household_id:household,role,authenticated_at:now,assertion_expires_at:expiresAt});
}

function createSessionStore() {
  const sessions=new Map();
  return Object.freeze({
    put(sessionId, record) { sessions.set(sessionId,{...record,used_nonce_hashes:new Set(record.used_nonce_hashes||[])}); },
    get(sessionId) { const value=sessions.get(sessionId); return value||null; },
    revoke(sessionId) { const value=sessions.get(sessionId); if(value){value.revoked=true; sessions.set(sessionId,value);} },
    touch(sessionId, now) { const value=sessions.get(sessionId); if(!value) fail('AUTH_SESSION_STORE_MISSING'); value.last_activity_at=now; sessions.set(sessionId,value); },
    consumeNonce(sessionId, nonceHash) { const value=sessions.get(sessionId); if(!value) return false; if(value.used_nonce_hashes.has(nonceHash)) return false; value.used_nonce_hashes.add(nonceHash); sessions.set(sessionId,value); return true; },
    rotate(sessionId, nextVersion, now) { const value=sessions.get(sessionId); if(!value) fail('AUTH_SESSION_STORE_MISSING'); value.current_version=nextVersion; value.last_activity_at=now; value.used_nonce_hashes=new Set(); sessions.set(sessionId,value); },
    size() { return sessions.size; }
  });
}

function encodeSigned(payload, key) {
  assertKey(key);
  const encoded=base64url(Buffer.from(stableJson(payload),'utf8'));
  const signature=base64url(hmac(key,encoded));
  return `${encoded}.${signature}`;
}

function decodeSigned(token, key, invalidReason) {
  assertKey(key);
  const parts=String(token||'').split('.');
  if(parts.length!==2||!parts[0]||!parts[1]) fail(invalidReason);
  const expected=hmac(key,parts[0]);
  const supplied=decodeBase64url(parts[1]);
  if(expected.length!==supplied.length||!crypto.timingSafeEqual(expected,supplied)) fail(invalidReason);
  let payload;
  try { payload=JSON.parse(decodeBase64url(parts[0]).toString('utf8')); } catch(error){ fail(invalidReason); }
  if(!payload||typeof payload!=='object'||Array.isArray(payload)) fail(invalidReason);
  return payload;
}

function startSession(principal, key, store, options={}) {
  if(!principal||principal.schema!==PRINCIPAL_SCHEMA||principal.version!==VERSION) fail('AUTH_PRINCIPAL_INVALID');
  if(!store||typeof store.put!=='function') fail('AUTH_SESSION_STORE_INVALID');
  const now=safeEpoch(options.now_seconds,'AUTH_NOW_INVALID');
  const sessionId=randomId(CONTRACT.session.session_id_random_bytes,options.random_bytes);
  const absoluteExpiresAt=now+CONTRACT.session.absolute_lifetime_seconds;
  const payload={schema:SESSION_SCHEMA,version:VERSION,session_id:sessionId,issued_at:now,absolute_expires_at:absoluteExpiresAt,session_version:1};
  store.put(sessionId,{current_version:1,revoked:false,issuer:principal.issuer,subject_id:principal.subject_id,household_id:principal.household_id,role:principal.role,issued_at:now,absolute_expires_at:absoluteExpiresAt,last_activity_at:now,idle_timeout_seconds:CONTRACT.session.idle_timeout_seconds});
  return Object.freeze({token:encodeSigned(payload,key),session:Object.freeze(payload)});
}

function verifySession(token, key, store, options={}) {
  if(!store||typeof store.get!=='function') fail('AUTH_SESSION_STORE_INVALID');
  const now=safeEpoch(options.now_seconds,'AUTH_NOW_INVALID');
  const payload=decodeSigned(token,key,'AUTH_SESSION_SIGNATURE_INVALID');
  if(payload.schema!==SESSION_SCHEMA||payload.version!==VERSION) fail('AUTH_SESSION_SCHEMA_INVALID');
  if(['issuer','subject_id','household_id','role'].some((field)=>Object.prototype.hasOwnProperty.call(payload,field))) fail('AUTH_SESSION_IDENTITY_PAYLOAD_FORBIDDEN');
  const sessionId=safeId(payload.session_id,'AUTH_SESSION_ID_INVALID');
  const record=store.get(sessionId);
  if(!record||record.revoked) fail('AUTH_SESSION_REVOKED');
  if(record.current_version!==payload.session_version) fail('AUTH_SESSION_VERSION_STALE');
  const issuedAt=safeEpoch(payload.issued_at,'AUTH_SESSION_IAT_INVALID');
  const absoluteExpires=safeEpoch(payload.absolute_expires_at,'AUTH_SESSION_EXP_INVALID');
  if(record.issued_at!==issuedAt||record.absolute_expires_at!==absoluteExpires) fail('AUTH_SESSION_BINDING_INVALID');
  const lastActivity=safeEpoch(record.last_activity_at,'AUTH_SESSION_ACTIVITY_INVALID');
  const idleTimeout=safeEpoch(record.idle_timeout_seconds,'AUTH_SESSION_IDLE_INVALID');
  if(absoluteExpires<=now) fail('AUTH_SESSION_ABSOLUTE_EXPIRED');
  if(lastActivity+idleTimeout<=now) fail('AUTH_SESSION_IDLE_EXPIRED');
  if(lastActivity<issuedAt||lastActivity>now+60||issuedAt>now+60) fail('AUTH_SESSION_TIME_INVALID');
  return Object.freeze({...payload,issuer:record.issuer,subject_id:record.subject_id,household_id:record.household_id,role:record.role,last_activity_at:lastActivity,idle_timeout_seconds:idleTimeout,session_state:'ACTIVE'});
}

function rotateSession(token, key, store, options={}) {
  const current=verifySession(token,key,store,options);
  const now=safeEpoch(options.now_seconds,'AUTH_NOW_INVALID');
  const nextVersion=current.session_version+1;
  store.rotate(current.session_id,nextVersion,now);
  const next={schema:SESSION_SCHEMA,version:VERSION,session_id:current.session_id,issued_at:current.issued_at,absolute_expires_at:current.absolute_expires_at,session_version:nextVersion};
  return Object.freeze({token:encodeSigned(next,key),session:Object.freeze(next)});
}

function issueMutationNonce(token, capability, key, store, options={}) {
  const session=verifySession(token,key,store,options);
  const cap=String(capability||'').toUpperCase();
  if(!CAPABILITIES.has(cap)||!MUTATING.has(cap)) fail('AUTH_MUTATION_CAPABILITY_INVALID');
  const now=safeEpoch(options.now_seconds,'AUTH_NOW_INVALID');
  const nonceId=randomId(CONTRACT.mutation_nonce.random_bytes,options.random_bytes);
  const payload={schema:NONCE_SCHEMA,version:VERSION,nonce_id:nonceId,session_id:session.session_id,session_version:session.session_version,capability:cap,issued_at:now,expires_at:now+CONTRACT.mutation_nonce.lifetime_seconds};
  store.touch(session.session_id,now);
  return encodeSigned(payload,key);
}

function verifyAndConsumeMutationNonce(nonceToken, session, capability, key, store, now) {
  const nonce=decodeSigned(nonceToken,key,'AUTH_MUTATION_NONCE_SIGNATURE_INVALID');
  if(nonce.schema!==NONCE_SCHEMA||nonce.version!==VERSION) fail('AUTH_MUTATION_NONCE_SCHEMA_INVALID');
  if(nonce.session_id!==session.session_id||nonce.session_version!==session.session_version||nonce.capability!==capability) fail('AUTH_MUTATION_NONCE_BINDING_INVALID');
  const issued=safeEpoch(nonce.issued_at,'AUTH_MUTATION_NONCE_IAT_INVALID');
  const expires=safeEpoch(nonce.expires_at,'AUTH_MUTATION_NONCE_EXP_INVALID');
  if(issued>now+60||expires<=now||expires<=issued) fail('AUTH_MUTATION_NONCE_EXPIRED');
  const nonceHash=keyedHash(key,'mutation-nonce',nonceToken);
  if(!store.consumeNonce(session.session_id,nonceHash)) fail('AUTH_MUTATION_NONCE_REPLAYED');
  return true;
}

function deny(reason, session, capability) {
  return Object.freeze({schema:DECISION_SCHEMA,version:VERSION,decision:'DENY',reason_code:reason,role:session&&session.role||null,capability:capability||null,session_state:session&&session.session_state||'INVALID',backend_financial_write_granted:false,google_write_policy:'GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED'});
}

function authorize(token, request, key, store, options={}) {
  const now=safeEpoch(options.now_seconds,'AUTH_NOW_INVALID');
  let session;
  const capability=String(request&&request.capability||'').toUpperCase();
  try { session=verifySession(token,key,store,{...options,now_seconds:now}); } catch(error) { return deny(String(error.code||'AUTH_SESSION_INVALID'),null,capability||null); }
  if(!CAPABILITIES.has(capability)) return deny('AUTH_CAPABILITY_UNKNOWN',session,capability||null);
  const roleCapabilities=CONTRACT.roles[session.role];
  if(!Array.isArray(roleCapabilities)||!roleCapabilities.includes(capability)) return deny('AUTH_CAPABILITY_NOT_GRANTED',session,capability);
  const resourceHousehold=String(request&&request.resource_household_id||'');
  if(!resourceHousehold||resourceHousehold!==session.household_id) return deny('AUTH_HOUSEHOLD_ISOLATION_DENY',session,capability);
  if(MUTATING.has(capability)) {
    try { verifyAndConsumeMutationNonce(request.mutation_nonce,session,capability,key,store,now); }
    catch(error){ return deny(String(error.code||'AUTH_MUTATION_NONCE_INVALID'),session,capability); }
  }
  store.touch(session.session_id,now);
  return Object.freeze({schema:DECISION_SCHEMA,version:VERSION,decision:'ALLOW',reason_code:null,role:session.role,capability,session_state:'ACTIVE',backend_financial_write_granted:false,google_write_policy:'GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED'});
}

function decisionTelemetry(decision, token, principal, telemetryKey, count=1) {
  if(!decision||decision.schema!==DECISION_SCHEMA) fail('AUTH_DECISION_INVALID');
  assertKey(telemetryKey);
  const telemetry=Object.freeze({schema:TELEMETRY_SCHEMA,version:VERSION,decision:decision.decision,reason_code:decision.reason_code,role:decision.role,capability:decision.capability,session_state:decision.session_state,principal_hash:principal?keyedHash(telemetryKey,'principal',`${principal.issuer}|${principal.subject_id}`):null,household_hash:principal?keyedHash(telemetryKey,'household',principal.household_id):null,session_hash:token?keyedHash(telemetryKey,'session',token):null,decision_count:Number(count)});
  if(!Number.isSafeInteger(telemetry.decision_count)||telemetry.decision_count<1) fail('AUTH_TELEMETRY_COUNT_INVALID');
  const allowed=new Set(CONTRACT.telemetry.allowlist);
  if(Object.keys(telemetry).some(key=>!allowed.has(key))) fail('AUTH_TELEMETRY_FIELD_FORBIDDEN');
  const text=JSON.stringify(telemetry);
  if(/amount_minor|counterparty|description|access_token|refresh_token|password|session_id|household_id|subject_id|private.*url/i.test(text)) fail('AUTH_TELEMETRY_PAYLOAD_FORBIDDEN');
  return telemetry;
}

assertContract();
module.exports=Object.freeze({CONTRACT,CONTRACT_SCHEMA,VERSION,VERIFIED_SCHEMA,PRINCIPAL_SCHEMA,SESSION_SCHEMA,NONCE_SCHEMA,DECISION_SCHEMA,TELEMETRY_SCHEMA,assertContract,verifyIdentityAssertion,createSessionStore,startSession,verifySession,rotateSession,issueMutationNonce,authorize,decisionTelemetry});
