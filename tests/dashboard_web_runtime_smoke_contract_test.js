'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const dashboardSource = fs.readFileSync(path.join(root, 'DashboardWebDataService.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'RuntimeHealth.js'), 'utf8');

// Compile the exact deployable server-side sources with Node/V8 before exercising them.
new vm.Script(dashboardSource, { filename: 'DashboardWebDataService.js' });
new vm.Script(runtimeSource, { filename: 'RuntimeHealth.js' });

let renderedInitialData = null;
const htmlOutput = {
  setTitle() { return this; },
  addMetaTag() { return this; },
  getContent() {
    return '<!doctype html><html><body><script id="initial-data" type="application/json">' +
      String(renderedInitialData || '') + '</script><div>PrihRashOnline</div></body></html>';
  }
};

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
    createTemplateFromFile(name) {
      assert.strictEqual(name, 'DashboardWebApp');
      return {
        initialData: '',
        evaluate() {
          renderedInitialData = this.initialData;
          return htmlOutput;
        }
      };
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

const smokeToken = vm.runInContext('prhWebAppSmokeToken()', context);
assert.strictEqual(smokeToken, 'PRH_WEBAPP_SMOKE_V1|OK');
assert.ok(renderedInitialData.includes('"smoke":true'));

const healthToken = vm.runInContext(
  "prhReleaseHealthCheckToken({candidateSha:'" + 'a'.repeat(40) + "',sourceTreeHash:'" + 'b'.repeat(64) + "'})",
  context
);
assert.match(
  healthToken,
  /^PRH_HEALTH_V1\|OK\|a{40}\|b{64}\|1\|V8\|3\|1\|[0-9]+$/
);

assert.match(dashboardSource, /function prhRenderWebDashboard_\(data\)/);
assert.match(dashboardSource, /function prhWebAppSmokeToken\(\)/);
assert.doesNotMatch(
  dashboardSource.match(/function prhWebAppSmokeToken\(\)[\s\S]*?\n}/)[0],
  /SpreadsheetApp|prhGetWebDashboardData/
);
assert.match(runtimeSource, /prhWebAppSmokeToken\(\)/);
assert.match(runtimeSource, /RUNTIME_HEALTH_WEBAPP_SMOKE_FAILED/);

console.log('dashboard-web-runtime-smoke: PASS', {
  syntax: 'V8',
  template: 'DashboardWebApp',
  workbookReadsInSmoke: false,
  healthTokenShapePreserved: true
});
