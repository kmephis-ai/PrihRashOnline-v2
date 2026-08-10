# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. Human documentation не может отменять красный machine gate.

Machine release model: `EXACT_SHA_AUTONOMOUS`; trusted delivery authority закреплена `CI-003`.

## R0 — critical path завершён, текущий optional writer

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — **complete**. `DOC-001`, `DOC-002`, `AIENG-001`, `AIENG-002`, `AIENG-003`, `AIENG-006`, `DR-001`, `OBS-001`, `FINOPS-001` — DONE/Main Verification PASS.

- `DOC-002` — **DONE**, Issue #75 Main Verification PASS, merge `8495dc730166f4e5fb7a03b5a7ab780501f6bbf5`.
- `AIENG-006` — **DONE**, Issue #146 Main Verification PASS, merge `0f7722c48dfc05b12efd861ecaa5d0b1f408c98a`.
- `AIENG-004` Reusable AI skills/playbooks — **IN_PROGRESS**, Issue #157, PR #158, branch `agent/AIENG-004-ai-playbooks`.

AIENG-004 authority: `PRH_AI_PLAYBOOK_CATALOG_V1@1.0.0`. Пять focused flows (`ROADMAP_EXECUTION`, `PR_REVIEW`, `MIGRATION_REVIEW`, `DOCS_DRIFT`, `RELEASE`) являются тонкими versioned adapters к существующим Roadmap/Issue/tests/policies и сами не выдают repository/issue/review/merge/deploy/financial-write authority. `PR_REVIEW` и `MIGRATION_REVIEW` остаются `READ_ONLY`, `writer_authority=false`. Required `AI playbooks` gate выполняет deterministic local scanner + adversarial contract test; отдельно оплачиваемый AI/API не требуется.

`LANG-RU` остаётся обязательным: русский — единственный нормативный язык human-facing документации/metadata/AI instructions; machine identifiers и названия стандартов не переводятся искусственно.

## R1 / Canonical Financial Platform — завершена

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; owner-private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS; `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`.
- `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010` — **DONE**.

`MASTER-G3 / Canonical platform` — **complete**; historical pre-close state: open. FIN authority: `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority: `PRH_CANONICAL_TRANSACTION_V1`. Repository authority: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## R2 / Family Finance Center

`DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020`, `EXP-020`, `INC-020`, `CF-020`, `BUD-020`, `OBL-020`, `DQ-020`, `PWA-020` — DONE/Main Verification PASS. `PROF-020` остаётся P2 backlog.

PWA boundary сохраняется: current Apps Script HtmlService service-worker activation = `NOT_PROVEN_CURRENT_HOST`; private financial/authenticated responses не кэшируются; private Web App остаётся `MYSELF`.

## R4 / Yandex Cloud shadow platform

- `YC-040` — **DONE**, Issue #141 Main Verification PASS, merge `924a44f4cb01e6add6c7fd9a0b166d7a7743b96a`.
- `AUTH-040` — **DONE**, Issue #142 Main Verification PASS, merge `455c7fdaaaee118369294d96183631d7322e5ea2`.
- `YC-041` — **BLOCKED**, Issue #148, `OWNER_CLOUD_BOOTSTRAP_REQUIRED`; blocker не имеет writer authority.
- `YC-042` — **BLOCKED**, Issue #149, `OWNER_YDB_TARGET_REQUIRED`; blocker не имеет writer authority.

Google остаётся authoritative; cloud blockers не создают billing-backed resources и не меняют canonical write ownership.

## R7 / Semantic Analytics

- `ANL-070` — **DONE**, Issue #150 Main Verification PASS, merge `d8b429221aa02416c4103bf58c2f3439f79ad0a9`.
- `SCOPE-070` — **DONE**, Issue #77 Main Verification PASS, merge `5eee6095562172ff0c887585aeaa85af4c12dff1`.
- `ANL-071` — **DONE**, Issue #153 Main Verification PASS, merge `136fa66ea5752c96b789e92911d75ce37226b62f`.
- `ANL-074` — **DONE**, Issue #155 Main Verification PASS, candidate `94e199308c3bd3f0b61c4c9e16355b7befef2ca9`, merge `b461bfea099a6b35b8f156975f405ed4d4b58af1`.

ANL-070 authority `PRH_ANALYTICS_SEMANTIC_REGISTRY_V1@1.0.0`; SCOPE-070 authority `PRH_ANALYTICS_SCOPE_V1@1.0.0`; ANL-071 authority `PRH_ANALYTICS_PERIOD_ENGINE_V1@1.0.0`; ANL-074 authority `PRH_EXPLORATION_STATE_V1@1.0.0`. Они не переопределяют FIN-TRUTH и не имеют financial-write authority.

ANL-072/BENCH-070/ANL-073 остаются downstream P2. `PERF-070` и `TEST-070` пока не dependency-ready.

## MIG-010 historical safety boundary

MIG-010 owner-private evidence remains `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Historical machine anchors: **Current write authority = false**. The **owner-verified MIG-010 private full-history reconciliation** remains completed correctness proof.

Execution policy remains `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion until post-write reconciliation PASS.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound/non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations. Any future irreversible financial write requires fresh exact-bound owner authorization.

## Executable AI engineering baseline

Root `AGENTS.md` is public-safe AI operating contract. `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` enforce one-writer continuation. Read-only multi-AI reviewers have `writer_authority=false`; machine gates and Main Verification remain authoritative.

`PRH_AI_MODEL_COST_ROUTING_V1@1.0.0` сохраняет required machine gates на `LOCAL_DETERMINISTIC`; separately billed OpenAI API default disabled и не требуется для required checks.

AIENG-004 добавляет reusable playbooks, но `catalog_grants_authority=false`, `source_of_truth_duplicated=false`, `paid_dependency_required=false`, `FREE_ONLY=true`. Red machine gate не может быть обойдён playbook-текстом.

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

AIENG-004 остаётся открытым до `AI playbooks` + LANG-RU/docs/AI/privacy/FREE_ONLY/full layered/UI/PWA PASS, immutable candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Current runtime truth

Private primary store/runtime: Google Sheets + Apps Script; family UI: private `MYSELF` Apps Script Web Dashboard. Public GitHub evidence is independently generated synthetic only. AIENG-004 меняет только repository AI governance/playbooks и не меняет runtime financial state/backend storage. `FREE_ONLY` mandatory.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.3 + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.
