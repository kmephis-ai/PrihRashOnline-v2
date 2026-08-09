# Модель данных и границы записи

## Текущее положение

Google Sheets остаётся private primary store/current adapter. Web Dashboard не копирует финансовую историю в GitHub и не создаёт public shadow database.

R0 отделил **financial truth rules** от legacy spreadsheet totals. R1 уже закрепил FIN-010 KPI Dictionary v1, DATA-010 portable Canonical Transaction v1, ARCH-010 pure core и ARCH-011 repository adapter. MIG-010 private full-history migration выполнена через отдельный owner-authorized boundary и подтверждена fresh-backup post-write reconciliation; generic repository write authority при этом не открыта.

## Основные private sheets

| Лист | Текущая роль | Типичный write boundary |
|---|---|---|
| `01 Операции` | canonical transaction surface / source for Dashboard and reconciliation | Dashboard read-only; future canonical mutations only via separately proven write policy |
| `09 Настройки` | technical settings/status | bounded technical values |
| `10 Контроль` | private KPI/control snapshots | append + readback where supported |
| `11 Предпросмотр` | quality proposal staging/review | bounded proposal state |
| `13 Журнал` | privacy-safe technical audit | bounded rotating append |
| `14 Аналитика` | existing spreadsheet analytics/fallback | existing private spreadsheet mechanisms |

Наличие листа или старого service не является автоматическим разрешением записи. Write authority определяется отдельным contract/policy.

## Financial truth

Legacy monthly/summary cells не используются как authoritative golden truth для financial CI.

Canonical financial reconciliation + KPI Dictionary v1 задают semantics для:

- Income / Expense / Cash Flow / Savings / Budget variance;
- transfer neutrality;
- refund/reversal behavior;
- zero values;
- integer-minor-unit money/rounding;
- explicit period/currency policy;
- category partition rules.

Machine source: `lib/finance/kpi_dictionary.v1.json`; human contract: `docs/finance/KPI_DICTIONARY.md`.

Реальные reconciliation values/deltas остаются private; наружу выходит только technical PASS/FAIL.

## Canonical Transaction v1

Portable domain record определён в:

- `lib/domain/canonical_transaction.v1.schema.json` — `PRH_CANONICAL_TRANSACTION_V1`;
- `lib/domain/canonical_transaction.js` — strict validator + compatibility helpers;
- `docs/data/CANONICAL_TRANSACTION_SCHEMA.md` — normative human contract.

Schema v1 содержит explicit:

- stable `transaction_id`;
- RFC3339 `occurred_at`;
- type/status;
- non-negative integer `amount_minor` + 3-letter uppercase `currency`;
- account/destination/category/member/project/tags;
- counterparty/description;
- reversal semantics;
- structured provenance.

Unknown canonical fields, duplicate transaction identity, invalid money/currency, invalid transfer/refund semantics и duplicate logical source identity отклоняются fail-closed.

Canonical schema не разрешает writes сама по себе. Она задаёт portable record contract, который application/repository adapters обязаны соблюдать.

## Source-to-canonical provenance

Migration reconciliation требует deterministic source identity/fingerprint и умеет fail-closed обнаруживать:

- missing source row;
- duplicate source identity;
- changed source row;
- core-field mismatch;
- non-idempotent duplicate import.

DATA-010 разделяет:

- immutable logical source identity: `source_system + identity_strategy + source_record_id + transform_version`;
- imported source snapshot fingerprint: `source_fingerprint`;
- mutable physical locator: `source_position`.

`source_position` не является logical identity. Изменение row position не должно менять logical source identity. Для DATA-001 legacy shape используется `CONTENT_FINGERPRINT_V1`, поскольку DATA-001 fingerprint не зависит от row movement. Для owner-confirmed identical occurrences MIG-010 использует `CONTENT_FINGERPRINT_OCCURRENCE_V1` без изменения financial fields ради uniqueness. Для providers со stable external ID предусмотрен `EXTERNAL_ID`.

Stored legacy status не переопределяет computed reconciliation result.

Full-history migration **owner-verified**: owner-authorized staging/readback/finalize завершены, создан fresh encrypted post-write backup, а `MIG010_OWNER_POST_RECONCILIATION_V1` доказал exact final target parity, `unexplainedMismatch=0`, полную provenance и idempotent rerun. Это не означает открытие generic write authority или выполнение Google -> Yandex cutover.

## Dashboard transaction fields

Текущие services распознают transaction fields по Sheet headers where possible. Эта compatibility — adapter concern, не canonical domain contract.

DATA-010 canonical fields не определяются порядком/названием Google columns. Google repository adapter (`ARCH-011`) преобразует Sheet representation в portable schema, а не протаскивает Spreadsheet layout в domain layer.

## Quality queue — `11 Предпросмотр`

Очередь является staging/review surface для quality issues и proposals.

```text
detected issue
→ proposal / explanation
→ staged review state
→ confirm or reject
```

Изменение proposal state не равно изменению canonical financial operation. Proposal/classifier/AI output не является финансовой истиной без deterministic validation и отдельного write action.

## Classification rules

Поддерживаемые подтверждённые rules хранятся в private Document Properties. Они могут содержать технические/нормализованные признаки, необходимые runtime, но не становятся public fixtures или model-training dataset автоматически.

## Control snapshots — `10 Контроль`

KPI/control snapshots могут содержать реальные household aggregates. Поэтому:

- они остаются в private Google workbook;
- их реальные значения не копируются в GitHub regression fixtures/docs/issues;
- public tests используют независимо сгенерированные synthetic equivalents;
- snapshot/readback не делает snapshot canonical financial truth выше transaction reconciliation/KPI rules.

## Audit — `13 Журнал`

OBS-001 устанавливает отдельную privacy-safe audit schema:

- technical fields проходят explicit allowlist;
- correlation/event identity сохраняются;
- journal bounded и rotates oldest rows;
- audit storage failure не превращает корректную financial operation в outage;
- technical health/counters не содержат financial payload.

## Cost usage counters

FINOPS-001 хранит только provider/month **normalized technical usage counters** в Script Properties. Это не деньги и не household finance data.

Cost Guard:

- не хранит transaction amounts/categories/descriptions;
- требует explicit provider safety envelope;
- conservatively reserve'ит usage до потенциального provider call;
- fail-closed блокирует unknown provider / paid-required workload / projected overage.

## Public GitHub privacy boundary

В публичном repository допустимы:

- source code;
- architecture/schema/contracts/docs;
- independently generated synthetic financial fixtures;
- non-financial technical build/latency/quota/cost-guard/status evidence.

**Не допускаются:**

- реальные transaction rows;
- реальные operation IDs;
- реальные или real-derived amounts/totals/aggregates/category distributions/seasonality/control totals;
- scaled/sampled/transformed fixtures, если они произведены из household finance data;
- private screenshots/exports/reports;
- authenticated Dashboard/API responses;
- OAuth tokens/client secrets/private clasp config;
- backup bytes, encryption key или decrypted backup payload;
- private deployment identifiers как public operational state.

Если public test нуждается в финансовой форме/edge case, данные генерируются независимо deterministic synthetic generator'ом.

## R1 canonical model

Dependency order / live truth:

1. versioned KPI Dictionary (`FIN-010`) — DONE;
2. canonical transaction schema (`DATA-010`) — DONE;
3. pure domain/application core (`ARCH-010`) — DONE;
4. repository contracts + Google adapter (`ARCH-011`) — DONE;
5. deterministic full-history migration (`MIG-010`) — private `OWNER_VERIFIED`, GitHub lifecycle завершается PR/Main Verification;
6. analytics contract (`ANL-010`) и дальнейшие dependency-ready items — по canonical Roadmap.

UI не должен знать, какой storage adapter является primary; financial truth живёт в versioned domain rules/contracts.
