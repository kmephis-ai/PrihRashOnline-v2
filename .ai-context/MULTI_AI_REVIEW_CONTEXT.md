# Multi-AI review context

AIENG-003 is the final R0 AI Engineering item. Its review protocol is supplementary, read-only and bound to one exact candidate SHA.

Start with:

- `/AGENTS.md` — repository AI operating contract;
- `/docs/operations/AIENG003_MULTI_AI_REVIEW_PROTOCOL.md` — reviewer/operator contract;
- `/.ai-context/multi-ai-review-packet.schema.json` — immutable review packet;
- `/.ai-context/multi-ai-review-report.schema.json` — bounded reviewer report;
- `/tools/multi-ai-review-protocol.js` — deterministic aggregator;
- `/tests/multi_ai_review_protocol_contract_test.js` — local machine contract.

Required roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`.

Reviewers are always `READ_ONLY` and `writer_authority=false`. They cannot push, mutate Issues/PRs, merge, deploy, request secrets, perform financial writes or mark Roadmap items DONE. Unresolved P0/P1 findings block the review result; P2/P3 findings are advisory. Exact candidate mismatch, missing/duplicate required role or private context fails closed.

A review PASS never overrides a red PR Validation, financial/privacy/security gate, trusted deploy/runtime health or Main Verification. Main Verification remains authoritative for Issue `DONE`/close.

No paid/external model integration is introduced by AIENG-003. This repository contains only schemas, deterministic local validation and aggregation semantics under `FREE_ONLY`.

After AIENG-003 Main Verification closes Issue #72, `MASTER-G0`, `MASTER-G1` and `MASTER-G2` are all complete, so Roadmap Autopilot may resolve dependency-ready R1 work beginning with `FIN-010`.
