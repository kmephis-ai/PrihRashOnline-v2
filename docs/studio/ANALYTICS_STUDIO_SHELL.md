# STUDIO-080 — Progressive Analytics Studio shell

## Назначение

`STUDIO-080` добавляет в PrihRashOnline прогрессивную оболочку режимов `Daily -> Explore -> Studio`. Это слой presentation/configuration, а не новый финансовый движок и не новый dashboard composer.

Machine contract: `PRH_ANALYTICS_STUDIO_SHELL_V1@1.0.0`.

Главный UX-инвариант: текущий Financial Home остаётся default и соответствует режиму `DAILY`. Пользователь не переводится в экспертный режим автоматически. `EXPLORE` и `STUDIO` открываются только явным действием или явным URL.

## Режимы

### Daily

`DAILY` — rank 0 и canonical default. Он ведёт на существующий `surface=home` и сохраняет curated Financial Home без дополнительных аналитических controls.

Единственная capability shell-контракта — `CURATED_HOME`. STUDIO-080 не копирует карточки Financial Home и не создаёт вторую реализацию KPI.

### Explore

`EXPLORE` — rank 1, opt-in surface `studio`.

Оболочка показывает доступные semantic capabilities как ссылки/affordances существующих контрактов:

- period — ANL-071;
- measures/dimensions — semantic analytics registry;
- filters/drill — ANL-074 + VIZ-020;
- comparisons — ANL-071/BENCH-070;
- chart retype — VIZ-070;
- Pivot/OLAP — ANL-073.

Это декларации capability. HTML и shell module не исполняют `AnalyticsQuery` и не получают financial data.

### Studio

`STUDIO` — rank 2. Он включает все Explore capabilities и показывает будущие expert affordances:

- `DASHBOARD_COMPOSER_AFFORDANCE` -> DASH-080;
- `WIDGET_FACTORY_AFFORDANCE` -> DASH-081;
- `LAYOUT_AFFORDANCE` -> DASH-080;
- `SAVED_VIEWS_AFFORDANCE` -> DASH-084.

Все они имеют status `UPCOMING`. STUDIO-080 не реализует composer, drag-and-drop, widget factory, saved dashboards или cross-filter bus раньше соответствующих Roadmap items.

Capability set обязан быть монотонным: Explore не теряет Daily capability, Studio не теряет Explore capabilities.

## Разрешение режима

Default = `DAILY`.

Приоритет:

1. explicit URL parameter `mode`;
2. browser preference;
3. default Daily.

Допустимы только `DAILY`, `EXPLORE`, `STUDIO`. Если explicit URL содержит неизвестное значение, применяется `DAILY_FAIL_SAFE`. Такой запрос никогда не может случайно открыть expert mode.

Stored preference с повреждённой schema/version/mode также не даёт повышенный режим: core resolver безопасно возвращает Daily.

## Preference boundary

Browser persistence использует key `prh.analyticsStudio.mode.v1` и содержит только:

- schema;
- version;
- mode.

Financial values, AnalyticsQuery, filters, scope assignments, account/category/member/project IDs, credentials и runtime locators запрещены.

Browser storage — только convenience preference. Он не является storage authority проекта и не влияет на canonical financial state. URL override обеспечивает воспроизводимое открытие нужного режима без изменения финансовых данных.

Переключение обратимо между любыми валидными режимами. Transition result содержит `previous_mode`, `mode`, source и technical flags `query_execution=false`, `financial_write=false`.

## Canonical Web App integration

`CanonicalR2WebAppService.js` сохраняет:

- `DEFAULT_SURFACE=home`;
- private exposure `MYSELF`;
- legacy rollback route;
- существующий массив основной R2 navigation.

STUDIO-080 добавляет live static surface `studio` и отдельный launcher `Explore / Studio`. Этот surface не вызывает `prhR2BuildFinancialHomeRuntime_()` и не получает payload placeholder.

Home остаётся единственным default route, который получает private Financial Home runtime data. Остальные unbound R2 routes продолжают fail closed.

## Web shell

`AnalyticsStudioWebApp.html` не содержит `google.script.run`, private payload placeholder или synthetic financial preview.

В shell показаны только статусы contract capabilities. Надпись `FIN-TRUTH-v1` означает provenance boundary, а не наличие финансового результата в странице.

Daily tab ведёт обратно на canonical Financial Home. Explore/Studio могут переключаться на текущей странице и записывать mode-only preference.

## Keyboard и accessibility

Mode selector использует `role=tablist`, три `role=tab` и соответствующие `role=tabpanel`.

Обязательная клавиатура:

- `ArrowLeft` / `ArrowRight` — перемещение focus между tabs;
- `Home` — первый tab;
- `End` — последний tab;
- Enter/Space остаются нативной активацией button/link.

Активный tab имеет `aria-selected=true` и `tabIndex=0`; остальные `-1`. Panel имеет `aria-labelledby` на свой tab.

`focus-visible` обязателен. `prefers-reduced-motion: reduce` уменьшает transitions/animations до фактически нулевого времени.

## Responsive shell

Breakpoints наследуются из DESIGN-020:

- mobile <= 760 px;
- tablet <= 1250 px;
- desktop > 1250 px.

На mobile режимы остаются горизонтально доступными внутри собственного tab container, а content cards переходят в один столбец. На tablet capability grid — два столбца. На desktop — расширенная сетка.

Visual smoke проверяет 390x844, 768x1024 и 1440x900, body overflow, режимы, keyboard и ARIA.

## Telemetry

Public-safe telemetry allowlist:

- schema/version;
- mode;
- previous_mode;
- source;
- viewport_class;
- decision;
- reason.

Financial/query/filter/private identifier payload запрещён.

## Authority boundary

STUDIO-080 имеет:

- `financial_truth=false`;
- `financial_write=false`;
- `query_execution=false`;
- `query_mutation=false`;
- `canonical_mutation=false`;
- `storage=false`;
- `network=false`;
- `deployment=false`.

Private Web App остаётся `MYSELF`; paid dependency отсутствует; `FREE_ONLY` обязателен.

После Main Verification STUDIO-080 разблокирует DASH-080 как отдельный Roadmap item. DASH-080 не должен возвращать financial/query authority в shell или browser layout layer.
