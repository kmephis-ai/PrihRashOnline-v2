/**
 * Authenticated read-only runtime proof for CI-002.
 * Returns technical metadata only; no financial rows, values, categories or descriptions.
 */
function prhReleaseHealthCheck(expectedBuild) {
  var startedAt = Date.now();
  var expected = expectedBuild && typeof expectedBuild === 'object' ? expectedBuild : {};
  var expectedSha = String(expected.candidateSha || '');
  var expectedTreeHash = String(expected.sourceTreeHash || '');

  if (!/^[0-9a-f]{40}$/.test(expectedSha) || !/^[0-9a-f]{64}$/.test(expectedTreeHash)) {
    throw new Error('RUNTIME_HEALTH_EXPECTED_BUILD_INVALID');
  }
  if (typeof PR_BUILD_INFO !== 'object' || !PR_BUILD_INFO) {
    throw new Error('RUNTIME_HEALTH_BUILD_INFO_MISSING');
  }
  if (String(PR_BUILD_INFO.candidateSha || '') !== expectedSha || String(PR_BUILD_INFO.sourceTreeHash || '') !== expectedTreeHash) {
    throw new Error('RUNTIME_HEALTH_BUILD_MISMATCH');
  }
  if (!PR_CONFIG || !PR_CONFIG.SHEETS) throw new Error('RUNTIME_HEALTH_CONFIG_MISSING');

  var requiredSheets = [PR_CONFIG.SHEETS.OPERATIONS, PR_CONFIG.SHEETS.SETTINGS, PR_CONFIG.SHEETS.CONTROL];
  if (requiredSheets.some(function(name){return !name;})) throw new Error('RUNTIME_HEALTH_SCHEMA_CONFIG_INVALID');
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('RUNTIME_HEALTH_SPREADSHEET_UNAVAILABLE');
  var sheets = requiredSheets.map(function(name){return spreadsheet.getSheetByName(name);});
  if (sheets.some(function(sheet){return !sheet;})) throw new Error('RUNTIME_HEALTH_REQUIRED_SHEET_MISSING');
  sheets[0].getRange(1,1).getValue();

  if (typeof prhWebAppRenderSmokeToken !== 'function') throw new Error('RUNTIME_HEALTH_WEBAPP_SMOKE_MISSING');
  var webAppSmoke = prhWebAppRenderSmokeToken();
  if (webAppSmoke !== 'PRH_WEBAPP_SMOKE_V5|R2|OK') throw new Error('RUNTIME_HEALTH_WEBAPP_SMOKE_FAILED');

  if (typeof prhR2FinancialHomeReadSmokeToken !== 'function') throw new Error('RUNTIME_HEALTH_R2_HOME_READ_SMOKE_MISSING');
  var homeReadSmoke = prhR2FinancialHomeReadSmokeToken();
  if (homeReadSmoke !== 'PRH_R2_HOME_READ_V3|CANONICAL_LIB|DIMENSION_HASH|OK|7') {
    throw new Error('RUNTIME_HEALTH_R2_HOME_READ_SMOKE_FAILED');
  }

  // DATA-REC-001 module/boundary proof. It validates that exact deployed code
  // carries Explorer/DQ/single-scan modules and zero write/autorepair authority.
  // No second workbook scan is performed here; product routes are verified by
  // exact-SHA Product Ready evidence downstream.
  if (typeof prhR2DataRuntimeSmokeToken !== 'function') throw new Error('RUNTIME_HEALTH_R2_DATA_SMOKE_MISSING');
  var dataRuntimeSmoke = prhR2DataRuntimeSmokeToken();
  if (dataRuntimeSmoke !== 'PRH_R2_DATA_RUNTIME_V1|READ_ONLY|OK') {
    throw new Error('RUNTIME_HEALTH_R2_DATA_SMOKE_FAILED');
  }

  // FIN-LF-001 owner-data proof. Execute the exact scalar JSON wire endpoint
  // used by google.script.run after an empty/wiped IndexedDB. Owner payload is
  // parsed and validated only inside this Apps Script execution and never
  // returned to CI. This proves the deployed endpoint serializes nullable
  // canonical keys into real JSON bytes before the browser RPC boundary.
  if (typeof prhLocalFirstSyncBootstrapWire !== 'function') {
    throw new Error('RUNTIME_HEALTH_LOCAL_FIRST_SYNC_WIRE_MISSING');
  }
  var localFirstWire;
  var localFirstBootstrap;
  try {
    localFirstWire = prhLocalFirstSyncBootstrapWire({ local_revision: '' });
    if (typeof localFirstWire !== 'string' || !localFirstWire) {
      throw new Error('LOCAL_FIRST_SYNC_WIRE_RESPONSE_INVALID');
    }
    localFirstBootstrap = JSON.parse(localFirstWire);
  } catch (error) {
    var localFirstRaw = String(error && (error.code || error.message) || '').trim();
    var localFirstMatch = localFirstRaw.match(/\b(?:LOCAL_FIRST|CANONICAL|R2|WORKER)_[A-Z0-9_]{2,96}\b/);
    if (localFirstMatch) {
      throw new Error('RUNTIME_HEALTH_LOCAL_FIRST_' + localFirstMatch[0]);
    }
    throw new Error('RUNTIME_HEALTH_LOCAL_FIRST_UNCLASSIFIED_FAILURE');
  }
  if (!localFirstBootstrap || localFirstBootstrap.state !== 'FULL_BOOTSTRAP' ||
      localFirstBootstrap.schema !== 'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1' ||
      localFirstBootstrap.financial_write_authorized !== false ||
      localFirstBootstrap.canonical_mutation_performed !== false ||
      !Array.isArray(localFirstBootstrap.transactions) ||
      localFirstBootstrap.transactions.some(function(tx) {
        return !tx || !Object.prototype.hasOwnProperty.call(tx, 'destination_account_id');
      }) ||
      !Number.isInteger(localFirstBootstrap.serialized_chars) || localFirstBootstrap.serialized_chars < 1) {
    throw new Error('RUNTIME_HEALTH_LOCAL_FIRST_BOOTSTRAP_INVALID');
  }

  // PLAN-REC-001 owner-authority proof. The planning payload remains inside
  // authenticated Apps Script execution; CI receives only the stable health token.
  // This validates exact canonical-revision binding plus no-write/no-inference
  // authority without requiring 06 Баланс to exist: SETUP_REQUIRED is a valid
  // owner-visible state and Cash Flow must never substitute for balance observations.
  if (typeof prhPlanningLocalFirstBootstrapWire !== 'function') {
    throw new Error('RUNTIME_HEALTH_PLANNING_SYNC_WIRE_MISSING');
  }
  var planningWire;
  var planningBootstrap;
  try {
    planningWire = prhPlanningLocalFirstBootstrapWire({
      local_planning_revision: '',
      expected_canonical_revision: String(localFirstBootstrap.revision || '')
    });
    if (typeof planningWire !== 'string' || !planningWire) {
      throw new Error('PLANNING_SYNC_WIRE_RESPONSE_INVALID');
    }
    planningBootstrap = JSON.parse(planningWire);
  } catch (error) {
    var planningRaw = String(error && (error.code || error.message) || '').trim();
    var planningMatch = planningRaw.match(/\b(?:PLANNING|LOCAL_PLANNING|CANONICAL|R2)_[A-Z0-9_]{2,96}\b/);
    if (planningMatch) throw new Error('RUNTIME_HEALTH_PLANNING_' + planningMatch[0]);
    throw new Error('RUNTIME_HEALTH_PLANNING_UNCLASSIFIED_FAILURE');
  }
  if (!planningBootstrap || planningBootstrap.state !== 'FULL_SNAPSHOT' ||
      planningBootstrap.schema !== 'PRH_LOCAL_PLANNING_SYNC_RESPONSE_V1' ||
      planningBootstrap.canonical_revision !== localFirstBootstrap.revision ||
      !/^[0-9a-f]{64}$/.test(String(planningBootstrap.planning_revision || '')) ||
      planningBootstrap.financial_write_authorized !== false ||
      planningBootstrap.canonical_mutation_performed !== false ||
      planningBootstrap.auto_transaction_creation !== false ||
      planningBootstrap.cash_flow_balance_proxy_used !== false ||
      !planningBootstrap.source || planningBootstrap.source.schema !== 'PRH_LOCAL_PLANNING_SOURCE_V1' ||
      planningBootstrap.source.canonical_revision !== localFirstBootstrap.revision ||
      planningBootstrap.source.planning_revision !== planningBootstrap.planning_revision ||
      !planningBootstrap.source.budget || !planningBootstrap.source.recurring ||
      !planningBootstrap.source.commitments || !planningBootstrap.source.liquidity) {
    throw new Error('RUNTIME_HEALTH_PLANNING_BOOTSTRAP_INVALID');
  }

  return {
    ok:true,
    status:'OK',
    candidateSha:expectedSha,
    sourceTreeHash:expectedTreeHash,
    buildInfoSchemaVersion:Number(PR_BUILD_INFO.schemaVersion || 0),
    runtime:'V8',
    requiredSheetCount:requiredSheets.length,
    readCheck:true,
    dataRuntimeCheck:true,
    localFirstSyncCheck:true,
    planningLocalFirstCheck:true,
    latencyMs:Math.max(0,Date.now()-startedAt)
  };
}

function prhRuntimeTransportPing() {
  return 'PRH_TRANSPORT_V1|OK';
}

/**
 * Stable scalar transport contract. Keep its field count backward compatible;
 * DATA and Local-first runtime proofs are enforced inside prhReleaseHealthCheck
 * before this token can be returned rather than adding serialized fields.
 */
function prhReleaseHealthCheckToken(expectedBuild) {
  var result = prhReleaseHealthCheck(expectedBuild);
  return [
    'PRH_HEALTH_V1',result.status,result.candidateSha,result.sourceTreeHash,result.buildInfoSchemaVersion,result.runtime,
    result.requiredSheetCount,result.readCheck ? 1 : 0,result.latencyMs
  ].join('|');
}
