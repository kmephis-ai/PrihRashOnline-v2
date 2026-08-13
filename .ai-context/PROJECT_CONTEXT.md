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

`DATA-REC-001` — единственный **current writer**, canonical Issue #223, branch `agent/DATA-REC-001-private-transactions-data-quality`, PR #241.

Recovery state после UI Product Ready, VIZ runtime integration и GOV stage-aware recovery:

- `GOV-REC-001` #219 — DONE/Main Verification PASS, merge `5c1fe264bc35d7aaf755e611536dabbf31e3f6c0`;
- `PERF-REC-001` #222 — DONE_ENGINEERING/Main Verification PASS, PR #232, merge `dce3558875178edc1b5b6d7391028e7be1f4835e`; exact deployed `fa921b53…` owner-auth 20C+20W: cold p95 5,922s, warm p95 1,306s, cold cell reads 38 059 вместо 263 505;
- `UI-REC-001` #221 — DONE/Product Ready E2E/Main Verification PASS, PR #229, merge `313b4eade10b7680306b2096f39d6271bbb30aa3`; truthful navigation и русский household UI восстановлены;
- `VIZ-REC-001` #226 — BLOCKED после engineering/runtime integration: exact candidate `5bad584e…`, PR #238, `engineering_status=CODE_COMPLETE`, `product_stage=RUNTIME_INTEGRATED`; local ECharts simple build, early runtime dispatch и revision-aware visual cache развернуты; владелец подтвердил приемлемую производительность текущего этапа;
- VIZ не получает фиктивный полный Product Ready из одного performance acceptance: остаётся нужен canonical authenticated Product Ready E2E;
- `GOV-REC-002` #239 — DONE_ENGINEERING/Main Verification PASS, PR #240, merge `922c0e07a747dff5ed0852212ca5a5138c1d1340`; добавил узкий `depends_on_runtime_integrated` без снижения final gates;
- `DATA-REC-001` #223 — IN_PROGRESS: восстанавливает owner-private read-only Transactions + Data Quality на одном canonical revision snapshot, без write/autofix authority и без synthetic product fallback;
- `E2E-REC-001` #227 остаётся BACKLOG: VIZ dependency теперь stage-aware, но обычные DATA/FIN/PLAN prerequisites обязаны честно достичь DONE;
- `ANL-090` #217 / PR #218 остаётся BLOCKED/draft `PAUSED_REBASELINE` без writer authority.

Owner-approved forensic rebaseline 2026-08-11 установил: audited legacy Roadmap completion 75/107 = 70,1%; после R2R backlog 75/116 = 64,7%; R2R product completion gate = `MASTER-GUX`, который не может быть пройден synthetic-only evidence; independent overall Product Readiness ≈25%. Issue-count completion не является product metric. Home private-bound; прочие surfaces получают product credit только после доказанного runtime/E2E. R7/R8/VIZ-090 — reusable engineering contracts/shells/planners, но не автоматически deployed private product. Main Verification/exact-SHA health/synthetic Playwright являются engineering/delivery proof, но не Product Ready.

Новый product lifecycle: `CODE_COMPLETE -> RUNTIME_INTEGRATED -> REAL_E2E_VERIFIED -> PRODUCT_READY -> DONE`.

Wave R2R execution сейчас = `DATA-REC-001`; далее FIN/PLAN выполняются по ordinary dependencies, затем canonical `E2E-REC-001` строит Product Ready producer поверх уже развернутого VIZ и завершённых DATA/FIN/PLAN. STUDIO остаётся за product-ready dependency. R9/R10 feature expansion frozen.

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

R2 через `UI-MIG-020` — historical engineering DONE/Main Verification PASS. Canonical private Web App default остаётся R2 Financial Home, exposure `MYSELF`, PWA boundary `NOT_PROVEN_CURRENT_HOST`, `FREE_ONLY` mandatory. Historical broad product claim superseded: каждое user-facing surface требует отдельного runtime/Product Ready evidence.

R2R Product Recovery — current critical path. `GOV-REC-001` DONE; `PERF-REC-001` DONE_ENGINEERING/Main Verification PASS; `UI-REC-001` DONE/Product Ready; `VIZ-REC-001` BLOCKED at `CODE_COMPLETE/RUNTIME_INTEGRATED`; `GOV-REC-002` DONE_ENGINEERING/Main Verification PASS; `DATA-REC-001` IN_PROGRESS and is the only writer. FIN/PLAN следуют по ordinary dependency gates; `E2E-REC-001` ждёт DONE DATA/FIN/PLAN и использует stage-aware VIZ prerequisite. STUDIO obeys `depends_on_product_ready`.

`depends_on_runtime_integrated` не понижает final gate: обычный `depends_on` требует predecessor `DONE`; `depends_on_product_ready` требует завершённый product item; runtime-integrated dependency лишь разрешает gate-builder работать поверх уже deployed user-facing predecessor. User-facing `DONE` всё ещё требует exact-SHA `PRODUCT_READY_E2E` и Main Verification.

R3 `TREND-030`, `PROJ-030`, `GOAL-030`, `BAL-030`, `NW-030`, `SUB-030` — DONE_ENGINEERING/Main Verification PASS; canonical product integration не доказана и не получает product credit до отдельного post-GUX scope.

`YC-040` и `AUTH-040` — DONE/Main Verification PASS. `YC-041` BLOCKED `OWNER_CLOUD_BOOTSTRAP_REQUIRED`, `YC-042` BLOCKED `OWNER_YDB_TARGET_REQUIRED`; оба `writer_authority=false`, не создают billing-backed resources и не меняют canonical ownership.

## Current R7 truth

`ANL-070`, `SCOPE-070`, `ANL-071`, `ANL-072`, `BENCH-070`, `ANL-073`, `ANL-074`, `PERF-070`, `TEST-070`, `VIZ-070` — DONE_ENGINEERING/Main Verification PASS; `MASTER-G7-ENGINEERING` complete. Private runtime/UI integration не доказана.

VIZ-070 machine authority остаётся `PRH_VISUALIZATION_REGISTRY_V2@2.0.0`; BAR/LINE/DONUT registry, ECHARTS_6 local/bundled renderer, SEMANTIC_TABLE fallback и retype query-hash invariant остаются upstream truth. VIZ-090 не изменяет эти schemas задним числом.

## Current R8 truth

STUDIO-080, PRIV-080, DASH-080, DASH-081, DASH-082, DASH-083, DASH-084, DASH-085, DASH-086 — DONE_ENGINEERING/Main Verification PASS; `MASTER-G8-ENGINEERING` complete. Studio shell/configuration contracts не равны working product; production gate = `MASTER-GSTUDIO`.

- DASH-084 saved views remain private per-user configuration persistence only.
- DASH-085 visual customization remains presentation-only; canonical Issue #208/recovery merge `7aeb044ffed8378d0a4aa3894d60b10caf309f2b`.
- DASH-086 safe portable spec remains private-configuration/dry-run import only; Issue #213 candidate `e3b78983a22316ae533e94e84135fe5bc4426c58`, merge `a7a73889a4f5deff15e086b5469f00f240cab6e0`.

## Current R9 truth

`VIZ-090` / Issue #215 — DONE_ENGINEERING/Main Verification PASS; 18-family semantic planner не подключён к browser renderer/private query runtime. `ANL-090` / Issue #217 — BLOCKED `PAUSED_REBASELINE`, PR #218 draft. R9/R10 frozen до `MASTER-GSTUDIO`.

## PERF-REC-001 recovered runtime boundary

PERF recovery завершён без financial semantics/write authority. Live Home cold path больше не делает full-history canonical `readAll`: он использует bounded latest-calendar-month projection (full history ID + timestamp, затем canonical columns только выбранного месяца). Warm path использует exact source-revision private UserCache. Owner-auth exact `fa921b53…`: cold p95 5,922s, warm p95 1,306s; 20C+20W PASS; cold cell reads снижены до 38 059. `PRH_SINGLE_SCAN_REFRESH_V1@1.0.0` остаётся validated reusable contract, но не выдаётся за live Home authority. Telemetry = phase durations/read counts/revision hash prefixes/cache decision only; financial values, labels, IDs и Web App locator запрещены.

## UI-REC-001 runtime/presentation boundary

UI recovery не получает financial/query/write authority. Internal machine IDs допускаются в payload/tests/telemetry, но household-visible presentation обязана использовать русские labels и human states. Primary navigation рекламирует только proven destinations; direct unbound routes fail closed с понятным русским сообщением и без synthetic masquerade. Видимое действие допускается только при доказанном handler/destination. UI-REC-001 exact candidate прошёл owner-authenticated Product Ready E2E; дальнейшие visuals/runtime surfaces всё равно требуют своих gates.

## VIZ-REC-001 runtime/presentation boundary

VIZ recovery использует pinned LOCAL_ONLY Apache ECharts 6.1.0 simple distribution, запускает private KPI/visual reads до renderer parse и применяет private revision-aware visual cache. FIN/query/write authority не переносится в browser renderer. Performance текущего deployed exact candidate принята владельцем, но это только performance acceptance; полный Product Ready должен быть произведён canonical authenticated E2E, а не ручной подстановкой недоказанных UAT полей.

## GOV-REC-002 governance boundary

GOV-REC-002 меняет только dependency semantics/schema/tests/docs. `depends_on_runtime_integrated` допустим для gate-builder/recovery continuation, если predecessor `work_class=user_facing`, lifecycle `IN_PROGRESS/BLOCKED/DONE` и `product_stage >= RUNTIME_INTEGRATED`. Task Packet обязан сохранять фактический lifecycle dependency; ложный `DONE` запрещён. Cross-bucket duplicate Roadmap ID fail-closed. User-facing completion logic `PRODUCT_READY_E2E -> merge -> Main Verification -> DONE` не меняется.

## DATA-REC-001 runtime boundary

DATA recovery переиспользует canonical Google transaction repository, `PRH_SINGLE_SCAN_REFRESH_V1`, `PRH_TRANSACTION_EXPLORER_V1`, `PRH_DATA_QUALITY_CENTER_V1` и FIN-TRUTH aggregation. На один server request допустим один immutable full canonical snapshot; Transactions/DQ связываются repository revision и fail closed при stale expected revision. Product HTML не содержит synthetic fallback; synthetic допускается только в isolated browser test harness. Browser payload не получает raw transaction IDs или DQ record hashes. Write/autofix authority = false.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` классифицирует tracked tests fail-closed. Existing named gates VIZ/DASH/ANL/PRIV/STUDIO/DESIGN/FIN/MIG/privacy/FREE_ONLY остаются обязательны. Roadmap protocol contract обязан отдельно проверять ordinary DONE, runtime-integrated и product-ready dependency semantics. Red-gate bypass запрещён.

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

R0/R1 foundation сохраняет DONE. R2/R3/R7/R8/VIZ-090 historical engineering completion сохранён, product status определяется текущими stage-specific gates. YC-041/YC-042 remain BLOCKED. `DATA-REC-001` / Issue #223 / PR #241 — единственный active writer; `GOV-REC-002` #239 DONE_ENGINEERING; `UI-REC-001` #221 DONE/Product Ready; `VIZ-REC-001` #226 BLOCKED at RUNTIME_INTEGRATED pending canonical E2E; `E2E-REC-001` #227 waits ordinary DATA/FIN/PLAN DONE plus stage-aware VIZ; ANL-090/PR #218 paused/blocked without writer authority.