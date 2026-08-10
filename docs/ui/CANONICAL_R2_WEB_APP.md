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

`R2FinancialRuntimeService.js` — read-only runtime adapter `PRH_R2_FIN_RUNTIME_ADAPTER_V1`. Он не является новым источником финансовой истины.

Adapter:

1. читает существующую `01 Операции` только через `prhGoogleRepositoryReadOperationsTable_`;
2. получает explicit currency из существующего `09 Настройки:currency`;
3. преобразует major units в integer minor units без implicit rounding;
4. применяет действующие `FIN-TRUTH-v1` semantics: posted income, expense, refund, transfer-neutral cash flow и zero-only adjustment;
5. строит R2 Financial Home view без использования legacy total cells;
6. не выполняет `setValue`, `setValues`, `appendRow` и другие financial writes.

Required gate `R2 Financial runtime parity` сравнивает runtime adapter с canonical `evaluateKpis()` из `PRH_KPI_DICTIONARY_V1@1.0.0` на synthetic adversarial fixture. Расхождение блокирует PR до deploy. Поэтому runtime adapter — parity-guarded projection, а не независимая financial formula authority.

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

После обычного PR Validation immutable exact candidate обязан пройти Trusted DEV Deploy и Trusted Runtime Health. Только затем `CI-003` может выполнить autonomous squash merge. Ручной merge не является штатным путём.

## Rollback

Rollback UI-MIG-020 ограничен маршрутизацией: вернуть legacy Dashboard как default route. R2 contracts, FIN/DATA contracts и реальные financial/storage data при этом не требуют отката. `?surface=legacy` сохраняется до post-cutover verification именно для этого bounded recovery.

## Границы authority

UI-MIG-020 не получает financial truth, canonical transaction, storage, financial write, runtime write или deployment authority. Generic Google write по-прежнему fail-closed через `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`; исторический `IRREVERSIBLE_ACTION_AUTHORIZED` не переиспользуется. `FREE_ONLY` обязателен.
