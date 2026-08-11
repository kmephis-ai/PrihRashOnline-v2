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

## Текущая инженерная задача

`STUDIO-080` — единственный **current writer**, Issue #194, branch `agent/STUDIO-080-progressive-analytics-studio-shell`. `MASTER-G7 / Semantic analytics` и DESIGN-020 уже complete/DONE; VIZ-070 также DONE/Main Verification PASS и доступен как upstream presentation registry.

STUDIO-080 вводит `PRH_ANALYTICS_STUDIO_SHELL_V1@1.0.0` как progressive presentation shell `DAILY -> EXPLORE -> STUDIO`. Daily остаётся default и maps to canonical Financial Home. Explore/Studio — explicit opt-in уровни; invalid explicit mode всегда fail-safe в DAILY.

Shell не вычисляет KPI, не читает transactions, не исполняет AnalyticsQuery и не меняет FIN-TRUTH. Explore только объявляет готовые R7 capabilities. Studio дополнительно показывает future affordances DASH-080/DASH-081/DASH-084 со status `UPCOMING`; composer/widget/layout/saved views не реализуются внутри STUDIO-080.

Canonical router сохраняет default `surface=home`, legacy rollback и private exposure `MYSELF`. Новый `surface=studio` live/static/configuration-only: `financial_runtime=false`, payload placeholder отсутствует, `prhR2BuildFinancialHomeRuntime_()` не вызывается. Основной массив R2 navigation не меняется; отдельный launcher `Explore / Studio` является opt-in.

Browser preference `prh.analyticsStudio.mode.v1` содержит только schema/version/mode; URL `mode` имеет приоритет. Financial/query/filter/private identifier payload запрещён. Mode transition reversible и всегда `query_execution=false`, `financial_write=false`.

Keyboard/a11y: tablist/tab/tabpanel, aria-selected, focus-visible, ArrowLeft/ArrowRight/Home/End, reduced-motion. Responsive smoke: 390x844 / 768x1024 / 1440x900, без horizontal body overflow. Studio visual test рендерит canonical router с financial runtime stub, который падает при любом вызове, тем самым доказывая отсутствие private financial fetch.

Public telemetry содержит только schema/version/mode/previous_mode/source/viewport_class/decision/reason. `financial_truth=false`, `financial_write=false`, `query_execution=false`, `query_mutation=false`, `canonical_mutation=false`, `storage=false`, `network=false`, `deployment=false`; `FREE_ONLY` обязателен.

## Current R0 truth

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. Исполнимая AI-инженерная цепочка канонизирована: `AIENG-001 = DONE` -> `AIENG-002 = DONE` -> `AIENG-003 = DONE`; далее `AIENG-004`, `AIENG-005` и `AIENG-006` также DONE/Main Verification PASS. Этот handoff остаётся lifecycle anchor и не заменяется текущим writer.

Real or real-derived household finance data stays private. Public repository содержит только public-safe contracts, synthetic finance fixtures и privacy-safe machine evidence; private OAuth, runtime locators, реальные строки/агрегаты и owner-private payload не публикуются.

## Current R1 truth

`MASTER-G3` — complete.

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; private stage `OWNER_VERIFIED`.
- `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010`, `AIENG-005` — DONE/Main Verification PASS.

FIN authority = `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority = `PRH_CANONICAL_TRANSACTION_V1`; repository authority = `PRH_TRANSACTION_REPOSITORY_V1`. Generic Google canonical write остаётся fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`. `PRH_AI_EVAL_SUITE_V1@1.0.0` — local deterministic synthetic regression gate и не выдаёт authority.

Post-R1 handoff historically начинается с `DESIGN-020`; этот anchor обязан оставаться в lifecycle docs даже после завершения R2.

## Current R2 truth

`DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020`, `EXP-020`, `INC-020`, `CF-020`, `BUD-020`, `OBL-020`, `DQ-020`, `PWA-020`, `PROF-020`, `UI-MIG-020` — DONE/Main Verification PASS. `UI-MIG-020` Issue #172 завершён, candidate `867fda74824f91bf3931aa3e6ea39d1c7d4dfc1e`, merge `0a87bab34f29897fa781a030797a9a040fb200a3`.

Canonical private Web App default = R2 Financial Home. Generated exact-candidate runtime строится из canonical `lib/**`; `financial_formula_copy=false`. `PRH_RUNTIME_DIMENSION_LABEL_HASH_V1` остаётся transient read-only adapter identity без persistent authority. Authenticated private Home smoke V3 и Trusted Runtime Health PASS. Web App остаётся `MYSELF`; PWA boundary `NOT_PROVEN_CURRENT_HOST`; `FREE_ONLY` обязателен.

## Current R3 truth

- `TREND-030` — DONE, Issue #164 Main Verification PASS.
- `PROJ-030` — DONE, Issue #166 Main Verification PASS.
- `GOAL-030` — DONE, Issue #168 Main Verification PASS.
- `BAL-030` — DONE, Issue #76 Main Verification PASS.
- `NW-030` — DONE, Issue #171 Main Verification PASS.
- `SUB-030` — **DONE**, Issue #179 Main Verification PASS, candidate `2c3a0a39aa835cec2a5fa0a93d0a275b7bf008fd`, merge `2914f150a9b038af50f7ccbfd9ed3d4f684dad47`.

SUB-030 authority `PRH_SUBSCRIPTION_DETECTION_V1@1.0.0` сохраняется. Named gate `Subscription detection`, TEST-010 classification, LANG-RU inventory и privacy boundaries нельзя удалять. Detector precision-first: `auto_confirm=false`, `auto_create_obligation=false`, `canonical_mutation=false`, `financial_write=false`, `financial_truth=false`; fuzzy/LLM matching не authority.

## Current R4 truth

- `YC-040` — DONE/Main Verification PASS.
- `AUTH-040` — DONE/Main Verification PASS.
- `YC-041` — **BLOCKED**, Issue #148, `OWNER_CLOUD_BOOTSTRAP_REQUIRED`, `writer_authority=false`.
- `YC-042` — **BLOCKED**, Issue #149, `OWNER_YDB_TARGET_REQUIRED`, `writer_authority=false`.

Google remains authoritative. Blocked cloud items не дают writer authority, не создают billing-backed resources и не меняют canonical write ownership.

## Current R7 truth

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

VIZ-070 machine authority остаётся `PRH_VISUALIZATION_REGISTRY_V2@2.0.0`; ECHARTS_6 replaceable/local-bundled, SEMANTIC_TABLE_V1 accessible fallback, chart retype query-hash invariant, no financial/query authority.

## Current R8 truth

- `STUDIO-080` — **current writer**, Issue #194, branch `agent/STUDIO-080-progressive-analytics-studio-shell`; IN_PROGRESS до Main Verification.
- `PRIV-080` — dependency-ready separate P2 item; не реализуется внутри STUDIO-080.

STUDIO-080 machine boundary:

- contract `lib/studio/analytics_studio_shell.v1.json` — `PRH_ANALYTICS_STUDIO_SHELL_V1@1.0.0`;
- implementation `lib/studio/analytics_studio_shell.js`;
- live shell `AnalyticsStudioWebApp.html`;
- canonical router registration `surface=studio`, no financial runtime payload;
- tests `tests/analytics_studio_shell_contract_test.js` + `tests/analytics_studio_shell_visual_test.js`;
- normative doc `docs/studio/ANALYTICS_STUDIO_SHELL.md`;
- named gates `Analytics Studio shell` and `Analytics Studio visual gate`;
- default mode DAILY / invalid explicit mode DAILY_FAIL_SAFE;
- URL mode override > mode-only browser preference > DAILY default;
- capability monotonicity Daily -> Explore -> Studio;
- future dashboard/widget/layout/saved-view affordances remain UPCOMING;
- default Financial Home route + legacy rollback + private MYSELF unchanged;
- no google.script.run/private finance fetch on Studio shell;
- responsive + keyboard/a11y contract;
- public telemetry technical-only, no financial/query/private payload;
- all financial/query/storage/network/deploy authorities false; `FREE_ONLY` mandatory.

После STUDIO-080 Main Verification `DASH-080` становится dependency-ready при сохранении DONE VIZ-070/ANL-074. `PRIV-080` остаётся отдельной privacy-mode веткой Roadmap.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` классифицирует tracked tests fail-closed. `analytics_studio_shell_contract_test.js` принадлежит `RUNTIME_INTEGRATION`, `analytics_studio_shell_visual_test.js` — `UI_E2E`. Named gates `Analytics Studio shell` и `Analytics Studio visual gate` обязательны; red gate bypass запрещён.

## MIG-010 historical verified boundary

Owner-private migration остаётся DONE/OWNER_VERIFIED: `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`. Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`; это occurrence-aware capability, а не право AI/CI выбирать семантику дубликатов.

Historical authorized execution policy = `MIG010_EXECUTION_POLICY_V1@1.0.0`, strategy `STAGE_VERIFY_REPLACE_WITH_ROLLBACK_V1`. После finalize execution останавливается в `FINALIZED_PENDING_RECONCILIATION`; только отдельная owner-private reconciliation с `unexplainedMismatch=0` завершает verified lifecycle.

GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; AI/CI не могут переиспользовать historical authorization для будущей financial mutation. Historical `IRREVERSIBLE_ACTION_AUTHORIZED` exact-bound и non-reusable. **Current write authority = false**.

## Current delivery

```text
PR Validation
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification
```

STUDIO-080 остаётся открытым до green `Analytics Studio shell` + `Analytics Studio visual gate` + existing R2/VIZ/ANL/TEST/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA gates, immutable exact candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Read-only multi-AI review

Read-only multi-AI review: required roles `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers = `READ_ONLY`, `writer_authority=false`; review не может отменять красный machine gate.

## Scope handoff

Все R0, R1, R2 через UI-MIG-020, завершённые R3 включая SUB-030, YC-040, AUTH-040 и R7 через VIZ-070 — DONE. `MASTER-G7` complete. YC-041/YC-042 BLOCKED. `STUDIO-080` — единственный active writer.
