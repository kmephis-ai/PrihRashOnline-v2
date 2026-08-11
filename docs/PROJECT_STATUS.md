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

## R7 / Semantic Analytics — завершена

- `ANL-070` — **DONE**, Issue #150 Main Verification PASS.
- `SCOPE-070` — **DONE**, Issue #77 Main Verification PASS.
- `ANL-071` — **DONE**, Issue #153 Main Verification PASS.
- `ANL-072` — **DONE**, Issue #178 Main Verification PASS, merge `19866dfe6856d42dca89e8469c3520e7c2f3c437`.
- `BENCH-070` — **DONE**, Issue #80 Main Verification PASS, merge `e49d07fa79bd1f0c825b4b1c807ddd8bb49d6a8f`.
- `ANL-074` — **DONE**, Issue #155 Main Verification PASS.
- `ANL-073` — **DONE**, Issue #186 Main Verification PASS, merge `116b950cf4ae66b813dff3cf7c8803afeb6baea6`.
- `PERF-070` — **DONE**, Issue #188 Main Verification PASS, candidate `7742f56746dcbc5b782e0320acb82478a5f13775`, merge `0c3b09e5221b55854fb3c007e66c815ebdedc584`.
- `TEST-070` — **DONE**, Issue #190 Main Verification PASS, candidate `dee4b1cb87158a78014fd07c723b595c516c2114`, merge `b4391e6ce24927baf0ec18e1892d8f2244615951`.
- `VIZ-070` — **DONE**, Issue #192 Main Verification PASS, candidate `444067f9e411f798668c4a109eb751903c9d5720`, merge `13091bb5ba731673bae5357ae7b22b64475592c3`.
- `MASTER-G7 / Semantic analytics` — **complete**.

VIZ-070 authority остаётся `PRH_VISUALIZATION_REGISTRY_V2@2.0.0`: BAR/LINE/DONUT, exact query-dimension coverage, query-hash invariant retype, ECHARTS_6 replaceable local/bundled renderer и `SEMANTIC_TABLE_V1` accessible fallback. Registry не получает query/financial/storage/network authority.

## R8 / Analytics Studio, privacy и dashboard composer

- `STUDIO-080` — **DONE**, Issue #194 Main Verification PASS, candidate `ce6ebb99b053adf0a8fd320d0ed579675c3286b6`, merge `432c2bc663e2fc5106bdc96031130673b7b76dce`.
- `PRIV-080` — **DONE**, canonical Issue #79 Main Verification PASS, candidate `37a668e38432b6d64646dc4369f90afb2537071a`, merge `0cf3ebfeaad4b78060d7cad6addb441230321877`.
- `DASH-080` — **IN_PROGRESS**, canonical Issue #198, branch `agent/DASH-080-responsive-grid-composer`; единственный current writer.

STUDIO-080 сохранил `DAILY -> EXPLORE -> STUDIO`, default Financial Home и opt-in `surface=studio`. Trusted runtime defect exact-string launcher check был исправлен regression `dashboard_studio_htmlservice_normalization_test.js`; Main Verification подтвердил canonical Apps Script route.

PRIV-080 ввёл `PRH_PRIVACY_PRESENTATION_V1@1.0.0`. Это presentation policy, а не security boundary: `security_boundary=false`, `authorization_boundary=false`. PROF-020/AUTH-040/MYSELF остаются источниками доступа.

`NORMAL` сохраняет уже авторизованный presentation view. `MASKED` до HTML serialization заменяет sensitive monetary/private-dimension leaves на `null`, а массивы presentation data — на `[]`; исходный canonical view не мутируется. CSS blur/opacity не считается privacy evidence.

`DEMO` использует только independently generated `PUBLIC_SYNTHETIC` view и не вызывает private Financial Home adapter; runtime gate требует `privateReads=0` и `private_runtime_read=false`. DEMO явно маркируется `DEMO_SYNTHETIC_NOT_FIN_TRUTH`.

`ZEN` читает canonical view только server-side внутри существующей authorization boundary, после чего отдельная safe page получает только allowlisted structural/status metadata. Amounts, transaction rows и private dimension labels в ZEN DOM отсутствуют; canonical R2 navigation сохраняется.

Studio имеет keyboard/a11y privacy selector `Normal / Masked / Demo / Zen`. Preference `prh.privacyPresentation.mode.v1` содержит только schema/version/mode; URL `privacy` переводит выбор в server-side pre-render path. Financial/query/filter/private identifier payload в preference запрещён.

DASH-080 реализует `PRH_DASHBOARD_COMPOSER_V1@1.0.0` как configuration-only слой Analytics Studio. Canonical desktop grid = 12 columns; tablet/mobile layouts выводятся детерминированно, а invalid/out-of-bounds/overlap layout repair выполняется canonical row-major policy. Placeholder widgets остаются `semantic_binding_status=UNBOUND`; AnalyticsQuery/ChartSpec/FIN-TRUTH authority не передаётся composer.

Composer поддерживает immutable ADD/MOVE/RESIZE/DUPLICATE/REMOVE/RESET и session-only состояние. `surface=composer` не читает private financial runtime и не использует financial/query/filter payload; saved dashboards остаются scope DASH-084. Browser/visual evidence покрывает 390x844, 768x1024 и 1440x900, keyboard/a11y controls и отсутствие horizontal overflow.

Named gates для current writer: `Dashboard composer` (`RUNTIME_INTEGRATION`) и `Dashboard composer visual gate` (`UI_E2E`). Existing PRIV-080/STUDIO-080/VIZ-070/R2/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA gates обязаны оставаться green.

Trusted runtime reliability bootstrap #185 merged in `7794f1d73631cc50ac1d603758ddec85acdec6b5`: retry возможен только для exact `RUNTIME_HEALTH_BUILD_MISMATCH`, максимум 12 attempts / 55 s sleep; stale build не считается healthy, остальные failures fail-fast.

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

DASH-080 остаётся открытым до green `Dashboard composer` + `Dashboard composer visual gate` + existing PRIV/STUDIO/R2/VIZ/ANL/TEST/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA gates, immutable exact candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Current runtime truth

Private primary store/runtime: Google Sheets + Apps Script. Canonical default Web App route остаётся R2 Financial Home. PRIV-080 уже применяет pre-render presentation transform и independently generated DEMO fixture. DASH-080 добавляет opt-in configuration-only `surface=composer` без private financial runtime read; placeholder widgets не являются финансовыми данными и остаются UNBOUND до DASH-081. Financial calculations, canonical data, write ownership и authentication не переходят в privacy/composer layers. Public GitHub evidence synthetic/configuration-only. Private UI remains `MYSELF`; `FREE_ONLY` mandatory.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.3 + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.
