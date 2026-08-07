# Changelog

Все значимые изменения Income Dashboard фиксируются здесь.

## [1.0.0-rc.1] — 2026-08-07

### Added

- единая дизайн-система Web Dashboard и панель быстрых действий;
- Executive-панель 9 KPI первого уровня + 6 второго;
- read-only drill-down к связанным операциям;
- `DashboardUnifiedRefreshService.js` — единый refresh control plane;
- `QualityWorkbenchService.js` — интерактивная очередь качества;
- `IncomeClassificationService.js` — объяснимая классификация, staging в очередь и подтверждаемые правила;
- `IncomeReportService.js` — PDF export существующей аналитики;
- `IncomeSnapshotService.js` — snapshots KPI в существующий `10 Контроль`;
- документация architecture/dashboard/data-model/user-guide;
- GitHub README как главный entry point Web Dashboard;
- автоматическая публикация Web App URL в README после успешного DEV deployment.

### Changed

- Web Dashboard стал основным пользовательским UX; листовая аналитика остаётся fallback/extended view;
- прогноз разделяет базовые и специальные доходы;
- индекс стабильности синхронизирован с действующей моделью `14 Аналитика`;
- меню `ПрихРасхOnline` направляет refresh/PDF/snapshot в новые модули;
- release model переведена на chat-driven event-only workflow без cron и WSL.

### Safety

- Web Dashboard не изменяет `01 Операции`;
- новые блоки 6–12 не создают листы;
- Quality Workbench пишет только в `11 Предпросмотр`;
- snapshots пишутся только в `10 Контроль` с readback;
- реальные строки финансовых операций не хранятся в публичных fixtures;
- PROD deployment не выполняется автоматически.

### Release status

`1.0.0-rc.1` становится `1.0.0` только после зелёного GitHub-hosted release gate, успешного Apps Script DEV deployment, проверки Web App URL и финального UX/security review.

## [1.3.0] — Web Executive + Drill-down

- Executive metrics;
- read-only drill-down;
- comparable YoY;
- base-aware forecast;
- privacy-safe synthetic drill-down fixture.

## [1.2.0] — Responsive visual gate

- default-period correction;
- responsive desktop/laptop/mobile checks;
- 10-view navigation checks;
- context panels use full width when adjacent visualizations are hidden.
