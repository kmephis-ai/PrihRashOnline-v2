'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'LocalFirstSpaWebApp.html'), 'utf8');
const runtime = JSON.parse(fs.readFileSync(path.join(root, 'lib/local_first/local_first_runtime.v1.json'), 'utf8'));

assert.strictEqual(runtime.schema, 'PRH_LOCAL_FIRST_RUNTIME_V1');
assert.strictEqual(runtime.product_slo_targets_ms.warm_route_switch_p95, 100);
assert.strictEqual(runtime.measurement_rules.cold_bootstrap_is_warm_interaction_sla, false);
assert.strictEqual(runtime.measurement_rules.warm_route_slo_excludes_cold_query_cache, true);
assert.strictEqual(runtime.measurement_rules.warm_route_diagnostic_requires_route_cache_warmup, true);
assert.strictEqual(runtime.measurement_rules.warm_interaction_must_prove_zero_required_network, true);
assert.strictEqual(runtime.measurement_rules.warm_interaction_must_prove_zero_google_sheet_reads, true);

for (const token of [
  "warmup=FINANCE_ROUTES.slice()",
  "for(const route of warmup){navigate(route,{focusMain:false,history:false});await waitDiagnosticRoute(route)}",
  "for(const route of sequence){const started=performance.now()",
  "navigate(route,{focusMain:false,history:false})",
  "navigate(origin,{focusMain:false,history:false})",
  "opts.history!==false",
  "coldStartExcluded:true",
  "warmupCount:warmup.length",
  "routeP95Ms:Object.freeze(routeP95Ms)",
  "mandatoryNetworkCalls:0",
  "googleSheetsReads:0",
  "financeReadyFrames:samples.length",
  "Warm P95: ",
  "Измерить 10 тёплых переходов"
]) {
  assert(html.includes(token), `missing warm diagnostic contract token: ${token}`);
}

const warmupIndex = html.indexOf("for(const route of warmup){navigate(route,{focusMain:false,history:false});await waitDiagnosticRoute(route)}");
const timedIndex = html.indexOf("for(const route of sequence){const started=performance.now()");
assert(warmupIndex >= 0 && timedIndex > warmupIndex, 'all finance routes must be warmed before timed samples begin');

const navigateIndex = html.indexOf('function navigate(route,options)');
const pushIndex = html.indexOf('history.pushState', navigateIndex);
assert(navigateIndex >= 0 && pushIndex > navigateIndex, 'SPA navigate helper must retain normal client-side history');
assert(html.slice(navigateIndex, pushIndex).includes('opts.history!==false'), 'diagnostic navigation must be able to suppress history writes');

assert(!html.includes("diagnosticResult.textContent='P95: '"), 'diagnostic must not label mixed cold/warm samples as Product P95');

console.log('Local-first warm diagnostic runtime contract: PASS', {
  warmRouteTargetMs: runtime.product_slo_targets_ms.warm_route_switch_p95,
  coldQueryCacheExcluded: true,
  routeWarmupRequired: true,
  diagnosticHistoryWrites: false,
  networkRequired: false,
  googleSheetsReadsRequired: false
});
