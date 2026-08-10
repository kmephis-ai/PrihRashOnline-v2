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

`AIENG-004` Issue #157 — DONE/Main Verification PASS, merge `280dea294b086fae3cedf56df7899c9938b42b88`, authority `PRH_AI_PLAYBOOK_CATALOG_V1@1.0.0`. AI playbooks не создают authority; PR/Migration review остаются `READ_ONLY`, `writer_authority=false`.

## Current R1 truth

`MASTER-G3 / Canonical platform` — complete. Independently generated synthetic 20k/50k performance = PASS.

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS; `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`.
- `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010` — **DONE**.
- `AIENG-005` — **DONE**, Issue #159 Main Verification PASS, merge `5fe90929f5f266fcd92bbc9745f78107083f6b5c`, authority `PRH_AI_EVAL_SUITE_V1@1.0.0`.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository authority. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

AI regression eval remains local deterministic: synthetic golden baseline, no required external model/network/paid API, `eval_grants_authority=false`, `FREE_ONLY`.

## Current R2 truth

DESIGN-020, VIZ-020, HOME-020, TX-020, EXP-020, INC-020, CF-020, BUD-020, OBL-020, DQ-020, PWA-020 and PROF-020 are DONE/Main Verification PASS.

`PROF-020` Issue #162 — DONE/Main Verification PASS, merge `c925deb4298c1046ec7ab06def3f559623d6b29f`, authority `PRH_HOUSEHOLD_PREFERENCES_V1@1.0.0`. Profile config remains separate from financial truth; `financial_write=false`.

`NOT_PROVEN_CURRENT_HOST` remains current PWA service-worker activation state; private Web App remains `MYSELF`.

## Current R3 truth

- `TREND-030` — **DONE**, Issue #164 Main Verification PASS, candidate `676dddc9d6cfd23a9c57cca4b7a12a27fee31140`, merge `fe1660fa063fbc5e3344c9e570188fed9262b2ce`, authority `PRH_LONG_TERM_TRENDS_V1@1.0.0`.
- `PROJ-030` — **DONE**, Issue #166 Main Verification PASS, candidate `f0fb557783960342db931488d2de97116c518b30`, merge `cb3bbc4d50c35e690fda76eda54b19d1b97fc0a9`, authority `PRH_CASH_FLOW_PROJECTION_V1@1.0.0`.
- `GOAL-030` — **current writer**, Issue #168, branch `agent/GOAL-030-goals-wishlist`; IN_PROGRESS до Main Verification.

GOAL-030 machine authority: `lib/planning/goal_planning.v1.json` (`PRH_GOAL_PLANNING_V1@1.0.0`). Core: `lib/planning/goal_planning.js`. Contract test: `tests/goal_planning_contract_test.js`. Normative doc: `docs/planning/GOALS_WISHLIST.md`. Named gate: `Goals and wish-list`.

GOAL-030 rules:

- goal planning state отделён от `FIN-TRUTH-v1`, canonical transactions, BUD-020 facts и PROJ-030 forecasts;
- target amount хранится в exact integer minor units с explicit ISO currency; deadline optional, priority/status allowlisted;
- funding events имеют уникальный event id, deterministic date/id ordering и provenance `DECLARED_PLANNING`;
- declared funding event не является canonical transaction и не подтверждает observed account balance;
- negative corrections допустимы только пока cumulative funding не становится отрицательным; future event относительно `as_of` fail-closed;
- progress = funded/remaining/overfunded + basis-points; achieved/overfunded/no-deadline/overdue/due-today states explicit;
- recommendation = `DETERMINISTIC_RULE`, required monthly contribution вычисляется из remaining amount и inclusive contribution periods; `hidden_forecast=false`, `financial_truth=false`;
- PROJ/ML/RISK/NETWORTH logic не используется; budget semantics не переопределяются;
- deterministic private serialization может содержать planning values, но public telemetry содержит только allowlisted status/priority/deadline/event-count/reason/progress-band metadata без names, raw IDs и amounts;
- `canonical_mutation=false`, `budget_mutation=false`, `financial_write=false`, storage/network/runtime/model-provider authority=false; public evidence synthetic only; `FREE_ONLY` mandatory.

## Current R4 truth

- `YC-040` — **DONE**, Issue #141 Main Verification PASS, merge `924a44f4cb01e6add6c7fd9a0b166d7a7743b96a`.
- `AUTH-040` — **DONE**, Issue #142 Main Verification PASS, merge `455c7fdaaaee118369294d96183631d7322e5ea2`.
- `YC-041` — **BLOCKED**, Issue #148, `OWNER_CLOUD_BOOTSTRAP_REQUIRED`, `writer_authority=false`.
- `YC-042` — **BLOCKED**, Issue #149, `OWNER_YDB_TARGET_REQUIRED`, `writer_authority=false`.

Google remains authoritative. Blocked cloud items не создают live cloud resources/billing-backed infrastructure и не меняют write ownership.

## Current R7 truth

- `ANL-070` — **DONE**, Issue #150 Main Verification PASS, merge `d8b429221aa02416c4103bf58c2f3439f79ad0a9`.
- `SCOPE-070` — **DONE**, Issue #77 Main Verification PASS, merge `5eee6095562172ff0c887585aeaa85af4c12dff1`.
- `ANL-071` — **DONE**, Issue #153 Main Verification PASS, merge `136fa66ea5752c96b789e92911d75ce37226b62f`.
- `ANL-074` — **DONE**, Issue #155 Main Verification PASS, merge `b461bfea099a6b35b8f156975f405ed4d4b58af1`.

ANL-072/BENCH-070/ANL-073 remain P2 backlog; PERF-070/TEST-070 are not dependency-ready.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. `long_term_trends_contract_test.js`, `cash_flow_projection_contract_test.js` и `goal_planning_contract_test.js` belong to `PURE_DOMAIN_APPLICATION`; named `Goals and wish-list` runs after `Cash-flow projection`. Household preferences remains PURE_DOMAIN_APPLICATION; AI playbook/eval tests remain POLICY_GOVERNANCE.

## AI model/cost routing boundary

Required machine gates remain local deterministic. `OPENAI_API` is separately billed, default disabled and never an automatic fallback. GOAL-030 requires no external model/provider.

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

GOAL-030 remains open until Goals and wish-list + BUD/PROJ/TREND/FIN/MIG/analytics/profile/AI/LANG-RU/privacy/FREE_ONLY/full layered/UI/PWA evidence are green, exact candidate passes trusted deploy/runtime health and Main Verification closes Issue #168.

## Read-only multi-AI review

Required roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority=false`; review never overrides red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data stays private. Family Web App remains private `MYSELF`. GOAL-030 is pure planning-domain logic with `financial_write=false`, runtime/network/storage/deployment authority=false. `FREE_ONLY` remains mandatory.

## Scope handoff

All R0 critical items, R1 core + AIENG-005, complete R2 baseline including PROF-020, TREND-030, PROJ-030, YC-040, AUTH-040, ANL-070, SCOPE-070, ANL-071 and ANL-074 are DONE. YC-041/YC-042 are BLOCKED without writer authority. `MASTER-G3 = complete`. `GOAL-030` is the single active writer.
