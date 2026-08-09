# MIG-010 — owner-authorized staging execution

`roadmap_id: MIG-010`  
`policy: MIG010_EXECUTION_POLICY_V1@1.0.0`  
`strategy: STAGE_VERIFY_REPLACE_WITH_ROLLBACK_V1`

## Текущая граница

Owner-private migration прошла полный irreversible flow и получила `OWNER_VERIFIED`. Это не создаёт постоянного write permission: любое новое real financial write требует нового exact-bound owner action `IRREVERSIBLE_ACTION_AUTHORIZED` и новых свежих preconditions.

Нормативный flow остаётся:

```text
RESOLVED_REBUILD_DRY_RUN = PASS
  -> EXECUTION_PACKAGE = PACKAGE_READY, writeAuthorized=false
  -> AUTHORIZATION_REQUEST = AUTHORIZATION_REQUIRED, writeAuthorized=false
  -> OWNER DECISION
       -> no authorization: STOP, workbook unchanged
       -> IRREVERSIBLE_ACTION_AUTHORIZED
            -> STAGING
            -> STAGE READBACK
            -> FINALIZE = FINALIZED_PENDING_RECONCILIATION
            -> FRESH ENCRYPTED BACKUP
            -> POST-WRITE RECONCILIATION
                 -> PASS: OWNER_VERIFIED
                 -> FAIL: ROLLBACK
```

GitHub Actions, merge PR, AI-agent, execution-package builder и authorization-request builder не имеют права самостоятельно создать owner authorization.

## 1. Execution package

`tools/mig010-execution-package.js prepare` работает только локально и создаёт private `MIG010_OWNER_EXECUTION_PACKAGE_V1` вне Git repository.

Package связан с exact resolved rebuild hash, source revision, canonical candidate revision, verified encrypted backup SHA-256, initial target revision, initial/final raw table hashes, target header hash и deterministic batch hashes. Пакет сохраняет target rows вне migrating legacy-source scope; batch size не превышает 100.

Формулы derived date/month columns пересчитываются под итоговый номер строки. Любая formula-like source string, начинающаяся с `=`, блокируется вместо интерпретации как Google Sheets formula. `prepare` не обращается к Google Sheets и возвращает `writeAuthorized=false`.

## 2. Authorization request

`tools/mig010-authorized-executor.js request` повторно расшифровывает encrypted backup, проверяет exact SHA against execution package и создаёт private `MIG010_OWNER_AUTHORIZATION_REQUEST_V1`.

Request создаётся только если `manifest.createdAt` самой backup-копии существует и backup была создана не более 24 часов назад, decrypt/checksum verification успешна и cipher SHA совпадает package. Старый backup нельзя сделать свежим простым повторным verify: stale `manifest.createdAt` даёт `MIG010_EXECUTOR_BACKUP_COPY_STALE`.

Request отдельно связывает `backup_created_at` и `backup_verified_at`; оба timestamp должны оставаться не старше 24 часов на момент authorized call.

## 3. Owner authorization

Только владелец может создать private `MIG010_OWNER_IRREVERSIBLE_AUTHORIZATION_V1`.

Authorization действителен только когда одновременно:

- `authorization = IRREVERSIBLE_ACTION_AUTHORIZED`;
- `write_authorized=true`;
- request/session/package/resolved/candidate/backup/current/final/header bindings exact-match;
- `backup_created_at` и `backup_verified_at` exact-match request и находятся в freshness window.

Любое расхождение fail-closed. Public CI не может создать или подменить этот файл.

## 4. Separate Apps Script gateway

`Mig010ExecutionGateway.js` — отдельный migration-specific boundary. Он **не** разблокирует generic ARCH-011 Google repository adapter: generic `writeBatch()` остаётся `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Authorized path использует begin, batch, finalize и rollback entry points. Apps Script session хранит только technical binding/status/progress metadata; financial payload в Script Properties не записывается.

## 5. Begin: live target пока неизменен

`begin` под `ScriptLock` проверяет authorization freshness/bindings, header и exact live raw table hash, после чего создаёт hidden rollback copy и hidden staging. Data rows очищаются только в staging; live target на этой стадии не меняется.

## 6. Staging batches и exact-type preservation

Каждый batch строго sequential/idempotent, максимум `<=100` rows, имеет exact batch hash и expected staging start row. После write выполняется `SpreadsheetApp.flush()` + readback hash; mismatch не может продвинуть session.

Owner execution выявила реальный Google Sheets transport edge case: legacy number format мог изменить explicit package cell type после `setValues`. Staging-only probes доказали, что package/value semantics корректны, а coercion появлялась из-за несовместимого format lifecycle.

`Mig010ExecutionTypedWrite.js` поэтому использует adaptive existing-format-first strategy:

1. пишет с существующими formats;
2. если exact readback совпал — ничего не меняет;
3. если обнаружена format-induced type coercion, минимально исправляет только соответствующие `t:s` / `t:d` cells compatible format;
4. повторяет write и exact hash readback;
5. при любом FAIL очищает failed batch и восстанавливает original formats.

Financial/package значения при этом не переписываются и не нормализуются. Exact package hash/readback остаётся единственной authority.

## 7. Finalize и rollback

Finalize разрешён только если все batches staged, full staging hash = expected final raw table hash и live target всё ещё имеет initial raw table hash.

Staging переносится в live chunks <=100 с сохранением formulas. `contentsOnly:true` намеренно не используется для data copy: иначе formulas могли бы быть заменены вычисленными values. Regression-test требует formula preservation.

Если finalize падает после начала live mutation, gateway автоматически восстанавливает target из hidden rollback copy и проверяет initial raw hash. Успешный finalize возвращает только `FINALIZED_PENDING_RECONCILIATION`; это не `DONE`.

Rollback copy сохраняется до owner-private reconciliation PASS. После PASS `rollbackCanBeReleased=true` означает возможность отдельной cleanup-процедуры, а не автоматическое удаление hidden resources.

## 8. Post-write reconciliation

После finalize обязательно создаётся **новый encrypted DR-001 backup изменённой книги**.

`tools/mig010-post-reconcile.js verify` локально проверяет fresh backup decrypt/checksum, unchanged source revision, exact resolved rebuild, candidate revision, final raw target hash, explained quarantine и `unexplainedMismatch = 0`. Повторный deterministic rebuild обязан быть no-op/idempotent.

Только `MIG010_OWNER_POST_RECONCILIATION_V1 status=PASS` позволяет считать private migration verified.

## 9. Privacy-safe evidence

В public GitHub допустимы только schema/status/reason codes/PASS-FAIL и cryptographic hashes, необходимые для machine binding. Не публикуются execution package rows, private authorization/request files, financial rows/amounts/categories/descriptions, source positions, OAuth/deployment identifiers, backup bytes/key или reconciliation detail rows.

## 10. Verified owner execution checkpoint

Owner-private run достиг machine evidence:

- exact-bound owner authorization — accepted;
- staging + readback — complete;
- adaptive type-preservation probe — `MATCHED`;
- finalize — `FINALIZED_PENDING_RECONCILIATION`;
- fresh encrypted post-write backup — `BACKUP_CREATED`;
- post-write reconciliation — `PASS`;
- `unexplainedMismatch = 0`;
- `provenanceComplete=true`;
- `idempotentRerunNoop=true`;
- `rollbackCanBeReleased=true`;
- financial payload не публиковался.

Следовательно private migration = `OWNER_VERIFIED`. MIG-010 всё ещё не считается GitHub `DONE`, пока PR #97 не пройдёт финальные exact-head gates, merge и Main Verification/Issue close.

Generic Google repository writes остаются blocked; owner/repair/rebuild package tools по-прежнему не имеют generic active write command.
