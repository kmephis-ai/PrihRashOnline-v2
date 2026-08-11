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

`DASH-082` — единственный **current writer**, canonical Issue #202, branch `agent/DASH-082-dashboard-interaction-bus`. Зависимости `DASH-081` и `ANL-074` уже DONE/Main Verification PASS.

`DASH-081` завершён: Issue #200 **DONE**, candidate `5752b963a528ccdabf307531dff426a9cfbe59a1`, merge `da42188741dcd035684cec900728ea53d5c961a2`, Trusted DEV Deploy PASS, Trusted Runtime Health PASS, autonomous merge PASS, Main Verification PASS.

DASH-082 вводит `PRH_DASHBOARD_INTERACTION_BUS_V1@1.0.0` как deterministic configuration-only interaction layer поверх DASH-081 bound widgets и ANL-074 Exploration State. Event types = `CLICK`, `SELECTION`, `BRUSH`, `RESET`, `BACK`.

Registry `PRH_DASHBOARD_INTERACTION_REGISTRY_V1` принимает только valid `PRH_DASHBOARD_BOUND_WIDGET_V1`. Source filter capability выводится из canonical AnalyticsQuery dimensions; при grain добавляется `time_bucket`. KPI/CARD не получают implicit dimension interaction. CHART требует `ChartSpec.interactions.filter=true`; BRUSH разрешён только для bound `time_bucket`.

CLICK/SELECTION/BRUSH меняют только `global_context.filter_context` через ANL-074 `SET_GLOBAL_CONTEXT`. SET заменяет same field, CLEAR удаляет same field, unrelated global filters остаются. `widget_contexts`, `drill_context`, global `scope_spec`, widget bindings, layout и AnalyticsQuery не мутируются.

Cross-widget result содержит только derived affected widget IDs: для обычного event — все registered widgets кроме source; для RESET/BACK — все. Это metadata для UI adapters, а не direct mutation authority.

Event identity = `SHA256_CANONICAL_JSON_V1`. Root gesture получает canonical origin identity. Propagated callbacks сохраняют origin и ограничены `max_hop=1`. `PRH_DASHBOARD_INTERACTION_SESSION_V1` хранит bounded processed origin IDs; повторный origin возвращает `DASH082_EVENT_ORIGIN_REPLAY` без state/history mutation. RESET/BACK напрямую делегируются ANL-074, поэтому canonical history/back semantics не дублируются.

Interaction filter values считаются private-runtime configuration. Public tests используют synthetic IDs. Telemetry allowlist = schema/version/event_type/hashed source+origin/state prefixes/affected count/decision/reason; filter values/query filters/private IDs/currency/measure/financial values не публикуются.

Core files current writer:

- `lib/dashboard/dashboard_interaction_bus.v1.json`;
- `lib/dashboard/dashboard_interaction_bus.js`;
- `tests/dashboard_interaction_bus_contract_test.js`;
- `docs/dashboard/DASHBOARD_INTERACTIONS.md`;
- TEST-010 exact classification = `PURE_DOMAIN_APPLICATION`;
- named gate `Dashboard interaction bus`;
- LANG-RU inventory/required markers updated.

All financial/write/query-execution/query-mutation/auth/storage/network/deploy/renderer/layout authorities false; `FREE_ONLY` mandatory.

## FinOps / worst-case budget / owner estimate / model routing handoff

`FINOPS-001` остаётся обязательной cost boundary для runtime и engineering: `FREE_ONLY` означает отсутствие required paid dependency и запрет автоматического включения платного API/service ради прохождения required gate. Usage counters, throttle/circuit breaker и monthly safety budget остаются machine authority; AI context не имеет права повышать лимиты или обходить circuit breaker.

Перед любой задачей, способной создать внешний расход, writer обязан сформировать **worst-case budget** и **owner estimate** как явный handoff владельцу до irreversible/billing-backed действия. Owner estimate не является machine authorization и не подменяет cost gate; если стоимость не доказана как допустимая в рамках текущего policy, действие fail-closed/blocked.

`AIENG-006` / `PRH_AI_MODEL_COST_ROUTING_V1@1.0.0` определяет model routing handoff: required machine gates всегда `LOCAL_DETERMINISTIC`; интерактивная ChatGPT subscription surface отделена от OpenAI API billing; `OPENAI_API enabled=false` для required engineering. При exhaustion/unknown capacity используется разрешённый Sol/Terra/Luna fallback или pause/defer, но **не** автоматический paid API fallback и не bypass красного machine gate.

Таким образом, FinOps truth, worst-case budget, owner estimate и model routing должны сохраняться при каждом writer handoff независимо от текущего Roadmap ID.

## Current R0 truth

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. `AIENG-001..006` по своим lifecycle состояниям завершены/Main Verification PASS; исполнимая AI-инженерная цепочка и fail-closed gates остаются обязательными.

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

`DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020`, `EXP-020`, `INC-020`, `CF-020`, `BUD-020`, `OBL-020`, `DQ-020`, `PWA-020`, `PROF-020`, `UI-MIG-020` — DONE/Main Verification PASS. `UI-MIG-020` Issue #172 завершён, candidate `867fda74824f91bf3931aa3e6ea39d1c7d4dfc1e`, merge `0a87bab34f29897fa781a030797a9a040fb200a3`.

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

ANL-074 authority = `PRH_EXPLORATION_STATE_V1@1.0.0`: deterministic state hash/history, global/widget contexts, drill, RESET/BACK. DASH-082 обязан делегировать эту state authority, а не копировать её.

VIZ-070 machine authority остаётся `PRH_VISUALIZATION_REGISTRY_V2@2.0.0`; ECHARTS_6 replaceable/local-bundled, SEMANTIC_TABLE_V1 accessible fallback, chart retype query-hash invariant, no financial/query authority.

## Current R8 truth

- `STUDIO-080` — DONE, Issue #194 Main Verification PASS.
- `PRIV-080` — DONE, Issue #79 Main Verification PASS.
- `DASH-080` — DONE, Issue #198 Main Verification PASS, merge `70b84350e36e125cea7bdbc396ec967a398fdf1f`.
- `DASH-081` — DONE, Issue #200 Main Verification PASS, merge `da42188741dcd035684cec900728ea53d5c961a2`.
- `DASH-082` — **current writer**, Issue #202, branch `agent/DASH-082-dashboard-interaction-bus`; IN_PROGRESS до Main Verification.

PRIV-080 machine boundary сохраняется: `PRH_PRIVACY_PRESENTATION_V1@1.0.0`, MASKED pre-render redaction, DEMO = PUBLIC_SYNTHETIC only/private reads = 0, ZEN structural-only. Presentation mode не является authorization/security boundary.

DASH-080 boundary сохраняется: `PRH_DASHBOARD_COMPOSER_V1@1.0.0`, desktop 12-column deterministic grid, tablet/mobile derivation, session-only state, no financial/query authority.

DASH-081 boundary сохраняется: `PRH_WIDGET_FACTORY_V1@1.0.0`, explicit semantic binding только, no implicit auto-bind, no query/financial authority.

DASH-082 boundary: global filter interaction only, source semantic capability validation, deterministic canonical event/session hashes, bounded origin dedup/hop, ANL-074 RESET/BACK delegation, privacy-safe telemetry, no financial payload.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` классифицирует tracked tests fail-closed. `dashboard_interaction_bus_contract_test.js` = `PURE_DOMAIN_APPLICATION`; named gate `Dashboard interaction bus` обязателен вместе с existing DASH-081/DASH-080/ANL-074/PRIV/STUDIO/VIZ/R2/FIN/MIG gates. Red gate bypass запрещён.

## MIG-010 historical verified boundary

Owner-private migration остаётся DONE/OWNER_VERIFIED: `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`. Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`.

Historical authorized execution policy = `MIG010_EXECUTION_POLICY_V1@1.0.0`, strategy `STAGE_VERIFY_REPLACE_WITH_ROLLBACK_V1`. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; AI/CI не могут переиспользовать historical authorization для будущей financial mutation. **Current write authority = false**.

## Current delivery

```text
PR Validation
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification
```

DASH-082 остаётся открытым до green interaction bus contract + existing DASH-081/DASH-080/ANL-074/PRIV/STUDIO/R2/VIZ/ANL/TEST/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA gates, immutable exact candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Read-only multi-AI review

Required roles `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers = `READ_ONLY`, `writer_authority=false`; review не может отменять красный machine gate.

## Scope handoff

Все R0, R1, R2 через UI-MIG-020, завершённые R3, YC-040, AUTH-040, R7 через VIZ-070, STUDIO-080, PRIV-080, DASH-080 и DASH-081 — DONE. `MASTER-G7` complete. YC-041/YC-042 BLOCKED. `DASH-082` / Issue #202 — единственный active writer.
