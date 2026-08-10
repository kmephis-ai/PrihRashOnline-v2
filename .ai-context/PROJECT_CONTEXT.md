# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys, private scope assignments и owner-private payload запрещены.

## LANG-RU

Русский язык — единственный нормативный язык human-facing документации, GitHub metadata и AI instructions. Machine identifiers, API/schema fields, library/protocol/standard names, команды и технические пути сохраняются без перевода. Параллельный English source of truth запрещён. Причины решений, ограничения, критерии приёмки и эксплуатационные инструкции должны оставаться понятными русскоязычному владельцу проекта.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — Executable GitHub Roadmap v2.3.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Versioned contracts + architecture/ADR/operations docs.

## Current R0 truth

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`, `AIENG-006 = DONE`, `DOC-001 = DONE`, `DOC-002 = DONE`, `FINOPS-001 = DONE`.

`DOC-002` Issue #75 — DONE/Main Verification PASS, merge `8495dc730166f4e5fb7a03b5a7ab780501f6bbf5`; `PRH_LANGUAGE_POLICY_V1@1.0.0` остаётся обязательным governance contract. `AIENG-006` Issue #146 — DONE/Main Verification PASS, merge `0f7722c48dfc05b12efd861ecaa5d0b1f408c98a`; required machine gates остаются `LOCAL_DETERMINISTIC`, separately billed API default disabled.

## Current R1 truth

`MASTER-G3 / Canonical platform` — complete. Independently generated synthetic 20k/50k performance = PASS.

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS; `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`.
- `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010` — **DONE**.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository authority. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Current R2 truth

DESIGN-020, VIZ-020, HOME-020, TX-020, EXP-020, INC-020, CF-020, BUD-020, OBL-020, DQ-020 and PWA-020 are DONE/Main Verification PASS. `NOT_PROVEN_CURRENT_HOST` remains the current Apps Script HtmlService service-worker state; private financial/authenticated responses are never allowed in PWA cache.

## Current R4 truth

- `YC-040` — **DONE**, Issue #141 Main Verification PASS, merge `924a44f4cb01e6add6c7fd9a0b166d7a7743b96a`.
- `AUTH-040` — **DONE**, Issue #142 Main Verification PASS, merge `455c7fdaaaee118369294d96183631d7322e5ea2`.
- `YC-041` — **BLOCKED**, Issue #148, `OWNER_CLOUD_BOOTSTRAP_REQUIRED`, `writer_authority=false`.
- `YC-042` — **BLOCKED**, Issue #149, `OWNER_YDB_TARGET_REQUIRED`, `writer_authority=false`.

Google remains authoritative. Blocked cloud items не создают live cloud resources, billing-backed infrastructure или новый write ownership.

## Current R7 truth

- `ANL-070` — **DONE**, Issue #150 Main Verification PASS, merge `d8b429221aa02416c4103bf58c2f3439f79ad0a9`; authority `PRH_ANALYTICS_SEMANTIC_REGISTRY_V1@1.0.0`.
- `SCOPE-070` — **current writer**, Issue #77, branch `agent/SCOPE-070-analytics-scopes`; IN_PROGRESS до Main Verification.

SCOPE-070 machine contract: `lib/analytics/analytics_scope.v1.json` (`PRH_ANALYTICS_SCOPE_V1@1.0.0`). Core: `lib/analytics/analytics_scope.js`. Human contract: `docs/analytics/ANALYTICS_SCOPES.md`. Test: `tests/analytics_scope_contract_test.js`. Named gate: `Analytics scopes`.

Rules SCOPE-070:

- canonical user `tags[]` остаётся свободным пространством и не является system-scope authority;
- protected system tags `EXCLUDE_FROM_ANALYSIS` и `EMERGENCY_FUND` назначаются отдельным private `PRH_ANALYTICS_SCOPE_ASSIGNMENTS_V1` overlay;
- transaction assignment использует exact stable `transaction_id`; account assignment применяется, когда account участвует как source или destination;
- `ALL_CANONICAL` не фильтрует данные и обязан давать ANL-010 parity с прямым `evaluateAnalytics()`;
- `DEFAULT_ANALYSIS` исключает protected `EXCLUDE_FROM_ANALYSIS`;
- `EMERGENCY_FUND_ONLY` включает protected `EMERGENCY_FUND` и одновременно соблюдает exclusion; при конфликте deny wins;
- user tag с текстом system-tag ID не получает protected semantics без отдельного assignment;
- custom scope spec может содержать только stable scope ID и known protected include/exclude tags; private account/transaction IDs и financial payload в serialized spec запрещены;
- unknown/duplicate/overlapping system tags, unknown assignment target и duplicate target fail closed;
- scope application создаёт новый filtered analytic view и не изменяет canonical transaction, provenance или user tags;
- ANL-010 остаётся execution contract, ANL-070 остаётся semantic registry authority, `FIN-TRUTH-v1` не переопределяется;
- SCOPE-070 имеет `financial_write=false`, canonical mutation=false, runtime/network/storage authority=false; public evidence synthetic only; `FREE_ONLY` mandatory.

ANL-071/072/073/074 не считаются реализованными SCOPE-070.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. `semantic_analytics_registry_contract_test.js` и `analytics_scope_contract_test.js` относятся к `PURE_DOMAIN_APPLICATION`; named gates `Semantic analytics registry` и `Analytics scopes` выполняются до migration/full/UI regression.

## AI model/cost routing boundary

`SOL`, `TERRA`, `LUNA` — internal workload lanes, а не guaranteed vendor entitlements. Required `MACHINE_GATE` выполняется через `LOCAL_DETERMINISTIC`; `OPENAI_API` — separately billed surface, `enabled=false`, automatic billing/API fallback запрещён. Red machine gate не обходится.

## MIG-010 historical verified boundary

Owner-private migration remains DONE/OWNER_VERIFIED with `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed occurrence identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Authorized execution was governed by `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion until post-write reconciliation PASS.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` is exact-bound and non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations. Generic Google financial write remains blocked by `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`. Current write authority = false. The owner-verified MIG-010 private full-history reconciliation remains complete.

## Current delivery

```text
PR Validation
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification
```

SCOPE-070 remains open until scope + semantic/LANG-RU/docs/privacy/FREE_ONLY/full layered evidence are green, trusted exact-head deploy/runtime health passes and Main Verification closes Issue #77.

## Read-only multi-AI review

Required roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority=false`; review never overrides red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data and real scope assignments stay private. Family Web App remains private `MYSELF`. SCOPE-070 is a pure view/policy layer with `financial_write=false`, `runtime=false`, `network=false`, `storage=false`. `FREE_ONLY` remains mandatory.

## Scope handoff

All R1 items, R2 P1 baseline, YC-040, AUTH-040, DOC-002, AIENG-006 and ANL-070 are DONE. YC-041/YC-042 are BLOCKED without writer authority. `MASTER-G3 = complete`. `SCOPE-070` is the single active writer.
