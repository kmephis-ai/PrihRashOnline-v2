# AI Playbook — Trusted release

<!-- PRH_AI_PLAYBOOK_META_V1
{"playbook_id":"RELEASE","version":"1.0.0","language":"ru","mode":"TRUSTED_DELIVERY_OBSERVER","catalog":"PRH_AI_PLAYBOOK_CATALOG_V1@1.0.0","authority_granted_by_playbook":false}
-->

## Назначение

Playbook сопровождает уже открытый Roadmap PR через существующую exact-SHA trusted delivery chain. Он не выдаёт merge/deploy authority и не заменяет default-branch workflows.

## Каноническая цепочка

Engineering: `PR Validation → Trusted DEV Deploy → Trusted Runtime Health → CI-003 autonomous squash merge → Main Verification`.

User-facing: между Runtime Health и merge обязателен exact-candidate `Product Ready E2E`; Runtime Health не является его заменой.

**ручной merge запрещён**. Manual marker, review approval или текстовый комментарий не заменяют red required check.

## Порядок

1. Проверить, что PR открыт, target=`main`, не draft и связан ровно с одним active Roadmap Issue.
2. Дождаться PASS `PR Validation` на exact head SHA. При red исправлять root cause в той же ветке; после commit старый candidate больше не используется.
3. После green validation заморозить candidate SHA и не вносить commits.
4. Проверить `Trusted DEV Deploy` exact candidate reconstruction/promotion.
5. Проверить authenticated `Trusted Runtime Health` для того же candidate SHA/build identity.
6. Только после runtime PASS проверить `autonomous-merge=success` от CI-003; playbook сам merge не выполняет.
7. Для `work_class=user_facing` проверить `product_stage=PRODUCT_READY` и `product-ready-e2e=success`.
8. Проверить merge SHA и stage-aware `Main Verification`; engineering Issue получает DONE_ENGINEERING, user-facing — DONE.

## Recovery

Если trusted step red, сначала читать machine reason/evidence. Повтор exact same candidate допустим только как диагностика/восстановление подтверждённого transient trusted-delivery состояния без изменения branch; он не должен скрывать воспроизводимый defect. При code/policy defect требуется новый commit → новый candidate → полный validation chain.

## Stop conditions

PR Validation red, head changed, trusted deploy red, runtime health red, autonomous merge red или Main Verification red — это blocker. Нельзя перескочить этап, вручную слить PR или взять следующий Roadmap item.

## Privacy и стоимость

Trusted workflows могут использовать private credentials только внутри environment boundaries; они не выводятся в public evidence. Playbook не запрашивает отдельно оплачиваемый AI/API и соблюдает `FREE_ONLY`.
