'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const dashboardSource = fs.readFileSync(path.join(root, 'DashboardWebDataService.js'), 'utf8');
const routerSource = fs.readFileSync(path.join(root, 'CanonicalR2WebAppService.js'), 'utf8');
const smokeSource = fs.readFileSync(path.join(root, 'DashboardWebRuntimeSmoke.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'RuntimeHealth.js'), 'utf8');
const dashboardHtml = fs.readFileSync(path.join(root, 'DashboardWebApp.html'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'FinancialHomeWebApp.html'), 'utf8');

for (const [name, source] of [
  ['DashboardWebDataService.js', dashboardSource],
  ['CanonicalR2WebAppService.js', routerSource],
  ['DashboardWebRuntimeSmoke.js', smokeSource],
  ['RuntimeHealth.js', runtimeSource]
]) new vm.Script(source, { filename:name });

function makeHtmlOutput(content) {
  return { setTitle(){return this;}, addMetaTag(){return this;}, getContent(){return content;} };
}

let homeReadSmokeCalls = 0;
let dataRuntimeSmokeCalls = 0;
const context = vm.createContext({
  console, JSON, Object, Array, Set, String, Number, Math, Date, RegExp, Error, encodeURIComponent,
  HtmlService:{
    createHtmlOutputFromFile(name){
      if(name==='DashboardWebApp')return makeHtmlOutput(dashboardHtml);
      if(name==='FinancialHomeWebApp')return makeHtmlOutput(homeHtml);
      throw new Error(`unexpected html file ${name}`);
    },
    createHtmlOutput(content){return makeHtmlOutput(String(content));}
  },
  prhR2BuildFinancialHomeRuntime_(){throw new Error('technical render smoke must not read private financial runtime');},
  prhR2FinancialHomeReadSmokeToken(){homeReadSmokeCalls+=1;return 'PRH_R2_HOME_READ_V3|CANONICAL_LIB|DIMENSION_HASH|OK|7';},
  prhR2DataRuntimeSmokeToken(){dataRuntimeSmokeCalls+=1;return 'PRH_R2_DATA_RUNTIME_V1|READ_ONLY|OK';},
  PR_BUILD_INFO:{schemaVersion:1,candidateSha:'a'.repeat(40),sourceTreeHash:'b'.repeat(64)},
  PR_CONFIG:{SHEETS:{OPERATIONS:'OPS',SETTINGS:'SETTINGS',CONTROL:'CONTROL'}},
  SpreadsheetApp:{getActiveSpreadsheet(){return{getSheetByName(name){if(!['OPS','SETTINGS','CONTROL'].includes(name))return null;return{getRange(){return{getValue(){return 'discarded';}};}};}};}}
});

vm.runInContext(dashboardSource, context, {filename:'DashboardWebDataService.js'});
vm.runInContext(routerSource, context, {filename:'CanonicalR2WebAppService.js'});
vm.runInContext(smokeSource, context, {filename:'DashboardWebRuntimeSmoke.js'});
vm.runInContext(runtimeSource, context, {filename:'RuntimeHealth.js'});

const legacyRendered=vm.runInContext("prhRenderWebDashboard_({smoke:true}).getContent()",context);
assert(legacyRendered.includes('"smoke":true'));
const r2Rendered=vm.runInContext("prhR2RenderFile_('home',prhR2SmokePayload_()).getContent()",context);
assert(r2Rendered.includes('data-prh-canonical-r2-shell="1"'));
assert(r2Rendered.includes('?surface=transactions'));
assert(r2Rendered.includes('?surface=data-quality'));
assert(!r2Rendered.includes('<?!= initialHomeData ?>'));

const smokeToken=vm.runInContext('prhWebAppRenderSmokeToken()',context);
assert.strictEqual(smokeToken,'PRH_WEBAPP_SMOKE_V5|R2|OK');
assert.strictEqual(homeReadSmokeCalls,0);
assert.strictEqual(dataRuntimeSmokeCalls,0);

const healthToken=vm.runInContext("prhReleaseHealthCheckToken({candidateSha:'"+'a'.repeat(40)+"',sourceTreeHash:'"+'b'.repeat(64)+"'})",context);
assert.match(healthToken,/^PRH_HEALTH_V1\|OK\|a{40}\|b{64}\|1\|V8\|3\|1\|1\|[0-9]+$/);
assert.strictEqual(homeReadSmokeCalls,1,'trusted health must prove private Home read path exactly once');
assert.strictEqual(dataRuntimeSmokeCalls,1,'trusted health must prove DATA canonical modules exactly once');

assert.doesNotMatch(dashboardSource,/function\s+doGet\s*\(/);
assert.match(routerSource,/function\s+doGet\s*\(/);
assert.match(smokeSource,/PRH_WEBAPP_SMOKE_V5\|R2\|OK/);
assert.match(runtimeSource,/PRH_WEBAPP_SMOKE_V5\|R2\|OK/);
assert.match(runtimeSource,/PRH_R2_HOME_READ_V3\|CANONICAL_LIB\|DIMENSION_HASH\|OK\|7/);
assert.match(runtimeSource,/PRH_R2_DATA_RUNTIME_V1\|READ_ONLY\|OK/);
assert.match(runtimeSource,/prhR2DataRuntimeSmokeToken\(\)/);
assert.match(runtimeSource,/RUNTIME_HEALTH_R2_DATA_SMOKE_FAILED/);

console.log('dashboard-web-runtime-smoke: PASS',{
  syntax:'V8',canonicalDefault:'R2_HOME',primaryDataRoutes:['transactions','data-quality'],legacyRollback:true,
  renderSmokeVersion:5,privateHomeReadSmokeVersion:3,dataRuntimeSmokeVersion:1,technicalRenderReadsFinancialRows:false,
  trustedPrivateHomeReadProof:true,trustedDataModuleProof:true,healthTokenShapeVersion:2
});
