'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const dashboardSource = fs.readFileSync(path.join(root, 'DashboardWebDataService.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'RuntimeHealth.js'), 'utf8');
const dashboardHtml = fs.readFileSync(path.join(root, 'DashboardWebApp.html'), 'utf8');

// Compile the exact deployable server-side sources with Node/V8 before exercising them.
new vm.Script(dashboardSource, { filename: 'DashboardWebDataService.js' });
new vm.Script(runtimeSource, { filename: 'RuntimeHealth.js' });

function makeHtmlOutput(content) {
  return {
    setTitle() { return this; },
    addMetaTag() { return this; },
    getContent() { return content; }
  };
}

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
  HtmlService: {
    createHtmlOutputFromFile(name) {
      assert.strictEqual(name, 'DashboardWebApp');
      return makeHtmlOutput(dashboardHtml);
    },
    createHtmlOutput(content) {
      return makeHtmlOutput(String(content));
    }
  },
  PR_BUILD_INFO: {
    schemaVersion: 1,
    candidateSha: 'a'.repeat(40),
    sourceTreeHash: 'b'.repeat(64)
  },
  PR_CONFIG: {
    SHEETS: {
      OPERATIONS: 'OPS',
      SETTINGS: 'SETTINGS',
      CONTROL: 'CONTROL'
    }
  },
  SpreadsheetApp: {
    getActiveSpreadsheet() {
      return {
        getSheetByName(name) {
          if (!['OPS', 'SETTINGS', 'CONTROL'].includes(name)) return null;
          return {
            getRange() {
              return { getValue() { return 'discarded'; } };
            }
          };
        }
      };
    }
  }
});

vm.runInContext(dashboardSource, context, { filename: 'DashboardWebDataService.js' });
vm.runInContext(runtimeSource, context, { filename: 'RuntimeHealth.js' });

const renderedHtml = vm.runInContext("prhRenderWebDashboard_({smoke:true}).getContent()", context);
assert.ok(renderedHtml.includes('"smoke":true'));
assert.ok(!renderedHtml.includes('<?!= initialData ?>'), 'initialData placeholder must be replaced before output');

const smokeToken = vm.runInContext('prhWebAppSmokeToken()', context);
assert.strictEqual(smokeToken, 'PRH_WEBAPP_SMOKE_V1|OK');

const healthToken = vm.runInContext(
  "prhReleaseHealthCheckToken({candidateSha:'" + 'a'.repeat(40) + "',sourceTreeHash:'" + 'b'.repeat(64) + "'})",
  context
);
assert.match(
  healthToken,
  /^PRH_HEALTH_V1\|OK\|a{40}\|b{64}\|1\|V8\|3\|1\|[0-9]+$/
);

assert.match(dashboardSource, /function prhRenderWebDashboard_\(data\)/);
assert.match(dashboardSource, /createHtmlOutputFromFile\('DashboardWebApp'\)/);
assert.doesNotMatch(dashboardSource, /createTemplateFromFile\('DashboardWebApp'\)/);
assert.match(dashboardSource, /function prhWebAppSmokeToken\(\)/);
assert.doesNotMatch(
  dashboardSource.match(/function prhWebAppSmokeToken\(\)[\s\S]*?\n}/)[0],
  /SpreadsheetApp|prhGetWebDashboardData/
);
assert.match(runtimeSource, /prhWebAppSmokeToken\(\)/);
assert.match(runtimeSource, /RUNTIME_HEALTH_WEBAPP_SMOKE_FAILED/);

console.log('dashboard-web-runtime-smoke: PASS', {
  syntax: 'V8',
  renderMode: 'RAW_HTML_OUTPUT_PLACEHOLDER_INJECTION',
  templateParserUsed: false,
  workbookReadsInSmoke: false,
  healthTokenShapePreserved: true
});
