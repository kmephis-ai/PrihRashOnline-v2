# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. Human documentation не может отменять красный machine gate.

Machine release model: `EXACT_SHA_AUTONOMOUS`; trusted delivery authority закреплена `CI-003`.

## R0 — critical path завершён

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — **complete**. `DOC-001`, `DOC-002`, `AIENG-001`, `AIENG-002`, `AIENG-003`, `AIENG-004`, `AIENG-005`, `AIENG-006`, `DR-001`, `OBS-001`, `FINOPS-001` — DONE/Main Verification PASS.

- `AIENG-004` — **DONE**, Issue #157 Main Verification PASS, merge `280dea294b086fae3cedf56df7899c9938b42b88`.
- `AIENG-005` — **DONE**, Issue #159 Main Verification PASS, merge `5fe90929f5f266fcd92bbc9745f78107083f6b5c`.
- `AIENG-006` — **DONE**, Issue #146 Main Verification PASS, merge `0f7722c48dfc05b12efd861ecaa5d0b1f408c98a`.

`LANG-RU` обязателен. PR/Migration review остаются READ_ONLY; machine gates и Main Verification выше human summary.

## R1 / Canonical Financial Platform — завершена

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; owner-private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS; `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`.
- `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010` — **DONE**.

`MASTER-G3 / Canonical platform` — **complete**; historical pre-close state: open. FIN authority = `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority = `PRH_CANONICAL_TRANSACTION_V1`. Repository authority = `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Post-R1 handoff historically начинается с `DESIGN-020`; этот lifecycle anchor сохраняется после завершения R2–R8.

## R2 / Family Finance Center — завершена

`DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020`, `EXP-020`, `INC-020`, `CF-020`, `BUD-020`, `OBL-020`, `DQ-020`, `PWA-020`, `PROF-020`, `UI-MIG-020` — DONE/Main Verification PASS.

Canonical private Web App default route = R2 Financial Home; legacy Dashboard остаётся bounded rollback route. Web App остаётся `MYSELF`; `NOT_PROVEN_CURRENT_HOST` PWA boundary и `FREE_ONLY` сохраняются.

## R3 / Planning, Wealth, Decision Intelligence

`TREND-030`, `PROJ-030`, `GOAL-030`, `BAL-030`, `NW-030`, `SUB-030` — DONE/Main Verification PASS. SUB-030 precision-first и не имеет automatic canonical mutation/financial truth authority.

## R4 / Yandex Cloud shadow platform

- `YC-040` — **DONE**, Issue #141 Main Verification PASS.
- `AUTH-040` — **DONE**, Issue #142 Main Verification PASS.
- `YC-041` — **BLOCKED**, Issue #148, `OWNER_CLOUD_BOOTSTRAP_REQUIRED`; `writer_authority=false`.
- `YC-042` — **BLOCKED**, Issue #149, `OWNER_YDB_TARGET_REQUIRED`; `writer_authority=false`.

Google остаётся authoritative; cloud blockers не создают billing-backed resources и не меняют canonical write ownership.

## R7 / Semantic Analytics — завершена

`ANL-070`, `SCOPE-070`, `ANL-071`, `ANL-072`, `BENCH-070`, `ANL-073`, `ANL-074`, `PERF-070`, `TEST-070`, `VIZ-070` — DONE/Main Verification PASS. `MASTER-G7 / Semantic analytics` — **complete**.

- `ANL-074` — Issue #155 Main Verification PASS, merge `b461bfea099a6b35b8f156975f405ed4d4b58af1`.
- `VIZ-070` — Issue #192 Main Verification PASS, merge `13091bb5ba731673bae5357ae7b22b64475592c3`.

VIZ-070 authority остаётся `PRH_VISUALIZATION_REGISTRY_V2@2.0.0`; BAR/LINE/DONUT и renderer/query boundaries остаются canonical.

## R8 / Analytics Studio — завершена

`STUDIO-080`, `PRIV-080`, `DASH-080`, `DASH-081`, `DASH-082`, `DASH-083`, `DASH-084`, `DASH-085`, `DASH-086` — DONE/Main Verification PASS. `MASTER-G8 / Analytics Studio` — **complete**.

- `DASH-084` — Issue #206 DONE/Main Verification PASS, candidate `3626aab53c2a3b71ffff5dc0be579c061517a893`, merge `06e96ad4cb4d03f9447467224ec66dddea470238`.
- `DASH-085` — canonical Issue #208 DONE/Main Verification PASS; recovery merge `7aeb044ffed8378d0a4aa3894d60b10caf309f2b`. Duplicate Issue #209 / PR #210 closed without merge, `writer_authority=false`.
- `DASH-086` — Issue #213 DONE/Main Verification PASS, candidate `e3b78983a22316ae533e94e84135fe5bc4426c58`, merge `a7a73889a4f5deff15e086b5469f00f240cab6e0`.

R8 final guarantees: responsive composer, semantic bindings, cross-filter, drill-through, private saved views, wide visual customization и safe portable dashboard configuration работают без переноса FIN-TRUTH/query/write authority в dashboard layer. DASH-086 import остаётся `DRY_RUN_ONLY`; persistence выполняется только отдельным explicit DASH-084 lifecycle call.

## R9 / Advanced Financial Analytics & Visual Intelligence

- `VIZ-090` — **IN_PROGRESS**, canonical Issue #215, branch `agent/VIZ-090-advanced-visualization-pack`; единственный current writer.

VIZ-090 вводит `PRH_ADVANCED_VISUALIZATION_PACK_V1@1.0.0` поверх VIZ-070 и canonical AnalyticsQuery. Advanced pack регистрирует 18 families: AREA, GROUPED/STACKED/PERCENT_STACKED_BAR, WATERFALL, SANKEY, TREEMAP, SUNBURST, CALENDAR/MATRIX_HEATMAP, PARETO, SCATTER, BUBBLE, HISTOGRAM, BOX, VIOLIN, SMALL_MULTIPLES, BULLET_KPI. Existing LINE остаётся canonical VIZ-070 baseline.

Каждый advanced plan получает уже вычисленный semantic source с exact `query_hash` и versioned `source_contract`. Planner не меняет measures/dimensions/filters/grain/scope/comparison; `query_modified=false`, `financial_truth_policy=FIN-TRUTH-v1`.

Machine invariants VIZ-090:

- percent stack сохраняет source values и deterministic exact 10000 bps для positive-total category;
- waterfall требует `START + Σ DELTA = END`;
- Sankey non-negative/bounded topology и `causality_claimed=false`;
- hierarchy требует one root/no orphan/no disconnected cycle и exact parent=children reconciliation;
- heatmap различает missing (`present=false,value=null`) и explicit zero;
- Pareto сохраняет total и завершается exact `10000 bps`;
- scatter/bubble не создают correlation/causality claims;
- histogram/box/violin требуют explicit bounded samples;
- small multiples bounded, facets не drop’ятся silently;
- bullet KPI требует explicit upstream reference/target provenance.

Primary renderer остаётся VIZ-070 `ECHARTS_6` с `LOCAL_OR_BUNDLED`, replaceable=true и без network/query/financial authority. Для каждого advanced family обязательны `SEMANTIC_TABLE_V1` + text-summary fallback; assistive mode активирует table renderer.

VIZ-090 telemetry содержит только chart/renderer/hash-prefix/count/responsive/decision/reason metadata. Private runtime values/labels не попадают в telemetry; public tests independently generated synthetic-only. Все financial/query/storage/network/auth/deployment authorities остаются false; `FREE_ONLY` mandatory.

Named current gate: `Advanced visualization pack` (`PURE_DOMAIN_APPLICATION`). Existing VIZ-070/DASH-086..080/ANL/PRIV/STUDIO/DESIGN/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA gates обязаны оставаться green.

## MIG-010 historical safety boundary

MIG-010 owner-private evidence remains `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. **Current write authority = false**. Owner-verified private full-history reconciliation remains completed correctness proof.

Execution policy remains `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion until separate post-write reconciliation PASS.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound/non-reusable. GitHub Actions cannot create it; AI/CI cannot reuse it for later mutations. Any future irreversible financial write requires fresh exact-bound owner authorization.

## Executable AI engineering baseline

Root `AGENTS.md` is public-safe AI operating contract. `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` enforce one-writer continuation. Read-only multi-AI reviewers have `writer_authority=false`; machine gates and Main Verification remain authoritative.

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

VIZ-090 остаётся открытым до green `Advanced visualization pack` + existing gates, immutable exact candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Current runtime truth

Private primary financial store/runtime = Google Sheets + Apps Script. Canonical default Web App route = R2 Financial Home. R8 UserProperties/portable boundaries остаются configuration-only. VIZ-090 добавляет pure semantic presentation planner и не читает financial storage. Public GitHub evidence synthetic/configuration-only; private UI remains `MYSELF`; `FREE_ONLY` mandatory.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.3 + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.
