# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. Human documentation не может отменять красный machine gate.

Machine release model: `EXACT_SHA_AUTONOMOUS`; trusted delivery authority закреплена `CI-003`.

## R0 — critical path завершён

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — **complete**. `DOC-001`, `DOC-002`, `AIENG-001`, `AIENG-002`, `AIENG-003`, `AIENG-004`, `AIENG-006`, `DR-001`, `OBS-001`, `FINOPS-001` — DONE/Main Verification PASS.

- `AIENG-004` — **DONE**, Issue #157 Main Verification PASS, merge `280dea294b086fae3cedf56df7899c9938b42b88`.
- `AIENG-006` — **DONE**, Issue #146 Main Verification PASS, merge `0f7722c48dfc05b12efd861ecaa5d0b1f408c98a`.

`LANG-RU` обязателен. `PRH_AI_PLAYBOOK_CATALOG_V1@1.0.0` не создаёт authority; PR/Migration review остаются READ_ONLY.

## R1 / Canonical Financial Platform — завершена

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; owner-private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS; `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`.
- `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010` — **DONE**.
- `AIENG-005` — **DONE**, Issue #159 Main Verification PASS, merge `5fe90929f5f266fcd92bbc9745f78107083f6b5c`.

`MASTER-G3 / Canonical platform` — **complete**; historical pre-close state: open. FIN authority: `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority: `PRH_CANONICAL_TRANSACTION_V1`. Repository authority: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Post-R1 handoff начинается с `DESIGN-020`; этот historical lifecycle anchor сохраняется даже после полного завершения R2.

## R2 / Family Finance Center — canonical UI cutover завершён

`DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020`, `EXP-020`, `INC-020`, `CF-020`, `BUD-020`, `OBL-020`, `DQ-020`, `PWA-020`, `PROF-020`, `UI-MIG-020` — DONE/Main Verification PASS.

- `UI-MIG-020` — **DONE**, Issue #172 Main Verification PASS, candidate `867fda74824f91bf3931aa3e6ea39d1c7d4dfc1e`, merge `0a87bab34f29897fa781a030797a9a040fb200a3`.

Canonical private Web App default route теперь R2 `FinancialHomeWebApp`; legacy Dashboard остаётся bounded rollback route. Private Home использует generated canonical-lib runtime, `PRH_RUNTIME_DIMENSION_LABEL_HASH_V1` только как read-only transient adapter identity (`persistent_identity_authority=false`), `financial_formula_copy=false`. Authenticated private Home smoke V3 и exact-head Trusted Runtime Health = PASS. Private Web App остаётся `MYSELF`; `NOT_PROVEN_CURRENT_HOST` PWA boundary сохраняется; `FREE_ONLY` обязателен.

## R3 / Planning, Wealth, Decision Intelligence — завершённые элементы

- `TREND-030` — **DONE**, Issue #164 Main Verification PASS, merge `fe1660fa063fbc5e3344c9e570188fed9262b2ce`.
- `PROJ-030` — **DONE**, Issue #166 Main Verification PASS, merge `cb3bbc4d50c35e690fda76eda54b19d1b97fc0a9`.
- `GOAL-030` — **DONE**, Issue #168 Main Verification PASS, merge `fd7289d10d34df79b35c49c6749f36c6916d3bdc`.
- `BAL-030` — **DONE**, Issue #76 Main Verification PASS, merge `3caab7017de035d14c36d07f3712f7c019828e2f`.
- `NW-030` — **DONE**, Issue #171 Main Verification PASS, merge `3e56dce6bea4d874930c27e579a7ee082a2abc5c`.
- `SUB-030` — **DONE**, Issue #179 Main Verification PASS, candidate `2c3a0a39aa835cec2a5fa0a93d0a275b7bf008fd`, merge `2914f150a9b038af50f7ccbfd9ed3d4f684dad47`.

SUB-030 authority = `PRH_SUBSCRIPTION_DETECTION_V1@1.0.0`. Detector анализирует только `posted expense`, использует exact normalized signature (`label + currency + account + category`), minimum 3 occurrence, versioned WEEKLY/MONTHLY cadence tolerances и integer-minor amount stability. Stable evidence создаёт только `CANDIDATE`; неоднозначность остаётся `REVIEW`. `auto_confirm=false`, `auto_create_obligation=false`, `canonical_mutation=false`, `financial_write=false`, candidate не является FIN-TRUTH.

Сопоставление с OBL-020 разрешено только через явный `signature_hash -> plan_id` link с exact direction/currency/cadence/reference-amount checks; fuzzy plan-label matching запрещён. Public telemetry не содержит raw labels, transaction/dimension IDs или financial values. Public evidence synthetic-only; `FREE_ONLY` mandatory.

BAL authority remains `PRH_BALANCE_RECONCILIATION_V1@1.0.0`; no implicit zero balance. NW authority remains `PRH_NET_WORTH_V1@1.0.0`; no silent FX/market valuation and `financial_truth=false` for valuation layer.

## R4 / Yandex Cloud shadow platform

- `YC-040` — **DONE**, Issue #141 Main Verification PASS, merge `924a44f4cb01e6add6c7fd9a0b166d7a7743b96a`.
- `AUTH-040` — **DONE**, Issue #142 Main Verification PASS, merge `455c7fdaaaee118369294d96183631d7322e5ea2`.
- `YC-041` — **BLOCKED**, Issue #148, `OWNER_CLOUD_BOOTSTRAP_REQUIRED`; writer authority отсутствует.
- `YC-042` — **BLOCKED**, Issue #149, `OWNER_YDB_TARGET_REQUIRED`; writer authority отсутствует.

Google остаётся authoritative; cloud blockers не создают billing-backed resources и не меняют canonical write ownership.

## R7 / Semantic Analytics — текущий writer

- `ANL-070` — **DONE**, Issue #150 Main Verification PASS.
- `SCOPE-070` — **DONE**, Issue #77 Main Verification PASS.
- `ANL-071` — **DONE**, Issue #153 Main Verification PASS.
- `ANL-074` — **DONE**, Issue #155 Main Verification PASS.
- `ANL-072` — **DONE**, Issue #178 Main Verification PASS, candidate `0cc1260edb0a264d662a813abc04c1236bb44655`, merge `19866dfe6856d42dca89e8469c3520e7c2f3c437`.
- `BENCH-070` — **IN_PROGRESS**, Issue #80, branch `agent/BENCH-070-personal-comparison-engine`.

BENCH-070 вводит `PRH_PERSONAL_BENCHMARK_V1@1.0.0` как pure comparison layer поверх `PRH_ANALYTICS_PERIOD_ENGINE_V1`, `PRH_ANALYTICS_CALCULATED_METRICS_V1` и `PRH_ANALYTICS_SCOPE_V1`. Allowlist comparison types: `PREVIOUS_COMPARABLE_PERIOD`, `PERSONAL_ROLLING_BASELINE`, `BUDGET`, `TARGET`, `MANUAL_INDEX`.

Previous/comparable period не пересчитывает календарные правила: BENCH сохраняет period quality ANL-071 и использует ANL-072 `DELTA_ABS`/`DELTA_PCT`. Rolling baseline исключает текущий bucket из history и использует ANL-072 `MOVING_AVERAGE`; окно bounded 2..24, а недостаточная история различается через `REQUIRE_FULL` и `ALLOW_PARTIAL`.

Budget/target/manual index являются declared references и не становятся FIN-TRUTH. Reference обязан иметь тот же period, currency и normalized scope. Mismatch, invalid provenance, non-additive measure, zero/invalid manual index и unknown comparison type завершаются fail-closed. Manual index использует bounded positive integer PPM; zero reference сохраняет explicit `ZERO_REFERENCE_NO_CHANGE` / `ZERO_REFERENCE_UNDEFINED`, без NaN/Infinity.

BENCH-070 работает со scalar additive semantic measures до отдельного `ANL-073` Pivot/OLAP. Он не реализует OLAP скрыто и не создаёт dashboard-specific formula engine. `financial_truth=false`, `financial_write=false`, `io=false`, `network=false`, `storage=false`, `renderer=false`, `ui=false`, `external_market_data=false`. Required core не использует внешний market-data provider, API key или paid SKU; `FREE_ONLY` mandatory.

Public tests independently generated synthetic-only. Public telemetry содержит только schema/version/comparison/measure/scope/period/sample/quality/reason metadata и не содержит financial values/private IDs. Named gate: `Personal benchmark comparisons`; TEST-010 class = `PURE_DOMAIN_APPLICATION`.

## MIG-010 historical safety boundary

MIG-010 owner-private evidence remains `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Historical machine anchors: **Current write authority = false**. The **owner-verified MIG-010 private full-history reconciliation** remains completed correctness proof.

Execution policy remains `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion until post-write reconciliation PASS.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound/non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations. Any future irreversible financial write requires fresh exact-bound owner authorization.

## Executable AI engineering baseline

Root `AGENTS.md` is the public-safe repository AI operating contract. `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` enforce one-writer continuation. Read-only multi-AI reviewers have `writer_authority=false`; machine gates and Main Verification remain authoritative.

## Current delivery chain

```text
active Roadmap Issue
-> agent/<ID>-<slug> PR to main
-> PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification -> Issue DONE
```

BENCH-070 остаётся открытым до `Personal benchmark comparisons` + existing FIN/DATA/ANL/SCOPE/SUB/privacy/FREE_ONLY/full layered/UI/PWA PASS, immutable exact candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Current runtime truth

Private primary store/runtime: Google Sheets + Apps Script. BENCH-070 — pure analytics comparison layer; он не подключает новый сервис, не меняет current R2 routing, не создаёт financial write и не требует paid provider. Public GitHub evidence independently generated synthetic only. Private UI remains `MYSELF`; `FREE_ONLY` mandatory.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.3 + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.
