# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys и owner-private payload запрещены.

## LANG-RU

Русский язык — единственный нормативный язык human-facing документации, GitHub metadata и AI instructions. Machine identifiers, API/schema fields, library/protocol/standard names, команды и технические пути сохраняются без перевода. Параллельный English source of truth запрещён.

Для AI-агента это означает: причины решений, ограничения, критерии приёмки и эксплуатационные инструкции должны быть понятны русскоязычному владельцу. Английские технические термины допустимы как устойчивые machine/library/standard identifiers, но не заменяют русский смысловой текст.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — Executable GitHub Roadmap v2.3.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Versioned contracts + architecture/ADR/operations docs.

## Current R0 truth

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`, `AIENG-006 = DONE`, `DOC-001 = DONE`, `DOC-002 = DONE`, `FINOPS-001 = DONE`.

`DOC-002` Issue #75 — DONE/Main Verification PASS, merge `8495dc730166f4e5fb7a03b5a7ab780501f6bbf5`; `PRH_LANGUAGE_POLICY_V1@1.0.0` остаётся обязательным governance contract.

`AIENG-006` Issue #146 — DONE/Main Verification PASS, merge `0f7722c48dfc05b12efd861ecaa5d0b1f408c98a`; `PRH_AI_MODEL_COST_ROUTING_V1@1.0.0` сохраняет required machine gates на `LOCAL_DETERMINISTIC`, separately billed API default disabled.

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

YC-040 remains offline YDB evidence only: `ydb_canonical_write_ownership=false`, real replication=false, billing enablement=false. AUTH-040 remains provider-neutral reference policy: current Apps Script access `MYSELF`, `backend_financial_write_granted=false`. Blocked cloud items не создают live cloud resources и не меняют Google authoritative ownership.

## Current R7 truth

`ANL-070` — **current writer**, Issue #150, branch `agent/ANL-070-semantic-registry`; IN_PROGRESS до Main Verification.

Machine contract: `lib/analytics/semantic_registry.v1.json` (`PRH_ANALYTICS_SEMANTIC_REGISTRY_V1@1.0.0`). Core: `lib/analytics/semantic_registry.js`. Human contract: `docs/analytics/SEMANTIC_REGISTRY.md`. Test: `tests/semantic_analytics_registry_contract_test.js`. Named gate: `Semantic analytics registry`.

Rules:

- registry measure set обязан совпадать с `PRH_ANALYTICS_CONTRACT_V1` и `PRH_KPI_DICTIONARY_V1`;
- `FIN-TRUTH-v1` и KPI formulas не переопределяются;
- existing `AnalyticsQuery/AnalyticsResult` остаются execution contract;
- groupable query dimensions: `account_id`, `category_id`, `member_id`, `project_id`, `type`;
- `status` и `tag` остаются filter-only, `time_bucket` выводится из `occurred_at` через grain;
- time hierarchy имеет ordered levels `YEAR -> MONTH -> DAY` и только соседние drill-down transitions;
- искусственные category/account hierarchy без canonical parent relationship запрещены;
- `BUDGET_VARIANCE` остаётся `UNGROUPED_ONLY`, aggregation `SCALAR_KPI`, требует `budget_minor` в ANL-010 и не получает неявного распределения;
- unknown/duplicate/unsupported semantic combinations возвращают bounded `DENY`;
- ANL-071/072/073/074 не считаются реализованными;
- registry renderer/storage/network/IO/UI neutral и имеет `financial_write=false`;
- public evidence synthetic/public-safe only; `FREE_ONLY` mandatory.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. `semantic_analytics_registry_contract_test.js` = `PURE_DOMAIN_APPLICATION`; named `Semantic analytics registry` gate сверяет registry с ANL-010, KPI Dictionary и canonical schema до downstream migration/UI regression.

## AI model/cost routing boundary

`SOL`, `TERRA`, `LUNA` — internal workload lanes, а не guaranteed vendor entitlements. Required `MACHINE_GATE` выполняется через `LOCAL_DETERMINISTIC`; `OPENAI_API` — separately billed surface, `enabled=false`, automatic billing/API fallback запрещён. Exhaustion optional AI work может deferred, required AI-assisted work может pause, но red machine gate не обходится.

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

ANL-070 remains open until semantic registry + Language policy/docs/privacy/FREE_ONLY/full layered evidence are green, trusted exact-head deploy/runtime health passes and Main Verification closes Issue #150.

## Read-only multi-AI review

Required roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority=false`; review never overrides red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data stays private. Family Web App remains private `MYSELF`. ANL-070 uses semantic metadata only and has `financial_write=false`, `runtime=false`, `network=false`, `storage=false`. `FREE_ONLY` remains mandatory.

## Scope handoff

All R1 items, R2 P1 baseline, YC-040, AUTH-040, DOC-002 and AIENG-006 are DONE. YC-041/YC-042 are BLOCKED without writer authority. `MASTER-G3 = complete`. `ANL-070` is the single active writer.
