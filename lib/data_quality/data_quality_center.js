'use strict';

const crypto = require('crypto');
const CONTRACT = require('./data_quality_center.v1.json');
const {
  normalizeCanonicalTransaction,
  sourceIdentityKey
} = require('../domain/canonical_transaction');

const CONTRACT_SCHEMA = 'PRH_DATA_QUALITY_CENTER_V1';
const VERSION = '1.0.0';
const ISSUE_SCHEMA = 'PRH_DATA_QUALITY_ISSUE_V1';
const SCAN_SCHEMA = 'PRH_DATA_QUALITY_SCAN_V1';
const PREVIEW_SCHEMA = 'PRH_DATA_QUALITY_REPAIR_PREVIEW_V1';
const GATE_SCHEMA = 'PRH_DATA_QUALITY_MUTATION_GATE_V1';
const SHA256_RE = /^[0-9a-f]{64}$/;
const REQUIRED_FIELDS = Object.freeze([
  'schema','schema_version','transaction_id','occurred_at','type','status','amount_minor','currency','account_id',
  'destination_account_id','category_id','member_id','project_id','tags','counterparty','description',
  'reverses_transaction_id','adjustment_semantics','provenance'
]);
const BUSINESS_FIELDS = Object.freeze([
  'occurred_at','type','status','amount_minor','currency','account_id','destination_account_id','category_id',
  'member_id','project_id','tags','counterparty','description','reverses_transaction_id','adjustment_semantics'
]);

function fail(reason) { const error = new Error(reason); error.code = reason; throw error; }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out,key)=>(out[key]=stable(value[key]),out),{});
  return value;
}
function sha256(value) { return crypto.createHash('sha256').update(String(value),'utf8').digest('hex'); }
function boundedReason(error, fallback='DQ_CANONICAL_INVALID') {
  const value=String(error && (error.code || error.message) || fallback);
  return /^[A-Z][A-Z0-9_]{2,79}$/.test(value)?value:fallback;
}
function assertContract() {
  if (CONTRACT.schema!==CONTRACT_SCHEMA || CONTRACT.version!==VERSION || CONTRACT.roadmap_id!=='DQ-020') fail('DQ_CONTRACT_INVALID');
  if (CONTRACT.detectors.fuzzy_duplicate_detection!==false) fail('DQ_FUZZY_DUPLICATE_FORBIDDEN');
  if (CONTRACT.repair.automatic_write!==false || CONTRACT.repair.preview_only!==true) fail('DQ_REPAIR_POLICY_INVALID');
  if (CONTRACT.mutation_gate.write_authorized_in_dq020!==false || CONTRACT.mutation_gate.mig010_authorization_reusable!==false) fail('DQ_MUTATION_POLICY_INVALID');
  if (Object.values(CONTRACT.authority).some(Boolean)) fail('DQ_AUTHORITY_INVALID');
  if (CONTRACT.cost.mode!=='FREE_ONLY' || CONTRACT.cost.external_provider_required!==false) fail('DQ_COST_POLICY_INVALID');
  return true;
}
function recordHash(record) { return sha256(JSON.stringify(stable(record))); }
function businessFingerprint(tx) {
  const payload={};
  for (const field of BUSINESS_FIELDS) payload[field]=tx[field];
  return sha256(JSON.stringify(stable(payload)));
}
function issue({kind,reason,severity='WARNING',record_hash=null,group_hash=null,autofix=false}) {
  return Object.freeze({schema:ISSUE_SCHEMA,kind,reason,severity,record_hash,group_hash,autofix});
}
function preflightIssues(raw, hash) {
  const out=[];
  if (!raw || typeof raw!=='object' || Array.isArray(raw)) {
    out.push(issue({kind:'MISSING_INVALID',reason:'CANONICAL_TRANSACTION_SHAPE_INVALID',severity:'ERROR',record_hash:hash}));
    return out;
  }
  for (const field of REQUIRED_FIELDS) if (!Object.prototype.hasOwnProperty.call(raw,field)) out.push(issue({kind:'MISSING_INVALID',reason:`MISSING_${field.toUpperCase()}`,severity:'ERROR',record_hash:hash}));
  if (raw.type==='adjustment' && Number(raw.amount_minor)!==0) out.push(issue({kind:'SUSPICIOUS',reason:'ADJUSTMENT_NONZERO',severity:'ERROR',record_hash:hash}));
  if (raw.type==='transfer' && raw.account_id && raw.destination_account_id && raw.account_id===raw.destination_account_id) out.push(issue({kind:'SUSPICIOUS',reason:'SELF_TRANSFER',severity:'ERROR',record_hash:hash}));
  if (raw.transaction_id && raw.reverses_transaction_id && raw.transaction_id===raw.reverses_transaction_id) out.push(issue({kind:'SUSPICIOUS',reason:'REVERSAL_SELF_REFERENCE',severity:'ERROR',record_hash:hash}));
  const p=raw.provenance;
  if (p && typeof p==='object' && !Array.isArray(p)) {
    const source=String(p.source_system||'').toUpperCase();
    const sheetSource=source.includes('SHEET');
    if (sheetSource && (!p.source_container || !p.source_position)) out.push(issue({kind:'PROVENANCE',reason:'SHEET_SOURCE_LOCATION_INCOMPLETE',severity:'WARNING',record_hash:hash}));
  }
  return out;
}
function scanRecords(inputs) {
  assertContract();
  if (!Array.isArray(inputs)) fail('DQ_RECORDS_INVALID');
  if (inputs.length>100000) fail('DQ_RECORD_LIMIT_EXCEEDED');
  const issues=[]; const valid=[];
  for (const raw of inputs) {
    const hash=recordHash(raw);
    issues.push(...preflightIssues(raw,hash));
    try {
      const tx=normalizeCanonicalTransaction(raw);
      valid.push({tx,record_hash:hash,business_fingerprint:businessFingerprint(tx),source_identity:sourceIdentityKey(tx)});
    } catch (error) {
      issues.push(issue({kind:'MISSING_INVALID',reason:boundedReason(error),severity:'ERROR',record_hash:hash}));
    }
  }

  const byBusiness=new Map();
  for (const item of valid) {
    if (!byBusiness.has(item.business_fingerprint)) byBusiness.set(item.business_fingerprint,[]);
    byBusiness.get(item.business_fingerprint).push(item);
  }
  for (const [fingerprint,group] of byBusiness) {
    if (group.length<2) continue;
    for (const item of group) issues.push(issue({kind:'EXACT_DUPLICATE',reason:'EXACT_BUSINESS_PAYLOAD_DUPLICATE',severity:'WARNING',record_hash:item.record_hash,group_hash:fingerprint}));
  }

  const bySource=new Map();
  for (const item of valid) {
    if (!bySource.has(item.source_identity)) bySource.set(item.source_identity,[]);
    bySource.get(item.source_identity).push(item);
  }
  for (const group of bySource.values()) {
    if (group.length<2) continue;
    const groupHash=sha256(group[0].source_identity);
    for (const item of group) issues.push(issue({kind:'PROVENANCE',reason:'SOURCE_IDENTITY_DUPLICATE',severity:'ERROR',record_hash:item.record_hash,group_hash:groupHash}));
  }

  issues.sort((a,b)=>`${a.kind}|${a.reason}|${a.group_hash||''}|${a.record_hash||''}`.localeCompare(`${b.kind}|${b.reason}|${b.group_hash||''}|${b.record_hash||''}`));
  const reasonCount={};
  for (const item of issues) reasonCount[item.reason]=(reasonCount[item.reason]||0)+1;
  const scanHash=sha256(JSON.stringify(stable({record_hashes:inputs.map(recordHash).sort(),issues:issues.map(({kind,reason,severity,record_hash,group_hash})=>({kind,reason,severity,record_hash,group_hash}))})));
  return Object.freeze({
    schema:SCAN_SCHEMA, contract_version:VERSION, scan_hash:scanHash, record_count:inputs.length,
    valid_record_count:valid.length, issue_count:issues.length, issues:Object.freeze(issues),
    telemetry:Object.freeze({schema:CONTRACT_SCHEMA,version:VERSION,scan_hash:scanHash,record_count:inputs.length,issue_count:issues.length,reason_count:Object.freeze(reasonCount),status:'OK',reason_code:null}),
    authority:Object.freeze({financial_truth:false,storage:false,financial_write:false,repair_write:false})
  });
}
function previewRepairs(scan) {
  if (!scan || scan.schema!==SCAN_SCHEMA || scan.contract_version!==VERSION || !Array.isArray(scan.issues)) fail('DQ_SCAN_INVALID');
  const proposals=scan.issues.map((item,index)=>Object.freeze({
    proposal_id:sha256(`${PREVIEW_SCHEMA}|${scan.scan_hash}|${index}|${item.kind}|${item.reason}|${item.record_hash||''}`),
    issue_kind:item.kind, reason:item.reason, action:'NO_AUTOFIX', state:'REVIEW_REQUIRED',
    confidence:item.kind==='EXACT_DUPLICATE'?'HIGH':'EXPLICIT_RULE', write_performed:false
  }));
  return Object.freeze({schema:PREVIEW_SCHEMA,contract_version:VERSION,scan_hash:scan.scan_hash,proposal_count:proposals.length,proposals:Object.freeze(proposals),preview_only:true,write_performed:false});
}
function evidenceComplete(input) {
  if (!input || typeof input!=='object' || Array.isArray(input)) return false;
  if (!SHA256_RE.test(String(input.plan_hash||''))) return false;
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(String(input.idempotency_key||''))) return false;
  const backup=input.backup_binding, rollback=input.rollback_evidence, readback=input.readback_evidence;
  if (!backup || backup.schema!==CONTRACT.mutation_gate.backup_schema || backup.version!==VERSION || backup.fresh!==true || !SHA256_RE.test(String(backup.backup_hash||'')) || backup.plan_hash!==input.plan_hash) return false;
  if (!rollback || rollback.schema!==CONTRACT.mutation_gate.rollback_schema || rollback.version!==VERSION || rollback.status!=='PASS' || rollback.plan_hash!==input.plan_hash) return false;
  if (!readback || readback.schema!==CONTRACT.mutation_gate.readback_schema || readback.version!==VERSION || readback.status!=='PASS' || readback.plan_hash!==input.plan_hash) return false;
  return true;
}
function evaluateMutationGate(input={}) {
  assertContract();
  const complete=evidenceComplete(input);
  return Object.freeze({
    schema:GATE_SCHEMA, contract_version:VERSION,
    state:complete?'READY_FOR_SEPARATE_AUTHORIZATION':'BLOCKED_EVIDENCE_MISSING',
    evidence_complete:complete, write_authorized:false, write_performed:false,
    mig010_authorization_reusable:false,
    reason_code:complete?'DQ020_WRITE_AUTHORITY_ABSENT':'DQ_MUTATION_EVIDENCE_INCOMPLETE'
  });
}

assertContract();
module.exports=Object.freeze({CONTRACT,CONTRACT_SCHEMA,VERSION,ISSUE_SCHEMA,SCAN_SCHEMA,PREVIEW_SCHEMA,GATE_SCHEMA,assertContract,recordHash,businessFingerprint,scanRecords,previewRepairs,evidenceComplete,evaluateMutationGate});
