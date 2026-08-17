# PrihRashOnline-v2 — Local-first Recovery Roadmap

Статус: `CONSOLIDATED / HISTORICAL REFERENCE — MASTER-LF-PRODUCT DONE`
Дата: 2026-08-14; консолидировано: 2026-08-16
Основание: owner decision перейти на `Local-first SPA + IndexedDB + Web Worker + background revision/delta synchronization`, затем эволюционно мигрировать remote backend в YDB.

Этот документ был amendment к `docs/ROADMAP.md` v2.4 на период архитектурного восстановления производительности. `MASTER-LF-PRODUCT` доказан `E2E-LF-001` #273 / PR #274 и вошёл в `main@12f764edc34aad32693fc7589ff53ded53740d5d`; с Roadmap v2.5 документ **не задаёт отдельный execution order** и сохраняется как historical/consolidated reference доказанных Local-first invariants, SLO и YDB migration ladder.

`LF0..LF4` — **архитектурные recovery phases**, а не новое значение legacy machine field `wave`. До Roadmap v2.5 текущий `PRH_ROADMAP_TASK_V2` использует protocol-compatible `wave: R2R` для всей P0 Local-first recovery. Будущие YDB items используют `wave: R4` и не становятся READY до `MASTER-LF-PRODUCT`.

## 1. Freeze

`MASTER-LF-PRODUCT` достигнут 2026-08-16. Ниже сохранена историческая freeze-policy, действовавшая **до** этого gate; она больше не является текущим глобальным блокером. Post-LF ограничения задаёт `docs/ROADMAP.md` v2.5 и live Issues.

Исторически до `MASTER-LF-PRODUCT`:

- новые dashboard feature-expansion items не начинали active implementation;
- существующие R9/R10 остаются paused;
- request-per-view Apps Script/HtmlService не расширяется как primary UX architecture;
- разрешены только incident fixes, security/privacy/data-integrity fixes и LF recovery chain.

Historical code/PR не удаляется: полезные FIN/domain/analytics contracts переиспользуются.

## 2. Целевой execution path

```text
Google Sheets canonical source
        |
        | bootstrap / revision / delta
        v
Apps Script Sync Adapter
        |
        v
IndexedDB Local Read Model
        |
        +--> in-memory indexes
        |
        +--> Web Worker Analytics
        |         |
        |         v
        +------> SPA state ----> ECharts/UI
```

Warm user interaction не зависит от Google Sheets/network.

## 3. Recovery phases и machine execution order

| ID | LF phase | protocol wave | Priority | depends_on | work_class | Deliverable | Exit gate |
|---|---|---|---|---|---|---|---|
| ARCH-LF-001 | LF0 | R2R | P0 | GOV-REC-001, DATA-REC-001 | engineering | architecture rebaseline, contracts, SLO, YDB migration ladder | MASTER-LF-0 |
| SPA-LF-001 | LF1 | R2R | P0 | ARCH-LF-001 | user_facing | единый SPA shell + client routing/history + local renderer lifecycle | MASTER-LF-SPA |
| STORE-LF-001 | LF1 | R2R | P0 | ARCH-LF-001 | engineering | IndexedDB private local read-model, schema/version/generation/wipe/recovery | MASTER-LF-STORE |
| WORKER-LF-001 | LF2 | R2R | P0 | STORE-LF-001 | engineering | Web Worker analytics bridge, generation cancellation, stale discard | MASTER-LF-WORKER |
| SYNC-LF-001 | LF2 | R2R | P0 | STORE-LF-001 | engineering | background full bootstrap + exact revision sync | MASTER-LF-SYNC-BASE |
| DELTA-LF-001 | LF2 | R2R | P0 | SYNC-LF-001 | engineering | idempotent revision-bound delta protocol + full rebuild fallback | MASTER-LF-SYNC-DELTA |
| PACK-LF-001 | LF3 bootstrap | R2R | P0 | DELTA-LF-001 | engineering | marker-gated trusted Apps Script browser-runtime packager capability, disabled/output-compatible by default | MASTER-LF-PACKAGER |
| FIN-LF-001 | LF3 | R2R | P0 | SPA-LF-001, WORKER-LF-001, DELTA-LF-001, PACK-LF-001 | user_facing | Home/Expenses/Income/Cash Flow на одном local snapshot/FilterContext | MASTER-LF-FIN |
| DATA-LF-001 | LF3 | R2R | P0 | SPA-LF-001, STORE-LF-001, DELTA-LF-001 | user_facing | Transactions/Data Quality local-first routes | MASTER-LF-DATA |
| PERF-LF-001 | LF3 | R2R | P0 | FIN-LF-001, DATA-LF-001 | user_facing | real-browser performance truth + zero-network warm interaction gate | MASTER-LF-PERF |
| E2E-LF-001 | LF4 | R2R | P0 | PERF-LF-001 | user_facing | authenticated exact-SHA Local-first Product Ready journey | MASTER-LF-PRODUCT |
| YDB-LF-001 | FUTURE | R4 | P1 | E2E-LF-001, YC-040 | engineering | YDB shadow replica + dual-read compare + FREE_ONLY live envelope | MASTER-YDB-SHADOW |
| YDB-LF-002 | FUTURE | R4 | P1 | YDB-LF-001 | engineering | YDB read canary/read authority without write cutover | MASTER-YDB-READ |

## 4. Mandatory architecture gates

### MASTER-LF-0

- ADR/contract versioned;
- FIN-TRUTH/canonical semantics unchanged;
- private payload forbidden in public artifacts;
- explicit local storage/worker/sync boundaries;
- target SLO and zero-network warm contract;
- YDB future ladder recorded.

### MASTER-LF-SPA

- one app shell/document;
- navigation uses client state + History API;
- ECharts/runtime loaded once per app lifecycle;
- Back/Forward does not reload server document;
- visible route/action truth retained;
- old route available as bounded rollback until product cutover.

### MASTER-LF-STORE

- IndexedDB schema/version contract;
- atomic generation switch;
- partial bootstrap never visible;
- corruption/incompatible schema -> rebuild;
- private data wipe control;
- no financial telemetry.

### MASTER-LF-WORKER

- analytics off main thread;
- generation + revision binding;
- stale completion discard;
- worker has no network/storage/financial-write authority;
- FIN/analytics parity with canonical evaluator on synthetic datasets.

### MASTER-LF-SYNC-BASE / DELTA

- same revision -> no-op;
- new revision -> exact-bound update;
- partial/error cannot replace current generation;
- delta base mismatch -> full rebuild;
- idempotent apply;
- local verified data remains readable during network failure;
- remote sync never blocks already-ready SPA.

### MASTER-LF-PACKAGER

- trusted packager capability вводится в `main` **до** product activation;
- marker отсутствует -> capability disabled, legacy artifact shape/bytes сохраняются;
- marker является versioned exact policy, unknown/invalid marker fail-closed;
- candidate не может использовать собственное изменение trusted packager как доказательство своей реконструируемости;
- marker-enabled mode детерминированно exact-bind-ит browser modules + canonical Worker;
- external runtime CDN/loaders запрещены, FREE_ONLY обязателен;
- Trusted DEV Deploy старым trust anchor должен независимо реконструировать bootstrap candidate.

### MASTER-LF-PERF

Product SLO targets:

- warm route switch p95 `<=100 ms`;
- filter/KPI p95 `<=200 ms`;
- normal chart repaint desktop p95 `<=300 ms`;
- normal chart repaint representative mobile p95 `<=500 ms`;
- Back/Forward p95 `<=100 ms`;
- cached first meaningful paint p95 `<=800 ms`.

Critical invariant: warm route/filter/chart journey requires **zero mandatory network requests** and **zero Google Sheets reads**.

Cold bootstrap/sync has independent SLO and may not be substituted for warm interaction measurements.

### MASTER-LF-PRODUCT

- authenticated exact-candidate owner/browser journey;
- desktop + mobile;
- Home, Transactions, Expenses, Income, Cash Flow, Data Quality;
- filters/drill/Back/Forward/loading/degraded sync/recovery;
- private revision provenance and FIN parity;
- agreed SLO PASS;
- sanitized Product Ready evidence;
- old request-per-view path removed from primary navigation only after PASS.

## 5. YDB future migration

YDB is not a prerequisite for Local-first Product Ready.

После `MASTER-LF-PRODUCT`:

1. provision only through explicit `FREE_ONLY` cost gate;
2. shadow replication from Google canonical source;
3. exact revision and query parity;
4. no YDB write ownership;
5. canary read path;
6. YDB remote read authority after sustained parity/performance;
7. write cutover — отдельный future owner-authorized Roadmap item with backup/reconciliation/rollback.

## 6. Post-LF disposition Product Recovery items

- `FIN-REC-001` #224 / PR #243: closed without merge; reference only.
- `PLAN-REC-001`: re-depended на завершённый `E2E-LF-001`; после `GOV-LF-001` Main Verification это единственный explicit `READY`.
- `VIZ-REC-001`: старый request-per-view candidate не получает Product Ready/merge credit; scope сохраняется только как rebaseline после `PLAN-REC-001`, live state `BLOCKED`.
- `E2E-REC-001`: общий producer superseded завершённым `E2E-LF-001`; future user-facing items продолжают требовать собственный Product Ready E2E.
- `STUDIO-REC-001`: re-depended на актуальный visual Product Ready и остаётся `BACKLOG`.
- `YC-041`/`YC-042` и YDB future lane сохраняют external owner/cloud blockers; снятие LF freeze не разрешает cloud provisioning.

## 7. Resolver rule — historical и post-LF handoff

Историческая PACK/FIN trust-bootstrap последовательность завершена и подтверждена Main Verification. Она сохраняется как evidence того, что candidate не может аттестовать собственный trusted packager.

Post-LF resolver authority находится в `docs/ROADMAP.md` v2.5: `GOV-LF-001` — единственный writer до Main Verification; затем явный `BACKLOG -> READY` перевод материализует ровно один следующий item — `PLAN-REC-001`. `VIZ-REC-001`, `STUDIO-REC-001`, R9/R10 и cloud/YDB blockers не стартуют неявно.
