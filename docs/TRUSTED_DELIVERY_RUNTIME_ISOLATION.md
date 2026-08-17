# Trusted delivery: изоляция DEV runtime

Статус: нормативное дополнение к CI-002/CI-003 delivery contract.

## Проблема

`PR Validation` выполняется и для продуктовых Roadmap PR, и для инфраструктурных/документационных PR. До этого изменения любой successful same-repository PR Validation запускал `Trusted DEV Deploy`, поэтому CI-only PR мог продвинуть собственный Apps Script candidate в стабильный DEV deployment и тем самым инвалидировать уже подтверждённый owner UAT другого продуктового candidate.

Такое поведение нарушает exact-candidate truth: изменение CI/docs/tests не должно менять активный продуктовый runtime.

## Канонические deployment modes

### `ROADMAP_EXACT_CANDIDATE`

DEV mutation разрешена только если source PR:

- same-repository, non-draft и targeting default branch;
- содержит ровно одну отдельную строку `Closes #N`;
- связанный объект `#N` является открытым Issue;
- Issue содержит ровно один canonical `roadmap_id`, `status: IN_PROGRESS` и `writer_branch: agent/...`;
- `writer_branch` точно совпадает с PR head branch.

Только этот mode может устанавливать Node/deploy tooling, читать Apps Script DEV secrets, выполнять content push, создавать/переиспользовать immutable Apps Script version, продвигать stable deployments и запускать authenticated exact-build Runtime Health.

### `NOT_APPLICABLE_NON_ROADMAP`

Если source PR не содержит ни одной отдельной `Closes #N` строки, trusted deploy классифицирует его как non-Roadmap:

- Apps Script content **не pushится**;
- stable deployment **не продвигается**;
- Apps Script OAuth/script/deployment secrets **не используются шагами workflow**;
- создаётся privacy-safe N/A evidence;
- `trusted-dev-deploy` и `trusted-runtime-health` публикуют machine-visible success с reason `NOT_APPLICABLE_NON_ROADMAP`;
- authenticated runtime probe и CI-003 autonomous Roadmap merge не выполняются.

Это не является runtime PASS продукта: это доказательство того, что runtime mutation/probe к данному PR неприменимы.

## Fail-closed границы

Roadmap-like PR не имеет права тихо стать N/A. Если `Closes #N` присутствует, но references неоднозначны, Issue закрыт/невалиден, canonical Roadmap metadata отсутствует/дублируется или `writer_branch` не совпадает с head branch, Trusted DEV Deploy завершается ошибкой до credential-bearing mutation steps.

Неизвестный `deploymentMode` также fail-closed в deploy/runtime workflows.

## Инвариант Owner UAT

После этого контракта non-Roadmap infra/docs/test PR не может перезаписать DEV runtime, на котором был выполнен exact-candidate Owner UAT. Product candidate меняется только следующей валидной Roadmap deployment transaction.