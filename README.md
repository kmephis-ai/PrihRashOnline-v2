# ПрихРасхOnline v2

Домашняя финансовая система на Google Sheets + Apps Script с Web Dashboard как основным пользовательским интерфейсом.

> **Статус:** `v1.0.0-rc.1` — Income Dashboard Release Candidate успешно проверен, развёрнут в DEV и объединён в `main`.

## ▶ Dashboard

<!-- DASHBOARD_LINK_START -->
[▶ Открыть Dashboard](https://script.google.com/macros/s/AKfycbxTt0YFnMtDtgLxtSao8cFA6Hlx7KOkKy23UHgwPYDXetry_0n-QXq9cVFepBeaY3NG/exec)

> DEV Web App • стабильная прямая ссылка.
<!-- DASHBOARD_LINK_END -->

Ссылка ведёт напрямую в HTML Web App; открывать GitHub Actions, WSL или редактор Apps Script для обычного использования не требуется.

## Что умеет Income Dashboard

- 10 представлений: обзор, годы, месяцы, выбранный месяц, сезонность, структура, операции, прогноз, качество, детали;
- Executive-панель 9 KPI первого уровня + 6 второго;
- read-only drill-down от показателя к исходным операциям;
- единый цикл обновления;
- Quality Workbench с очередью решений;
- объяснимая классификация: категория + уверенность + причина + подтверждаемые правила;
- PDF-отчёт за выбранный период;
- снимки KPI в существующий `10 Контроль`;
- responsive UI для desktop, laptop и mobile;
- стабильный прямой DEV Web App URL, публикуемый release workflow.

## Быстрые действия Web Dashboard

`Обновить данные` → проверка и пересчёт без записи финансовых операций.  
`Качество` → очередь проблем и подтверждение/отклонение предложений в `11 Предпросмотр`.  
`Снимок KPI` → запись контрольной точки в существующий `10 Контроль`.  
`PDF отчёт` → экспорт существующей аналитики в Google Drive.

## Безопасность

- Web Dashboard не изменяет значения `01 Операции`;
- Quality Workbench работает через существующую очередь `11 Предпросмотр`;
- новые листы release-блоками не создаются;
- PROD выполняется только отдельным явным решением;
- при несоответствии SHA, тестов или deployment release останавливается fail-closed.

## Документация

- [Архитектура](docs/architecture.md)
- [Web Dashboard](docs/dashboard.md)
- [Модель данных](docs/data-model.md)
- [Руководство пользователя](docs/user-guide.md)
- [Release process](docs/RELEASE_PROCESS.md)
- [CHANGELOG](CHANGELOG.md)
