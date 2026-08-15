# FIN-LF-001 — Local-first finance runtime

Статус: engineering implementation для `MASTER-LF-FIN`. Product Ready требует отдельного exact-candidate owner UAT.

## 1. Что меняется для пользователя

`Главная`, `Расходы`, `Доходы` и `Денежный поток` становятся представлениями **одной живущей Local-first SPA-сессии**, а не четырьмя server request flows.

После появления `ACTIVE + VERIFIED` Local Read Model обычный путь выглядит так:

```text
route / shared FilterContext
        |
        v
one ACTIVE + VERIFIED IndexedDB snapshot
        |
        v
canonical analytics Web Worker
        |
        v
local DOM/UI render
```

Переход между четырьмя financial routes и изменение фильтра не требуют Google Sheets read и не используют remote transport как обязательный шаг.

## 2. Одна ревизия — одна финансовая сессия

Finance runtime читает только текущую `ACTIVE + VERIFIED` generation STORE-LF-001. Для render cycle сохраняется один объект snapshot:

- `generation_id`;
- `revision`;
- canonical transactions;
- dimensions.

`generation_id == revision` для текущей Local-first baseline. Каждый Worker query exact-bound к обоим значениям.

Если background DELTA/SYNC успешно переключил active generation, runtime:

1. читает новую verified generation;
2. инвалидирует старый render epoch;
3. rebind-ит Worker к новой generation/revision;
4. повторяет текущий route query с тем же FilterContext.

Результат старой generation/revision или предыдущего route/filter epoch не commit-ится в UI.

## 3. Shared FilterContext

`PRH_LOCAL_FINANCE_FILTER_CONTEXT_V1@1.0.0` живёт на уровне SPA session, а не внутри отдельного route.

Baseline fields:

- `currency`;
- `start`;
- `end` — exclusive end date, как в canonical analytics contract;
- `account_id`;
- `category_id`;
- `member_id`;
- `project_id`.

FIN-LF UI в первой интеграции предоставляет currency, period и category controls. Остальные fields уже входят в versioned context и могут быть подключены без изменения финансовой семантики.

FilterContext не содержит computed financial result payload и намеренно не сериализуется в URL/history. Route меняется через History API, а фильтр остаётся общей session state, поэтому Back/Forward не создаёт новый financial source of truth.

## 4. Финансовые расчёты только в canonical Worker

Main UI thread **не вычисляет** Income/Expense/Cash Flow/Savings.

Route queries:

| Route | Canonical Worker queries |
|---|---|
| Home | `INCOME + EXPENSE + CASH_FLOW + SAVINGS`, monthly `CASH_FLOW` |
| Expenses | total `EXPENSE`, `EXPENSE by category_id` |
| Income | total `INCOME`, `INCOME by category_id` |
| Cash Flow | totals `INCOME + EXPENSE + CASH_FLOW`, monthly series |

Все result payload приходят из того же `evaluateAnalytics()` / `PRH_ANALYTICS_CONTRACT_V1`, который уже доказан WORKER-LF-001.

UI разрешены только presentation transforms: currency formatting, label lookup и нормализация высоты визуального bar. Это не FIN authority и не меняет numeric financial value.

Каждый accepted result обязан иметь:

- `PRH_ANALYTICS_RESULT_V1`;
- `FIN-TRUTH-v1` provenance;
- `provenance.input_revision == active local revision`.

## 5. Deployment linkage

До FIN-LF-001 STORE/WORKER/SYNC/DELTA browser modules были tracked/tested в `pwa/`, но обычный Apps Script packager deploy-ил только root `.js/.html`.

FIN-LF-001 закрывает этот разрыв.

`tools/build-local-first-browser-runtime.js` детерминированно читает tracked modules:

- `pwa/local_read_model_store.js`;
- `pwa/local_first_sync.js`;
- `pwa/local_first_delta.js`;
- `pwa/local_finance_runtime.js`;

и generated canonical Worker bundle из `tools/build-local-analytics-worker.js`.

`tools/build-apps-script-candidate.js` заменяет **ровно один** placeholder `PRH_LOCAL_FIRST_BROWSER_RUNTIME` внутри `LocalFirstSpaWebApp.html` на embedded runtime script. Hash каждого tracked module, Worker hash и aggregate runtime hash записываются в candidate manifest.

Следствия:

- trusted artifact reconstruction доказывает exact runtime bytes;
- repository-only browser code больше не считается deploy evidence;
- runtime CDN не требуется;
- synthetic minimal packager fixtures без `LocalFirstSpaWebApp.html` остаются backward-compatible и не получают Local-first injection.

## 6. Cold bootstrap и background sync

Если verified local snapshot уже есть, finance UI рендерится локально сразу. DELTA-LF-001 sync запускается отдельно в фоне.

Если store пуст:

- финансовые суммы не выдумываются;
- UI показывает состояние первого bootstrap;
- допускается cold SYNC-LF-001 full bootstrap;
- после atomic verified finalize текущий financial route пересчитывается Worker-ом.

При network/sync failure и наличии verified snapshot пользователь продолжает работать с последней локальной ревизией, а status становится `DEGRADED`.

Явная кнопка фонового refresh является sync action, но не частью warm route/filter SLA.

## 7. Privacy

Реальные amounts/labels/transaction IDs живут только в owner-private browser runtime.

`NORMAL` показывает значения. `MASKED` и `ZEN` скрывают numeric values. `DEMO` в FIN-LF baseline также не подменяет owner truth synthetic sums: значения скрываются, а не заменяются фиктивными.

Public tests используют только synthetic canonical transactions. Candidate/source documentation и public telemetry не содержат household financial payload.

## 8. Visual baseline

FIN-LF UI использует responsive card/panel layout и локальные DOM/SVG/CSS-style primitives. Numeric values всегда берутся из Worker result; визуальная высота bar является только presentation normalization.

ECharts остаётся canonical visualization foundation проекта, но FIN-LF не делает внешний CDN или новую vendor dependency prerequisite для `MASTER-LF-FIN`. Более тяжёлая chart/performance интеграция проверяется последующими Local-first PERF/E2E gates.

## 9. Automated evidence

### `local_first_browser_runtime_packager_contract_test.js`

Доказывает:

- deterministic tracked runtime injection;
- deterministic Worker bundle;
- exact candidate manifest binding;
- no external runtime CDN;
- trusted reconstruction parity;
- backward compatibility synthetic packager fixtures.

### `local_finance_runtime_browser_adapter_test.js`

Настоящий Chromium + IndexedDB + настоящий generated analytics Worker:

- один verified snapshot для всех financial routes;
- shared FilterContext;
- direct canonical evaluator parity;
- overlapped route race -> stale discard;
- category/period filter reuse;
- zero HTTP requests после загрузки harness.

### `local_finance_spa_visual_test.js`

Сам `LocalFirstSpaWebApp.html`, собранный exact candidate packager-ом:

- desktop `1440x1000` NORMAL;
- representative mobile `390x844` MASKED;
- cold synthetic Google transport -> real IndexedDB/Worker;
- Home/Expenses/Income/Cash Flow;
- shared filters + Back;
- no horizontal overflow;
- zero warm HTTP requests.

## 10. Product Ready boundary

Автоматические tests и trusted runtime health доказывают engineering/runtime correctness, но не право объявить FIN-LF-001 `DONE`.

Так как `work_class=user_facing`, финальный gate требует **реального exact-candidate owner Product UAT / PRODUCT_READY_E2E**. AI и CI не могут выдать эту аттестацию от имени владельца.

## 11. Rollback

До `MASTER-LF-PRODUCT` canonical R2 rollback link сохраняется. Отключение FIN-LF runtime не меняет Google canonical source и не требует financial rollback transaction: Local Read Model остаётся derived/read-only.
