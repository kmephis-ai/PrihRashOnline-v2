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
- `DASH-080` — **DONE**, Issue #198 Main Verification PASS, candidate `0ce4b43546df67ac6c8c8a0b19629680d7dad405`, merge `70b84350e36e125cea7bdbc396ec967a398fdf1f`.
- `DASH-081` — **DONE**, Issue #200 Main Verification PASS, candidate `5752b963a528ccdabf307531dff426a9cfbe59a1`, merge `da42188741dcd035684cec900728ea53d5c961a2`.
- `DASH-082` — **DONE**, Issue #202 Main Verification PASS, candidate `c740a2c8aaf6e8d3da2c48bc2148bffd325a44aa`, merge `ac565189bc70133f127bdea471a50d0efae94443`.
- `DASH-083` — **DONE**, Issue #204 Main Verification PASS, candidate `c2fc3810c54a88c8aeca8b89ebd86e3784dbef46`, merge `98b0e54413bfc6e9742d78fa2befd507341f5141`.
- `DASH-084` — **DONE**, Issue #206 Main Verification PASS, candidate `3626aab53c2a3b71ffff5dc0be579c061517a893`, merge `06e96ad4cb4d03f9447467224ec66dddea470238`.
- `DASH-085` — **IN_PROGRESS**, canonical Issue #209, branch `agent/DASH-085-visual-customization`; единственный current writer.

DASH-080 сохраняет `PRH_DASHBOARD_COMPOSER_V1@1.0.0`: deterministic 12-column layout, responsive derivation и placeholders `semantic_binding_status=UNBOUND`.

DASH-081 сохраняет `PRH_WIDGET_FACTORY_V1@1.0.0`: `KPI/CARD/CHART/TABLE/PIVOT`, canonical AnalyticsQuery/binding identity, explicit `UNBOUND -> BOUND`, no financial/query-execution authority.

DASH-082 сохраняет `PRH_DASHBOARD_INTERACTION_BUS_V1@1.0.0`: global FilterContext only, origin dedup/hop protection, ANL-074 RESET/BACK delegation.

DASH-083 сохраняет `PRH_DASHBOARD_DRILL_V1@1.0.0`: `YEAR -> QUARTER -> MONTH -> DAY`, ID-only category/account hierarchies, TX-020 drill-through и FIN-backed `INCOME/EXPENSE/CASH_FLOW` reconciliation. Mismatch fail closed.

DASH-084 сохраняет `PRH_DASHBOARD_SAVED_VIEWS_V1@1.0.0`. Saved view содержит только canonical DASH-080 layout + zero-or-more separately validated DASH-081 bound descriptors. AnalyticsResult, transaction rows/datasets, calculated output values, runtime locators и secrets в saved documents запрещены.

Private persistence = namespaced Apps Script `PropertiesService.getUserProperties()`; financial Sheets, ScriptProperties, DocumentProperties и required browser storage не используются. `LockService.getUserLock()` + optimistic store generation защищают от stale overwrite. Runtime adapter выполняет index+view/tombstone update одним `setProperties()` batch.

Saved lifecycle: CREATE, CREATE_FROM_PRESET, SAVE_VERSION, CLONE, RENAME, RESET, RESTORE_REVISION, DELETE, MIGRATE. Identical save = deterministic NOOP. Restore/reset добавляют новую immutable revision, а не переписывают history. Limits: 24 views, 6 revisions/view, 7 KB config, 8 KB view document, 6 KB index.

Curated starter presets: `FAMILY`, `EXPENSE`, `INCOME`, `CASH_FLOW`, `BUDGET`, `NET_WORTH`, `RISK`, `SUBSCRIPTIONS`. Они editable/cloneable и не содержат financial dataset snapshots.

DASH-084 имеет только `dashboard_config_storage=true`; `financial_truth`, `financial_write`, `query_execution`, `query_mutation`, `canonical_financial_mutation`, `authorization`, `network`, `deployment`, `renderer`, `layout` остаются false.

DASH-085 вводит `PRH_DASHBOARD_VISUAL_CUSTOMIZATION_V1@1.0.0` как presentation-only customization layer поверх DESIGN-020, DASH-081 и VIZ-070. Theme `SYSTEM/LIGHT/DARK`, density `COMPACT/COMFORTABLE`, palette registry, chart retype, axes/labels/legend/stack/sort/Top-N/number format являются bounded configuration; arbitrary CSS/hex/RGB/formatter/HTML/SVG запрещены.

Chart retype полностью делегирован VIZ-070 и обязан сохранять исходные DASH-081 `query_hash` и `binding_hash`; `query_modified=false`, `binding_modified=false`. Top-N работает только как presentation transform над уже полученным semantic result, использует explicit `__OTHER__` и проверяет точное сохранение total. DESIGN-020 остаётся владельцем theme/focus/contrast/reduced-motion tokens.

DASH-085 не имеет `financial_truth`, `financial_write`, `query_execution`, `query_mutation`, `binding_mutation`, `canonical_mutation`, `authorization`, `storage`, `network`, `deployment` или `renderer` authority. Public evidence synthetic/configuration-only; telemetry содержит только technical enums/hash prefixes/decision/reason без financial/private payload. `FREE_ONLY` обязателен.

Named gate current writer: `Dashboard visual customization` (`PURE_DOMAIN_APPLICATION`). Existing DASH-084/DASH-083/DASH-082/DASH-081/PRIV/STUDIO/DESIGN/VIZ/ANL/TX/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA gates обязаны оставаться green.

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

DASH-085 остаётся открытым до green `Dashboard visual customization` + existing DASH-084/DASH-083/DASH-082/DASH-081/PRIV/STUDIO/DESIGN/VIZ/ANL/TX/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA gates, immutable exact candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Current runtime truth

Private primary financial store/runtime: Google Sheets + Apps Script. Canonical default Web App route остаётся R2 Financial Home. DASH-084 использует отдельный private per-user configuration store в Apps Script UserProperties; он не является financial database и не меняет canonical data/write ownership. DASH-085 добавляет только transient presentation configuration/plan и не добавляет storage/query execution/financial authority. Public GitHub evidence synthetic/configuration-only. Private UI remains `MYSELF`; `FREE_ONLY` mandatory.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.3 + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.
