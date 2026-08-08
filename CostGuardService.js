/**
 * FINOPS-001 FREE_ONLY runtime guard.
 *
 * This service never enables billing and never calls an external provider. A
 * provider adapter must reserve conservative normalized usage units here before
 * making a billable-by-usage call. Reservation is intentionally pessimistic:
 * failed provider work may over-count, but runtime must never under-count and
 * accidentally cross a paid-overage boundary.
 */
var PR_FINOPS_WORKLOAD_CLASSES = Object.freeze({
  CORE_REQUIRED: 'CORE_REQUIRED',
  OPTIONAL_LIGHT: 'OPTIONAL_LIGHT',
  OPTIONAL_WRITE_HEAVY: 'OPTIONAL_WRITE_HEAVY',
  OPTIONAL_DS: 'OPTIONAL_DS',
  OPTIONAL_ENRICHMENT: 'OPTIONAL_ENRICHMENT',
  EXPERIMENTAL_AI: 'EXPERIMENTAL_AI',
  PAID_REQUIRED: 'PAID_REQUIRED'
});

var PR_FINOPS_MAX_COUNTER = 999999999999;

function finopsProviderToken_(provider) {
  var token = String(provider || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 32);
  if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(token)) {
    throw new Error('FINOPS_PROVIDER_INVALID');
  }
  return token;
}

function finopsMonthBucket_(dateValue) {
  var date = dateValue instanceof Date ? dateValue : new Date(dateValue || Date.now());
  if (!isFinite(date.getTime())) {
    throw new Error('FINOPS_MONTH_INVALID');
  }
  var month = date.getUTCMonth() + 1;
  return String(date.getUTCFullYear()) + '-' + (month < 10 ? '0' : '') + String(month);
}

function finopsUsageKey_(providerToken, monthBucket) {
  return 'PR_FINOPS_USAGE_' + String(monthBucket || '').replace(/[^0-9]/g, '') + '_' + providerToken;
}

function finopsIncidentKey_(providerToken, monthBucket) {
  return 'PR_FINOPS_INCIDENT_' + String(monthBucket || '').replace(/[^0-9]/g, '') + '_' + providerToken;
}

function finopsBoundedUnits_(value) {
  var parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || Math.floor(parsed) !== parsed) {
    throw new Error('FINOPS_USAGE_UNITS_INVALID');
  }
  return Math.min(parsed, PR_FINOPS_MAX_COUNTER);
}

function finopsWorkloadClass_(value) {
  var token = String(value || '');
  var allowed = Object.keys(PR_FINOPS_WORKLOAD_CLASSES).some(function (key) {
    return PR_FINOPS_WORKLOAD_CLASSES[key] === token;
  });
  return allowed ? token : '';
}

function finopsValidateGlobalPolicy_() {
  var policy = PR_CONFIG && PR_CONFIG.FINOPS;
  if (!policy || policy.MODE !== 'FREE_ONLY' || policy.PAID_OVERAGE_ALLOWED !== false) {
    throw new Error('FINOPS_FREE_ONLY_POLICY_INVALID');
  }
  var t = policy.THRESHOLDS || {};
  if (t.NOTICE !== 50 || t.INCIDENT !== 70 || t.DEGRADE_OPTIONAL !== 85
      || t.STOP_OPTIONAL_WRITES !== 95 || t.HARD_STOP !== 100) {
    throw new Error('FINOPS_THRESHOLDS_INVALID');
  }
  return policy;
}

function finopsProviderPolicy_(providerToken) {
  var policy = finopsValidateGlobalPolicy_();
  var providers = policy.PROVIDERS || {};
  var provider = providers[providerToken];
  if (!provider) {
    throw new Error('FINOPS_PROVIDER_NOT_CONFIGURED');
  }
  var monthlySafetyUnits = finopsBoundedUnits_(provider.monthlySafetyUnits);
  if (monthlySafetyUnits < 1 || provider.paidOverageAllowed !== false) {
    throw new Error('FINOPS_PROVIDER_POLICY_INVALID');
  }
  return {
    provider: providerToken,
    monthlySafetyUnits: monthlySafetyUnits,
    paidOverageAllowed: false
  };
}

function finopsPercent_(units, budgetUnits) {
  if (budgetUnits < 1) {
    throw new Error('FINOPS_BUDGET_INVALID');
  }
  return Math.ceil((units / budgetUnits) * 100);
}

function finopsDecision_(input) {
  var request = input || {};
  var usedUnits = finopsBoundedUnits_(request.usedUnits || 0);
  var budgetUnits = finopsBoundedUnits_(request.budgetUnits || 0);
  var pendingUnits = finopsBoundedUnits_(request.pendingUnits || 0);
  var workloadClass = finopsWorkloadClass_(request.workloadClass);
  if (budgetUnits < 1) {
    throw new Error('FINOPS_BUDGET_INVALID');
  }
  if (pendingUnits < 1) {
    throw new Error('FINOPS_PENDING_UNITS_INVALID');
  }

  var currentPercent = finopsPercent_(usedUnits, budgetUnits);
  var projectedUnits = Math.min(usedUnits + pendingUnits, PR_FINOPS_MAX_COUNTER);
  var projectedPercent = finopsPercent_(projectedUnits, budgetUnits);
  var incidentRequired = currentPercent < 70 && projectedPercent >= 70;

  if (!workloadClass) {
    return finopsDecisionResult_(false, 'CIRCUIT_OPEN', 'FINOPS_WORKLOAD_CLASS_INVALID', workloadClass, usedUnits,
      pendingUnits, projectedUnits, budgetUnits, currentPercent, projectedPercent, incidentRequired);
  }
  if (workloadClass === PR_FINOPS_WORKLOAD_CLASSES.PAID_REQUIRED) {
    return finopsDecisionResult_(false, 'CIRCUIT_OPEN', 'FINOPS_PAID_REQUIRED_BLOCKED', workloadClass, usedUnits,
      pendingUnits, projectedUnits, budgetUnits, currentPercent, projectedPercent, incidentRequired);
  }
  if (projectedPercent > 100) {
    return finopsDecisionResult_(false, 'CIRCUIT_OPEN', 'FINOPS_HARD_STOP_100', workloadClass, usedUnits,
      pendingUnits, projectedUnits, budgetUnits, currentPercent, projectedPercent, incidentRequired);
  }
  if (projectedPercent >= 95 && workloadClass === PR_FINOPS_WORKLOAD_CLASSES.OPTIONAL_WRITE_HEAVY) {
    return finopsDecisionResult_(false, 'CIRCUIT_OPEN', 'FINOPS_OPTIONAL_WRITE_STOP_95', workloadClass, usedUnits,
      pendingUnits, projectedUnits, budgetUnits, currentPercent, projectedPercent, incidentRequired);
  }
  if (projectedPercent >= 85 && (
    workloadClass === PR_FINOPS_WORKLOAD_CLASSES.EXPERIMENTAL_AI
    || workloadClass === PR_FINOPS_WORKLOAD_CLASSES.OPTIONAL_ENRICHMENT
    || workloadClass === PR_FINOPS_WORKLOAD_CLASSES.OPTIONAL_DS
  )) {
    return finopsDecisionResult_(false, 'DEGRADED', 'FINOPS_OPTIONAL_DEGRADED_85', workloadClass, usedUnits,
      pendingUnits, projectedUnits, budgetUnits, currentPercent, projectedPercent, incidentRequired);
  }

  var state = 'ALLOW';
  var reasonCode = 'OK';
  if (projectedPercent >= 95) {
    state = 'THROTTLE';
    reasonCode = 'FINOPS_THROTTLE_95';
  } else if (projectedPercent >= 85) {
    state = 'DEGRADED';
    reasonCode = 'FINOPS_DEGRADE_85';
  } else if (projectedPercent >= 70) {
    state = 'INCIDENT';
    reasonCode = 'FINOPS_INCIDENT_70';
  } else if (projectedPercent >= 50) {
    state = 'NOTICE';
    reasonCode = 'FINOPS_NOTICE_50';
  }
  return finopsDecisionResult_(true, state, reasonCode, workloadClass, usedUnits,
    pendingUnits, projectedUnits, budgetUnits, currentPercent, projectedPercent, incidentRequired);
}

function finopsDecisionResult_(allowed, state, reasonCode, workloadClass, usedUnits,
  pendingUnits, projectedUnits, budgetUnits, currentPercent, projectedPercent, incidentRequired) {
  return {
    allowed: allowed === true,
    state: String(state || 'CIRCUIT_OPEN'),
    reasonCode: String(reasonCode || 'FINOPS_FAIL_CLOSED'),
    workloadClass: String(workloadClass || 'UNKNOWN'),
    usedUnits: usedUnits,
    pendingUnits: pendingUnits,
    projectedUnits: projectedUnits,
    budgetUnits: budgetUnits,
    currentPercent: currentPercent,
    projectedPercent: projectedPercent,
    incidentRequired: incidentRequired === true
  };
}

function finopsProperties_() {
  return PropertiesService.getScriptProperties();
}

function finopsReadCounter_(props, key) {
  var raw = props.getProperty(key);
  if (raw === null || raw === '') {
    return 0;
  }
  return finopsBoundedUnits_(raw);
}

function finopsSafeBlockedDecision_(reasonCode, provider, workloadClass, pendingUnits) {
  return {
    allowed: false,
    state: 'CIRCUIT_OPEN',
    reasonCode: String(reasonCode || 'FINOPS_FAIL_CLOSED').slice(0, 64),
    provider: String(provider || 'UNKNOWN').slice(0, 32),
    workloadClass: String(workloadClass || 'UNKNOWN').slice(0, 32),
    usedUnits: 0,
    pendingUnits: Number.isFinite(Number(pendingUnits)) ? Math.max(0, Math.floor(Number(pendingUnits))) : 0,
    projectedUnits: 0,
    budgetUnits: 0,
    currentPercent: 0,
    projectedPercent: 0,
    incidentRequired: false,
    incidentCount: 0,
    monthBucket: finopsMonthBucket_(new Date())
  };
}

function finopsReserveUsage_(provider, workloadClass, pendingUnits) {
  var lock = null;
  var locked = false;
  var providerToken = '';
  try {
    providerToken = finopsProviderToken_(provider);
    var units = finopsBoundedUnits_(pendingUnits);
    if (units < 1) {
      throw new Error('FINOPS_PENDING_UNITS_INVALID');
    }
    var providerPolicy = finopsProviderPolicy_(providerToken);
    var monthBucket = finopsMonthBucket_(new Date());
    var usageKey = finopsUsageKey_(providerToken, monthBucket);
    var incidentKey = finopsIncidentKey_(providerToken, monthBucket);

    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    locked = true;

    var props = finopsProperties_();
    var usedUnits = finopsReadCounter_(props, usageKey);
    var incidentCount = finopsReadCounter_(props, incidentKey);
    var decision = finopsDecision_({
      usedUnits: usedUnits,
      budgetUnits: providerPolicy.monthlySafetyUnits,
      pendingUnits: units,
      workloadClass: workloadClass
    });

    decision.provider = providerToken;
    decision.monthBucket = monthBucket;
    decision.incidentCount = incidentCount;

    if (decision.allowed) {
      props.setProperty(usageKey, String(decision.projectedUnits));
      if (decision.incidentRequired) {
        incidentCount = Math.min(incidentCount + 1, PR_FINOPS_MAX_COUNTER);
        props.setProperty(incidentKey, String(incidentCount));
        decision.incidentCount = incidentCount;
      }
    }
    finopsAuditDecision_(decision);
    return decision;
  } catch (error) {
    var reason = String(error && error.message || '');
    if (!/^FINOPS_[A-Z0-9_]+$/.test(reason)) {
      reason = 'FINOPS_GUARD_INTERNAL_FAIL_CLOSED';
    }
    var blocked = finopsSafeBlockedDecision_(reason, providerToken || provider, workloadClass, pendingUnits);
    finopsAuditDecision_(blocked);
    return blocked;
  } finally {
    if (locked && lock) {
      try {
        lock.releaseLock();
      } catch (_) {
        // Conservative reservation is already durable; lock-release failure must
        // not convert an allowed reservation into an uncounted provider call.
      }
    }
  }
}

function finopsAuditDecision_(decision) {
  try {
    if (typeof appendAudit_ !== 'function') {
      return false;
    }
    appendAudit_({
      level: decision.allowed ? 'INFO' : 'WARN',
      type: 'FINOPS_GUARD',
      module: 'CostGuardService',
      result: decision.allowed ? 'PASS' : 'BLOCKED',
      messageCode: decision.reasonCode,
      details: {
        quotaClass: decision.provider,
        costUsagePercent: decision.projectedPercent,
        costUsageUnits: decision.projectedUnits,
        costSafetyUnits: decision.budgetUnits,
        costGuardState: decision.state,
        costWorkloadClass: decision.workloadClass,
        costIncidentCount: decision.incidentCount
      }
    });
    return true;
  } catch (_) {
    return false;
  }
}
