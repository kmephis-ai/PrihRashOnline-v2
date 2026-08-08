# PrihRashOnline-v2 — public-safe AI context

This context is safe to keep in the public repository. It deliberately contains no real financial data, private runtime locator, OAuth/backup material or owner-private paths.

## What this project is

A household-finance application currently running on private Google Sheets + Google Apps Script with a private Web Dashboard. GitHub is the engineering control plane. The target is a maintainable modular monolith with pure financial/domain rules and repository adapters; Google remains the current adapter and future Yandex/YDB work must enter through controlled shadow/strangler migration.

## Current R0 truth

Machine-proven baseline includes:

- deterministic independently generated synthetic finance fixtures;
- synthetic-only public-data boundary;
- canonical financial reconciliation;
- source-to-canonical migration reconciliation;
- reproducible Node 24/locked supply chain;
- zero-secret PR validation separated from trusted exact-SHA DEV deploy;
- authenticated exact build/source-tree runtime health;
- autonomous squash merge + Main Verification Issue close;
- encrypted owner-local backup + isolated restore drill;
- bounded privacy-safe audit/telemetry;
- executable `FREE_ONLY` guard;
- documentation truth gate;
- root machine-enforced repository AI contract (`AIENG-001`);
- executable Roadmap continuation/task-packet/lifecycle protocol (`AIENG-002`).

`AIENG-003` is the final `MASTER-G1` item. It adds exact-candidate read-only multi-AI review without model/provider dependency or writer authority. R0 becomes complete only after its Main Verification closes the linked Issue.

## Current runtime and privacy

- Primary private data store: Google Sheets.
- Runtime/application layer: Apps Script.
- User UI: private `MYSELF` Web Dashboard.
- Public repository finance data: independently generated synthetic only.
- Real or real-derived household finance data/aggregates/screenshots/exports stay private.
- Private deployment identifiers, authenticated responses, OAuth material, backups/keys stay private.

## Current delivery

```text
Roadmap Issue IN_PROGRESS
-> agent/<ID>-<slug> PR to main
-> PR Validation (zero deploy secrets)
-> immutable exact-SHA candidate
-> Trusted DEV Deploy from default-branch policy
-> Trusted Runtime Health authenticated exact-build proof
-> CI-003 autonomous squash merge
-> Main Verification -> Issue DONE/closed
```

Never substitute a release snapshot branch, commit-count gate, manual marker, anonymous Web App smoke or manual merge for this chain.

## Executable continuation protocol

Short continuation commands such as `делай далее` are governed by:

- `docs/operations/AIENG002_ROADMAP_TASK_PROTOCOL.md`;
- `.ai-context/roadmap-task-packet.schema.json` (`PRH_ROADMAP_TASK_V1`);
- `tools/roadmap-task-protocol.js`.

The resolver resumes the single `IN_PROGRESS` writer or selects one highest-priority explicit `READY` item whose dependencies are all `DONE`. Multiple writers, missing dependencies, incomplete packet or private context fail closed. `DONE` requires Main Verification.

## Read-only multi-AI review

AIENG-003 review is governed by:

- `.ai-context/MULTI_AI_REVIEW_CONTEXT.md`;
- `.ai-context/multi-ai-review-packet.schema.json`;
- `.ai-context/multi-ai-review-report.schema.json`;
- `tools/multi-ai-review-protocol.js`;
- `docs/operations/AIENG003_MULTI_AI_REVIEW_PROTOCOL.md`.

Required roles are `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers receive only public-safe exact-candidate context, remain `READ_ONLY`, and have `writer_authority: false`. Unresolved P0/P1 blocks review; P2/P3 is advisory. Tests/spec/ADR resolve conflicts, not model voting. Review never overrides deterministic machine gates or marks an Issue DONE.

## Financial/data boundaries

- Legacy total cells are not financial golden truth.
- Canonical transaction semantics and reconciliation contracts are authoritative for financial gates.
- Full-history migration is not declared complete.
- Dashboard read path does not confer universal write authority over `01 Операции`.
- A new canonical financial mutation requires a dedicated write contract with idempotency/preconditions/bounded scope/audit/readback/reconciliation/rollback evidence.

## Cost boundary

`FREE_ONLY` is mandatory. Billable provider allowlist is empty at the FINOPS-001 baseline. Required AIENG-003 checks use deterministic local Node contracts and require no paid model/API.

## Start-reading order for an AI agent

1. `/AGENTS.md`
2. `/docs/PROJECT_STATUS.md`
3. `/docs/operations/AIENG002_ROADMAP_TASK_PROTOCOL.md`
4. `/.ai-context/roadmap-task-packet.schema.json`
5. `/docs/operations/AIENG003_MULTI_AI_REVIEW_PROTOCOL.md`
6. `/.ai-context/MULTI_AI_REVIEW_CONTEXT.md`
7. `/docs/architecture.md`
8. `/docs/RELEASE_PROCESS.md`
9. `/docs/data-model.md`
10. active GitHub Roadmap Issue and exact candidate code/tests/workflows

When the task supplies Master Audit v2.1 / Executable GitHub Roadmap v2.2 / AI Development Playbook v1.0, follow source precedence in `AGENTS.md`.

## What not to infer

Do not infer that:

- full history has been migrated;
- PROD or Yandex cutover is authorized;
- a private Dashboard should be made public for testing;
- public Git history rewrite is authorized;
- paid cloud/AI/OCR/provider use is allowed;
- old RC/release notes are current instructions;
- a merged PR is DONE before Main Verification closes the linked Issue;
- a reviewer has writer authority or can replace a red machine gate.

## Scope handoff

- AIENG-001: repository AI contract — DONE.
- AIENG-002: executable Roadmap-to-agent task protocol — DONE.
- AIENG-003: read-only multi-AI review protocol — current final R0 item.

Keep these scopes dependency-ordered.
