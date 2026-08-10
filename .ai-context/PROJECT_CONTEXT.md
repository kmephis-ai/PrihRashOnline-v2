# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys и owner-private payload запрещены.

## LANG-RU

Русский язык — единственный нормативный язык human-facing документации, GitHub metadata и AI instructions. Machine identifiers, API/schema fields, library/protocol/standard names, команды и технические пути сохраняются без перевода. Параллельный English source of truth запрещён.

Для AI-агента это означает: причины решений, ограничения, критерии приёмки и эксплуатационные инструкции должны быть понятны русскоязычному владельцу. Английские технические термины допустимы как устойчивые machine/library/standard identifiers, но не заменяют русский смысловой текст.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — Executable GitHub Roadmap v2.3.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Versioned contracts + architecture/ADR/operations docs.

## Current R0 truth

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`, `DOC-001 = DONE`, `DOC-002 = DONE`, `FINOPS-001 = DONE`.

`DOC-002` Issue #75 — DONE/Main Verification PASS, merge `8495dc730166f4e5fb7a03b5a7ab780501f6bbf5`; `PRH_LANGUAGE_POLICY_V1@1.0.0` остаётся обязательным governance contract.

`AIENG-006` — **current writer**, Issue #146, branch `agent/AIENG-006-model-cost-routing`; IN_PROGRESS до Main Verification.

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

DESIGN-020, VIZ-020, HOME-020, TX-020, EXP-020, INC-020, CF-020, BUD-020, OBL-020, DQ-020 and PWA-020 are DONE/Main Verification PASS. `NOT_PROVEN_CURRENT_HOST` remains the current Apps Script HtmlService service-worker state; private financial/authenticated responses are never allowed in PWA cache.

## Current R4 truth

- `YC-040` — **DONE**, Issue #141 Main Verification PASS, merge `924a44f4cb01e6add6c7fd9a0b166d7a7743b96a`.
- `AUTH-040` — **DONE**, Issue #142 Main Verification PASS, merge `455c7fdaaaee118369294d96183631d7322e5ea2`.

YC-040 remains offline YDB evidence only: `ydb_canonical_write_ownership=false`, real replication=false, billing enablement=false. AUTH-040 remains provider-neutral reference policy: current Apps Script access `MYSELF`, `backend_financial_write_granted=false`.

## AIENG-006 model/cost routing boundary

Machine contract: `lib/ai/model_cost_routing.v1.json` (`PRH_AI_MODEL_COST_ROUTING_V1@1.0.0`). Core: `lib/ai/model_cost_routing.js`. Human contract: `docs/operations/AIENG006_MODEL_COST_ROUTING.md`. Test: `tests/ai_model_cost_routing_contract_test.js`. Named gate: `AI model/cost routing`.

Rules:

- `SOL`, `TERRA`, `LUNA` — внутренние project workload lanes; `vendor_model_id=null`; они не описывают гарантированный entitlement конкретного OpenAI account.
- `LOCAL_DETERMINISTIC` — единственный surface для required `MACHINE_GATE`; AI/model availability не является machine dependency.
- `CHATGPT_SUBSCRIPTION` — interactive AI-assisted surface без machine authority; availability поступает как current account runtime state.
- capability states: `AVAILABLE | EXHAUSTED | UNAVAILABLE | UNKNOWN`; UNKNOWN fail-closed и не считается available.
- required AI-assisted workload выбирает первый доступный lane по versioned fallback order; если capacity нет — `PAUSE_REQUIRED_WORK`.
- optional AI workload при отсутствии capacity — `DEFER_OPTIONAL`.
- `OPENAI_API` — separately billed surface; `enabled=false`, required checks/required engineering запрещены, automatic billing/API fallback запрещён.
- paid API не требуется для required checks; ChatGPT subscription и API billing остаются раздельными surfaces.
- routing decision всегда `machine_gate_bypass=false`, `api_used=false` в v1.
- telemetry содержит только workload/required/route/lane/state/reason/fallback metadata; prompts/responses/financial/account/billing-token payload запрещены.
- `FREE_ONLY` mandatory.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. `ai_model_cost_routing_contract_test.js` = `POLICY_GOVERNANCE`; named `AI model/cost routing` gate обязан выполняться до downstream regression.

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

AIENG-006 remains open until model/cost routing + Language policy/docs/privacy/FREE_ONLY/full layered evidence are green, trusted exact-head deploy/runtime health passes and Main Verification closes Issue #146.

## Read-only multi-AI review

Required roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority=false`; review never overrides red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data stays private. Family Web App remains private `MYSELF`. AIENG-006 makes no provider/network/API calls and has `financial_write=false`, `runtime=false`, `network=false`. `FREE_ONLY` remains mandatory.

## Scope handoff

All R1 items, the R2 P1 baseline, YC-040, AUTH-040 and DOC-002 are DONE. `MASTER-G3 = complete`. `AIENG-006` is the single active writer.
