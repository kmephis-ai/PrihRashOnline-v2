# ADR GOV-REC-002 — Stage-aware dependencies для Product Ready gate builders

- Статус: Proposed
- Дата: 2026-08-13
- Roadmap: `GOV-REC-002`
- Issue: `#239`

## Контекст

Recovery lifecycle различает инженерную готовность и продуктовую готовность. Для user-facing item финальный `DONE` требует `product-ready-e2e=PASS`; `CODE_COMPLETE` и `RUNTIME_INTEGRATED` сами по себе недостаточны.

После VIZ-REC-001 проявился циклический dependency: визуальный item уже был `CODE_COMPLETE / RUNTIME_INTEGRATED`, но не мог стать `DONE` без canonical authenticated E2E. Одновременно E2E-REC-001, который должен создать этот canonical Product Ready gate, был объявлен обычным downstream dependency от VIZ-REC-001. Обычный `depends_on` требует `status=DONE`, то есть gate-builder не мог стартовать до появления gate, который он сам должен построить.

Ручное объявление полного Owner UAT только ради разрыва цикла признано неверным: оно увеличивает ручную нагрузку и может превратить отсутствие автоматического evidence в формальный PASS.

## Решение

Добавить третий, узкий тип зависимости:

`depends_on_runtime_integrated: [<Roadmap ID>]`

Он означает: downstream разрешено начать только после того, как predecessor является `user_facing`, достиг как минимум `product_stage=RUNTIME_INTEGRATED` и находится в lifecycle `IN_PROGRESS`, `BLOCKED` или `DONE`.

Этот тип предназначен прежде всего для gate-builder/recovery задач, результат которых необходим для продвижения predecessor к Product Ready. Он не означает, что predecessor завершён.

Task Packet обязан сохранять фактические `status` и `product_stage` такой зависимости и указывать `required_stage=RUNTIME_INTEGRATED`. Генерировать фиктивный `status=DONE` запрещено.

## Неизменяемые правила

1. `depends_on` по-прежнему требует `status=DONE`.
2. `depends_on_product_ready` по-прежнему требует завершённый user-facing predecessor с `product_stage=DONE`.
3. `depends_on_runtime_integrated` не удовлетворяет Product Ready dependency и не разрешает user-facing `DONE`.
4. Финальный user-facing `DONE` по-прежнему требует exact-SHA `PRODUCT_READY_E2E`, authenticated evidence, trusted delivery и Main Verification.
5. `FREE_ONLY`, privacy, `MYSELF`, `FIN-TRUTH`, exact-SHA и one-active-writer не меняются.

## Fail-closed условия

Runtime-integrated dependency считается невыполненной, если predecessor:

- имеет `work_class != user_facing`;
- находится в `BACKLOG` или `READY`;
- имеет `product_stage` ниже `RUNTIME_INTEGRATED`;
- отсутствует в Roadmap state;
- одновременно объявлен в другом dependency bucket того же downstream item.

## Применение к Recovery Wave

После принятия GOV-REC-002 E2E-REC-001 должен сохранить обычные завершённые engineering dependencies, но VIZ-REC-001 перевести из обычного `depends_on` в `depends_on_runtime_integrated`. Это позволит строить canonical authenticated gate поверх уже развернутого exact VIZ candidate, не объявляя VIZ завершённым раньше времени.

Когда E2E producer сможет выдать доказанный `product-ready-e2e`, VIZ-REC-001 сможет пройти оставшиеся Product Ready gates и только затем `DONE`.

## Rollback

Удалить поддержку `depends_on_runtime_integrated` из protocol/schema/tests и вернуть downstream зависимости к прежней модели `DONE`/`product DONE`. До rollback зависимые items должны быть переведены обратно в `BLOCKED`, чтобы не возникло ложного continuation.
