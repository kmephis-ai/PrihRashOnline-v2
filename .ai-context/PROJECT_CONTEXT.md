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

## Current R0 truth

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`, `AIENG-006 = DONE`, `DOC-001 = DONE`, `DOC-002 = DONE`, `FINOPS-001 = DONE`.

`DOC-002` Issue #75 — DONE/Main Verification PASS, merge `8495dc730166f4e5fb7a03b5a7ab780501f6bbf5`; `PRH_LANGUAGE_POLICY_V1@1.0.0` mandatory. `AIENG-006` Issue #146 — DONE/Main Verification PASS, merge `0f7722c48dfc05b12efd861ecaa5d0b1f408c98a`; required machine gates остаются `LOCAL_DETERMINISTIC`, separately billed API default disabled.

`AIENG-004` — current writer, Issue #157, PR #158, branch `agent/AIENG-004-ai-playbooks`. Machine authority: `PRH_AI_PLAYBOOK_CATALOG_V1@1.0.0`. Required playbooks: `ROADMAP_EXECUTION`, `PR_REVIEW`, `MIGRATION_REVIEW`, `DOCS_DRIFT`, `RELEASE`.

AIENG-004 rules:

- catalog/playbook text **не является новым source of truth** и не создаёт authority;
- `catalog_grants_authority=false`; все repository/issue/review/merge/deploy/financial-write grants = false;
- `PR_REVIEW` и `MIGRATION_REVIEW` = `READ_ONLY`, `writer_authority=false`;
- Roadmap execution сохраняет `PRH_ROADMAP_TASK_V1`, один active writer, same Roadmap item при red recovery и DONE только после Main Verification;
- release playbook только наблюдает `PR Validation -> Trusted DEV Deploy -> Trusted Runtime Health -> CI-003 autonomous squash merge -> Main Verification`; ручной merge запрещён;
- deterministic `tools/ai-playbook-scan.js` проверяет catalog↔files, metadata, required markers, русский текст, размер и authority boundaries;
- `tests/ai_playbook_contract_test.js` adversarially проверяет missing/duplicate file, unsafe authority, missing marker, metadata mismatch, insufficient Russian text, oversized playbook и catalog authority drift;
- `AI playbooks` = required POLICY_GOVERNANCE gate; отдельно оплачиваемый model/API не нужен; `FREE_ONLY` mandatory.

## Current R1 truth

`MASTER-G3 / Canonical platform` — complete. Independently generated synthetic 20k/50k performance = PASS.

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS; `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`.
- `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010` — **DONE**.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository authority. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Current R2 truth

DESIGN-020, VIZ-020, HOME-020, TX-020, EXP-020, INC-020, CF-020, BUD-020, OBL-020, DQ-020 and PWA-020 are DONE/Main Verification PASS. `PROF-020` remains P2 backlog. `NOT_PROVEN_CURRENT_HOST` remains the current Apps Script HtmlService service-worker state; private financial/authenticated responses are never allowed in PWA cache.

## Current R4 truth

- `YC-040` — **DONE**, Issue #141 Main Verification PASS, merge `924a44f4cb01e6add6c7fd9a0b166d7a7743b96a`.
- `AUTH-040` — **DONE**, Issue #142 Main Verification PASS, merge `455c7fdaaaee118369294d96183631d7322e5ea2`.
- `YC-041` — **BLOCKED**, Issue #148, `OWNER_CLOUD_BOOTSTRAP_REQUIRED`, `writer_authority=false`.
- `YC-042` — **BLOCKED**, Issue #149, `OWNER_YDB_TARGET_REQUIRED`, `writer_authority=false`.

Google remains authoritative. Blocked cloud items не создают live cloud resources/billing-backed infrastructure и не меняют write ownership.

## Current R7 truth

- `ANL-070` — **DONE**, Issue #150 Main Verification PASS, merge `d8b429221aa02416c4103bf58c2f3439f79ad0a9`; authority `PRH_ANALYTICS_SEMANTIC_REGISTRY_V1@1.0.0`.
- `SCOPE-070` — **DONE**, Issue #77 Main Verification PASS, merge `5eee6095562172ff0c887585aeaa85af4c12dff1`; authority `PRH_ANALYTICS_SCOPE_V1@1.0.0`.
- `ANL-071` — **DONE**, Issue #153 Main Verification PASS, merge `136fa66ea5752c96b789e92911d75ce37226b62f`; authority `PRH_ANALYTICS_PERIOD_ENGINE_V1@1.0.0`.
- `ANL-074` — **DONE**, Issue #155 Main Verification PASS, candidate `94e199308c3bd3f0b61c4c9e16355b7befef2ca9`, merge `b461bfea099a6b35b8f156975f405ed4d4b58af1`; authority `PRH_EXPLORATION_STATE_V1@1.0.0`.

ANL-072/BENCH-070/ANL-073 remain P2 backlog; PERF-070/TEST-070 are not dependency-ready.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. `ai_playbook_contract_test.js` belongs to `POLICY_GOVERNANCE`; named `AI playbooks` gate runs scanner + contract before the full layered suite. Existing semantic/scope/period/exploration tests remain independently classified.

## AI model/cost routing boundary

`SOL`, `TERRA`, `LUNA` — internal workload lanes, а не guaranteed vendor entitlements. Required `MACHINE_GATE` выполняется через `LOCAL_DETERMINISTIC`; `OPENAI_API` — separately billed surface, `enabled=false`, automatic billing/API fallback запрещён. Red machine gate не обходится.

## MIG-010 historical verified boundary

Owner-private migration remains DONE/OWNER_VERIFIED with `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed occurrence identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Authorized execution was governed by `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion until post-write reconciliation PASS.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` is exact-bound and non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations. Generic Google financial write remains blocked by `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`. Current write authority = false. The owner-verified MIG-010 private full-history reconciliation remains complete.

## Current delivery

```text
PR Validation
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification
```

AIENG-004 remains open until `AI playbooks` + LANG-RU/docs/AI/privacy/FREE_ONLY/full layered/UI/PWA evidence are green, exact candidate passes trusted deploy/runtime health and Main Verification closes Issue #157.

## Read-only multi-AI review

Required roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority=false`; review never overrides red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data stays private. Family Web App remains private `MYSELF`. AIENG-004 is repository governance only: `financial_write=false`, runtime/network/storage/deployment authority=false. `FREE_ONLY` remains mandatory.

## Scope handoff

All R1 items, R2 P1 baseline, YC-040, AUTH-040, DOC-002, AIENG-006, ANL-070, SCOPE-070, ANL-071 and ANL-074 are DONE. YC-041/YC-042 are BLOCKED without writer authority. `MASTER-G3 = complete`. `AIENG-004` is the single active writer.
