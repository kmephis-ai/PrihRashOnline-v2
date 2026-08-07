# v1.0.0-rc.1 — Roadmap status

| Блок | Статус RC | Реализация |
|---|---|---|
| 6. Единая дизайн-система | IMPLEMENTED | responsive Web UI + action bar + существующие executive/drill-down design tokens |
| 7. Единое обновление | IMPLEMENTED | `DashboardUnifiedRefreshService.js` |
| 8. Интерактивное качество | IMPLEMENTED | `QualityWorkbenchService.js` + существующий dry-run queue |
| 9. Интеллектуальная классификация | IMPLEMENTED | `IncomeClassificationService.js` |
| 10. Экспорт и отчётность | IMPLEMENTED | `IncomeReportService.js` |
| 11. Снимки показателей | IMPLEMENTED | `IncomeSnapshotService.js` → existing `10 Контроль` |
| 12. GitHub и сопровождение | IMPLEMENTED RC | docs, changelog, safety tests, README dashboard URL publication, chat-driven release |

## Что ещё отделяет RC от v1.0.0 Stable

Кодовый scope блоков 6–12 завершён, но `v1.0.0` нельзя объявлять только по наличию исходников. Нужен один полный удалённый release gate:

1. build preparation;
2. contract tests;
3. responsive Playwright;
4. Apps Script `clasp push`;
5. DEV Web App deployment;
6. публикация реального Web App URL на главной GitHub;
7. runtime smoke-check;
8. merge PR;
9. после этого — версия `1.0.0` отдельным стабилизационным commit/tag, если smoke-check не выявит дефектов.

## Неприкосновенные ограничения

- `01 Операции` не изменяется Web Dashboard;
- новые листы блоками RC не создаются;
- PROD не следует автоматически за DEV;
- реальные строки операций не попадают в публичный GitHub;
- любое будущие автоматическое исправление финансовых данных требует отдельного разрешения и собственного backup/write/readback/audit gate.
