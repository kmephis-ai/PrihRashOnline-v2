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

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`, `AIENG-004 = DONE`, `AIENG-006 = DONE`, `DOC-001 = DONE`, `DOC-002 = DONE`, `FINOPS-001 = DONE`.

`DOC-002` Issue #75 — DONE/Main Verification PASS, merge `8495dc730166f4e5fb7a03b5a7ab780501f6bbf5`; `PRH_LANGUAGE_POLICY_V1@1.0.0` mandatory. `AIENG-004` Issue #157 — DONE/Main Verification PASS, candidate `515f5d8961c57b4e6dbb3a28b8d09323638a5968`, merge `280dea294b086fae3cedf56df7899c9938b42b88`; authority `PRH_AI_PLAYBOOK_CATALOG_V1@1.0.0`. `AIENG-006` Issue #146 — DONE/Main Verification PASS, merge `0f7722c48dfc05b12efd861ecaa5d0b1f408c98a`.

AI playbooks remain thin adapters: `catalog_grants_authority=false`, source of truth не дублируется, PR/Migration review остаются `READ_ONLY`, `writer_authority=false`, release playbook не даёт merge/deploy authority.

## Current R1 truth

`MASTER-G3 / Canonical platform` — complete. Independently generated synthetic 20k/50k performance = PASS.

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS; `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`.
- `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010` — **DONE**.
- `AIENG-005` — **current writer**, Issue #159, branch `agent/AIENG-005-ai-eval-suite`; IN_PROGRESS до Main Verification.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository authority. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

AIENG-005 machine contract: `lib/ai/ai_eval_suite.v1.json` (`PRH_AI_EVAL_SUITE_V1@1.0.0`). Evaluator: `lib/ai/ai_eval_suite.js`. Runner: `tools/ai-eval-runner.js`. Baseline: `tests/fixtures/ai_eval_baseline.v1.json` (`PRH_AI_EVAL_BASELINE_V1@1.0.0`). Contract test: `tests/ai_eval_suite_contract_test.js`. Normative doc: `docs/operations/AIENG005_AI_REGRESSION_EVAL.md`. Named gate: `AI regression eval`.

AIENG-005 rules:

- required CI = `LOCAL_DETERMINISTIC_GOLDEN_EVAL`; external model/network/OpenAI API не требуются;
- 12 independently authored synthetic golden tasks покрывают `SCOPE_DISCIPLINE`, `TEST_SELECTION`, `PRIVACY`, `DOCS_ROADMAP_SYNC`, `REVIEW_QUALITY`;
- normalized result имеет только allowlisted fields; set-like arrays сортируются, duplicates/extra keys fail closed;
- missing/unknown task, changed expected action/tests/docs/privacy/review behavior или unsafe baseline metadata = FAIL;
- future optional instruction/model candidate может быть приведён внешним harness к result schema и сравнен через `tools/ai-eval-runner.js --candidate`, но model invocation не входит в required gate;
- baseline и public evidence = independently generated `SYNTHETIC_ONLY`; production/real-derived household finance data запрещены;
- `eval_grants_authority=false`; financial truth/write, roadmap status, writer/review-write, merge/deploy/runtime/storage/network authorities = false;
- red eval не обходится review-текстом; `paid_dependency_required=false`; `FREE_ONLY` mandatory.

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
- `ANL-074` — **DONE**, Issue #155 Main Verification PASS, merge `b461bfea099a6b35b8f156975f405ed4d4b58af1`; authority `PRH_EXPLORATION_STATE_V1@1.0.0`.

ANL-072/BENCH-070/ANL-073 remain P2 backlog; PERF-070/TEST-070 are not dependency-ready.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. `ai_playbook_contract_test.js` and `ai_eval_suite_contract_test.js` belong to `POLICY_GOVERNANCE`; named `AI playbooks` and `AI regression eval` gates run before the full layered suite. Existing semantic/scope/period/exploration tests remain independently classified.

## AI model/cost routing boundary

`SOL`, `TERRA`, `LUNA` — internal workload lanes, а не guaranteed vendor entitlements. Required `MACHINE_GATE` выполняется через `LOCAL_DETERMINISTIC`; `OPENAI_API` — separately billed surface, `enabled=false`, automatic billing/API fallback запрещён. AIENG-005 не меняет эту границу и не превращает external model в required CI dependency.

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

AIENG-005 remains open until AI regression eval + AI playbooks/LANG-RU/docs/privacy/FREE_ONLY/full layered/UI/PWA evidence are green, exact candidate passes trusted deploy/runtime health and Main Verification closes Issue #159.

## Read-only multi-AI review

Required roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority=false`; review never overrides red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data stays private. Family Web App remains private `MYSELF`. AIENG-005 is local repository evaluation/governance only with `financial_write=false`, runtime/network/storage/deployment authority=false. `FREE_ONLY` remains mandatory.

## Scope handoff

All R0 critical items including AIENG-004, all R1 core items, R2 P1 baseline, YC-040, AUTH-040, ANL-070, SCOPE-070, ANL-071 and ANL-074 are DONE. YC-041/YC-042 are BLOCKED without writer authority. `MASTER-G3 = complete`. `AIENG-005` is the single active writer.
