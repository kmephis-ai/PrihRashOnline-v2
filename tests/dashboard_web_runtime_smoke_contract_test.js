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
]) new vm.Script(source, { filename: name });

function makeHtmlOutput(content) {
  return {
    setTitle() { return this; },
    addMetaTag() { return this; },
    getContent() { return content; }
  };
}

let homeReadSmokeCalls = 0;
const context = vm.createContext({
  console,
  JSON,
  Object,
  Array,
  Set,
  String,
  Number,
  Math,
  Date,
  RegExp,
  Error,
  encodeURIComponent,
  HtmlService: {
    createHtmlOutputFromFile(name) {
      if (name === 'DashboardWebApp') return makeHtmlOutput(dashboardHtml);
      if (name === 'FinancialHomeWebApp') return makeHtmlOutput(homeHtml);
      throw new Error(`unexpected html file ${name}`);
    },
    createHtmlOutput(content) { return makeHtmlOutput(String(content)); }
  },
  prhR2BuildFinancialHomeRuntime_() { throw new Error('technical render smoke must not read private financial runtime'); },
  prhR2FinancialHomeReadSmokeToken() {
    homeReadSmokeCalls += 1;
    return 'PRH_R2_HOME_READ_V1|OK|7';
  },
  PR_BUILD_INFO: {
    schemaVersion: 1,
    candidateSha: 'a'.repeat(40),
    sourceTreeHash: 'b'.repeat(64)
  },
  PR_CONFIG: {
    SHEETS: { OPERATIONS: 'OPS', SETTINGS: 'SETTINGS', CONTROL: 'CONTROL' }
  },
  SpreadsheetApp: {
    getActiveSpreadsheet() {
      return {
        getSheetByName(name) {
          if (!['OPS', 'SETTINGS', 'CONTROL'].includes(name)) return null;
          return { getRange() { return { getValue() { return 'discarded'; } }; } };
        }
      };
    }
  }
});

vm.runInContext(dashboardSource, context, { filename: 'DashboardWebDataService.js' });
vm.runInContext(routerSource, context, { filename: 'CanonicalR2WebAppService.js' });
vm.runInContext(smokeSource, context, { filename: 'DashboardWebRuntimeSmoke.js' });
vm.runInContext(runtimeSource, context, { filename: 'RuntimeHealth.js' });

const legacyRendered = vm.runInContext("prhRenderWebDashboard_({smoke:true}).getContent()", context);
assert(legacyRendered.includes('"smoke":true'));
assert(!legacyRendered.includes('<?!= initialData ?>'));

const r2Rendered = vm.runInContext("prhR2RenderFile_('home',prhR2SmokePayload_()).getContent()", context);
assert(r2Rendered.includes('data-prh-canonical-r2-shell="1"'));
assert(r2Rendered.includes('data-active-surface="home"'));
assert(r2Rendered.includes('"smoke":true'));
assert(r2Rendered.includes('?surface=legacy'));
assert(!r2Rendered.includes('<?!= initialHomeData ?>'));

const smokeToken = vm.runInContext('prhWebAppRenderSmokeToken()', context);
assert.strictEqual(smokeToken, 'PRH_WEBAPP_SMOKE_V3|R2|OK');
assert.strictEqual(homeReadSmokeCalls, 0, 'technical render smoke stays independent of private data');

const healthToken = vm.runInContext(
  "prhReleaseHealthCheckToken({candidateSha:'" + 'a'.repeat(40) + "',sourceTreeHash:'" + 'b'.repeat(64) + "'})",
  context
);
assert.match(healthToken, /^PRH_HEALTH_V1\|OK\|a{40}\|b{64}\|1\|V8\|3\|1\|[0-9]+$/);
assert.strictEqual(homeReadSmokeCalls, 1, 'trusted health must prove the private Home read path exactly once');

assert.match(dashboardSource, /function prhRenderWebDashboard_\(data\)/);
assert.doesNotMatch(dashboardSource, /function\s+doGet\s*\(/);
assert.match(routerSource, /function\s+doGet\s*\(/);
assert.match(routerSource, /DEFAULT_SURFACE:\s*'home'/);
assert.match(routerSource, /\?surface=legacy/);
assert.match(smokeSource, /prhCanonicalR2WebAppSmokeToken\(\)/);
assert.doesNotMatch(smokeSource, /SpreadsheetApp|prhGetWebDashboardData/);
assert.match(runtimeSource, /PRH_WEBAPP_SMOKE_V3\|R2\|OK/);
assert.match(runtimeSource, /PRH_R2_HOME_READ_V1\|OK\|7/);
assert.match(runtimeSource, /prhR2FinancialHomeReadSmokeToken\(\)/);
assert.match(runtimeSource, /RUNTIME_HEALTH_R2_HOME_READ_SMOKE_FAILED/);

console.log('dashboard-web-runtime-smoke: PASS', {
  syntax: 'V8',
  canonicalDefault: 'R2_HOME',
  legacyRollback: true,
  smokeVersion: 3,
  technicalRenderReadsFinancialRows: false,
  trustedPrivateHomeReadProof: true,
  healthTokenShapePreserved: true
});
