# Руководство пользователя — Web Dashboard

## 1. Как открыть Dashboard

Web Dashboard является приватным Google Apps Script Web App с доступом `MYSELF`.

Основные owner-controlled способы:

1. открыть сохранённую приватную закладку DEV Web App; или
2. открыть связанную Google Sheets книгу и использовать меню `ПрихРасхOnline → Открыть Web Dashboard`, если menu entry доступен в установленной версии.

Публичный GitHub README **не хранит и не обновляет private deployment URL**. Release pipeline не публикует его отдельным post-merge commit.

Если private bookmark потерян, deployment locator восстанавливается владельцем из Google Apps Script deployment management. Не публикуйте deployment/API Executable IDs в Issue, CI log или общий chat.

## 2. Выбор периода

В верхней части Web Dashboard выберите:

- год;
- месяц.

UI-state может сохранять выбранное представление/период в private Web App URL. Такую ссылку можно использовать как личную закладку, но не как public repository artifact.

## 3. Представления

- **Обзор** — executive KPI и основные графики;
- **Годы** — динамика истории;
- **Месяцы** — 12 месяцев выбранного года;
- **Месяц** — выбранный месяц и структура;
- **Сезонность** — сильные/слабые периоды;
- **Структура** — распределение по категориям;
- **Операции** — количество и средний размер;
- **Прогноз** — ориентировочный итог;
- **Качество** — Quality Workbench;
- **Детали** — табличное представление.

## 4. Drill-down

Нажмите на поддерживаемую KPI/card action. В private Apps Script runtime может открыться список связанных операций и ссылка на точную исходную строку Google Sheets.

Drill-down — read path и сам по себе не изменяет финансовую операцию.

## 5. Обновить данные

Нажмите **↻ Обновить данные**.

Система:

1. проверяет обязательные листы/поля;
2. дожидается пересчёта формул where applicable;
3. пересобирает Dashboard payload;
4. выполняет доступные application checks;
5. фиксирует privacy-safe technical status.

Обычный refresh не является разрешением на изменение `01 Операции`.

## 6. Quality Workbench

Нажмите **✓ Качество**.

Queue показывает проблемы и предложения. Подтверждение/отклонение штатного proposal меняет staging/review state в `11 Предпросмотр`; это не эквивалентно изменению canonical financial operation.

### Предложить категорию

Для поддерживаемой проблемы можно запросить объяснимое предложение:

1. получить category/confidence/reason;
2. внести результат только в proposal/staging;
3. отдельно подтвердить или отклонить;
4. при поддерживаемом workflow отдельно сохранить правило.

Автоматическое предложение не является финансовой истиной и не получает права молча переписывать историю операций.

## 7. Снимок KPI

**◫ Снимок KPI** создаёт private control snapshot в существующем `10 Контроль` и использует readback verification.

Control snapshot содержит реальные агрегаты и поэтому остаётся **только в приватной книге**. Его значения нельзя копировать в public fixtures/tests/docs.

## 8. PDF отчёт

**PDF отчёт** создаёт private report из текущей аналитики в Google Drive. Такой файл не является GitHub release artifact и не должен попадать в Issues/CI/public repo.

## 9. Что делать при ошибке

### Dashboard не загружается

- повторите обычный refresh только если UI доступен;
- убедитесь, что вы вошли в owner Google account;
- не делайте Web App public ради диагностики;
- инженерная доступность DEV доказывается `Trusted Runtime Health` через authenticated Execution API, а не anonymous `curl`.

### После изменения кода runtime выглядит старым

Не редактируйте deployment вручную как первый recovery step. Canonical delivery проверяет exact candidate SHA/source-tree через:

`PR Validation → Trusted DEV Deploy → Trusted Runtime Health`.

Red gate исправляется в том же Roadmap PR новым exact candidate.

### Ошибка financial/migration/reconciliation

Не исправляйте приватные строки только ради прохождения CI. Financial/migration machine gate должен сначала объяснить mismatch; private payload остаётся private.

### FREE_ONLY block

Если optional/provider workload остановлен Cost Guard, это штатная fail-safe деградация. Не включайте billing/paid overage для обхода guard. Provider policy меняется только отдельным Roadmap change с explicit safety envelope.

## 10. Recovery / backup

Portable encrypted backup выполняется только на trusted owner machine. `.prhbackup`, encryption key и OAuth profile хранятся отдельно от GitHub; verify и isolated restore drill являются обязательным доказательством recoverability.

Public evidence может содержать только technical PASS/FAIL, encrypted backup hash, checksum/reconciliation state и RPO/RTO — без финансового payload.

## 11. Безопасность финансовых записей

Web Dashboard не получает универсального права записи в `01 Операции`. Любой canonical financial mutation path должен быть отдельно спроектирован и доказан: bounded scope, explicit policy, idempotency, preconditions, audit, readback и rollback/snapshot.

Merge в `main` или успешный DEV deployment сам по себе не разрешает irreversible PROD/data action.
