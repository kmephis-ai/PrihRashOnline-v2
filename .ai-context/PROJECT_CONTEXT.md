# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys, private scope assignments и owner-private payload запрещены.

## LANG-RU

Русский язык — единственный нормативный язык human-facing документации, GitHub metadata и AI instructions. Machine identifiers, API/schema fields, library/protocol/standard names и команды сохраняются без искусственного перевода. Параллельный English source of truth запрещён.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — Executable GitHub Roadmap v2.3.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Versioned contracts + architecture/ADR/operations docs.

## Current R0 truth

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`, `AIENG-006 = DONE`, `DOC-001 = DONE`, `DOC-002 = DONE`, `FINOPS-001 = DONE`.

`DOC-002` Issue #75 — DONE/Main Verification PASS, merge `8495dc730166f4e5fb7a03b5a7ab780501f6bbf5`; `PRH_LANGUAGE_POLICY_V1@1.0.0` остаётся mandatory. `AIENG-006` Issue #146 — DONE/Main Verification PASS, merge `0f7722c48dfc05b12efd861ecaa5d0b1f408c98a`; required machine gates остаются `LOCAL_DETERMINISTIC`, separately billed API default disabled.

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

Google remains authoritative. Blocked cloud items не создают live cloud resources/billing-backed infrastructure и не меняют write ownership.

## Current R7 truth

- `ANL-070` — **DONE**, Issue #150 Main Verification PASS, merge `d8b429221aa02416c4103bf58c2f3439f79ad0a9`; authority `PRH_ANALYTICS_SEMANTIC_REGISTRY_V1@1.0.0`.
- `SCOPE-070` — **DONE**, Issue #77 Main Verification PASS, merge `5eee6095562172ff0c887585aeaa85af4c12dff1`; authority `PRH_ANALYTICS_SCOPE_V1@1.0.0`.
- `ANL-071` — **DONE**, Issue #153 Main Verification PASS, merge `136fa66ea5752c96b789e92911d75ce37226b62f`; authority `PRH_ANALYTICS_PERIOD_ENGINE_V1@1.0.0`.
- `ANL-074` — **current writer**, Issue #155, branch `agent/ANL-074-exploration-state`; IN_PROGRESS до Main Verification.

ANL-074 machine contract: `lib/analytics/exploration_state.v1.json` (`PRH_EXPLORATION_STATE_V1@1.0.0`). Core: `lib/analytics/exploration_state.js`. Human contract: `docs/analytics/EXPLORATION_STATE.md`. Test: `tests/exploration_state_contract_test.js`. Named gate: `Exploration state model`.

Rules ANL-074:

- reuses VIZ-020 `PRH_FILTER_CONTEXT_V1@1.0.0` and `PRH_DRILL_CONTEXT_V1@1.0.0`; второй filter DSL не создаётся;
- global context = normalized FilterContext + validated SCOPE-070 ScopeSpec;
- widget context = FilterContext + `INHERIT_GLOBAL` либо explicit `OVERRIDE`; implicit scope merge=false;
- INCLUDE одного field пересекаются, EXCLUDE объединяются; exclusion применяется после include; empty effective INCLUDE = `EXPLORATION_FILTER_CONTRADICTION`;
- filter/widget ordering не влияет на `SHA256_CANONICAL_JSON_V1` state identity;
- effective drill filters = global + source-widget + drill filters, затем повторная VIZ validation;
- session actions: set global/widget, remove widget, set/clear drill, RESET, BACK; max history=32; no-op не добавляет history;
- RESET возвращает canonical default; BACK восстанавливает exact previous canonical state/hash;
- URL-state private-app only: canonical JSON UTF-8 → base64url с prefix `prh1.`, byte/char limits и canonical re-encode verification; history не сериализуется;
- URL state не public-shareable, потому что filter IDs/values могут быть private configuration;
- datasets/rows/transactions/results/measures/amount KPI fields и `scope_assignments` в state/actions запрещены;
- telemetry содержит только schema/version/action/decision/reason/state_hash/history_depth/widget_count/global_scope_id/drill_active — без filter values;
- ANL-074 не исполняет AnalyticsQuery и не реализует DASH-082/083/084;
- `financial_write=false`, canonical mutation=false, query execution=false, runtime/network/storage authority=false; `FREE_ONLY` mandatory.

ANL-072/BENCH-070/ANL-073 и downstream dashboard composition items не считаются реализованными ANL-074.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. `semantic_analytics_registry_contract_test.js`, `analytics_scope_contract_test.js`, `period_comparison_engine_contract_test.js`, `exploration_state_contract_test.js` относятся к `PURE_DOMAIN_APPLICATION`; named analytics gates выполняются до migration/full/UI regression.

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

ANL-074 remains open until exploration-state + period/scope/semantic/LANG-RU/docs/privacy/FREE_ONLY/full layered evidence are green, trusted exact-head deploy/runtime health passes and Main Verification closes Issue #155.

## Read-only multi-AI review

Required roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority=false`; review never overrides red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data stays private. Private scope assignments and real filter values are not public evidence. Family Web App remains private `MYSELF`. ANL-074 is a pure configuration/state layer with `financial_write=false`, `runtime=false`, `network=false`, `storage=false`. `FREE_ONLY` remains mandatory.

## Scope handoff

All R1 items, R2 P1 baseline, YC-040, AUTH-040, DOC-002, AIENG-006, ANL-070, SCOPE-070 and ANL-071 are DONE. YC-041/YC-042 are BLOCKED without writer authority. `MASTER-G3 = complete`. `ANL-074` is the single active writer.
