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
  if (String(PR_BUILD_INFO.candidateSha || '') !== expectedSha ||
      String(PR_BUILD_INFO.sourceTreeHash || '') !== expectedTreeHash) {
    throw new Error('RUNTIME_HEALTH_BUILD_MISMATCH');
  }
  if (!PR_CONFIG || !PR_CONFIG.SHEETS) {
    throw new Error('RUNTIME_HEALTH_CONFIG_MISSING');
  }

  var requiredSheets = [
    PR_CONFIG.SHEETS.OPERATIONS,
    PR_CONFIG.SHEETS.SETTINGS,
    PR_CONFIG.SHEETS.CONTROL
  ];
  if (requiredSheets.some(function (name) { return !name; })) {
    throw new Error('RUNTIME_HEALTH_SCHEMA_CONFIG_INVALID');
  }

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('RUNTIME_HEALTH_SPREADSHEET_UNAVAILABLE');
  }
  var sheets = requiredSheets.map(function (name) {
    return spreadsheet.getSheetByName(name);
  });
  if (sheets.some(function (sheet) { return !sheet; })) {
    throw new Error('RUNTIME_HEALTH_REQUIRED_SHEET_MISSING');
  }

  // Authoritative read-capability proof. The header value is deliberately discarded.
  // No worksheet contents are returned or logged by this function.
  sheets[0].getRange(1, 1).getValue();

  // Web App entry-path proof. The smoke renders the canonical R2 shell + Financial Home
  // default route using synthetic technical metadata only; it reads no workbook rows and exposes no private URL.
  if (typeof prhWebAppRenderSmokeToken !== 'function') {
    throw new Error('RUNTIME_HEALTH_WEBAPP_SMOKE_MISSING');
  }
  var webAppSmoke = prhWebAppRenderSmokeToken();
  if (webAppSmoke !== 'PRH_WEBAPP_SMOKE_V3|R2|OK') {
    throw new Error('RUNTIME_HEALTH_WEBAPP_SMOKE_FAILED');
  }

  // Private binding proof. This invokes the real read-only Home projection on the
  // deployed workbook through the generated canonical-lib runtime bundle, but receives
  // only a constant technical scalar without financial payload.
  if (typeof prhR2FinancialHomeReadSmokeToken !== 'function') {
    throw new Error('RUNTIME_HEALTH_R2_HOME_READ_SMOKE_MISSING');
  }
  var homeReadSmoke = prhR2FinancialHomeReadSmokeToken();
  if (homeReadSmoke !== 'PRH_R2_HOME_READ_V2|CANONICAL_LIB|OK|7') {
    throw new Error('RUNTIME_HEALTH_R2_HOME_READ_SMOKE_FAILED');
  }

  return {
    ok: true,
    status: 'OK',
    candidateSha: expectedSha,
    sourceTreeHash: expectedTreeHash,
    buildInfoSchemaVersion: Number(PR_BUILD_INFO.schemaVersion || 0),
    runtime: 'V8',
    requiredSheetCount: requiredSheets.length,
    readCheck: true,
    latencyMs: Math.max(0, Date.now() - startedAt)
  };
}

/**
 * Constant authenticated transport proof. It deliberately touches no spreadsheet,
 * service, property, or financial payload. If this scalar is returned, OAuth +
 * Apps Script API executable transport is working independently of workbook health.
 */
function prhRuntimeTransportPing() {
  return 'PRH_TRANSPORT_V1|OK';
}

/**
 * Stable scalar entrypoint for clasp/Execution API health verification.
 * It deliberately serializes only the technical fields already returned by
 * prhReleaseHealthCheck so CI never needs to inspect spreadsheet payloads.
 */
function prhReleaseHealthCheckToken(expectedBuild) {
  var result = prhReleaseHealthCheck(expectedBuild);
  return [
    'PRH_HEALTH_V1',
    result.status,
    result.candidateSha,
    result.sourceTreeHash,
    result.buildInfoSchemaVersion,
    result.runtime,
    result.requiredSheetCount,
    result.readCheck ? 1 : 0,
    result.latencyMs
  ].join('|');
}
