# AIENG-003 — read-only multi-AI review protocol

## Purpose

Independent AI review is supplementary engineering evidence for one immutable candidate. It can surface risks from several specialist perspectives, but it must never create a second writer, receive deploy/write authority, or override deterministic machine gates.

The protocol is intentionally model/provider-neutral and `FREE_ONLY`: repository CI validates packet/report/aggregation semantics locally with Node.js and does not call a paid external model.

## Immutable review packet

`.ai-context/multi-ai-review-packet.schema.json` defines `PRH_MULTI_AI_REVIEW_PACKET_V1`.

A packet binds review to:

- one concrete Roadmap ID;
- one GitHub Issue;
- one PR;
- exact 40-character candidate SHA;
- `review_mode: READ_ONLY`;
- `writer_authority: false`;
- exact required specialist roles;
- changed repository paths;
- public-safe machine/document evidence references.

A reviewer must review the exact candidate named in the packet. A report for another SHA/Issue/PR/Roadmap ID is invalid rather than transferable.

## Required independent roles

Exactly one report is required from each role:

1. `ARCHITECTURE` — boundaries, coupling, migration direction, contracts, maintainability;
2. `SECURITY_PRIVACY` — trust boundaries, secrets, private/public data, least privilege, fail-closed behavior;
3. `FINANCIAL_DATA` — financial semantics, provenance, reconciliation, idempotency, migration/write safety;
4. `TEST_OPERATIONS` — tests, observability, rollback, recovery, CI/runtime/operator behavior.

Duplicate roles do not satisfy quorum twice. The same `reviewer_id` cannot occupy multiple required slots in one aggregation.

## Reviewer capability boundary

Reviewer agents are **read-only**. They may:

- inspect public-safe code/diff/contracts/docs/machine evidence for the exact candidate;
- emit bounded findings;
- return no findings when the specialist scope is clean.

They may not:

- create/update branches or commits;
- mutate GitHub Issues/PR metadata;
- merge or deploy;
- request/consume secrets or private runtime payload for the review packet;
- perform financial writes/migrations;
- mark a Roadmap item `DONE`;
- waive a red machine gate.

The primary Roadmap writer remains the only writer. If review findings are accepted, that writer fixes the same Roadmap branch; the new head becomes a new immutable candidate and must be re-reviewed if multi-AI review is required for that delivery.

## Reviewer report

`.ai-context/multi-ai-review-report.schema.json` defines `PRH_MULTI_AI_REVIEW_REPORT_V1`.

Each report binds exact candidate identity, reviewer ID and one required role, with `READ_ONLY` / `writer_authority=false`.

A finding is deliberately bounded:

- severity: `P0 | P1 | P2 | P3`;
- technical code;
- repository path;
- short summary;
- bounded recommendation;
- `resolved` boolean.

There is no arbitrary `rawPayload`, response body, financial payload or secret field.

## Severity / aggregation

`tools/multi-ai-review-protocol.js` deterministically aggregates reports.

- missing required role -> `INCOMPLETE / MULTI_AI_REQUIRED_ROLE_MISSING`;
- duplicate role/reviewer -> fail-closed `BLOCKED`;
- candidate identity mismatch -> fail-closed `BLOCKED`;
- unresolved `P0` or `P1` -> `BLOCKED / MULTI_AI_BLOCKING_FINDINGS`;
- unresolved `P2`/`P3` -> advisory and do not by themselves block review PASS;
- no unresolved blocking finding and all roles present -> `PASS`.

Resolved historical P0/P1 findings do not continue to block the new aggregation.

## Machine gates remain authoritative

AI review is not a substitute for:

1. PR Validation;
2. Trusted DEV Deploy;
3. Trusted Runtime Health;
4. CI-003 autonomous merge;
5. Main Verification.

`evaluateSupplementaryEvidence()` only reports `deliveryDone=true` when review is PASS **and** all required machine evidence is PASS. Even then `reviewerCanMarkDone` remains false: Main Verification owns the Roadmap Issue transition/close.

A reviewer cannot approve a red financial/privacy/security/runtime gate. Conversely, deterministic machine gates remain mandatory even if every reviewer reports PASS.

## Privacy boundary

Review packet/report content is public-safe coordination metadata only. The protocol rejects obvious private signatures such as:

- private Apps Script Web App locators;
- API Executable deployment IDs;
- OAuth access/refresh token signatures;
- private-key blocks;
- known owner-private local path patterns.

Never include real or real-derived household financial values, rows, aggregates, screenshots, authenticated runtime responses, backups/keys or credentials in reviewer context.

If private verification is necessary, the primary workflow provides only privacy-safe derived PASS/FAIL/technical evidence to reviewers.

## No paid AI dependency

AIENG-003 installs the **protocol**, schemas and local deterministic aggregator. It does not configure OpenAI/Anthropic/Gemini/YandexGPT or another paid/external model in CI.

A future integration may supply reviewer reports from independent models only under a separate policy/provider decision that respects privacy and `FREE_ONLY`. Model availability is not allowed to become an excuse to bypass machine gates.

## Example lifecycle

```text
primary writer exact candidate SHA
  -> public-safe review packet
  -> four independent read-only specialist reports
  -> deterministic aggregation
       BLOCKED: writer fixes same branch -> new exact SHA -> rerun
       PASS: supplementary evidence only
  -> normal machine delivery remains mandatory
  -> Main Verification owns DONE
```

## Scope after R0

AIENG-003 completes the R0 AI Engineering chain after AIENG-001 (repository AI contract) and AIENG-002 (executable Roadmap task protocol). Once Main Verification closes AIENG-003, all R0 master gates are complete and Roadmap Autopilot may resolve the next dependency-ready R1 item, beginning with `FIN-010` under the current Roadmap.
