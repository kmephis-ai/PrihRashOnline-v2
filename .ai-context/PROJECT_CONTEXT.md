# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys, private scope assignments и owner-private payload запрещены.

## LANG-RU

Русский язык — единственный нормативный язык human-facing документации, GitHub metadata и AI instructions. Machine identifiers, API/schema fields, library/protocol/standard names и команды сохраняются без искусственного перевода. Параллельный English source of truth запрещён.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — Executable GitHub Roadmap v2.5, post-LF consolidated authority.
3. `/docs/ROADMAP_LOCAL_FIRST_RECOVERY.md` — historical/consolidated Local-first LF0..LF4 reference; отдельной execution authority больше не имеет.
4. GitHub Issues — live lifecycle/status.
5. Exact-SHA code/tests/workflows и machine evidence.
6. Versioned contracts + architecture/ADR/operations docs.

Security/privacy/cost/irreversible boundaries всегда выше Roadmap amendment. Красный machine gate нельзя отменить human summary.

## Текущая инженерная задача

`ARCH-LF-001` — **DONE_ENGINEERING / Main Verification PASS**, Issue #245, PR #248, merge `329e5c5c3b5be8286f0c9a397de96f04ca902963`.

`SPA-LF-001` — **DONE / Main Verification PASS**, Issue #249, PR #250, merge `3c69cb508153b0fc5b953376a614f0031fadc38c`; owner UAT v221 PASS, warm route p95 `29 ms`, `10` переходов, сеть `0`.

`STORE-LF-001` — **DONE_ENGINEERING / Main Verification PASS**, Issue #251, PR #252, merge `865cd076c4a066ec7f8b789f1030e8c129d91144`; `PRH_LOCAL_READ_MODEL_V1@1.0.0`, real Chromium IndexedDB generation/recovery/wipe and zero-network local operations PASS.

`WORKER-LF-001` — **DONE_ENGINEERING / Main Verification PASS**, Issue #253, PR #254, merge `e206a129acb0136f8c3173ae6e55853c4c4401be`; `PRH_LOCAL_ANALYTICS_WORKER_V1@1.0.0`, real Chromium Worker canonical evaluator parity/cancel/stale/zero-network PASS.

`SYNC-LF-001` — **DONE_ENGINEERING / Main Verification PASS**, Issue #255, PR #256, candidate `05f161074a78428a6a96e2df66fde4ef7e0bd70e`, merge `587dc6bd8b7e48d915cc7aef3d31c35802650cd7`; Apps Script version 224, full bootstrap/NOOP/degraded preservation/atomic switch и real Chromium zero-network local read PASS.

`DELTA-LF-001` — **DONE_ENGINEERING / Main Verification PASS**, Issue #257, PR #258, candidate `5ed78c45eb77dbb008014f16a01288fa2e1cde91`, merge `0756252b5c0619bf53e9e1b24f235fb4fa28b2f6`; Apps Script version 225, exact-base delta/replay/target-revision verification, adversarial base-race fallback и real Chromium zero-network local read PASS.

`FIN-LF-001` — **DONE / Main Verification PASS**, Issue #259, PR #260, candidate `0c58714df70e6065d6ec409cdc3bae991a85df36`, merge `c20258cd659f0e4a82c050b91eb04cc33c8e996b`; exact-candidate Owner Product UAT PASS, warm p95 `32 ms`, `10` переходов, сеть `0`.

`DATA-LF-001` — **DONE / Main Verification PASS**, Issue #263, PR #264, merge `326ddad4d5c41d684b1cec9e4a8a97bc680c5ed7`; exact-candidate Owner Product UAT PASS, warm p95 `43.40 ms`, `10` переходов, прогрев `4`, сеть `0`, Back/Forward PASS, loading/error PASS.

`PERF-LF-001` — **DONE / Main Verification PASS**, Issue #265, PR #266, candidate `7a41884cb1a812796bc2d473aaf0b86991dfcf65`, Apps Script v252, merge `bd181178c241418d0c22973d0d59ce2fdefb6195`; Owner UAT #10 PASS по неизменённым SLO, включая Back/Forward p95 `54.30 ms` и cached FMP `473.70 ms`, при zero mandatory network / Google Sheets reads.

`E2E-LF-001` — **DONE / Main Verification PASS**, Issue #273, PR #274, merge `12f764edc34aad32693fc7589ff53ded53740d5d`; `MASTER-LF-PRODUCT` доказан на desktop + mobile, Product Ready E2E PASS, retained SLO/zero-network/FIN-TRUTH сохранены.

`GOV-LF-001` — **DONE / Main Verification PASS**, Issue #275, PR #276, merge `d57d0b3554737b9a57bde5d55f13c13e88cbcbc4`. Roadmap v2.5 post-LF consolidation завершена.

`PLAN-REC-001` — **IN_PROGRESS / current writer**, Issue #225, branch `agent/PLAN-REC-001-planning-local-first`. Owner authority для Budget/Obligations/Liquidity утверждена. Реализация обязана использовать отдельный Local-first planning snapshot/cache, exact canonical revision binding, existing BUD-020/OBL-020/BAL-030/FIN-TRUTH contracts, zero warm planning network/Sheets reads и no financial write; Cash Flow запрещён как balance proxy.

Owner decision 2026-08-14: PrihRashOnline переходит на **Local-first SPA + IndexedDB + Web Worker + background revision/delta synchronization**. Request-per-view `Apps Script -> Google Sheets -> server analytics -> HtmlService iframe` больше не считается целевой UX architecture. Google Sheets остаётся canonical source на переходном этапе; YDB — future remote read backend через shadow/dual-read/compare/canary/strangler.

`FIN-REC-001` #224 / PR #243 закрыт без merge как superseded implementation reference. Финансовые правила, FIN-TRUTH, exact revision, filters, repository and zero-write contracts переиспользуются, но старый iframe/request-per-view interaction model не развивается.

## Local-first architecture boundary

После verified bootstrap обычный warm interaction path:

```text
SPA state
-> IndexedDB / in-memory Local Read Model
-> Web Worker analytics
-> ECharts / UI
```

Warm route/filter/chart обязан работать без mandatory network request и без Google Sheets read. Background sync не блокирует уже готовую verified local revision.

`PRH_LOCAL_FIRST_RUNTIME_V1@1.0.0` не является financial truth. Local Read Model read-only, привязан к exact canonical revision и immutable generation. Partial bootstrap не становится visible current state. Delta apply требует exact base revision и idempotency; если chain недоказана, выполняется full rebuild. Worker не получает network/storage/financial-write authority; stale generation/revision result отбрасывается до UI commit.

`PRH_LOCAL_READ_MODEL_V1@1.0.0` материализует storage boundary: `meta`, `transactions`, `dimensions`, `aggregates`, `sync_journal`; data records generation-scoped. Только `ACTIVE + VERIFIED` manifest может быть выдан consumer. Browser API представляет его как `status=READY`. Partial/failed generation не заменяет текущую verified generation; incompatible/corrupt state возвращает `REBUILD_REQUIRED`. Derived local database допускает explicit wipe/rebuild без canonical mutation.

`PRH_LOCAL_ANALYTICS_WORKER_V1@1.0.0` не создаёт вторую финансовую истину: browser worker bundle детерминированно включает tracked canonical evaluator и его dependency graph. Узкий browser crypto shim поддерживает только SHA-256 через tracked `lib/crypto/sha256.js`; любой другой external/builtin require fail-closed. Каждая analytics query exact-bound к generation/revision и epoch; binding проверяется до и после evaluate. Cancellation или revision switch инвалидируют queued work, а stale completion не содержит analytics payload.

`PRH_LOCAL_FIRST_SYNC_V1@1.0.0` добавляет только remote-read/background update boundary. Apps Script adapter переиспользует existing `prhR2DataCreateSnapshot_()` и canonical repository revision; отдельной mapping/FIN authority нет. Same revision -> `NOOP`; новая revision -> STAGING full bootstrap -> STORE-LF count verification -> atomic finalize. Network/source/chunk error до finalize не заменяет предыдущую `ACTIVE + VERIFIED` generation. `readLocal()` не вызывает transport.

`PRH_LOCAL_FIRST_DELTA_V1@1.0.0` развивает sync только как network optimization: request inventory строится из `ACTIVE + VERIFIED` generation и exact-bound к `base_revision`; server сравнивает SHA-256 record etags с текущим canonical snapshot. Delta никогда не мутирует active generation in-place — target материализуется как новая STAGING generation. До finalize browser пересчитывает canonical `PRH_TRANSACTION_REPOSITORY_V1` revision по target transactions и требует exact equality `target_revision`. Base mismatch, invalid/corrupt delta, excessive delta или target mismatch переходят в уже проверенный SYNC-LF-001 full bootstrap fallback.

`PRH_LOCAL_FINANCE_RUNTIME_V1@1.0.0` не создаёт UI financial authority. Четыре financial routes используют один verified snapshot и session-shared `PRH_LOCAL_FINANCE_FILTER_CONTEXT_V1`. UI строит только canonical analytics queries, Worker исполняет тот же `evaluateAnalytics()`, а render принимает только `PRH_ANALYTICS_RESULT_V1` с `FIN-TRUTH-v1` и `provenance.input_revision == active revision`. Route/filter epoch и generation/revision binding запрещают stale UI commit. Trusted Apps Script candidate детерминированно встраивает tracked STORE/SYNC/DELTA/FIN/PERF browser modules и generated canonical Worker bundle в `LocalFirstSpaWebApp.html`; repository-only `pwa/` code без deploy linkage больше не считается product implementation.

`PRH_LOCAL_FIRST_DATA_RUNTIME_CONTRACT_V1@1.0.0` использует тот же `PRH_LOCAL_READ_MODEL_V1` snapshot для `transactions` и `data-quality`. Transaction filters, 20-row pagination и detail выполняются локально; detail не может выйти за текущий filter set. History хранит только безопасные query keys/IDs, без amount/description/counterparty payload. Data Quality read-only проверяет referential consistency transaction -> category/account/member dimensions и группы совпадающих source fingerprints. Эти сигналы не заменяют canonical validation и не получают autofix/write authority. Async render epoch запрещает commit результата старой generation после нового route/revision render.

`PRH_LOCAL_PLANNING_RUNTIME_V1@1.0.0` добавляет owner-approved Budget/Obligations/Liquidity поверх Local-first core: planning snapshot имеет отдельный `planning_revision`, но принимается только при exact совпадении `canonical_revision` с active finance revision. `03 Бюджеты/Базовый` использует только явную общую строку периода; `04 Регулярные` — только lossless recurrence; `05 Обязательства` не получает inferred recurrence; Liquidity требует явных `06 Баланс` observations. Warm route query выполняется через existing canonical Worker без mandatory network/Sheets read.

`PRH_LOCAL_FIRST_PERFORMANCE_CONTRACT_V1@1.0.0` задаёт retained performance contract, доказанный в завершённых `PERF-LF-001` и `E2E-LF-001`: warm route p95 <=100 ms; filter/KPI <=200 ms; ordinary chart repaint desktop <=300 ms; representative mobile <=500 ms; Back/Forward <=100 ms; cached first meaningful paint <=800 ms. Monotonic `performance.now()` и nearest-rank p95 измеряют реальные browser boundaries. Cold bootstrap, background sync и server technical health latency не подменяют warm Product SLO; insufficient/invalid samples fail-closed.

## Product Recovery handoff

`R2R` forensic/product recovery остаётся исходной причиной architectural rebaseline: большое число engineering DONE не доказало working product. Local-first recovery `LF0..LF4` теперь завершена `MASTER-LF-PRODUCT`. Временный global LF freeze снят; при этом R9/R10 остаются gated до `MASTER-GSTUDIO`. Post-LF disposition: `PLAN-REC-001` re-depend на `E2E-LF-001` и становится единственным следующим READY после GOV-LF Main Verification; `VIZ-REC-001` rebaseline/blocked без old-candidate credit; `E2E-REC-001` superseded; `STUDIO-REC-001` re-depended/backlog.

Product lifecycle неизменен: `CODE_COMPLETE -> RUNTIME_INTEGRATED -> REAL_E2E_VERIFIED -> PRODUCT_READY -> DONE`. User-facing `DONE` требует exact-candidate Product Ready evidence; architecture docs и synthetic tests не являются owner UAT. Завершённый `E2E-LF-001` прошёл и machine Chromium evidence, и owner `GENERIC_V1` Product UAT desktop + mobile; это historical trust anchor и не отменяет обязательный fresh Product Ready E2E для будущих user-facing items.

## Current R0 truth

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. Исполнимая AI engineering цепочка: `AIENG-001 = DONE` -> `AIENG-002 = DONE` -> `AIENG-003 = DONE`; AIENG-004/005/006 также DONE/Main Verification PASS.

Real or real-derived household finance data stays private. Public repo содержит только public-safe contracts, independently generated synthetic finance fixtures и privacy-safe machine evidence. `FREE_ONLY` обязателен; automatic paid overage запрещён.

## Current R1 truth

`MASTER-G3 / Canonical platform` — complete; historical pre-close state: open.

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Main Verification PASS, Issue #89.
- `ARCH-011` — **DONE**, Main Verification PASS, Issue #91.
- `MIG-010` — **DONE**, Main Verification PASS, Issue #96; private stage `OWNER_VERIFIED`, owner-private full-history reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS; `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`.
- `TEST-010`, `OBS-010`, `PERF-010`, `PERF-011`, `PERF-012`, `PERF-013`, `PERF-014`, `DOC-010` — **DONE** / Main Verification PASS.

FIN authority = `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority = `PRH_CANONICAL_TRANSACTION_V1`. Repository authority = `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write остаётся fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Post-R1 lifecycle handoff historically начинается с `DESIGN-020`; этот anchor сохраняется и при Local-first rebaseline.

MIG-010 owner-confirmed duplicate-preservation identity = `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Execution policy остаётся `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` не являлся завершением до отдельного private post-write reconciliation PASS. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; AI/CI не может переиспользовать historical authorization. Любая новая irreversible financial mutation требует fresh exact-bound owner authorization.

## Reusable engineering foundation

R2 `DESIGN-020`, `VIZ-020`, R2 finance/data contracts, R3 planning/wealth contracts, R7 semantic analytics and R8 Studio/dashboard configuration contracts остаются reusable. Они не получают automatic Product Ready credit и будут подключаться через local-first read path постепенно.

PERF-010 projection, PERF-011 exact-revision cache, PERF-012 single-scan refresh, PERF-013 incremental aggregates и PERF-070 planner/cache сохраняются как validated building blocks для sync/reconciliation/local parity. Они не должны возвращать Google Sheets в warm click path.

## Future YDB boundary

`YC-040` PoC/cost envelope остаётся foundation. Завершение `E2E-LF-001` не создало live YDB resource и не изменило write ownership; `YC-041`/`YC-042` остаются external-owner BLOCKED.

Migration ladder:

`GOOGLE_AUTHORITATIVE_LOCAL_FIRST -> YDB_SHADOW_REPLICA -> DUAL_READ_COMPARE -> YDB_READ_CANARY -> YDB_READ_AUTHORITY -> FUTURE_SEPARATE_WRITE_CUTOVER`.

Big-bang cutover запрещён. `paidOverageAllowed=false`; unknown billing state = BLOCKED. YDB не является prerequisite для Local-first Product Ready.

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