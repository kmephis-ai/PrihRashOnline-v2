# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys, private scope assignments и owner-private payload запрещены.

## LANG-RU

Русский язык — единственный нормативный язык human-facing документации, GitHub metadata и AI instructions. Machine identifiers, API/schema fields, library/protocol/standard names и команды сохраняются без искусственного перевода. Параллельный English source of truth запрещён.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — Executable GitHub Roadmap v2.4 / Product Recovery rebaseline.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Versioned contracts + architecture/ADR/operations docs.

## Текущая инженерная задача

`VIZ-REC-001` — единственный **current writer**, canonical Issue #226, branch `agent/VIZ-REC-001-household-visuals`, draft PR #238.

Recovery state после owner-authenticated PERF/UI recovery:

- `GOV-REC-001` #219 — DONE/Main Verification PASS, merge `5c1fe264bc35d7aaf755e611536dabbf31e3f6c0`;
- `PERF-REC-001` #222 — DONE/Main Verification PASS, PR #232, merge `dce3558875178edc1b5b6d7391028e7be1f4835e`; exact deployed `fa921b53…` owner-auth 20C+20W: cold p95 5,922s, warm p95 1,306s, cold cell reads 38 059 вместо 263 505;
- `UI-REC-001` #221 — DONE/Main Verification PASS, PR #229, merge `313b4eade10b7680306b2096f39d6271bbb30aa3`; exact owner Product UAT восстановил truthful Russian navigation/loading, desktop/mobile routes и repeated direct switch ≈1–2s;
- `VIZ-REC-001` #226 — IN_PROGRESS: local ECharts + meaningful household visuals, без новой financial/query/write authority;
- existing `PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` и Home ChartSpec являются upstream renderer-neutral truth; второй visualization registry создавать запрещено;
- runtime Home сейчас содержит только один real cash-flow period, поэтому client-side synthetic history запрещена;
- multi-period trend должен строиться из bounded latest-N-month canonical read с server-side FIN-010 evaluation, а не из повторного full-history scan;
- expense composition должна использовать Top-N + `Прочее`, сохраняя authoritative total;
- pinned local ECharts/semantic fallback обязательны, external CDN запрещён;
- historical visual payload не должен снова блокировать initial Home KPI shell/data path: предпочтителен отдельный async/cached visual read;
- Apps Script deployed version = 198/200, поэтому VIZ development = draft/no-deploy до safe retention/headroom;
- `ANL-090` #217 / PR #218 остаётся BLOCKED/draft `PAUSED_REBASELINE` без writer authority.

Owner-approved forensic rebaseline 2026-08-11 установил: audited legacy Roadmap completion 75/107 = 70,1%; после R2R backlog 75/116 = 64,7%; independent overall Product Readiness ≈25%. R7/R8/VIZ-090 — reusable engineering contracts/shells/planners, но не достаточный deployed private product proof. Main Verification/exact-SHA health/synthetic Playwright являются engineering/delivery proof, но user-facing Product Ready требует owner-authenticated UAT.

Новый product lifecycle: `CODE_COMPLETE -> RUNTIME_INTEGRATED -> REAL_E2E_VERIFIED -> PRODUCT_READY -> DONE`.

Wave R2R current order: `GOV-REC-001 -> PERF-REC-001 -> UI-REC-001 -> VIZ-REC-001 -> DATA -> FIN/PLAN -> E2E -> MASTER-GUX -> STUDIO -> MASTER-GSTUDIO`. Сейчас execution = `VIZ-REC-001`. R9/R10 feature expansion frozen.

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

## Current R2/R2R/R3/R4 truth

R2 через `UI-MIG-020` — historical engineering DONE/Main Verification PASS. Canonical private Web App default остаётся R2 Financial Home, exposure `MYSELF`, PWA boundary `NOT_PROVEN_CURRENT_HOST`, `FREE_ONLY` mandatory. Product claim superseded: Daily finance surfaces без real private binding остаются fail-closed до downstream DATA/FIN integration.

R2R Product Recovery — current critical path. `GOV-REC-001`, `PERF-REC-001`, `UI-REC-001` DONE/Main Verification PASS; `VIZ-REC-001` IN_PROGRESS and is the only writer. DATA/FIN/PLAN/E2E/STUDIO remain downstream and obey gates `MASTER-GREC-0..6`, `MASTER-GUX`, `MASTER-GSTUDIO`.

R3 `TREND-030`, `PROJ-030`, `GOAL-030`, `BAL-030`, `NW-030`, `SUB-030` — DONE_ENGINEERING/Main Verification PASS; canonical product integration не доказана и не получает product credit до отдельного post-GUX scope.

`YC-040` и `AUTH-040` — DONE/Main Verification PASS. `YC-041` BLOCKED `OWNER_CLOUD_BOOTSTRAP_REQUIRED`, `YC-042` BLOCKED `OWNER_YDB_TARGET_REQUIRED`; оба `writer_authority=false`, не создают billing-backed resources и не меняют canonical ownership.

## Current R7 truth

`ANL-070`, `SCOPE-070`, `ANL-071`, `ANL-072`, `BENCH-070`, `ANL-073`, `ANL-074`, `PERF-070`, `TEST-070`, `VIZ-070` — DONE_ENGINEERING/Main Verification PASS; `MASTER-G7-ENGINEERING` complete. Private runtime/UI integration не доказана.

VIZ-070 machine authority остаётся `PRH_VISUALIZATION_REGISTRY_V2@2.0.0`; BAR/LINE/DONUT registry, ECHARTS_6 local/bundled renderer, SEMANTIC_TABLE fallback и retype query-hash invariant остаются upstream truth. VIZ-090 не изменяет эти schemas задним числом.

## Current R8 truth

STUDIO-080, PRIV-080, DASH-080, DASH-081, DASH-082, DASH-083, DASH-084, DASH-085, DASH-086 — DONE_ENGINEERING/Main Verification PASS; `MASTER-G8-ENGINEERING` complete. Studio shell/configuration contracts не равны full private analytics product; production gate = `MASTER-GSTUDIO`.

- DASH-084 saved views remain private per-user configuration persistence only.
- DASH-085 visual customization remains presentation-only; canonical Issue #208/recovery merge `7aeb044ffed8378d0a4aa3894d60b10caf309f2b`.
- DASH-086 safe portable spec remains private-configuration/dry-run import only; Issue #213 candidate `e3b78983a22316ae533e94e84135fe5bc4426c58`, merge `a7a73889a4f5deff15e086b5469f00f240cab6e0`.

## Current R9 truth

`VIZ-090` / Issue #215 — DONE_ENGINEERING/Main Verification PASS; 18-family semantic planner не подключён к browser renderer/private query runtime. `ANL-090` / Issue #217 — BLOCKED `PAUSED_REBASELINE`, PR #218 draft. R9/R10 frozen до `MASTER-GSTUDIO`.

## PERF-REC-001 recovered runtime boundary

PERF recovery завершён без financial semantics/write authority. Live Home cold path больше не делает full-history canonical `readAll`: он использует bounded latest-calendar-month projection (full history ID + timestamp, затем canonical columns только выбранного месяца). Warm path использует exact source-revision private UserCache. Owner-auth exact `fa921b53…`: cold p95 5,922s, warm p95 1,306s; 20C+20W PASS; cold cell reads снижены до 38 059. `PRH_SINGLE_SCAN_REFRESH_V1@1.0.0` остаётся validated reusable contract, но не выдаётся за live Home authority. Telemetry = phase durations/read counts/revision hash prefixes/cache decision only; financial values, labels, IDs и Web App locator запрещены.

## UI-REC-001 completed runtime/presentation boundary

UI recovery завершён и не получил financial/query/write authority. Household-visible presentation использует русские labels/human states, primary navigation рекламирует только proven destinations, loading shell отделён от canonical financial build, а route links используют canonical Web App self URL. Recovery-stage owner visual acceptance относится к UI truth, но не заменяет VIZ-REC meaningful chart acceptance.

## VIZ-REC-001 active boundary

VIZ recovery использует existing renderer-neutral `ChartSpec + RenderDataset` и existing ECHARTS_6 adapter; создавать параллельный visualization authority запрещено. Presentation projection может только reshaping already-authoritative period KPI/expense totals: Top-N + `Прочее`, period labels, semantic fallback. Вычислять income/expense/cash-flow из raw transactions в renderer/presentation слое запрещено. Multi-period cash-flow source должен выполнять FIN-010 server-side для каждого bounded calendar period. External CDN запрещён; browser engine pinned/local. Owner Product Ready требует exact-SHA desktop/mobile/a11y visual UAT.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` классифицирует tracked tests fail-closed. Existing named gates VIZ/DASH/ANL/PRIV/STUDIO/DESIGN/FIN/MIG/privacy/FREE_ONLY остаются обязательны. Новые VIZ-REC tests должны падать при synthetic history masquerade, external CDN, loss of expense total under Top-N, visual developer IDs и semantic fallback regression. Red-gate bypass запрещён.

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
-> Product Ready E2E (только work_class=user_facing)
-> CI-003 autonomous squash merge
-> Main Verification
```

Trusted Runtime Health остаётся engineering proof и не заменяет `product-ready-e2e`. User-facing Issue закрывается только при `product_stage=PRODUCT_READY` и exact-candidate Product E2E PASS.

## Read-only multi-AI review

Required roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers = `READ_ONLY`, `writer_authority=false`; review cannot override red machine gate.

## Scope handoff

R0/R1 foundation сохраняет DONE. R2/R3/R7/R8/VIZ-090 historical engineering completion сохранён, но product status reclassified в Roadmap v2.4. YC-041/YC-042 remain BLOCKED. `VIZ-REC-001` / Issue #226 / PR #238 — единственный active writer; PERF-REC-001 #222 и UI-REC-001 #221 DONE/Main Verification PASS; ANL-090/PR #218 paused/blocked without writer authority.