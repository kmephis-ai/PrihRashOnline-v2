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
- `AIENG-005` — **DONE**, Issue #159 Main Verification PASS, merge `5fe90929f5f266fcd92bbc9745f78107083f6b5c`.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository authority. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Current R2 truth

DESIGN-020, VIZ-020, HOME-020, TX-020, EXP-020, INC-020, CF-020, BUD-020, OBL-020, DQ-020, PWA-020, PROF-020 and UI-MIG-020 are DONE/Main Verification PASS.

- `PROF-020` Issue #162 — DONE/Main Verification PASS, merge `c925deb4298c1046ec7ab06def3f559623d6b29f`.
- `UI-MIG-020` Issue #172 — DONE/Main Verification PASS, candidate `867fda74824f91bf3931aa3e6ea39d1c7d4dfc1e`, merge `0a87bab34f29897fa781a030797a9a040fb200a3`.

Canonical private Web App default = R2 Financial Home. Generated exact-candidate runtime is built from canonical `lib/**`; `financial_formula_copy=false`. Private transient dimension projection remains `PRH_RUNTIME_DIMENSION_LABEL_HASH_V1`, `persistent_identity_authority=false`. Authenticated private Home smoke V3 and Trusted Runtime Health PASS. `NOT_PROVEN_CURRENT_HOST` remains current PWA service-worker activation state; private Web App remains `MYSELF`.

## Current R3 truth

- `TREND-030` — **DONE**, Issue #164 Main Verification PASS, merge `fe1660fa063fbc5e3344c9e570188fed9262b2ce`.
- `PROJ-030` — **DONE**, Issue #166 Main Verification PASS, merge `cb3bbc4d50c35e690fda76eda54b19d1b97fc0a9`.
- `GOAL-030` — **DONE**, Issue #168 Main Verification PASS, merge `fd7289d10d34df79b35c49c6749f36c6916d3bdc`.
- `BAL-030` — **DONE**, Issue #76 Main Verification PASS, merge `3caab7017de035d14c36d07f3712f7c019828e2f`.
- `NW-030` — **DONE**, Issue #171 Main Verification PASS, merge `3e56dce6bea4d874930c27e579a7ee082a2abc5c`.
- `SUB-030` — **current writer**, Issue #179, branch `agent/SUB-030-subscription-detection`; IN_PROGRESS до Main Verification.

SUB-030 machine authority:

- contract: `lib/subscriptions/subscription_detection.v1.json` (`PRH_SUBSCRIPTION_DETECTION_V1@1.0.0`);
- core: `lib/subscriptions/subscription_detection.js`;
- contract test: `tests/subscription_detection_contract_test.js`;
- normative doc: `docs/finance/SUBSCRIPTIONS_RECURRING_SPEND.md`;
- named gate: `Subscription detection`.

SUB-030 rules:

- detector consumes only canonical `posted expense`; `income`, `transfer`, `refund`, `adjustment`, `pending`, `void` never become subscription occurrence;
- label source priority = `counterparty` then `description`; normalization only `NFKC + trim + collapse whitespace + lowercase`;
- grouping is exact by normalized label + currency + account_id + category_id; fuzzy/LLM similarity is forbidden;
- signature identity = SHA-256 versioned `PRH_SUBSCRIPTION_SIGNATURE_V1` payload;
- minimum candidate evidence = 3 occurrences; bounded latest history = 24 occurrences / 730 days;
- supported cadence = WEEKLY (7±1 days) and MONTHLY (next calendar month + clamp-to-month-end nominal day, ±3 days); every interval must match;
- amount reference = lower median minor units; tolerance = max(100 minor, floor(5%)); every occurrence must match for CANDIDATE;
- ambiguous cadence or amount evidence remains `REVIEW`; insufficient history = `NO_CANDIDATE` and is not surfaced as a finding;
- OBL-020 comparison is only explicit `signature_hash -> plan_id`; exact OUTFLOW/currency/cadence/reference amount checks; fuzzy plan-label matching forbidden;
- even `CANDIDATE` has `auto_confirmed=false`, `obligation_created=false`, `canonical_mutation=false`, `financial_write=false`, `financial_truth=false`;
- public telemetry contains hashes/counts/status/cadence metadata only, never raw labels, transaction/dimension IDs or financial values;
- public evidence synthetic-only; storage/network/runtime/deployment authority=false; `FREE_ONLY` mandatory.

### Как должен рассуждать AI при работе с SUB-030

Основной приоритет задачи — не максимальное число найденных подписок, а минимизация ложных срабатываний. Если данных недостаточно или поведение расхода нельзя уверенно объяснить установленными правилами, результат должен оставаться на проверке человеком. Нельзя превращать похожее описание платежей в устойчивую связь только потому, что строки выглядят одинаково. Нельзя автоматически создавать обязательство, менять категорию операции или исправлять историю. Любая новая эвристика должна сначала получить отдельный версионированный контракт и синтетические негативные примеры.

При ревью нужно отдельно проверять границы финансовой истины. Детектор использует суммы и даты только как признаки повторяемости, но не определяет новые финансовые показатели и не меняет значения операций. Возвраты, переводы, ожидающие и отменённые записи не должны создавать ложную регулярность. Связь с существующим планом обязательства допустима только по заранее явной технической связи и точным проверкам валюты, направления, периода и суммы. Если хотя бы одна из этих проверок не выполнена, система обязана остановиться без изменения данных.

При анализе приватности запрещено переносить в публичные журналы исходные названия получателей, описания платежей, идентификаторы счетов, категорий и транзакций, а также денежные значения. В публичном машинном evidence допустимы только обезличенные хэши, количества, состояния и тип периодичности. Все тестовые финансовые записи в GitHub должны оставаться независимо сгенерированными синтетическими примерами.

BAL remains `PRH_BALANCE_RECONCILIATION_V1@1.0.0`; no implicit zero balance. NW remains `PRH_NET_WORTH_V1@1.0.0`; no silent FX/market valuation and valuation layer `financial_truth=false`.

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

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. `subscription_detection_contract_test.js` belongs to `PURE_DOMAIN_APPLICATION`; named `Subscription detection` runs after `Obligations`. Full layered inventory remains mandatory.

## AI model/cost routing boundary

Required machine gates remain local deterministic. `OPENAI_API` is separately billed, default disabled and never an automatic fallback. SUB-030 requires no model/provider/paid API.

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

SUB-030 remains open until Subscription detection + OBL/DATA/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA evidence are green, exact candidate passes trusted deploy/runtime health and Main Verification closes Issue #179.

## Read-only multi-AI review

Required roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority=false`; review never overrides red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data stays private. Family Web App remains private `MYSELF`. SUB-030 is pure domain logic with `financial_write=false`, runtime/network/storage/deployment authority=false. `FREE_ONLY` remains mandatory.

## Scope handoff

All R0 critical items, R1 core + AIENG-005, complete R2 including UI-MIG-020, TREND-030, PROJ-030, GOAL-030, BAL-030, NW-030, YC-040, AUTH-040, ANL-070, SCOPE-070, ANL-071 and ANL-074 are DONE. YC-041/YC-042 remain BLOCKED without writer authority. `MASTER-G3 = complete`. `SUB-030` is the single active writer.
