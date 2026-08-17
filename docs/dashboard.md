# Web Dashboard — пользовательская модель

## Основной экран

Web Dashboard — основной интерфейс текущей Google Apps Script реализации ПрихРасхOnline v2. Он работает как private `MYSELF` Web App и не требует повседневной работы внутри grid Google Sheets.

Private deployment URL не является public repository artifact. Владелец использует owner-managed bookmark или menu entry из связанной книги.

Навигация содержит 10 представлений:

1. Обзор
2. Годы
3. Месяцы
4. Месяц
5. Сезонность
6. Структура
7. Операции
8. Прогноз
9. Качество
10. Детали

Selected period/view state может сохраняться в private URL-state; такую ссылку не следует публиковать в GitHub/Issues/CI.

## Executive-панель

Первый уровень включает текущие income/period/comparison/base/special/forecast/stability/data-quality показатели. Второй уровень содержит supporting operational metrics и quality context.

Карточки, где реализован drill-down, являются navigation/query actions, а не новой копией финансовой базы.

## Drill-down

Поддерживаемые drill-down paths формируются server-side из private workbook/runtime. Preview ограничен UI contract; source-row locator остаётся private runtime detail.

Drill-down — read-only query path и не изменяет canonical transaction.

## Быстрые действия

### Обновить данные

`DashboardUnifiedRefreshService` выполняет bounded validation/recalculation/payload refresh и privacy-safe technical status. Финансовые операции от обычного refresh не меняются.

### Качество

Quality Workbench группирует проблемы и работает через `11 Предпросмотр` как staging/review queue. Classification output сначала является proposal/explanation. Подтверждение proposal или сохранение rule — отдельные действия и не дают модели права автоматически переписывать financial history.

### Снимок KPI

Создаёт private control snapshot в `10 Контроль` и проверяет supported write readback'ом. Реальные snapshot aggregates не переносятся в public fixtures.

### PDF отчёт

Создаёт private report из существующей analytics surface в Google Drive. Report не является GitHub artifact.

## Прогноз

Текущая implementation отделяет base income от special income, чтобы не повторять разовые выплаты как recurring baseline. Forecast остаётся ориентиром, а не финансовой истиной/обязательством.

Формальные versioned financial/KPI definitions будут закреплены последующим `FIN-010`; до этого legacy spreadsheet total cells не считаются golden truth для CI.

## Индекс стабильности

Dashboard использует текущую объяснимую stability model и существующие private source semantics. Любая будущая смена definition должна быть versioned и покрыта domain contracts, чтобы Web UI и analytics не расходились.

## Responsive UX

PR Validation проверяет synthetic responsive path минимум для desktop/laptop/mobile и связанные navigation/layout contracts. UI gate выполняется **до** создания immutable Apps Script candidate.

## Public test data

Public CI использует только **independently generated synthetic financial data**. Запрещено использовать реальные или real-derived household values, aggregates, distributions, seasonality, IDs, screenshots или exports как fixture/golden truth.

Private Apps Script runtime формирует реальные Dashboard/drill-down payload только во время authenticated owner use.

## Delivery identity

Dashboard runtime считается инженерно verified не потому, что deployment URL существует, а только когда exact candidate проходит:

`PR Validation -> Trusted DEV Deploy -> Trusted Runtime Health`.

Authenticated Runtime Health сверяет exact build/source-tree identity через owner-only Execution API; private Web App не делается public ради smoke test.
