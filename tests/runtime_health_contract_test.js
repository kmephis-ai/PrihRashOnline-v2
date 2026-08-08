'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'RuntimeHealth.js'), 'utf8');
const candidateSha = 'a'.repeat(40);
const sourceTreeHash = 'b'.repeat(64);

function createContext(options = {}) {
  const existingSheets = new Set(options.sheets || ['operations', 'settings', 'control']);
  const readCounter = { value: 0 };
  const spreadsheet = options.noSpreadsheet ? null : {
    getSheetByName(name) {
      if (!existingSheets.has(name)) return null;
      return {
        getRange(row, col) {
          assert.strictEqual(row, 1);
          assert.strictEqual(col, 1);
          return {
            getValue() {
              readCounter.value += 1;
              if (options.readFailure) throw new Error('synthetic read failure');
              return 'synthetic header';
            }
          };
        }
      };
    }
  };
  const context = {
    Date,
    Math,
    Number,
    String,
    Error,
    PR_BUILD_INFO: options.buildInfo === false ? undefined : {
      schemaVersion: 1,
      candidateSha: options.candidateSha || candidateSha,
      sourceTreeHash: options.sourceTreeHash || sourceTreeHash
    },
    PR_CONFIG: options.config === false ? undefined : {
      SHEETS: {
        OPERATIONS: 'operations',
        SETTINGS: 'settings',
        CONTROL: 'control'
      }
    },
    SpreadsheetApp: {
      getActiveSpreadsheet() { return spreadsheet; }
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'RuntimeHealth.js' });
  return { context, readCounter };
}

const healthy = createContext();
const result = healthy.context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash });
assert.strictEqual(result.ok, true);
assert.strictEqual(result.status, 'OK');
assert.strictEqual(result.candidateSha, candidateSha);
assert.strictEqual(result.sourceTreeHash, sourceTreeHash);
assert.strictEqual(result.buildInfoSchemaVersion, 1);
assert.strictEqual(result.runtime, 'V8');
assert.strictEqual(result.requiredSheetCount, 3);
assert.strictEqual(result.readCheck, true);
assert(Number.isInteger(result.latencyMs) && result.latencyMs >= 0);
assert.strictEqual(healthy.readCounter.value, 1, 'health probe must prove read capability exactly once');

const publicResult = JSON.parse(JSON.stringify(result));
['amount','income','expense','balance','description','category','row','value','payload','account'].forEach((forbidden) => {
  assert(!Object.keys(publicResult).some((key) => key.toLowerCase().includes(forbidden)), `health response leaks forbidden field class: ${forbidden}`);
});

assert.throws(
  () => createContext().context.prhReleaseHealthCheck({ candidateSha: 'bad', sourceTreeHash }),
  /RUNTIME_HEALTH_EXPECTED_BUILD_INVALID/
);
assert.throws(
  () => createContext({ candidateSha: 'c'.repeat(40) }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }),
  /RUNTIME_HEALTH_BUILD_MISMATCH/
);
assert.throws(
  () => createContext({ buildInfo: false }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }),
  /RUNTIME_HEALTH_BUILD_INFO_MISSING/
);
assert.throws(
  () => createContext({ config: false }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }),
  /RUNTIME_HEALTH_CONFIG_MISSING/
);
assert.throws(
  () => createContext({ sheets: ['operations', 'settings'] }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }),
  /RUNTIME_HEALTH_REQUIRED_SHEET_MISSING/
);
assert.throws(
  () => createContext({ noSpreadsheet: true }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }),
  /RUNTIME_HEALTH_SPREADSHEET_UNAVAILABLE/
);
assert.throws(
  () => createContext({ readFailure: true }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }),
  /synthetic read failure/
);

console.log('runtime_health_contract_test: OK', {
  exactSha: true,
  sourceTreeHash: true,
  privateSchemaRead: true,
  financialPayload: false
});
