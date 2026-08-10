'use strict';

const assert = require('assert');
const DQ = require('../lib/data_quality/data_quality_center');
const CONTRACT = require('../lib/data_quality/data_quality_center.v1.json');

function tx(id, overrides={}) {
  const n=String(id).replace(/[^A-Za-z0-9]/g,'').padEnd(4,'X');
  return {
    schema:'PRH_CANONICAL_TRANSACTION_V1', schema_version:1, transaction_id:`SYN-${n}`,
    occurred_at:'2026-04-10T12:00:00Z', type:'expense', status:'posted', amount_minor:12500, currency:'RUB',
    account_id:'ACC-SYN', destination_account_id:null, category_id:'CAT-A', member_id:null, project_id:null,
    tags:['synthetic'], counterparty:'Synthetic merchant', description:'Synthetic quality fixture', reverses_transaction_id:null,
    adjustment_semantics:null,
    provenance:{source_system:'SHEETS',source_container:'SYN-SHEET',source_record_id:`SRC-${n}`,source_fingerprint:'a'.repeat(64),identity_strategy:'EXTERNAL_ID',transform_version:'dq-syn-v1',source_position:`row:${n.length}`},
    ...overrides
  };
}
function reasons(scan) { return scan.issues.map((item)=>item.reason); }

assert.strictEqual(CONTRACT.schema,'PRH_DATA_QUALITY_CENTER_V1');
assert.strictEqual(CONTRACT.detectors.fuzzy_duplicate_detection,false);
assert.strictEqual(CONTRACT.repair.automatic_write,false);
assert.strictEqual(CONTRACT.mutation_gate.write_authorized_in_dq020,false);
assert.strictEqual(CONTRACT.mutation_gate.mig010_authorization_reusable,false);
assert(Object.values(CONTRACT.authority).every((value)=>value===false));
assert.strictEqual(CONTRACT.cost.mode,'FREE_ONLY');

const duplicateA=tx('A1',{transaction_id:'SYN-DUP-A',provenance:{...tx('A1').provenance,source_record_id:'SRC-DUP-A',source_position:'row:11'}});
const duplicateB=tx('B1',{transaction_id:'SYN-DUP-B',provenance:{...tx('B1').provenance,source_record_id:'SRC-DUP-B',source_position:'row:12'}});
const sameAmountDateDistinct=tx('C1',{transaction_id:'SYN-DISTINCT',category_id:'CAT-B',provenance:{...tx('C1').provenance,source_record_id:'SRC-DISTINCT',source_position:'row:13'}});
const incompleteSheet=tx('D1',{transaction_id:'SYN-INCOMPLETE',category_id:'CAT-PROVENANCE',provenance:{...tx('D1').provenance,source_record_id:'SRC-INCOMPLETE',source_container:null,source_position:null}});
const sourceDuplicate1=tx('E1',{transaction_id:'SYN-SRC-A',category_id:'CAT-C',provenance:{...tx('E1').provenance,source_record_id:'SRC-SAME',source_position:'row:20'}});
const sourceDuplicate2=tx('F1',{transaction_id:'SYN-SRC-B',category_id:'CAT-D',provenance:{...tx('F1').provenance,source_record_id:'SRC-SAME',source_position:'row:21'}});
const invalidMissing=tx('G1'); delete invalidMissing.category_id;
const invalidSelfTransfer=tx('H1',{type:'transfer',account_id:'ACC-SAME',destination_account_id:'ACC-SAME',category_id:'CAT-TRANSFER'});
const invalidAdjustment=tx('I1',{type:'adjustment',amount_minor:500});
const selfReverse=tx('J1',{transaction_id:'SYN-SELF-REV',type:'refund',reverses_transaction_id:'SYN-SELF-REV',adjustment_semantics:null});

const scan=DQ.scanRecords([duplicateA,duplicateB,sameAmountDateDistinct,incompleteSheet,sourceDuplicate1,sourceDuplicate2,invalidMissing,invalidSelfTransfer,invalidAdjustment,selfReverse]);
assert.strictEqual(scan.schema,'PRH_DATA_QUALITY_SCAN_V1');
assert.strictEqual(scan.record_count,10);
assert.strictEqual(scan.authority.financial_write,false);
assert.strictEqual(scan.authority.repair_write,false);
assert(/^[0-9a-f]{64}$/.test(scan.scan_hash));
const rs=reasons(scan);
for(const required of ['EXACT_BUSINESS_PAYLOAD_DUPLICATE','SHEET_SOURCE_LOCATION_INCOMPLETE','SOURCE_IDENTITY_DUPLICATE','ADJUSTMENT_NONZERO','SELF_TRANSFER','REVERSAL_SELF_REFERENCE']) assert(rs.includes(required),`Missing ${required}`);
assert(rs.some((value)=>value==='MISSING_CATEGORY_ID' || value==='CANONICAL_TRANSACTION_SHAPE_INVALID'));
const exactGroups=scan.issues.filter((item)=>item.reason==='EXACT_BUSINESS_PAYLOAD_DUPLICATE');
assert.strictEqual(exactGroups.length,2,'Only the two exact business-payload duplicates should be grouped');
assert(exactGroups.every((item)=>item.group_hash===exactGroups[0].group_hash));
assert(!exactGroups.some((item)=>item.record_hash===DQ.recordHash(sameAmountDateDistinct)),'Same amount/date with a different category must not be an exact duplicate');
assert(!exactGroups.some((item)=>item.record_hash===DQ.recordHash(incompleteSheet)),'Provenance fixture must not pollute exact duplicate evidence');

const telemetry=JSON.stringify(scan.telemetry);
for(const forbidden of ['12500','Synthetic merchant','SYN-DUP-A','SRC-SAME','CAT-A']) assert(!telemetry.includes(forbidden),`Telemetry leaked ${forbidden}`);
assert.deepStrictEqual(Object.keys(scan.telemetry).sort(),['schema','version','scan_hash','record_count','issue_count','reason_count','status','reason_code'].sort());

const preview=DQ.previewRepairs(scan);
assert.strictEqual(preview.preview_only,true);
assert.strictEqual(preview.write_performed,false);
assert.strictEqual(preview.proposal_count,scan.issue_count);
assert(preview.proposals.every((item)=>item.action==='NO_AUTOFIX' && item.state==='REVIEW_REQUIRED' && item.write_performed===false));

const blocked=DQ.evaluateMutationGate({plan_hash:'b'.repeat(64),IRREVERSIBLE_ACTION_AUTHORIZED:true});
assert.strictEqual(blocked.state,'BLOCKED_EVIDENCE_MISSING');
assert.strictEqual(blocked.write_authorized,false);
assert.strictEqual(blocked.mig010_authorization_reusable,false);

const planHash='c'.repeat(64);
const complete=DQ.evaluateMutationGate({
  plan_hash:planHash,
  idempotency_key:'dq-synthetic-idempotency-001',
  backup_binding:{schema:'PRH_DQ_BACKUP_BINDING_V1',version:'1.0.0',fresh:true,backup_hash:'d'.repeat(64),plan_hash:planHash},
  rollback_evidence:{schema:'PRH_DQ_ROLLBACK_EVIDENCE_V1',version:'1.0.0',status:'PASS',plan_hash:planHash},
  readback_evidence:{schema:'PRH_DQ_READBACK_EVIDENCE_V1',version:'1.0.0',status:'PASS',plan_hash:planHash},
  IRREVERSIBLE_ACTION_AUTHORIZED:true
});
assert.strictEqual(complete.state,'READY_FOR_SEPARATE_AUTHORIZATION');
assert.strictEqual(complete.evidence_complete,true);
assert.strictEqual(complete.write_authorized,false);
assert.strictEqual(complete.write_performed,false);
assert.strictEqual(complete.mig010_authorization_reusable,false);
assert.strictEqual(complete.reason_code,'DQ020_WRITE_AUTHORITY_ABSENT');

const reordered=DQ.scanRecords([selfReverse,invalidAdjustment,invalidSelfTransfer,invalidMissing,sourceDuplicate2,sourceDuplicate1,incompleteSheet,sameAmountDateDistinct,duplicateB,duplicateA]);
assert.strictEqual(reordered.scan_hash,scan.scan_hash,'Scan identity must be independent of input order');

console.log('data_quality_center_contract_test: OK',{records:scan.record_count,issues:scan.issue_count,exactDuplicates:exactGroups.length,previewOnly:preview.preview_only,completeEvidenceState:complete.state,writeAuthorized:complete.write_authorized,freeOnly:true});
