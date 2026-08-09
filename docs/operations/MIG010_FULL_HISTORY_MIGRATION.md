# MIG-010 — deterministic full-history migration

`roadmap_id: MIG-010`  
`protocol: PRH_FULL_HISTORY_MIGRATION_V1`  
`owner tool: tools/mig010-owner.js`

## Назначение

MIG-010 переносит полную историю только через deterministic, resumable и idempotent protocol поверх `PRH_TRANSACTION_REPOSITORY_V1`. Публичный репозиторий содержит code, synthetic tests и privacy-safe evidence contract; реальные household-finance строки остаются только в owner-private execution environment.

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

Любой `BLOCK`, existing-target core/provenance drift, stale target revision, stale/mismatched backup, повреждённый resume token или `unexplainedMismatch != 0` останавливает процесс fail-closed.

## Public machine contracts

- `lib/migration/full_history_migration.v1.json` — versioned policy.
- `lib/migration/full_history_migration.js` — plan/resume/pre-write/reconciliation engine.
- `tests/full_history_migration_contract_test.js` — interruption/resume/idempotency synthetic drill.
- `tests/mig010_existing_target_preflight_contract_test.js` — existing target `CORE_MISMATCH`/provenance drift blocks accidental INSERT.
- `tests/mig010_plan_privacy_contract_test.js` — plan object не возвращает raw source records.
- `tools/mig010-owner.js` — owner-local privacy boundary.
- `tools/mig010-private-mapper.example.js` — public-safe functional template без private selectors.
- `tests/mig010_private_mapper_example_contract_test.js` — split expense/income mapping + provenance preflight на synthetic backup.
- `tests/mig010_owner_tool_contract_test.js` — encrypted-backup binding/stdout/private-path/write-disabled contract.

## Owner-private files

Следующие файлы должны находиться **вне Git repository** и не передаваться в GitHub/chat:

- encrypted `.prhbackup`;
- backup encryption key;
- настроенная private mapper copy;
- generated private snapshot;
- migration resume secret;
- migration private state;
- future irreversible authorization file;
- private reconciliation details.

Owner tool технически отклоняет private mapper/snapshot/state/secret внутри repository tree.

## Functional private mapper template

Tracked `tools/mig010-private-mapper.example.js` не содержит owner-private sheet names, values или dimension mappings. Перед запуском он копируется **вне repo**. Настроенная копия получает selectors только через локальные environment variables:

- `MIG010_REPO_ROOT` — exact local checkout текущей MIG-010 ветки;
- `MIG010_SOURCE_SHEET` — private legacy source sheet selector;
- `MIG010_TARGET_SHEET` — private current target selector;
- `MIG010_SOURCE_LABEL` — optional provenance label; default = source selector;
- `MIG010_CURRENCY` — ISO-4217 currency; default `RUB`.

Значения этих variables не публикуются в GitHub evidence. Template:

- проверяет generic legacy split-form headers без owner-specific personal fields;
- расход читает из expense field group, доход — из income field group;
- строит private deterministic account/category IDs из normalized labels только внутри snapshot;
- восстанавливает DATA-001 source provenance из current target source/reference fields;
- использует `CONTENT_FINGERPRINT_V1` canonical identity;
- не выводит labels/amounts/descriptions в stdout.

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

Рабочая copy mapper не коммитится. Source history преобразуется в DATA-001 `SOURCE-TRANSFORM-v1`, current target — в `PRH_CANONICAL_TRANSACTION_V1` с исходной migration provenance, а не с storage provenance Google row.

## Dry-run

Dry-run требует:

1. private snapshot;
2. `DR-001-EVIDENCE-v1` с `status=PASS`, `checksum=PASS` и encrypted backup SHA-256;
3. локальный 32-byte resume secret;
4. owner-private state path.

Snapshot содержит encrypted backup SHA-256. Dry-run разрешён только если этот SHA совпадает с DR evidence.

Перед построением INSERT batch выполняется **existing-target preflight**: каждая уже существующая target запись, относящаяся к migrating source, должна точно совпасть с source core/provenance. `CORE_MISMATCH`, `SOURCE_MISSING`, `SOURCE_ROW_MOVED`, duplicate/ref ambiguity блокируют весь plan. Это не позволяет ошибочно превратить уже существующую, но искажённую строку в новый INSERT.

Затем deterministic plan классифицирует:

- `REUSE` — source уже представлен ровно одним clean canonical fingerprint;
- `INSERT` — новый однозначный source;
- `BLOCK` — duplicate/invalid/mismatch/provenance ambiguity.

Invalid source quality прерывает plan до создания batch. Если существует любой blocking reason, write batches не создаются.

## Deterministic batching

Для READY plan:

- порядок: `source_fingerprint ASC`;
- batch size `1..100`;
- idempotency key: `MIG010:<plan_hash>:<batch_index>`;
- каждый batch требует exact `expected_revision`;
- resume token = HMAC-SHA256 over `plan_hash + next_batch + expected_revision`;
- изменение target между batches блокирует resume.

Plan object не содержит `source_records`/`private_source_records`; raw input остаётся только в owner-private snapshot, а private batch payload — только в owner-private state.

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
