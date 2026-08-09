# MIG-010 — owner-authorized staging execution

`roadmap_id: MIG-010`  
`policy: MIG010_EXECUTION_POLICY_V1@1.0.0`  
`strategy: STAGE_VERIFY_REPLACE_WITH_ROLLBACK_V1`

## Текущая граница

Owner-private repair уже может подготовить exact rebuild candidate, но это **не разрешение на запись**. До отдельного owner action `IRREVERSIBLE_ACTION_AUTHORIZED` все реальные financial writes запрещены.

Текущий pre-authorization flow:

```text
RESOLVED_REBUILD_DRY_RUN = PASS
  -> EXECUTION_PACKAGE = PACKAGE_READY, writeAuthorized=false
  -> AUTHORIZATION_REQUEST = AUTHORIZATION_REQUIRED, writeAuthorized=false
  -> OWNER DECISION
       -> no authorization: STOP, workbook unchanged
       -> IRREVERSIBLE_ACTION_AUTHORIZED
            -> STAGING
            -> STAGE READBACK
            -> FINALIZE
            -> FRESH ENCRYPTED BACKUP
            -> POST-WRITE RECONCILIATION
                 -> PASS: OWNER_VERIFIED
                 -> FAIL: ROLLBACK
```

GitHub Actions, merge PR, AI-agent, execution-package builder и authorization-request builder не имеют права самостоятельно создать owner authorization.

## 1. Execution package

`tools/mig010-execution-package.js prepare` работает только локально и создаёт private `MIG010_OWNER_EXECUTION_PACKAGE_V1` вне Git repository.

Package связан с:

- exact resolved rebuild hash;
- source revision;
- canonical candidate revision;
- verified encrypted backup SHA-256;
- initial target canonical revision;
- initial raw `01 Операции` table hash;
- expected final raw table hash;
- target header hash;
- deterministic batch hashes.

Пакет сохраняет target rows вне migrating legacy-source scope. Legacy slice пересобирается только из owner-confirmed canonical candidate. Batch size не превышает 100.

Raw target representation для текущего DEV schema строится детерминированно. Формулы derived date/month columns пересчитываются под итоговый номер строки. Любая formula-like строка из source text, начинающаяся с `=`, блокируется вместо интерпретации как Google Sheets formula.

`prepare` не обращается к Google Sheets и возвращает `writeAuthorized=false`.

## 2. Authorization request

`tools/mig010-authorized-executor.js request` повторно расшифровывает encrypted backup локально, проверяет его exact SHA against execution package и создаёт private `MIG010_OWNER_AUTHORIZATION_REQUEST_V1`.

Request содержит только технические bindings:

- `request_hash`;
- `package_hash`;
- `resolved_hash`;
- `candidate_revision_hash`;
- backup cipher SHA-256;
- current/final raw table hashes;
- target header hash;
- random owner-private `session_id`;
- `backup_verified_at`;
- literal required action `IRREVERSIBLE_ACTION_AUTHORIZED`.

Request сам имеет `write_authorized=false`. Backup verification должен оставаться свежим не более 24 часов на момент первого authorized call.

## 3. Owner authorization

Только владелец может создать private `MIG010_OWNER_IRREVERSIBLE_AUTHORIZATION_V1`.

Authorization считается действительным только когда одновременно:

- `authorization = IRREVERSIBLE_ACTION_AUTHORIZED`;
- `write_authorized=true`;
- `request_hash` совпадает exact authorization request;
- `session_id` совпадает;
- package/resolved/candidate/backup/current/final/header hashes совпадают request и execution package;
- `backup_verified_at` exact-match request и не старше 24 часов.

Любое расхождение fail-closed. Public CI не может создать или подменить этот файл.

## 4. Separate Apps Script gateway

`Mig010ExecutionGateway.js` — отдельный migration-specific boundary. Он **не** разблокирует generic ARCH-011 Google repository adapter: `GoogleTransactionRepositoryGateway.js` по-прежнему не имеет canonical mutation primitives и generic `writeBatch()` остаётся `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Authorized gateway использует только четыре mutation entry points:

- `prhMig010BeginAuthorizedExecution`;
- `prhMig010WriteAuthorizedBatch`;
- `prhMig010FinalizeAuthorizedExecution`;
- `prhMig010RollbackAuthorizedExecution`.

Каждый call получает literal authorization и exact technical bindings. Apps Script session хранит только hashes/status/batch ordinals/sheet technical names; real financial payload в Script Properties не записывается.

## 5. Begin: live target пока неизменен

`begin` под `ScriptLock`:

1. проверяет authorization freshness/bindings;
2. проверяет header и exact live raw table hash against execution package;
3. если target изменился после backup — `MIG010_EXECUTION_TARGET_CHANGED_SINCE_BACKUP`;
4. создаёт hidden rollback copy текущего target;
5. создаёт hidden staging sheet;
6. копирует только header в staging;
7. сохраняет technical session.

На этой стадии `01 Операции` не меняется.

## 6. Staging batches

Каждый batch:

- строго sequential;
- максимум 100 rows;
- exact `batch_hash`;
- exact expected staging start row;
- повтор того же batch idempotent (`ALREADY_APPLIED`);
- другой payload на уже применённом batch блокируется;
- formulas разрешены только для derived columns C/D и обязаны ссылаться на exact final row;
- после `setValues` выполняется `SpreadsheetApp.flush()` + readback hash.

Несовпадение readback останавливает процесс до live mutation.

## 7. Finalize и rollback

Finalize разрешён только если:

- все batches staged;
- full staging hash = expected final raw table hash;
- live target всё ещё имеет initial raw table hash.

После этого staging переносится в live target chunks <=100 с readback каждого chunk и final full-table hash.

Если finalize падает после начала live mutation, gateway автоматически восстанавливает target из hidden rollback copy и проверяет initial raw hash. Успешный finalize возвращает только:

`FINALIZED_PENDING_RECONCILIATION`

Это **не** `DONE`.

Rollback copy сохраняется до owner-private reconciliation PASS. Владелец также может явно вызвать `rollback` тем же exact authorization/session binding.

## 8. Post-write reconciliation

После finalize обязательно создаётся **новый encrypted DR-001 backup уже изменённой книги**. Старый backup не считается post-write evidence.

`tools/mig010-post-reconcile.js verify` локально проверяет:

- fresh backup decrypt/checksum;
- source revision не изменилась;
- owner proposal/resolution повторно даёт тот же resolved rebuild hash;
- canonical candidate revision совпадает execution package;
- raw target table hash exact-match expected final hash;
- explained quarantine остаётся частью owner repair evidence;
- `unexplainedMismatch = 0`;
- повторный deterministic rebuild не меняет target (`idempotentRerunNoop=true`).

Только `MIG010_OWNER_POST_RECONCILIATION_V1 status=PASS` позволяет считать private migration verified. При любом FAIL rollback остаётся доступным и MIG-010 не может стать DONE.

## 9. Privacy-safe evidence

В public GitHub допустимы только schema/status/reason codes/PASS-FAIL и cryptographic hashes, необходимые для machine binding. Не публикуются:

- execution package rows;
- private authorization/request files;
- source/target rows;
- amounts/categories/descriptions;
- source positions;
- session-private payload;
- backup bytes/key;
- OAuth/deployment identifiers;
- reconciliation detail rows.

## 10. Current code-state

До фактического owner authorization:

- execution package builder: available, no write command;
- authorization request builder: available, `writeAuthorized=false`;
- staging gateway: authorization-gated;
- authorized executor: существует, но без private authorization fail-closed;
- post-reconcile verifier: read-only;
- generic Google repository writes: still blocked;
- actual full-history migration: **not executed**.
