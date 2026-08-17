# YC-040 — YDB Serverless PoC и FREE_ONLY cost envelope

## Назначение

`PRH_YDB_SERVERLESS_POC_V1@1.0.0` проверяет, что DATA-010 canonical transaction можно lossless отобразить в YDB/YQL и обратно, а будущий Serverless adapter может быть защищён отдельным conservative cost envelope.

Это **PoC**, а не cutover. Google Sheets + Apps Script остаются текущим authoritative runtime/store. YC-040 не создаёт реальную YDB database, не меняет canonical write ownership и не реплицирует household data.

## Проверенная внешняя база на 2026-08-10

Использованы официальные материалы Yandex Cloud / YDB:

- Yandex Cloud, «Free tier», обновлено 2026-07-23: Yandex Managed Service for YDB — первые 1 000 000 Request Units в месяц и первые 1 GB/month data storage без дополнительной платы; automatic backups — два full backups за последние два дня; после бесплатного объёма применяется тарификация.
- Yandex Cloud, «Pricing policy for Serverless mode in Managed Service for YDB», обновлено 2026-07-28: Serverless тарифицирует data operations в RU и storage; стоимость запросов зависит от фактически потреблённых RU.
- Yandex Cloud, «Serverless and dedicated operation modes»: cloud quota/throughput limit не является финансовым safety cap; serverless DB имеет отдельный throttling RU/s и maximum-data limits.
- YDB, `CREATE TABLE` / primitive data types: row table использует explicit columns + mandatory primary key; `Utf8`, `Uint32`, `Uint64` — primitive types, пригодные для PoC schema.

Free tier относится к billing account и может быть общим для нескольких organizations/clouds. Поэтому документированный free package **не является доступным остатком**, пока trusted billing/usage adapter не подтвердил текущий state.

## Почему CI не ходит в Yandex Cloud

Required evidence YC-040 полностью synthetic/offline:

- нет service-account/OAuth/API key;
- нет database endpoint/id;
- нет billing account id;
- нет real financial rows;
- нет billable YDB operation.

Это намеренно: при `FREE_ONLY` реальный вызов без подтверждённого остатка общего billing-account free tier должен fail-closed.

Future live adapter обязан сначала предоставить trusted state `FREE_TIER_CONFIRMED_CURRENT`; unknown/stale billing state блокируется.

## Canonical → YDB mapping

YQL PoC: `lib/ydb/canonical_transactions_v1.yql`.

Primary key = `transaction_id Utf8 NOT NULL`.

Money остаётся non-negative integer minor units: `amount_minor Uint64 NOT NULL`.

Canonical `occurred_at` сохраняется как **exact RFC3339 Utf8**, а не преобразуется необратимо в YDB Timestamp. Это сохраняет исходную canonical representation, включая offset. Будущий derived UTC/query column может добавляться отдельно, но не становится DATA-010 authority.

Tags хранятся как canonical JSON-array text (`tags_json Utf8`). Provenance разложен в explicit columns. Nullable canonical fields остаются nullable YDB columns.

`canonicalToYdbRow()` → `ydbRowToCanonical()` обязан давать exact normalized DATA-010 round-trip на synthetic fixtures.

## PoC adapter

`createInMemoryPoc()` моделирует YDB-shaped row table в памяти и проверяет:

- deterministic upsert-by-primary-key representation;
- read by `transaction_id`;
- deterministic category query;
- lossless canonical round-trip;
- stable snapshot hash.

Это adapter/schema evidence, **не emulator YDB performance** и не cloud integration claim.

## FREE_ONLY envelope v1

Documented current free package используется только как внешний reference:

```text
1 000 000 RU/month
1 GiB/month storage
```

Required PoC safety envelope намеренно существенно ниже:

```text
250 000 RU/month
256 MiB storage
100 000 requests/month internal guard
5 RU/s peak reservation guard
paidOverageAllowed = false
```

RU/storage envelope = 25% документированного free package. Request count — внутренний safety dimension, а не утверждение о billing unit.

Cloud quota **не** считается billing cap.

## Circuit breaker

`evaluateReservation(current, reservation, context)` работает fail-closed:

- billing state не `FREE_TIER_CONFIRMED_CURRENT` → `YDB_FREE_ONLY_BILLING_STATE_BLOCKED`;
- peak > 5 RU/s → `YDB_FREE_ONLY_PEAK_RU_BLOCKED`;
- projected RU/storage/request count выше safety envelope → соответствующий `*_ENVELOPE_BLOCKED`;
- paid overage всегда запрещён.

Reservation only increments usage. Освобождение storage/credits не моделируется в v1, чтобы guard не мог занижать projected consumption без trusted source.

## Telemetry / privacy

Public telemetry allowlist:

- schema/version/provider mode/month key;
- RU/storage/request counters;
- utilization basis points;
- circuit state/status/reason code.

Transaction amount/content, account/category/member IDs, database endpoint/id, billing account id и credentials запрещены.

## Runtime authority

YC-040 не добавляет YDB provider в production Apps Script `PR_CONFIG.FINOPS.PROVIDERS`. Это намеренно: PoC не должен автоматически превращаться в runtime cloud permission.

До YC-042/YC-043 и отдельного trusted cloud/billing adapter:

- Google остаётся authoritative store;
- YDB canonical write owner = false;
- real replication = false;
- billing enablement = false;
- paid overage = false.

## Machine evidence

- `lib/ydb/ydb_serverless_poc.v1.json`;
- `lib/ydb/canonical_transactions_v1.yql`;
- `lib/ydb/ydb_serverless_poc.js`;
- `tests/ydb_serverless_poc_contract_test.js`;
- named PR gate `YDB Serverless PoC`;
- full layered + privacy + FREE_ONLY regression.

## Rollback

Revert YC-040 contract/YQL/adapter/tests/docs/gates. Никаких cloud resources, credentials, real-data replication или write-ownership changes откатывать не требуется.
