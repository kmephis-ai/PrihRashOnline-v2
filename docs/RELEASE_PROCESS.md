# Release / Autonomous Delivery Process

## Цель

Обычные Roadmap-изменения должны проходить полный машинно-доказуемый цикл без ручного merge и без ослабления privacy/security/cost boundaries.

`main` — единственная долгоживущая ветка исходного кода. GitHub — control plane. DEV Apps Script — приватный runtime. PROD и необратимые действия остаются отдельными policy gates.

## Work-item model

1. Один Roadmap ID = одна GitHub Issue = один active writer.
2. Перед реализацией dependency-check должен быть green, Issue переводится в `status: IN_PROGRESS`.
3. Writer работает в короткоживущей ветке `agent/<ID>-<slug>`.
4. PR должен идти в `main`, быть same-repository, non-draft и содержать ровно одну строку `Closes #<Issue>` для canonical autonomous-close path.
5. После успешного stage-aware Main Verification engineering Issue получает `DONE_ENGINEERING`, а user-facing Issue — `DONE` только при `product-ready-e2e=success`.

Штатная модель **не использует** release snapshot branches, ограничения по числу commits или историю ветки как quality signal.

## 1. PR Validation — untrusted / zero-secret zone

Workflow: **`PR Validation`**.

Он выполняется на exact PR head SHA с минимальными read permissions и без deploy secrets. В зависимости от scope gate включает:

- locked dependency install (`npm ci`, Node 24);
- supply-chain policy;
- CI trust-boundary policy;
- secret scan;
- synthetic-only public privacy scan;
- `FREE_ONLY` policy scan;
- documentation truth scan;
- financial reconciliation synthetic;
- migration reconciliation synthetic;
- full contract suite;
- responsive Playwright synthetic UI gate;
- deterministic build immutable Apps Script candidate.

После green validation создаётся immutable candidate artifact, имя и manifest которого связаны с точным 40-char PR head SHA.

PR code на этом этапе не получает DEV credentials и не выполняет deployment.

## 2. Trusted DEV Deploy — default-branch control plane

Workflow: **`Trusted DEV Deploy`** запускается только после успешного `PR Validation`.

Привилегированный workflow-код берётся из текущего default branch, а не из PR. Он:

1. проверяет, что candidate относится к единственному same-repository PR в `main`;
2. скачивает immutable artifact успешного PR Validation;
3. отдельно checkout'ит exact candidate Git tree без credentials;
4. trusted packager заново строит expected candidate и сравнивает manifest/file hashes;
5. устанавливает pinned/locked trusted tooling;
6. только после этого использует DEV credentials;
7. push'ит verified candidate в Apps Script и продвигает стабильные DEV deployment targets на созданную exact version;
8. публикует только privacy-safe technical evidence/status.

Candidate scripts не используются как secret-bearing deploy tooling.

## 3. Trusted Runtime Health — authenticated exact-build proof

Workflow: **`Trusted Runtime Health`** запускается после успешного trusted deploy.

Этот gate доказывает exact-build engineering health через trusted authenticated boundary и публикует `not_product_e2e=true` как смысловой contract. Он не проходит browser navigation/filter/drill/UAT и не является Product Ready evidence.

Для `work_class=user_facing` отдельный exact-candidate status **`product-ready-e2e`** обязан быть `success` до autonomous merge и повторно проверяется Main Verification. Его artifact sanitized и не содержит Web App locator, private values/labels/IDs или authenticated payload.

Runtime health:

- использует owner-only authenticated Apps Script Execution API;
- не делает private Web App публичным;
- получает candidate SHA/source-tree hash из immutable deploy evidence;
- вызывает bounded transport/health functions с `devMode:false`;
- требует точного совпадения deployed candidate SHA + source-tree hash;
- публикует только technical status/reason/latency/build identity.

Anonymous `curl`/login-page smoke не является доказательством runtime correctness. Ручной marker не является substitute для authenticated exact-SHA health.

## 4. CI-003 autonomous squash merge

После green exact-head required gates trusted default-branch state machine проверяет, что:

- PR всё ещё open/non-draft, same-repository и target=`main`;
- current PR head равен validated/deployed/health-checked candidate SHA;
- PR содержит единственную canonical `Closes #N` ссылку;
- linked Issue — обычная Roadmap Issue и ровно один раз содержит `status: IN_PROGRESS`;
- required machine states green.

После этого GitHub Actions выполняет **squash merge**. Human approval/marker не используется как штатный surrogate machine gate.

## 5. Main Verification и закрытие Issue

После автономного merge CI-003 dispatch'ит workflow **`Main Verification`**. Он fail-closed проверяет:

- merge SHA действительно принадлежит указанному PR и находится на `main`;
- merge выполнен automation-owned path;
- candidate SHA совпадает с PR head;
- `trusted-dev-deploy`, `trusted-runtime-health` и `autonomous-merge` для exact candidate = success;
- linked Roadmap Issue всё ещё open и `IN_PROGRESS`.

Только после этого workflow меняет Issue body `status: DONE`, `engineering_status: DONE_ENGINEERING`; для user-facing также `product_stage: PRODUCT_READY -> DONE`. Без stage metadata или Product E2E user-facing close fail-closed.

## Что больше не является release gate

Следующие механизмы исторические и не должны возвращаться в штатный flow:

- `agent/release/**` snapshot/release branches;
- требования 1–3 или максимум 10 commits;
- requirement, что `main` обязательно ancestor release snapshot;
- отдельный `Chat-Driven DEV Release` state machine;
- manual runtime marker;
- anonymous Web App smoke для private `MYSELF` deployment;
- post-merge direct commit для публикации Dashboard URL;
- commit count / tag snapshot как критерий качества PR.

## Dashboard URL

DEV Web App остаётся private `MYSELF`. Его deployment/runtime locator не публикуется и не синхронизируется публичным README. Владелец использует private Google environment/book menu или локальную закладку.

Доступность runtime доказывается authenticated Execution API health, а не наличием публичной URL-ссылки.

## Safety boundaries

Автономность не отменяет policy gates:

- public GitHub = code/docs/independently generated synthetic finance data only;
- private financial rows/aggregates/backup/OAuth/runtime responses не публикуются;
- `FREE_ONLY` запрещает automatic paid overage/provider activation;
- irreversible production-data destruction/history rewrite/paid-service activation требуют отдельного policy decision;
- DEV merge не означает PROD promotion;
- uncertainty/failure всегда останавливает merge fail-closed.

## Recovery when CI is red

1. Зафиксировать exact PR head SHA и первый failing machine gate.
2. Диагностировать root cause по technical logs/evidence без публикации private payload.
3. Исправлять тот же active Roadmap branch/PR; не создавать параллельную release state machine.
4. Новый commit создаёт новый exact candidate и заново проходит всю цепочку.
5. Не обходить failing gate marker'ом, ручным merge или ослаблением privacy.

## Команда продолжения

`делай далее` означает: разрешить следующий dependency-ready Roadmap ID, выполнить его в одном writer cycle и довести до `DONE` через описанную выше machine chain. Ручной release snapshot для этого не создаётся.
