# Архитектура ПрихРасхOnline v2 — Income Dashboard v1.0 RC

## Цель

Система должна ощущаться как небольшое финансовое приложение, но сохранять простую и сопровождаемую основу Google Sheets. Основной пользовательский UX — HTML Web Dashboard; Google Sheets остаётся приватным хранилищем и расширенной аналитикой.

## Компоненты

| Компонент | Роль |
|---|---|
| Google Sheets | приватные данные, расчётные таблицы и контроль |
| `01 Операции` | источник финансовых операций; для Web Dashboard read-only |
| `14 Аналитика` | существующая расширенная аналитика и fallback UX |
| `11 Предпросмотр` | очередь качества и staging предложений |
| `10 Контроль` | аудит и snapshots KPI |
| `09 Настройки` | техническое состояние и конфигурация |
| Apps Script | серверный слой, data services, отчёты и безопасные действия |
| `DashboardWebApp.html` | основной responsive Web UI |
| GitHub | source of truth для исходников, тестов и документации |
| GitHub Actions | GitHub-hosted DEV build/test/deploy/merge |

## Поток данных

```text
01 Операции (read-only)
        ↓
Apps Script data services
        ↓
Executive / drill-down / quality / forecast
        ↓
HTML Web Dashboard
```

Допустимые записи пользовательского контура v1.0 RC:

```text
Quality decision → 11 Предпросмотр
Snapshot KPI     → 10 Контроль
Technical state  → 09 Настройки
PDF              → Google Drive file
Rules            → DocumentProperties
```

`01 Операции` не является целью записи для модулей Web Dashboard v1.0 RC.

## Модули RC

- `DashboardWebDataService.js` — базовый read-only web payload;
- `DashboardWebExecutiveService.js` — Executive metrics и drill-down;
- `DashboardUnifiedRefreshService.js` — единый безопасный refresh;
- `QualityWorkbenchService.js` — интерактивная очередь качества;
- `IncomeClassificationService.js` — объяснимая классификация и подтверждаемые правила;
- `IncomeReportService.js` — PDF export;
- `IncomeSnapshotService.js` — snapshots в `10 Контроль`;
- `ApplicationMenuService.js` — fallback entry point из Google Sheets;
- `DashboardWebApp.html` + build steps — основной UX.

## Trust boundaries

1. **Публичный GitHub** не содержит реальные строки финансовых операций.
2. **Apps Script runtime** имеет доступ к приватной книге и формирует реальные drill-down данные только во время выполнения.
3. **Quality Workbench** изменяет только очередь предложений.
4. **Classification** не меняет финансовую операцию: предложение сначала помещается в очередь, а правило сохраняется только отдельным подтверждением.
5. **Snapshots** добавляются только в существующий `10 Контроль` с readback.
6. **PROD** отделён от DEV и не является автоматическим продолжением DEV merge.

## Release architecture

```text
команда в чате
→ изменения agent/**
→ npm prepare:web
→ contract tests
→ Playwright desktop/laptop/mobile
→ clasp push DEV
→ create/update Web App
→ обновить Dashboard URL в README
→ проверить неизменившийся PR head
→ merge в main
```

Разработка не использует WSL, self-hosted runner или cron. Runner — GitHub-hosted `ubuntu-latest`.

## Fail-closed

Release прекращается без merge, если:

- отсутствуют Apps Script secrets;
- не проходит contract test;
- Playwright обнаруживает regression;
- `clasp push` падает;
- Web App deployment не возвращает deployment ID;
- PR head изменился после проверки;
- GitHub API отказал в merge.

## DEV → PROD

`main` означает проверенный исходный код Income Dashboard. Это **не** означает автоматическое продвижение в PROD. PROD deployment, доступ и политика публикации должны выполняться отдельным контролируемым процессом.
