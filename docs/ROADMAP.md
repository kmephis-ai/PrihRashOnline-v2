# PrihRashOnline-v2 — Executable GitHub Roadmap v2.3

Дата: 2026-08-09  
Источник решений: `Master Audit v2.1` + `Analytics-first Finance OS` + согласованный Ghostfolio product/architecture benchmark  
Назначение: публично-безопасный исполняемый backlog для GitHub  
Статус документа: FINAL / EXECUTABLE / ANALYTICS-FIRST / GHOSTFOLIO-BENCHMARK EXTENSION

## 1. Контракт Roadmap

Roadmap является единственным публичным источником порядка инженерных работ. Приватные фактические финансовые показатели, реальные суммы, категории, строки операций и производные от них агрегаты в GitHub не публикуются.

Нормальная разработка автономна: `Issue -> branch -> PR -> machine gates -> trusted deploy -> authenticated health -> squash merge -> main verification -> close Issue`. Ручное инженерное подтверждение не является штатным gate.

Исключения — только операции, которые сами по себе необратимы либо изменяют пользовательские финансовые данные. Они должны останавливаться policy gate и иметь явный rollback/backup contract.

### 1.1. Непереговорные политики

| Policy | Требование |
|---|---|
| DATA-PUBLIC | В public repo, CI logs и public artifacts разрешены только synthetic/anonymous fixtures. |
| FIN-TRUTH | Финансовые KPI вычисляются из canonical transactions по versioned KPI definitions, а не из legacy total cells. |
| CI-NO-SECRETS | Код из PR/fork/candidate не получает deployment credentials. |
| DEPLOY-TRUST | Secret-bearing deployment запускается только workflow-кодом trusted default branch для проверенного immutable commit SHA. |
| AUTO-FLOW | Обычная инженерная работа не требует human approval; merge выполняется автоматически после green gates. |
| ZERO-COST | Платные SKU/API не являются обязательной зависимостью. Runtime обязан fail-safe до выхода за бесплатный envelope. |
| RECOVERABLE | Любая миграция/массовая запись имеет backup, idempotency и проверенный restore/rollback. |
| OBS-PRIVATE | Telemetry содержит технические метаданные, но не суммы, описания, категории или payload финансовых операций. |
| AI-SOURCE-OF-TRUTH | Chat history/memory не является authority; решения берутся из Roadmap/Issues/ADR/code/tests/versioned docs. |
| AI-ONE-WRITER | На один work item одновременно один AI writer; дополнительные ИИ работают как независимые reviewers/advisers. |
| AI-ZERO-COST | ChatGPT Plus capabilities допустимы в пределах подписки; API-key AI automation не является обязательным gate и выключена при `FREE_ONLY`, если требует отдельной оплаты. |
| ANALYTICS-FIRST | Финансовый смысл задаётся canonical domain/KPI/semantic layer; dashboard/chart не содержит собственной альтернативной бизнес-логики. Новые аналитические возможности проектируются как комбинации measures/dimensions/filters/time, а не как набор hard-coded отчётов. |
| SIMPLE-BY-DEFAULT | Повседневный интерфейс остаётся простым; `Analytics/Studio/Expert` раскрываются progressive disclosure и не являются обязательными для базового домашнего бюджетирования. |
| VIZ-PORTABLE | Визуализации получают данные через versioned `AnalyticsQuery/AnalyticsResult` и renderer-neutral `ChartSpec`; сохранённые dashboard specs не содержат фактических финансовых payload. |
| LANG-RU | **Русский язык — единственный нормативный язык человеческой части проекта:** README, Roadmap, ADR, Issues, PR/commit descriptions, Release Notes, CHANGELOG, runbooks, AI context/prompts/playbooks, пользовательская документация и поясняющие domain-комментарии ведутся на русском. Английский сохраняется для machine-facing identifiers, API/schema fields, имён библиотек/протоколов/стандартов и технических путей/branch slug там, где этого требует tooling. |
| REF-CLEANROOM | Внешние open-source проекты используются как product/architecture benchmark. Их идеи и паттерны переосмысливаются независимо; исходный код с несовместимой/обязывающей лицензией не копируется в PrihRashOnline без отдельного ADR и явного license review. |

### 1.2. Жизненный цикл единицы работы

`BACKLOG -> READY -> IN_PROGRESS -> PR_OPEN -> DEV_VERIFIED -> DONE`

Допустимое исключение: `BLOCKED`. Оно выставляется только при наличии machine-readable evidence: failed dependency, failed invariant, quota/cost circuit breaker, unavailable provider или irreversible-action policy gate.

### 1.3. GitHub contract

- одна canonical work item = один GitHub Issue с ID из этой Roadmap;
- branch: `agent/<ID>-<slug>`;
- PR title: `[<ID>] <result>`;
- PR закрывает Issue только после всех acceptance checks;
- зависимости считаются выполненными только при `DONE` всех `depends_on`;
- status Roadmap выводится автоматически из GitHub Issues/PR/checks, а не редактируется вручную;
- колонка `Status` в таблицах этого документа задаёт только исходное/плановое состояние; для Autopilot и lifecycle текущее состояние GitHub Issue всегда имеет приоритет над табличным значением, даже если документ ещё не пересобран;
- public CI evidence содержит только synthetic results и технический PASS/FAIL;
- private source/canonical reconciliation публикует наружу только итог gate, без real-derived значений.
- human-readable Issue/PR/commit/release text ведётся на русском; допустимы технические английские ID/prefix (`[FIN-010]`, `feat:`, API names) с русским смысловым описанием.

### 1.4. Product contract — `Analytics-first Finance OS`

Целевая идентичность PrihRashOnline-v2: **простой семейный финансовый центр сверху и глубокая персональная BI/OLAP-платформа внутри**. Масштаб аналитики является конкурентным преимуществом, но сложность всегда опциональна.

Уровни интерфейса:

1. `Daily / Default` — готовые HOME/EXP/INC/CF/BUD экраны без необходимости конфигурации.
2. `Explore / Analyst` — произвольный период, measure/dimension/filter, сравнение, смена визуализации, cross-filter, drill-down/drill-through и сохранение представления.
3. `Analytics Studio / Expert` — конструктор dashboard, grid layout, widgets, собственные KPI views, темы, global filters, versioned presets и import/export конфигурации.

`WOW` определяется не количеством диаграмм, а связным исследованием данных: выбор сегмента должен распространять контекст на связанные widgets, пользователь должен проваливаться от долгого периода до исходных canonical transactions, менять представление без изменения финансовой семантики и получать воспроизводимый результат с provenance.

Полный Studio не входит в критический путь R0. Однако R1/R2 обязаны оставить расширяемые контракты, чтобы R7–R10 добавлялись эволюционно, а не через замену domain/UI architecture.

### 1.5. Внешний benchmark — Ghostfolio

`Ghostfolio` используется как постоянный **референс зрелого privacy-first wealth/personal-finance продукта**, но не как технологический шаблон или source-code dependency. Заимствуются и независимо реализуются проверенные идеи: account/balance snapshots, system tags и analysis scopes, benchmark comparisons, privacy/redaction modes, deterministic X-Ray/rule-based analysis, reusable calculated snapshots, import validation и progressive-disclosure UX.

Не копируются автоматически: Nx/Angular/NestJS/PostgreSQL/Redis stack, инвестиционно-специфическая domain model, внешние платные data providers и исходный AGPL-код. Архитектура PrihRashOnline остаётся modular domain core + ports/adapters, `FREE_ONLY`, canonical-money-safe и backend-portable.

## 2. Wave R0 — Truth, Privacy, Autonomous Delivery, Recovery

Цель: сначала доказать корректность финансовой истины и безопасный полностью автоматический delivery loop. До завершения `MASTER-G0..G2` новые продуктовые dashboard features не являются приоритетом.

| ID | Priority | depends_on | Deliverable | Machine DoD / evidence | Status |
|---|---|---|---|---|---|
| TEST-001 | P0 | — | Synthetic finance fixture generator | deterministic seed; edge cases для income/expense/transfer/refund/zero/rounding/date boundaries; public tests не зависят от production-derived values | BACKLOG |
| SEC-001 | P0 | TEST-001 | Synthetic-only public repository | current tree очищен от real-derived fixtures; privacy scanner green; public tests green на synthetic data; план очистки history сформирован отдельно | BACKLOG |
| SEC-002 | P0 | — | Security/privacy policy-as-code | allowlist telemetry/audit fields; forbidden financial payload patterns; secret scan + privacy scan обязательны в PR | BACKLOG |
| FIN-001 | P0 | TEST-001 | Canonical financial reconciliation gate | KPI totals строятся из raw/canonical transaction rules; category partition, cash-flow, transfer/refund/rounding invariants green; вся доступная приватная история проходит без необъяснённых расхождений | BACKLOG |
| DATA-001 | P0 | TEST-001 | Source-to-canonical migration reconciliation | каждая migrated row имеет provenance; core-field mismatch не может получить clean status; missing/duplicate/changed source row детектируется; rerun idempotent | BACKLOG |
| SEC-003 | P0 | — | Reproducible supply chain | supported LTS runtime; lockfile; `npm ci`; deployment CLI pinned; third-party Actions pinned to immutable full commit SHA; dependency/security checks green | BACKLOG |
| CI-001 | P0 | SEC-002,SEC-003 | Split no-secret CI and trusted deploy | PR workflow имеет минимальные permissions и zero deploy secrets; trusted deploy workflow живёт на default branch и принимает immutable candidate SHA | BACKLOG |
| CI-002 | P0 | CI-001 | Authenticated exact-SHA runtime verification | deployment identity verified; deployed version связан с candidate SHA; authenticated health проверяет реальный private Apps Script runtime; manual marker отсутствует | BACKLOG |
| CI-003 | P0 | FIN-001,DATA-001,CI-002 | Fully autonomous merge loop | required checks green -> squash auto-merge; commit-count/snapshot/manual-marker gates удалены; post-merge direct commits отсутствуют; main verification автоматически закрывает Issue | BACKLOG |
| DR-001 | P0 | SEC-002 | Portable encrypted backup + restore drill | canonical export + manifest + schema/revision + checksum; независимая копия; restore в isolated target проходит; RPO/RTO измеряются machine evidence | BACKLOG |
| OBS-001 | P0 | SEC-002 | Privacy-safe audit/telemetry baseline | bounded/rotating audit storage; allowlisted event schema; correlation ID; latency/error/quota metrics; sensitive payload test redaction green | BACKLOG |
| FINOPS-001 | P0 | OBS-001 | `FREE_ONLY` runtime guard | usage counters; configurable monthly safety budget; provider throttle/circuit breaker; optional workloads выключаются до paid threshold; тест доказывает fail-safe behavior | BACKLOG |
| DOC-001 | P0 | SEC-002 | Documentation truth reset | README/status/release/autonomy/security/backup docs описывают фактическое текущее состояние и target gates; stale RC/manual workflow instructions удалены; docs-drift check green | BACKLOG |
| DOC-002 | P1 | DOC-001,AIENG-001 | Русский нормативный контур документации | inventory всех normative human-facing docs/templates/AI context выполнен; существующий нормативный текст приведён к русскому без создания параллельных English-source-of-truth документов; технические identifiers/standards покрыты allowlist/glossary; Issue/PR/Release templates и AI instructions задают `language: ru`; `language-policy` + docs-drift green | BACKLOG |
| AIENG-001 | P1 | SEC-002 | Repository AI contract | root `AGENTS.md` + public-safe `.ai-context/` фиксируют source-of-truth precedence, privacy/cost rules, test commands, autonomous workflow, scope boundaries и Definition of Done; context-drift check green | BACKLOG |
| AIENG-002 | P1 | AIENG-001 | Roadmap-to-agent task protocol | команда продолжения всегда разрешается в конкретный READY ID; task packet содержит goal/non-goals/dependencies/data/privacy/acceptance/evidence; одна Issue = один active writer/branch | BACKLOG |
| AIENG-003 | P1 | AIENG-002 | Multi-AI review protocol | secondary AI получает immutable SHA/diff + public-safe context и работает read-only; findings имеют severity/evidence/recommendation/confidence; конфликт решается tests/spec/ADR, а не голосованием моделей | BACKLOG |
| AIENG-004 | P2 | AIENG-002,AIENG-003 | Reusable AI skills/playbooks | повторяемые roadmap execution, PR review, migration review, docs-drift и release flows вынесены из длинных prompts в versioned focused skills/playbooks | BACKLOG |
| AIENG-006 | P1 | AIENG-001,FINOPS-001 | Plus/model/cost routing policy | Sol/Terra/Luna workload policy versioned; Plus/cloud usage отделён от API billing; paid API не требуется для required checks; usage exhaustion даёт graceful pause/fallback, а не обход gates | BACKLOG |

### R0 exit gates

- `MASTER-G0 / Truth`: `TEST-001 + SEC-001 + FIN-001 + DATA-001 + DOC-001 = DONE`.
- `MASTER-G1 / Autonomous delivery`: `SEC-003 + CI-001 + CI-002 + CI-003 + AIENG-001 + AIENG-002 + AIENG-003 = DONE`.
- `MASTER-G2 / Recoverability`: `DR-001 + OBS-001 + FINOPS-001 = DONE`.

## 3. Wave R1 — Canonical Financial Platform

Цель: отделить domain truth от Google Sheets UI/формул, подготовить масштабирование и будущую миграцию backend.

| ID | Priority | depends_on | Deliverable | Machine DoD / evidence | Status |
|---|---|---|---|---|---|
| FIN-010 | P0 | FIN-001 | Versioned KPI Dictionary | формально определены Income, Expense, Cash Flow, Savings, Budget variance, transfers, refunds/reversals, partial periods, currency/rounding; contract tests version definitions | BACKLOG |
| DATA-010 | P0 | DATA-001,FIN-010 | Canonical transaction schema v1 | stable ID/provenance; immutable source identity; money/currency semantics; account/category/member/project/tags; schema validation + migration compatibility | BACKLOG |
| ARCH-010 | P1 | DATA-010 | Pure domain/application core | KPI/migration/validation logic не зависит от SpreadsheetApp/UI; unit/property tests выполняются локально | BACKLOG |
| ARCH-011 | P1 | ARCH-010 | Google Sheets repository adapter | read/write/query interfaces реализованы через adapter; domain tests переиспользуются; Apps Script integration contract green | BACKLOG |
| ANL-010 | P1 | FIN-010,DATA-010,ARCH-010 | Analytics extension contract v1 | versioned `AnalyticsQuery/AnalyticsResult` задают measures, dimensions, filters, timeRange/grain, comparison, sort и provenance; contract не зависит от UI/chart library; property tests доказывают canonical KPI parity на synthetic combinations | BACKLOG |
| TEST-010 | P1 | TEST-001,ARCH-010 | Layered test architecture | critical substring checks заменены parser/behavior contracts; domain property/invariant tests отделены от adapter/UI tests; test taxonomy и regression budgets проверяются CI | BACKLOG |
| AIENG-005 | P2 | AIENG-002,TEST-010 | AI regression/eval suite | versioned golden task set проверяет scope discipline, test selection, privacy, docs/Roadmap sync и review quality; instruction/model changes сравниваются с baseline без production financial data | BACKLOG |
| MIG-010 | P0 | ARCH-011,DR-001 | Deterministic full-history migration | dry-run diff; backup; idempotent batches; resume token; private source->canonical reconciliation green; no unexplained row loss/change | BACKLOG |
| OBS-010 | P1 | ARCH-010,OBS-001 | SLO/error-budget layer | SLI: availability, latency, correctness, freshness, migration errors; dashboards/alerts privacy-safe; error budget computable | BACKLOG |
| PERF-010 | P1 | ARCH-011 | Query projection/minimal ranges | service contracts читают только нужные columns/ranges; performance tests подтверждают отсутствие лишних full-sheet reads | BACKLOG |
| PERF-011 | P1 | PERF-010 | Revision-aware cache | cache key включает dataset revision + query parameters; invalidation deterministic; stale-read tests green | BACKLOG |
| PERF-012 | P1 | PERF-011 | Single-scan refresh pipeline | один canonical read snapshot обслуживает связанные dashboard calculations; instrumentation доказывает read-budget contract | BACKLOG |
| PERF-013 | P1 | PERF-012,ANL-010 | Incremental analytics aggregates | dimension-aware aggregate framework обновляется по revision/delta; initial month/category/account projections реализованы без hard-coded UI coupling; correctness parity с full recompute green | BACKLOG |
| PERF-014 | P1 | PERF-013 | Synthetic scale gates | CI benchmark на synthetic 20k/50k operations; latency/read/write budgets versioned; regression threshold блокирует merge | BACKLOG |
| DOC-010 | P1 | ARCH-011,OBS-010,PERF-014 | Architecture/data/KPI/operations docs | C4/context, schema, KPI Dictionary, data lineage, backup/restore, SLO, runbooks связаны с code owners/checks | BACKLOG |

### R1 exit gate — `MASTER-G3 / Canonical platform`

`FIN-010 + DATA-010 + ARCH-010 + ARCH-011 + ANL-010 + MIG-010 + PERF-014 + DOC-010 = DONE`, а private full-history reconciliation и synthetic performance gates возвращают PASS.

## 4. Wave R2 — Family Finance Center / Modern UX

Цель: единый быстрый PWA-интерфейс для ежедневного семейного использования. Навигация ограничивается небольшим числом верхнеуровневых зон; глубина аналитики раскрывается внутри страниц, а не через рост числа разрозненных экранов.

| ID | Priority | depends_on | Deliverable | Machine DoD / evidence | Status |
|---|---|---|---|---|---|
| DESIGN-020 | P1 | MASTER-G3 | Design system + responsive shell | tokens typography/color/spacing/elevation; dark/light; WCAG-oriented contrast/focus; mobile/tablet/desktop visual regression green | BACKLOG |
| VIZ-020 | P1 | DESIGN-020,ANL-010 | Versioned visualization foundation | renderer-neutral `ChartSpec/WidgetSpec` + chart registry + shared `FilterContext/DrillContext`; primary browser renderer selected behind adapter (ECharts 6.x baseline via ADR); specs contain configuration, not financial payload; synthetic visual/interaction tests green | BACKLOG |
| HOME-020 | P1 | DESIGN-020,FIN-010,VIZ-020 | Financial Home dashboard | cash-flow/budget/liquidity/alerts summary; drill-down links preserve filter context; no duplicated KPI calculations | BACKLOG |
| TX-020 | P1 | DESIGN-020,DATA-010 | Transaction Explorer | search/filter/sort/date/account/category/member; edit flow validates canonical schema; pagination/virtualization performance gate | BACKLOG |
| EXP-020 | P1 | VIZ-020,FIN-010 | Expense Analytics | trend, category mix, period compare, drivers, drill-down to transactions; totals invariant with canonical KPI | BACKLOG |
| INC-020 | P1 | VIZ-020,FIN-010 | Income Analytics | source/time trend, stability/variance and drill-down; canonical parity green | BACKLOG |
| CF-020 | P1 | HOME-020,FIN-010,VIZ-020 | Cash Flow dashboard | inflow/outflow/net dynamics; transfer-neutral semantics; period comparison uses comparable date windows | BACKLOG |
| BUD-020 | P1 | EXP-020,FIN-010,VIZ-020 | Budget Control dashboard | plan/fact/variance/run-rate; budget scope versioned; alerts link to explaining transactions | BACKLOG |
| OBL-020 | P1 | DESIGN-020,DATA-010 | Obligations & recurring dashboard | upcoming obligations, recurring flows, overdue/forecast states; deterministic recurrence tests green | BACKLOG |
| DQ-020 | P1 | DATA-010,OBS-010 | Data Quality Center | missing/duplicate/suspicious/provenance issues; repair preview; bulk mutation requires backup/idempotent rollback evidence | BACKLOG |
| UI-MIG-020 | P1 | HOME-020,TX-020,EXP-020,INC-020,CF-020,BUD-020,OBL-020,DQ-020 | Переключить canonical Web Dashboard на R2 UI | private canonical Web App по default route открывает R2 responsive shell + Financial Home; верхнеуровневая навигация ведёт в Transactions/Expenses/Income/Cash Flow/Budget/Obligations/Data Quality без дублирования FIN-TRUTH; runtime использует существующие canonical/analytics services и VIZ adapter; legacy Dashboard перестаёт быть default и остаётся только bounded rollback route до post-cutover verification; `MYSELF`, privacy, `FREE_ONLY` и write boundaries не ослабляются; authenticated exact-SHA Web App render smoke + responsive synthetic visual/interaction gates green | BACKLOG |
| PROF-020 | P2 | DESIGN-020 | Household/preferences center | family member/profile/preferences/accessibility settings separated from financial domain | BACKLOG |
| PWA-020 | P1 | HOME-020,TX-020 | Installable PWA baseline | install manifest, responsive offline shell/read cache policy, update strategy, private-cache safety tests | BACKLOG |

## 5. Wave R3 — Planning, Wealth, Decision Intelligence

| ID | Priority | depends_on | Deliverable | Machine DoD / evidence | Status |
|---|---|---|---|---|---|
| TREND-030 | P2 | MASTER-G3,EXP-020,INC-020 | Long-term Trends | rolling/YoY views use KPI Dictionary; partial-period comparison rules tested | BACKLOG |
| PROJ-030 | P2 | TREND-030 | Cash-flow Projection | scenario inputs separated from observed facts; backtest metrics; uncertainty band shown | BACKLOG |
| GOAL-030 | P2 | BUD-020 | Goals & Wish-list | goal amount/date/progress/priorities; scenario impact; no hidden mutation of transaction history | BACKLOG |
| BAL-030 | P2 | DATA-010,FIN-010,DR-001 | Снимки остатков и сверка | dated account-balance observations имеют account/currency/provenance и exact-money semantics; canonical calculated balance сравнивается с observation; mismatch создаёт объяснимый reconciliation state/proposal и никогда молча не переписывает transaction history; synthetic mismatch/idempotency tests green | BACKLOG |
| NW-030 | P2 | DATA-010,FIN-010,BAL-030 | Net Worth | assets/liabilities/account snapshots; valuation date/currency semantics explicit; observed vs calculated balance provenance доступен для drill/reconciliation | BACKLOG |
| SUB-030 | P2 | OBL-020 | Subscriptions & recurring spend | candidate detection + user-facing explanation; false-positive-safe workflow | BACKLOG |
| FX-030 | P2 | FIN-010 | Multi-currency layer | transaction currency/base currency/rate provenance; reproducible historical conversion; no paid rate API requirement | BACKLOG |
| RISK-030 | P2 | NW-030,PROJ-030 | Liquidity & financial risk | emergency runway/scenario indicators use documented KPI definitions and explainable inputs | BACKLOG |

## 6. Wave R4 — Yandex Cloud Shadow Platform and Cutover

Цель: перенести canonical backend без big-bang migration. Google остаётся adapter/bridge до доказанной parity. Любой cloud workload обязан удовлетворять `ZERO-COST` policy.

| ID | Priority | depends_on | Deliverable | Machine DoD / evidence | Status |
|---|---|---|---|---|---|
| YC-040 | P1 | MASTER-G3,FINOPS-001 | YDB Serverless PoC + cost envelope | canonical schema PoC; RU/storage/request telemetry; synthetic load stays внутри configured free-only budget; circuit breaker test green | BACKLOG |
| AUTH-040 | P1 | DESIGN-020 | Family authentication/authorization | least privilege; session protection; household isolation tests; no financial payload in auth logs | BACKLOG |
| YC-041 | P1 | YC-040,CI-001 | GitHub OIDC/WIF deployment | short-lived identity; no long-lived cloud key in GitHub; default-branch trusted deploy; least-privilege policy tests | BACKLOG |
| YC-042 | P1 | YC-040,MIG-010 | Shadow replication | Google canonical changes replicated idempotently; lag/correctness monitored; source stays authoritative until parity gate | BACKLOG |
| YC-043 | P1 | YC-042,AUTH-040 | Shadow-read/canary API | sampled reads compare providers privately; mismatch blocks promotion; latency/SLO telemetry green | BACKLOG |
| YC-044 | P1 | YC-043,DR-001 | Controlled canonical cutover | backup + rollback checkpoint; parity/SLO/free-only gates green; write ownership changes exactly once and is auditable | BACKLOG |
| YC-045 | P2 | YC-044 | Google backend retirement/bridge mode | legacy writes disabled; export/restore retained; remaining bridge responsibilities documented and tested | BACKLOG |

## 7. Wave R5 — Data Science

Все DS-функции строятся поверх canonical dataset и могут быть отключены без потери core budgeting. Обязательной платной ML-инфраструктуры нет.

| ID | Priority | depends_on | Deliverable | Machine DoD / evidence | Status |
|---|---|---|---|---|---|
| DS-050 | P2 | MASTER-G3 | Explainable auto-categorization | train/test split by time; confidence; explainable features; low-confidence route не меняет данные автоматически | BACKLOG |
| DS-051 | P2 | MASTER-G3 | Anomaly detection | synthetic anomaly suite + private offline evaluation; alerts explain contributing signals | BACKLOG |
| DS-052 | P2 | PROJ-030 | Forecast model v1 | rolling backtest; baseline comparison; error metrics versioned; fallback to deterministic baseline | BACKLOG |
| DS-053 | P2 | OBL-020 | Recurrence discovery | precision-oriented candidate detection; recurrence explanation and provenance | BACKLOG |
| DS-054 | P3 | BUD-020,DS-052 | Budget recommendation engine | constraints explicit; recommendation vs fact clearly separated; reproducible evaluation | BACKLOG |
| DS-055 | P2 | DS-050,DS-051,DS-052 | Model evaluation registry | dataset/model/schema versions; metrics; drift signals; deterministic reproduction metadata | BACKLOG |
| DS-056 | P2 | DS-055,OBS-010 | Model drift/quality monitoring | non-sensitive aggregate quality telemetry; thresholds disable degraded optional model safely | BACKLOG |

## 8. Wave R6 — Private AI Assistance and Optional Intelligence

| ID | Priority | depends_on | Deliverable | Machine DoD / evidence | Status |
|---|---|---|---|---|---|
| AI-060 | P3 | MASTER-G3 | Read-only finance assistant | tool allowlist; answers cite canonical KPI/query provenance; prompt-injection tests; zero write capability | BACKLOG |
| AI-061 | P3 | AI-060,DQ-020 | AI repair proposal workflow | model produces structured proposal/diff only; schema/invariant validation; financial write remains explicit end-user action with rollback | BACKLOG |
| AI-062 | P3 | AI-060 | Private semantic retrieval | private index boundary; no public artifact/prompt leakage; local/free implementation path available | BACKLOG |
| AI-063 | P3 | AI-060,SEC-002,FINOPS-001 | AI privacy/cost policy | provider allowlist, data minimization, budget=free-only by default, kill switch, audit events without financial payload | BACKLOG |
| OCR-060 | P3 | TX-020 | Receipt capture/OCR | local/free-first OCR; parsed result is proposal; canonical validation before any save | BACKLOG |

## 9. Wave R7 — Semantic Analytics & Exploration

Цель: превратить canonical finance core в универсальный аналитический движок. Пользователь должен комбинировать период, measure, dimension, filter и comparison без появления отдельной hard-coded функции под каждый новый отчёт. R7 не требует завершения Yandex cutover, Data Science или AI, если явная dependency ниже отсутствует.

| ID | Priority | depends_on | Deliverable | Machine DoD / evidence | Status |
|---|---|---|---|---|---|
| ANL-070 | P1 | MASTER-G3,ANL-010 | Semantic measure/dimension registry | versioned registry описывает KPI measures, dimensions, hierarchies, allowed aggregations, formatting и compatibility; invalid measure/dimension combinations отклоняются deterministically; synthetic contracts green | BACKLOG |
| SCOPE-070 | P1 | ANL-070,DATA-010 | Области аналитики и системные теги | stable protected system tags поддерживают `Exclude from Analysis`, emergency-fund и последующие policy scopes на account/transaction level; user tags остаются свободными; exclusion меняет только явно выбранный analytic scope и не переписывает canonical truth; scope serialization/privacy/property tests green | BACKLOG |
| ANL-071 | P1 | ANL-070 | Universal period/comparison engine | arbitrary date range; day/week/month/quarter/year grains; rolling 7/30/90/365; MTD/QTD/YTD; previous comparable period и YoY; partial-period rules versioned и property-tested | BACKLOG |
| ANL-072 | P2 | ANL-070,ANL-071 | Safe calculated/window metrics | share, absolute/percent delta, cumulative, moving average/median, Top-N + Other и comparable plan/fact доступны через allowlisted semantic operators; arbitrary executable formulas отсутствуют; canonical parity green | BACKLOG |
| BENCH-070 | P2 | ANL-071,ANL-072,SCOPE-070 | Персональные эталоны и механизм сравнений | одна comparison contract поддерживает previous/comparable period, personal rolling baseline, budget, target и user-defined/manual index; series нормализуются по периоду/currency/scope с provenance; внешние market-data providers только optional adapters и не требуются при `FREE_ONLY`; synthetic parity tests green | BACKLOG |
| ANL-073 | P2 | ANL-070,ANL-072 | Multi-dimensional Pivot/OLAP engine | rows/columns/measures, subtotal/total, hierarchy expand/collapse, sort/top-N и drill формируют один reproducible query contract; randomized synthetic parity tests green | BACKLOG |
| ANL-074 | P1 | ANL-070,SCOPE-070,VIZ-020 | Exploration state model | shared `FilterContext/DrillContext` поддерживает include/exclude, multi-select, named/system scopes, global/widget scope, reset/back и URL-safe state без финансового payload; deterministic state-transition tests green | BACKLOG |
| VIZ-070 | P2 | VIZ-020,ANL-074 | Visualization registry v2 | chart registry знает допустимые semantic encodings, responsive/a11y fallbacks и renderer capabilities; смена chart type не меняет query financial truth; ECharts adapter остаётся заменяемым | BACKLOG |
| PERF-070 | P1 | PERF-014,ANL-073 | Analytics query planner + cache | query fingerprint включает semantic/query/data revision; compatible aggregates переиспользуются; stale requests cancel/discard; versioned synthetic cold/warm interaction budgets green | BACKLOG |
| TEST-070 | P1 | ANL-071,ANL-072,ANL-073,ANL-074,SCOPE-070,BENCH-070,PERF-070 | Combinatorial analytics regression gate | seeded generator перебирает representative periods/dimensions/filters/scopes/comparisons/benchmarks; invariants, query determinism, cache parity и privacy checks обязательны для analytics PR | BACKLOG |

### R7 exit gate — `MASTER-G7 / Semantic analytics`

`ANL-070 + SCOPE-070 + ANL-071 + ANL-072 + BENCH-070 + ANL-073 + ANL-074 + PERF-070 + TEST-070 = DONE`; произвольные поддержанные комбинации аналитики воспроизводимы, canonical-correct и не требуют отдельного dashboard-specific calculation code.

## 10. Wave R8 — Analytics Studio & Dashboard Composer

Цель: дать пользователю профессиональную BI-глубину без ухудшения простого ежедневного UX. `Studio/Expert` является opt-in режимом; curated default dashboards сохраняются.

| ID | Priority | depends_on | Deliverable | Machine DoD / evidence | Status |
|---|---|---|---|---|---|
| STUDIO-080 | P2 | MASTER-G7,DESIGN-020 | Progressive Analytics Studio shell | `Daily -> Explore -> Studio` раскрывается без дублирования domain logic; mode preference обратима; mobile/tablet/desktop + keyboard/a11y smoke green | BACKLOG |
| PRIV-080 | P2 | MASTER-G7,DESIGN-020,SEC-002,PROF-020 | Режимы приватности / ограниченный / демо / дзен | presentation/query visibility policy поддерживает full, percentage/restricted и hidden-value views; sensitive values редактируются до response/render boundary, а не только CSS; Demo использует synthetic adapter без private dataset; Zen скрывает secondary UI без изменения данных; cache/screenshot/visual privacy tests green | BACKLOG |
| DASH-080 | P2 | STUDIO-080,VIZ-070 | Responsive grid dashboard composer | add/move/resize/duplicate/remove widgets; responsive layouts versioned; invalid overlap/layout repaired deterministically; visual regression green | BACKLOG |
| DASH-081 | P2 | DASH-080,ANL-073 | Widget factory + semantic bindings | widget связывает `AnalyticsQuery` и `ChartSpec`; KPI/card/chart/table/pivot widgets используют единый registry; broken bindings дают объяснимую validation error | BACKLOG |
| DASH-082 | P2 | DASH-081,ANL-074 | Global filters, cross-filter and brush | click/selection/brush одного widget изменяет только разрешённый shared filter context; циклы событий предотвращены; reset/back state reproducible; interaction tests green | BACKLOG |
| DASH-083 | P2 | DASH-081,TX-020,ANL-074 | Drill-down and drill-through | hierarchy drill `year -> quarter -> month -> day` и semantic category/account hierarchies сохраняют context; drill-through достигает canonical transactions с totals reconciliation | BACKLOG |
| DASH-084 | P2 | DASH-081 | Saved views, presets and dashboard versions | create/clone/rename/reset/version/migrate view; curated presets для Family/Expense/Income/Cash Flow/Budget/Net Worth/Risk/Subscriptions; specs не содержат financial dataset snapshots | BACKLOG |
| DASH-085 | P2 | DASH-081,DESIGN-020 | Wide visual customization | theme/light/dark, palette, chart type, axes, labels, legend, stack, sort, Top-N, number format и density используют design tokens/semantic constraints; accessibility fallback green | BACKLOG |
| DASH-086 | P2 | DASH-084,DASH-085,SEC-002 | Safe dashboard spec import/export | versioned JSON schema + migration; export содержит layout/query/config IDs, но не transaction rows/financial values; hostile/invalid spec rejected; privacy scan green | BACKLOG |

### R8 exit gate — `MASTER-G8 / Analytics Studio`

`STUDIO-080 + PRIV-080 + DASH-080 + DASH-081 + DASH-082 + DASH-083 + DASH-084 + DASH-085 + DASH-086 = DONE`; пользователь может собрать, сохранить и восстановить собственный responsive dashboard, не изменяя canonical financial semantics, а приватное/демонстрационное представление не раскрывает реальные финансовые значения.

## 11. Wave R9 — Advanced Financial Analytics & Visual Intelligence

Цель: дать PrihRashOnline уровень визуального и аналитического исследования, заметно превосходящий типичное приложение домашнего бюджета. Каждая сложная визуализация обязана иметь содержательный финансовый use case, deterministic data contract и доступный табличный fallback.

| ID | Priority | depends_on | Deliverable | Machine DoD / evidence | Status |
|---|---|---|---|---|---|
| VIZ-090 | P2 | MASTER-G8,VIZ-070 | Advanced visualization pack | line/area, grouped/stacked/100% bar, waterfall, Sankey, treemap/sunburst, calendar/matrix heatmap, Pareto, scatter/bubble, histogram/box/violin, small multiples и bullet/KPI templates имеют semantic compatibility rules + synthetic golden tests | BACKLOG |
| ANL-090 | P2 | MASTER-G7,VIZ-090 | Contribution and change decomposition | period delta раскладывается по категориям/счетам/участникам/проектам/tags; contributions reconcile до canonical total; waterfall/driver views drill-through to evidence | BACKLOG |
| ANL-091 | P2 | MASTER-G7,VIZ-090 | Seasonality, distribution and concentration | calendar/weekday/month seasonality, percentiles/distribution, Pareto/ABC и concentration metrics versioned; edge cases и sparse periods tested | BACKLOG |
| XRAY-090 | P2 | ANL-090,ANL-091,RISK-030,BAL-030,SCOPE-070 | Финансовый рентген семьи | versioned deterministic rule registry выдаёт typed findings с severity/score, threshold/version, explanation и evidence query; baseline покрывает emergency-fund coverage/runway, savings stability, income dependence, mandatory-spend/budget pressure, recurring commitments, cash-flow deficits и concentration/trend risks; missing-data state explicit; каждый finding drill-through; LLM не требуется; synthetic rule/golden tests green | BACKLOG |
| ANL-092 | P3 | ANL-073,VIZ-090 | Relationship/correlation explorer | scatter/correlation matrix поддерживает выбранные numeric measures; sample size/missing-data semantics explicit; UI не формулирует correlation как causation | BACKLOG |
| DS-090 | P3 | DS-051,DS-052,VIZ-090 | Forecast/anomaly visual overlays | forecast bands/anomaly markers получают model/version/confidence provenance; отключение DS не ломает base chart; degraded model скрывается согласно quality policy | BACKLOG |
| DASH-090 | P2 | ANL-090,ANL-091,XRAY-090,DASH-084 | Expert dashboard gallery | curated advanced presets демонстрируют cash-flow decomposition, spending drivers, seasonality, concentration, long-term trends, wealth/risk и Financial Health X-Ray; каждый preset редактируем/клонируем | BACKLOG |
| PERF-090 | P1 | PERF-070,MASTER-G8,VIZ-090 | Studio-scale rendering/performance gate | lazy widget execution, virtualization/downsampling там где семантически безопасно, cancellation и render budgets проверяются на synthetic 20k/50k scale; hidden widgets не создают лишнюю query load | BACKLOG |

### R9 exit gate — `MASTER-G9 / Advanced analytics`

`VIZ-090 + ANL-090 + ANL-091 + XRAY-090 + DASH-090 + PERF-090 = DONE`. `ANL-092` и `DS-090` расширяют глубину, но не блокируют core advanced analytics и могут быть отключены без деградации базовой финансовой истины.

## 12. Wave R10 — Intelligent Analytics, Explanation & Storytelling

Цель: поверх детерминированной аналитики добавить объяснение и исследование естественным языком. ИИ никогда не является калькулятором финансовой истины: он получает уже вычисленные facts/query provenance и формирует объяснение либо валидируемое предложение.

| ID | Priority | depends_on | Deliverable | Machine DoD / evidence | Status |
|---|---|---|---|---|---|
| INSIGHT-100 | P2 | MASTER-G9,XRAY-090,ANL-090,ANL-091 | Deterministic insight facts engine | X-Ray findings, top changes, contribution shifts, trend breaks, concentration/seasonality signals и DS signals при наличии формируются как typed facts с threshold/version/provenance; без LLM доступны те же numeric facts | BACKLOG |
| AI-100 | P3 | INSIGHT-100,AI-060,AI-063 | `Explain this` for current analytic context | AI получает только allowlisted computed facts + query metadata; ответ ссылается на period/filters/provenance; golden tests ловят fabricated totals/unsupported causal claims; provider optional under `FREE_ONLY` | BACKLOG |
| AI-101 | P3 | MASTER-G7,AI-060,AI-063 | Natural-language to AnalyticsQuery proposal | natural-language request преобразуется только в schema-validated read-only query proposal; preview показывает interpreted filters/measures/period; arbitrary code/financial writes невозможны | BACKLOG |
| AI-102 | P3 | MASTER-G8,AI-060,AI-063 | Dashboard Copilot proposal | AI предлагает diff к `DashboardSpec/ChartSpec`, а не мутирует finance data; schema/privacy/compatibility validation обязательна до apply; deterministic rollback to prior spec | BACKLOG |
| STORY-100 | P3 | MASTER-G8,INSIGHT-100 | Analytical story/bookmarks | пользователь сохраняет последовательность reproducible views/filter contexts с annotations; story references queries/specs вместо копирования private dataset в public artifacts | BACKLOG |
| INSIGHT-101 | P3 | INSIGHT-100,DASH-090 | Prioritized insight feed | ranking объединяет deterministic materiality/novelty signals; dismiss/snooze/preferences локальны; каждое insight ведёт к explaining dashboard/drill path; public telemetry financial-payload-free | BACKLOG |

### R10 exit gate — `MASTER-G10 / Intelligent analytics`

`INSIGHT-100 = DONE` является deterministic foundation. AI/Story items остаются optional intelligence: отсутствие бесплатного/разрешённого AI provider не блокирует budgeting, R7–R9 или доступ к вычисленным аналитическим facts.

## 13. Required checks and gate ownership

| Check | Blocks | Required evidence |
|---|---|---|
| `privacy-public-data` | every PR | public diff/artifacts contain only allowed synthetic data |
| `secret-scan` | every PR | GitHub/native secret scanning + repo policy checks |
| `supply-chain` | dependency/workflow changes | immutable pins, lockfile, dependency policy |
| `domain-unit` | domain changes | unit + property/invariant tests |
| `financial-reconcile-synthetic` | financial changes | full synthetic invariant suite |
| `migration-reconcile-synthetic` | migration changes | provenance/idempotency/mismatch suite |
| `apps-script-parse` | Apps Script changes | all server/client JS parser contracts green |
| `ui-visual` | UI changes | Playwright responsive/a11y smoke + snapshots on synthetic data |
| `performance-contract` | query/dashboard changes | synthetic scale latency/read/write budgets green |
| `analytics-semantics` | analytics/query changes | seeded measure/dimension/filter/period combinations preserve KPI semantics and query determinism |
| `dashboard-spec` | ChartSpec/WidgetSpec/DashboardSpec changes | schema/version migration, semantic compatibility and financial-payload-free serialization green |
| `analytics-interaction` | cross-filter/drill/Studio changes | deterministic filter/drill state, canonical drill-through totals, responsive visual interaction tests green |
| `balance-reconciliation` | balance snapshot/reconciliation changes | observed vs canonical calculated balance semantics, provenance, mismatch/no-silent-write invariants green on synthetic data |
| `visibility-redaction` | privacy/restricted/demo changes | restricted/hidden responses contain no forbidden monetary payload; Demo resolves only synthetic adapter; cache/screenshot leakage tests green |
| `xray-rules` | Financial Health X-Ray changes | versioned rule thresholds, missing-data behavior, explanation/evidence links and deterministic golden findings green |
| `ai-analytics-grounding` | R10 AI explanation/query changes | model consumes allowlisted computed facts/provenance; fabricated totals, unsupported write paths and unsafe query proposals fail golden/security tests |
| `language-policy` | human-facing docs/meta changes | normative documentation, Issue/PR/Release/AI context text is Russian; machine-facing identifiers/standard names follow explicit allowlist |
| `trusted-runtime-health` | release candidate | authenticated deployed exact-SHA health from trusted workflow |
| `private-reconciliation` | migration/cutover/financial release | PASS only; no real-derived values leave private environment |
| `backup-restore` | migration/cutover | backup verified and restore drill/checkpoint green |
| `free-only` | cloud/AI changes | projected + observed usage below configured safety envelope; circuit breaker green |

## 14. Issue template contract

Каждый автоматически материализованный Roadmap Issue обязан иметь поля:

```yaml
roadmap_id: <ID>
wave: <R0..R10>
priority: <P0..P3>
status: BACKLOG
language: ru
depends_on: [<ID>]
goal: <one measurable outcome>
non_goals: [<explicit exclusions>]
data_touched: <synthetic|private-runtime|none>
privacy_class: <public-safe|private>
cost_class: FREE_ONLY
acceptance:
  - <machine-verifiable condition>
evidence:
  - <check/artifact name>
rollback: <required for mutation/migration/deploy>
observability: <SLI/log/metric or n/a>
```

Issue automation должна отклонять work item без dependencies/acceptance/evidence и запрещать копирование приватных reconciliation details в issue/PR body.

## 15. GitHub automation target

Целевой набор бесплатных GitHub-возможностей:

- GitHub Issues как work queue;
- labels/milestones для wave/priority/status;
- GitHub Actions на public standard runners;
- required checks + branch rules/rulesets;
- squash merge и auto-merge после green gates;
- GitHub-native secret scanning для public repo и CodeQL там, где язык/сборка поддерживаются;
- Dependabot/dependency review для supply-chain hygiene;
- OIDC/WIF для short-lived cloud credentials;
- Actions artifacts только для synthetic/non-sensitive evidence;
- scheduled workflow для docs drift, dependency freshness, backup/restore evidence age и Roadmap status sync.
- Codex cloud/GitHub Code Review в пределах ChatGPT Plus usage — как интеллектуальный review/implementation layer поверх deterministic CI;
- `AGENTS.md` + versioned AI context — как единый repository contract для ChatGPT/Codex и тонких adapters других ИИ, включая обязательный `LANG-RU` для human-facing output;
- Issue/PR/Release templates по умолчанию формируют русскоязычную human-readable часть; `language-policy` блокирует нормативную документацию/метаданные, нарушающие `LANG-RU`, при этом machine-facing identifiers не переводятся;
- skills/playbooks для повторяемых roadmap/review/release/migration процессов;
- отдельные cloud tasks/worktrees только для независимых Roadmap items; одна Issue не имеет двух одновременных writers.

Не использовать как постоянные gates: ручной SHA-marker, лимит числа commits в PR, snapshot-equality release branch, manual runtime approval, direct post-merge commits в `main`, self-hosted runner как обязательную инфраструктуру, отдельно оплачиваемый AI API/API-key GitHub Action при `FREE_ONLY`.

## 16. Definition of Done проекта по стадиям

### Safe autonomous development

`MASTER-G0 + MASTER-G1 + MASTER-G2 = PASS`.

После этого агент может штатно выполнять обычные инженерные work items end-to-end без ручного approve, пока machine policies green.

### Canonical product foundation

`MASTER-G3 = PASS`.

После этого product/BI dashboards строятся только на canonical API/KPI Dictionary.

### Analytics-ready UI foundation

`MASTER-G3 = PASS` и `VIZ-020 = DONE`.

После этого curated R2 dashboards и будущий Studio используют общий semantic/query/visualization contract вместо dashboard-specific financial calculations.

### Canonical R2 Daily UI

`UI-MIG-020 = DONE`.

После этого private canonical Web App по default route использует новый R2 responsive shell и Financial Home, а curated R2 surfaces доступны из основной навигации; legacy Dashboard не является default и сохраняется только как ограниченный rollback path до подтверждённого post-cutover verification.

### Analytics Studio

`MASTER-G7 + MASTER-G8 = PASS`.

После этого arbitrary-period/dimension exploration, scopes/system tags, personal benchmarks, Pivot/OLAP, cross-filter/drill, Privacy/Demo/Zen и пользовательские dashboard specs считаются production-ready расширением, но остаются opt-in относительно `Daily` UX.

### Advanced analytics

`MASTER-G9 = PASS`.

После этого advanced visualization/decomposition/seasonality/concentration, `Family Financial Health X-Ray` и expert presets входят в поддерживаемый аналитический слой. DS overlays остаются optional.

### Cloud cutover

`YC-044 = DONE` только при одновременно green: correctness parity, restore/rollback, SLO, authentication и `FREE_ONLY`.

## 17. Приоритет исполнения

Порядок dependency-driven запуска:

1. R0 tasks без зависимостей запускаются параллельно.
2. Dependency engine переводит downstream задачи в `READY` автоматически.
3. До `MASTER-G0` блокируются новые финансовые KPI/features.
4. До `MASTER-G1` не считается завершённой автономизация delivery.
5. До `MASTER-G2` блокируются full-history mutation и cloud cutover.
6. До `MASTER-G3` блокируется перенос canonical write ownership в Yandex Cloud.
7. `ANL-010` входит в `MASTER-G3`, а `VIZ-020` выполняется до dashboard work items R2: это небольшая обязательная цена за отсутствие крупного BI-рефакторинга позже.
8. R2/R3 допускают параллельную UX-разработку после соответствующих gates; R5/R6 никогда не блокируют core budgeting.
9. R7 может стартовать после `MASTER-G3 + VIZ-020`, не ожидая Yandex cutover, Data Science или AI; это основной post-core product track.
10. `SCOPE-070` и `BENCH-070` входят в `MASTER-G7`: гибкие scopes/system tags и personal benchmarks являются частью semantic analytics, а не dashboard-specific hacks.
11. R8 начинается после `MASTER-G7`; `PRIV-080` входит в `MASTER-G8`, чтобы Privacy/Restricted/Demo/Zen были системным свойством, а не косметическим CSS-режимом.
12. R9 считается production-ready по `MASTER-G9`, включая deterministic `XRAY-090`; `DS-090` не входит в обязательный gate и gracefully отсутствует без DS models.
13. R10 использует только deterministic facts/provenance; AI items зависят от `AI-060/AI-063`, остаются optional и не обходят `FREE_ONLY`.
14. R4 cloud migration может идти параллельно analytics track после своих gates; смена backend не должна менять `AnalyticsQuery/Result` и dashboard specs.
15. Ghostfolio остаётся benchmark, а не dependency: изменения upstream не меняют Roadmap автоматически и принимаются только через отдельный audit/ADR/work item.
16. `LANG-RU` действует немедленно для всей новой human-facing разработки; `DOC-002` нормализует исторические нормативные материалы отдельным non-critical-path item; английские machine identifiers не считаются нарушением политики.
17. `UI-MIG-020` — P1 R2 switch-over item: после готовности declared dependencies он должен перевести canonical private Web App на уже реализованные R2 surfaces до возврата resolver к готовым P2 product/Studio work; наличие текущего active writer не обходится — AIENG-002 сначала завершает его штатный lifecycle.

Эта Roadmap намеренно не содержит фактических финансовых значений или агрегатов исходной книги. Их evidence хранится только в приватном Master Audit/закрытом runtime и используется как PASS/FAIL gate.

## 18. Change record — v2.2

- Зафиксировано согласованное владельцем продуктовое направление `Analytics-first Finance OS`: **simple by default, deep by choice**.
- В R1 добавлен `ANL-010`, а `PERF-013` сделан dimension-aware, чтобы будущая аналитика не зависела от набора hard-coded dashboard queries.
- В R2 добавлен `VIZ-020`: versioned `ChartSpec/WidgetSpec`, renderer adapter, общий filter/drill context; ECharts 6.x указан как baseline за adapter boundary, а не как domain dependency.
- Добавлены исполняемые R7–R10: Semantic Analytics, Analytics Studio, Advanced Analytics, Intelligent Analytics/Storytelling.
- Добавлены `MASTER-G7..G10` и analytics-specific machine checks.
- Политики `ZERO-COST`, `DATA-PUBLIC`, `FIN-TRUTH`, автономный GitHub delivery и приватность финансовых данных сохранены без ослабления.

## 19. Журнал изменений — v2.3

- Зафиксирован `Ghostfolio` как внешний product/architecture benchmark, но не runtime/source-code dependency; добавлена clean-room/license boundary policy `REF-CLEANROOM`.
- Добавлена обязательная `LANG-RU`: русский — единственный нормативный язык human-facing документации и разработки; `DOC-002` нормализует уже существующие нормативные материалы без изменения R0 exit gates; Issue template получил `language: ru`, required checks — `language-policy`.
- Добавлен `BAL-030 / Balance Snapshots & Reconciliation`; Net Worth теперь использует provenance наблюдаемого и canonical calculated balance без silent history mutation.
- Добавлены `SCOPE-070 / Analytics Scopes + System Tags` и `BENCH-070 / Personal Benchmark & Comparison Engine`; оба включены в semantic analytics gate `MASTER-G7` через обновлённый `TEST-070`.
- Добавлен `PRIV-080 / Privacy / Restricted / Demo / Zen modes` и включён в `MASTER-G8`; Demo обязан работать только на synthetic adapter, redaction выполняется до render boundary.
- Добавлен `XRAY-090 / Family Financial Health X-Ray` как deterministic rule-based слой и обязательная часть `MASTER-G9`; R10 AI объясняет его typed findings, но не вычисляет финансовую истину.
- Добавлены machine checks `balance-reconciliation`, `visibility-redaction`, `xray-rules`, `language-policy`.
- Число executable work items увеличено с **100 до 106**: пять Ghostfolio-inspired product items + один language-governance item `DOC-002`; R0 critical path, `FREE_ONLY`, `DATA-PUBLIC`, `FIN-TRUTH`, recovery/privacy и autonomous-delivery policies не ослаблены.
- Исправлена фактическая последовательность AI Engineering: `AIENG-003` зависит от `AIENG-002`, чтобы Autopilot не запускал второй writer до завершения executable Roadmap-to-agent protocol; live lifecycle всегда берётся из GitHub Issues.

## 20. Дополнение Roadmap — 2026-08-10

- Добавлен `UI-MIG-020 / Canonical Web Dashboard -> R2 UI` с приоритетом **P1**. Он закрывает ранее явно оставленный разрыв между готовыми `DESIGN-020`/`VIZ-020`/curated R2 surfaces и фактическим default route текущего private Web App.
- `UI-MIG-020` не создаёт новую financial semantics, storage/write authority или provider dependency: задача только переключает canonical navigation/render path на уже реализованные R2 contracts и сохраняет legacy Dashboard как ограниченный rollback route до post-cutover verification.
- Для завершения обязательны authenticated exact-SHA Web App render smoke, responsive synthetic visual/interaction evidence и сохранение `MYSELF`, privacy, `FREE_ONLY` и действующих fail-closed write boundaries.
- Текущее число executable work items Roadmap после дополнения: **107**.
