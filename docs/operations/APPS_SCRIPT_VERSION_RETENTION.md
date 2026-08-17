# Retention версий Google Apps Script

## Назначение

Google Apps Script допускает не более 200 версий проекта. Trusted delivery не должен останавливаться из-за накопления версий и не должен создавать новую immutable version при повторном выполнении для того же exact candidate.

Нормативная реализация:

- `tools/apps-script-version-retention.js` — inventory, deterministic plan, deletion и readback;
- `tools/apps-script-api-promote.js` — exact-candidate reuse и pre-create retention;
- `.github/workflows/apps-script-version-retention.yml` — trusted cleanup после успешного Main Verification и ручной emergency dispatch;
- `tests/apps_script_version_retention_contract_test.js` — destructive-boundary contract.

## Политика

| Параметр | Значение |
|---|---:|
| Максимальная платформа | 200 |
| High-water mark | 180 |
| Target после cleanup | 160 |
| Резерв последних unused версий | 12 |

Automation сначала получает полный список Apps Script deployments и versions. Версия защищена от удаления, если:

1. на неё указывает любой active versioned deployment, а не только canonical Web App/API executable;
2. она выбрана для reuse текущего exact candidate;
3. она входит в резерв 12 самых новых unused versions.

Удаляются только самые старые версии вне всех трёх множеств. Перед созданием новой версии cleanup обязан освободить capacity до target. После удаления выполняется повторный inventory; несовпадение count или наличие удалённой версии означает FAIL.

## Устранение duplicate versions

Описание новой immutable version содержит exact candidate SHA и source-tree hash. Повторный trusted deploy:

- переиспользует уже существующую exact-candidate version;
- не вызывает `projects.versions.create`, если оба stable deployments уже указывают на неё;
- при незавершённой предыдущей promotion использует последнюю matching version вместо создания дубля;
- сохраняет compatibility с ранее созданным описанием `CI exact candidate <sha>`.

Version reuse не заменяет candidate verification: immutable candidate artifact по-прежнему пересобирается default-branch policy, а content push выполняется до promotion.

## Trust boundary

- Cleanup не запускается из `pull_request` и не получает secrets из PR context.
- Workflow работает только из default-branch policy в environment `DEV` после успешного `Main Verification` либо explicit owner `workflow_dispatch`.
- OAuth, Script ID, deployment IDs, individual deleted version numbers и raw API bodies не публикуются.
- Evidence содержит только `before_count`, `after_count`, `deleted_count`, protected/reserve counts и bounded reason.
- Любая неоднозначность inventory, permission error, race или невозможность получить требуемый резерв останавливает операцию fail-closed.

## Recovery

Удалённая Apps Script version не восстанавливается. Поэтому rollback обеспечивается не попыткой восстановить удалённые unused snapshots, а следующими слоями:

1. все in-use deployment versions всегда защищены;
2. последние 12 unused versions сохраняются как bounded rollback reserve;
3. Git exact candidate и deterministic packager позволяют воспроизвести source artifact;
4. deployment update выполняется только после candidate verification;
5. при promotion failure Web App/API возвращаются на предыдущие защищённые версии.

Ручное массовое удаление через Apps Script UI не является штатной процедурой. Если retention gate завершился ошибкой, сначала исследуется bounded reason; расширять права или удалять active version запрещено.
