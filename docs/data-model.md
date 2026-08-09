# Модель данных и границы записи

## Текущее положение

Google Sheets остаётся private primary store/current adapter. Web Dashboard не копирует финансовую историю в GitHub и не создаёт public shadow database.

R1 уже закрепил FIN-010 KPI Dictionary v1, DATA-010 Canonical Transaction v1, ARCH-010 pure core, ARCH-011 repository adapter и MIG-010 verified full-history migration. Current ANL-010 добавляет отдельный pure AnalyticsQuery/AnalyticsResult contract поверх canonical transactions и FIN-010, не открывая generic repository write authority.

## Основные private sheets

| Лист | Текущая роль | Типичный write boundary |
|---|---|---|
| `01 Операции` | canonical transaction surface / source for Dashboard and reconciliation | Dashboard read-only; future canonical mutations only via separately proven write policy |
| `09 Настройки` | technical settings/status | bounded technical values |
| `10 Контроль` | private KPI/control snapshots | append + readback where supported |
| `11 Предпросмотр` | quality proposal staging/review | bounded proposal state |
| `13 Журнал` | privacy-safe technical audit | bounded rotating append |
| `14 Аналитика` | existing spreadsheet analytics/fallback | existing private spreadsheet mechanisms, not canonical analytics truth |

Наличие листа/service/query contract не является автоматическим разрешением записи. Write authority определяется отдельным policy contract.

## Financial truth

Legacy monthly/summary cells не используются как authoritative golden truth.

KPI Dictionary v1 задаёт semantics для Income / Expense / Cash Flow / Savings / Budget variance, transfer neutrality, refund/reversal behavior, zero values, integer minor units, explicit period/currency policy и category partition rules.

Machine source: `lib/finance/kpi_dictionary.v1.json`; human contract: `docs/finance/KPI_DICTIONARY.md`.

ANL-010 не дублирует эти formulas: analytics measures вызывают FIN-010 evaluator. Это предотвращает divergence между Dashboard/analytics и canonical financial truth.

## Canonical Transaction v1

Portable domain record определён в:

- `lib/domain/canonical_transaction.v1.schema.json` — `PRH_CANONICAL_TRANSACTION_V1`;
- `lib/domain/canonical_transaction.js` — strict validator + compatibility helpers;
- `docs/data/CANONICAL_TRANSACTION_SCHEMA.md` — normative human contract.

Schema v1 содержит stable transaction identity, RFC3339 occurred time, type/status, integer `amount_minor` + currency, household dimensions, optional description/counterparty/reversal и structured provenance.

Unknown fields, duplicate identity, invalid money/currency/transfer/refund semantics fail closed. Canonical schema сама по себе не разрешает writes.

## AnalyticsQuery / AnalyticsResult v1

Machine contract: `lib/analytics/analytics_contract.v1.json` (`PRH_ANALYTICS_CONTRACT_V1@1.0.0`).

`PRH_ANALYTICS_QUERY_V1` — immutable/plain request shape:

- explicit currency;
- one or more FIN-010 measure IDs;
- zero or more canonical dimensions;
- bounded filters;
- optional explicit `[start,end)` period;
- grain `NONE|DAY|MONTH|YEAR`;
- comparison `NONE|PREVIOUS_PERIOD`;
- deterministic sort/limit;
- bounded measure parameters such as integer `budget_minor`.

`PRH_ANALYTICS_RESULT_V1` — plain deterministic result:

- query hash;
- current/comparison periods;
- dimensions + integer-minor-unit measures;
- total row count/truncation;
- provenance to analytics contract, canonical schema, KPI Dictionary, FIN-TRUTH and canonical input revision.

Analytics result — **derived read model**, а не новый financial source of truth и не persistence authority. Он может пересчитываться из canonical transactions. Real analytics result/aggregates остаются private и не используются как public fixtures.

Empty `dimensions: []` означает ungrouped aggregate. Equivalent filter/value ordering canonicalizes в одинаковый SHA-256 query identity. `BUDGET_VARIANCE` v1 намеренно не поддерживает grouped allocation без отдельной policy.

## Source-to-canonical provenance

Migration reconciliation использует deterministic source identity/fingerprint и fail-closed обнаруживает missing/duplicate/changed/core-mismatch states.

DATA-010 разделяет immutable logical source identity, source snapshot fingerprint и mutable `source_position`. `source_position` не является identity. Owner-confirmed identical occurrences могут использовать `CONTENT_FINGERPRINT_OCCURRENCE_V1` без изменения financial fields ради uniqueness.

MIG-010 full-history migration DONE: owner-authorized staging/readback/finalize, fresh encrypted post-write backup и `MIG010_OWNER_POST_RECONCILIATION_V1` PASS с `unexplainedMismatch=0`, полной provenance и idempotent rerun. Это не открывает generic write authority и не означает Yandex cutover.

## Dashboard transaction fields

Current services распознают transaction fields по Sheet headers where possible. Эта compatibility — adapter concern, не canonical domain contract.

DATA-010 canonical fields не определяются Google column order/names. ARCH-011 adapter преобразует Sheet representation в portable schema. ANL-010 затем работает только с canonical plain records и не знает spreadsheet layout.

## Quality queue — `11 Предпросмотр`

Proposal staging/review state не равно изменению canonical operation. Classifier/AI/proposal output не является financial truth без deterministic validation и отдельного write action.

## Control snapshots — `10 Контроль`

KPI/control snapshots могут содержать реальные household aggregates, поэтому остаются private. Public tests используют independently generated synthetic equivalents. Snapshot не становится authoritative выше canonical transaction/KPI rules.

## Audit — `13 Журнал`

OBS-001 использует privacy-safe allowlisted technical audit fields. Financial payload не telemetry.

## Cost usage counters

FINOPS-001 хранит только provider/month normalized technical usage counters. `FREE_ONLY` и `paidOverageAllowed:false` остаются executable invariants.

## Public GitHub privacy boundary

В public repository допустимы code/contracts/docs, independently generated synthetic financial fixtures и non-financial technical evidence.

Не допускаются real или real-derived transaction rows/IDs/amounts/totals/aggregates/category distributions/seasonality/control totals, private screenshots/exports/reports, authenticated Dashboard/API bodies, OAuth/private clasp, backup bytes/key или private deployment locators.

Это правило распространяется и на analytics tests: public query/result examples должны быть independently synthetic, а не derived from household data.

## R1 canonical model

1. `FIN-010` KPI Dictionary — DONE;
2. `DATA-010` Canonical Transaction — DONE;
3. `ARCH-010` pure domain/application core — DONE;
4. `ARCH-011` repository + Google adapter — DONE;
5. `MIG-010` deterministic full-history migration — DONE, private `OWNER_VERIFIED` + Main Verification;
6. `ANL-010` Analytics extension contract v1 — IN_PROGRESS;
7. дальнейшие dependency-ready items — по canonical Roadmap.

UI/renderer не должен знать storage adapter и не должен владеть financial formulas. Financial truth остаётся versioned FIN/canonical contracts; analytics является pure derived read-model boundary.
