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

`PROF-020` Issue #162 — DONE/Main Verification PASS, candidate `1ba5d7e8e73c74c2195418cf2fb43aaafcf7c5a1`, merge `c925deb4298c1046ec7ab06def3f559623d6b29f`; authority `PRH_HOUSEHOLD_PREFERENCES_V1@1.0.0`. Profile config remains separate from financial truth; `financial_write=false`.

`NOT_PROVEN_CURRENT_HOST` remains current PWA service-worker activation state; private Web App remains `MYSELF`.

## Current R3 truth

`TREND-030` — **current writer**, Issue #164, branch `agent/TREND-030-long-term-trends`; IN_PROGRESS до Main Verification.

TREND-030 machine authority: `lib/analytics/long_term_trends.v1.json` (`PRH_LONG_TERM_TRENDS_V1@1.0.0`). Core: `lib/analytics/long_term_trends.js`. Contract test: `tests/long_term_trends_contract_test.js`. Normative doc: `docs/analytics/LONG_TERM_TRENDS.md`. Named gate: `Long-term trends`.

TREND-030 rules:

- financial truth остаётся `FIN-TRUTH-v1` / `PRH_KPI_DICTIONARY_V1@1.0.0`; TREND не определяет KPI formulas;
- execution authority = `PRH_ANALYTICS_PERIOD_ENGINE_V1@1.0.0`; bucket-level AnalyticsQuery остаётся `grain=NONE`, `comparison=NONE`;
- selectors: `EXPLICIT_RANGE`, `ROLLING_90`, `ROLLING_365`, `YTD`; grains: `MONTH`, `QUARTER`, `YEAR`; comparison: `NONE|YEAR_OVER_YEAR`;
- measures — additive semantic measures, `BUDGET_VARIANCE` temporal trend запрещён;
- допускается 0..1 groupable semantic dimension; execution filters проходят через existing AnalyticsQuery, но public-safe definition serialization хранит только `filter_count`, не filter values;
- partial bucket flags, YoY calendar alignment, leap adjustment и comparison quality передаются из ANL-071 без silent proration;
- calculated/window metrics, CAGR, forecast/projection и benchmark logic отсутствуют; `formula_layer_added=false`;
- result сохраняет period/analytics/semantic/KPI/FIN provenance и exact period bucket results;
- telemetry содержит только selector/grain/comparison/counts/partial/comparison-quality/leap metadata без financial values/private IDs;
- `financial_write=false`, canonical mutation=false, io/network/storage/renderer/ui authority=false; public evidence synthetic only; `FREE_ONLY` mandatory.

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

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. `long_term_trends_contract_test.js` belongs to `PURE_DOMAIN_APPLICATION`; named `Long-term trends` runs after `Period/comparison engine`. `household_preferences_contract_test.js` remains PURE_DOMAIN_APPLICATION; AI playbook/eval tests remain POLICY_GOVERNANCE.

## AI model/cost routing boundary

Required machine gates remain local deterministic. `OPENAI_API` is separately billed, default disabled and never an automatic fallback. TREND-030 requires no external provider.

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

TREND-030 remains open until Long-term trends + Period/Semantic/KPI/AI/profile/LANG-RU/docs/privacy/FREE_ONLY/FIN/MIG/full layered/UI/PWA evidence are green, exact candidate passes trusted deploy/runtime health and Main Verification closes Issue #164.

## Read-only multi-AI review

Required roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority=false`; review never overrides red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data stays private. Family Web App remains private `MYSELF`. TREND-030 is pure analytics orchestration with `financial_write=false`, runtime/network/storage/deployment authority=false. `FREE_ONLY` remains mandatory.

## Scope handoff

All R0 critical items, R1 core + AIENG-005, complete R2 baseline including PROF-020, YC-040, AUTH-040, ANL-070, SCOPE-070, ANL-071 and ANL-074 are DONE. YC-041/YC-042 are BLOCKED without writer authority. `MASTER-G3 = complete`. `TREND-030` is the single active writer.
