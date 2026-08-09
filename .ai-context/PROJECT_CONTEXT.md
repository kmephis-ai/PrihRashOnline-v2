# PrihRashOnline-v2 — public-safe AI context

Этот контекст безопасен для public repository и не содержит real financial data, private runtime locator, OAuth/backup material или owner-private paths.

## Что это за проект

Household-finance application: текущий runtime — private Google Sheets + Google Apps Script + private Web Dashboard; GitHub — engineering control plane. Цель — maintainable modular monolith с pure financial/domain rules и repository adapters.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — **каноническая Executable GitHub Roadmap v2.3** для порядка работ/dependencies.
3. GitHub Issues — live lifecycle/status конкретного Roadmap item.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Architecture/ADR/operations docs.

Chat history/memory и старые Library-копии Roadmap не являются authority. Если task явно предоставляет `Master Audit v2.1` или `AI Development Playbook v1.0`, применяйте их по precedence из `AGENTS.md`.

## Current R0 truth

R0 machine-proven complete: TEST/SEC/FIN/DATA truth, reproducible supply chain, exact-SHA autonomous delivery, encrypted restore, privacy-safe observability, `FREE_ONLY`, documentation truth, AIENG-001 repository contract, AIENG-002 executable Roadmap protocol и AIENG-003 read-only multi-AI review прошли собственные Main Verification gates.

`MASTER-G0`, `MASTER-G1` и `MASTER-G2` закрыты. R1 / Canonical Financial Platform — текущая wave.

## Current R1 truth

`FIN-010` — первый P0 R1 item. Он формализует FIN-001 semantics в versioned KPI Dictionary:

- `lib/finance/kpi_dictionary.v1.json` — machine-readable definitions;
- `lib/finance/kpi_dictionary.js` — deterministic evaluator;
- `tests/kpi_dictionary_contract_test.js` — FIN-001 parity/property contract;
- `docs/finance/KPI_DICTIONARY.md` — normative human-readable contract.

До FIN-010 Main Verification `DATA-010` dependency-blocked. KPI Dictionary не выполняет migration и не даёт permission на financial writes.

## Current delivery

```text
Roadmap Issue IN_PROGRESS
-> agent/<ID>-<slug> PR to main
-> PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification -> Issue DONE/closed
```

## Executable continuation protocol

- `docs/operations/AIENG002_ROADMAP_TASK_PROTOCOL.md`;
- `.ai-context/roadmap-task-packet.schema.json`;
- `tools/roadmap-task-protocol.js`.

Resolver продолжает единственный `IN_PROGRESS` writer или выбирает один highest-priority dependency-ready `READY` item. Multiple writers/missing dependencies/private context fail closed.

## Read-only multi-AI review

- `.ai-context/MULTI_AI_REVIEW_CONTEXT.md`;
- `.ai-context/multi-ai-review-packet.schema.json`;
- `.ai-context/multi-ai-review-report.schema.json`;
- `tools/multi-ai-review-protocol.js`;
- `docs/operations/AIENG003_MULTI_AI_REVIEW_PROTOCOL.md`.

Required roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers получают только public-safe exact-candidate context, остаются `READ_ONLY`, `writer_authority: false`. Unresolved P0/P1 блокирует review; P2/P3 advisory. Конфликт разрешают policy/spec/tests/ADR, а не model voting. Review не отменяет machine gates и не может отметить Issue DONE.

## Privacy / financial / cost boundaries

- Public finance data — independently generated synthetic only.
- Real or real-derived household finance data/aggregates/screenshots/exports stay private.
- Private deployment identifiers, authenticated responses, OAuth, backups/keys stay private.
- Full-history migration не объявлена завершённой.
- New canonical mutation требует отдельный Roadmap contract с idempotency/preconditions/readback/reconciliation/rollback.
- `FREE_ONLY` обязателен; required checks не требуют paid provider.

## FIN-010 financial semantics boundary

KPI Dictionary v1 наследует `FIN-TRUTH-v1`: posted-only, integer minor units, transfer-neutral household KPIs, refund как expense reduction, no implicit floating-point rounding. Current evaluation single-currency; mixed currency fail-closed до versioned FX layer. Partial period задаётся explicit `[start,end)` window без hidden proration.

UI, chart renderer и legacy total cells не являются источником KPI truth.

## Start-reading order

1. `/AGENTS.md`
2. `/docs/ROADMAP.md`
3. active GitHub Roadmap Issue
4. `/docs/PROJECT_STATUS.md`
5. `/docs/finance/KPI_DICTIONARY.md`
6. `/lib/finance/kpi_dictionary.v1.json`
7. `/docs/operations/AIENG002_ROADMAP_TASK_PROTOCOL.md`
8. `/docs/operations/AIENG003_MULTI_AI_REVIEW_PROTOCOL.md`
9. `/docs/architecture.md`
10. `/docs/RELEASE_PROCESS.md`
11. `/docs/data-model.md`
12. exact candidate code/tests/workflows

## Не выводить из контекста

Не считать автоматически завершёнными full-history migration, DATA-010, PROD/Yandex cutover, public Web App, paid AI/API, Git history rewrite или Roadmap item без Main Verification. Reviewer не writer и не release authority.

## Scope handoff

- `AIENG-001` — DONE.
- `AIENG-002` — DONE.
- `AIENG-003` — DONE.
- `FIN-010` — current R1 writer.
- `DATA-010` — next P0 dependency after FIN-010 DONE.
