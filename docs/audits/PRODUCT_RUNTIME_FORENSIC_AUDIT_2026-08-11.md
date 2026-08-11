# Product/Runtime Forensic Audit — 2026-08-11

Статус: публично-безопасное нормативное основание Product Recovery rebaseline.
Roadmap item: `GOV-REC-001`.
Audited snapshot: `main@82c3b4af5c4f06a0a8884a3c4d9fd9a1850aa623`.
Private screenshot, Web App locator, реальные суммы, labels/IDs и authenticated payload в repository не включены.

### Evidence convention

- `PROVEN` — непосредственно следует из exact-SHA repository code, live GitHub lifecycle или повторно выполненного deterministic gate.
- `INFERRED` — инженерный вывод из доказанного execution path; численное подтверждение требует live measurement.
- `REQUIRES_LIVE_MEASUREMENT` — недоступно без owner-authenticated Web App/session/private telemetry; значение не подменяется Node/synthetic числом.

Все ссылки на исходный код ниже закреплены на audited SHA. Поэтому последующий governance patch не переписывает исходное доказательство.

## A. Executive verdict

Проект накопил сильную canonical financial/security/semantic architecture, но formal GitHub completion опередил runtime integration и пользовательский продукт. Это governance/integration incident, а не доказанный инцидент повреждения финансовых данных.

- Audited legacy formal completion: 75/107 = 70,1%.
- Post-rebaseline issue-count completion: 75/116 = 64,7%; это изменение знаменателя, а не потеря реализованного кода.
- Engineering/Architecture Completion: около 70%.
- Runtime Integration: около 12%.
- Functional Product Readiness: около 18%.
- UX Readiness: около 25%.
- Weighted Overall Product Readiness: около 25%.

## B. P0/P1 findings

### P0

| ID | Finding | Exact evidence | Status |
|---|---|---|---|
| P0-01 | Canonical navigation обещает семь неработающих Daily surfaces | [`CanonicalR2WebAppService.js`](https://github.com/kmephis-ai/PrihRashOnline-v2/blob/82c3b4af5c4f06a0a8884a3c4d9fd9a1850aa623/CanonicalR2WebAppService.js) содержит один private-bound `home` и семь `SAFE_UNBOUND_SURFACES`; [`canonical_r2_web_app_contract_test.js`](https://github.com/kmephis-ai/PrihRashOnline-v2/blob/82c3b4af5c4f06a0a8884a3c4d9fd9a1850aa623/tests/canonical_r2_web_app_contract_test.js) требует `liveBoundRoutes: ['home']` и `RUNTIME_BINDING_NOT_PROVEN` для остальных. | PROVEN |
| P0-02 | User-facing Issue мог стать `DONE` без реального user E2E | Historical [`main-verification.yml`](https://github.com/kmephis-ai/PrihRashOnline-v2/blob/82c3b4af5c4f06a0a8884a3c4d9fd9a1850aa623/.github/workflows/main-verification.yml) проверял trusted statuses/merge/Issue `IN_PROGRESS`, затем сам менял его на `DONE`; work class, binding, browser journey и acceptance evidence отсутствовали. UI-MIG-020 [Issue #172](https://github.com/kmephis-ai/PrihRashOnline-v2/issues/172) закрыт при явно safe-unbound scope. | PROVEN |
| P0-03 | Engineering gates получили production semantics | Audited [`docs/ROADMAP.md`](https://github.com/kmephis-ai/PrihRashOnline-v2/blob/82c3b4af5c4f06a0a8884a3c4d9fd9a1850aa623/docs/ROADMAP.md) называл R7/R8 exits production-ready, тогда как Studio HTML объявляет `financial-runtime-fetch=false`, а composer — `UNBOUND`. | PROVEN |
| P0-04 | Fail-closed safety превратилась в false affordance | Primary nav строилась для всех восьми destinations, хотя router заранее знает, что семь не имеют runtime binding. Это безопасно для данных, но вводит household user в заблуждение. | PROVEN |

### P1

| ID | Finding | Exact evidence | Status |
|---|---|---|---|
| P1-01 | Home каждый раз делает full-history `readAll()` | [`R2FinancialRuntimeService.js`](https://github.com/kmephis-ai/PrihRashOnline-v2/blob/82c3b4af5c4f06a0a8884a3c4d9fd9a1850aa623/R2FinancialRuntimeService.js) вызывает repository `readAll()` внутри Home build path; bounded query projection не передаётся. | PROVEN |
| P1-02 | Canonical read остаётся дорогим remote Sheets path | [`GoogleTransactionRepositoryGateway.js`](https://github.com/kmephis-ai/PrihRashOnline-v2/blob/82c3b4af5c4f06a0a8884a3c4d9fd9a1850aa623/GoogleTransactionRepositoryGateway.js) делает settings read, header read и четыре operation-span reads: шесть data-returning calls для непустой книги; объём `2S + 20 + 15N` cells. | PROVEN |
| P1-03 | PERF-011/012/013/070 не участвуют в Home | [`build-apps-script-runtime-bundle.js`](https://github.com/kmephis-ai/PrihRashOnline-v2/blob/82c3b4af5c4f06a0a8884a3c4d9fd9a1850aa623/tools/build-apps-script-runtime-bundle.js) включает FIN/KPI/Home/Google adapter, но не revision cache, single-scan, incremental aggregate или analytics planner modules. | PROVEN |
| P1-04 | Нормализация и aggregation повторяются | Google adapter, FIN/KPI и Home visual builder повторно canonical-normalize/filter/aggregate selected period; dimension hash вычисляется на строку без memoization unique labels. | PROVEN |
| P1-05 | VIZ contract не равен browser renderer | Runtime отдаёт одну `cash_flow_minor` точку; [`FinancialHomeWebApp.html`](https://github.com/kmephis-ai/PrihRashOnline-v2/blob/82c3b4af5c4f06a0a8884a3c4d9fd9a1850aa623/FinancialHomeWebApp.html) рисует CSS `.bar` и `.mix-track`, ECharts не вызывается. | PROVEN |
| P1-06 | Budget/Liquidity authority отсутствует | Home runtime передаёт currency/period, но не approved budget/balance source; view model закономерно выдаёт `NOT_CONFIGURED`/`UNAVAILABLE_PENDING_BALANCE_SOURCE`. Наличие private source не утверждается. | PROVEN; private source unknown |
| P1-07 | Studio/Composer — shell, не analytics product | [`AnalyticsStudioWebApp.html`](https://github.com/kmephis-ai/PrihRashOnline-v2/blob/82c3b4af5c4f06a0a8884a3c4d9fd9a1850aa623/AnalyticsStudioWebApp.html) фиксирует `financial-runtime-fetch=false`; [`DashboardComposerWebApp.html`](https://github.com/kmephis-ai/PrihRashOnline-v2/blob/82c3b4af5c4f06a0a8884a3c4d9fd9a1850aa623/DashboardComposerWebApp.html) — `UNBOUND`/`SESSION_ONLY`. | PROVEN |
| P1-08 | Trusted Runtime Health не является Web App E2E | [`RuntimeHealth.js`](https://github.com/kmephis-ai/PrihRashOnline-v2/blob/82c3b4af5c4f06a0a8884a3c4d9fd9a1850aa623/RuntimeHealth.js) и workflow вызывают authenticated Execution API/Home builder token, но не открывают deployed Web App в browser и не проходят route/filter/drill journey. | PROVEN |

## C. Formal progress vs Product Readiness

| Layer | Evidence meaning | Score |
|---|---|---:|
| Engineering/Architecture | Audited 75/107 code/contracts foundation; после добавления recovery denominator формальный issue-count = 64,7% | 70% |
| Runtime Integration | Canonical private bindings | 12% |
| Functional Product | Household journey completion | 18% |
| UX | Truthful navigation, useful visuals, states, responsiveness | 25% |
| Overall | 15% architecture + 30% integration + 35% function + 20% UX | ≈25% |

Architecture completeness, integration completeness, functionality и Product Ready не взаимозаменяемы.

Методика: Engineering score основан на audited 75/107 formal items с проверкой actual code/contracts; Integration — на advertised canonical surfaces и private bindings; Function — на weighted critical household journey; UX — на truthful IA, states, useful visualization, responsiveness и interaction completion. Overall = `0,15 × Engineering + 0,30 × Integration + 0,35 × Function + 0,20 × UX = 25,4%`, округлено до ≈25%. Post-rebaseline 64,7% — только новый issue-count denominator и не входит в эту формулу.

### Wave maturity на audited snapshot

| Wave | Formal state | IMPLEMENTED | INTEGRATED | REAL E2E | PRODUCT READY |
|---|---|---|---|---|---|
| R0 | 19/19 DONE | Strong governance/security/delivery foundation | Technical delivery chain integrated | Exact-SHA technical chain | N/A для household UX |
| R1 | 15/15 DONE | FIN/DATA/ARCH/PERF contracts | FIN/DATA adapter используется Home; optimization layers — нет | Home builder smoke, не browser | Нет |
| R2 | 13/13 DONE | Contracts/HTML почти везде | Home 1/8 private-bound | Полного route flow нет | Нет |
| R3 | 6/8 DONE | Pure planning/wealth modules | Canonical UI/runtime binding не доказан | Нет | Нет |
| R4 | 2/7 DONE, 2 BLOCKED | PoC/auth contracts | Shadow/cutover отсутствует | Нет | Нет |
| R5/R6 | 0/12 | Backlog | Нет | Нет | Нет |
| R7 | 10/10 DONE | Strong semantic/query engine | Не входит в deployed financial UI | Synthetic/property only | Нет |
| R8 | 9/9 DONE | Shell/composer/config contracts | Private analytics binding отсутствует | file-local/synthetic | Нет |
| R9 | VIZ-090 DONE, ANL-090 active | Planner + partial candidate | Renderer/private consumer отсутствует | Synthetic golden only | Нет |

### Canonical household journey

| Surface | Implementation | Canonical route | Private canonical data | Real filter/drill flow | Verdict |
|---|---|---|---|---|---|
| Home | Partial runtime + view | Да | Да, read-only full history → auto latest month | Cards partial; charts/drill incomplete | PARTIAL |
| Transactions | Engine + synthetic HTML | Fail-closed route | Нет | Synthetic only | NOT FUNCTIONAL |
| Expenses | Pure model + synthetic HTML | Fail-closed route | Нет | Synthetic event only | NOT FUNCTIONAL |
| Income | Pure model + synthetic HTML | Fail-closed route | Нет | Synthetic event only | NOT FUNCTIONAL |
| Cash Flow | Pure model + synthetic HTML | Fail-closed route | Нет | Synthetic event only | NOT FUNCTIONAL |
| Budget | Plan/view model + synthetic HTML | Fail-closed route | Нет | Нет approved private plan binding | NOT FUNCTIONAL |
| Obligations | Recurrence/view model + synthetic HTML | Fail-closed route | Нет | Нет private obligations binding | NOT FUNCTIONAL |
| Data Quality | Detectors + synthetic preview | Fail-closed route | Нет | Нет private scan/repair review | NOT FUNCTIONAL |
| Explore/Studio | Capability shell | Да | `financial-runtime-fetch=false` | Mode switch only | SHELL ONLY |
| Composer | Layout/config prototype | Да | `UNBOUND` | `SESSION_ONLY` | PROTOTYPE ONLY |

## D. False-DONE / incomplete-integration matrix

| Roadmap ID/group | GitHub status | Фактический статус | Evidence/problem | Action |
|---|---|---|---|---|
| R0 + FIN-010/DATA-010/ARCH-010/011 | DONE | IMPLEMENTED / FOUNDATION_READY | Canonical schemas, FIN invariants, adapters, delivery/recovery gates реально используются; это foundation, не UX claim | KEEP DONE |
| OBS-010 | DONE | DONE_IMPLEMENTATION_ONLY | SLO contract существует, но runtime workflow не блокировал по sample distribution/threshold | NEEDS_RECOVERY_ITEM → PERF/E2E |
| PERF-010 | DONE | PARTIALLY_INTEGRATED | Bounded 15/20 columns, но все operation rows читаются | DONE_IMPLEMENTATION_ONLY |
| PERF-011/012/013/070 | DONE | BLOCKED_INTEGRATION | Modules/tests есть, canonical bundle/path их не содержит | BLOCKED_INTEGRATION → PERF-REC-001 |
| PERF-014 | DONE | SYNTHETIC_GATE_ONLY | 20k/50k Node benchmark сам фиксирует `wallClockIsUserSla=false` | KEEP DONE; zero product credit |
| HOME-020 | DONE | PARTIAL_PRODUCT | Единственная private-bound Daily surface; no snapshot/SLO/meaningful trend/full drill | NEEDS_RECOVERY_ITEM → UI/PERF/VIZ |
| TX/EXP/INC/CF-020 | DONE | CODE_COMPLETE / NOT_INTEGRATED | Models/synthetic HTML есть, canonical router возвращает unavailable | DONE_IMPLEMENTATION_ONLY → DATA/FIN |
| BUD/OBL-020 | DONE | CODE_COMPLETE / AUTHORITY_BLOCKED | Private source/schema/ownership не подключены | BLOCKED_INTEGRATION → PLAN-REC-001 |
| DQ-020 | DONE | CODE_COMPLETE / NOT_INTEGRATED | Detectors есть, private DQ journey отсутствует | DONE_IMPLEMENTATION_ONLY → DATA-REC-001 |
| UI-MIG-020 | DONE | HISTORICAL_DONE / SUPERSEDED_PRODUCT_CLAIM | Default cutover выполнен; acceptance намеренно допускал семь safe-unbound routes | SUPERSEDE → UI-REC-001 |
| PWA-020 | DONE | NOT_CANONICAL | Contract фиксирует `NOT_PROVEN_CURRENT_HOST` | DONE_IMPLEMENTATION_ONLY; defer |
| R3 implemented items | DONE | NOT_INTEGRATED | Pure modules не подключены к canonical household flow | DONE_IMPLEMENTATION_ONLY; post-GUX |
| R7 all items | DONE | ENGINE_READY_NOT_PRODUCT | Semantic engine/property tests сильны; deployed private consumer отсутствует | KEEP engineering; STUDIO-REC-001 |
| STUDIO-080/DASH-080..086/VIZ-070 | DONE | BLOCKED_INTEGRATION | Shell/config/interactions synthetic or session-only; widgets unbound | DONE_IMPLEMENTATION_ONLY → STUDIO-REC-001 |
| PRIV-080 | DONE | NARROW_RUNTIME_SCOPE | Configuration/redaction contracts ценны; deployed browser journey не доказан | NEEDS_RECOVERY_ITEM → E2E/STUDIO |
| VIZ-090 | DONE | NOT_RENDERED_NOT_BOUND | 18-family semantic planner возвращает plan, но ECharts/browser/private query execution нет | DONE_IMPLEMENTATION_ONLY → VIZ/STUDIO |
| ANL-090 | IN_PROGRESS at audit | PAUSED_REBASELINE | Candidate extends engineering layer before Daily/Studio integration; PR #218 | BLOCKED_INTEGRATION; PR draft |

Исторические Issues не переоткрываются массово: audit trail сохраняется, а ложный product claim supersede-ится Product status + bounded recovery item. Это не скрывает false-DONE — matrix остаётся canonical и machine/governance rules запрещают повторение.

## E. Runtime/performance root causes

Canonical Home выполняет synchronous server-side chain:

`GET -> settings -> full operations readAll -> normalization/hash -> KPI passes -> second visual aggregate -> full HTML`.

Для непустой книги доказанный gateway path делает шесть data-returning Sheets reads: settings values, operation header и четыре раздельных operation spans. При `S` settings rows и `N` operation rows объём возвращённых cells равен `2S + 20 + 15N`; service-side latency каждого call из кода не выводится.

После read Home выполняет canonical normalization/dimension resolution по истории, latest-period scan, period filtering, currency/FIN aggregation и отдельный visual aggregate. Hash для repeated dimension labels не memoized. Client lazy query/prefetch/revision snapshot отсутствует; каждый top-nav переход — новый full-page `GET/doGet`.

| PERF item | Code/tests | Canonical Home | Verdict |
|---|---|---|---|
| PERF-010 query projection | Да | Только 15/20 columns, но все rows | PARTIAL |
| PERF-011 revision cache | Да | Нет | IMPLEMENTED ONLY |
| PERF-012 single scan | Да | Нет | IMPLEMENTED ONLY |
| PERF-013 incremental aggregate | Да | Нет | IMPLEMENTED ONLY |
| PERF-014 20k/50k benchmark | Да | CI only | SYNTHETIC, NOT SLA |
| PERF-070 planner/cache | Да | Нет | IMPLEMENTED ONLY |

| Runtime statement | Evidence level |
|---|---|
| Full-history read/normalization на каждом Home request | PROVEN |
| Нет revision snapshot reuse и client lazy navigation | PROVEN |
| Apps Script cold start + remote Sheets calls вероятно доминируют TTFB | INFERRED |
| Отсутствие loading feedback усиливает perceived hang | PROVEN / UX inference |
| Ошибка malformed row/currency/hash может сорвать весь SSR response; graceful product error surface отсутствует | PROVEN |
| Реальные cold/warm p50/p95, quota/concurrency, execution timeout и hang rate | REQUIRES_LIVE_MEASUREMENT |

Существующий `latencyMs` в Trusted Runtime Health — bounded technical sample, не SLO distribution. Node 20k/50k benchmarks сохраняют ценность regression gates, но contract прямо запрещает трактовать wall clock как Apps Script user SLA.

## F. UI/UX findings

- Primary nav показывает недоступные разделы.
- Home использует internal vocabulary (`FIN-TRUTH`, contract/VIZ IDs, raw reason codes).
- Cash-flow visual не передаёт тренд; composition слишком плотная.
- Нет user period selector/comparison и полноценного drill destination.
- Initial SSR wait не имеет useful progress feedback; ошибки одной row могут сорвать весь response.
- `Daily -> Explore -> Studio` раскрывает сложность раньше готовности core Daily journey.

Canonical UI decision: R2 Home остаётся default, unbound primary routes скрываются, Legacy сохраняется emergency rollback. Возврат Legacy default допускается только при live availability/SLO failure.

### Visualization capability gap

У проекта уже есть versioned `ChartSpec`, compatibility/query-hash rules, semantic shape validation, responsive/a11y plans и table fallback. Пользовательский runtime, однако, заканчивается hand-written CSS bars:

`AnalyticsResult/semantic contract -> VIZ badge -> CSS rectangle/progress rows`.

Целевая цепочка Recovery:

`revision snapshot -> AnalyticsResult -> ChartSpec -> pinned local ECharts adapter -> interaction bus -> semantic table/text fallback`.

Следовательно, добавлять ещё один visualization registry до интеграции не требуется. Нужен actual adapter/browser execution, multi-period data, Top-N+Other, readable household labels, keyboard/a11y и owner UAT.

Скриншот владельца использован как private user evidence при аудите, но не коммитится: он подтверждает false navigation, solid one-point cash-flow rectangle, dense composition и internal IDs. Browser zoom на скриншоте не используется для вывода об абсолютном font size.

## G. CI/DoD root cause

Issue acceptance разрешал contract/synthetic/fail-closed scope. Tests честно проверяли этот scope. Ошибка возникла при повышении `CODE_COMPLETE` до product `DONE`.

Новый lifecycle:

`CODE_COMPLETE -> RUNTIME_INTEGRATED -> REAL_E2E_VERIFIED -> PRODUCT_READY -> DONE`.

User-facing `DONE` требует exact-candidate `product-ready-e2e=success`. Synthetic/file-local/render smoke/exact-SHA health остаются необходимыми engineering gates, но недостаточны.

| Existing gate | Что доказывает | Что не доказывает |
|---|---|---|
| Unit/contract/property | Schema, determinism, FIN invariants на synthetic data | Deployed binding и usability |
| Synthetic Playwright/file URL | Layout, markers, bounded local interactions | Apps Script auth/private rows/route navigation |
| Render smoke | HTML marker и injection contract | Реальный household task |
| Trusted Runtime Health | Exact build, authenticated Execution API, Home builder health | Browser Web App, tabs, charts, filters, UAT/SLO |
| Main Verification historical | Merge identity/status/Issue transition | Acceptance fulfillment/Product Ready |
| `product-ready-e2e` new | Authenticated deployed declared journey на exact candidate | Не отменяет FIN/privacy/rollback gates |

После GOV-REC-001 stage metadata и `product-ready-e2e` проверяются fail-closed **до autonomous merge** и повторно Main Verification. Отдельный E2E-REC-001 должен создать trusted producer этого status; до него новые user-facing PR не могут пройти merge synthetic-only путём.

## H. Preserve

Сохраняются canonical transaction model, FIN-TRUTH/KPI, ports/adapters, read-only/fail-closed/privacy, FREE_ONLY, exact-SHA delivery, migration/recovery, R7 semantic engine, VIZ contracts и modular monolith.

## I. Rethink

Исправляются route-as-feature accounting, full-history SSR refresh, parallel synthetic HTML prototypes, latest-month-only Home, unapproved Budget/Liquidity authorities, VIZ badge-as-renderer и engineering master gates с product wording.

## J. Recovery Wave

1. `GOV-REC-001`: dual-stage governance.
2. `UI-REC-001`: truthful navigation.
3. `PERF-REC-001`: live baseline/revision snapshot.
4. `DATA-REC-001`: private Transactions/DQ.
5. `FIN-REC-001`: private Expenses/Income/Cash Flow.
6. `PLAN-REC-001`: approved Budget/Obligations/Liquidity authorities.
7. `VIZ-REC-001`: actual local ECharts adapter and useful Home visuals.
8. `E2E-REC-001`: authenticated deployed Product gate.
9. `STUDIO-REC-001`: bind existing R7/R8/VIZ-090 after Daily recovery.

### Executable recovery contracts

#### GOV-REC-001 — P0; depends_on: none

- Goal: разделить engineering completion и Product Readiness, сделать synthetic-only `DONE` невозможным.
- Non-goals: feature implementation, financial/runtime mutation, rewrite history.
- Acceptance/evidence: Roadmap v2.4, dual lifecycle/task packet, stage-aware pre-merge/Main Verification, valid Issue form, audit/ADR и deterministic governance tests.
- Rollback/gate: revert governance patch без data mutation; `MASTER-GREC-0`.

#### UI-REC-001 — P0; depends_on: GOV-REC-001

- Goal: truthful canonical navigation; R2 Home default, Legacy explicit rollback.
- Non-goals: реализация missing surfaces, chart redesign, backend migration.
- Acceptance/evidence: primary nav только для `runtime_private_data=true`; direct unavailable URL даёт human fail-closed state; owner-authenticated desktop/mobile/back-forward route evidence.
- Rollback/gate: navigation feature flag или temporary Legacy default only on proven availability failure; `MASTER-GREC-1`.

#### PERF-REC-001 — P0; depends_on: GOV-REC-001

- Goal: измерить live Apps Script path и подключить один revision-aware canonical snapshot.
- Non-goals: storage rewrite, speculative microservices, ослабление parity.
- Acceptance/evidence: ≥20 cold/20 warm samples, phase/read counters, snapshot parity/invalidation, PERF-011/012 canonical integration, no private payload; owner-approved SLO baseline.
- Rollback/gate: disable snapshot/cache and return read-only baseline path; `MASTER-GREC-2`.

#### DATA-REC-001 — P0; depends_on: UI-REC-001, PERF-REC-001

- Goal: private Transactions + Data Quality на общем snapshot.
- Non-goals: automatic repair/write, parallel finance formulas.
- Acceptance/evidence: real canonical rows, bounded filters/drill, DQ findings, loading/empty/error, FIN/no-write parity, exact-SHA authenticated deployed journey.
- Rollback/gate: hide routes and retain Home/Legacy; `MASTER-GREC-3`.

#### FIN-REC-001 — P0; depends_on: DATA-REC-001

- Goal: private Expenses/Income/Cash Flow с единым period/filter state.
- Non-goals: new KPI authority, one-off dashboard calculations.
- Acceptance/evidence: FIN summary/detail parity, meaningful multi-period compare, filter/drill/back-forward, error/empty states и owner-authenticated E2E.
- Rollback/gate: hide affected routes without changing data; `MASTER-GREC-4`.

#### PLAN-REC-001 — P1; depends_on: GOV-REC-001, DATA-REC-001

- Goal: утвердить и подключить Budget/Obligations/Liquidity authorities.
- Non-goals: guessing balance/budget from unrelated fields, silent writes/autogenerated transactions.
- Acceptance/evidence: owner-approved source/schema/ownership, setup/empty/private drill flows, reconciliation semantics и authenticated journey.
- Rollback/gate: disable planning cards/routes and show honest setup/unavailable state; `MASTER-GREC-5`.

#### VIZ-REC-001 — P1; depends_on: FIN-REC-001, PLAN-REC-001

- Goal: выполнить existing ChartSpec через pinned local ECharts и сделать Home household-useful.
- Non-goals: новый registry, external CDN, financial logic in renderer.
- Acceptance/evidence: ≥6 period trend либо honest insufficient-data, Top-N+Other, comparison, responsive/a11y/table fallback, interaction bus, visual regression и owner UAT.
- Rollback/gate: semantic table/text fallback или previous safe Home visual; `MASTER-GREC-6`.

#### E2E-REC-001 — P0; depends_on: UI/PERF/DATA/FIN/PLAN/VIZ-REC-001

- Goal: trusted exact-candidate `product-ready-e2e` producer и `MASTER-GUX`.
- Non-goals: публикация locator/private values, synthetic substitution, bypass existing gates.
- Acceptance/evidence: owner-authenticated deployed full Daily journey; filters/drills/back-forward/empty/error/privacy; cold/warm distribution; zero hangs; sanitized artifact and commit status.
- Rollback/gate: disable producer/status authority without weakening existing merge chain; `MASTER-GUX`.

#### STUDIO-REC-001 — P2; depends_on_product_ready: E2E-REC-001 (`MASTER-GUX`)

- Goal: подключить сохранённый R7/R8/VIZ-090 capital к private analytics runtime.
- Non-goals: новые analytics families до working binding, storage rewrite.
- Acceptance/evidence: private query → bound widget → save/reload/restore → drill, budgets/cache/privacy/a11y, no accepted-scope `UNBOUND`, authenticated E2E.
- Rollback/gate: hide Studio and preserve saved-spec compatibility; `MASTER-GSTUDIO`.

## K. Dependency order and gates

`GOV -> UI/PERF -> DATA -> FIN/PLAN -> VIZ -> E2E -> MASTER-GUX -> STUDIO -> MASTER-GSTUDIO`.

`MASTER-GUX` требует exact SHA, authentication, private binding, full journey, FIN parity, cold/warm distribution, resilience, privacy, desktop/mobile UX и rollback evidence.

## L. Owner actions

Owner вручную предоставляет/разрешает authenticated browser session, утверждает Budget/Obligations/balance semantics, выполняет private UAT, подтверждает SLO после baseline и решает emergency Legacy switch. Credentials/private locators не публикуются.

## M. Time ranges

- Рабочий основной продукт: 3–5 недель.
- Хороший визуальный Dashboard: 4–7 недель.
- Integrated Advanced Analytics: 8–12 недель.
- Полный R0–R10: 4–7 месяцев при доступности owner/cloud prerequisites.

## Evidence boundary

Повторно пройдены canonical R2 contract/parity, composer unbound contract, VIZ-090 semantic pack, Node synthetic 20k/50k и analytics planner cache tests. Эти результаты доказывают engineering properties, но не Apps Script user SLA.

Live row count, Sheets service latency, cold/warm p50/p95, quota/concurrency и mobile UAT имеют статус `REQUIRES_LIVE_MEASUREMENT`.

## ROADMAP CHANGESET FOR WRITER

Owner-approved implementation contract:

1. Bump canonical `docs/ROADMAP.md` to v2.4 / `PRODUCT-RECOVERY-FIRST`; preserve audited SHA and public-safe evidence boundary.
2. Introduce `work_class`, `engineering_status`, `product_stage`, `target_stage`, `depends_on_product_ready`; keep compatibility `status`, but distinguish `DONE_ENGINEERING` from user-facing `DONE`.
3. Add `PRODUCT-EVIDENCE`: synthetic/contracts/file-local/render smoke/exact-SHA health cannot independently satisfy user-facing completion.
4. Add R2R items `GOV/UI/PERF/DATA/FIN/PLAN/VIZ/E2E/STUDIO-REC-001`, exact dependency order, provisional SLO and gates `MASTER-GREC-0..6`, `MASTER-GUX`, `MASTER-GSTUDIO`.
5. Reclassify false-DONE groups in Product status matrix without mass-reopening historical Issues; link each to bounded recovery item.
6. Rename R7/R8 exits to `MASTER-G7-ENGINEERING`/`MASTER-G8-ENGINEERING`; classify VIZ-090 as `DONE_ENGINEERING / NOT_RENDERED_NOT_BOUND`.
7. Freeze R9/R10; set ANL-090 to `BLOCKED / PAUSED_REBASELINE`, keep its implementation PR draft.
8. Update task packet/resolver/schema/tests and Issue Form for stage-aware lifecycle; dependencies requiring product readiness only accept a user-facing dependency with `product_stage=DONE`.
9. Block draft PR before DEV credentials/content push/version promotion; make autonomous merge and Main Verification fail closed for user-facing work unless exact-candidate `product-ready-e2e=success`; Trusted Runtime Health explicitly emits `notProductE2e=true`.
10. Synchronize `AGENTS.md`, `README.md`, PROJECT_STATUS, AI context, release/merge documentation, language-policy inventory, ADR and audit.
11. Materialize eight downstream Recovery Issues as `BACKLOG`; only GOV-REC-001 is active writer. Do not merge/deploy this governance patch without normal repository gates.
12. After governance PR is green, owner decides readiness/merge; subsequent execution starts with UI-REC-001 and PERF-REC-001 in one-writer order, then follows dependency gates.
