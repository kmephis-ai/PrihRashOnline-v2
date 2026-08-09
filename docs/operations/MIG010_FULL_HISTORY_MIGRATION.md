# MIG-010 — deterministic full-history migration

`roadmap_id: MIG-010`  
`protocol: PRH_FULL_HISTORY_MIGRATION_V1`  
`owner tool: tools/mig010-owner.js`

## Назначение

MIG-010 переносит полную историю только через deterministic, resumable и idempotent protocol поверх `PRH_TRANSACTION_REPOSITORY_V1`. Публичный репозиторий содержит код, synthetic tests и privacy-safe evidence contract; реальные household-finance строки остаются только в owner-private execution environment.

**Merge кода MIG-010 не является разрешением на массовую запись.** Первый real write — отдельное irreversible action и требует явного owner authorization после успешного private dry-run и свежего DR-001 backup evidence.

## State machine

```text
CODE_READY
  -> OWNER_PRIVATE_SNAPSHOT
  -> OWNER_DRY_RUN
  -> AUTHORIZATION_REQUIRED
  -> BATCHING (<=100)
  -> PRIVATE_RECONCILIATION
  -> OWNER_VERIFIED
```

Любой `BLOCK`, stale target revision, stale/mismatched backup, повреждённый resume token или `unexplainedMismatch != 0` останавливает процесс fail-closed.

## Public machine contracts

- `lib/migration/full_history_migration.v1.json` — versioned policy.
- `lib/migration/full_history_migration.js` — plan/resume/pre-write/reconciliation engine.
- `tests/full_history_migration_contract_test.js` — interruption/resume/idempotency synthetic drill.
- `tools/mig010-owner.js` — owner-local privacy boundary.
- `tests/mig010_owner_tool_contract_test.js` — stdout/private-path/write-disabled contract.

## Owner-private files

Следующие файлы должны находиться **вне Git repository** и не передаваться в GitHub/chat:

- encrypted `.prhbackup`;
- backup encryption key;
- private mapper module;
- generated private snapshot;
- migration resume secret;
- migration private state;
- future irreversible authorization file;
- private reconciliation details.

Owner tool технически отклоняет private mapper/snapshot/state/secret внутри repository tree.

## Создание private snapshot

`tools/mig010-owner.js snapshot-from-backup` расшифровывает уже проверенный DR-001 backup только локально, передаёт portable backup package private mapper-модулю и сохраняет `MIG010_OWNER_PRIVATE_SNAPSHOT_V1` вне repo.

Private mapper contract:

```js
module.exports = {
  schema: 'MIG010_OWNER_PRIVATE_MAPPER_V1',
  mappingVersion: 'OWNER-MAPPING-v1',
  buildSnapshot({ backupPackage, cellValue }) {
    return {
      source_records: [],
      canonical_records: []
    };
  }
};
```

Реальный mapper не коммитится. Он обязан преобразовать source history в существующий DATA-001 `SOURCE-TRANSFORM-v1` record contract и current canonical target в `PRH_CANONICAL_TRANSACTION_V1`. Header/sheet names, resolvers и реальные значения остаются внутри private mapper.

## Dry-run

Dry-run требует:

1. private snapshot;
2. `DR-001-EVIDENCE-v1` с `status=PASS`, `checksum=PASS` и encrypted backup SHA-256;
3. локальный 32-byte resume secret;
4. owner-private state path.

Snapshot содержит encrypted backup SHA-256. Dry-run разрешён только если этот SHA совпадает с DR evidence. Затем строится deterministic plan:

- `REUSE` — source уже представлен ровно одним canonical fingerprint;
- `INSERT` — новый однозначный source;
- `BLOCK` — duplicate/invalid/mismatch/provenance ambiguity.

Если существует хотя бы один `BLOCK`, write batches не создаются.

## Deterministic batching

Для READY plan:

- порядок: `source_fingerprint ASC`;
- batch size `1..100`;
- idempotency key: `MIG010:<plan_hash>:<batch_index>`;
- каждый batch требует exact `expected_revision`;
- resume token = HMAC-SHA256 over `plan_hash + next_batch + expected_revision`;
- изменение target между batches блокирует resume.

## Irreversible-action gate

На текущем этапе owner tool **не содержит активной команды write**. `execute`, `write` и `apply` возвращают:

`MIGRATION_IRREVERSIBLE_ACTION_TOOL_NOT_ENABLED`

Это намеренная policy boundary. Перед включением real write должны одновременно существовать:

- private dry-run `READY`;
- fresh verified encrypted backup не старше 24 часов;
- backup SHA совпадает со snapshot/plan;
- explicit owner action `IRREVERSIBLE_ACTION_AUTHORIZED`, привязанный к exact `plan_hash`;
- migration-specific write adapter с idempotency, expected revision, readback и rollback semantics;
- готовность остановиться после любого batch при mismatch.

Ни GitHub Actions, ни merge PR, ни AI-agent не могут создать это разрешение автоматически.

## Reconciliation

После последнего batch и до признания migration успешной обязательно:

- повторно прочитать canonical target;
- выполнить DATA-001 source-to-canonical reconciliation;
- `unexplainedMismatch = 0`;
- source/canonical history полностью покрыта provenance;
- повторный full dry-run даёт только `REUSE`, без новых `INSERT`;
- partial/ambiguous result остаётся fail-closed.

## Public-safe evidence

В GitHub допускаются только:

```json
{
  "schema": "MIG-010-EVIDENCE-v1",
  "status": "PASS",
  "planHash": "<sha256>",
  "sourceRevisionHash": "<sha256>",
  "initialTargetRevisionHash": "<sha256>",
  "finalTargetRevisionHash": "<sha256>",
  "backupCipherSha256": "<sha256>",
  "unexplainedMismatch": 0,
  "durationMs": 0
}
```

Не публикуются counts, dates/period distributions, amounts, categories, descriptions, source positions, sheet names, mapper configuration, resume token/secret или private reconciliation rows.

## Rollback

До explicit irreversible authorization real workbook не меняется. После будущего authorized execution rollback authority опирается на отдельный verified encrypted DR-001 backup и batch ledger/readback. Любое необъяснённое partial состояние останавливает дальнейшие writes и требует восстановления/разбора владельцем.
