# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys, private scope assignments и owner-private payload запрещены.

## LANG-RU

Русский язык — единственный нормативный язык human-facing документации, GitHub metadata и AI instructions. Machine identifiers, API/schema fields, library/protocol/standard names и команды сохраняются без искусственного перевода. Параллельный English source of truth запрещён.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — Executable GitHub Roadmap v2.4.
3. `/docs/ROADMAP_LOCAL_FIRST_RECOVERY.md` — approved temporary Local-first recovery amendment LF0..LF4 до следующей консолидации Roadmap.
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

`DELTA-LF-001` — **DONE_ENGINEERING / Main Verification PASS**, Issue #257, PR #258, merge `0756252b5c0619bf53e9e1b24f235fb4fa28b2f6`; idempotent exact-base-revision delta, target revision recomputation, corrupt/race fallback и full bootstrap recovery PASS.

`FIN-LF-001` — **BLOCKED / CODE_COMPLETE**, Issue #259, PR #260 Draft. Candidate `e3ac0fe4a3544349d169822f2b69cb03dc60b247` дважды прошёл PR Validation (#862/#863), включая real Chromium FIN runtime и desktop/mobile exact-candidate UI, но Trusted DEV Deploy #829 остановился до Apps Script push на `CANDIDATE_VERIFY_FAILED`: candidate одновременно менял trusted packager и artifact format.

`PACK-LF-001` — **current writer / текущий writer**, Issue #261, branch `agent/PACK-LF-001-trusted-packager-bootstrap`. Это единственный active writer. Цель: ввести marker-gated Local-first browser-runtime packager capability в trusted `main` **выключенной по умолчанию и output-compatible**, чтобы следующий FIN candidate мог включить её отдельным marker и быть независимо реконструирован trust anchor из `main`.

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

`PRH_LOCAL_READ_MODEL_V1@1.0.0` материализует storage boundary: `meta`, `transactions`, `dimensions`, `aggregates`, `sync_journal`; data records generation-scoped. Только `ACTIVE + VERIFIED` manifest может быть выдан consumer. Partial/failed generation не заменяет текущую verified generation; incompatible/corrupt state возвращает `REBUILD_REQUIRED`. Derived local database допускает explicit wipe/rebuild без canonical mutation.

`PRH_LOCAL_ANALYTICS_WORKER_V1@1.0.0` не создаёт вторую финансовую истину: browser worker bundle детерминированно включает tracked canonical evaluator и его dependency graph. Узкий browser crypto shim поддерживает только SHA-256 через tracked `lib/crypto/sha256.js`; любой другой external/builtin require fail-closed. Каждая analytics query exact-bound к generation/revision и epoch; binding проверяется до и после evaluate. Cancellation или revision switch инвалидируют queued work, а stale completion не содержит analytics payload.

`PRH_LOCAL_FIRST_SYNC_V1@1.0.0` добавляет только remote-read/background update boundary. Apps Script adapter переиспользует existing `prhR2DataCreateSnapshot_()` и canonical repository revision; отдельной mapping/FIN authority нет. Same revision -> `NOOP`; новая revision -> STAGING full bootstrap -> STORE-LF count verification -> atomic finalize. Network/source/chunk error до finalize не заменяет предыдущую `ACTIVE + VERIFIED` generation. `readLocal()` не вызывает transport.

`PRH_LOCAL_FIRST_DELTA_V1@1.0.0` развивает sync только как network optimization: request inventory строится из `ACTIVE + VERIFIED` generation и exact-bound к `base_revision`; server сравнивает SHA-256 record etags с текущим canonical snapshot. Delta никогда не мутирует active generation in-place — target материализуется как новая STAGING generation. До finalize browser пересчитывает canonical `PRH_TRANSACTION_REPOSITORY_V1` revision по target transactions и требует exact equality `target_revision`. Base mismatch, invalid/corrupt delta, excessive delta или target mismatch переходят в уже проверенный SYNC-LF-001 full bootstrap fallback.

`PRH_LOCAL_FIRST_BROWSER_RUNTIME_MARKER_CONTRACT_V1@1.0.0` задаёт trust-bootstrap boundary для deployable Local-first browser runtime. Marker `local-first-browser-runtime.json` absent -> capability disabled; deploy artifact обязан оставаться legacy-compatible. Marker имеет закрытую schema/module/policy allow-list; unknown marker fail-closed. Candidate packager self-attestation запрещена: trusted reconstruction использует только packager из `main`. PACK-LF-001 не включает root marker и не активирует product runtime.

Target Product SLO являются будущими acceptance targets, не текущей telemetry: warm route p95 <=100 ms; filter/KPI <=200 ms; ordinary chart repaint desktop <=300 ms; representative mobile <=500 ms; Back/Forward <=100 ms; cached first meaningful paint <=800 ms. Server technical health latency и cold bootstrap timing не подменяют эти метрики.

## Product Recovery handoff

`R2R` forensic/product recovery и `MASTER-GUX` остаются исходной причиной architectural rebaseline: большое число engineering DONE не доказало достаточную product responsiveness/integration. Local-first recovery теперь имеет приоритет над дальнейшим feature expansion. R9/R10 frozen; old PLAN/E2E/STUDIO recovery scopes re-depend после LF architecture/product gates.

Product lifecycle неизменен: `CODE_COMPLETE -> RUNTIME_INTEGRATED -> REAL_E2E_VERIFIED -> PRODUCT_READY -> DONE`. User-facing `DONE` требует exact-candidate Product Ready evidence; architecture docs и synthetic tests не являются owner UAT.

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

`YC-040` PoC/cost envelope остаётся foundation. На PACK-LF-001 live YDB resource не создаётся и write ownership не меняется.

Migration ladder:

`GOOGLE_AUTHORITATIVE_LOCAL_FIRST -> YDB_SHADOW_REPLICA -> DUAL_READ_COMPARE -> YDB_READ_CANARY -> YDB_READ_AUTHORITY -> FUTURE_SEPARATE_WRITE_CUTOVER`.

Big-bang cutover запрещён. `paidOverageAllowed=false`; unknown billing state = BLOCKED. YDB не является prerequisite для Local-first Product Ready.

## Delivery and autonomy

Required trusted chain остаётся неизменной:

`PR Validation -> Trusted DEV Deploy -> Trusted Runtime Health -> CI-003 autonomous squash merge -> Main Verification`.

Для `work_class=user_facing` перед merge дополнительно требуется exact-SHA `PRODUCT_READY_E2E`. Manual merge для обхода Product Ready запрещён.

One-writer rule: one Roadmap ID = one GitHub Issue = one active writer; branch `agent/<ROADMAP-ID>-<slug>`. Active issue lifecycle и exact candidate должны совпадать с machine evidence.

## FinOps / safety

`FINOPS-001` остаётся обязательной cost boundary: required checks не требуют платного provider/API. Unknown/unproven cost fail-closed. Historical `IRREVERSIBLE_ACTION_AUTHORIZED` был exact-bound/non-reusable; любой новый irreversible financial write требует fresh owner authorization.

## Read-only multi-AI review

Read-only multi-AI review имеет `writer_authority=false` и является supplementary evidence. Required roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Review не голосует за merge и не может отменить PR Validation, Trusted Runtime Health, Product Ready или Main Verification.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` классифицирует tracked tests fail-closed. Local-first SPA, IndexedDB, Worker, Sync, Delta и packager bootstrap contracts должны входить в full layered suite. Red-gate bypass запрещён; synthetic-only proof не заменяет authenticated runtime Product UAT для user-facing items.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.4 + `docs/ROADMAP_LOCAL_FIRST_RECOVERY.md` + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.
