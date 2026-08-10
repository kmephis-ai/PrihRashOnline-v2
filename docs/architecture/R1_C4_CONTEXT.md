# R1 C4/context — каноническая финансовая платформа

Статус: нормативный public-safe архитектурный обзор для R1.  
Machine documentation map: `lib/documentation/r1_documentation.v1.json` (`PRH_R1_DOCUMENTATION_V1@1.0.0`).  
Roadmap: `DOC-010`.

## 1. System context

PrihRashOnline-v2 — приватный семейный финансовый инструмент. Финансовые данные остаются в private owner runtime; public GitHub является engineering/control plane и содержит только code/contracts/docs и independently generated synthetic finance fixtures.

```text
[Член семьи]
    |
    | private browser session
    v
[MYSELF Apps Script Web Dashboard]
    |
    | plain view/query requests
    v
[Application + Analytics core]
    |
    | PRH_TRANSACTION_REPOSITORY_V1
    v
[Google Sheets adapter / Apps Script gateway]
    |
    v
[Private Google Sheets canonical store]

[GitHub + GitHub Actions]
    | source/tests/contracts/docs + exact-SHA delivery only
    +----> [Trusted DEV Deploy] ---> [Private Apps Script runtime]
```

GitHub не является financial datastore, не получает private dashboard response bodies и не создаёт generic financial write authority.

## 2. C4 container view

### 2.1. Family UI container

**Current container:** private Apps Script HTML Web Dashboard, доступ `MYSELF`.

Responsibilities:

- отображение готовых financial/analytics results;
- read-only exploration/drill paths;
- технический refresh;
- user interaction shell.

Не-authority:

- FIN-TRUTH/KPI formulas;
- canonical transaction identity/schema;
- storage layout;
- migration/write authorization.

Machine health проверяется trusted runtime workflow; public deployment locator отсутствует.

### 2.2. Pure application/domain container

Machine contract: `lib/application/application_core.v1.json` (`PRH_APPLICATION_CORE_V1`).  
Primary test/check: `tests/pure_domain_application_core_contract_test.js` / `Pure domain/application core`.

Responsibilities:

- canonical validation/use-cases;
- deterministic financial snapshot orchestration;
- migration review/planning helpers.

Authorities: `io=false`, `network=false`, `financial_write=false`.

### 2.3. Financial truth container

Machine contract: `lib/finance/kpi_dictionary.v1.json` (`PRH_KPI_DICTIONARY_V1`, `FIN-TRUTH-v1`).  
Human contract: `docs/finance/KPI_DICTIONARY.md`.  
Test/check: `tests/kpi_dictionary_contract_test.js` / `KPI Dictionary`.

All Income/Expense/Cash Flow/Savings/refund/transfer semantics originate here. Legacy totals, spreadsheet formulas, dashboard code and aggregate caches cannot redefine them.

### 2.4. Canonical data container

Machine schema: `lib/domain/canonical_transaction.v1.schema.json` (`PRH_CANONICAL_TRANSACTION_V1`).  
Human contract: `docs/data/CANONICAL_TRANSACTION_SCHEMA.md`.  
Test/check: `tests/canonical_transaction_schema_contract_test.js` / `Canonical transaction schema`.

Canonical records are storage-neutral plain objects. Google row/column position is adapter provenance, not domain identity.

### 2.5. Analytics container

Machine contract: `lib/analytics/analytics_contract.v1.json` (`PRH_ANALYTICS_CONTRACT_V1@1.0.0`).  
Engine: `lib/analytics/analytics_engine.js`.  
Human contract: `docs/analytics/ANALYTICS_EXTENSION_CONTRACT.md`.  
Test/check: `tests/analytics_extension_contract_test.js` / `Analytics extension contract`.

Analytics is renderer/storage-neutral and delegates measures to FIN-010. Result provenance binds query, KPI/canonical contracts and input revision.

### 2.6. Repository port container

Machine contract: `lib/repository/transaction_repository.v1.json` (`PRH_TRANSACTION_REPOSITORY_V1`).  
Human contract: `docs/architecture/TRANSACTION_REPOSITORY_PORT.md`.  
Test/check: `tests/repository_adapter_contract_test.js` / `Transaction repository adapter`.

The port separates canonical semantics from storage. Current Google adapter supports read/query; generic Google canonical write is fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

### 2.7. Current Google adapter/runtime container

Components:

- `lib/adapters/google_sheets_transaction_repository.js`;
- `GoogleTransactionRepositoryGateway.js`;
- Apps Script runtime + private Google Sheets.

Responsibilities: map current sheet representation to canonical records and execute bounded platform reads. Google is current adapter, not permanent domain boundary.

### 2.8. R1 performance/read-model container

The layers are composable optimizations and **never new financial truth sources**:

| Roadmap | Contract | Role | Named check |
|---|---|---|---|
| PERF-010 | `PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0` | minimal projected Google ranges | `Query projection minimal ranges` |
| PERF-011 | `PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0` | exact-revision independent-request cache | `Revision-aware read cache` |
| PERF-012 | `PRH_SINGLE_SCAN_REFRESH_V1@1.0.0` | one immutable canonical snapshot per refresh cycle | `Single-scan refresh pipeline` |
| PERF-013 | `PRH_INCREMENTAL_ANALYTICS_AGGREGATES_V1@1.0.0` | exact-revision affected-bucket materialization | `Incremental analytics aggregates` |
| PERF-014 | `PRH_SYNTHETIC_SCALE_GATE_V1@1.0.0` | blocking synthetic 20k/50k CI guardrail | `Synthetic scale performance` |

Normative details are in `docs/operations/PERF010_QUERY_PROJECTION.md` … `PERF014_SYNTHETIC_SCALE_GATE.md`.

### 2.9. Recovery/migration container

DR-001 backup path: `docs/operations/DR001_DIRECT_OWNER_BACKUP.md`.  
MIG-010 human contracts: `docs/operations/MIG010_FULL_HISTORY_MIGRATION.md`, `docs/operations/MIG010_AUTHORIZED_EXECUTION.md`.

MIG-010 is historical DONE/OWNER_VERIFIED. One-time `IRREVERSIBLE_ACTION_AUTHORIZED` cannot be created/reused by GitHub Actions/AI for later mutations. Generic repository write remains blocked.

### 2.10. Observability/SLO container

Machine contract: `lib/observability/slo_error_budget.v1.json` (`PRH_SLO_ERROR_BUDGET_V1@1.0.0`).  
Human contract: `docs/operations/OBS010_SLO_ERROR_BUDGET.md`.  
Test/check: `tests/slo_error_budget_policy_contract_test.js` / `SLO error budget`.

Only technical allowlisted metadata is public-safe telemetry. Financial payload is never telemetry authority.

### 2.11. Engineering control plane container

Public GitHub stores source, Roadmap, contracts, tests and public-safe docs. Delivery chain:

```text
PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> autonomous squash merge
-> Main Verification
-> linked Issue DONE/closed
```

Normative runbook: `docs/RELEASE_PROCESS.md`. Machine policy: `.github/workflows/*.yml` + `tests/ci_trust_boundary_contract_test.js` + `tests/autonomous_merge_contract_test.js`.

## 3. Trust boundaries

### Public boundary

Allowed: source, contract IDs, synthetic fixtures, technical counts/timings/hashes/PASS-FAIL.  
Forbidden: household transactions/aggregates/distributions, private runtime locators, authenticated responses, OAuth/clasp, backup bytes/keys and owner-private evidence.

### Private runtime boundary

Google Sheets/Apps Script and generated aggregate/cache contents are private implementation state. Public evidence may expose only allowlisted technical metadata.

### Mutation boundary

Read/query/performance layers do not grant writes. A future financial mutation requires its own policy, idempotency, preconditions, backup/rollback, readback and private reconciliation; irreversible action requires fresh owner authorization.

### Cost boundary

`FREE_ONLY` is mandatory. None of the R1 canonical platform contracts requires a paid provider.

## 4. Future-provider boundary

Target remains ports/adapters, not big-bang replacement:

```text
Application / Analytics / FIN / Canonical
                |
     PRH_TRANSACTION_REPOSITORY_V1
          /                 \
Google adapter              future adapter (for example YDB)
```

Future storage must prove canonical/query/financial parity, privacy, recovery, SLO and free-only policy before cutover. R1 does not authorize that cutover.

## 5. Source of truth

Execution precedence:

1. security/privacy/cost/irreversible policy;
2. `docs/ROADMAP.md` + live Issue lifecycle;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. this and other human docs.

A Markdown statement can never override a red machine gate.
