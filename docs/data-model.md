# Модель данных и границы записи

## Текущее положение

Google Sheets остаётся private primary store/current adapter. Web Dashboard не копирует финансовую историю в GitHub и не создаёт public shadow database.

R0 уже отделяет **financial truth rules** от legacy spreadsheet totals через reconciliation contracts, но полный canonical schema/domain extraction и full-history migration относятся к следующим Roadmap waves. Поэтому текущую Google layout нельзя считать окончательным portable domain model.

## Основные private sheets

| Лист | Текущая роль | Типичный write boundary |
|---|---|---|
| `01 Операции` | transaction surface / source for Dashboard and reconciliation | Dashboard read-only; canonical mutations only via separately proven write policy |
| `09 Настройки` | technical settings/status | bounded technical values |
| `10 Контроль` | private KPI/control snapshots | append + readback where supported |
| `11 Предпросмотр` | quality proposal staging/review | bounded proposal state |
| `13 Журнал` | privacy-safe technical audit | bounded rotating append |
| `14 Аналитика` | existing spreadsheet analytics/fallback | existing private spreadsheet mechanisms |

Наличие листа или старого service не является автоматическим разрешением записи. Write authority определяется отдельным contract/policy.

## Financial truth

Legacy monthly/summary cells не используются как authoritative golden truth для financial CI.

Canonical financial reconciliation вычисляет expected semantics из transaction rules и machine-test invariants для:

- income / expense / cash-flow;
- transfer neutrality;
- refund/reversal behavior;
- zero values;
- integer-minor-unit rounding;
- category partition rules.

Реальные reconciliation values/deltas остаются private; наружу выходит только technical PASS/FAIL.

## Source-to-canonical provenance

Migration reconciliation требует deterministic source identity/fingerprint и умеет fail-closed обнаруживать:

- missing source row;
- duplicate source identity;
- changed source row;
- core-field mismatch;
- non-idempotent duplicate import.

Stored legacy status не переопределяет computed reconciliation result.

Полный history migration **не считается завершённым** до отдельного deterministic migration Roadmap item с backup/restore/private reconciliation evidence.

## Dashboard transaction fields

Текущие services распознают ключевые transaction fields по headers where possible, включая date/type/amount/category и дополнительные ID/description/status columns при наличии.

Эта spreadsheet header compatibility — adapter concern. Будущий `DATA-010` зафиксирует versioned canonical transaction schema независимо от UI/Sheet column layout.

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
- snapshot/readback не делает snapshot canonical financial truth выше transaction reconciliation rules.

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

## Будущий canonical model

R1 будет последовательно вводить:

1. versioned KPI Dictionary (`FIN-010`);
2. canonical transaction schema (`DATA-010`);
3. pure domain/application core;
4. repository contracts;
5. Google adapter и future YDB adapter;
6. deterministic full-history migration only after backup/reconciliation gates.

UI не должен знать, какой storage adapter является primary; financial truth живёт в versioned domain rules/contracts.
