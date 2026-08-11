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

`DASH-084` — единственный **current writer**, canonical Issue #206, branch `agent/DASH-084-saved-views-versions`. Объявленная зависимость `DASH-081` и dependency-order predecessors `DASH-082`/`DASH-083` уже DONE/Main Verification PASS.

`DASH-083` завершён: Issue #204 **DONE**, candidate `c2fc3810c54a88c8aeca8b89ebd86e3784dbef46`, merge `98b0e54413bfc6e9742d78fa2befd507341f5141`, Trusted DEV Deploy PASS, Trusted Runtime Health PASS, autonomous merge PASS, Main Verification PASS.

DASH-084 вводит `PRH_DASHBOARD_SAVED_VIEWS_V1@1.0.0` как private configuration persistence layer поверх DASH-080 layout + DASH-081 semantic bindings. Saved configuration = canonical `PRH_DASHBOARD_SPEC_V1` + zero-or-more separately validated `PRH_DASHBOARD_BOUND_WIDGET_V1`; semantic bindings не внедряются внутрь layout spec.

Saved documents не являются data cache: запрещены AnalyticsResult/result rows, canonical transaction rows/datasets, financial output values, balances/amounts, runtime/deployment locators, OAuth/access/refresh tokens, credentials/secrets. Canonical AnalyticsQuery configuration и private filter/dimension IDs разрешены только внутри private per-user store и не допускаются в telemetry/public evidence.

Pure lifecycle contract поддерживает `CREATE`, `CREATE_FROM_PRESET`, `SAVE_VERSION`, `CLONE`, `RENAME`, `RESET`, `RESTORE_REVISION`, `DELETE`, `MIGRATE`. Revision history immutable; identical save = deterministic `NOOP`; restore/reset добавляют новую revision вместо rewrite history. Canonical identity = `SHA256_CANONICAL_JSON_V1`, timestamps не входят в identity.

Curated starter presets = `FAMILY`, `EXPENSE`, `INCOME`, `CASH_FLOW`, `BUDGET`, `NET_WORTH`, `RISK`, `SUBSCRIPTIONS`. Они editable/cloneable, содержат только safe starter layouts с UNBOUND placeholders и не содержат financial dataset snapshots.

Private runtime adapter `DashboardSavedViewsStorageService.js` использует только namespaced `PropertiesService.getUserProperties()` + `LockService.getUserLock()`. `ScriptProperties`, `DocumentProperties`, financial Sheets, required browser local/session storage и external SaaS не используются. Index + view/tombstone записываются одним `setProperties()` batch после optimistic `expected_generation` check; stale writer fail closed.

Bounded persistence limits: 24 views, 6 revisions/view, 7 KB configuration, 8 KB serialized view document, 6 KB index. Limits проверяются до mutation; overflow fail closed, а не через platform quota error.

Core current writer:

- `lib/dashboard/dashboard_saved_views.v1.json`;
- `lib/dashboard/dashboard_saved_views.js`;
- `DashboardSavedViewsStorageService.js`;
- `tests/dashboard_saved_views_contract_test.js`;
- `docs/dashboard/DASHBOARD_SAVED_VIEWS.md`;
- TEST-010 exact classification `PURE_DOMAIN_APPLICATION`;
- named gate `Dashboard saved views`;
- LANG-RU inventory/markers updated.

DASH-084 имеет только `dashboard_config_storage=true`. `financial_truth`, `financial_write`, `query_execution`, `query_mutation`, `canonical_financial_mutation`, `authorization`, `network`, `deployment`, `renderer`, `layout` остаются false. Public evidence = independently generated synthetic/configuration-only. Telemetry = schema/version/action/view+revision hash prefixes/counts/decision/reason без names/filter values/private IDs/financial values/runtime locators. `FREE_ONLY` mandatory.

## FinOps / worst-case budget / owner estimate / model routing handoff

`FINOPS-001` остаётся обязательной cost boundary для runtime и engineering: `FREE_ONLY` означает отсутствие required paid dependency и запрет автоматического включения платного API/service ради прохождения required gate. Usage counters, throttle/circuit breaker и monthly safety budget остаются machine authority; AI context не имеет права повышать лимиты или обходить circuit breaker.

Перед любой задачей, способной создать внешний расход, writer обязан сформировать **worst-case budget** и **owner estimate** как явный handoff владельцу до irreversible/billing-backed действия. Owner estimate не является machine authorization и не подменяет cost gate; если стоимость не доказана как допустимая в рамках текущего policy, действие fail-closed/blocked.

`AIENG-006` / `PRH_AI_MODEL_COST_ROUTING_V1@1.0.0` определяет model routing handoff: required machine gates всегда `LOCAL_DETERMINISTIC`; интерактивная ChatGPT subscription surface отделена от OpenAI API billing; `OPENAI_API enabled=false` для required engineering. При exhaustion/unknown capacity используется разрешённый Sol/Terra/Luna fallback или pause/defer, но **не** автоматический paid API fallback и не bypass красного machine gate.

Таким образом, FinOps truth, worst-case budget, owner estimate и model routing должны сохраняться при каждом writer handoff независимо от текущего Roadmap ID.

## Current R0 truth

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. Исполнимая AI-инженерная цепочка канонизирована: `AIENG-001 = DONE` -> `AIENG-002 = DONE` -> `AIENG-003 = DONE`; далее `AIENG-004`, `AIENG-005` и `AIENG-006` также DONE/Main Verification PASS. Этот ordered handoff остаётся обязательным lifecycle anchor и не заменяется текущим writer.

Real or real-derived household finance data stays private. Public repository содержит только public-safe contracts, synthetic finance fixtures и privacy-safe machine evidence; private OAuth, runtime locators, реальные строки/агрегаты и owner-private payload не публикуются.

## Current R1 truth

`MASTER-G3` — complete.

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; private stage `OWNER_VERIFIED`.
- `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010`, `AIENG-005` — DONE/Main Verification PASS.

FIN authority = `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority = `PRH_CANONICAL_TRANSACTION_V1`; repository authority = `PRH_TRANSACTION_REPOSITORY_V1`. Generic Google canonical write остаётся fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Post-R1 handoff historically начинается с `DESIGN-020`; этот anchor обязан оставаться в lifecycle docs даже после завершения R2.

## Current R2 truth

`DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020`, `EXP-020`, `INC-020`, `CF-020`, `BUD-020`, `OBL-020`, `DQ-020`, `PWA-020`, `PROF-020`, `UI-MIG-020` — DONE/Main Verification PASS. `TX-020` Issue #124 завершён, merge `38a6d6bece459f61a2cf3d9af2cd8419274b258b`. `UI-MIG-020` Issue #172 завершён, candidate `867fda74824f91bf3931aa3e6ea39d1c7d4dfc1e`, merge `0a87bab34f29897fa781a030797a9a040fb200a3`.

Canonical private Web App default = R2 Financial Home. Generated exact-candidate runtime строится из canonical `lib/**`; `financial_formula_copy=false`. `PRH_RUNTIME_DIMENSION_LABEL_HASH_V1` остаётся transient read-only adapter identity без persistent authority. Authenticated private Home smoke V3 и Trusted Runtime Health PASS. Web App остаётся `MYSELF`; PWA boundary `NOT_PROVEN_CURRENT_HOST`; `FREE_ONLY` обязателен.

## Current R3 truth

- `TREND-030` — DONE, Issue #164 Main Verification PASS.
- `PROJ-030` — DONE, Issue #166 Main Verification PASS.
- `GOAL-030` — DONE, Issue #168 Main Verification PASS.
- `BAL-030` — DONE, Issue #76 Main Verification PASS.
- `NW-030` — DONE, Issue #171 Main Verification PASS.
- `SUB-030` — DONE, Issue #179 Main Verification PASS.

SUB-030 detector remains precision-first: `auto_confirm=false`, `auto_create_obligation=false`, `canonical_mutation=false`, `financial_write=false`, `financial_truth=false`; fuzzy/LLM matching не authority.

## Current R4 truth

- `YC-040` — DONE/Main Verification PASS.
- `AUTH-040` — DONE/Main Verification PASS.
- `YC-041` — **BLOCKED**, Issue #148, `OWNER_CLOUD_BOOTSTRAP_REQUIRED`, `writer_authority=false`.
- `YC-042` — **BLOCKED**, Issue #149, `OWNER_YDB_TARGET_REQUIRED`, `writer_authority=false`.

Google remains authoritative. Blocked cloud items не дают writer authority, не создают billing-backed resources и не меняют canonical write ownership.

## Current R7 truth

- `ANL-070` — DONE.
- `SCOPE-070` — DONE.
- `ANL-071` — DONE.
- `ANL-072` — DONE.
- `BENCH-070` — DONE.
- `ANL-074` — **DONE**, Issue #155 Main Verification PASS, merge `b461bfea099a6b35b8f156975f405ed4d4b58af1`.
- `ANL-073` — DONE, Issue #186 Main Verification PASS.
- `PERF-070` — DONE.
- `TEST-070` — DONE.
- `VIZ-070` — DONE, Issue #192 Main Verification PASS.
- `MASTER-G7 / Semantic analytics` — **complete**.

ANL-074 authority = `PRH_EXPLORATION_STATE_V1@1.0.0`: deterministic state hash/history, global/widget contexts, drill, RESET/BACK. Dashboard saved-view persistence не заменяет exploration state authority.

VIZ-070 machine authority остаётся `PRH_VISUALIZATION_REGISTRY_V2@2.0.0`; ECHARTS_6 replaceable/local-bundled, SEMANTIC_TABLE_V1 accessible fallback, chart retype query-hash invariant, no financial/query authority.

## Current R8 truth

- `STUDIO-080` — DONE, Issue #194 Main Verification PASS.
- `PRIV-080` — DONE, Issue #79 Main Verification PASS.
- `DASH-080` — DONE, Issue #198 Main Verification PASS, merge `70b84350e36e125cea7bdbc396ec967a398fdf1f`.
- `DASH-081` — DONE, Issue #200 Main Verification PASS, merge `da42188741dcd035684cec900728ea53d5c961a2`.
- `DASH-082` — DONE, Issue #202 Main Verification PASS, candidate `c740a2c8aaf6e8d3da2c48bc2148bffd325a44aa`, merge `ac565189bc70133f127bdea471a50d0efae94443`.
- `DASH-083` — DONE, Issue #204 Main Verification PASS, candidate `c2fc3810c54a88c8aeca8b89ebd86e3784dbef46`, merge `98b0e54413bfc6e9742d78fa2befd507341f5141`.
- `DASH-084` — **current writer**, Issue #206, branch `agent/DASH-084-saved-views-versions`; IN_PROGRESS до Main Verification.

PRIV-080 boundary сохраняется: `PRH_PRIVACY_PRESENTATION_V1@1.0.0`; presentation mode не является authorization/security boundary.

DASH-080 boundary сохраняется: `PRH_DASHBOARD_COMPOSER_V1@1.0.0`, deterministic responsive layout, session-only composer state, no financial/query authority.

DASH-081 boundary сохраняется: `PRH_WIDGET_FACTORY_V1@1.0.0`, explicit semantic binding only, no implicit auto-bind, no financial/query execution authority.

DASH-082 boundary сохраняется: `PRH_DASHBOARD_INTERACTION_BUS_V1@1.0.0`, global filter interaction only, deterministic event/session identity, origin dedup/hop, ANL-074 RESET/BACK delegation.

DASH-083 boundary сохраняется: `PRH_DASHBOARD_DRILL_V1@1.0.0`, hierarchy/drill orchestration, TX-020 selection authority, FIN-backed reconciliation, mismatch fail-closed.

DASH-084 boundary: private dashboard configuration storage only; immutable bounded revisions; UserProperties per-user adapter; no financial snapshots, no financial Sheets, no global shared properties, no data-write/query execution authority.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` классифицирует tracked tests fail-closed. `dashboard_saved_views_contract_test.js` = `PURE_DOMAIN_APPLICATION`; named gate `Dashboard saved views` обязателен вместе с existing DASH-083/DASH-082/DASH-081/TX/ANL/PRIV/STUDIO/VIZ/R2/FIN/MIG gates. Red gate bypass запрещён.

## MIG-010 historical verified boundary

Owner-private migration остаётся DONE/OWNER_VERIFIED: `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`. Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`.

Historical authorized execution policy = `MIG010_EXECUTION_POLICY_V1@1.0.0`, strategy `STAGE_VERIFY_REPLACE_WITH_ROLLBACK_V1`. После finalize execution состояние обязано оставаться `FINALIZED_PENDING_RECONCILIATION`; это **не** verified completion. Только отдельная owner-private post-write reconciliation с `unexplainedMismatch=0` переводит historical migration lifecycle в подтверждённое завершение/`OWNER_VERIFIED`.

GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; AI/CI не могут переиспользовать historical authorization для будущей financial mutation. **Current write authority = false**.

## Current delivery

```text
PR Validation
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification
```

DASH-084 остаётся открытым до green saved-view lifecycle/UserProperties contract + existing DASH-083/DASH-082/DASH-081/TX/ANL/PRIV/STUDIO/VIZ/TEST/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA gates, immutable exact candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Read-only multi-AI review

Read-only multi-AI review: required roles `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers = `READ_ONLY`, `writer_authority=false`; review не может отменять красный machine gate.

## Scope handoff

Все R0, R1, R2 через UI-MIG-020, завершённые R3, YC-040, AUTH-040, R7 через VIZ-070, STUDIO-080, PRIV-080, DASH-080, DASH-081, DASH-082 и DASH-083 — DONE. `MASTER-G7` complete. YC-041/YC-042 BLOCKED. `DASH-084` / Issue #206 — единственный active writer.
