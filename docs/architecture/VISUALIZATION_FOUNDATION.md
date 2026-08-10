# VIZ-020 — Visualization Foundation v1

## Назначение

`VIZ-020` вводит versioned presentation boundary между `PRH_ANALYTICS_CONTRACT_V1@1.0.0` и конкретным browser chart renderer. Он не создаёт новую financial truth и не переносит query/financial logic в UI.

Machine contract: `lib/visualization/visualization_foundation.v1.json` (`PRH_VISUALIZATION_FOUNDATION_V1@1.0.0`).  
Executable implementation: `lib/visualization/visualization_foundation.js`.  
Contract test: `tests/visualization_foundation_contract_test.js`.  
Renderer decision: `docs/adr/ADR-VIZ-020-ECHARTS-6.md`.

## Authority boundary

Visualization foundation имеет только presentation-configuration/interaction authority.

```text
PRH_ANALYTICS_QUERY_V1
        ↓
PRH_ANALYTICS_RESULT_V1
        ↓ runtime rows only
PRH_VISUALIZATION_RENDER_DATASET_V1
        ↓
ChartSpec / WidgetSpec configuration
        ↓
replaceable renderer adapter
        ↓
ECharts 6.x option / browser renderer
```

Не разрешены:

- изменение `FIN-TRUTH-v1` или KPI formulas;
- создание/изменение canonical transactions;
- storage/network/persistence authority;
- financial write;
- renderer-specific option как canonical query contract;
- public real/real-derived financial fixtures/evidence.

`GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED` остаётся generic Google write boundary. Historical `IRREVERSIBLE_ACTION_AUTHORIZED` не переносится и не может повторно использоваться.

## ChartSpec v1

Schema: `PRH_CHART_SPEC_V1`.

ChartSpec описывает только configuration:

- stable `id`;
- `type`: `BAR`, `LINE`, `DONUT`;
- human title;
- semantic encodings (`DIMENSION` / `MEASURE` identifiers);
- presentation flags (`legend`, `stacked`, `smooth`, `show_labels`);
- interaction capability (`filter`, `drill`).

В ChartSpec запрещены financial/render payload keys: rows, records, transactions, dataset/data, points, amount/amount_minor и KPI value fields. Проверка рекурсивная и fail-closed.

## WidgetSpec v1

Schema: `PRH_WIDGET_SPEC_V1`.

WidgetSpec v1 связывает stable widget id, opaque `query_ref` и normalized ChartSpec. `query_ref` — ссылка/identity на query configuration; это не embedded AnalyticsResult и не financial payload.

V1 поддерживает `kind=CHART`. KPI/table/pivot widget types вводятся последующими Roadmap items, чтобы VIZ-020 не разрастался в Dashboard Composer.

## Chart registry

Machine registry является единым источником для базовых chart capabilities:

| Type | Required encodings | Optional | Responsive fallback |
|---|---|---|---|
| `BAR` | `x:DIMENSION`, `y:MEASURE` | `series:DIMENSION` | horizontal scroll / reduce label density |
| `LINE` | `x:DIMENSION`, `y:MEASURE` | `series:DIMENSION` | reduce label density |
| `DONUT` | `category:DIMENSION`, `value:MEASURE` | — | legend below |

Каждый registry entry требует accessible summary и декларирует filter/drill capability. Registry не содержит финансовых значений.

Supported semantic IDs берутся из upstream ANL-010 vocabulary:

- dimensions: `time_bucket`, `account_id`, `category_id`, `member_id`, `project_id`, `type`;
- measures: `INCOME`, `EXPENSE`, `CASH_FLOW`, `SAVINGS`, `BUDGET_VARIANCE`, `GROSS_EXPENSE`, `REFUND`, `TRANSFER`.

## FilterContext v1

Schema: `PRH_FILTER_CONTEXT_V1`.

FilterContext хранит interaction state отдельно от financial truth:

```json
{
  "schema": "PRH_FILTER_CONTEXT_V1",
  "contract_version": "1.0.0",
  "filters": [
    {
      "kind": "DIMENSION",
      "field": "category_id",
      "operator": "INCLUDE",
      "values": ["SYN-FOOD"]
    }
  ]
}
```

Normalization сортирует filters/values и вычисляет `context_hash = SHA256(CANONICAL_JSON)`. Две записи для одной пары `field+operator` считаются ambiguous и fail closed; values должны быть объединены до normalization.

Runtime FilterContext может содержать private dimension IDs, поэтому он не является public evidence. Public tests используют только `SYN-*` values.

## DrillContext v1

Schema: `PRH_DRILL_CONTEXT_V1`.

DrillContext содержит:

- `source_widget_id`;
- allowlisted target `DETAILS` или `TRANSACTION_EXPLORER`;
- normalized FilterContext;
- deterministic `context_hash`.

Произвольный URL/route из ChartSpec не допускается. Это предотвращает превращение визуализации в неконтролируемый navigation/network surface.

## Runtime render dataset

Schema: `PRH_VISUALIZATION_RENDER_DATASET_V1`.

Это **не сохраняемый spec**, а transient in-memory boundary для renderer adapter:

```text
rows[] = {
  dimensions: { semantic_dimension_id: string },
  measures: { semantic_measure_id: integer_minor_units }
}
```

`max_render_rows=5000`. Measure values обязаны быть safe integers. Adapter не логирует, не persist-ит и не отправляет dataset по сети. Real dataset остаётся private runtime data. Public CI использует independently generated synthetic rows.

## ECharts 6.x adapter

`compileEChartsOption()` принимает отдельно:

1. normalized configuration-only ChartSpec;
2. runtime render dataset.

Он возвращает `{ renderer: "ECHARTS_6", option }` in-memory. `option` может содержать runtime series values, поэтому сам option также не является public evidence для real data.

Adapter:

- не вызывает сеть;
- не загружает CDN;
- не пишет storage;
- не формирует AnalyticsQuery;
- не меняет financial calculations;
- может быть заменён другим renderer adapter при сохранении ChartSpec/WidgetSpec contract.

## Interaction helpers

`filterContextFromSelection()` переводит selection только по `DIMENSION` encoding в normalized FilterContext. Selection по measure encoding отклоняется.

`drillContextFromSelection()` использует тот же filter state и создаёт allowlisted DrillContext. Это даёт единый predictable interaction model для HOME-020/EXP-020/INC-020 и последующего ANL-074.

## Privacy / FREE_ONLY

- public finance evidence: `SYNTHETIC_ONLY`;
- financial payload inside ChartSpec/WidgetSpec: forbidden;
- real render dataset/option: private runtime only;
- private deployment/runtime locator: not public;
- external CDN/provider: not required;
- paid dependency: not required;
- `FREE_ONLY` mandatory.

## Rollback

Откат VIZ-020 удаляет visualization contract/adapter/tests/docs. Existing Dashboard native SVG charts остаются рабочим renderer path, пока отдельный UI migration item явно не переключит их на ECharts adapter. Canonical/FIN/ANL/storage данные не требуют migration или rollback.