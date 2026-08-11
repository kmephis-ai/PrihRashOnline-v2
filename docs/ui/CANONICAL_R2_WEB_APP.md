# Canonical R2 Web App — UI-MIG-020

## Назначение

`UI-MIG-020` переключает private canonical Web App с исторического `DashboardWebApp` на R2 shell. После cutover маршрут без параметров открывает `FinancialHomeWebApp`, а не legacy income-only Dashboard.

Нормативный contract: `PRH_CANONICAL_R2_WEB_APP_V1@1.0.0` (`lib/ui/canonical_r2_web_app.v1.json`). Private Web App сохраняет exposure `MYSELF`; задача не создаёт новую storage/write authority и не меняет `FIN-TRUTH-v1`.

## Почему cutover fail-closed

R2 browser surfaces были реализованы раньше runtime cutover и для Playwright используют independently generated synthetic fixtures. Такие fixtures полезны для visual regression, но не могут автоматически становиться private runtime fallback. Если private binding поверхности не доказан machine gate, canonical router показывает явный `SAFE_UNBOUND_FAIL_CLOSED`, а не synthetic суммы/операции.

Это особенно важно для `TransactionExplorerWebApp`, `ExpenseAnalyticsWebApp`, `IncomeAnalyticsWebApp`, `CashFlowWebApp`, `BudgetControlWebApp`, `ObligationsWebApp` и `DataQualityWebApp`: их визуальная готовность не равна доказанной runtime data binding.

## Default route и навигация

Primary navigation R2:

- `home` — Главная;
- `transactions` — Транзакции;
- `expenses` — Расходы;
- `income` — Доходы;
- `cash-flow` — Денежный поток;
- `budget` — Бюджет;
- `obligations` — Обязательства;
- `data-quality` — Качество данных.

`home` является default route. Исторический Dashboard доступен только по bounded rollback route `?surface=legacy` и не имеет default authority.

На этапе UI-MIG-020 private binding `home` имеет состояние `BOUND_READ_ONLY`. Остальные destinations имеют `SAFE_UNBOUND_FAIL_CLOSED`: они присутствуют в canonical navigation, но не показывают synthetic preview как реальные household data до отдельного доказательства binding.

## Financial Home runtime binding

`R2FinancialRuntimeService.js` — только Apps Script bridge `PRH_R2_FIN_RUNTIME_BRIDGE_V1`; financial formulas и canonical Google mapping в нём не копируются.

Immutable candidate packager детерминированно генерирует `R2CanonicalRuntimeBundle.js` непосредственно из versioned source-of-truth модулей:

- `lib/adapters/google_sheets_transaction_repository.js`;
- `lib/finance/financial_reconciliation.js`;
- `lib/finance/kpi_dictionary.js`;
- `lib/home/financial_home.js`;
- и их локальных versioned dependencies/contracts.

Generated bundle имеет schema `PRH_R2_CANONICAL_RUNTIME_BUNDLE_V1`. Он входит в exact candidate manifest и `sourceTreeHash`, поэтому trusted reconstruction обязан получить байт-в-байт тот же runtime из того же commit SHA. Generated файл не коммитится и не может стать вторым source of truth.

Bridge:

1. читает существующую `01 Операции` только через `prhGoogleRepositoryReadOperationsTable_`;
2. получает explicit currency из существующего `09 Настройки:currency`;
3. передаёт snapshot в canonical `google_sheets_transaction_repository`;
4. строит Home через canonical `financial_home.buildFinancialHome()`, который вызывает `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`;
5. для Home chart projection использует canonical `financial_reconciliation.aggregateTransactions()` и проверяет parity с Home cards;
6. не использует legacy total cells и не выполняет `setValue`, `setValues`, `appendRow` или другие financial writes.

### Human labels → canonical runtime IDs

Текущая книга хранит human-facing dimension labels, а `PRH_CANONICAL_TRANSACTION_V1` требует machine-safe IDs. UI-MIG не имеет права объявлять label постоянным canonical ID и не создаёт новый ID registry в Google Sheets.

Для read-only private Home действует versioned projection `PRH_RUNTIME_DIMENSION_LABEL_HASH_V1@1.0.0`:

- label нормализуется только технически: trim, collapse whitespace, lowercase;
- ID = `<kind>:SHA256(schema|kind|normalized_label)` для `account`, `category`, `member`, `project`;
- kind входит в hash input, поэтому одинаковый текст в разных dimension domains не получает общую identity;
- полный SHA-256 сохраняется, ID соответствует canonical machine-safe regex;
- повтор того же normalized label детерминированно даёт тот же ID;
- collision между разными normalized labels fail-closed;
- reverse map `projected ID → display label` существует только в памяти private render pass и нужен, например, чтобы Home показывал название категории вместо hash;
- projection не сохраняется, не записывается в книгу и имеет `persistent_identity_authority=false`, `write_authority=false`.

Это временная adapter-boundary identity для read-only UI. Она не заменяет будущую явную persistent dimension identity policy и не меняет DATA-010 authority.

Required gate `R2 Financial runtime parity` исполняет generated bundle в VM с Apps Script `Utilities`/gateway shims и сравнивает private-bridge output с canonical Node `evaluateKpis()` на synthetic adversarial fixture. Fixture специально использует human-facing Unicode labels, проверяет stable machine-safe IDs, private reverse-label projection и collision fail-closed. Тест также запрещает наличие собственного `prhR2FinAggregate_` или копий income/expense/refund/cash-flow формул в bridge.

Budget card остаётся `NOT_CONFIGURED`, пока explicit budget runtime binding не доказан. Liquidity не подменяется cash-flow proxy. BAL-030 как domain contract завершён, но его private runtime observation binding не предполагается автоматически.

## Synthetic boundary

Synthetic данные разрешены только для public CI/Playwright evidence. Private canonical runtime не имеет права использовать `SYN-*` fallback как household truth.

Unproven route показывает технический fail-closed state с reason code `RUNTIME_BINDING_NOT_PROVEN`; финансовые значения, private IDs и runtime locator в таком ответе отсутствуют.

## Trusted delivery

Authenticated technical render smoke возвращает `PRH_WEBAPP_SMOKE_V3|R2|OK`. Smoke:

- рендерит R2 shell и Financial Home default;
- проверяет server-side injection payload;
- проверяет bounded legacy rollback link;
- не читает financial rows;
- не публикует private Web App URL.

Отдельный authenticated private read smoke возвращает только `PRH_R2_HOME_READ_V3|CANONICAL_LIB|DIMENSION_HASH|OK|7`. Перед выдачей scalar он реально строит private Home через generated canonical bundle, выполняет deterministic dimension projection и проверяет provenance `generated_from_canonical_lib=true`, `financial_formula_copy=false`, `persistent_identity_authority=false`; сами суммы, labels, IDs и runtime locator наружу не возвращаются.

Если private Home падает, smoke разрешает наружу только bounded machine reason `RUNTIME_HEALTH_HOME_<CODE>` при безопасном uppercase code. Raw error message, financial payload или dimension label не возвращаются. Это позволяет отличить invalid type/status/category/date contract от parser line number без ослабления privacy.

После обычного PR Validation immutable exact candidate обязан пройти Trusted DEV Deploy и Trusted Runtime Health. Только затем `CI-003` может выполнить autonomous squash merge. Ручной merge не является штатным путём для UI-MIG-020.

## Rollback

Rollback UI-MIG-020 ограничен маршрутизацией: вернуть legacy Dashboard как default route. R2 contracts, FIN/DATA contracts и реальные financial/storage data при этом не требуют отката. `?surface=legacy` сохраняется до post-cutover verification именно для этого bounded recovery.

## Границы authority

UI-MIG-020 не получает financial truth, canonical transaction, persistent dimension identity, storage, financial write, runtime write или deployment authority. Generic Google write по-прежнему fail-closed через `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`; исторический `IRREVERSIBLE_ACTION_AUTHORIZED` не переиспользуется. `FREE_ONLY` обязателен.
