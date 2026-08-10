# DESIGN-020 — Design system и responsive shell

Статус: `IN_PROGRESS` до Main Verification.  
Machine contract: `PRH_DESIGN_SYSTEM_V1@1.0.0` (`lib/design/design_system.v1.json`).  
Dependency: `MASTER-G3 = PASS`.

## Цель

DESIGN-020 задаёт единый semantic visual layer для семейного Daily/Default интерфейса. Он не вводит новые финансовые вычисления: FIN-TRUTH, canonical schema, AnalyticsQuery и PERF contracts остаются upstream authority.

## Token model

CSS custom properties разделены на:

- typography: family, sizes, line-height, weights;
- spacing: 4/8/12/16/20/24/32 px;
- radius: sm/md/lg/xl/pill;
- elevation: card/panel/overlay;
- semantic surfaces/text/borders/status;
- focus ring;
- motion durations;
- mobile/tablet breakpoints.

Shell использует semantic tokens (`canvas`, `surface`, `text`, `text-muted`, `border`, `primary`, status surfaces) вместо привязки компонентов к конкретным hex-цветам.

## Themes

Поддерживаются `light` и `dark`.

Explicit boundary: `html[data-theme="light"]` / `html[data-theme="dark"]`. Если explicit attribute отсутствует, `prefers-color-scheme: dark` переключает semantic tokens системно.

Theme меняет только presentation. Финансовые значения, query/filter state и persistence semantics не зависят от темы.

## Accessibility

- ключевые normal-text foreground/background pairs имеют contrast ratio >= 4.5:1;
- `:focus-visible` использует единый заметный 3 px ring и offset;
- `prefers-reduced-motion: reduce` сводит optional transitions/animations к 1 ms;
- native form controls получают `color-scheme` через theme boundary;
- layout не должен создавать horizontal page overflow на desktop/tablet/mobile synthetic visual gate.

## Responsive shell

Current breakpoints сохраняют существующий доказанный Dashboard behavior:

- desktop: >1250 px;
- tablet/compact desktop: <=1250 px;
- mobile: <=760 px.

10 существующих top-level tabs сохраняются. DESIGN-020 унифицирует shell/tokens, но не добавляет VIZ-020 ChartSpec/ECharts или новые dashboard semantics.

## Privacy / cost

Design tokens не содержат financial payload. External CDN/font/design provider не требуется; используется local/system font stack. `FREE_ONLY` сохраняется.

## Verification

Named gate `Design system` проверяет:

- contract schema/tokens/themes/breakpoints;
- token parity между JSON и CSS;
- WCAG-oriented contrast pairs;
- explicit + system theme boundaries;
- focus-visible и reduced-motion;
- semantic-token usage в shell;
- отсутствие external asset dependency;
- отсутствие financial payload в design contract.

Full layered suite и responsive visual gate остаются обязательными.

## Rollback

Откатить design contract/docs/test и CSS token layer. Financial/domain/query contracts не затрагиваются; VIZ-020 снова dependency-gated до DESIGN-020 DONE.
