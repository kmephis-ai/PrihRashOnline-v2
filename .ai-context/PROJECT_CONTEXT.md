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

`UI-MIG-020` — **current writer**, Issue #172, branch `agent/UI-MIG-020-canonical-r2-cutover`; P1 and IN_PROGRESS до Main Verification.

UI-MIG-020 machine authority:

- contract: `lib/ui/canonical_r2_web_app.v1.json` (`PRH_CANONICAL_R2_WEB_APP_V1@1.0.0`);
- router: `CanonicalR2WebAppService.js`;
- read-only Home adapter: `R2FinancialRuntimeService.js` (`PRH_R2_FIN_RUNTIME_ADAPTER_V1`);
- normative doc: `docs/ui/CANONICAL_R2_WEB_APP.md`;
- required gates: `R2 Financial runtime parity`, `Canonical R2 cutover`, `Canonical R2 navigation visual gate`.

UI-MIG-020 rules:

- canonical default Web App route = `home` / `FinancialHomeWebApp`; legacy `DashboardWebApp` loses default authority;
- primary navigation contains exactly Home, Transactions, Expenses, Income, Cash Flow, Budget, Obligations, Data Quality;
- legacy remains only bounded rollback route `?surface=legacy` until post-cutover verification;
- private exposure stays `MYSELF`; `NOT_PROVEN_CURRENT_HOST` PWA boundary remains unchanged;
- Home runtime reads `01 Операции` only through `prhGoogleRepositoryReadOperationsTable_` and explicit `currency` from existing `09 Настройки`;
- Home runtime projection is parity-guarded against canonical `evaluateKpis()` / `PRH_KPI_DICTIONARY_V1@1.0.0`; it has no independent financial formula authority;
- posted income/expense/refund/transfer/zero-adjustment semantics remain `FIN-TRUTH-v1`; integer minor units and no implicit rounding;
- legacy total cells are not financial truth; `legacy_total_cells_used=false`;
- browser synthetic fixtures remain valid only for public CI/Playwright; private runtime fallback to `SYN-*` is forbidden;
- routes without proven private binding use `SAFE_UNBOUND_FAIL_CLOSED` and do not read financial rows or display synthetic values as household truth;
- authenticated technical render smoke = `PRH_WEBAPP_SMOKE_V3|R2|OK` and does not read financial rows;
- `financial_write=false`, `canonical_mutation=false`, storage/runtime-write/deployment authority=false; `FREE_ONLY` mandatory.

## Current R3 truth

- `TREND-030` — **DONE**, Issue #164 Main Verification PASS, merge `fe1660fa063fbc5e3344c9e570188fed9262b2ce`.
- `PROJ-030` — **DONE**, Issue #166 Main Verification PASS, merge `cb3bbc4d50c35e690fda76eda54b19d1b97fc0a9`.
- `GOAL-030` — **DONE**, Issue #168 Main Verification PASS, merge `fd7289d10d34df79b35c49c6749f36c6916d3bdc`.
- `BAL-030` — **DONE**, Issue #76 Main Verification PASS, merge `3caab7017de035d14c36d07f3712f7c019828e2f`.
- `NW-030` — **DONE**, Issue #171 Main Verification PASS, candidate `a2eefe5e9cb8d896e9f607486008901b40e50594`, merge `3e56dce6bea4d874930c27e579a7ee082a2abc5c`, authority `PRH_NET_WORTH_V1@1.0.0`.

BAL/NW contracts do not automatically grant UI-MIG private balance/valuation binding. No silent FX or market valuation is introduced.

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

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. UI-MIG adds runtime-integration tests for FIN parity/canonical routing and a UI_E2E responsive navigation visual gate. Full layered inventory remains mandatory; no red gate can be bypassed.

## AI model/cost routing boundary

Required machine gates remain local deterministic. `OPENAI_API` is separately billed, default disabled and never an automatic fallback. UI-MIG-020 requires no external model/provider, market-data API or paid service.

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

UI-MIG-020 remains open until R2 Financial runtime parity + Canonical R2 cutover + Canonical R2 navigation visual gate + existing FIN/DATA/ANL/DESIGN/VIZ/HOME/TX/EXP/INC/CF/BUD/OBL/DQ/PWA/MIG/privacy/FREE_ONLY/full layered evidence are green, exact candidate passes trusted deploy/runtime health and Main Verification closes Issue #172.

## Read-only multi-AI review

Required roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority=false`; review never overrides red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data stays private. Family Web App remains private `MYSELF`. UI-MIG only changes routing/render orchestration and read-only Home projection; `financial_write=false`. `FREE_ONLY` remains mandatory.

## Scope handoff

All R0 critical items, R1 core + AIENG-005, R2 baseline through PROF-020, TREND-030, PROJ-030, GOAL-030, BAL-030, NW-030, YC-040, AUTH-040, ANL-070, SCOPE-070, ANL-071 and ANL-074 are DONE. YC-041/YC-042 remain BLOCKED without writer authority. `MASTER-G3 = complete`. `UI-MIG-020` is the single active writer.
