# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys и owner-private payload запрещены.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — **Executable GitHub Roadmap v2.3**, канонический Roadmap.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Versioned contracts + architecture/ADR/operations docs.

## Current R0 truth

R0 machine-proven complete. `MASTER-G0`, `MASTER-G1`, `MASTER-G2` закрыты. `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`.

## Current R1 truth

`MASTER-G3 / Canonical platform` — complete. Independently generated synthetic 20k/50k performance = PASS.

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS.
- `TEST-010` — **DONE**, Issue #100 Main Verification PASS.
- `OBS-010` — **DONE**, Issue #103 Main Verification PASS.
- `PERF-010..014` — **DONE**.
- `DOC-010` — **DONE**, Issue #116 Main Verification PASS; `PRH_R1_DOCUMENTATION_V1@1.0.0` verified.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository authority. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Historical ANL-010 authority remains `PRH_ANALYTICS_CONTRACT_V1@1.0.0`; renderer/storage-neutral and `financial_write=false`. Analytics financial semantics remain delegated to FIN-010 and completed ANL-010 is not current lifecycle authority.

## Current R2 truth

DESIGN-020, VIZ-020, HOME-020, TX-020, EXP-020, INC-020, CF-020, BUD-020, OBL-020, DQ-020 and PWA-020 are DONE/Main Verification PASS. PWA-020 Issue #137 merged through PR #140, merge `c6910df6679fdc894635092c27cd3c463a69a364`.

`NOT_PROVEN_CURRENT_HOST` remains the current Apps Script HtmlService service-worker state; private financial/authenticated responses are never allowed in PWA cache. `PROF-020` remains P2 and is not current writer.

## Current R4 truth

AIENG-002 first selected YC-040, which is now DONE/Main Verification PASS. It then selected the next dependency-ready P1 item AUTH-040.

- `YC-040` — **DONE**, Issue #141 Main Verification PASS, PR #143 merge `924a44f4cb01e6add6c7fd9a0b166d7a7743b96a`.
- `AUTH-040` — **current writer**, Issue #142, branch `agent/AUTH-040-family-auth`; IN_PROGRESS until Main Verification.

## YC-040 verified boundary

`PRH_YDB_SERVERLESS_POC_V1@1.0.0` remains offline schema/adapter/cost-policy evidence only. Google remains current authoritative runtime/store; `ydb_canonical_write_ownership=false`, real replication=false, `billing_enablement=false`, `FREE_ONLY` mandatory.

## AUTH-040 family auth boundary

Machine contract: `lib/auth/family_auth.v1.json` (`PRH_FAMILY_AUTH_V1@1.0.0`). Core: `lib/auth/family_auth.js`. Human contract: `docs/security/FAMILY_AUTHORIZATION.md`. Test: `tests/family_auth_contract_test.js`. Named gate: `Family Auth`.

Rules:

- AUTH-040 is `PROVIDER_NEUTRAL_REFERENCE_POLICY`, not live IdP/IAM provisioning.
- Raw identity assertion is never trusted; injected verifier result must be verified, unexpired and audience-bound.
- Session integrity uses HMAC-SHA256 with runtime-injected key; raw key/token are forbidden in telemetry/public evidence.
- Session version binding/rotation, absolute + idle lifetime and constant-time signature verification are required.
- Roles/capabilities are explicit least-privilege allowlists; unknown role/capability fails closed.
- Every household-scoped authorization requires exact household match; cross-household access = DENY.
- Mutating application capabilities require a short-lived single-use session/version/capability-bound mutation nonce; replay = DENY.
- Application authorization never grants canonical backend mutation: `backend_financial_write_granted=false`; Google write still requires `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.
- Public auth telemetry is allowlisted decision/reason/role/capability/session-state/opaque-hash/count metadata only; financial payload, raw user/household/session/token/key/private locators are forbidden.
- Current Apps Script access remains `MYSELF`; `public_exposure_change=false`; no live identity provider is required/provisioned by AUTH-040.
- Required CI uses independently generated synthetic identity/session fixtures only; `FREE_ONLY` mandatory.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. AUTH-040 contract test must be explicitly classified and executed by named `Family Auth` gate. Unknown or ambiguous classification fails.

## MIG-010 historical verified boundary

Owner-private migration remains DONE/OWNER_VERIFIED with `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed occurrence identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Authorized execution was governed by `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion until post-write reconciliation PASS.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` is exact-bound and non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations. Generic Google financial write remains blocked by `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`. Current write authority = false.

## Current delivery

```text
PR Validation
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification
```

AUTH-040 remains open until auth/session/isolation/nonce/privacy/full layered evidence are green, trusted exact-head deploy/runtime health passes and Main Verification closes Issue #142.

## Read-only multi-AI review

Required roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority=false`; review is supplementary evidence and never overrides red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data stays private. Private deployment/database/billing identifiers, credentials, OAuth, backups/keys, raw real identities and real financial models stay private. Family Web App remains private `MYSELF`. AUTH-040 uses independent synthetic identities only. `FREE_ONLY` remains mandatory.

## Domain boundaries

FIN-010: `FIN-TRUTH-v1`. DATA-010: `PRH_CANONICAL_TRANSACTION_V1`. ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google mutation blocked with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`. AUTH-040 owns only auth reference-policy evidence; `financial_write=false`, `storage=false`, `network=false`, `public_runtime_exposure=false`.

## Scope handoff

All R1 items, the R2 P1 baseline and YC-040 are DONE. `MASTER-G3 = complete`. `AUTH-040` is the single active writer.
