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

Machine delivery chain: `PR Validation -> Trusted DEV Deploy -> Trusted Runtime Health -> CI-003 autonomous squash merge -> Main Verification`. Для `work_class=user_facing` перед merge дополнительно обязателен Product Ready E2E exact candidate. Красный этап не обходится.

## Текущая инженерная задача

`MASTER-LF-PRODUCT` завершён. `E2E-LF-001` Issue #273 / PR #274 — DONE / Main Verification PASS; Local-first Product Ready desktop+mobile доказан.

`PLAN-REC-001` Issue #225 / PR #277 — **DONE / Main Verification PASS**, merge `d69f13f4842726ef893005fa1ebfbee1dc9e57bd`; Owner Product UAT v259 и Product Ready E2E PASS.

`PACK-VIZ-LF-001` Issue #280 / PR #281 — **DONE_ENGINEERING / Main Verification PASS**, merge `5306d0e9593d0e5398b69c1fb03bf31bd50a8eda`.

`PACK-VIZ-LF-002` Issue #283 / PR #284 — **DONE_ENGINEERING / Main Verification PASS**, merge `00659d0e423e4baf222b056e732b576887200891`.

`VIZ-REC-001` Issue #226 / PR #285 — **DONE / Main Verification PASS**, candidate `d5865247506d59c91b33ca3265080e7b60a79dd1`, merge `011bb5e5a42f3ccab4d1e82f323bd304b2c89783`; fresh Owner Product UAT + Product Ready evidence PASS.

`STUDIO-REC-001` Issue #228 / PR #286 — **DONE / Main Verification PASS**, candidate `92c4139e552428a1726640487834952d523dab64`, Apps Script v263, merge `e62b3283927ffe0d564ec7f10d2671760a03ceec`; Owner Product UAT v263, Product Ready E2E и `MASTER-GSTUDIO / STUDIO-READY` PASS.

`ADWF-ADOPT-001` — **DONE / provider-verified**, Issue #287. PR #289 + #291 merged; canonical connected baseline `main@cef64cfb0c7e082b90bb096f0829e5fa0b1906ae`. Installation/gates/fresh-session verification PASS; `CONSUMER_NATIVE`; `ADWF Main` delegates to native `verify`; ADWF Control runs read-only `consumer-observer` and skips privileged `trusted-controller`; upgrade dry-run `READY`, blockers `[]`. Product/runtime/data/FIN-TRUTH mutation отсутствовала.

`ANL-091` — **DONE_ENGINEERING / Main Verification PASS**, Issue #292, PR #300, candidate `4e4c0984518a1acf84542fc62252045697748b95`, merge `59480686dd92fd295d42c887c9003f6882758ff6`; writer authority завершена.

`PERF-090` — **DONE_ENGINEERING / Main Verification PASS**, Issue #301, PR #302, candidate `978c960458d2fc62c6303c63a7ce57d6da22c341`, merge `2f9753d609b7ef05ec1993f7e36628b60de545db`; writer authority завершена.

`RISK-030` — **DONE_ENGINEERING / Main Verification PASS**, Issue #303, PR #304, candidate `bf80ff11049da740d6ff9107a46393f28f7797a3`, merge `da178555f2166fdb70071405e4c1422659ae7593`; writer authority завершена.

`XRAY-090` — **DONE_ENGINEERING / Main Verification PASS**, Issue #78, PR #305, candidate `3d12491cfac594bcbff9848e052c806d4a6a1877`, merge `d8307558a3439157b8e4714a7b6df8100dc215f9`; writer authority завершена.

`DASH-090` — **IN_PROGRESS / current writer / текущий writer**, Issue #306, branch `agent/DASH-090-expert-dashboard-gallery`, lease `cecfe2cb-8ad8-4ac3-9c6d-8a4f9da9cc39`, trust anchor `main@d8307558a3439157b8e4714a7b6df8100dc215f9`. Текущая цель: immutable Expert dashboard gallery поверх DASH-084 и canonical ANL/VIZ/XRAY capabilities без второго storage/query/FIN engine; user-facing Product Ready evidence обязателен до DONE.

PrihRash управляется ADWF как `CONSUMER_NATIVE`, но product authority остаётся у PrihRash: canonical Roadmap — `docs/ROADMAP.md`, lifecycle — live GitHub Issues, native provider gates — `validate` / `verify` / `probe`. ADWF self-host Roadmap/control mutation authority не переносится в consumer.

`ANL-090` — **DONE_ENGINEERING / Main Verification PASS**, Issue #217, PR #288; canonical result включён в `main@19dc9f653131715233da91a28598e012af64f36f`. Historical draft PR #218 / candidate `73d747fea160826ec1bea67b6552c21414865d03` остаётся historical engineering capital без current authority.

## Local-first architecture boundary

Стратегический user-facing read path — **Local-first SPA + IndexedDB + Web Worker + background revision/delta synchronization**. Request-per-view `Apps Script -> Google Sheets -> server analytics -> HtmlService iframe` не является целевой UX architecture. Google Sheets пока canonical source; YDB — future remote read backend через shadow/dual-read/compare/canary/strangler.

Обычный warm interaction path:

```text
SPA state
-> IndexedDB / in-memory Local Read Model
-> Web Worker analytics
-> ECharts / UI
```

Warm route/filter/chart обязан работать без mandatory network request и без Google Sheets read. Background sync не блокирует уже готовую verified local revision.

`PRH_LOCAL_READ_MODEL_V1@1.0.0`: immutable generation-scoped derived store; только `ACTIVE + VERIFIED` manifest выдаётся consumer.

`PRH_LOCAL_ANALYTICS_WORKER_V1@1.0.0`: browser Worker исполняет tracked canonical evaluator без network/storage/financial-write authority.

`PRH_LOCAL_FIRST_SYNC_V1@1.0.0`: same revision -> `NOOP`; новая revision -> STAGING bootstrap -> verification -> atomic finalize.

`PRH_LOCAL_FIRST_DELTA_V1@1.0.0`: exact `base_revision`, idempotent replay, target revision verification; недоказанная/corrupt/excessive delta переходит в full rebuild.

`PRH_LOCAL_FINANCE_RUNTIME_V1@1.0.0`: UI формирует canonical queries; Worker возвращает `PRH_ANALYTICS_RESULT_V1` с `FIN-TRUTH-v1` и exact `provenance.input_revision`; UI не получает financial-formula authority.

`PRH_LOCAL_FIRST_DATA_RUNTIME_CONTRACT_V1@1.0.0`: Data/Operations читают тот же verified snapshot локально; canonical write authority отсутствует.

`PRH_LOCAL_PLANNING_RUNTIME_V1@1.0.0`: Budget/Obligations/Liquidity используют separate planning snapshot exact-bound к active finance revision; Cash Flow не является balance proxy.

`PRH_LOCAL_FIRST_PERFORMANCE_CONTRACT_V1@1.0.0`: warm route p95 <=100 ms; filter/KPI <=200 ms; chart desktop <=300 ms; representative mobile <=500 ms; Back/Forward <=100 ms; cached first meaningful paint <=800 ms.

## Visualization/Studio boundary

`VIZ-REC-001` завершён на Local-first canonical read model / display-only ChartSpec. Renderer не вычисляет financial truth и не меняет FIN/query/write authority. Renderer: pinned local Apache ECharts 6.1.0, external CDN/runtime fetch forbidden, semantic fallback required.

`STUDIO-REC-001` завершил working private bound query -> widget -> save/reload -> drill product. Supported product scope использует canonical Local-first runtime; UNBOUND widgets denied. Save/reload хранит configuration + query identity без financial values/private IDs; private drill IDs ephemeral.

Любой новый user-facing visualization/Studio scope требует fresh exact-SHA rendered/runtime evidence и fresh Owner Product UAT. Завершённые UAT нельзя переносить на новый candidate.

## Product lifecycle

Lifecycle user-facing: `CODE_COMPLETE -> RUNTIME_INTEGRATED -> REAL_E2E_VERIFIED -> PRODUCT_READY -> DONE`. Engineering: `IN_PROGRESS -> CODE_COMPLETE -> DONE_ENGINEERING` через trusted exact-head chain.

Одна конфликтующая writer-транзакция одновременно. Read-only audits допустимы параллельно. GitHub/provider state — source of truth. Не переходить к следующему writer до Main Verification текущего item.

## Current R0 truth

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. `AIENG-001 = DONE -> AIENG-002 = DONE -> AIENG-003 = DONE`; `AIENG-004`, `AIENG-005`, `AIENG-006` также DONE/Main Verification PASS.

## Current R1 truth

`FIN-010` — **DONE / Main Verification PASS**, Issue #85.
`DATA-010` — **DONE / Main Verification PASS**, Issue #87.
`ARCH-010` — **DONE / Main Verification PASS**, Issue #89.
`ARCH-011` — **DONE / Main Verification PASS**, Issue #91.
`MIG-010` — **DONE / Main Verification PASS**, Issue #96; private stage `OWNER_VERIFIED`, owner-private full-history reconciliation PASS.
`MIG010_EXECUTION_POLICY_V1@1.0.0` — canonical MIG-010 execution policy; finalize boundary сохраняет `FINALIZED_PENDING_RECONCILIATION` / post-write reconciliation, а generic Google repository write остаётся fail-closed с `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.
`ANL-010`, `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010` — **DONE / Main Verification PASS**. `ANL-010` authority = `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`.

Post-R1 lifecycle handoff historically начинается с `DESIGN-020`; этот anchor сохраняется после Local-first/Product Recovery rebaseline и не означает возврат к request-per-view architecture.

MIG-010 owner-confirmed duplicate-preservation identity = `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Historical `IRREVERSIBLE_ACTION_AUTHORIZED` был exact-bound/non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; AI/CI cannot reuse it. Любой новый irreversible financial write требует fresh owner authorization. **Current write authority = false**.

`MASTER-G3 / Canonical platform` — complete; historical pre-close state: open.

FIN authority = `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority = `PRH_CANONICAL_TRANSACTION_V1`. Repository authority = `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Real or real-derived household finance data stays private. Public repo содержит только public-safe contracts, independently generated synthetic finance fixtures и privacy-safe machine evidence. `FREE_ONLY` обязателен.

## Reusable engineering foundation

R2 finance/data/design/visual contracts, R3 planning/wealth contracts, R7 semantic analytics, VIZ-090 и R8 Studio/dashboard configuration contracts остаются reusable engineering capital. Product credit даётся только current exact-SHA evidence.

После `MASTER-GSTUDIO` R9 разрешён только отдельным dependency-ready resolver. `ADWF-ADOPT-001`, `ANL-090`, `ANL-091`, `PERF-090`, `RISK-030` и `XRAY-090` уже завершены/Main Verification PASS. Текущий single writer — `DASH-090` #306; другие product/R9 writers не получают authority параллельно до полного user-facing lifecycle.

## Future YDB boundary

`YC-040` — DONE/Main Verification PASS. `YC-041`/`YC-042` остаются owner/cloud BLOCKED. Target ladder: `GOOGLE_AUTHORITATIVE_LOCAL_FIRST -> YDB_SHADOW_REPLICA -> DUAL_READ_COMPARE -> YDB_READ_CANARY -> YDB_READ_AUTHORITY -> separate future owner-authorized write cutover`. Big-bang cutover запрещён. `paidOverageAllowed=false`; unknown billing state = BLOCKED.

## Delivery and autonomy

Required trusted chain:

`PR Validation -> Trusted DEV Deploy -> Trusted Runtime Health -> Product Ready E2E (user-facing only) -> CI-003 autonomous squash merge -> Main Verification`.

One-writer rule: one Roadmap ID = one GitHub Issue = one active writer; branch `agent/<ROADMAP-ID>-<slug>`. Active issue lifecycle и exact candidate должны совпадать с machine evidence.

## FinOps / safety

`FINOPS-001` остаётся обязательной cost boundary: required checks не требуют paid provider/API. Unknown/unproven cost fail-closed. Любой irreversible financial write требует fresh owner authorization.

## Read-only multi-AI review

Read-only multi-AI review имеет `writer_authority=false`. Required roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Review не может отменить machine gates.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` классифицирует tracked tests fail-closed. Новые ANL-090 contract cases выполняются внутри существующего `analytics_query_edge_contract_test.js` PURE_DOMAIN_APPLICATION gate; отдельная ослабляющая test-classification authority не добавляется. Red-gate bypass запрещён.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.5 + live GitHub Issues; `docs/ROADMAP_LOCAL_FIRST_RECOVERY.md` — historical/consolidated reference;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.
