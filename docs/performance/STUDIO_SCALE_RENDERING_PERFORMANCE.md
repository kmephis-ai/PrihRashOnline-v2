# PERF-090 — масштабирование Analytics Studio без изменения финансовой истины

`PERF-090` вводит `PRH_STUDIO_SCALE_PERFORMANCE_V1@1.0.0` — технический контракт, который ограничивает нагрузку большого Analytics Studio и при этом не получает полномочий менять финансовые вычисления. Источником результата остаются canonical `AnalyticsQuery/AnalyticsResult`, а исполнение запросов и повторное использование результата остаются ответственностью `PERF-070`.

## Зачем нужен отдельный слой

Когда в Studio появляется много виджетов, проблема уже не только в скорости одного запроса. Нельзя одновременно запускать десятки невидимых вычислений, бесконтрольно создавать графики, принимать устаревший результат после нового фильтра или превращать оптимизацию показа в новую формулу финансовой истины. PERF-090 решает именно эту задачу координации.

Контракт запрещает альтернативный финансовый расчёт. Он не меняет `FIN-TRUTH-v1`, canonical transactions, storage ownership, query semantics, private data и write authority. Платный performance provider, внешний CDN или обязательная сеть не требуются; `FREE_ONLY` сохраняется.

## Lazy execution

Каждый workload widget имеет техническое состояние видимости. Только `VISIBLE` разрешает запрос. `HIDDEN` и `OFFSCREEN` немедленно получают deferred-состояние и обязаны дать ноль query requests и ноль render commits. Поэтому закрытая вкладка, скрытый блок или виджет ниже области просмотра не тратит вычислительный бюджет до фактической активации.

Это правило относится к вычислительной нагрузке, а не к финансовой семантике: скрытый виджет не меняет query и не создаёт новый результат, он просто ещё не исполняется.

## Ограниченная параллельность и PERF-070

Coordinator допускает только bounded число одновременно активных виджетов. По умолчанию максимум равен четырём, жёсткий предел — восьми. PERF-090 намеренно не реализует второй cache или новый query fingerprint.

Каждый разрешённый запрос делегируется существующему `PRH_ANALYTICS_QUERY_PLANNER_CACHE_V1`. Поэтому одинаковые in-flight запросы коалесцируются PERF-070, повторные запросы того же revision могут использовать его memory cache, а совместимые агрегаты используются только по уже доказанным правилам PERF-070. Никакой heuristic reuse в PERF-090 нет.

## Stale result fail-closed

Filter/context/revision change увеличивает generation существующего query planner. PERF-090 запоминает generation и canonical revision в начале workload. Если completion приходит после смены generation или revision, состояние становится `DISCARDED_STALE` и render commit запрещён.

Проверка выполняется и до, и после render callback. Это закрывает гонку, когда старый запрос завершился одновременно с новым пользовательским контекстом. Устаревшее вычисление не становится текущим визуальным состоянием.

## High-density presentation

Большой набор строк оптимизируется только как способ показа. Canonical `AnalyticsResult`, `query_hash`, totals и provenance не переписываются.

При небольшом результате используется `DIRECT`. Для большого результата разрешён `VIEW_ONLY_DOWNSAMPLE` только если вызывающий слой явно объявил semantic downsampling безопасным. Это указание ограничивает количество отображаемых элементов, но не мутирует upstream result и не создаёт новую финансовую агрегацию.

Если semantic downsampling не доказан, применяется `VIRTUALIZED_ACCESSIBLE_TABLE`: отображается ограниченное окно, а полный canonical result остаётся неизменным upstream. Accessible table обязательна для любого режима; запрет fallback считается ошибкой контракта.

## Synthetic scale gate

CI использует независимо сгенерированные профили 20k и 50k canonical operations. Они не основаны на домашних данных. Для каждого профиля создаётся bounded Studio workload из visible и deferred widgets.

Gate доказывает:

- deferred widgets дают ноль запросов;
- количество query requests и render commits не превышает числа visible widgets;
- параллельность не превышает contract limit;
- поддержанные повторные запросы используют PERF-070 и реально дают in-flight coalescing;
- в supported workload отсутствуют дополнительные canonical evaluations;
- generation change приводит к stale discard и нулю stale render commits;
- `financial_writes=0`;
- generous CI timing ceilings — только regression guard, а не пользовательский SLA.

Публичный результат содержит лишь технические количества, status/reason, profile, timing и hash prefix revision. Суммы, строки результата, query payload, account/category/transaction/widget identifiers и private labels в telemetry запрещены.

## Граница завершения

`DONE_ENGINEERING` для PERF-090 допустим только после named PR gate, полного native test suite, ADWF consumer delegation, trusted exact-head delivery/runtime evidence, autonomous protected merge и Main Verification PASS. Это инженерное завершение; оно не объявляет новый пользовательский интерфейс или Product Ready capability.
