# FINOPS-001 — FREE_ONLY runtime guard

Roadmap item: `FINOPS-001`  
Cost class: `FREE_ONLY`  
Data class: private technical usage counters only

## Invariant

`FREE_ONLY` is executable policy, not a billing preference. PrihRashOnline-v2 must not automatically enable billing, paid overage, a paid SKU, paid AI, or any billable-by-usage provider without a separate policy change.

Cloud/provider budget notifications are signals only. They are not treated as a hard cap. The application therefore owns a conservative circuit breaker before provider execution.

## Provider onboarding

`PR_CONFIG.FINOPS.PROVIDERS` is intentionally empty by default. A future provider adapter cannot run through `CostGuardService` until a reviewed PR adds an explicit provider token and a positive `monthlySafetyUnits` envelope with `paidOverageAllowed: false`.

The unit is deliberately provider-adapter-specific and normalized. FINOPS-001 does not hard-code mutable public prices/free-tier quotas. The adapter must translate its provider request into a conservative integer reservation and reserve that usage before the external call.

Unknown/unconfigured providers fail closed.

## Threshold policy

The versioned policy uses projected monthly usage after the pending reservation:

| Projected envelope | Guard behavior |
|---|---|
| `<50%` | normal allow |
| `>=50%` | NOTICE, allow eligible workload |
| `>=70%` | INCIDENT; first threshold crossing increments the technical incident counter |
| `>=85%` | experimental AI, optional enrichment/OCR-like work and optional DS recomputation are blocked |
| `>=95%` | write-heavy optional workloads are additionally blocked; eligible core/light work is throttled by policy state |
| `>100%` | hard circuit open for every workload, including core |

`PAID_REQUIRED` and unknown workload classes are always blocked in `FREE_ONLY` mode.

## Atomic conservative reservation

`finopsReserveUsage_()` acquires the Apps Script Script Lock, reads the current provider/month counter from Script Properties, evaluates the projected usage, and writes the reserved counter before the provider is allowed to execute.

This is intentionally pessimistic. If a provider request later fails, the reservation is not automatically refunded. Over-counting can temporarily degrade optional work; under-counting could create a paid-overage incident and is therefore the more dangerous failure mode.

If policy/configuration/counter storage is invalid or unavailable, the guard returns a privacy-safe `CIRCUIT_OPEN` decision instead of guessing.

## Privacy-safe observability

FINOPS telemetry is routed through the OBS-001 audit allowlist and may include only technical fields such as:

- provider/quota token;
- month bucket;
- normalized usage and safety units;
- projected usage percent;
- guard state and bounded reason code;
- workload class;
- technical cost-incident count.

It must never contain transaction amounts, descriptions, categories, accounts, merchants, formulas, raw payloads or authenticated HTML.

## CI policy

Every PR runs the named `Free-only policy` gate (`tools/free-only-scan.js`). It verifies:

- global mode is exactly `FREE_ONLY`;
- paid overage is false;
- threshold ordering is the canonical 50/70/85/95/100 policy;
- every configured provider has a positive explicit safety envelope and forbids paid overage;
- `CostGuardService` contains no provider/network/billing activation path;
- runtime contains an unknown-provider fail-closed path, hard circuit breaker and atomic reservation lock.

## Current provider state

No billable-by-usage provider is enabled by FINOPS-001. This item installs the guard before future Yandex/AI/OCR/provider adapters are allowed to depend on it.

## Rollback

Revert the FINOPS-001 PR. No `01 Операции` values, financial KPI semantics, migration provenance or private financial rows are changed by this item.
