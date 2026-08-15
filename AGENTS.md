# PrihRashOnline-v2 — Repository AI Contract

Root `AGENTS.md` — public-safe операционный контракт для AI-агентов этого репозитория. В него нельзя помещать private household finance data, credentials, authenticated runtime payloads, backup material или owner-private infrastructure identifiers.

## 1. Product objective

PrihRashOnline-v2 — maintainable household-finance system. Текущий runtime: private Google Sheets + Google Apps Script + private Web Dashboard. Целевая архитектура — простой modular monolith: versioned financial/domain rules и application services над repository ports/adapters; Google — текущий adapter, future YDB adapter вводится только через shadow/strangler migration.

Приоритеты: financial correctness, recoverability, privacy, simplicity, modularity, maintainability и `FREE_ONLY` раньше feature breadth.

## 2. Sources of truth and precedence

При конфликте источников используйте порядок ниже и **fail closed** вместо усреднения противоречий:

1. security/privacy/cost/irreversible-action policy boundaries;
2. repository `docs/ROADMAP.md` — каноническая `Executable GitHub Roadmap v2.4` для порядка работ и dependencies;
3. внешние `Master Audit v2.1` и `AI Development Playbook v1.0`, когда они явно предоставлены в task context;
4. единственный active GitHub Roadmap Issue (`roadmap_id`, live status, dependencies, acceptance, rollback, privacy/cost class);
5. executable code/tests/workflows на exact candidate SHA;
6. architecture/ADR/operations docs;
7. README/user docs;
8. historical CHANGELOG/release notes.

Stale lower-priority source никогда не разрешает обходить current machine gate. Chat history/memory не является authority. Live lifecycle берётся из GitHub Issues, а не из плановой `Status` колонки Roadmap.

## 3. Autonomy Contract v2

Команда уровня `делай далее` исполняется через AIENG-002:

- `tools/roadmap-task-protocol.js`;
- `.ai-context/roadmap-task-packet.schema.json` (`PRH_ROADMAP_TASK_V2`);
- `docs/operations/AIENG002_ROADMAP_TASK_PROTOCOL.md`.

Правила:

1. continuation всегда разрешается в concrete Roadmap ID;
2. если ровно один writer `IN_PROGRESS`, продолжайте его;
3. иначе выбирайте один highest-priority explicit `READY` item, у которого все declared dependencies `DONE`;
4. multiple writers, missing/not-DONE dependencies, incomplete packet или private context → fail closed;
5. **one Roadmap ID = one GitHub Issue = one active writer**;
6. active Issue имеет `status: IN_PROGRESS`;
7. branch: `agent/<ROADMAP-ID>-<slug>`;
8. не поглощайте соседний Roadmap item в текущий scope;
9. PR в `main` содержит ровно одну canonical строку `Closes #<Issue>`;
10. red CI исправляется на **same active Roadmap branch/PR**, создавая новый exact candidate;
11. claim `DONE_ENGINEERING` или user-facing `DONE` only after stage-aware Main Verification изменил Issue и закрыл его;
12. только после этого resolver выбирает следующий task.

Каждый новый Issue объявляет `work_class`, `engineering_status`, `product_stage` и `target_stage`. `depends_on_product_ready` нельзя удовлетворить закрытым engineering-only Issue.

Нельзя заменять canonical chain manual merge, manual marker, release-snapshot branch, commit-count gate или anonymous runtime smoke.

## 4. Policy-gated actions

Автономность не разрешает:

- делать private Web App публичным;
- включать billing, paid overage, paid AI/OCR/API/provider или новый обязательный paid dependency;
- выполнять destructive/irreversible PROD financial-data changes;
- выполнять full-history cutover без отдельного Roadmap item и recovery/reconciliation gates;
- переписывать public Git history/force-push без explicit owner approval и independent backup/inventory;
- ослаблять privacy/security/reconciliation/`FREE_ONLY` gates ради green CI;
- публиковать owner-private deployment/runtime/backup/credential information.

## 5. Data classification

### Public-safe

Допустимы независимо созданные non-sensitive материалы:

- code, schemas, contracts, architecture, public docs;
- deterministic independently generated synthetic financial fixtures;
- technical reason/status/build/source-tree hashes;
- allowlisted non-financial latency/quota/capacity counters;
- privacy-safe backup evidence: encrypted hash, checksum/reconciliation state, RPO/RTO.

### Private

**Never commit** или публикуйте в Issue/PR/CI/docs:

- real transaction rows, operation IDs, descriptions, categories, accounts, counterparties;
- real или real-derived amounts/totals/aggregates/distributions/seasonality/control totals/screenshots;
- sampled/scaled/transformed household finance data;
- authenticated Dashboard/API bodies;
- OAuth tokens, refresh tokens, client secrets, private clasp configs;
- backup bytes, decrypted backup data, encryption keys;
- owner-private deployment/API executable IDs и local private storage paths.

Public finance tests используют только independently generated synthetic data.

## 6. Security/privacy contract

- Public repository finance content synthetic-only.
- Audit/telemetry — только explicit allowlist; financial/user payload не telemetry.
- Secret/privacy scanners обязательны.
- Не выводить credentials/private provider/runtime payload в diagnostics.
- Shared logs используют bounded technical reason codes вместо raw exception/HTTP body.
- Private runtime остаётся owner-only; trusted runtime proof использует authenticated Execution API.

## 7. FREE_ONLY contract

`FREE_ONLY` is an executable invariant.

- `PR_CONFIG.FINOPS.MODE` остаётся `FREE_ONLY`, пока отдельная authorized policy не говорит обратного.
- **Automatic paid overage is forbidden.**
- **Unknown/unconfigured billable provider fails closed.**
- Future provider требует conservative monthly safety envelope с `paidOverageAllowed: false` и Cost Guard reservation до billable execution.
- Optional workloads degrade/stop до projected overage.
- Required checks не могут зависеть от separately paid AI/API service.

## 8. Canonical machine delivery gates

```text
PR Validation
  -> immutable candidate bound to exact PR head SHA
Trusted DEV Deploy
  -> trusted default-branch policy verifies exact candidate
Trusted Runtime Health
  -> authenticated exact build/source-tree proof
Product Ready E2E (только work_class=user_facing)
  -> owner-authenticated deployed browser journey + sanitized evidence
CI-003 autonomous squash merge
  -> current eligible exact candidate
Main Verification
  -> verifies evidence and Issue IN_PROGRESS -> DONE/closed
```

Applicable PR Validation включает Node 24 locked install, supply-chain, trust-boundary, secret/privacy, `FREE_ONLY`, Documentation truth, AI contract, Roadmap task protocol, Multi-AI review protocol, financial/migration reconciliation, full contracts, responsive synthetic Playwright и immutable candidate build.

Green PR tests без trusted exact-SHA runtime evidence не означают completion. Для `work_class=user_facing` даже Trusted Runtime Health недостаточен без exact-candidate `product-ready-e2e=success`.

## 9. Financial-write policy

Ad-hoc writes в `01 Операции` запрещены. Canonical financial mutation требует отдельный Roadmap item и machine-verifiable contract, включающий как минимум:

- bounded data scope / batch size;
- deterministic **idempotency** key;
- **preconditions** / base revision / stale-write protection;
- allowed fields/actions;
- lock/concurrency semantics;
- privacy-safe audit identity;
- backup/snapshot/**rollback** plan для material mutation;
- write **readback** verification;
- financial **reconciliation** after mutation;
- fail-closed partial/error handling.

Proposal/staging/control/config writes не дают permission на canonical transaction mutation.

## 10. Migration policy

Исторический pre-MIG-010 marker **“Full-history migration is not currently declared complete.”** больше не является current state: MIG-010 owner-private execution прошла exact-bound authorization, staging/readback/finalize, fresh encrypted backup и post-write reconciliation с `unexplainedMismatch=0`, поэтому private stage = `OWNER_VERIFIED`. При этом MIG-010 GitHub lifecycle остаётся `IN_PROGRESS` до exact-head gates, CI-003 merge и Main Verification; generic repository write authority не открыта.

Любая новая migration/cutover должна быть **deterministic, resumable and idempotent** и хранить source **provenance**/fingerprints, missing/duplicate/changed/core-field mismatch detection, bounded batches, private reconciliation и recovery evidence. Stored legacy migration status не сильнее computed reconciliation. Big-bang cutover запрещён.

`OWNER_VERIFIED` одной миграции не переносит authorization на будущие mutations: новый irreversible write требует нового exact-bound owner authorization и fresh recovery evidence.

## 11. Build and reproducibility

- **Node runtime: Node 24**.
- Tracked `package-lock.json` + `npm ci`; не заменять CI на drift-prone `npm install`.
- Tooling versions exact/locked, где определены.
- **GitHub Actions remain pinned to immutable commit SHAs.**
- Candidate packaging связывает exact candidate SHA и source-tree identity.
- Generated `BuildInfo.js` не редактируется/коммитится вручную.
- Public tests deterministic + synthetic.

## 12. Architecture boundary

```text
clients/UI -> application services -> pure versioned financial/domain model
           -> repository contracts -> Google adapter | future YDB adapter
```

UI не владеет financial semantics. Google/Yandex details остаются adapter-specific. Future migration использует **shadow/dual-read/compare/canary/strangler** evidence. Не вводить household-scale microservice/event-broker complexity без отдельного Roadmap item.

## 13. Observability for new failure modes

Если изменение создаёт **new failure mode**, добавьте bounded **privacy-safe** observable signal: reason code, status/counter/latency/quota/capacity metric, contract test или equivalent evidence. Observability не может раскрывать financial payload.

## 14. Documentation / ADR rule

Если меняется contract, trust boundary, data classification, delivery path, financial semantics, migration invariant, provider/cost policy или operator procedure — синхронизируйте tracked docs в том же PR. Long-lived architecture decision оформляется ADR. Historical changelog не является current instruction.

Нормативный human-readable текст подчиняется `LANG-RU` из `docs/ROADMAP.md`: русский — основной язык; English сохраняется для machine-facing identifiers/API/schema/library/protocol names и технических путей, где этого требует tooling.

## 15. Definition of Done

Engineering lifecycle:

`CODE_COMPLETE -> DONE_ENGINEERING`.

Product lifecycle для `work_class=user_facing`:

`CODE_COMPLETE -> RUNTIME_INTEGRATED -> REAL_E2E_VERIFIED -> PRODUCT_READY -> DONE`.

**Definition of Done** требует:

- acceptance + tests;
- existing security/privacy/financial/migration/contracts/UI gates green;
- privacy-safe observability для новых failures;
- docs/ADR sync для изменённых contracts;
- отсутствие unauthorized paid dependency/service;
- exact candidate прошёл trusted deploy/runtime health, где требуется;
- CI-003 autonomous merge PASS;
- **Main Verification** PASS;
- linked Issue имеет `status: DONE` и closed.

Для engineering item `target_stage=DONE_ENGINEERING`; Main Verification сохраняет `engineering_status: DONE_ENGINEERING`, а product claim отсутствует.

Для user-facing item дополнительно обязательны:

- real private runtime binding на advertised canonical route;
- owner-authenticated deployed browser journey на exact candidate;
- correctness/parity, loading/empty/error, navigation/filter/drill и agreed SLO evidence;
- `product_stage: PRODUCT_READY` до close;
- exact-candidate status `product-ready-e2e=success`;
- sanitized public artifact без Web App locator, private values/labels/IDs или authenticated payload.

Synthetic Playwright, file-local render, contracts, route/HTML marker и exact-SHA health остаются полезными gates, но по отдельности не являются Product Ready evidence.

Merge сам по себе не полный DoD.

## 16. CI-red recovery

**CI-red recovery**: зафиксировать failing exact SHA/gate, изучить privacy-safe evidence, исправить root cause на **same active Roadmap branch/PR**, получить новый exact candidate и replay full chain. **Never bypass red CI** через manual merge/marker, public Web App, broader permissions или ослабление privacy/`FREE_ONLY`.

## 17. Multi-AI review — AIENG-003

Supplementary review использует:

- `.ai-context/MULTI_AI_REVIEW_CONTEXT.md`;
- `.ai-context/multi-ai-review-packet.schema.json` (`PRH_MULTI_AI_REVIEW_PACKET_V1`);
- `.ai-context/multi-ai-review-report.schema.json` (`PRH_MULTI_AI_REVIEW_REPORT_V1`);
- `tools/multi-ai-review-protocol.js`;
- `docs/operations/AIENG003_MULTI_AI_REVIEW_PROTOCOL.md`.

Обязательные independent roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Каждый report привязан к тому же exact candidate SHA и содержит bounded findings `severity/evidence(path+summary)/recommendation/confidence`.

Reviewer всегда `READ_ONLY`, `writer_authority=false`; он не push/merge/deploy, не изменяет Issue, не запрашивает secrets и не выполняет financial write. Duplicate role/reviewer или candidate mismatch → fail closed. Unresolved P0/P1 → review BLOCKED; P2/P3 advisory. Конфликты разрешают policy/spec/executable tests/ADR, **не голосование моделей**.

Multi-AI PASS — только supplementary evidence. Он никогда не отменяет red machine gate и не может самостоятельно пометить Roadmap `DONE`. Required CI contract deterministic/local и не требует paid model/API.

## 18. Repository AI context

Start with:

- `AGENTS.md`;
- `docs/ROADMAP.md` — каноническая Executable GitHub Roadmap v2.4; live lifecycle берётся из GitHub Issues;
- `.ai-context/PROJECT_CONTEXT.md`;
- `llms.txt`;
- active Roadmap Issue/task packet;
- relevant architecture/data/operations contracts.

AIENG-001, AIENG-002 и AIENG-003 — historical DONE. Product Recovery rebaseline 2026-08-11 supersedes прежние product claims: `GOV-REC-001` / Issue #219 — единственный active writer; ANL-090 / Issue #217 `BLOCKED / PAUSED_REBASELINE`, PR #218 draft. FIN-TRUTH, private migration `OWNER_VERIFIED`, privacy, `FREE_ONLY` и write boundaries сохраняются.

## 19. Local Git Mirror — ADWF

Если execution environment не может использовать обычный `git clone` / `git fetch` из-за deterministic DNS/HTTPS egress failure, после одного bounded direct-Git probe маршрутизируйте работу через `skills/adwf-local-git-mirror/SKILL.md`.

- Vendored Skill зафиксирован в `.ai-context/adwf-local-git-mirror.lock.json` на exact canonical ADWF upstream SHA; drift проверяется `node tools/verify-adwf-local-git-mirror.js`.
- После успешной materialization настоящий локальный `.git` workspace является предпочтительным инструментом для repository analysis, editing, generators/tests, `git diff`, `merge-base`, `worktree` и local commits.
- GitHub остаётся Source of Truth. Если direct remote Git/push недоступен, Connector допускается только для минимально необходимых provider-side bootstrap/mutation/readback/CI operations, а не как основной filesystem/code-editing transport.
- Preferred bootstrap использует disposable branch, `contents: read`, exact source SHA, one-day artifact и fail-closed checksum/manifest/`git bundle verify`/exact HEAD/`git fsck` verification.
- Persistent mirror workflow, credentials в repository/artifact/log и подмена exact SHA на `latest`/неявный HEAD запрещены.
- Этот infra mechanism не создаёт второй Roadmap writer и не ослабляет exact-candidate CI, Product Ready, privacy, FIN-TRUTH или `FREE_ONLY`.
