# ADR-VIZ-020 — ECharts 6.x как primary browser renderer behind adapter

- **Status:** Accepted for VIZ-020 foundation
- **Roadmap:** VIZ-020
- **Date:** 2026-08-10
- **Scope:** browser visualization renderer only

## Context

ANL-010 уже отделил `AnalyticsQuery/AnalyticsResult` и FIN-010 semantics от UI. DESIGN-020 ввёл versioned responsive/a11y presentation boundary. Следующий слой должен дать HOME/Expense/Income/Cash-Flow dashboards единый chart contract, не превращая конкретную JS library в доменную зависимость.

`docs/ROADMAP.md` v2.3 задаёт для VIZ-020 renderer-neutral `ChartSpec/WidgetSpec`, chart registry, shared `FilterContext/DrillContext` и ECharts 6.x baseline behind adapter.

## Decision

Primary browser renderer id: `ECHARTS_6` (Apache ECharts major 6 baseline).

ECharts не становится частью canonical/query/financial contracts. Integration идёт только через replaceable adapter:

```text
AnalyticsResult/runtime projection
        ↓
PRH_VISUALIZATION_RENDER_DATASET_V1
        +
PRH_CHART_SPEC_V1 configuration
        ↓
compileEChartsOption()
        ↓
ECHARTS_6 browser adapter/runtime
```

Machine renderer metadata находится в `lib/visualization/visualization_foundation.v1.json`.

## Why

Решение фиксирует один основной browser renderer для согласованной реализации следующих R2 dashboards, но сохраняет две независимые границы:

1. **semantic/config boundary** — ChartSpec/WidgetSpec не знают ECharts option shape и не содержат financial payload;
2. **runtime adapter boundary** — ECharts-specific option создаётся только из normalized spec + transient render dataset.

Это позволяет заменить renderer без изменения FIN-TRUTH, canonical schema или AnalyticsQuery/Result.

## Packaging / cost policy

- обязательный public CDN запрещён;
- `external_cdn_required=false`;
- baseline loading policy: `LOCAL_OR_BUNDLED`;
- paid provider/API не требуется;
- `FREE_ONLY` остаётся mandatory;
- VIZ-020 не активирует новый billable cloud/runtime dependency.

Конкретный способ bundling browser library может эволюционировать отдельно, пока сохраняются exact major compatibility, supply-chain gates и adapter contract.

## Security / privacy

ECharts adapter не имеет network/persistence/write authority. Real AnalyticsResult/render dataset/compiled option остаются private runtime data и не должны становиться GitHub artifact/log/screenshot.

Public contract/visual evidence использует independently generated synthetic data only.

## Accessibility / responsive boundary

Chart registry требует accessible summary metadata и responsive fallback. ECharts-specific visual output не отменяет DESIGN-020 focus/contrast/reduced-motion/responsive requirements; DOM around chart остаётся обязанностью application shell.

## Consequences

Положительные:

- единый renderer baseline для R2;
- renderer заменяем;
- financial/query semantics остаются upstream;
- no-CDN/FREE_ONLY path сохраняется;
- interaction state нормализуется независимо от library events.

Ограничения:

- VIZ-020 не мигрирует существующие Dashboard native SVG charts автоматически;
- runtime renderer option может содержать private values, поэтому не является public evidence;
- сложные pivot/brush/cross-filter capabilities остаются для R7/R8.

## Rejected alternatives

### Hard-code ECharts option как WidgetSpec

Отклонено: renderer option смешивает library configuration и runtime series payload, ухудшает portability/privacy и делает ECharts фактическим semantic authority.

### External CDN as required runtime

Отклонено: создаёт unnecessary network/supply-chain dependency и конфликтует с FREE_ONLY/offline/private direction.

### Сохранить только ad-hoc native SVG без registry

Отклонено: не создаёт versioned visualization contract и заставляет будущие dashboards снова дублировать chart/interaction logic.

## Rollback

Удалить VIZ-020 contract/adapter/ADR/tests. Existing native SVG Dashboard path остаётся доступным; canonical/FIN/ANL/storage state не изменяется.