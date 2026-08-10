# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys и owner-private payload запрещены.

## LANG-RU

Русский язык — единственный нормативный язык human-facing документации, GitHub metadata и AI instructions. Machine identifiers, API/schema fields, library/protocol/standard names, команды и технические пути сохраняются без перевода. Параллельный English source of truth запрещён.

Для AI-агента это означает практическое правило: объяснения решений, описание причин изменений, критерии приёмки, ограничения, эксплуатационные инструкции и итоговые выводы должны быть понятны русскоязычному владельцу проекта без необходимости обращаться к параллельной английской версии. Английские технические термины допустимы там, где они являются устойчивыми именами интерфейсов, библиотек, стандартов, полей схемы или машинных кодов. Они не должны вытеснять русский смысловой текст и не создают отдельный нормативный документ. Если новый файл предназначен человеку и становится источником архитектурных, эксплуатационных или процессных правил, его основной поясняющий текст пишется по-русски.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — **Executable GitHub Roadmap v2.3**.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Versioned contracts + architecture/ADR/operations docs.

## Current R0 truth

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`, `DOC-001 = DONE`, `FINOPS-001 = DONE`.

`DOC-002` — **current writer**, Issue #75, branch `agent/DOC-002-russian-normative-docs`; IN_PROGRESS до Main Verification. Contract: `PRH_LANGUAGE_POLICY_V1@1.0.0`.

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

## DOC-002 boundary

Machine contract: `lib/documentation/language_policy.v1.json`. Runtime: `lib/documentation/language_policy.js`. Scanner: `tools/language-policy-scan.js`. Human contract: `docs/operations/DOC002_LANGUAGE_POLICY.md`. Test: `tests/language_policy_contract_test.js`.

Rules:

- normative human language = `ru`;
- one human source of truth; parallel English normative tree/readme = FAIL;
- explicit inventory covers project entry, Roadmap/status, AI instructions/context, release/security/architecture docs and Issue/PR/Release templates;
- code fences, inline code and URL are excluded from human-language counting;
- technical identifiers/standards are allowlisted and remain untranslated;
- Issue/PR/Release templates declare `language: ru`;
- policy has no financial truth/runtime/storage/network/deployment/write authority;
- `FREE_ONLY` mandatory.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. DOC-002 language contract is `POLICY_GOVERNANCE`; named `Language policy` gate executes `tools/language-policy-scan.js` plus behavioral contract.

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

DOC-002 remains open until language-policy/docs/privacy/FREE_ONLY/full layered evidence are green, trusted exact-head deploy/runtime health passes and Main Verification closes Issue #75.

## Read-only multi-AI review

Required roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority=false`; review never overrides red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data stays private. Family Web App remains private `MYSELF`. DOC-002 uses documentation/governance metadata only and has `financial_write=false`, `runtime=false`, `network=false`. `FREE_ONLY` remains mandatory.

## Scope handoff

All R1 items, the R2 P1 baseline, YC-040 and AUTH-040 are DONE. `MASTER-G3 = complete`. `DOC-002` is the single active writer.
