# Целевая модель дашбордов PrihRashOnline

Статус: **OWNER TARGET / PRODUCT DESIGN NORTH STAR**. Этот документ фиксирует согласованное направление для пользовательских финансовых дашбордов PrihRashOnline после design review 2026-08-17. Он не создаёт новый dashboard engine, не меняет FIN-TRUTH и не даёт UI полномочий вычислять собственную финансовую семантику. Реализация должна эволюционно использовать существующие canonical Dashboard, Analytics, Saved Views, Local-first и drill-down контракты.

## 1. Что означает «прекрасное состояние»

Целевой продукт должен ощущаться не как технический стенд и не как набор отдельных графиков, а как зрелый персональный Finance OS. За несколько секунд пользователь понимает, что произошло с финансами, видит масштаб изменения, получает доказуемые причины и может провалиться до исходных canonical transactions без смены финансовой истины.

Порядок приоритетов для каждого экрана:

`Работоспособность → Скорость → Понятность → UX → Analytics value → Visual quality`.

Красивый экран с пустыми графиками, сломанным действием, медленным переключением или непонятной терминологией не является целевым. Технически корректный экран, который заставляет пользователя расшифровывать `contract IDs`, `query hashes`, `BOUND/UNBOUND`, storage internals или framework vocabulary, также не является целевым пользовательским интерфейсом.

## 2. Единая аналитическая цепочка

Любой крупный аналитический дашборд должен по возможности отвечать на вопросы в одном связном сценарии:

`Что произошло? → Насколько? → Почему? → Что внесло вклад? → Это необычно? → Когда началось? → Drill-down`.

Это важнее количества визуализаций. KPI без контекста недостаточен. График без вывода недостаточен. Вывод без evidence и возможности открыть детализацию недостаточен.

В `Simple` режиме пользователь сначала видит короткий человеческий вывод, ключевые KPI, главное изменение и один-два приоритетных сигнала. В `Expert` режиме тот же результат раскрывается через decomposition, compare period, concentration, seasonality, distributions, X-Ray findings, provenance и drill-down. Оба режима используют одну FIN-TRUTH и один canonical analytics layer.

## 3. Общий product shell

Целевые дашборды используют единый спокойный shell:

- компактная глобальная навигация и ясный active section;
- контекстная боковая область только там, где она действительно помогает фильтрам, периодам или drill context;
- сильный page title, период сравнения и data-quality state в верхней части;
- главный evidence-backed вывод расположен выше вторичных controls;
- KPI row содержит обычно 4–6 действительно значимых показателей, а не каталог всех доступных метрик;
- primary analysis занимает визуально доминирующую область;
- блок `Почему` / decomposition располагается рядом или сразу ниже главного анализа;
- anomalies, obligations, risks и другие actionable signals отделяются семантически, а не только цветом;
- последние операции или drill table появляются как завершающий слой, а не конкурируют с главным выводом;
- техническая информация доступна через progressive disclosure в Expert/Diagnostics, но не доминирует в бытовом интерфейсе.

Desktop и mobile используют одну семантику. На mobile меняется композиция и плотность, но не исчезает главный вывод, compare context или путь к детализации.

## 4. Целевая визуальная система

Базовый visual language — современный финансовый BI без декоративного шума. Тёмная тема является полноценной first-class presentation, светлая тема сохраняет ту же иерархию и доступность.

Основные принципы:

- глубокий нейтральный navy/graphite background, спокойные приподнятые surfaces и тонкие разделители;
- teal используется как основной product accent; blue/violet допустимы для независимых аналитических серий;
- green/red/orange используются только для доказанного семантического состояния, а не как украшение;
- card radius ориентировочно 14–20 px, но радиус не должен превращать каждый элемент в отдельную «капсулу»;
- shadows и gradients очень умеренные и поддерживают depth, а не заменяют иерархию;
- typographic hierarchy читается без цвета: page title → conclusion → KPI value → chart title → annotation → metadata;
- оси, labels и legends читаемы без увеличения экрана; вторичная подпись не становится бледным декоративным текстом;
- charts занимают пространство пропорционально аналитической ценности; мелкие повторяющиеся sparkline используются только как supporting cue;
- пустые декоративные chart containers запрещены на Product Ready surface;
- fake/demo financial numbers на реальном пользовательском маршруте запрещены. Skeleton/structure preview может показывать форму без финансовых значений и должен быть явно таким и восприниматься.

## 5. Целевые модели основных дашбордов

### Главная

Главная отвечает на вопрос «что изменилось и на что обратить внимание сейчас». В верхнем слое: текущий финансовый контекст, короткий главный вывод, доходы/расходы/чистый поток/ликвидность или другие доказанные ключевые KPI. Далее — одна центральная динамика, причины главного изменения, ближайшие обязательства или риски, anomaly/X-Ray signals и быстрый drill в соответствующий раздел.

Главная не должна превращаться в свалку мини-виджетов. Она является executive overview и маршрутизатором в глубокую аналитику.

### Расходы

Экран расходов показывает: общий объём и изменение к comparison period, динамику, структуру категорий, top drivers, concentration, регулярные и крупные/необычные расходы, сезонность и последние релевантные операции. Ключевой переход: `расходы изменились → какие категории внесли вклад → какие операции объясняют вклад`.

Category structure и trend должны быть видны одновременно или последовательно без потери filter context. Drill-down сохраняет период, категорию и compare context.

### Доходы

Экран доходов показывает общий доход и изменение, динамику, структуру источников, концентрацию источников, устойчивость/нерегулярность потока и календарную картину поступлений там, где данные это поддерживают. Главный вопрос: `как изменился доход, за счёт каких источников и насколько изменение устойчиво`.

Нельзя выдавать прогноз или стабильность как факт без доказанного model/provenance contract.

### Денежный поток

Cash Flow должен объяснять не только итог, но и путь от входящего потока к исходящему и net result. Базовая композиция: KPI → trend → waterfall/decomposition → contributions/drivers → compare period → drill-down.

Balance и cash-flow не подменяют друг друга. Любая liquidity interpretation использует только доказанный соответствующий domain contract.

### Аналитика

Аналитика — главный analyst surface. Она соединяет произвольный период, compare period, measure/dimension/filter, visual switch, cross-filter, decomposition, seasonality, concentration, distributions, long-term trends, X-Ray findings и drill-through. Default presentation всё равно начинается с понятного вопроса и результата, а не с набора технических controls.

Пользователь должен иметь возможность перейти от общей картины к причине и затем к canonical transactions, сохраняя один filter context. Технические query identifiers, hashes, semantic bindings и provenance раскрываются только по запросу пользователя или в diagnostics.

### Бюджет

Бюджет показывает факт относительно declared plan/target, а не создаёт несуществующий финансовый совет. Основной слой: использовано / осталось / отклонение там, где эти понятия доказаны; cumulative execution; категории с наибольшим отклонением; ближайшие budget risks; drill-down до операций.

Если plan отсутствует или неполон, экран честно показывает соответствующее empty/degraded состояние вместо придуманного target.

### Обязательства

Обязательства ориентированы на будущую нагрузку: total obligations, ближайшие платежи, календарь/таймлайн, структура по обязательствам, concentration и доказанные liquidity/risk indicators. Любой inferred balance или скрытая оценка запрещены без явного domain contract.

Пользователь должен быстро понять `что предстоит`, `когда`, `насколько это существенно` и открыть конкретное обязательство или связанные операции.

### Analytics Studio / Expert

Studio — рабочее пространство для создания и изменения представлений, а не панель внутренностей системы. Gallery, canvas, inspector, widgets, global filters, saved views, clone/edit/save/reload и version history должны ощущаться как один продуктовый workflow.

Основной экран Gallery показывает визуальный характер и аналитический вопрос preset до создания копии. Capability/version IDs и storage details скрыты в technical disclosure. После clone пользователь видит dashboard-like canvas и понятный inspector; canonical DASH-084 lifecycle остаётся единственным persistence path.

## 6. Состояния данных и ошибок

Каждый user-facing дашборд обязан иметь намеренно спроектированные состояния:

- `loading` — пользователь понимает, что именно ожидается, без layout jump;
- `empty` — объясняется, каких данных или условий нет и что можно сделать дальше;
- `degraded` — доступная часть остаётся полезной, недоступная часть названа честно;
- `error` — human-readable причина и безопасный recovery action;
- `stale/offline` — если применимо, явно показывается Local-first revision/freshness человеческим языком;
- `ready` — никакие placeholder blocks, skeletons или diagnostics не выглядят как итоговый финансовый результат.

Fail-closed означает честно показать недоступность capability, а не подставить synthetic financial result.

## 7. Interaction и drill contract

Filter, compare period, cross-filter и drill должны вести себя предсказуемо. Выбор сегмента распространяет контекст на связанные widgets только через canonical interaction contracts. Back/Forward восстанавливает meaningful state. Drill-through открывает соответствующий уровень детализации без потери контекста и без новой альтернативной финансовой формулы.

Primary actions получают очевидные названия. Для бытового пользователя запрещены действия, названные через внутренний implementation mechanism. Keyboard flow, visible focus, contrast и touch targets являются частью качества, а не отдельной косметикой.

## 8. Performance — часть дизайна

Целевая визуальная насыщенность не разрешает замедлять Local-first UX. Используется существующий `PRH_LOCAL_FIRST_PERFORMANCE_CONTRACT_V1`: warm route switch p95 ≤ 100 ms, filter/KPI p95 ≤ 200 ms, ordinary chart repaint desktop p95 ≤ 300 ms, representative mobile p95 ≤ 500 ms, Back/Forward p95 ≤ 100 ms, cached first meaningful paint p95 ≤ 800 ms.

Hidden/offscreen widgets не должны запускать ненужный query/render work. Warm verified revision не должен делать обязательный Google Sheets/network round-trip для обычного переключения маршрута, фильтра или открытия локально доступного представления. Визуальная сложность оправдана только если она сохраняет отзывчивость.

## 9. Product Ready visual gate

User-facing dashboard не считается Product Ready, пока на exact deployed candidate не доказано одновременно:

- главный финансовый смысл читается без developer terminology;
- primary chart не пустой placeholder и не broken state;
- главный вывод имеет evidence-backed путь к детализации;
- loading/empty/degraded/error states осмысленны;
- desktop и representative mobile не имеют horizontal overflow и разрушенной hierarchy;
- keyboard/focus/back-forward и основные touch interactions работают;
- нет console/page errors и сломанных primary actions;
- нет fake financial values, private payload в public evidence или presentation-layer финансовой логики;
- canonical Local-first performance gates сохранены;
- visual quality проверена на реальном owner-authenticated deployed flow, а не только synthetic screenshot test.

## 10. Как к цели двигаться

Переход выполняется rolling-wave, без big-bang rewrite. Каждый Roadmap item улучшает один реальный user-facing outcome поверх существующих canonical engines. Новая визуальная композиция не является поводом создавать второй dashboard, storage, query или FIN-TRUTH engine.

`DASH-090` фиксирует первый явный presentation step: Expert Gallery должна уже выглядеть как зрелая продуктовая поверхность, давать visual structure preview без финансовых значений и скрывать внутренние capability/storage details за progressive disclosure. Следующие user-facing items должны использовать этот документ как visual/product acceptance north star и постепенно выравнивать Главную, Расходы, Доходы, Cash Flow, Бюджет, Обязательства, Аналитику и Studio, сохраняя canonical contracts и доказанную производительность.
