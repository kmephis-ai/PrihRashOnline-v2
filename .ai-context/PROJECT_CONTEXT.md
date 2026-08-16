# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys, private scope assignments и owner-private payload запрещены.

## LANG-RU

Русский язык — нормативный язык human-facing документации, GitHub metadata и AI instructions. Machine identifiers, API/schema fields, library/protocol/standard names и команды сохраняются без искусственного перевода. Параллельный English source of truth запрещён.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — Executable GitHub Roadmap v2.5, post-LF consolidated authority.
3. `/docs/ROADMAP_LOCAL_FIRST_RECOVERY.md` — historical/consolidated Local-first reference; отдельной execution authority больше не имеет.
4. Live GitHub Issues / PRs — lifecycle/status.
5. Exact-SHA code/tests/workflows + machine evidence.
6. Versioned contracts + architecture/ADR/operations docs.

Security/privacy/cost/irreversible boundaries всегда выше Roadmap amendment. Красный machine gate нельзя отменить human summary.

Machine delivery chain: `PR Validation -> Trusted DEV Deploy -> Trusted Runtime Health -> CI-003 autonomous squash merge -> Main Verification`. Красный этап не обходится и не заменяется human summary.

## Текущая инженерная задача

`MASTER-LF-PRODUCT` завершён. `E2E-LF-001` Issue #273 / PR #274 — DONE / Main Verification PASS; Local-first Product Ready desktop+mobile доказан.

`PLAN-REC-001` Issue #225 / PR #277 — **DONE / Main Verification PASS**, candidate `e73e72a4429c079d9dd44ab406eb89ea52ad7dba`, merge `d69f13f4842726ef893005fa1ebfbee1dc9e57bd`. Owner Product UAT v259 и Product Ready E2E PASS. Budget/Obligations/Liquidity используют owner-approved explicit authorities, separate `planning_revision`, exact finance revision binding, Local-first read/cache/Worker path, zero warm planning network/Sheets reads и no financial write; Cash Flow не является balance proxy.

`PACK-VIZ-LF-001` Issue #280 / PR #281 — **DONE_ENGINEERING / Main Verification PASS**, merge `5306d0e9593d0e5398b69c1fb03bf31bd50a8eda`. Trusted Apps Script candidate packager разрешает pinned Apache ECharts 6.1.0 / `dist/echarts.simple.min.js` для canonical `LocalFirstSpaWebApp.html` без root activation и без self-attestation.

`PACK-VIZ-LF-002` — **IN_PROGRESS / current writer / текущий writer**, Issue #283, PR #284, branch `agent/PACK-VIZ-LF-002-visualization-adapter-bootstrap`, trust anchor `main@5306d0e9593d0e5398b69c1fb03bf31bd50a8eda`.

Цель current writer: engineering-only trust bootstrap, который добавляет ровно `pwa/local_visualization_adapter.js` в trusted Local-first browser runtime allow-list и marker contract, но **не активирует** этот module в root `local-first-browser-runtime.json`, не добавляет feature adapter bytes, не меняет Product UI/FIN/query/write authority и не получает Product Ready authority. Owner Product UAT / `product-ready-e2e` для bootstrap — NOT_APPLICABLE.

`VIZ-REC-001` Issue #226 / PR #282 временно BLOCKED/Draft. Его exact head `084485347a49d88e0333a5a8ddc00fa52affb94a` — diagnostic only, потому что feature candidate не может одновременно расширять trusted allow-list и self-attest runtime. После Main Verification `PACK-VIZ-LF-002` VIZ пересобирается на новом trusted main и проходит fresh machine evidence + desktop/physical-mobile Owner Product UAT. Historical PR #238 / candidate `5bad584e6b09d6af3fc9bda18322f5682e1806fa` — только historical engineering evidence.

## Local-first architecture boundary

Owner decision 2026-08-14: стратегический user-facing read path — **Local-first SPA + IndexedDB + Web Worker + background revision/delta synchronization**. Request-per-view `Apps Script -> Google Sheets -> server analytics -> HtmlService iframe` больше не является целевой UX architecture. Google Sheets пока canonical source; YDB — future remote read backend через shadow/dual-read/compare/canary/strangler.

Обычный warm interaction path:

```text
SPA state
-> IndexedDB / in-memory Local Read Model
-> Web Worker analytics
-> ECharts / UI
```

Warm route/filter/chart обязан работать без mandatory network request и без Google Sheets read. Background sync не блокирует уже готовую verified local revision.

`PRH_LOCAL_READ_MODEL_V1@1.0.0`: immutable generation-scoped derived store. Только `ACTIVE + VERIFIED` manifest выдаётся consumer; partial/failed generation не заменяет current verified generation. Derived local DB можно wipe/rebuild без canonical mutation.

`PRH_LOCAL_ANALYTICS_WORKER_V1@1.0.0`: browser Worker исполняет tracked canonical evaluator, не получает network/storage/financial-write authority и discard-ит stale generation/revision result до UI commit.

`PRH_LOCAL_FIRST_SYNC_V1@1.0.0`: same canonical revision -> `NOOP`; новая revision -> STAGING bootstrap -> verification -> atomic finalize. Remote/network failure сохраняет предыдущую verified generation.

`PRH_LOCAL_FIRST_DELTA_V1@1.0.0`: exact `base_revision`, idempotent replay, target canonical revision verification. Недоказанная/corrupt/excessive delta fail-closed переходит в full rebuild; active generation in-place не мутируется.

`PRH_LOCAL_FINANCE_RUNTIME_V1@1.0.0`: UI формирует canonical queries; Worker возвращает `PRH_ANALYTICS_RESULT_V1` с `FIN-TRUTH-v1` и exact `provenance.input_revision`. UI не получает отдельную financial-formula authority.

`PRH_LOCAL_FIRST_DATA_RUNTIME_CONTRACT_V1@1.0.0`: Operations/Data Quality читают тот же verified snapshot локально. Autofix/canonical write authority отсутствует.

`PRH_LOCAL_PLANNING_RUNTIME_V1@1.0.0`: Budget/Obligations/Liquidity используют separate planning snapshot exact-bound к active finance revision. Budget scalar — только explicit period total; recurrence — только lossless; obligations recurrence не inferred; Liquidity — explicit balance observations only; Cash Flow never balance proxy.

`PRH_LOCAL_FIRST_PERFORMANCE_CONTRACT_V1@1.0.0`: warm route p95 <=100 ms; filter/KPI <=200 ms; chart desktop <=300 ms; representative mobile <=500 ms; Back/Forward <=100 ms; cached first meaningful paint <=800 ms. Cold bootstrap/background sync/server technical health не подменяют warm Product SLA.

## Visualization post-LF boundary

`VIZ-REC-001` должен использовать Local-first canonical read model / approved ChartSpec. Renderer не вычисляет financial truth, не меняет FIN/query/write authority и не добавляет synthetic/demo household series под видом real data.

Renderer plan: Apache ECharts 6.1.0, `dist/echarts.simple.min.js`, pinned supply-chain identity, `LOCAL_ONLY`, external CDN/runtime fetch forbidden, semantic fallback required. Cash Flow должен показывать meaningful multi-period series либо честный insufficient-data state; Expense composition — Top-N + «Прочее»; mobile/tablet/dark mode обязаны оставаться читаемыми.

Новый user-facing VIZ candidate требует fresh exact-SHA rendered evidence, responsive/a11y/interaction tests, Local-first performance/parity evidence, zero mandatory warm network/Sheets reads и fresh Owner Product UAT desktop + physical mobile. Старые performance/UAT evidence не переносятся как Product Ready authority.

## Product lifecycle

Lifecycle: `CODE_COMPLETE -> RUNTIME_INTEGRATED -> REAL_E2E_VERIFIED -> PRODUCT_READY -> DONE`. User-facing `DONE` запрещён без exact-candidate Product Ready evidence. Engineering-only trust bootstrap не может self-attest Product Ready и не требует Owner UAT, если Product behavior не меняется.

Одна конфликтующая writer-транзакция одновременно. Read-only audits допустимы параллельно. GitHub/provider state — source of truth. Не переходить к следующему writer до Main Verification текущего item.

## Current R0 truth

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. `AIENG-001 = DONE -> AIENG-002 = DONE -> AIENG-003 = DONE`; `AIENG-004`, `AIENG-005`, `AIENG-006` также DONE/Main Verification PASS.

Read-only multi-AI review остаётся supplementary evidence без writer authority. Обязательная карта ролей: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`; P0/P1 блокируют продвижение до решения, P2/P3 advisory и не заменяют machine gates.

## Current R1 truth

`FIN-010` — **DONE**, Issue #85 Main Verification PASS. `DATA-010` — **DONE**, Issue #87 Main Verification PASS.

`ARCH-010` — **DONE / Main Verification PASS**, Issue #89. `ARCH-011` — **DONE / Main Verification PASS**, Issue #91. `MIG-010` — **DONE / Main Verification PASS**, Issue #96, private `OWNER_VERIFIED`. `ANL-010` — **DONE / Main Verification PASS**, `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`. `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010` — DONE / Main Verification PASS.

MIG-010 owner-confirmed duplicate-preservation identity = `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Execution policy остаётся `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` не являлся завершением до отдельного private post-write reconciliation PASS. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; AI/CI не может переиспользовать historical authorization. Любая новая irreversible financial mutation требует fresh exact-bound owner authorization. **Current write authority = false**.

`MASTER-G3 / Canonical platform` complete; historical pre-close state: open. Post-R1 lifecycle handoff historically начинается с `DESIGN-020`; этот anchor сохраняется и при Local-first rebaseline.

FIN authority = `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority = `PRH_CANONICAL_TRANSACTION_V1`. Repository authority = `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Real or real-derived household finance data stays private. Public repo содержит только public-safe contracts, independently generated synthetic finance fixtures и privacy-safe machine evidence. `FREE_ONLY` обязателен; automatic paid overage запрещён.

## Reusable engineering foundation

R2 `DESIGN-020`, `VIZ-020`, R2 finance/data contracts, R3 planning/wealth contracts, R7 semantic analytics and R8 Studio/dashboard configuration contracts остаются reusable. Они не получают automatic Product Ready credit и будут подключаться через local-first read path постепенно.

PERF-010 projection, PERF-011 exact-revision cache, PERF-012 single-scan refresh, PERF-013 incremental aggregates и PERF-070 planner/cache сохраняются как validated building blocks для sync/reconciliation/local parity. Они не должны возвращать Google Sheets в warm click path.

## Future YDB boundary

`YC-040` — DONE/Main Verification PASS. `YC-041`/`YC-042` остаются owner/cloud BLOCKED и не получают writer authority автоматически. Target ladder: `GOOGLE_AUTHORITATIVE_LOCAL_FIRST -> YDB_SHADOW_REPLICA -> DUAL_READ_COMPARE -> YDB_READ_CANARY -> YDB_READ_AUTHORITY -> separate future owner-authorized write cutover`. Big-bang cutover запрещён. `paidOverageAllowed=false`; unknown billing state = BLOCKED.

## Delivery and autonomy

Required trusted chain остаётся неизменной:

`PR Validation -> Trusted DEV Deploy -> Trusted Runtime Health -> Product Ready E2E (user-facing only) -> CI-003 autonomous squash merge -> Main Verification`.

Для `work_class=user_facing` перед merge обязательно требуется exact-SHA `PRODUCT_READY_E2E`. Manual merge для обхода Product Ready запрещён.

One-writer rule: one Roadmap ID = one GitHub Issue = one active writer; branch `agent/<ROADMAP-ID>-<slug>`. Active issue lifecycle и exact candidate должны совпадать с machine evidence.

## FinOps / safety

`FINOPS-001` остаётся обязательной cost boundary: required checks не требуют платного provider/API. Unknown/unproven cost fail-closed. Historical `IRREVERSIBLE_ACTION_AUTHORIZED` был exact-bound/non-reusable; любой новый irreversible financial write требует fresh owner authorization.

## Read-only multi-AI review

Read-only multi-AI review имеет `writer_authority=false` и является supplementary evidence. Required roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Review не голосует за merge и не может отменить PR Validation, Trusted Runtime Health, Product Ready или Main Verification.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` классифицирует tracked tests fail-closed. Local-first SPA, IndexedDB, Worker, Sync, Delta, Finance, Data и Performance runtime/packager contracts должны входить в full layered suite. Red-gate bypass запрещён; synthetic-only proof не заменяет authenticated runtime Product UAT для user-facing items.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.5 + live GitHub Issues; `docs/ROADMAP_LOCAL_FIRST_RECOVERY.md` — historical/consolidated reference;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.
