# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. Human documentation не может отменять красный machine gate.

Machine release model: `EXACT_SHA_AUTONOMOUS`; trusted delivery authority закреплена `CI-003`.

## R0 — critical path завершён

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — **complete**. `DOC-001`, `DOC-002`, `AIENG-001`, `AIENG-002`, `AIENG-003`, `AIENG-004`, `AIENG-005`, `AIENG-006`, `DR-001`, `OBS-001`, `FINOPS-001` — DONE/Main Verification PASS.

- `AIENG-004` — **DONE**, Issue #157 Main Verification PASS, merge `280dea294b086fae3cedf56df7899c9938b42b88`.
- `AIENG-005` — **DONE**, Issue #159 Main Verification PASS, merge `5fe90929f5f266fcd92bbc9745f78107083f6b5c`.
- `AIENG-006` — **DONE**, Issue #146 Main Verification PASS, merge `0f7722c48dfc05b12efd861ecaa5d0b1f408c98a`.

`LANG-RU` обязателен. `PRH_AI_PLAYBOOK_CATALOG_V1@1.0.0` не создаёт authority; PR/Migration review остаются READ_ONLY.

## R1 / Canonical Financial Platform — завершена

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; owner-private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS; `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`.
- `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010` — **DONE**.

`MASTER-G3 / Canonical platform` — **complete**; historical pre-close state: open. FIN authority: `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority: `PRH_CANONICAL_TRANSACTION_V1`. Repository authority: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Post-R1 handoff начинается с `DESIGN-020`; historical lifecycle anchor сохраняется после завершения R2.

## R2 / Family Finance Center — canonical UI cutover завершён

`DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020`, `EXP-020`, `INC-020`, `CF-020`, `BUD-020`, `OBL-020`, `DQ-020`, `PWA-020`, `PROF-020`, `UI-MIG-020` — DONE/Main Verification PASS.

- `TX-020` — **DONE**, Issue #124 Main Verification PASS, merge `38a6d6bece459f61a2cf3d9af2cd8419274b258b`.
- `UI-MIG-020` — **DONE**, Issue #172 Main Verification PASS, candidate `867fda74824f91bf3931aa3e6ea39d1c7d4dfc1e`, merge `0a87bab34f29897fa781a030797a9a040fb200a3`.

Canonical private Web App default route = R2 `FinancialHomeWebApp`; legacy Dashboard остаётся bounded rollback route. Private Home использует generated canonical-lib runtime; `PRH_RUNTIME_DIMENSION_LABEL_HASH_V1` — transient read-only adapter identity (`persistent_identity_authority=false`), `financial_formula_copy=false`. Authenticated private Home smoke V3 и exact-head Trusted Runtime Health = PASS. Web App остаётся `MYSELF`; `NOT_PROVEN_CURRENT_HOST` PWA boundary сохраняется; `FREE_ONLY` обязателен.

## R3 / Planning, Wealth, Decision Intelligence

`TREND-030`, `PROJ-030`, `GOAL-030`, `BAL-030`, `NW-030`, `SUB-030` — DONE/Main Verification PASS. SUB-030 остаётся precision-first: `auto_confirm=false`, `auto_create_obligation=false`, `canonical_mutation=false`, `financial_write=false`, `financial_truth=false`; fuzzy/LLM matching не authority. Public evidence synthetic-only; `FREE_ONLY` mandatory.

BAL authority remains `PRH_BALANCE_RECONCILIATION_V1@1.0.0`; no implicit zero balance. NW authority remains `PRH_NET_WORTH_V1@1.0.0`; no silent FX/market valuation and `financial_truth=false` for valuation layer.

## R4 / Yandex Cloud shadow platform

- `YC-040` — **DONE**, Issue #141 Main Verification PASS.
- `AUTH-040` — **DONE**, Issue #142 Main Verification PASS.
- `YC-041` — **BLOCKED**, Issue #148, `OWNER_CLOUD_BOOTSTRAP_REQUIRED`; writer authority отсутствует.
- `YC-042` — **BLOCKED**, Issue #149, `OWNER_YDB_TARGET_REQUIRED`; writer authority отсутствует.

Google остаётся authoritative; cloud blockers не создают billing-backed resources и не меняют canonical write ownership.

## R7 / Semantic Analytics — завершена

`ANL-070`, `SCOPE-070`, `ANL-071`, `ANL-072`, `BENCH-070`, `ANL-074`, `ANL-073`, `PERF-070`, `TEST-070`, `VIZ-070` — DONE/Main Verification PASS. `MASTER-G7 / Semantic analytics` — **complete**.

- `ANL-074` — Issue #155 Main Verification PASS, merge `b461bfea099a6b35b8f156975f405ed4d4b58af1`.
- `ANL-073` — Issue #186 Main Verification PASS, merge `116b950cf4ae66b813dff3cf7c8803afeb6baea6`.
- `VIZ-070` — Issue #192 Main Verification PASS, candidate `444067f9e411f798668c4a109eb751903c9d5720`, merge `13091bb5ba731673bae5357ae7b22b64475592c3`.

VIZ-070 authority остаётся `PRH_VISUALIZATION_REGISTRY_V2@2.0.0`; no financial/query/storage/network authority.

## R8 / Analytics Studio, privacy и dashboard platform

- `STUDIO-080` — **DONE**, Issue #194 Main Verification PASS, merge `432c2bc663e2fc5106bdc96031130673b7b76dce`.
- `PRIV-080` — **DONE**, Issue #79 Main Verification PASS, merge `0cf3ebfeaad4b78060d7cad6addb441230321877`.
- `DASH-080` — **DONE**, Issue #198 Main Verification PASS, merge `70b84350e36e125cea7bdbc396ec967a398fdf1f`.
- `DASH-081` — **DONE**, Issue #200 Main Verification PASS, merge `da42188741dcd035684cec900728ea53d5c961a2`.
- `DASH-082` — **DONE**, Issue #202 Main Verification PASS, merge `ac565189bc70133f127bdea471a50d0efae94443`.
- `DASH-083` — **DONE**, Issue #204 Main Verification PASS, merge `98b0e54413bfc6e9742d78fa2befd507341f5141`.
- `DASH-084` — **DONE**, Issue #206 Main Verification PASS, candidate `3626aab53c2a3b71ffff5dc0be579c061517a893`, merge `06e96ad4cb4d03f9447467224ec66dddea470238`.
- `DASH-085` — **DONE**, canonical Issue #208 Main Verification PASS; product PR #211 candidate `285f191be613355fd698260419bf5ac509ac19fa`, recovery PR #212 candidate `f6a427e0bff57857dad69c745b0850346524d745`, final recovery merge `7aeb044ffed8378d0a4aa3894d60b10caf309f2b`. Duplicate Issue #209 / PR #210 closed without merge and `writer_authority=false`.
- `DASH-086` — **IN_PROGRESS**, canonical Issue #213, branch `agent/DASH-086-safe-dashboard-import-export`; единственный current writer.

DASH-080 сохраняет `PRH_DASHBOARD_COMPOSER_V1@1.0.0`; DASH-081 — `PRH_WIDGET_FACTORY_V1@1.0.0`; DASH-082 — `PRH_DASHBOARD_INTERACTION_BUS_V1@1.0.0`; DASH-083 — `PRH_DASHBOARD_DRILL_V1@1.0.0`; их layout/query/filter/drill authorities не передаются portable layer.

DASH-084 сохраняет `PRH_DASHBOARD_SAVED_VIEWS_V1@1.0.0`: private per-user configuration store через Apps Script UserProperties, bounded immutable revisions/presets, no financial dataset snapshots. Persistence остаётся отдельным явным lifecycle call.

DASH-085 сохраняет `PRH_DASHBOARD_VISUAL_CUSTOMIZATION_V1@1.0.0`: presentation-only configuration, DESIGN-020 tokens, VIZ-070 retype/query-hash invariant, ANL-072 Top-N semantics, no financial/query/storage authority.

DASH-086 вводит `PRH_DASHBOARD_PORTABLE_SPEC_V1@1.0.0`. Portable payload содержит только normalized DASH-084 configuration и отдельно валидированные DASH-085 customization descriptors. `AnalyticsResult`, transaction rows/datasets, amounts/balances/KPI outputs, credentials/tokens, Apps Script/runtime/deployment locators и executable CSS/HTML/script/URL запрещены рекурсивно.

Portable file имеет privacy class `PRIVATE_CONFIGURATION` и warning `PRIVATE_CONFIGURATION_NOT_PUBLIC_SAFE`: canonical query/filter/dimension IDs разрешены внутри private export, поэтому файл нельзя публиковать как public artifact. Public GitHub evidence synthetic-only.

Import использует bounded JSON parser: 64 KiB ceiling, max depth 32, max string 8192, max 48 widgets/bindings/customizations. Duplicate JSON keys и `__proto__/prototype/constructor` fail closed. Checksum проверяется над raw payload **до** semantic normalization; затем DASH-080/081/084/085 validators заново вычисляют/проверяют identities. Imported hashes не получают authority.

Import result = `DRY_RUN_ONLY`, `persistence_performed=false`, `persistence_authority=false`. DASH-086 core не вызывает `PropertiesService`, financial Sheets или network; сохранение возможно только отдельным explicit DASH-084 lifecycle/storage call с generation/limit checks. Partial mutation из portable core невозможна.

Explicit legacy `PRH_DASHBOARD_PORTABLE_SPEC_V0@0.9.0 -> V1` migration возвращает deterministic receipt и остаётся dry-run. Unknown/future schema fail closed. Re-export успешно импортированного current V1 обязан быть canonical byte-identical.

Все DASH-086 authority = false: financial truth/write, query execution/mutation, binding/canonical mutation, authorization, storage/persistence, network, deployment, renderer. `FREE_ONLY` обязателен.

Named gate current writer: `Dashboard safe import/export` (`PURE_DOMAIN_APPLICATION`). Existing DASH-085..080/PRIV/STUDIO/VIZ/DESIGN/ANL/FIN/MIG/privacy/security/FREE_ONLY/full layered/UI/PWA gates обязаны оставаться green.

Trusted runtime reliability bootstrap #185 merged in `7794f1d73631cc50ac1d603758ddec85acdec6b5`: retry только для exact `RUNTIME_HEALTH_BUILD_MISMATCH`, stale build не считается healthy, остальные failures fail-fast.

## MIG-010 historical safety boundary

MIG-010 owner-private evidence remains `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Historical machine anchors: **Current write authority = false**. The **owner-verified MIG-010 private full-history reconciliation** remains completed correctness proof.

Execution policy remains `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion until post-write reconciliation PASS.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound/non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations. Any future irreversible financial write requires fresh exact-bound owner authorization.

## Executable AI engineering baseline

Root `AGENTS.md` is the public-safe repository AI operating contract. `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` enforce one-writer continuation. Read-only multi-AI reviewers have `writer_authority=false`; machine gates and Main Verification remain authoritative.

## Current delivery chain

```text
active Roadmap Issue
-> agent/<ID>-<slug> PR to main
-> PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification -> Issue DONE
```

DASH-086 остаётся открытым до green `Dashboard safe import/export` + existing DASH-085..080/PRIV/STUDIO/VIZ/DESIGN/ANL/FIN/MIG/privacy/security/FREE_ONLY/full layered/UI/PWA gates, immutable exact candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Current runtime truth

Private primary financial store/runtime: Google Sheets + Apps Script. Canonical default Web App route остаётся R2 Financial Home. DASH-084 UserProperties остаётся только private dashboard-configuration storage. DASH-086 добавляет portable private configuration envelope и dry-run import, но не новый financial/config persistence authority. Public GitHub evidence synthetic/configuration-only. Private UI remains `MYSELF`; `FREE_ONLY` mandatory.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.3 + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.
