'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'CostGuardService.js'), 'utf8');
const privacySource = fs.readFileSync(path.join(root, 'SecurityPrivacyPolicy.js'), 'utf8');

function makeContext() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`
    var PR_CONFIG = Object.freeze({
      FINOPS: Object.freeze({
        MODE: 'FREE_ONLY',
        PAID_OVERAGE_ALLOWED: false,
        THRESHOLDS: Object.freeze({
          NOTICE: 50,
          INCIDENT: 70,
          DEGRADE_OPTIONAL: 85,
          STOP_OPTIONAL_WRITES: 95,
          HARD_STOP: 100
        }),
        PROVIDERS: Object.freeze({
          SYNTHETIC_PROVIDER: Object.freeze({
            monthlySafetyUnits: 1000,
            paidOverageAllowed: false
          })
        })
      })
    });
    var __props = {};
    var __auditEvents = [];
    var __lockWaits = 0;
    var __lockReleases = 0;
    var PropertiesService = {
      getScriptProperties: function () {
        return {
          getProperty: function (key) {
            return Object.prototype.hasOwnProperty.call(__props, key) ? __props[key] : null;
          },
          setProperty: function (key, value) {
            __props[key] = String(value);
            return this;
          }
        };
      }
    };
    var LockService = {
      getScriptLock: function () {
        return {
          waitLock: function () { __lockWaits += 1; },
          releaseLock: function () { __lockReleases += 1; }
        };
      }
    };
    function appendAudit_(event) {
      __auditEvents.push(event);
      return 'EVT-SYNTHETIC';
    }
  `, context, { filename: 'FinOpsSyntheticRuntime.js' });
  vm.runInContext(source, context, { filename: 'CostGuardService.js' });
  return context;
}

function decide(context, usedUnits, pendingUnits, workloadClass) {
  return JSON.parse(vm.runInContext(`JSON.stringify(finopsDecision_({
    usedUnits:${usedUnits},
    budgetUnits:1000,
    pendingUnits:${pendingUnits},
    workloadClass:'${workloadClass}'
  }))`, context));
}

{
  const c = makeContext();
  const notice = decide(c, 490, 10, 'CORE_REQUIRED');
  assert.strictEqual(notice.allowed, true);
  assert.strictEqual(notice.state, 'NOTICE');
  assert.strictEqual(notice.reasonCode, 'FINOPS_NOTICE_50');
  assert.strictEqual(notice.projectedPercent, 50);

  const incident = decide(c, 690, 10, 'CORE_REQUIRED');
  assert.strictEqual(incident.allowed, true);
  assert.strictEqual(incident.state, 'INCIDENT');
  assert.strictEqual(incident.reasonCode, 'FINOPS_INCIDENT_70');
  assert.strictEqual(incident.incidentRequired, true);

  const ai = decide(c, 840, 10, 'EXPERIMENTAL_AI');
  assert.strictEqual(ai.allowed, false);
  assert.strictEqual(ai.state, 'DEGRADED');
  assert.strictEqual(ai.reasonCode, 'FINOPS_OPTIONAL_DEGRADED_85');

  const ds = decide(c, 840, 10, 'OPTIONAL_DS');
  assert.strictEqual(ds.allowed, false);
  assert.strictEqual(ds.reasonCode, 'FINOPS_OPTIONAL_DEGRADED_85');

  const enrichment = decide(c, 840, 10, 'OPTIONAL_ENRICHMENT');
  assert.strictEqual(enrichment.allowed, false);
  assert.strictEqual(enrichment.reasonCode, 'FINOPS_OPTIONAL_DEGRADED_85');

  const core85 = decide(c, 840, 10, 'CORE_REQUIRED');
  assert.strictEqual(core85.allowed, true);
  assert.strictEqual(core85.state, 'DEGRADED');

  const writes95 = decide(c, 940, 10, 'OPTIONAL_WRITE_HEAVY');
  assert.strictEqual(writes95.allowed, false);
  assert.strictEqual(writes95.reasonCode, 'FINOPS_OPTIONAL_WRITE_STOP_95');

  const core95 = decide(c, 940, 10, 'CORE_REQUIRED');
  assert.strictEqual(core95.allowed, true);
  assert.strictEqual(core95.state, 'THROTTLE');

  const hardStop = decide(c, 990, 11, 'CORE_REQUIRED');
  assert.strictEqual(hardStop.allowed, false);
  assert.strictEqual(hardStop.reasonCode, 'FINOPS_HARD_STOP_100');
  assert.strictEqual(hardStop.projectedPercent, 101);

  const paid = decide(c, 10, 1, 'PAID_REQUIRED');
  assert.strictEqual(paid.allowed, false);
  assert.strictEqual(paid.reasonCode, 'FINOPS_PAID_REQUIRED_BLOCKED');

  const unknown = decide(c, 10, 1, 'UNKNOWN_CLASS');
  assert.strictEqual(unknown.allowed, false);
  assert.strictEqual(unknown.reasonCode, 'FINOPS_WORKLOAD_CLASS_INVALID');
}

{
  const c = makeContext();
  vm.runInContext(`
    var __bucket = finopsMonthBucket_(new Date());
    var __usageKey = finopsUsageKey_('SYNTHETIC_PROVIDER', __bucket);
    var __incidentKey = finopsIncidentKey_('SYNTHETIC_PROVIDER', __bucket);
    __props[__usageKey] = '690';
  `, c);
  const reservation = JSON.parse(vm.runInContext(
    "JSON.stringify(finopsReserveUsage_('SYNTHETIC_PROVIDER','CORE_REQUIRED',10))", c));
  assert.strictEqual(reservation.allowed, true);
  assert.strictEqual(reservation.projectedUnits, 700);
  assert.strictEqual(reservation.incidentRequired, true);
  assert.strictEqual(reservation.incidentCount, 1);
  assert.strictEqual(vm.runInContext('__props[__usageKey]', c), '700');
  assert.strictEqual(vm.runInContext('__props[__incidentKey]', c), '1');
  assert.strictEqual(c.__lockWaits, 1);
  assert.strictEqual(c.__lockReleases, 1);
  assert.strictEqual(c.__auditEvents.length, 1);
  assert.strictEqual(c.__auditEvents[0].details.quotaClass, 'SYNTHETIC_PROVIDER');
  assert.strictEqual(c.__auditEvents[0].details.costUsagePercent, 70);
  assert.strictEqual(c.__auditEvents[0].details.costIncidentCount, 1);
}

{
  const c = makeContext();
  const blocked = JSON.parse(vm.runInContext(
    "JSON.stringify(finopsReserveUsage_('UNCONFIGURED_PROVIDER','CORE_REQUIRED',1))", c));
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(blocked.state, 'CIRCUIT_OPEN');
  assert.strictEqual(blocked.reasonCode, 'FINOPS_PROVIDER_NOT_CONFIGURED');
  assert.strictEqual(c.__lockWaits, 0, 'unconfigured provider must fail before reservation lock');
}

{
  const c = makeContext();
  vm.runInContext(`
    var __bucket = finopsMonthBucket_(new Date());
    var __usageKey = finopsUsageKey_('SYNTHETIC_PROVIDER', __bucket);
    __props[__usageKey] = '840';
  `, c);
  const blocked = JSON.parse(vm.runInContext(
    "JSON.stringify(finopsReserveUsage_('SYNTHETIC_PROVIDER','EXPERIMENTAL_AI',10))", c));
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(blocked.reasonCode, 'FINOPS_OPTIONAL_DEGRADED_85');
  assert.strictEqual(vm.runInContext('__props[__usageKey]', c), '840', 'blocked workload must not consume reserved units');
  assert.strictEqual(c.__lockWaits, 1);
  assert.strictEqual(c.__lockReleases, 1);
}

{
  const c = makeContext();
  assert.strictEqual(vm.runInContext("finopsProviderToken_('synthetic-provider')", c), 'SYNTHETIC_PROVIDER');
  assert.strictEqual(vm.runInContext("finopsMonthBucket_(new Date('2026-08-31T23:59:59Z'))", c), '2026-08');
  assert.throws(() => vm.runInContext("finopsProviderToken_('!')", c), /FINOPS_PROVIDER_INVALID/);
  assert.throws(() => vm.runInContext("finopsDecision_({usedUnits:0,budgetUnits:0,pendingUnits:1,workloadClass:'CORE_REQUIRED'})", c),
    /FINOPS_BUDGET_INVALID/);
}

{
  const context = {};
  vm.createContext(context);
  vm.runInContext(privacySource, context, { filename: 'SecurityPrivacyPolicy.js' });
  const safe = JSON.parse(vm.runInContext(`JSON.stringify(sanitizeAuditMetadata_({
    quotaClass:'SYNTHETIC_PROVIDER',
    costUsagePercent:70,
    costUsageUnits:700,
    costSafetyUnits:1000,
    costGuardState:'INCIDENT',
    costWorkloadClass:'CORE_REQUIRED',
    costIncidentCount:1,
    amountMinor:12345,
    description:'private',
    rawPayload:'private'
  }))`, context));
  assert.deepStrictEqual(safe, {
    quotaClass: 'SYNTHETIC_PROVIDER',
    costUsagePercent: 70,
    costUsageUnits: 700,
    costSafetyUnits: 1000,
    costGuardState: 'INCIDENT',
    costWorkloadClass: 'CORE_REQUIRED',
    costIncidentCount: 1
  });
}

assert(source.includes('getScriptLock()'));
assert(source.includes('props.setProperty(usageKey'));
assert(source.includes('FINOPS_PROVIDER_NOT_CONFIGURED'));
assert(source.includes('FINOPS_HARD_STOP_100'));
assert(!source.includes('UrlFetchApp'));
assert(!/\bfetch\s*\(/.test(source));

console.log('finops_cost_guard_contract_test: OK', {
  freeOnly: true,
  thresholds: [50, 70, 85, 95, 100],
  atomicReservation: true,
  unknownProviderFailClosed: true,
  paidRequiredBlocked: true,
  optionalDegradation: true,
  hardStop: true,
  privacySafeTelemetry: true
});
