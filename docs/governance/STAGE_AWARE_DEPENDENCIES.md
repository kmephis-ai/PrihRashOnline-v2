# Stage-aware Roadmap dependencies

`depends_on_runtime_integrated` — узкая dependency-семантика для gate-builder/recovery work items, которым нужен уже развернутый user-facing predecessor, но которые сами производят evidence, необходимый для его финального Product Ready.

## Семантика

- `depends_on`: predecessor обязан иметь `status=DONE`.
- `depends_on_runtime_integrated`: predecessor обязан быть `work_class=user_facing`, иметь `product_stage >= RUNTIME_INTEGRATED` и lifecycle `IN_PROGRESS`, `BLOCKED` или `DONE`.
- `depends_on_product_ready`: predecessor обязан быть завершён (`status=DONE`) и иметь `product_stage=DONE`.

Эти поля взаимоисключающие для одного и того же Roadmap ID внутри одного work item. Дублирование между dependency buckets является ошибкой protocol validation.

## Ограничение

`depends_on_runtime_integrated` не является сокращённым Product Ready и не может использоваться как evidence для user-facing `DONE`. Финальный `DONE` всё так же требует `PRODUCT_READY_E2E`, trusted delivery и Main Verification.

Пример gate-builder:

```yaml
depends_on: [GOV-REC-001, PERF-REC-001, UI-REC-001]
depends_on_runtime_integrated: [VIZ-REC-001]
depends_on_product_ready: []
```

Task Packet для runtime dependency сохраняет фактический lifecycle predecessor, например `status=BLOCKED`, и `required_stage=RUNTIME_INTEGRATED`; подмена на `DONE` запрещена.
