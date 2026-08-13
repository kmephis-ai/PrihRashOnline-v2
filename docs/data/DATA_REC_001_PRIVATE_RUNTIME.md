# DATA-REC-001 — private Transactions + Data Quality runtime

## Цель

`DATA-REC-001` переводит разделы **Операции** и **Качество данных** из прежних synthetic/static preview в реальный owner-private read-only runtime canonical R2 Web App.

Это recovery-интеграция уже существующих канонических контрактов, а не новая финансовая модель. Финансовые формулы, запись операций, автоматическое исправление и миграционная authority не добавляются.

## Источник и snapshot truth

Оба раздела читают `01 Операции` через существующий `PRH_GOOGLE_SHEETS_TRANSACTION_ADAPTER_V1` и `prhGoogleRepositoryReadOperationsTable_`.

На один server request создаётся один `PRH_SINGLE_SCAN_REFRESH_V1` cycle:

1. canonical repository выполняет один `readAll`;
2. collection валидируется;
3. из canonical snapshot вычисляется repository revision;
4. Transactions или Data Quality работают только с этим immutable snapshot;
5. raw transaction identity и financial payload не попадают в public telemetry.

Cross-request snapshot reuse намеренно не заявляется. При переходе `Операции -> Качество данных` или обратно browser передаёт expected revision. Если workbook изменился между запросами, runtime возвращает `STALE_SNAPSHOT` и требует безопасной повторной загрузки вместо смешивания двух ревизий.

## Операции

Browser вызывает `prhR2FetchTransactionsPayload`.

Runtime использует canonical `PRH_TRANSACTION_EXPLORER_V1` для bounded filters, sort и pagination. UI получает только presentation projection:

- дата/тип/статус;
- amount в NORMAL, но не в MASKED;
- private human labels счёта/категории/члена семьи/проекта;
- описание/контрагент только в NORMAL;
- opaque revision-scoped `row_key` вместо raw `transaction_id`.

Итоги текущей страницы вычисляет canonical `FIN-TRUTH-v1` (`financial_reconciliation.aggregateTransactions`) по тем же canonical rows. Browser не пересчитывает финансовую семантику.

Форма редактирования отсутствует. `financial_write_authorized=false`, `canonical_mutation_performed=false`.

## Качество данных

Browser вызывает `prhR2FetchDataQualityPayload`.

Runtime использует canonical `PRH_DATA_QUALITY_CENTER_V1` на том же типе canonical snapshot. На household UI возвращаются только sanitized findings: kind/reason/severity + русское объяснение действия. `record_hash`, raw transaction IDs и private row locators не выдаются.

`previewRepairs` остаётся preview-only. Даже exact duplicate не означает удаление. `repair_write_authorized=false`, `canonical_mutation_performed=false`.

## Fail-closed states

Product UI обязан различать:

- `LOADING` — идёт async owner-private read;
- `READY` — snapshot валиден;
- `EMPTY` — canonical source пуст;
- `STALE_SNAPSHOT` — expected revision уже не совпадает;
- `MALFORMED_SOURCE` — структура/значение источника нарушает canonical mapping;
- `SOURCE_UNAVAILABLE` — private source временно недоступен;
- `PRIVACY_MODE_UNAVAILABLE` — private DATA route вызван в DEMO/ZEN.

Ни один error state не заменяется synthetic finance data.

## Privacy

Web App exposure остаётся `MYSELF`.

Product runtime поддерживает NORMAL и MASKED. DEMO/ZEN не подмешиваются в private Transactions/DQ и fail closed.

Public-safe telemetry разрешает только bounded technical metadata: revision/query/scan hash prefixes, counts, status/reason, timing. Financial values, labels, IDs, Web App locator и authenticated payload запрещены.

Synthetic data допускаются только внутри изолированного browser test harness; production HTML не содержит synthetic product fallback.

## Trusted delivery

`R2CanonicalRuntimeBundle.js` теперь включает canonical entry modules:

- `transactionExplorer`;
- `dataQuality`;
- `singleScanRefresh`;
- существующие Google adapter + FIN modules.

Authenticated runtime health проверяет exact candidate build, Home private read и DATA module boundary. Формат существующего `PRH_HEALTH_V1` scalar сохранён обратно совместимым; DATA proof выполняется внутри health function до возврата token.

Runtime health всё ещё **не является Product Ready E2E**. Для `DATA-REC-001=DONE` остаются обязательны exact-SHA deployed product journey, Product Ready evidence, merge и Main Verification.

## Rollback

Если DATA product gate не проходит, primary links `transactions`/`data-quality` должны быть скрыты, а Home + Legacy сохраняются. Rollback не изменяет canonical financial data.
