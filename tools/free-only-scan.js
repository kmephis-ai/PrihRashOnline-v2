'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const configSource = fs.readFileSync(path.join(root, 'Config.js'), 'utf8');
const guardSource = fs.readFileSync(path.join(root, 'CostGuardService.js'), 'utf8');
const workflowSource = fs.readFileSync(path.join(root, '.github', 'workflows', 'pr-validation.yml'), 'utf8');

const context = {};
vm.createContext(context);
vm.runInContext(configSource, context, { filename: 'Config.js' });
const policy = JSON.parse(vm.runInContext('JSON.stringify(PR_CONFIG.FINOPS)', context));

assert.strictEqual(policy.MODE, 'FREE_ONLY', 'FINOPS mode must remain FREE_ONLY');
assert.strictEqual(policy.PAID_OVERAGE_ALLOWED, false, 'paid overage must be disabled');
assert.deepStrictEqual(policy.THRESHOLDS, {
  NOTICE: 50,
  INCIDENT: 70,
  DEGRADE_OPTIONAL: 85,
  STOP_OPTIONAL_WRITES: 95,
  HARD_STOP: 100
});

for (const [providerName, provider] of Object.entries(policy.PROVIDERS || {})) {
  assert(/^[A-Z][A-Z0-9_]{1,31}$/.test(providerName), `invalid provider token: ${providerName}`);
  assert(Number.isInteger(provider.monthlySafetyUnits) && provider.monthlySafetyUnits > 0,
    `provider ${providerName} requires a positive monthlySafetyUnits envelope`);
  assert.strictEqual(provider.paidOverageAllowed, false,
    `provider ${providerName} must not permit paid overage`);
}

assert(!/PAID_OVERAGE_ALLOWED\s*:\s*true/.test(configSource), 'Config must not enable paid overage');
assert(!/paidOverageAllowed\s*:\s*true/.test(configSource), 'Provider config must not enable paid overage');
assert(!/UrlFetchApp\s*\./.test(guardSource), 'Cost guard must not call external providers');
assert(!/\bfetch\s*\(/.test(guardSource), 'Cost guard must not call external providers');
assert(!/billingAccounts|enableBilling|billingEnabled\s*=\s*true/i.test(guardSource),
  'Cost guard must not enable billing');
assert(guardSource.includes("MODE !== 'FREE_ONLY'"), 'runtime must validate FREE_ONLY mode');
assert(guardSource.includes("PAID_OVERAGE_ALLOWED !== false"), 'runtime must fail closed if paid overage policy drifts');
assert(guardSource.includes('FINOPS_PROVIDER_NOT_CONFIGURED'), 'unknown provider must fail closed');
assert(guardSource.includes('FINOPS_HARD_STOP_100'), 'hard circuit breaker must exist');
assert(guardSource.includes('getScriptLock()'), 'usage reservation must be atomic under script lock');
assert(workflowSource.includes('- name: Free-only policy'), 'PR Validation must expose a named free-only gate');
assert(workflowSource.includes('run: node tools/free-only-scan.js'), 'PR Validation must run the free-only scanner');

console.log('free-only: PASS', {
  mode: policy.MODE,
  providersConfigured: Object.keys(policy.PROVIDERS || {}).length,
  thresholds: policy.THRESHOLDS,
  paidOverageAllowed: policy.PAID_OVERAGE_ALLOWED,
  runtimeCircuitBreaker: true
});
