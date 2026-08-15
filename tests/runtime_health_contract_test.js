'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'RuntimeHealth.js'), 'utf8');
const candidateSha = 'a'.repeat(40);
const sourceTreeHash = 'b'.repeat(64);
const WEB_SMOKE = 'PRH_WEBAPP_SMOKE_V5|R2|OK';
const HOME_SMOKE = 'PRH_R2_HOME_READ_V3|CANONICAL_LIB|DIMENSION_HASH|OK|7';
const DATA_SMOKE = 'PRH_R2_DATA_RUNTIME_V1|READ_ONLY|OK';

function createContext(options = {}) {
  const existingSheets = new Set(options.sheets || ['operations','settings','control']);
  const readCounter={value:0}, webSmokeCounter={value:0}, homeReadSmokeCounter={value:0}, dataSmokeCounter={value:0}, localFirstCounter={value:0};
  const spreadsheet=options.noSpreadsheet?null:{
    getSheetByName(name){
      if(!existingSheets.has(name))return null;
      return {getRange(row,col){assert.strictEqual(row,1);assert.strictEqual(col,1);return{getValue(){readCounter.value+=1;if(options.readFailure)throw new Error('synthetic read failure');return 'synthetic header';}};}};
    }
  };
  const context={Date,Math,Number,String,Error,RegExp,Object,Array,JSON,
    PR_BUILD_INFO:options.buildInfo===false?undefined:{schemaVersion:1,candidateSha:options.candidateSha||candidateSha,sourceTreeHash:options.sourceTreeHash||sourceTreeHash},
    PR_CONFIG:options.config===false?undefined:{SHEETS:{OPERATIONS:'operations',SETTINGS:'settings',CONTROL:'control'}},
    SpreadsheetApp:{getActiveSpreadsheet(){return spreadsheet;}}
  };
  if(!options.webSmokeMissing)context.prhWebAppRenderSmokeToken=function(){webSmokeCounter.value+=1;if(options.webSmokeThrows)throw new Error('synthetic web smoke failure');return options.webSmokeToken||WEB_SMOKE;};
  if(!options.homeReadSmokeMissing)context.prhR2FinancialHomeReadSmokeToken=function(){homeReadSmokeCounter.value+=1;if(options.homeReadSmokeThrows)throw new Error('synthetic home read failure');return options.homeReadSmokeToken||HOME_SMOKE;};
  if(!options.dataSmokeMissing)context.prhR2DataRuntimeSmokeToken=function(){dataSmokeCounter.value+=1;if(options.dataSmokeThrows)throw new Error('synthetic data runtime failure');return options.dataSmokeToken||DATA_SMOKE;};
  if(!options.localFirstMissing)context.prhLocalFirstSyncBootstrapWire=function(request){
    localFirstCounter.value+=1;
    assert(request&&typeof request==='object');
    assert.strictEqual(request.local_revision,'');
    if(options.localFirstThrows){
      const error=new Error(options.localFirstErrorMessage||'LOCAL_FIRST_SYNC_WIRE_TRANSACTION_SHAPE_INVALID');
      if(options.localFirstErrorCode)error.code=options.localFirstErrorCode;
      throw error;
    }
    if(options.localFirstRawWire!==undefined)return options.localFirstRawWire;
    const envelope=options.localFirstInvalid||{
      schema:'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1',version:'1.0.0',state:'FULL_BOOTSTRAP',
      revision:'c'.repeat(64),generation_id:'c'.repeat(64),
      financial_write_authorized:false,canonical_mutation_performed:false,
      transactions:[{destination_account_id:null}],dimensions:[],aggregates:[],sync_journal:[],
      expected_counts:{transactions:1,dimensions:0,aggregates:0,sync_journal:0},serialized_chars:128
    };
    return JSON.stringify(envelope);
  };
  vm.createContext(context);vm.runInContext(source,context,{filename:'RuntimeHealth.js'});
  return{context,readCounter,webSmokeCounter,homeReadSmokeCounter,dataSmokeCounter,localFirstCounter};
}

const transportOnly=createContext({noSpreadsheet:true});
assert.strictEqual(transportOnly.context.prhRuntimeTransportPing(),'PRH_TRANSPORT_V1|OK');
assert.strictEqual(transportOnly.readCounter.value,0);
assert.strictEqual(transportOnly.dataSmokeCounter.value,0);
assert.strictEqual(transportOnly.localFirstCounter.value,0);

const healthy=createContext();
const result=healthy.context.prhReleaseHealthCheck({candidateSha,sourceTreeHash});
assert.strictEqual(result.ok,true);assert.strictEqual(result.status,'OK');assert.strictEqual(result.candidateSha,candidateSha);assert.strictEqual(result.sourceTreeHash,sourceTreeHash);
assert.strictEqual(result.buildInfoSchemaVersion,1);assert.strictEqual(result.runtime,'V8');assert.strictEqual(result.requiredSheetCount,3);assert.strictEqual(result.readCheck,true);assert.strictEqual(result.dataRuntimeCheck,true);assert.strictEqual(result.localFirstSyncCheck,true);
assert(Number.isInteger(result.latencyMs)&&result.latencyMs>=0);
assert.strictEqual(healthy.readCounter.value,1);assert.strictEqual(healthy.webSmokeCounter.value,1);assert.strictEqual(healthy.homeReadSmokeCounter.value,1);assert.strictEqual(healthy.dataSmokeCounter.value,1);assert.strictEqual(healthy.localFirstCounter.value,1);

const tokenHealthy=createContext();
const token=tokenHealthy.context.prhReleaseHealthCheckToken({candidateSha,sourceTreeHash});
const tokenParts=token.split('|');
assert.strictEqual(tokenParts.length,9,'stable health scalar field count must remain backward compatible');
assert.deepStrictEqual(tokenParts.slice(0,8),['PRH_HEALTH_V1','OK',candidateSha,sourceTreeHash,'1','V8','3','1']);
assert(/^\d+$/.test(tokenParts[8]));
assert.strictEqual(tokenHealthy.dataSmokeCounter.value,1,'DATA proof must execute even though scalar shape is unchanged');
assert.strictEqual(tokenHealthy.localFirstCounter.value,1,'Local-first scalar JSON wire proof must execute even though health token shape is unchanged');

const publicResult=JSON.parse(JSON.stringify(result));
['amount','income','expense','balance','description','category','row','value','payload','account'].forEach((forbidden)=>{
  assert(!Object.keys(publicResult).some((key)=>key.toLowerCase().includes(forbidden)));
  assert(!token.toLowerCase().includes(forbidden));
});

assert.throws(()=>createContext().context.prhReleaseHealthCheck({candidateSha:'bad',sourceTreeHash}),/RUNTIME_HEALTH_EXPECTED_BUILD_INVALID/);
assert.throws(()=>createContext({candidateSha:'c'.repeat(40)}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/RUNTIME_HEALTH_BUILD_MISMATCH/);
assert.throws(()=>createContext({buildInfo:false}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/RUNTIME_HEALTH_BUILD_INFO_MISSING/);
assert.throws(()=>createContext({config:false}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/RUNTIME_HEALTH_CONFIG_MISSING/);
assert.throws(()=>createContext({sheets:['operations','settings']}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/RUNTIME_HEALTH_REQUIRED_SHEET_MISSING/);
assert.throws(()=>createContext({noSpreadsheet:true}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/RUNTIME_HEALTH_SPREADSHEET_UNAVAILABLE/);
assert.throws(()=>createContext({readFailure:true}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/synthetic read failure/);
assert.throws(()=>createContext({webSmokeMissing:true}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/RUNTIME_HEALTH_WEBAPP_SMOKE_MISSING/);
assert.throws(()=>createContext({webSmokeToken:'PRH_WEBAPP_SMOKE_V5|R2|FAIL'}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/RUNTIME_HEALTH_WEBAPP_SMOKE_FAILED/);
assert.throws(()=>createContext({homeReadSmokeMissing:true}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/RUNTIME_HEALTH_R2_HOME_READ_SMOKE_MISSING/);
assert.throws(()=>createContext({homeReadSmokeToken:'PRH_R2_HOME_READ_V3|CANONICAL_LIB|DIMENSION_HASH|FAIL|0'}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/RUNTIME_HEALTH_R2_HOME_READ_SMOKE_FAILED/);
assert.throws(()=>createContext({dataSmokeMissing:true}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/RUNTIME_HEALTH_R2_DATA_SMOKE_MISSING/);
assert.throws(()=>createContext({dataSmokeToken:'PRH_R2_DATA_RUNTIME_V1|READ_ONLY|FAIL'}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/RUNTIME_HEALTH_R2_DATA_SMOKE_FAILED/);
assert.throws(()=>createContext({dataSmokeThrows:true}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/synthetic data runtime failure/);
assert.throws(()=>createContext({localFirstMissing:true}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/RUNTIME_HEALTH_LOCAL_FIRST_SYNC_WIRE_MISSING/);
assert.throws(()=>createContext({localFirstThrows:true,localFirstErrorCode:'LOCAL_FIRST_SYNC_WIRE_TRANSACTION_SHAPE_INVALID'}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/RUNTIME_HEALTH_LOCAL_FIRST_LOCAL_FIRST_SYNC_WIRE_TRANSACTION_SHAPE_INVALID/);
assert.throws(()=>createContext({localFirstThrows:true,localFirstErrorMessage:'private arbitrary data must not escape'}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/RUNTIME_HEALTH_LOCAL_FIRST_UNCLASSIFIED_FAILURE/);
assert.throws(()=>createContext({localFirstRawWire:'{malformed'}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/RUNTIME_HEALTH_LOCAL_FIRST_UNCLASSIFIED_FAILURE/);
assert.throws(()=>createContext({localFirstInvalid:{schema:'bad',state:'FULL_BOOTSTRAP',financial_write_authorized:false,canonical_mutation_performed:false,transactions:[{destination_account_id:null}],serialized_chars:1}}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/RUNTIME_HEALTH_LOCAL_FIRST_BOOTSTRAP_INVALID/);
assert.throws(()=>createContext({localFirstInvalid:{schema:'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1',state:'FULL_BOOTSTRAP',financial_write_authorized:false,canonical_mutation_performed:false,transactions:[{}],serialized_chars:1}}).context.prhReleaseHealthCheck({candidateSha,sourceTreeHash}),/RUNTIME_HEALTH_LOCAL_FIRST_BOOTSTRAP_INVALID/);

console.log('runtime_health_contract_test: OK',{
  exactSha:true,sourceTreeHash:true,transportPing:true,privateSchemaRead:true,webAppRenderSmoke:'V5_R2',privateHomeReadSmoke:'V3_CANONICAL_LIB_DIMENSION_HASH',
  dataRuntimeSmoke:'V1_READ_ONLY',localFirstScalarJsonWire:true,nullableDestinationWireKey:true,privacySafeOwnerBootstrapFailure:true,scalarShapePreserved:true,financialPayload:false
});
