# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys, private scope assignments и owner-private payload запрещены.

## LANG-RU

Русский язык — единственный нормативный язык human-facing документации, GitHub metadata и AI instructions. Machine identifiers, API/schema fields, library/protocol/standard names и команды сохраняются без искусственного перевода. Параллельный English source of truth запрещён.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — Executable GitHub Roadmap v2.3.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Versioned contracts + architecture/ADR/operations docs.

## Текущая инженерная задача

`DASH-086` — единственный **current writer**, canonical Issue #213, branch `agent/DASH-086-safe-dashboard-import-export`. Dependencies `DASH-084`, `DASH-085`, `SEC-002` — DONE/Main Verification PASS. Это финальный item R8 перед `MASTER-G8 / Analytics Studio` exit gate.

`DASH-085` завершён: canonical Issue #208 **DONE/Main Verification PASS**. Product PR #211 candidate `285f191be613355fd698260419bf5ac509ac19fa`; recovery PR #212 candidate `f6a427e0bff57857dad69c745b0850346524d745`; final recovery merge `7aeb044ffed8378d0a4aa3894d60b10caf309f2b`. Duplicate Issue #209 / PR #210 закрыты без merge и имеют `writer_authority=false`.

DASH-086 вводит `PRH_DASHBOARD_PORTABLE_SPEC_V1@1.0.0` как configuration-only portability boundary поверх DASH-080/081/084/085. Portable layer не получает query/financial/storage authority.

Current core:

- `lib/dashboard/dashboard_portable_spec.v1.json`;
- `lib/dashboard/dashboard_portable_spec.js`;
- `tests/dashboard_safe_import_export_contract_test.js`;
- `docs/dashboard/DASHBOARD_SAFE_IMPORT_EXPORT.md`;
- TEST-010 classification = `PURE_DOMAIN_APPLICATION`;
- named gate `Dashboard safe import/export`;
- LANG-RU inventory/markers registered.

Portable payload состоит только из canonical DASH-084 saved configuration (`DashboardSpec` + separately validated DASH-081 bound descriptors) и separately validated DASH-085 customization descriptors. Upstream derived identities не доверяются из файла: canonical validators заново нормализуют layout/bindings/customization и проверяют query/binding identity.

Запрещены рекурсивно: AnalyticsResult/result rows, canonical transaction rows/datasets, amount/balance/KPI/measure output values, OAuth/access/refresh/id tokens, credentials/secrets/password/API keys, Apps Script/spreadsheet/deployment IDs, runtime locators/URLs, arbitrary CSS/HTML/JavaScript/code/formatter/callback/function/URL payload.

Portable file имеет privacy class `PRIVATE_CONFIGURATION`, warning `PRIVATE_CONFIGURATION_NOT_PUBLIC_SAFE`. Private query/filter/dimension identifiers могут быть частью пользовательской конфигурации, поэтому export не считается public-safe. Public GitHub evidence использует только independently generated synthetic IDs/configuration.

Current limits: portable JSON <= 64 KiB, JSON depth <= 32, string <= 8192 chars, widgets/bindings/customizations <= 48. Это bounded transport, согласованный с DASH-080 `max_widgets=48`.

Import order обязателен:

1. bounded parser;
2. duplicate-key/prototype-pollution rejection;
3. exact schema/shape;
4. checksum raw payload verification;
5. semantic validation/recomputation через DASH-080/081/084/085;
6. canonical counts + round-trip identity verification.

Parser запрещает duplicate keys и `__proto__/prototype/constructor`, не исполняет imported code и не использует eval/Function. Unknown/future schema fail closed.

Current V1 import возвращает `PRH_DASHBOARD_PORTABLE_IMPORT_RESULT_V1` с `decision=DRY_RUN_ONLY`, `persistence_performed=false`, `persistence_authority=false`. Persistence требует отдельного explicit DASH-084 saved-view lifecycle/storage call. Portable core не вызывает `PropertiesService`, `SpreadsheetApp`, `UrlFetchApp`, `setProperties()` или financial write API; partial mutation невозможна.

Legacy migration допускается только explicit `PRH_DASHBOARD_PORTABLE_SPEC_V0@0.9.0 -> PRH_DASHBOARD_PORTABLE_SPEC_V1@1.0.0`. Receipt = `PRH_DASHBOARD_PORTABLE_MIGRATION_V1`, deterministic source/target/migration hashes; migration остаётся dry-run.

Canonical current-V1 import/re-export обязан быть byte-identical. Object key ordering не влияет на identity. Даже если внешний источник пересчитает checksum после подмены derived `binding_hash`, upstream DASH-084/DASH-081 recomputation обязано reject’нуть несогласованную identity.

DASH-086 telemetry allowlist = schema/version/action/payload_hash_prefix/byte_count/widget_count/binding_count/customization_count/decision/reason. Raw widget IDs, names, query/filter values, private IDs, financial values, credentials/runtime locators запрещены.

Все DASH-086 authorities = false: `financial_truth`, `financial_write`, `query_execution`, `query_mutation`, `binding_mutation`, `canonical_mutation`, `authorization`, `storage`, `persistence`, `network`, `deployment`, `renderer`. `FREE_ONLY` mandatory.

## FinOps / worst-case budget / owner estimate / model routing handoff

`FINOPS-001` остаётся обязательной cost boundary для runtime и engineering: `FREE_ONLY` означает отсутствие required paid dependency и запрет автоматического включения платного API/service ради прохождения required gate. Usage counters, throttle/circuit breaker и monthly safety budget остаются machine authority; AI context не имеет права повышать лимиты или обходить circuit breaker.

Перед любой задачей, способной создать внешний расход, writer обязан сформировать **worst-case budget** и **owner estimate** как явный handoff владельцу до irreversible/billing-backed действия. Owner estimate не является machine authorization и не подменяет cost gate; если стоимость не доказана как допустимая в рамках текущего policy, действие fail-closed/blocked.

`AIENG-006` / `PRH_AI_MODEL_COST_ROUTING_V1@1.0.0`: required machine gates всегда `LOCAL_DETERMINISTIC`; ChatGPT subscription surface отделена от OpenAI API billing; `OPENAI_API enabled=false` для required engineering. При exhaustion/unknown capacity используется разрешённый Sol/Terra/Luna fallback или pause/defer, но не automatic paid API fallback и не bypass красного machine gate.

FinOps truth, worst-case budget, owner estimate и model routing сохраняются при каждом writer handoff независимо от Roadmap ID.

## Current R0 truth

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. Исполнимая AI-инженерная цепочка сохраняется явно: `AIENG-001 = DONE` -> `AIENG-002 = DONE` -> `AIENG-003 = DONE`; `AIENG-004`, `AIENG-005`, `AIENG-006` также DONE/Main Verification PASS. Этот ordered handoff является lifecycle anchor и не заменяется current writer.

Real or real-derived household finance data stays private. Public repo содержит только public-safe contracts, independently generated synthetic finance fixtures и privacy-safe machine evidence.

## Current R1 truth

`MASTER-G3 / Canonical platform` — complete; historical pre-close state: open.

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Main Verification PASS, Issue #89.
- `ARCH-011` — **DONE**, Main Verification PASS, Issue #91.
- `MIG-010` — **DONE**, Main Verification PASS, Issue #96.
- `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010` — DONE/Main Verification PASS.
- FIN authority = `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`.
- DATA authority = `PRH_CANONICAL_TRANSACTION_V1`.
- Repository authority = `PRH_TRANSACTION_REPOSITORY_V1`.
- Generic Google canonical write остаётся fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Post-R1 handoff historically начинается с `DESIGN-020`; этот anchor сохраняется после завершения R2.

## Current R2 truth

`DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020`, `EXP-020`, `INC-020`, `CF-020`, `BUD-020`, `OBL-020`, `DQ-020`, `PWA-020`, `PROF-020`, `UI-MIG-020` — DONE/Main Verification PASS. Canonical private Web App default = R2 Financial Home. Web App остаётся `MYSELF`; PWA boundary `NOT_PROVEN_CURRENT_HOST`; `FREE_ONLY` mandatory.

## Current R3/R4/R7 truth

R3 completed items `TREND-030`, `PROJ-030`, `GOAL-030`, `BAL-030`, `NW-030`, `SUB-030` — DONE/Main Verification PASS.

`YC-040` и `AUTH-040` — DONE/Main Verification PASS. `YC-041` = BLOCKED `OWNER_CLOUD_BOOTSTRAP_REQUIRED`; `YC-042` = BLOCKED `OWNER_YDB_TARGET_REQUIRED`; оба `writer_authority=false`, не создают billing-backed resources и не меняют canonical ownership.

R7 `ANL-070`, `SCOPE-070`, `ANL-071`, `ANL-072`, `BENCH-070`, `ANL-073`, `ANL-074`, `PERF-070`, `TEST-070`, `VIZ-070` — DONE/Main Verification PASS; `MASTER-G7` complete. VIZ-070 remains `PRH_VISUALIZATION_REGISTRY_V2@2.0.0`, no financial/query authority.

## Current R8 truth

- `STUDIO-080` — DONE.
- `PRIV-080` — DONE.
- `DASH-080` — DONE.
- `DASH-081` — DONE.
- `DASH-082` — DONE.
- `DASH-083` — DONE.
- `DASH-084` — DONE, candidate `3626aab53c2a3b71ffff5dc0be579c061517a893`, merge `06e96ad4cb4d03f9447467224ec66dddea470238`.
- `DASH-085` — DONE/Main Verification PASS, Issue #208, recovery merge `7aeb044ffed8378d0a4aa3894d60b10caf309f2b`.
- `DASH-086` — **current writer**, Issue #213, branch `agent/DASH-086-safe-dashboard-import-export`; IN_PROGRESS until Main Verification.

DASH-084 remains private per-user configuration persistence only. DASH-085 remains presentation-only. DASH-086 adds only portable envelope/dry-run validation and cannot silently persist imported config.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies tracked tests fail-closed. `dashboard_safe_import_export_contract_test.js = PURE_DOMAIN_APPLICATION`; named gate `Dashboard safe import/export` is mandatory together with existing DASH-085..080/DESIGN/VIZ/ANL/PRIV/STUDIO/FIN/MIG/privacy/security/FREE_ONLY gates. Red-gate bypass prohibited.

## MIG-010 historical verified boundary

Owner-private migration remains DONE/OWNER_VERIFIED: `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`. Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`.

Historical execution policy = `MIG010_EXECUTION_POLICY_V1@1.0.0`, strategy `STAGE_VERIFY_REPLACE_WITH_ROLLBACK_V1`. После finalize execution state должен оставаться `FINALIZED_PENDING_RECONCILIATION`; это **не** verified completion. Только отдельная owner-private post-write reconciliation с `unexplainedMismatch=0` переводит lifecycle в `OWNER_VERIFIED`.

GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; AI/CI не могут переиспользовать historical authorization для будущей financial mutation. **Current write authority = false**. Любой будущий irreversible financial write требует fresh exact-bound owner authorization.

## Current delivery

```text
PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification
```

DASH-086 остаётся open до green `Dashboard safe import/export` + full existing gates, immutable exact candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Read-only multi-AI review

Required roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers = `READ_ONLY`, `writer_authority=false`; review cannot override red machine gate.

## Scope handoff

Все R0/R1/R2, completed R3, YC-040/AUTH-040, R7, STUDIO-080, PRIV-080 и DASH-080..085 — DONE. YC-041/YC-042 remain BLOCKED. `DASH-086` / Issue #213 — единственный active writer.
