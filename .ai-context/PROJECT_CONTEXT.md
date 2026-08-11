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

`DASH-085` — единственный **current writer**, canonical Issue #209, branch `agent/DASH-085-visual-customization`. Объявленные зависимости `DASH-081` и `DESIGN-020`, а также dependency-order predecessors `DASH-082`/`DASH-083`/`DASH-084` уже DONE/Main Verification PASS.

`DASH-084` завершён: Issue #206 **DONE**, candidate `3626aab53c2a3b71ffff5dc0be579c061517a893`, merge `06e96ad4cb4d03f9447467224ec66dddea470238`, Trusted DEV Deploy PASS, Trusted Runtime Health PASS, autonomous merge PASS, Main Verification PASS.

DASH-085 вводит `PRH_DASHBOARD_VISUAL_CUSTOMIZATION_V1@1.0.0` как presentation-only layer поверх DESIGN-020, DASH-081 и VIZ-070. Он не является query/finance/storage authority и не меняет canonical data.

Global preferences допускают только bounded enums/token aliases: theme `SYSTEM/LIGHT/DARK`, palette `DEFAULT/COLORBLIND/MONO`, density `COMPACT/COMFORTABLE`, reduced-motion/high-contrast flags и отсортированные per-widget overrides. Raw CSS/style/color/hex/RGB/RGBA/formatter/HTML/SVG/script, financial outputs, transaction IDs и private labels запрещены.

Theme/density разрешаются только через существующие DESIGN-020 token aliases. High-contrast deterministically переключает palette в `MONO`; reduced-motion ссылается на существующий DESIGN motion token. Focus-visible и minimum hit target >=44px остаются обязательными.

CHART retype полностью делегирован `PRH_VISUALIZATION_REGISTRY_V2@2.0.0` / `retypeWidget()`. Успешный presentation plan обязан сохранять исходные DASH-081 `query_hash` и `binding_hash`; `query_modified=false`, `binding_modified=false`. VIZ-070 incompatibility остаётся fail-closed.

Per-widget customization поддерживает bounded chart type, axes, labels, legend/position, stack, sort, Top-N и semantic number format. DONUT не принимает axes/stack; `stack=NORMAL` v1 допустим только для BAR с explicit series. Non-chart widgets отклоняют chart-only overrides.

Number format allowlist = `AUTO/MONEY/INTEGER/PERCENT/COMPACT`, locale v1 = `ru-RU`; arbitrary JavaScript formatter/function/string запрещён.

Top-N — presentation transform только над уже полученным semantic result. Source rows bounded и integer-safe; omitted rows сворачиваются в explicit `__OTHER__`, после чего invariant требует точного `source_total == presented_total`. Это не меняет AnalyticsQuery и не создаёт FIN-TRUTH.

Core current writer:

- `lib/dashboard/dashboard_visual_customization.v1.json`;
- `lib/dashboard/dashboard_visual_customization.js`;
- `tests/dashboard_visual_customization_contract_test.js`;
- `docs/dashboard/DASHBOARD_VISUAL_CUSTOMIZATION.md`;
- TEST-010 exact classification `PURE_DOMAIN_APPLICATION`;
- named gate `Dashboard visual customization`;
- LANG-RU inventory/markers updated.

DASH-085 имеет все authority false: `financial_truth`, `financial_write`, `query_execution`, `query_mutation`, `binding_mutation`, `canonical_mutation`, `authorization`, `storage`, `network`, `deployment`, `renderer`. Public evidence = independently generated synthetic/configuration-only. Telemetry = schema/version/theme/density/widget kind/customization+query hash prefixes/decision/reason без financial/private payload. `FREE_ONLY` mandatory.

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

ANL-074 authority = `PRH_EXPLORATION_STATE_V1@1.0.0`: deterministic state hash/history, global/widget contexts, drill, RESET/BACK. DASH-085 не заменяет exploration state authority.

VIZ-070 machine authority остаётся `PRH_VISUALIZATION_REGISTRY_V2@2.0.0`; ECHARTS_6 replaceable/local-bundled, SEMANTIC_TABLE_V1 accessible fallback, chart retype query-hash invariant, no financial/query authority.

## Current R8 truth

- `STUDIO-080` — DONE, Issue #194 Main Verification PASS.
- `PRIV-080` — DONE, Issue #79 Main Verification PASS.
- `DASH-080` — DONE, Issue #198 Main Verification PASS, merge `70b84350e36e125cea7bdbc396ec967a398fdf1f`.
- `DASH-081` — DONE, Issue #200 Main Verification PASS, merge `da42188741dcd035684cec900728ea53d5c961a2`.
- `DASH-082` — DONE, Issue #202 Main Verification PASS, candidate `c740a2c8aaf6e8d3da2c48bc2148bffd325a44aa`, merge `ac565189bc70133f127bdea471a50d0efae94443`.
- `DASH-083` — DONE, Issue #204 Main Verification PASS, candidate `c2fc3810c54a88c8aeca8b89ebd86e3784dbef46`, merge `98b0e54413bfc6e9742d78fa2befd507341f5141`.
- `DASH-084` — DONE, Issue #206 Main Verification PASS, candidate `3626aab53c2a3b71ffff5dc0be579c061517a893`, merge `06e96ad4cb4d03f9447467224ec66dddea470238`.
- `DASH-085` — **current writer**, Issue #209, branch `agent/DASH-085-visual-customization`; IN_PROGRESS до Main Verification.

PRIV-080 boundary сохраняется: `PRH_PRIVACY_PRESENTATION_V1@1.0.0`; presentation mode не является authorization/security boundary.

DASH-080 boundary сохраняется: `PRH_DASHBOARD_COMPOSER_V1@1.0.0`, deterministic responsive layout, session-only composer state, no financial/query authority.

DASH-081 boundary сохраняется: `PRH_WIDGET_FACTORY_V1@1.0.0`, explicit semantic binding only, no implicit auto-bind, no financial/query execution authority.

DASH-082 boundary сохраняется: `PRH_DASHBOARD_INTERACTION_BUS_V1@1.0.0`, global filter interaction only, deterministic event/session identity, origin dedup/hop, ANL-074 RESET/BACK delegation.

DASH-083 boundary сохраняется: `PRH_DASHBOARD_DRILL_V1@1.0.0`, hierarchy/drill orchestration, TX-020 selection authority, FIN-backed reconciliation, mismatch fail-closed.

DASH-084 boundary сохраняется: private dashboard configuration storage only; immutable bounded revisions; UserProperties per-user adapter; no financial snapshots, no financial Sheets, no global shared properties, no data-write/query execution authority.

DASH-085 boundary: transient presentation customization only; no persistence/query execution/financial mutation. DESIGN-020 и VIZ-070 остаются upstream authorities для token/accessibility и chart compatibility.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` классифицирует tracked tests fail-closed. `dashboard_visual_customization_contract_test.js` = `PURE_DOMAIN_APPLICATION`; named gate `Dashboard visual customization` обязателен вместе с existing DASH-084/DASH-083/DASH-082/DASH-081/DESIGN/VIZ/TX/ANL/PRIV/STUDIO/R2/FIN/MIG gates. Red gate bypass запрещён.

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

DASH-085 остаётся открытым до green `Dashboard visual customization` + existing DASH-084/DASH-083/DASH-082/DASH-081/DESIGN/VIZ/TX/ANL/PRIV/STUDIO/TEST/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA gates, immutable exact candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Read-only multi-AI review

Read-only multi-AI review: required roles `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers = `READ_ONLY`, `writer_authority=false`; review не может отменять красный machine gate.

## Scope handoff

Все R0, R1, R2 через UI-MIG-020, завершённые R3, YC-040, AUTH-040, R7 через VIZ-070, STUDIO-080, PRIV-080 и DASH-080..084 — DONE. `MASTER-G7` complete. YC-041/YC-042 BLOCKED. `DASH-085` / Issue #209 — единственный active writer.
