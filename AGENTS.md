# PrihRashOnline-v2 — Repository AI Contract

This file is the root public-safe operating contract for AI agents in this repository. Never expand it with private household financial data, credentials, authenticated runtime payloads or owner-private infrastructure identifiers.

## 1. Product objective

PrihRashOnline-v2 is a maintainable household-finance system whose current runtime is Google Sheets + Google Apps Script with a private Web Dashboard. The engineering direction is a simple modular monolith: versioned financial/domain rules and application services above repository adapters, with Google as the current adapter and a future Yandex/YDB adapter introduced only through shadow/strangler migration.

Priorities: financial correctness, recoverability, privacy, simplicity, modularity, maintainability and `FREE_ONLY` operation before feature breadth.

## 2. Sources of truth and precedence

When sources disagree, use this order and fail closed instead of averaging conflicting instructions:

1. explicit security/privacy/cost/irreversible-action policy boundaries;
2. репозиторный `docs/ROADMAP.md` — каноническая `Executable GitHub Roadmap v2.3` для порядка работ и зависимостей;
3. внешние `Master Audit v2.1` и `AI Development Playbook v1.0`, когда они явно предоставлены в task context;
4. единственный активный GitHub Roadmap Issue (`roadmap_id`, live status, dependencies, acceptance, rollback, privacy/cost class);
5. executable code/tests/workflows на exact candidate SHA;
6. architecture/ADR/operations documentation;
7. README/user guides;
8. historical CHANGELOG/release notes.

A stale lower-priority source never authorizes bypassing a current machine gate. If canonical external context is unavailable, do not invent it: use the active Issue plus tracked repository contracts and keep uncertainty fail closed.

## 3. Autonomy Contract v2

When the owner says the equivalent of `делай далее`, continuation is governed by the executable AIENG-002 protocol:

- `tools/roadmap-task-protocol.js` — deterministic resolver/lifecycle reference;
- `.ai-context/roadmap-task-packet.schema.json` — `PRH_ROADMAP_TASK_V1` schema;
- `docs/operations/AIENG002_ROADMAP_TASK_PROTOCOL.md` — operator contract.

Rules:

1. resolve continuation to one concrete Roadmap ID; never answer “take the next task” without resolving it;
2. if exactly one writer is `IN_PROGRESS`, continue that same Roadmap ID;
3. otherwise select one highest-priority explicit `READY` item whose declared dependencies are all `DONE`;
4. multiple active writers, missing/not-DONE dependencies, incomplete task packet or private task context fail closed;
5. one Roadmap ID = one GitHub Issue = one active writer;
6. set/keep Issue state `IN_PROGRESS` while implementation/PR is active;
7. use short-lived branch `agent/<ROADMAP-ID>-<slug>`;
8. implement only that task packet; do not silently absorb the next Roadmap item;
9. open same-repository non-draft PR to `main` with exactly one canonical `Closes #<Issue>` line;
10. let exact-head machine gates validate/deploy/health-check/merge/verify;
11. fix red CI on the same active writer branch, creating a new exact candidate;
12. claim `DONE` only after Main Verification updates the linked Issue to `status: DONE` and closes it;
13. then resolve the next dependency-ready item through the executable protocol.

Do not substitute manual merge, manual marker, release-snapshot branch, commit-count gate or anonymous Web App smoke for this chain. Master-gate/wave policy controls which items may be labelled READY; the resolver does not promote BACKLOG/BLOCKED future-wave work itself.

## 4. Actions that remain policy-gated

Autonomy does not authorize:

- making the private Web App public;
- enabling billing, paid overage, paid AI/OCR/API/provider or a new paid dependency;
- destructive/irreversible PROD financial-data changes;
- full-history cutover without its explicit migration Roadmap item and recovery/reconciliation gates;
- public Git history rewrite/force-push without explicit owner approval and independent backup/inventory;
- weakening privacy/security/reconciliation/`FREE_ONLY` gates to make CI green;
- publishing owner-private deployment/runtime/backup/credential information.

If a task requires one of these actions, stop that action fail closed rather than bypassing policy.

## 5. Data classification

### Public-safe

May be committed/logged when independently generated and non-sensitive:

- source code, schemas, contracts, architecture and public docs;
- deterministic independently generated synthetic financial fixtures;
- technical reason/status/build/source-tree hashes;
- non-financial latency/quota/capacity/cost-guard counters covered by the audit allowlist;
- privacy-safe backup evidence such as encrypted backup hash, checksum/reconciliation state and RPO/RTO.

### Private

Never commit, paste into Issue/PR/CI/public docs, or use as a public regression fixture:

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
- Audit/telemetry uses the explicit `SecurityPrivacyPolicy.js` allowlist; financial/user payload is not telemetry.
- Secret/privacy scanners are required PR gates.
- Never echo credentials or private provider/runtime payload in diagnostics.
- Prefer bounded technical reason codes over raw exception/HTTP bodies in shared logs.
- Private runtime stays owner-only; CI runtime proof uses authenticated Execution API.

## 7. FREE_ONLY contract

`FREE_ONLY` is an executable invariant, not a preference.

- `PR_CONFIG.FINOPS.MODE` remains `FREE_ONLY` unless a separately authorized policy change says otherwise.
- Automatic paid overage is forbidden.
- Unknown/unconfigured billable provider fails closed.
- A future provider requires an explicit conservative monthly safety envelope with `paidOverageAllowed: false` and must reserve normalized usage through Cost Guard before billable-by-usage execution.
- Optional workloads degrade/stop before projected overage according to versioned guard policy.
- Agents must not recommend or silently install a paid dependency/service to pass a gate when a free/local path exists in scope.

## 8. Canonical machine delivery gates

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

Required PR validation includes, as applicable: Node 24 locked install, supply-chain, CI trust boundary, secret scan, synthetic-only privacy, `FREE_ONLY`, Documentation truth, AI contract, Roadmap task protocol, financial/migration reconciliation, full contracts, responsive synthetic Playwright and immutable candidate build.

A green PR test suite without trusted exact-SHA deploy/runtime evidence is not `DONE` for ordinary Roadmap delivery.

## 9. Financial-write policy

Treat canonical financial mutation as high-risk engineering even in DEV. Do not add or enable ad-hoc writes to `01 Операции`.

A dedicated mutation Roadmap item must cover at least:

- explicit data scope and maximum batch size;
- deterministic idempotency key;
- preconditions/base revision or stale-write protection;
- allowed fields/action types;
- lock/concurrency behavior;
- privacy-safe audit/correlation identity;
- backup/snapshot/rollback plan where material;
- write readback/verification;
- financial reconciliation after mutation;
- fail-closed partial/error handling.

Proposal/staging/control/config writes are not permission to mutate canonical transactions.

## 10. Migration policy

Full-history migration is not currently declared complete.

Migration work must be deterministic, resumable and idempotent, with source provenance/fingerprints, missing/duplicate/changed/core-field mismatch detection, bounded batches, private reconciliation and recovery evidence. Stored legacy migration status is not stronger truth than computed reconciliation. Do not perform big-bang cutover because an adapter exists.

## 11. Build and reproducibility

- Node runtime: supported project baseline is Node 24.
- Use tracked `package-lock.json` and `npm ci`; do not replace CI with drift-prone `npm install`.
- `@google/clasp`/tooling versions are exact/locked where defined.
- Third-party GitHub Actions remain pinned to immutable commit SHAs.
- Candidate deployment uses trusted deterministic packaging and exact candidate SHA/source-tree identity.
- Do not hand-edit/commit generated `BuildInfo.js`.
- Public tests must be deterministic and synthetic.

## 12. Architecture boundary: Google now, adapters later

Current:

```text
Private Google Sheets -> Apps Script application/data services -> private Web Dashboard
```

Target:

```text
clients/UI -> application services -> pure versioned financial/domain model
           -> repository contracts -> Google adapter | future YDB adapter
```

UI does not own financial semantics. Google/Yandex specifics stay at adapter boundaries. Future Yandex migration uses shadow/dual-read/compare/canary/strangler evidence before cutover. Do not add household-scale microservice/event-broker complexity without a justified Roadmap item.

## 13. Observability for new failure modes

If a change introduces a new failure mode, add a bounded privacy-safe observable signal: deterministic reason code, status/counter/latency/quota/capacity signal, contract test or equivalent evidence. Logging failure must not leak private financial payload.

## 14. Documentation / ADR rule

If a contract, trust boundary, data classification, delivery path, financial semantic, migration invariant, provider/cost policy or operator procedure changes, update tracked docs in the same PR. Add/update an ADR for long-lived architectural decisions. Historical CHANGELOG entries are not current instructions.

## 15. Definition of Done

A Roadmap item is done only when all applicable conditions are true:

- acceptance implemented and tests updated;
- existing security/privacy/financial/migration/contracts/UI gates remain green;
- new failure modes have privacy-safe observability;
- docs/ADR synchronized when contracts changed;
- no unauthorized paid dependency/service introduced;
- exact candidate passed `Trusted DEV Deploy` and `Trusted Runtime Health` when required;
- CI-003 autonomous merge succeeded;
- `Main Verification` succeeded;
- linked Roadmap Issue is machine-updated to `status: DONE` and closed.

A merge commit alone is not the full DoD.

## 16. CI-red recovery

When CI is red:

1. record exact failing candidate SHA and first failing gate;
2. inspect technical logs/evidence without publishing private payload;
3. find root cause rather than disabling the check;
4. fix the same active Roadmap branch/PR;
5. let the new head create a new immutable candidate and replay the full chain;
6. improve the missing guard/contract when the failure reveals one;
7. never bypass red CI with manual merge, manual marker, anonymous runtime shortcut, broader permissions, public Web App access or weakened privacy/`FREE_ONLY` policy.

## 17. Repository AI context

Start with:

- `AGENTS.md` — this operating contract;
- `docs/ROADMAP.md` — каноническая Executable GitHub Roadmap v2.3; live lifecycle берётся из GitHub Issues;
- `.ai-context/PROJECT_CONTEXT.md` — public-safe project map;
- `.ai-context/roadmap-task-packet.schema.json` — executable task packet schema;
- `docs/operations/AIENG002_ROADMAP_TASK_PROTOCOL.md` — continuation/task lifecycle contract;
- `tools/roadmap-task-protocol.js` — deterministic resolver;
- `llms.txt` — compact entry-point index;
- `docs/PROJECT_STATUS.md` — current master-gate status;
- `docs/architecture.md`, `docs/RELEASE_PROCESS.md`, `docs/data-model.md`;
- `docs/operations/*` — DR/OBS/FINOPS/AI operations contracts.

AIENG-001 repository policy is DONE. AIENG-002 provides the executable Roadmap-to-agent protocol. AIENG-003 will add a read-only multi-AI review protocol; do not pre-empt reviewer/quorum semantics here.
