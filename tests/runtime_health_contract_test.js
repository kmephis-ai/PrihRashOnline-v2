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
  const webSmokeCounter = { value: 0 };
  const homeReadSmokeCounter = { value: 0 };
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
      SHEETS: { OPERATIONS: 'operations', SETTINGS: 'settings', CONTROL: 'control' }
    },
    SpreadsheetApp: { getActiveSpreadsheet() { return spreadsheet; } }
  };
  if (!options.webSmokeMissing) {
    context.prhWebAppRenderSmokeToken = function () {
      webSmokeCounter.value += 1;
      if (options.webSmokeThrows) throw new Error('synthetic web smoke failure');
      return options.webSmokeToken || 'PRH_WEBAPP_SMOKE_V3|R2|OK';
    };
  }
  if (!options.homeReadSmokeMissing) {
    context.prhR2FinancialHomeReadSmokeToken = function () {
      homeReadSmokeCounter.value += 1;
      if (options.homeReadSmokeThrows) throw new Error('synthetic home read failure');
      return options.homeReadSmokeToken || 'PRH_R2_HOME_READ_V2|CANONICAL_LIB|OK|7';
    };
  }
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'RuntimeHealth.js' });
  return { context, readCounter, webSmokeCounter, homeReadSmokeCounter };
}

const transportOnly = createContext({ noSpreadsheet: true });
assert.strictEqual(transportOnly.context.prhRuntimeTransportPing(), 'PRH_TRANSPORT_V1|OK');
assert.strictEqual(transportOnly.readCounter.value, 0);
assert.strictEqual(transportOnly.webSmokeCounter.value, 0);
assert.strictEqual(transportOnly.homeReadSmokeCounter.value, 0);

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
assert.strictEqual(healthy.readCounter.value, 1);
assert.strictEqual(healthy.webSmokeCounter.value, 1);
assert.strictEqual(healthy.homeReadSmokeCounter.value, 1);

const tokenHealthy = createContext();
const token = tokenHealthy.context.prhReleaseHealthCheckToken({ candidateSha, sourceTreeHash });
const tokenParts = token.split('|');
assert.strictEqual(tokenParts.length, 9);
assert.deepStrictEqual(tokenParts.slice(0, 8), [
  'PRH_HEALTH_V1', 'OK', candidateSha, sourceTreeHash, '1', 'V8', '3', '1'
]);
assert(/^\d+$/.test(tokenParts[8]));
assert.strictEqual(tokenHealthy.readCounter.value, 1);
assert.strictEqual(tokenHealthy.webSmokeCounter.value, 1);
assert.strictEqual(tokenHealthy.homeReadSmokeCounter.value, 1);

const publicResult = JSON.parse(JSON.stringify(result));
['amount','income','expense','balance','description','category','row','value','payload','account'].forEach((forbidden) => {
  assert(!Object.keys(publicResult).some((key) => key.toLowerCase().includes(forbidden)));
  assert(!token.toLowerCase().includes(forbidden));
});

assert.throws(() => createContext().context.prhReleaseHealthCheck({ candidateSha: 'bad', sourceTreeHash }), /RUNTIME_HEALTH_EXPECTED_BUILD_INVALID/);
assert.throws(() => createContext({ candidateSha: 'c'.repeat(40) }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }), /RUNTIME_HEALTH_BUILD_MISMATCH/);
assert.throws(() => createContext({ buildInfo: false }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }), /RUNTIME_HEALTH_BUILD_INFO_MISSING/);
assert.throws(() => createContext({ config: false }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }), /RUNTIME_HEALTH_CONFIG_MISSING/);
assert.throws(() => createContext({ sheets: ['operations', 'settings'] }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }), /RUNTIME_HEALTH_REQUIRED_SHEET_MISSING/);
assert.throws(() => createContext({ noSpreadsheet: true }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }), /RUNTIME_HEALTH_SPREADSHEET_UNAVAILABLE/);
assert.throws(() => createContext({ readFailure: true }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }), /synthetic read failure/);
assert.throws(() => createContext({ webSmokeMissing: true }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }), /RUNTIME_HEALTH_WEBAPP_SMOKE_MISSING/);
assert.throws(() => createContext({ webSmokeToken: 'PRH_WEBAPP_SMOKE_V3|R2|FAIL' }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }), /RUNTIME_HEALTH_WEBAPP_SMOKE_FAILED/);
assert.throws(() => createContext({ webSmokeThrows: true }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }), /synthetic web smoke failure/);
assert.throws(() => createContext({ homeReadSmokeMissing: true }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }), /RUNTIME_HEALTH_R2_HOME_READ_SMOKE_MISSING/);
assert.throws(() => createContext({ homeReadSmokeToken: 'PRH_R2_HOME_READ_V2|CANONICAL_LIB|FAIL|0' }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }), /RUNTIME_HEALTH_R2_HOME_READ_SMOKE_FAILED/);
assert.throws(() => createContext({ homeReadSmokeThrows: true }).context.prhReleaseHealthCheck({ candidateSha, sourceTreeHash }), /synthetic home read failure/);

console.log('runtime_health_contract_test: OK', {
  exactSha: true,
  sourceTreeHash: true,
  transportPing: true,
  privateSchemaRead: true,
  webAppRenderSmoke: 'V3_R2',
  privateHomeReadSmoke: 'V2_CANONICAL_LIB',
  scalarEntrypoint: true,
  financialPayload: false
});
