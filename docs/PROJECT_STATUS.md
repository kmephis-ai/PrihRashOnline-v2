# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. Human documentation не может отменять красный machine gate.

Machine release model: `EXACT_SHA_AUTONOMOUS`; trusted delivery authority закреплена `CI-003`.

## R0 — завершён

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — **complete**. `DOC-001`, `DOC-002`, `AIENG-001`, `AIENG-002`, `AIENG-003`, `DR-001`, `OBS-001`, `FINOPS-001` — DONE/Main Verification PASS.

- `DOC-002` Русский нормативный контур — **DONE**, Issue #75 Main Verification PASS, merge `8495dc730166f4e5fb7a03b5a7ab780501f6bbf5`.

### Текущий governance writer

- `AIENG-006` Маршрутизация моделей/стоимости — **IN_PROGRESS**, Issue #146; current writer, branch `agent/AIENG-006-model-cost-routing`.

`LANG-RU` остаётся обязательным: русский — единственный нормативный язык human-facing документации/metadata/AI instructions; machine identifiers, API/schema fields, library/protocol/standard names и технические пути сохраняются без перевода.

## R1 / Canonical Financial Platform — завершена

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; owner-private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS; `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`.
- `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010` — **DONE**.

`MASTER-G3 / Canonical platform` — **complete**; historical pre-close state: open. FIN authority: `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority: `PRH_CANONICAL_TRANSACTION_V1`. Repository authority: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## R2 / Family Finance Center — P1 baseline завершён

`DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020`, `EXP-020`, `INC-020`, `CF-020`, `BUD-020`, `OBL-020`, `DQ-020`, `PWA-020` — DONE/Main Verification PASS. `PROF-020` остаётся P2 backlog.

PWA boundary сохраняется: current Apps Script HtmlService service-worker activation = `NOT_PROVEN_CURRENT_HOST`; private financial/authenticated responses не кэшируются; private Web App остаётся `MYSELF`.

## R4 / Yandex Cloud shadow platform

- `YC-040` — **DONE**, Issue #141 Main Verification PASS, merge `924a44f4cb01e6add6c7fd9a0b166d7a7743b96a`.
- `AUTH-040` — **DONE**, Issue #142 Main Verification PASS, merge `455c7fdaaaee118369294d96183631d7322e5ea2`.

YC-040 остаётся offline YDB schema/adapter/cost-guard PoC: Google authoritative, YDB canonical write owner=false, real replication=false. AUTH-040 остаётся provider-neutral auth reference policy: current Apps Script access `MYSELF`, public exposure unchanged, backend financial write granted=false.

## AIENG-006 current boundary

Machine contract: `PRH_AI_MODEL_COST_ROUTING_V1@1.0.0`. Core: `lib/ai/model_cost_routing.js`. Normative doc: `docs/operations/AIENG006_MODEL_COST_ROUTING.md`. Test: `tests/ai_model_cost_routing_contract_test.js`.

- `SOL`, `TERRA`, `LUNA` — внутренние workload lanes, не vendor model IDs и не гарантированные entitlements.
- `MACHINE_GATE` всегда выполняется через `LOCAL_DETERMINISTIC` и не зависит от model availability.
- AI-assisted engineering использует только доступные subscription lanes по deterministic fallback order.
- `UNKNOWN` не считается available; если required AI capacity отсутствует — `PAUSE_REQUIRED_WORK`, optional — `DEFER_OPTIONAL`.
- OpenAI API рассматривается как separately billed surface, `enabled=false`; automatic API fallback/billing запрещены.
- ChatGPT subscription и API billing не смешиваются; current account/model availability не hard-code'ится.
- routing telemetry содержит только allowlisted техническую metadata, без prompts/responses/financial/account/billing-token payload.
- machine gate bypass=false; paid API required=false; `FREE_ONLY` mandatory.

## MIG-010 historical safety boundary

MIG-010 owner-private evidence remains `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Historical machine anchors: **Current write authority = false**. The **owner-verified MIG-010 private full-history reconciliation** remains completed correctness proof.

Execution policy remains `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion until post-write reconciliation PASS.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound/non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations. Any future irreversible financial write requires fresh exact-bound owner authorization.

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

## Current runtime truth

Private primary store/runtime: Google Sheets + Apps Script; family UI: private `MYSELF` Apps Script Web Dashboard. Public GitHub evidence is independently generated synthetic only. AIENG-006 не делает API calls, не включает billing и не меняет financial/runtime state. `FREE_ONLY` mandatory.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.3 + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.
