# PrihRashOnline-v2 — Repository AI Contract

This file is the root operating contract for AI agents working in this repository. It is public-safe and must never be expanded with private household financial data, credentials, authenticated runtime payloads or owner-private infrastructure identifiers.

## 1. Product objective

PrihRashOnline-v2 is a maintainable household-finance system whose current runtime is Google Sheets + Google Apps Script with a private Web Dashboard. The engineering direction is a simple modular monolith: versioned financial/domain rules and application services above repository adapters, with Google as the current adapter and a future Yandex/YDB adapter introduced only through shadow/strangler migration.

Priorities: financial correctness, recoverability, privacy, simplicity, modularity, maintainability and `FREE_ONLY` operation before feature breadth.

## 2. Sources of truth and precedence

When sources disagree, use this order and fail closed instead of averaging conflicting instructions:

1. explicit security/privacy/cost/irreversible-action policy boundaries;
2. canonical `Master Audit v2.1`, `Executable GitHub Roadmap v2.1` and `AI Development Playbook v1.0` when supplied in the task context;
3. the single active GitHub Roadmap Issue (`roadmap_id`, dependencies, acceptance, rollback, privacy/cost class);
4. executable code/tests/workflows on the exact candidate SHA;
5. architecture/ADR/operations documentation;
6. README/user guides;
7. historical CHANGELOG/release notes.

A stale lower-priority source never authorizes bypassing a current machine gate. If a canonical external document is not available to the agent, do not invent its contents: use the linked Issue plus tracked repository contracts and explicitly keep uncertainty fail-closed.

## 3. Autonomy Contract v2

When the owner says the equivalent of `делай далее`, continue autonomously under these rules:

1. select the highest-priority dependency-ready Roadmap item;
2. verify all declared dependencies are `DONE` before writing;
3. one Roadmap ID = one GitHub Issue = one active writer;
4. set/keep the Issue lifecycle state `IN_PROGRESS` while implementation/PR is active;
5. use a short-lived branch `agent/<ROADMAP-ID>-<slug>`;
6. implement only that item; do not silently absorb the next Roadmap item;
7. open a same-repository, non-draft PR to `main` with exactly one canonical `Closes #<Issue>` line;
8. let the exact-head machine chain validate/deploy/health-check/merge/verify;
9. fix red CI on the same active writer branch, producing a new exact candidate;
10. claim `DONE` only after Main Verification has updated the linked Issue to `status: DONE` and closed it;
11. then resolve the next dependency-ready item.

Do not substitute manual merge, manual marker, release-snapshot branch, commit-count gate or anonymous Web App smoke for the canonical machine chain.

## 4. Actions that remain policy-gated

Autonomy does not authorize:

- making the private Web App public;
- enabling billing, paid overage, paid AI/OCR/API/provider or a new paid dependency;
- destructive/irreversible PROD financial-data changes;
- full-history cutover without its explicit migration Roadmap item and recovery/reconciliation gates;
- public Git history rewrite/force-push without explicit owner approval and independent backup/inventory;
- weakening privacy/security/reconciliation/`FREE_ONLY` gates to make CI green;
- publishing owner-private deployment/runtime/backup/credential information.

If an item requires one of these actions, stop that action fail-closed and keep independent safe engineering work separate.

## 5. Data classification

### Public-safe

May be committed/logged when independently generated and non-sensitive:

- source code, schemas, contracts, architecture and public documentation;
- deterministic independently generated synthetic financial fixtures;
- technical reason/status/build/source-tree hashes;
- non-financial latency/quota/capacity/cost-guard counters covered by the audit allowlist;
- privacy-safe backup evidence such as encrypted backup hash, checksum/reconciliation state and RPO/RTO.

### Private

Never commit, paste into Issue/PR/CI/public docs, or use as public regression fixture:

- real transaction rows, real operation IDs, descriptions, categories, accounts, merchants/counterparties;
- real or real-derived amounts, totals, aggregates, distributions, seasonality, control totals or screenshots;
- sampled/scaled/transformed data derived from the household dataset;
- authenticated Dashboard/API response bodies;
- OAuth tokens, refresh tokens, client secrets, private clasp profiles/config;
- backup bytes, encryption keys, decrypted backup data;
- owner-private deployment/API executable identifiers or local private storage paths as public operational state.

When public tests need finance data, generate it independently from fixed synthetic rules/seed.

## 6. Security/privacy contract

- Public repository financial data is synthetic-only.
- Audit/telemetry payloads use the explicit `SecurityPrivacyPolicy.js` allowlist; financial/user payload is not telemetry.
- Secret/privacy scanners are required PR gates.
- Never echo credentials or private provider/runtime payload in diagnostics.
- Prefer bounded technical reason codes over raw exception/HTTP bodies when logs are public/shared.
- Private runtime stays owner-only; CI runtime proof uses authenticated Execution API.

## 7. FREE_ONLY contract

`FREE_ONLY` is an executable invariant, not a preference.

- `PR_CONFIG.FINOPS.MODE` must remain `FREE_ONLY` unless a separately authorized policy change says otherwise.
- Automatic paid overage is forbidden.
- Unknown/unconfigured billable provider fails closed.
- A future provider requires an explicit conservative monthly safety envelope with `paidOverageAllowed: false` and must reserve normalized usage through Cost Guard before billable-by-usage execution.
- Optional workloads degrade/stop before projected overage according to the versioned guard policy.
- Agents must not recommend or silently install a paid dependency/service to pass a gate when a free/local path exists inside scope.

## 8. Canonical machine delivery gates

The current ordinary Roadmap delivery path is:

```text
PR Validation
  -> immutable Apps Script candidate bound to exact PR head SHA
Trusted DEV Deploy
  -> trusted default-branch policy verifies/reconstructs exact candidate
Trusted Runtime Health
  -> authenticated owner-only exact build/source-tree proof
CI-003 autonomous squash merge
  -> only eligible current exact head
Main Verification
  -> verifies merge/evidence and changes linked Issue IN_PROGRESS -> DONE
```

Required PR validation includes, as applicable:

- locked dependency install on Node 24;
- supply-chain policy;
- CI trust-boundary policy;
- secret scan;
- synthetic-only privacy scan;
- `FREE_ONLY` policy;
- documentation truth;
- AI repository contract;
- financial reconciliation synthetic;
- migration reconciliation synthetic;
- full contract tests;
- responsive synthetic Playwright;
- immutable candidate build.

A green PR test suite without trusted exact-SHA deploy/runtime evidence is not `DONE` for a Roadmap implementation that participates in the ordinary delivery chain.

## 9. Financial-write policy

Treat canonical financial mutation as high-risk engineering even in DEV.

Do not add or enable ad-hoc writes to `01 Операции`. A new canonical financial mutation path requires a dedicated Roadmap item and machine-verifiable contract covering at least:

- explicit data scope and maximum batch size;
- deterministic idempotency key;
- preconditions/base revision or equivalent stale-write protection;
- allowed fields/action types;
- lock/concurrency behavior;
- privacy-safe audit/correlation identity;
- backup/snapshot/rollback plan where mutation is material;
- write readback/verification;
- financial reconciliation after mutation;
- fail-closed handling of partial/error states.

Proposal/staging/control/config writes are not permission to mutate canonical transactions.

## 10. Migration policy

Full-history migration is not currently declared complete.

Migration work must be deterministic, resumable and idempotent, with source provenance/fingerprints, missing/duplicate/changed/core-field mismatch detection, bounded batches, private reconciliation and recovery evidence.

Do not interpret a stored legacy migration status as stronger truth than computed reconciliation. Do not perform big-bang cutover because an adapter exists.

## 11. Build and reproducibility

- Node runtime: supported project baseline is Node 24.
- Use tracked `package-lock.json` and `npm ci`; do not replace CI with drift-prone `npm install`.
- `@google/clasp`/tooling versions are exact/locked where defined.
- Third-party GitHub Actions remain pinned to immutable commit SHAs.
- Candidate deployment uses the trusted deterministic packager and exact candidate SHA/source-tree identity.
- Do not hand-edit/generated-commit `BuildInfo.js`; it is generated by trusted candidate packaging.
- Public tests must be deterministic and synthetic.

## 12. Architecture boundary: Google now, adapters later

Current:

```text
Private Google Sheets
  -> Apps Script application/data services
  -> private Web Dashboard
```

Target direction:

```text
clients/UI
  -> application services
  -> pure versioned financial/domain model
  -> repository contracts
  -> Google adapter | future YDB adapter
```

Rules:

- UI must not become the owner of financial semantics.
- New financial/domain rules should move toward pure testable code, not deeper spreadsheet coupling.
- Google-specific/Yandex-specific details belong at adapter boundaries.
- Future Yandex migration uses shadow/dual-read/compare/canary/strangler evidence before cutover.
- Do not introduce microservices/event-broker complexity for household scale without a separate justified Roadmap item.

## 13. Observability for new failure modes

If a change introduces a new failure mode, add a bounded privacy-safe way to observe it: deterministic reason code, status/counter/latency/quota/capacity signal, contract test or equivalent evidence.

Logging failure must not silently erase important technical failure state, but observability must never leak private financial payload.

## 14. Documentation / ADR rule

If a contract, trust boundary, data classification, delivery path, financial semantic, migration invariant, provider/cost policy or operator procedure changes, update the relevant tracked documentation in the same PR. Add/update an ADR when the decision is architectural and long-lived.

Historical CHANGELOG entries are not current instructions.

## 15. Definition of Done

A Roadmap item is done only when all applicable conditions are true:

- acceptance criteria implemented and tests added/updated;
- existing security/privacy/financial/migration/contracts/UI gates remain green;
- new failure modes have privacy-safe observability;
- docs/ADR are synchronized when contracts changed;
- no unauthorized paid dependency/service was introduced;
- exact candidate passed `Trusted DEV Deploy` and `Trusted Runtime Health` when required;
- CI-003 autonomous merge succeeded;
- `Main Verification` succeeded;
- linked Roadmap Issue is machine-updated to `status: DONE` and closed.

A merge commit alone is not the full DoD if Main Verification/Issue close has not completed.

## 16. CI-red recovery

When CI is red:

1. record the exact failing candidate SHA and first failing gate;
2. inspect technical logs/evidence without publishing private payload;
3. find root cause rather than disabling the check;
4. fix the same active Roadmap branch/PR;
5. let the new head create a new immutable candidate and replay the full chain;
6. if the failure reveals a missing guard/contract, improve the guard and document it;
7. never bypass red CI with manual merge, manual marker, anonymous runtime shortcut, broader permissions, public Web App access or weakened privacy/`FREE_ONLY` policy.

## 17. Repository AI context

Start with:

- `AGENTS.md` — this operating contract;
- `.ai-context/PROJECT_CONTEXT.md` — public-safe project map;
- `llms.txt` — compact entry-point index;
- `docs/PROJECT_STATUS.md` — current master-gate status;
- `docs/architecture.md` — current/target architecture;
- `docs/RELEASE_PROCESS.md` — actual autonomous delivery;
- `docs/data-model.md` — financial/data/privacy boundaries;
- `docs/operations/*` — DR/OBS/FINOPS operating contracts.

AIENG-002 will add the detailed executable Roadmap-to-agent task protocol. AIENG-003 will add a read-only multi-AI review protocol. Do not pre-empt those scopes inside this contract.
