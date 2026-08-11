# AIENG-002 — Roadmap-to-agent executable task protocol

## Purpose

Roadmap Autopilot must resolve a short continuation command such as `делай далее` into one concrete, bounded Roadmap task. The task must not depend on chat memory alone and must not allow two writers to mutate the same work item concurrently.

The executable reference implementation is `tools/roadmap-task-protocol.js`. The versioned packet schema is `.ai-context/roadmap-task-packet.schema.json` (`PRH_ROADMAP_TASK_V2`). V2 вводит отдельные engineering/product stages после Product Recovery rebaseline 2026-08-11.

## Normalized Roadmap item

The resolver consumes public-safe normalized Roadmap state. Each candidate item contains:

- `roadmap_id`;
- GitHub `issue` number;
- lifecycle `status` (`BACKLOG | READY | IN_PROGRESS | BLOCKED | DONE`);
- `work_class` (`engineering | user_facing`), `engineering_status`, `product_stage` и `target_stage`;
- `priority` (`P0..P3`), `wave` and deterministic `order`;
- `branch_slug`;
- `goal` and non-empty `non_goals`;
- `depends_on` Roadmap IDs;
- `depends_on_product_ready` для dependencies, которым недостаточно engineering `DONE`;
- `data_touched`, `privacy_class`, `cost_class`;
- non-empty `acceptance` and `evidence_required`;
- `rollback`;
- `blocking_product_gate` (`n/a` только для engineering item).

`cost_class` is currently required to be `FREE_ONLY`. A task requiring paid execution must remain policy-blocked rather than entering the ordinary autonomous writer path.

## Continuation resolution

### Existing active writer

If exactly one item is `IN_PROGRESS`, continuation resolves to that same Roadmap ID with action `CONTINUE_ACTIVE`. A higher-priority/new READY feature cannot pre-empt it.

If more than one active writer exists, resolver returns `BLOCKED / MULTIPLE_ACTIVE_WRITERS`.

If the active writer has a declared dependency that is missing/not `DONE`, continuation fails closed instead of pretending the branch is valid.

### No active writer

When no writer is active, only explicit `READY` items whose every declared dependency resolves to required stage are eligible. `depends_on` требует закрытого engineering lifecycle; `depends_on_product_ready` требует `status=DONE` и `product_stage=DONE` у user-facing dependency.

Eligible items are sorted deterministically by:

1. priority (`P0` before `P1` before `P2` before `P3`);
2. wave number (`R2R` располагается между R2 и R3);
3. Roadmap order;
4. Roadmap ID lexical tie-break.

The output always contains the concrete selected `roadmap_id`; it never returns an instruction like “take the next task” without resolving the ID.

Master-gate/wave eligibility remains part of canonical Roadmap state: an R1 item must not be marked READY while an R0 exit gate blocks feature expansion. The resolver does not override Roadmap/master-gate policy by relabeling BACKLOG/BLOCKED items.

## Task packet

For `START_READY` or `CONTINUE_ACTIVE`, the resolver emits a `PRH_ROADMAP_TASK_V2` packet with:

- concrete Roadmap ID + GitHub Issue;
- `work_class`, engineering/product/target stages;
- goal;
- non-goals;
- dependency evidence (`roadmap_id`, `DONE`, Issue);
- data touched;
- privacy class;
- `FREE_ONLY` cost class;
- acceptance criteria;
- required evidence;
- rollback;
- blocking Product gate;
- canonical writer branch `agent/<ROADMAP-ID>-<slug>`;
- canonical PR close line `Closes #<Issue>`;
- required machine delivery gates;
- `one_active_writer: true`.

Engineering delivery gates are fixed:

1. `PR_VALIDATION`;
2. `TRUSTED_DEV_DEPLOY`;
3. `TRUSTED_RUNTIME_HEALTH`;
4. `AUTONOMOUS_MERGE`;
5. `MAIN_VERIFICATION`.

Для `work_class=user_facing` packet дополнительно и обязательно содержит `PRODUCT_READY_E2E`. `TRUSTED_RUNTIME_HEALTH` подтверждает exact-SHA engineering runtime health, но не заменяет browser Product gate.

## Lifecycle

Allowed protocol transitions:

```text
READY -> IN_PROGRESS
READY -> BLOCKED
BLOCKED -> READY
IN_PROGRESS -> BLOCKED
IN_PROGRESS -> DONE
```

`IN_PROGRESS -> DONE` для engineering item rejected, пока пять engineering gates не PASS или `target_stage != DONE_ENGINEERING`.

Для user-facing item дополнительно требуются `target_stage=DONE`, `product_stage=PRODUCT_READY` и `productReadyE2E=PASS`. Synthetic/file-local/render-smoke/contract evidence не удовлетворяет это условие.

A GitHub merge alone is therefore insufficient to claim `DONE`.

## Privacy fail-closed

The task packet is public-safe coordination metadata. It rejects obvious private locator/credential signatures including:

- private Apps Script Web App locators;
- API Executable IDs;
- OAuth access/refresh-token signatures;
- private-key blocks;
- known owner-private local path patterns.

The packet must never contain real/real-derived financial values, rows, screenshots, authenticated runtime payloads, backup bytes or encryption keys. Those are outside this protocol even if a private Roadmap item needs owner-only execution.

For private operations, packet fields describe only the technical goal/gate and point to an owner-private action boundary; private payload never becomes task metadata.

## CLI reference

A caller may provide a public-safe JSON file:

```json
{
  "items": [
    {
      "roadmap_id": "AIENG-002",
      "issue": 70,
      "status": "READY",
      "work_class": "engineering",
      "engineering_status": "IN_PROGRESS",
      "product_stage": "CODE_COMPLETE",
      "target_stage": "DONE_ENGINEERING",
      "priority": "P1",
      "wave": "R0",
      "order": 20,
      "branch_slug": "roadmap-task-protocol",
      "goal": "...",
      "non_goals": ["..."],
      "depends_on": ["AIENG-001"],
      "depends_on_product_ready": [],
      "data_touched": "none",
      "privacy_class": "public-safe",
      "cost_class": "FREE_ONLY",
      "acceptance": ["..."],
      "evidence_required": ["..."],
      "rollback": "...",
      "blocking_product_gate": "n/a"
    }
  ]
}
```

Then:

```bash
node tools/roadmap-task-protocol.js resolve roadmap-state.json
```

Success emits one JSON object with `status=RESOLVED`, concrete ID/action and task packet. A policy/state/input failure emits only bounded `BLOCKED` technical reason and a non-zero exit code.

## Relationship to GitHub

GitHub Issues remain canonical execution memory. This protocol does not create a second tracker. A GitHub-aware agent/automation is responsible for retrieving Issue/Roadmap state and normalizing it into the resolver input; the resolver makes selection/packet/lifecycle semantics deterministic and testable.

When an item starts, GitHub Issue state becomes/remains `IN_PROGRESS`; the canonical branch and PR are created. Main Verification remains authoritative for `DONE`/Issue close.

## AIENG scope boundary

- **AIENG-001:** repository-wide agent policy (`AGENTS.md`, public-safe context).
- **AIENG-002:** deterministic Roadmap-to-agent selection/task packet/lifecycle (this document/tool).
- **AIENG-003:** independent read-only multi-AI review protocol.

Reviewer/quorum semantics do not belong in AIENG-002.

## CI-red recovery

A red protocol/implementation gate is fixed on the same active writer branch. The updated head becomes the new exact candidate. Do not spawn a second writer, relabel a dependency as DONE, drop acceptance/evidence fields or manually merge to bypass the resolver contract.
