# FIN-REC-001 — private Expenses / Income / Cash Flow

## Назначение

`Расходы`, `Доходы` и `Денежный поток` — private read-only поверхности canonical R2 Web App. Финансовые формулы остаются в FIN-TRUTH / Analytics Contract; UI не получает права на запись и не вводит собственные KPI-формулы.

## Данные и производительность

Runtime читает лёгкую историческую проекцию `ID + Дата и время`, определяет актуальное окно и канонизирует полный набор столбцов только для текущего и равного сравнительного периода. Для видимого раздела выполняются две canonical analytics query. Это устранило многократные полные проходы по многолетней таблице.

История owner UAT показала последовательное улучшение холодной загрузки: ранние кандидаты давали 8–17 секунд, v208 — около 6–7 секунд. Warm navigation затем была доведена до наблюдаемых 0,3–0,5 секунды, но несколько следующих кандидатов выявили функциональные регрессии навигации и фильтров. Эти результаты не считаются Product Ready.

## Filter state v5.4

Version 213 подтвердила, что одного переноса query из top-level Web App в Apps Script iframe недостаточно. Owner UAT: все фильтры ведут себя некорректно. Статический разбор выявил split-brain состояния: форма применяла canonical top-level GET, runtime-request читал iframe query, а warm navigation/cache были оптимизированы только для default `90 дней / без dimension filters`. При активных фильтрах переход по FIN routes мог выпадать в обычные shell-links, которые сохраняют privacy, но не общий period/filter state.

v5.4 переводит FIN-фильтры на единый in-page state:

- `Период / Счёт / Категория / Член семьи` считываются непосредственно из формы;
- state сначала фиксируется в iframe History API, затем из него строится точный `google.script.run` request;
- после изменения фильтра cache/inflight/revision state инвалидируется одним generation boundary, поэтому поздний ответ старого запроса не может перерисовать экран;
- server response `filters.selected` является источником истины для выбранных значений после ответа;
- переходы `Расходы ↔ Доходы ↔ Денежный поток` всегда сохраняют текущий period/filter query, а не только default state;
- Back/Forward при смене history state сбрасывает stale cache и повторно получает exact filtered payload;
- при возврате к `90 дней / Все` разрешается прежний page-memory prefetch;
- persistent browser storage и financial write отсутствуют.

## Контрактные проверки

Browser regression gate доказывает не только наличие query/form fields, но и фактическую семантику: после submit runtime получает выбранные `window_days/account/category/member`, видимый financial result меняется, выбранные значения остаются на форме, тот же state сохраняется при `Расходы → Доходы` и browser Back, reset возвращает пустые dimension filters. Runtime contract отдельно проверяет эффект каждого owner-visible dimension filter и period 30/90 на canonical analytics result.

## Product gate

Технический PASS не равен Product Ready. После PR Validation → Trusted DEV Deploy → authenticated Runtime Health требуется fresh owner UAT на exact deployed SHA. Нужно подтвердить корректность каждого фильтра во всех трёх FIN routes, сохранение фильтров между маршрутами и Back/Forward, затем выполнить полный desktop/mobile UAT. До этого merge запрещён.
