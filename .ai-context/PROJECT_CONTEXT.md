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

`SPA-LF-001` — **current writer / текущий writer**, Issue #249, branch `agent/SPA-LF-001-local-first-spa-shell`. Это единственный active writer. Цель LF1: один постоянно живущий SPA document, client-side History API routing, zero mandatory network warm navigation, responsive shell и bounded rollback на canonical R2. IndexedDB/Worker/sync intentionally не заявляются готовыми в этом item.

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

`YC-040` PoC/cost envelope остаётся foundation. На SPA-LF-001 live YDB resource не создаётся и write ownership не меняется.

Migration ladder:

`GOOGLE_AUTHORITATIVE_LOCAL_FIRST -> YDB_SHADOW_REPLICA -> DUAL_READ_COMPARE -> YDB_READ_CANARY -> YDB_READ_AUTHORITY -> FUTURE_SEPARATE_WRITE_CUTOVER`.

Big-bang cutover запрещён. `paidOverageAllowed=false`; unknown billing state = BLOCKED. YDB не является prerequisite для Local-first Product Ready.
