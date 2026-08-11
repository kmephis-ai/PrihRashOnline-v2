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

`VIZ-090` — единственный **current writer**, canonical Issue #215, branch `agent/VIZ-090-advanced-visualization-pack`. Dependencies `MASTER-G8` и `VIZ-070` доказаны DONE/Main Verification PASS. Exact roadmap_id search до materialization не нашёл существующего Issue/PR/branch.

`MASTER-G8 / Analytics Studio` — complete: STUDIO-080, PRIV-080 и DASH-080..086 DONE/Main Verification PASS. Финальный R8 Issue #213 (`DASH-086`) candidate `e3b78983a22316ae533e94e84135fe5bc4426c58`, merge `a7a73889a4f5deff15e086b5469f00f240cab6e0`, Trusted DEV Deploy PASS, Trusted Runtime Health PASS, autonomous merge PASS, Main Verification PASS.

VIZ-090 вводит `PRH_ADVANCED_VISUALIZATION_PACK_V1@1.0.0` как pure semantic presentation layer поверх `PRH_VISUALIZATION_REGISTRY_V2@2.0.0` и `PRH_ANALYTICS_CONTRACT_V1@1.0.0`.

Current implementation:

- `lib/visualization/advanced_visualization_pack.v1.json`;
- `lib/visualization/advanced_visualization_pack.js`;
- `tests/advanced_visualization_pack_contract_test.js`;
- `docs/visualization/ADVANCED_VISUALIZATION_PACK.md`;
- TEST-010 classification = `PURE_DOMAIN_APPLICATION`;
- named gate `Advanced visualization pack`;
- LANG-RU inventory/markers registered.

VIZ-090 не меняет VIZ-070 BAR/LINE/DONUT contract. Existing LINE остаётся regression baseline; ECHARTS_6/SEMANTIC_TABLE_V1 renderer boundaries принадлежат VIZ-070.

Advanced registry covers 18 families:

`AREA`, `GROUPED_BAR`, `STACKED_BAR`, `PERCENT_STACKED_BAR`, `WATERFALL`, `SANKEY`, `TREEMAP`, `SUNBURST`, `CALENDAR_HEATMAP`, `MATRIX_HEATMAP`, `PARETO`, `SCATTER`, `BUBBLE`, `HISTOGRAM`, `BOX`, `VIOLIN`, `SMALL_MULTIPLES`, `BULLET_KPI`.

Каждый `PRH_ADVANCED_VISUALIZATION_SOURCE_V1` обязан содержать exact `query_hash`, versioned `source_contract`, explicit `shape` и bounded typed data. Planner заново нормализует переданный AnalyticsQuery, вычисляет hash и требует exact equality. `query_modified=false`; visualization не имеет права менять measure/dimension/filter/time/grain/scope/comparison.

Machine semantic invariants:

- AREA — explicit time series;
- GROUPED/STACKED bar — explicit category/series/value; stack требует series;
- PERCENT_STACKED_BAR — non-negative values, original values сохраняются, deterministic largest-remainder shares дают exact 10000 bps для positive-total category, zero total explicit;
- WATERFALL — one START, contiguous DELTA steps, one END, exact `START + Σ DELTA = END`;
- SANKEY — bounded unique non-self edges, non-negative values, deterministic nodes, `causality_claimed=false`;
- TREEMAP/SUNBURST — one root, no orphan/disconnected/cycle, bounded depth, exact parent = direct-child sum;
- heatmaps — `present=false,value=null` отделено от explicit zero;
- PARETO — deterministic descending order, original total preserved, final cumulative = exact 10000 bps when total>0;
- SCATTER/BUBBLE — finite numeric values, BUBBLE size non-negative, `correlation_claimed=false`, `causality_claimed=false`;
- HISTOGRAM/BOX/VIOLIN — explicit bounded samples only, `source_semantics=EXPLICIT_SAMPLES`, no hidden summary substitution;
- SMALL_MULTIPLES — bounded facets, `scale_policy=SHARED_COMPATIBLE`, no silent facet drop;
- BULLET_KPI — actual/reference/target plus versioned reference/target provenance; visualization не invent’ит budget/target truth.

All advanced inputs are bounded: rows 5000, series 16, nodes 500, edges 1000, hierarchy depth 12, facets 12, samples 5000. Safe-integer/finite-number guards reject overflow/NaN/Infinity/ambiguous shapes.

Every family has deterministic mobile/tablet/desktop strategy. `semantic_table_required=true`, `text_summary_required=true`, `interaction_only_evidence_allowed=false`. Assistive mode activates built-in `SEMANTIC_TABLE_V1`; high-density/small viewport strategy не имеет права silently drop data.

Primary renderer stays VIZ-070 `ECHARTS_6`: `LOCAL_OR_BUNDLED`, replaceable, no external CDN/network/storage/query/financial authority. Arbitrary ECharts options, callbacks, formatter code, HTML/CSS/URL/JavaScript are not accepted as VIZ-090 public configuration.

VIZ-090 runtime normalized source may contain private values/labels and remains ephemeral/private. Telemetry allowlist contains only schema/version/chart_type/renderer/result_shape_hash_prefix/query_hash_prefix/row_count/series_count/responsive_mode/decision/reason. Public tests use independently generated synthetic data only.

All VIZ-090 authorities remain false: financial truth/write, query/query mutation, storage/persistence, network, authorization, deployment. `FREE_ONLY` mandatory.

## FinOps / worst-case budget / owner estimate / model routing handoff

`FINOPS-001` остаётся обязательной cost boundary: `FREE_ONLY` означает отсутствие required paid dependency и запрет автоматического включения платного API/service ради прохождения required gate. Usage counters, throttle/circuit breaker и monthly safety budget остаются machine authority; AI context не имеет права повышать лимиты или обходить circuit breaker.

Перед любой задачей, способной создать внешний расход, writer обязан сформировать **worst-case budget** и **owner estimate** как явный handoff владельцу до irreversible/billing-backed действия. Owner estimate не является machine authorization и не подменяет cost gate; unknown/unproven cost остаётся fail-closed/blocked.

`AIENG-006` / `PRH_AI_MODEL_COST_ROUTING_V1@1.0.0`: required machine gates всегда `LOCAL_DETERMINISTIC`; ChatGPT subscription surface отделена от OpenAI API billing; `OPENAI_API enabled=false` для required engineering. При exhaustion/unknown capacity используется разрешённый Sol/Terra/Luna fallback или pause/defer, но не automatic paid API fallback и не bypass красного machine gate.

FinOps truth, worst-case budget, owner estimate и model routing сохраняются при каждом writer handoff независимо от Roadmap ID.

## Current R0 truth

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. Исполнимая AI-инженерная цепочка сохраняется явно: `AIENG-001 = DONE` -> `AIENG-002 = DONE` -> `AIENG-003 = DONE`; `AIENG-004`, `AIENG-005`, `AIENG-006` также DONE/Main Verification PASS. Этот ordered handoff является lifecycle anchor.

Real or real-derived household finance data stays private. Public repo содержит только public-safe contracts, independently generated synthetic finance fixtures и privacy-safe machine evidence.

## Current R1 truth

`MASTER-G3 / Canonical platform` — complete; historical pre-close state: open.

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Main Verification PASS, Issue #89.
- `ARCH-011` — **DONE**, Main Verification PASS, Issue #91.
- `MIG-010` — **DONE**, Main Verification PASS, Issue #96.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS; `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`.
- `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010` — DONE/Main Verification PASS.

FIN authority = `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority = `PRH_CANONICAL_TRANSACTION_V1`; repository authority = `PRH_TRANSACTION_REPOSITORY_V1`. Generic Google canonical write остаётся fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Post-R1 handoff historically начинается с `DESIGN-020`; этот anchor сохраняется после завершения R2–R8.

## Current R2/R3/R4 truth

R2 через `UI-MIG-020` — DONE/Main Verification PASS. Canonical private Web App default остаётся R2 Financial Home, exposure `MYSELF`, PWA boundary `NOT_PROVEN_CURRENT_HOST`, `FREE_ONLY` mandatory.

R3 `TREND-030`, `PROJ-030`, `GOAL-030`, `BAL-030`, `NW-030`, `SUB-030` — DONE/Main Verification PASS.

`YC-040` и `AUTH-040` — DONE/Main Verification PASS. `YC-041` BLOCKED `OWNER_CLOUD_BOOTSTRAP_REQUIRED`, `YC-042` BLOCKED `OWNER_YDB_TARGET_REQUIRED`; оба `writer_authority=false`, не создают billing-backed resources и не меняют canonical ownership.

## Current R7 truth

`ANL-070`, `SCOPE-070`, `ANL-071`, `ANL-072`, `BENCH-070`, `ANL-073`, `ANL-074`, `PERF-070`, `TEST-070`, `VIZ-070` — DONE/Main Verification PASS; `MASTER-G7` complete.

VIZ-070 machine authority остаётся `PRH_VISUALIZATION_REGISTRY_V2@2.0.0`; BAR/LINE/DONUT registry, ECHARTS_6 local/bundled renderer, SEMANTIC_TABLE fallback и retype query-hash invariant остаются upstream truth. VIZ-090 не изменяет эти schemas задним числом.

## Current R8 truth

STUDIO-080, PRIV-080, DASH-080, DASH-081, DASH-082, DASH-083, DASH-084, DASH-085, DASH-086 — DONE/Main Verification PASS; `MASTER-G8 / Analytics Studio` complete.

- DASH-084 saved views remain private per-user configuration persistence only.
- DASH-085 visual customization remains presentation-only; canonical Issue #208/recovery merge `7aeb044ffed8378d0a4aa3894d60b10caf309f2b`.
- DASH-086 safe portable spec remains private-configuration/dry-run import only; Issue #213 candidate `e3b78983a22316ae533e94e84135fe5bc4426c58`, merge `a7a73889a4f5deff15e086b5469f00f240cab6e0`.

## Current R9 truth

`VIZ-090` / Issue #215 — **current writer**, branch `agent/VIZ-090-advanced-visualization-pack`, IN_PROGRESS until Main Verification. ANL-090/ANL-091/XRAY-090 не входят в current scope: они будут upstream analytics fact authorities поверх готового visualization pack.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` классифицирует tracked tests fail-closed. `advanced_visualization_pack_contract_test.js = PURE_DOMAIN_APPLICATION`; named gate `Advanced visualization pack` обязателен вместе с existing VIZ-070/DASH-086..080/ANL/PRIV/STUDIO/DESIGN/FIN/MIG/privacy/FREE_ONLY gates. Red-gate bypass запрещён.

## MIG-010 historical verified boundary

Owner-private migration остаётся DONE/OWNER_VERIFIED: `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`. Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`.

Historical execution policy = `MIG010_EXECUTION_POLICY_V1@1.0.0`, strategy `STAGE_VERIFY_REPLACE_WITH_ROLLBACK_V1`. После finalize execution state должен оставаться `FINALIZED_PENDING_RECONCILIATION`; это **не** verified completion. Только отдельная owner-private post-write reconciliation с `unexplainedMismatch=0` переводит lifecycle в `OWNER_VERIFIED`.

GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; AI/CI не могут переиспользовать historical authorization для будущей financial mutation. **Current write authority = false**. Любой будущий irreversible financial write требует fresh exact-bound owner authorization.

## Current delivery

```text
PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification
```

VIZ-090 остаётся open до green `Advanced visualization pack` + full existing gates, immutable exact candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Read-only multi-AI review

Required roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers = `READ_ONLY`, `writer_authority=false`; review cannot override red machine gate.

## Scope handoff

Все R0/R1/R2, completed R3, YC-040/AUTH-040, R7 и R8 — DONE. YC-041/YC-042 remain BLOCKED. `VIZ-090` / Issue #215 — единственный active writer.
