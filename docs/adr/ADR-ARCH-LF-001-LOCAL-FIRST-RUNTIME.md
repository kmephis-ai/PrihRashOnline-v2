# ADR-ARCH-LF-001 — Local-first runtime для PrihRashOnline

Статус: **APPROVED**  
Дата: 2026-08-14  
Roadmap: `ARCH-LF-001`  
Normative detail: `docs/architecture/LOCAL_FIRST_RUNTIME.md`  
Machine contract: `PRH_LOCAL_FIRST_RUNTIME_V1@1.0.0`

## Контекст

Текущий private Dashboard исторически использует request-per-view путь через Apps Script/Google Sheets. Несмотря на PERF-010/011/012/013/070 и recovery-оптимизации, реальная отзывчивость финансовых экранов остаётся недостаточной и ухудшает UX при расширении числа route/filter/chart interactions.

Финансовая модель, canonical transaction, FIN-TRUTH и semantic analytics являются ценными и не требуют переписывания. Проблема находится прежде всего в interaction/runtime topology: сеть, Apps Script и Google Sheets участвуют в критическом пути обычного пользовательского действия.

## Решение

PrihRashOnline принимает архитектуру:

`Local-first SPA + IndexedDB Local Read Model + Web Worker analytics + background exact-revision/delta synchronization`.

Google Sheets остаётся canonical source на переходном этапе. Apps Script становится trusted bootstrap/sync/reconciliation adapter и не является обязательным backend каждого warm route/filter/chart action.

Warm interaction после verified bootstrap обязан выполняться локально и доказывать zero mandatory network requests / zero Google Sheets reads.

## Финансовая и privacy authority

Local-first слой не получает financial truth или canonical write authority. `PRH_CANONICAL_TRANSACTION_V1`, `FIN-TRUTH-v1`, KPI Dictionary, Analytics Contract, `FREE_ONLY`, privacy и exact-SHA delivery gates сохраняются.

IndexedDB является private browser storage конкретного origin. Public telemetry/artifacts не содержат household financial payload. Несовместимая/corrupt local schema перестраивается из canonical source, а не чинится эвристически.

## Почему не YDB сразу

YDB остаётся целевым remote backend, но немедленный full cutover дал бы одновременно две крупные миграции: UX/runtime и authoritative data platform. Это увеличивает риск и усложняет rollback.

Сначала UI отделяется от source adapter. После `MASTER-LF-PRODUCT` YDB вводится как shadow replica, затем dual-read compare, read canary и только после доказанной parity — remote read authority. Write cutover является отдельным будущим owner-authorized решением.

## Почему не продолжать только Apps Script cache optimization

Server-side cache остаётся полезным для sync/bootstrap, но не устраняет cold instance, network, revision-probe и Google service variance. Архитектурная цель сильнее: убрать эти зависимости из warm click path физически, а не только уменьшить их среднюю стоимость.

## Последствия

Положительные:

- route/filter/chart responsiveness становится в основном функцией локального JS/worker/rendering;
- сетевой сбой не блокирует чтение последней verified local revision;
- дальнейшая миграция Google -> YDB не требует переписывать SPA;
- существующие domain/analytics/visualization contracts переиспользуются.

Издержки:

- появляется versioned IndexedDB lifecycle;
- нужен sync/delta protocol и atomic local generation switch;
- private data существует локально в браузере и требует explicit wipe/privacy lifecycle;
- browser performance и stale-worker races становятся обязательной частью test architecture.

## Альтернативы

1. Продолжить request-per-view Apps Script optimization — отклонено как стратегический primary path.
2. Немедленный big-bang YDB migration — отклонено из-за повышенного migration/rollback риска.
3. Полный новый backend/frontend с нуля — отклонено как ненужная потеря существующего FIN/domain/CI foundation.

## Rollback

ARCH-LF-001 не меняет canonical financial data и production write authority. До Product Ready старый runtime сохраняется bounded fallback. Если Local-first implementation не проходит gates, primary navigation/cutover не выполняются, а архитектурные изменения могут быть откатаны без data migration.
