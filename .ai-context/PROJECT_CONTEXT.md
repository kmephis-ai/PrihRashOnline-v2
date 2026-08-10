# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys и owner-private payload запрещены.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — **Executable GitHub Roadmap v2.3**, канонический Roadmap.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Versioned contracts + architecture/ADR/operations docs.

## Current R0 truth

R0 machine-proven complete. `MASTER-G0`, `MASTER-G1`, `MASTER-G2` закрыты. `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`.

## Current R1 truth

`MASTER-G3 / Canonical platform` — complete. Independently generated synthetic 20k/50k performance = PASS.

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS.
- `TEST-010` — **DONE**, Issue #100 Main Verification PASS.
- `OBS-010` — **DONE**, Issue #103 Main Verification PASS.
- `PERF-010` — **DONE**; `PERF-011` — **DONE**; `PERF-012` — **DONE**; `PERF-013` — **DONE**; `PERF-014` — **DONE**.
- `DOC-010` — **DONE**, Issue #116 Main Verification PASS; `PRH_R1_DOCUMENTATION_V1@1.0.0` verified.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository authority. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Current R2 truth

- `DESIGN-020` — **DONE**, Issue #118 Main Verification PASS.
- `VIZ-020` — **DONE**, Issue #120 Main Verification PASS.
- `HOME-020` — **DONE**, Issue #122 Main Verification PASS.
- `TX-020` — **DONE**, Issue #124 Main Verification PASS.
- `EXP-020` — **DONE**, Issue #126 Main Verification PASS.
- `INC-020` — **DONE**, Issue #128 Main Verification PASS.
- `CF-020` — **DONE**, Issue #130 Main Verification PASS.
- `BUD-020` — **DONE**, Issue #132 Main Verification PASS.
- `OBL-020` — **DONE**, Issue #134 Main Verification PASS.
- `DQ-020` — **DONE**, Issue #136 Main Verification PASS, merge `e02ea53a35ec6a15828f4961d3ab2895bb7e7d4e`.
- `PWA-020` — **current R2 writer**, Issue #137, branch `agent/PWA-020-installable-pwa`; IN_PROGRESS до Main Verification.

## PWA-020 boundary

Machine contract: `lib/pwa/pwa_baseline.v1.json` (`PRH_PWA_BASELINE_V1@1.0.0`). Bundle: `pwa/`. Human contract: `docs/architecture/PWA_BASELINE.md`. Tests: `tests/pwa_baseline_contract_test.js`, `tests/pwa_offline_visual_test.js`.

Rules:

- PWA consumes HOME-020/TX-020/DESIGN-020 and does not redefine financial/canonical semantics.
- Supported host requirement = `SECURE_ORIGIN_OR_LOCALHOST`; current Apps Script HtmlService service-worker activation remains `NOT_PROVEN_CURRENT_HOST`.
- No private Apps Script deployment locator is published; family runtime remains private `MYSELF`.
- Cache version = `prh-pwa-shell-v1`; only five explicit static shell URLs are cacheable.
- Default same-origin behavior is `NETWORK_ONLY`; private tokens `/api/`, `/private/`, `/finance/`, `/dashboard/`, `/transactions/`, `/analytics/`, `/home/`, `/explorer/` use `NETWORK_ONLY_NO_CACHE_FALLBACK`.
- Cross-origin and non-GET requests are never cached. Authenticated/financial response cache is forbidden.
- Activate deletes non-current `prh-pwa-shell-*` caches then calls `clients.claim()`; stale financial cache migration is forbidden.
- Real Chromium localhost evidence must prove service-worker control, exactly five shell cache entries, zero private cache entries, offline shell success and offline private-request failure.
- Offline shell is public-safe static UI, not financial truth and not private runtime data.
- `FREE_ONLY` mandatory; no external CDN/provider required.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. PWA static/runtime contract is `RUNTIME_INTEGRATION`; real Chromium offline test is `UI_E2E`. Unknown or ambiguous classification fails.

## MIG-010 historical verified boundary

Owner-private migration remains DONE/OWNER_VERIFIED with `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed occurrence identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Authorized execution was governed by `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion until post-write reconciliation PASS.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` is exact-bound and non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations. Generic Google financial write remains blocked by `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Current delivery

```text
PR Validation
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification
```

PWA-020 remains open until manifest/SW/cache-policy/real-browser/full layered evidence are green, trusted exact-head deploy/runtime health passes and Main Verification closes Issue #137.

## Read-only multi-AI review

Required roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority=false`; review is supplementary evidence and never overrides red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data stays private. Private deployment identifiers, authenticated responses, OAuth, backups/keys and financial runtime responses are forbidden in PWA public evidence/cache. Family Web App remains private `MYSELF`. `FREE_ONLY` remains mandatory.

## Domain boundaries

FIN-010: `FIN-TRUTH-v1`. DATA-010: `PRH_CANONICAL_TRANSACTION_V1`. ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google mutation blocked with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`. PWA-020 owns only static shell/install/cache policy evidence; `financial_write=false`, `private_runtime_publication=false`.

## Scope handoff

All R1 items plus DESIGN-020/VIZ-020/HOME-020/TX-020/EXP-020/INC-020/CF-020/BUD-020/OBL-020/DQ-020 are DONE. `MASTER-G3 = complete`. `PWA-020` is the single current R2 writer.
