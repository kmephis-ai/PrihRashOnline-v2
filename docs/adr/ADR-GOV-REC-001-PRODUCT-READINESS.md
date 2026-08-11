# ADR-GOV-REC-001 — Разделение engineering completion и Product Readiness

Статус: ACCEPTED
Дата: 2026-08-11
Decision owner: владелец PrihRashOnline-v2
Связано: `GOV-REC-001`, Roadmap v2.4, `MASTER-GUX`, `MASTER-GSTUDIO`.

## Контекст

До rebaseline один GitHub lifecycle `DONE` одновременно обозначал code/contracts completion, exact-SHA delivery и предполагаемую пользовательскую готовность. Forensic audit доказал, что такой вывод неверен: Home private-bound, семь Daily routes unbound, Studio configuration-only, VIZ planner не выполняется browser renderer, а performance layers не подключены в canonical path.

Текущие unit/property/contracts/synthetic Playwright/render smoke/exact-SHA health gates ценны и остаются обязательными. Они не доказывают полный owner-authenticated deployed household journey.

## Решение

1. Сохранить совместимый GitHub execution status `BACKLOG|READY|IN_PROGRESS|BLOCKED|DONE`.
2. Добавить обязательные `work_class`, `engineering_status`, `product_stage`, `target_stage`.
3. Engineering lifecycle заканчивается `DONE_ENGINEERING` и не создаёт product claim.
4. User-facing lifecycle: `CODE_COMPLETE -> RUNTIME_INTEGRATED -> REAL_E2E_VERIFIED -> PRODUCT_READY -> DONE`.
5. User-facing `DONE` требует exact-candidate commit status `product-ready-e2e=success` и `product_stage=PRODUCT_READY` до Main Verification.
6. `depends_on_product_ready` не удовлетворяется engineering-only completion.
7. `MASTER-G7-ENGINEERING` и `MASTER-G8-ENGINEERING` сохраняют completed contracts; working product gates — `MASTER-GUX` и `MASTER-GSTUDIO`.
8. R9/R10 frozen до Recovery gates; ANL-090 code сохраняется draft.
9. Private Web App URL, authenticated payload и real-derived financial evidence не публикуются. Product artifact содержит exact SHA, sanitized route/status/timing/parity PASS/FAIL.

## Последствия

- Main Verification становится stage-aware.
- Existing historical Issues не переоткрываются массово; Roadmap Product status matrix фиксирует фактическую зрелость и recovery link.
- Новые user-facing items могут оставаться open после code completion, пока runtime/E2E/UAT evidence не готово.
- Delivery может занимать дольше, но слово `DONE` снова означает работающий пользовательский outcome.
- Exact-SHA engineering health и Product E2E дополняют друг друга; ни один gate не отменяет privacy, FIN-TRUTH, MYSELF или FREE_ONLY.

## Альтернативы

### Оставить единый DONE

Отклонено: воспроизводит false-positive Product Ready и стимулирует contract-driven Roadmap.

### Reopen все исторические Issues

Отклонено: разрушает audit trail и создаёт десятки параллельных writers. Выбран Product status + bounded recovery items.

### Вернуть Legacy default

Отклонено как основной путь: Legacy не закрывает новый product scope и также имеет широкий read path. Он сохраняется только emergency rollback.

### Переписать приложение с нуля

Отклонено: canonical FIN/DATA/security/semantic foundation обладает высокой повторно используемой ценностью.

## Rollback

Revert GOV-REC-001 governance commit и восстановить Roadmap v2.3/task packet V1/Main Verification. Financial data/runtime не изменяются. GitHub audit history rebaseline сохраняется.
