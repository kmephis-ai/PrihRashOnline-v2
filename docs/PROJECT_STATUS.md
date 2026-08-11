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

Canonical private Web App default route = R2 `FinancialHomeWebApp`; legacy Dashboard остаётся bounded rollback route. Private Home использует generated canonical-lib runtime; `PRH_RUNTIME_DIMENSION_LABEL_HASH_V1` — только transient read-only adapter identity (`persistent_identity_authority=false`), `financial_formula_copy=false`. Authenticated private Home smoke V3 и exact-head Trusted Runtime Health = PASS. Web App остаётся `MYSELF`; `NOT_PROVEN_CURRENT_HOST` PWA boundary сохраняется; `FREE_ONLY` обязателен.

## R3 / Planning, Wealth, Decision Intelligence — завершённые элементы

- `TREND-030` — **DONE**, Issue #164 Main Verification PASS, merge `fe1660fa063fbc5e3344c9e570188fed9262b2ce`.
- `PROJ-030` — **DONE**, Issue #166 Main Verification PASS, merge `cb3bbc4d50c35e690fda76eda54b19d1b97fc0a9`.
- `GOAL-030` — **DONE**, Issue #168 Main Verification PASS, merge `fd7289d10d34df79b35c49c6749f36c6916d3bdc`.
- `BAL-030` — **DONE**, Issue #76 Main Verification PASS, merge `3caab7017de035d14c36d07f3712f7c019828e2f`.
- `NW-030` — **DONE**, Issue #171 Main Verification PASS, merge `3e56dce6bea4d874930c27e579a7ee082a2abc5c`.
- `SUB-030` — **DONE**, Issue #179 Main Verification PASS, candidate `2c3a0a39aa835cec2a5fa0a93d0a275b7bf008fd`, merge `2914f150a9b038af50f7ccbfd9ed3d4f684dad47`.

SUB-030 authority = `PRH_SUBSCRIPTION_DETECTION_V1@1.0.0`. Detector precision-first, только `posted expense`, exact normalized signature, minimum 3 occurrence, versioned cadence tolerances и integer-minor stability. `auto_confirm=false`, `auto_create_obligation=false`, `canonical_mutation=false`, `financial_write=false`, candidate не FIN-TRUTH. Fuzzy/LLM matching не authority. Public evidence synthetic-only; `FREE_ONLY` mandatory.

BAL authority remains `PRH_BALANCE_RECONCILIATION_V1@1.0.0`; no implicit zero balance. NW authority remains `PRH_NET_WORTH_V1@1.0.0`; no silent FX/market valuation and `financial_truth=false` for valuation layer.

## R4 / Yandex Cloud shadow platform

- `YC-040` — **DONE**, Issue #141 Main Verification PASS, merge `924a44f4cb01e6add6c7fd9a0b166d7a7743b96a`.
- `AUTH-040` — **DONE**, Issue #142 Main Verification PASS, merge `455c7fdaaaee118369294d96183631d7322e5ea2`.
- `YC-041` — **BLOCKED**, Issue #148, `OWNER_CLOUD_BOOTSTRAP_REQUIRED`; writer authority отсутствует.
- `YC-042` — **BLOCKED**, Issue #149, `OWNER_YDB_TARGET_REQUIRED`; writer authority отсутствует.

Google остаётся authoritative; cloud blockers не создают billing-backed resources и не меняют canonical write ownership.

## R7 / Semantic Analytics — exit gate завершён, текущий writer VIZ-070

- `ANL-070` — **DONE**, Issue #150 Main Verification PASS.
- `SCOPE-070` — **DONE**, Issue #77 Main Verification PASS.
- `ANL-071` — **DONE**, Issue #153 Main Verification PASS.
- `ANL-072` — **DONE**, Issue #178 Main Verification PASS, merge `19866dfe6856d42dca89e8469c3520e7c2f3c437`.
- `BENCH-070` — **DONE**, Issue #80 Main Verification PASS, candidate `4da05a25669b87cc7711bde5d8502c457af71f09`, merge `e49d07fa79bd1f0c825b4b1c807ddd8bb49d6a8f`.
- `ANL-074` — **DONE**, Issue #155 Main Verification PASS.
- `ANL-073` — **DONE**, Issue #186 Main Verification PASS, merge `116b950cf4ae66b813dff3cf7c8803afeb6baea6`.
- `PERF-070` — **DONE**, Issue #188 Main Verification PASS, candidate `7742f56746dcbc5b782e0320acb82478a5f13775`, merge `0c3b09e5221b55854fb3c007e66c815ebdedc584`.
- `TEST-070` — **DONE**, Issue #190 Main Verification PASS, candidate `dee4b1cb87158a78014fd07c723b595c516c2114`, merge `b4391e6ce24927baf0ec18e1892d8f2244615951`.
- `MASTER-G7 / Semantic analytics` — **complete**.
- `VIZ-070` — **IN_PROGRESS**, Issue #192, branch `agent/VIZ-070-visualization-registry-v2`.

VIZ-070 вводит `PRH_VISUALIZATION_REGISTRY_V2@2.0.0` как configuration-only presentation registry поверх VIZ-020 и ANL-074. Version 2 поддерживает только канонические `BAR`, `LINE`, `DONUT`; advanced chart pack остаётся отдельным VIZ-090.

Registry валидирует semantic bindings против normalized AnalyticsQuery: encoded dimensions должны точно покрывать effective query dimensions, measure bindings должны присутствовать в query. Registry не имеет права добавлять/удалять measures, dimensions, filters, period, comparison, scope или sort. Каждый plan/retype сохраняет exact canonical query hash, `query_modified=false`, provenance `FIN-TRUTH-v1`.

Safe retype `BAR <-> LINE` сохраняет x/y/series. `BAR|LINE -> DONUT` разрешён только без series через однозначное `x->category`, `y->value`; hidden dimension loss завершается `VIZ070_RETYPE_SERIES_AMBIGUOUS`. DONUT -> BAR/LINE использует обратное mapping.

Renderer registry сохраняет `ECHARTS_6` primary/local-or-bundled/replaceable и добавляет `SEMANTIC_TABLE_V1` как встроенный accessible fallback. Renderer не получает query/financial truth/storage/network authority. Responsive plan детерминирован для MOBILE/TABLET/DESKTOP; semantic table + text summary обязательны, interaction-only evidence запрещён.

Public VIZ-070 telemetry содержит только schema/version/chart/renderer/responsive/a11y/query-hash-prefix/decision/reason; financial values, raw query/filter payload и private dimension values запрещены. Named gate `Visualization registry v2`; TEST-010 class `PURE_DOMAIN_APPLICATION`; `FREE_ONLY` mandatory.

Trusted runtime reliability bootstrap #185 merged in `7794f1d73631cc50ac1d603758ddec85acdec6b5`: retry возможен только для exact `RUNTIME_HEALTH_BUILD_MISMATCH`, максимум 12 attempts / 55 s sleep; stale build не считается healthy, остальные failures fail-fast.

После VIZ-070 Main Verification registry становится presentation dependency для R8 `DASH-080` и будущего `VIZ-090`; сам VIZ-070 не реализует Studio/Dashboard composer или advanced chart families.

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

VIZ-070 остаётся открытым до `Visualization registry v2` + existing VIZ/ANL/TEST/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA PASS, immutable exact candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Current runtime truth

Private primary store/runtime: Google Sheets + Apps Script. VIZ-070 — renderer-neutral configuration/presentation layer; он не меняет current R2 routing, production financial calculations, financial writes или external providers. ECharts остаётся replaceable local/bundled adapter; public GitHub evidence synthetic/configuration-only. Private UI remains `MYSELF`; `FREE_ONLY` mandatory.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.3 + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.
