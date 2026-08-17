# Owner UAT profiles

Статус: нормативное дополнение к Product Ready delivery contract. Общий `PRODUCT-EVIDENCE` и запрет AI/CI самостоятельно подтверждать owner UAT сохраняются.

## `GENERIC_V1`

Профиль по умолчанию для `work_class=user_facing`. Требует owner-authenticated exact-candidate PASS полного набора полей, используемых `Owner Product UAT Attestation`: desktop/mobile, visible actions, русский UI, отсутствие developer markers, visual truth/acceptance, Back/Forward, loading/error states и route timing. Этот профиль остаётся без изменений для обычных user-facing items и для полного Local-first Product Ready journey.

## `PERF_LF_V1`

Узкий scoped-профиль разрешён **только** для `roadmap_id=PERF-LF-001` и существует для согласования `MASTER-LF-PERF` с утверждённым Local-first Recovery Roadmap.

Owner-authenticated exact-candidate evidence обязано подтверждать:

- общий PERF result `PASS` на desktop owner browser;
- warm route p95 `<=100 ms`;
- filter/KPI p95 `<=200 ms`;
- desktop chart repaint p95 `<=300 ms`;
- Back/Forward p95 `<=100 ms` и owner flag `PASS`;
- cached first meaningful paint p95 `<=800 ms`;
- `mandatory_network_requests=0`;
- `google_sheets_reads=0`;
- `observed_resources=0`.

Representative-mobile performance **не объявляется owner PASS**, если владелец не выполнял mobile UAT. Поле `owner_uat_mobile=MACHINE_DERIVED` допустимо только в `PERF_LF_V1`, а trusted attestation дополнительно требует successful `PR Validation` на том же exact PR head. Канонический `local_first_performance_runtime_test.js` выполняет отдельный real-Chromium representative-mobile benchmark и fail-closed проверяет соответствующий SLO.

Успех `PERF_LF_V1` даёт scoped `product-ready-e2e=success` только для завершения user-facing work item `PERF-LF-001` / `MASTER-LF-PERF`. Он **не** означает и не заменяет `MASTER-LF-PRODUCT`, не утверждает generic mobile/error/accessibility/visual checks и не закрывает следующий `E2E-LF-001`.

## Fail-closed boundaries

- неизвестный `owner_uat_profile` не аттестуется;
- отсутствие/дублирование обязательного поля не аттестуется;
- candidate обязан совпадать с единственным open PR head;
- exact candidate обязан иметь `trusted-dev-deploy=success` и `trusted-runtime-health=success`;
- `PERF_LF_V1` обязан иметь successful exact-head `PR Validation`;
- ни один профиль не разрешает ослаблять SLO, FIN-TRUTH, privacy, zero-write или `FREE_ONLY`;
- полный `E2E-LF-001 / MASTER-LF-PRODUCT` продолжает требовать desktop + mobile authenticated product journey согласно `docs/ROADMAP_LOCAL_FIRST_RECOVERY.md`.
