/**
 * PERF-REC-001 owner-authenticated Execution API adapter.
 *
 * Apps Script Execution API transport is string-only in the trusted runner.
 * Keep the structured probe internal and serialize only its privacy-safe
 * technical telemetry. Financial payload, labels, row IDs and Web App locator
 * are forbidden by prhPerfRecBaselineProbe().
 */
function prhPerfRecBaselineProbeJson(mode) {
  return JSON.stringify(prhPerfRecBaselineProbe(mode));
}
