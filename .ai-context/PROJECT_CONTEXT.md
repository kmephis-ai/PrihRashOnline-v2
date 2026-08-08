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
- root machine-enforced repository AI contract (`AIENG-001`).

After AIENG-002 merges, Roadmap continuation/task-packet/lifecycle semantics are also machine-enforced. R0 remains open only for `AIENG-003` read-only multi-AI review before `MASTER-G1` closes.

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

- `docs/operations/AIENG002_ROADMAP_TASK_PROTOCOL.md` — human/operator contract;
- `.ai-context/roadmap-task-packet.schema.json` — versioned `PRH_ROADMAP_TASK_V1` packet;
- `tools/roadmap-task-protocol.js` — deterministic resolver/lifecycle reference implementation.

Rules:

1. resume the single `IN_PROGRESS` writer if it exists;
2. otherwise select one highest-priority explicit `READY` item whose dependencies are all `DONE`;
3. multiple writers, missing dependencies, incomplete packet or private context fail closed;
4. selected task always names the concrete Roadmap ID, Issue, canonical branch and `Closes #N` line;
5. `DONE` requires the full machine evidence through Main Verification.

GitHub Issues remain execution memory; this protocol does not create a second tracker.

## Financial/data boundaries

- Legacy total cells are not financial golden truth.
- Canonical transaction semantics and reconciliation contracts are authoritative for financial gates.
- Full-history migration is not declared complete.
- Dashboard read path does not confer universal write authority over `01 Операции`.
- A new canonical financial mutation requires a dedicated write contract with idempotency/preconditions/bounded scope/audit/readback/reconciliation/rollback evidence.

## Cost boundary

`FREE_ONLY` is mandatory. Billable provider allowlist is empty at the FINOPS-001 baseline. Future provider adapters require explicit conservative safety envelope and fail closed before projected paid overage. Do not assume billing may be enabled.

## Start-reading order for an AI agent

1. `/AGENTS.md`
2. `/docs/ROADMAP.md` — каноническая Executable GitHub Roadmap v2.3; текущий lifecycle берётся из GitHub Issues
3. `/docs/PROJECT_STATUS.md`
4. `/docs/operations/AIENG002_ROADMAP_TASK_PROTOCOL.md`
5. `/.ai-context/roadmap-task-packet.schema.json`
6. `/docs/architecture.md`
7. `/docs/RELEASE_PROCESS.md`
8. `/docs/data-model.md`
9. `/docs/operations/DR001_DIRECT_OWNER_BACKUP.md`
10. `/docs/operations/OBS001_AUDIT_TELEMETRY.md`
11. `/docs/operations/FINOPS001_FREE_ONLY_GUARD.md`
12. active GitHub Roadmap Issue and exact candidate code/tests/workflows

Если task явно предоставляет Master Audit v2.1 или AI Development Playbook v1.0, применяй их по precedence из `AGENTS.md`; Executable GitHub Roadmap берётся из репозитория: `/docs/ROADMAP.md`.

## What not to infer

Do not infer that:

- full history has been migrated;
- PROD or Yandex cutover is authorized;
- a private Dashboard should be made public for testing;
- public Git history rewrite is authorized;
- paid cloud/AI/OCR/provider use is allowed;
- old RC/release notes are current instructions;
- a merged PR is DONE before Main Verification closes the linked Issue;
- a new Roadmap item may start while another writer is `IN_PROGRESS`.

## Scope handoff

- AIENG-001: root repository AI contract and public-safe context — DONE.
- AIENG-002: executable Roadmap-to-agent task protocol — this item.
- AIENG-003: read-only multi-AI review protocol — next dependency.

Keep these scopes separate and dependency-ordered.
