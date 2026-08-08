# Changelog

Здесь фиксируются значимые продуктовые и инженерные изменения. Старые release entries сохраняются как исторические записи; их workflow/instruction wording **не является текущей operational документацией**. Актуальный delivery contract находится в `docs/RELEASE_PROCESS.md`.

## [R0 platform baseline] — current

### Financial / data truth

- deterministic synthetic finance generator заменил production-derived public fixtures;
- public tree защищён synthetic-only privacy gate;
- canonical financial reconciliation проверяет transaction semantics и не использует legacy totals как golden truth;
- source-to-canonical migration reconciliation проверяет provenance, missing/duplicate/changed/core-field mismatch и idempotency.

### Security / supply chain

- explicit privacy-safe audit/telemetry allowlist и forbidden financial payload policy;
- secret/privacy scans входят в PR Validation;
- Node 24 + lockfile + `npm ci` + exact clasp + immutable GitHub Action pins;
- deployment-specific private clasp config удалён из tracked source.

### Autonomous delivery

- PR Validation отделён от secret-bearing deploy;
- immutable Apps Script candidate связан с exact PR head SHA;
- trusted deploy исполняется default-branch policy и независимо reconstruct/verify'ит candidate;
- authenticated owner-only Execution API health доказывает deployed exact SHA/source-tree;
- CI-003 autonomously squash-merges eligible Roadmap PR и Main Verification переводит linked Issue `IN_PROGRESS -> DONE`;
- старые release snapshot/commit-count/manual marker/post-merge URL-update gates superseded и больше не являются canonical process.

### Recovery / observability / cost

- portable owner-local AES-256-GCM backup + verify + isolated SQLite restore drill доказаны;
- audit journal bounded/rotating, audit persistence failure отделён от transaction correctness;
- `FREE_ONLY` стал runtime + CI invariant с explicit provider safety envelope, conservative usage reservation и 50/70/85/95/100 circuit-breaker policy;
- billable provider allowlist остаётся пустым, пока отдельный Roadmap item не добавит explicit reviewed provider policy.

### Documentation

- DOC-001 переводит README/release/architecture/user/data/backup docs на фактический R0 state и добавляет machine `Documentation truth` gate;
- private runtime locator больше не публикуется/обновляется через README.

---

## Historical releases

### [1.0.0-rc.1] — 2026-08-07

> Historical snapshot. Описанный ниже chat-driven release flow позднее superseded R0 autonomous exact-SHA pipeline и не должен использоваться как инструкция.

#### Added

- единая дизайн-система Web Dashboard и панель быстрых действий;
- Executive-панель 9 KPI первого уровня + 6 второго;
- read-only drill-down к связанным операциям;
- `DashboardUnifiedRefreshService.js` — единый refresh control plane;
- `QualityWorkbenchService.js` — интерактивная очередь качества;
- `IncomeClassificationService.js` — объяснимая классификация, staging в очередь и подтверждаемые правила;
- `IncomeReportService.js` — PDF export существующей аналитики;
- `IncomeSnapshotService.js` — snapshots KPI в существующий `10 Контроль`;
- документация architecture/dashboard/data-model/user-guide;
- GitHub README использовался как entry point Web Dashboard;
- historical release workflow публиковал Web App URL в README после DEV deployment.

#### Changed

- Web Dashboard стал основным пользовательским UX; листовая аналитика остаётся fallback/extended view;
- прогноз разделяет базовые и специальные доходы;
- индекс стабильности синхронизирован с действующей на тот момент моделью `14 Аналитика`;
- меню `ПрихРасхOnline` направляло refresh/PDF/snapshot в новые модули;
- historical release model использовал chat-driven event-only workflow без cron/WSL.

#### Safety at that snapshot

- Web Dashboard не изменял `01 Операции`;
- новые блоки 6–12 не создавали листы;
- Quality Workbench писал только в `11 Предпросмотр`;
- snapshots писались только в `10 Контроль` с readback;
- PROD deployment не выполнялся автоматически.

Historical RC promotion wording superseded. Текущий quality/delivery state определяется Roadmap Issues + exact machine evidence, а не RC label.

### [1.3.0] — Web Executive + Drill-down

- Executive metrics;
- read-only drill-down;
- comparable YoY;
- base-aware forecast;
- privacy-safe synthetic drill-down fixture.

### [1.2.0] — Responsive visual gate

- default-period correction;
- responsive desktop/laptop/mobile checks;
- 10-view navigation checks;
- context panels use full width when adjacent visualizations are hidden.
