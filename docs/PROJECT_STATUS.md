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

`PRH_AI_EVAL_SUITE_V1@1.0.0` остаётся local deterministic regression gate: synthetic golden tasks, no required external model/network/paid API, `eval_grants_authority=false`, `FREE_ONLY`.

## R2 / Family Finance Center — canonical R2 cutover завершён

`DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020`, `EXP-020`, `INC-020`, `CF-020`, `BUD-020`, `OBL-020`, `DQ-020`, `PWA-020`, `PROF-020`, `UI-MIG-020` — DONE/Main Verification PASS.

- `PROF-020` — **DONE**, Issue #162 Main Verification PASS, merge `c925deb4298c1046ec7ab06def3f559623d6b29f`.
- `UI-MIG-020` — **DONE**, Issue #172 Main Verification PASS, candidate `867fda74824f91bf3931aa3e6ea39d1c7d4dfc1e`, merge `0a87bab34f29897fa781a030797a9a040fb200a3`.

`UI-MIG-020` authority = `PRH_CANONICAL_R2_WEB_APP_V1@1.0.0`. Default private Web App route теперь R2 `FinancialHomeWebApp`; primary navigation содержит Home / Transactions / Expenses / Income / Cash Flow / Budget / Obligations / Data Quality. Legacy Dashboard больше не default и остаётся bounded rollback route `?surface=legacy`.

Financial Home private binding использует тонкий `PRH_R2_FIN_RUNTIME_BRIDGE_V1`, а не второй финансовый калькулятор. Immutable candidate детерминированно генерирует `R2CanonicalRuntimeBundle.js` (`PRH_R2_CANONICAL_RUNTIME_BUNDLE_V1`) непосредственно из canonical versioned `lib/**`: Google repository adapter, FIN reconciliation, KPI Dictionary, Financial Home и локальные contracts/dependencies. Generated bundle входит в `sourceTreeHash`/trusted reconstruction; `generated_from_canonical_lib=true`, `financial_formula_copy=false`.

Bridge читает `01 Операции` только через существующий read-only Google gateway, берёт explicit currency из `09 Настройки` и вызывает canonical `financial_home.buildFinancialHome()`. Human-readable dimension labels преобразуются в deterministic private hash IDs на bridge boundary и сохраняются как private display labels; canonical ID schema не ослабляется. `legacy_total_cells_used=false`, `ui_financial_formula_authority=false`, `financial_write=false`.

Остальные семь R2 destinations используют `SAFE_UNBOUND_FAIL_CLOSED`: canonical navigation доступна, но private runtime не подставляет browser `SYN-*` fixture как household truth, пока binding не доказан отдельным machine gate.

Authenticated technical smoke = `PRH_WEBAPP_SMOKE_V3|R2|OK`; отдельный authenticated private Home read smoke = `PRH_R2_HOME_READ_V3|CANONICAL_LIB|DIMENSION_HASH|OK|7`. Private Web App остаётся `MYSELF`. `FREE_ONLY` обязателен.

PWA boundary сохраняется: current Apps Script HtmlService service-worker activation = `NOT_PROVEN_CURRENT_HOST`; private financial/authenticated responses не кэшируются.

## R3 / Planning, Wealth, Decision Intelligence

- `TREND-030` — **DONE**, Issue #164 Main Verification PASS, merge `fe1660fa063fbc5e3344c9e570188fed9262b2ce`.
- `PROJ-030` — **DONE**, Issue #166 Main Verification PASS, merge `cb3bbc4d50c35e690fda76eda54b19d1b97fc0a9`.
- `GOAL-030` — **DONE**, Issue #168 Main Verification PASS, merge `fd7289d10d34df79b35c49c6749f36c6916d3bdc`.
- `BAL-030` — **DONE**, Issue #76 Main Verification PASS, merge `3caab7017de035d14c36d07f3712f7c019828e2f`.
- `NW-030` — **DONE**, Issue #171 Main Verification PASS, candidate `a2eefe5e9cb8d896e9f607486008901b40e50594`, merge `3e56dce6bea4d874930c27e579a7ee082a2abc5c`.

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
- `ANL-072` — **IN_PROGRESS**, Issue #178, branch `agent/ANL-072-safe-calculated-metrics`.

ANL-072 вводит `PRH_ANALYTICS_CALCULATED_METRICS_V1@1.0.0` как pure transformation layer над canonical `AnalyticsResult` и period result. Разрешены только `SHARE`, `DELTA_ABS`, `DELTA_PCT`, `CUMULATIVE`, `MOVING_AVERAGE`, `MOVING_MEDIAN`, `TOP_N_OTHER`; arbitrary executable formulas, `eval` и SQL expressions запрещены. Ratio использует integer PPM (`1 000 000 = 100%`), money остаётся integer minor units, а промежуточные risk-of-overflow операции используют exact integer arithmetic.

ANL-072 не переопределяет KPI/FIN-TRUTH и не получает financial/storage/network/write/UI authority. Share и Top-N обязаны reconcile к исходному canonical total; percent delta имеет явные zero-reference states; moving windows имеют bounded size и explicit partial-window policy. Public tests synthetic-only, telemetry не содержит financial payload/private dimension values. После ANL-072 dependency-ready становятся `BENCH-070` и `ANL-073`; `PERF-070` остаётся зависим от ANL-073.

## MIG-010 historical safety boundary

MIG-010 owner-private evidence remains `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Historical machine anchors: **Current write authority = false**. The **owner-verified MIG-010 private full-history reconciliation** remains completed correctness proof.

Execution policy remains `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion until post-write reconciliation PASS.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound/non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations. Any future irreversible financial write requires fresh exact-bound owner authorization.

## Executable AI engineering baseline

Root `AGENTS.md` is public-safe AI operating contract. `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` enforce one-writer continuation. Read-only multi-AI reviewers have `writer_authority=false`; machine gates and Main Verification remain authoritative.

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

ANL-072 остаётся открытым до `Calculated/window metrics` + existing FIN/DATA/ANL/SCOPE/TREND/privacy/FREE_ONLY/full layered/UI/PWA gates PASS, immutable candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Current runtime truth

Private primary store/runtime: Google Sheets + Apps Script. ANL-072 не меняет private runtime, маршрутизацию или данные: текущий writer добавляет storage-neutral pure analytics transformations поверх уже типизированных canonical analytics results. Реальные financial/storage данные не мигрируют и не записываются. Public GitHub evidence independently generated synthetic only. Private UI remains `MYSELF`; `FREE_ONLY` mandatory.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.3 + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.
