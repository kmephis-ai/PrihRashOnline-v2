# MIG-010 — deterministic full-history migration

`roadmap_id: MIG-010`  
`protocol: PRH_FULL_HISTORY_MIGRATION_V1`  
`owner tool: tools/mig010-owner.js`

## Назначение

MIG-010 переносит полную историю только через deterministic, resumable и idempotent protocol поверх `PRH_TRANSACTION_REPOSITORY_V1`. Публичный репозиторий содержит code, synthetic tests и privacy-safe evidence contract; реальные household-finance строки остаются только в owner-private execution environment.

**Merge кода MIG-010 не является разрешением на массовую запись.** Первый real write — отдельное irreversible action и требует явного owner authorization после успешного private dry-run/rebuild verification и свежего DR-001 backup evidence.

## State machine

```text
CODE_READY
  -> OWNER_PRIVATE_SNAPSHOT
  -> OWNER_DRY_RUN
       -> BLOCKED
            -> OWNER_PRIVATE_DIAGNOSTICS
            -> REPAIR_PROPOSAL
            -> DUPLICATE_OWNER_REVIEW (если требуется)
            -> REPAIR_RESOLVE
            -> RESOLVED_REBUILD_DRY_RUN
            -> AUTHORIZATION_REQUIRED
       -> READY
            -> AUTHORIZATION_REQUIRED
  -> BATCHING (<=100)
  -> PRIVATE_RECONCILIATION
  -> OWNER_VERIFIED
```

Любой `BLOCK`, existing-target core/provenance drift, unresolved duplicate decision, stale target revision, stale/mismatched backup, повреждённый resume/resolution binding или `unexplainedMismatch != 0` останавливает процесс fail-closed.

## Public machine contracts

- `lib/migration/full_history_migration.v1.json` — versioned policy.
- `lib/migration/full_history_migration.js` — plan/resume/pre-write/reconciliation engine.
- `lib/migration/mig010_repair_policy.v1.json` — owner-private repair/rebuild policy.
- `lib/migration/mig010_repair_policy.js` — deterministic proposal/resolution/occurrence candidate engine.
- `tests/full_history_migration_contract_test.js` — interruption/resume/idempotency synthetic drill.
- `tests/mig010_existing_target_preflight_contract_test.js` — existing target `CORE_MISMATCH`/provenance drift blocks accidental INSERT.
- `tests/mig010_plan_privacy_contract_test.js` — plan object не возвращает raw source records.
- `tests/mig010_occurrence_identity_contract_test.js` — owner-confirmed identical operations сохраняются через `CONTENT_FINGERPRINT_OCCURRENCE_V1` без изменения FIN-TRUTH.
- `tests/mig010_repair_policy_compatibility_contract_test.js` — exact-bound owner proposal v1.0/v1.1 compatibility.
- `tools/mig010-owner.js` — owner-local privacy boundary: snapshot/dry-run/state/diagnostics; write disabled.
- `tools/mig010-repair.js` — owner-local repair proposal/review/resolve; write disabled.
- `tools/mig010-rebuild-dry-run.js` — owner-local resolved candidate verification; write disabled.
- `tools/mig010-private-mapper.example.js` — public-safe functional template без private selectors.
- `tests/mig010_private_mapper_example_contract_test.js` — split expense/income mapping + provenance preflight на synthetic backup.
- `tests/mig010_owner_tool_contract_test.js` — encrypted-backup binding/stdout/private-path/write-disabled contract.
- `tests/mig010_owner_diagnostics_contract_test.js` — exact-plan-bound private diagnostic report; public stdout содержит только reason codes/hashes.
- `tests/mig010_rebuild_dry_run_contract_test.js` — resolved/proposal/resolution exact binding + canonical/fingerprint verification.

## Owner-private files

Следующие файлы должны находиться **вне Git repository** и не передаваться в GitHub/chat:

- encrypted `.prhbackup`;
- backup encryption key;
- настроенная private mapper copy;
- generated private snapshot;
- migration resume secret;
- migration private state;
- private blocker diagnostic report;
- private repair proposal/review/resolution/resolved candidate;
- future irreversible authorization file;
- private reconciliation details.

Owner tools технически отклоняют private mapper/snapshot/state/diagnostic/repair files/secret внутри repository tree.

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
- использует обычный `CONTENT_FINGERPRINT_V1` для недублированных source records;
- не выводит labels/amounts/descriptions в stdout.

Compatibility wrapper `tools/mig010-private-mapper-leading-columns.example.js` принимает только известные timestamp aliases и bounded empty leading columns. Legacy target row с migrating provenance, но пустым timestamp, не чинится автоматически: только внутри dry-run mapper подставляет diagnostic RFC3339 sentinel, чтобы reconciliation мог классифицировать anomaly и заблокировать write. Workbook/backup не изменяются.

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

## Initial dry-run

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

Malformed source формирует `SOURCE_INVALID` и блокирует batches. Полностью структурный source с explicit invalid quality также fail-closed до write. Если существует любой blocking reason, write batches не создаются.

## Owner-private blocker diagnostics

Если dry-run возвращает `BLOCKED`, command:

```text
node tools/mig010-owner.js diagnose --snapshot <private> --state <private> --out <private>
```

пересчитывает exact migration plan из snapshot и сравнивает plan/source/target hashes с private state. При любом binding mismatch diagnostic не создаётся.

Private diagnostic file `MIG010_OWNER_PRIVATE_DIAGNOSTIC_V1` может содержать только owner-local technical reconciliation details, необходимые для repair policy: source/target indexes, source provenance locators, transaction IDs, fingerprint, reason code, названия несовпавших core fields и private summary. Реальные значения core fields, amounts/categories/descriptions в публичный stdout не выводятся.

Публичный stdout `MIG010_OWNER_DIAGNOSTIC_V1` содержит только:

- `status=DIAGNOSTIC_WRITTEN`;
- exact `planHash`;
- bounded `blockedReasons`;
- флаги `diagnosticWritten=true`, `detailedFindingsStdout=false`, `financialPayloadStdout=false`, `writeAuthorized=false`.

Diagnostic mode не является repair/write mode. Он не изменяет Google Sheets, backup, snapshot или migration state.

## Repair proposal / owner resolution

`tools/mig010-repair.js propose` строит только owner-private proposal и при необходимости offline duplicate review HTML. `CORE_MISMATCH`/legacy `SOURCE_MISSING`/`SOURCE_ROW_MOVED` предлагаются к scoped legacy-slice rebuild; `SOURCE_INVALID` остаётся explained quarantine.

`SOURCE_DUPLICATE` требует owner decision:

- `DEDUPLICATE_KEEP_ONE` — подтверждённая повторная отправка;
- `PRESERVE_ALL` — подтверждённые разные реальные операции;
- `UNRESOLVED` — fail-closed.

При `PRESERVE_ALL` текущая repair policy v1.1 создаёт `CONTENT_FINGERPRINT_OCCURRENCE_V1`: content fingerprint сохраняется, а distinct immutable source/transaction identities строятся из deterministic occurrence ordinal. CI/AI не имеют authority выбрать `PRESERVE_ALL` самостоятельно.

Owner proposal, созданный policy v1.0, не требует повторного review: current engine принимает только exact-bound proposal policy `1.0.0` или `1.1.0` при совпадении `schema + strategy + proposal_hash + source_revision`; неизвестная версия fail-closed.

`tools/mig010-repair.js resolve` создаёт `MIG010_OWNER_PRIVATE_REPAIR_RESOLVED_V1`. Даже статус `READY_FOR_REBUILD_DRY_RUN` означает только готовность к следующей read-only проверке, не разрешение записи.

## Resolved rebuild dry-run

Перед `AUTHORIZATION_REQUIRED` обязателен:

```text
node tools/mig010-rebuild-dry-run.js verify \
  --snapshot <private> \
  --proposal <private> \
  --resolution <private> \
  --resolved <private>
```

Verifier:

- повторно вычисляет resolved state из exact snapshot + owner resolution;
- проверяет `resolved_hash`, proposal/source/target binding;
- валидирует весь canonical rebuild candidate как `PRH_CANONICAL_TRANSACTION_V1`;
- для migration identities проверяет content fingerprint parity;
- для occurrence identities доказывает distinct source identities без изменения финансовых core fields;
- вычисляет только technical candidate revision hash;
- не выводит transaction count, quarantine count или financial payload;
- не имеет `execute/write/apply` authority.

Только `MIG010_OWNER_REBUILD_DRY_RUN_V1 status=PASS`, `reconciliationReady=true`, `writeAuthorized=false` позволяет перейти к разработке/подготовке irreversible-action gate. Сам PASS **не авторизует** real write.

## Deterministic batching

Для будущего authorized READY plan/rebuild:

- batch size `1..100`;
- deterministic order;
- idempotency key связан с exact plan/rebuild hash и batch ordinal;
- каждый batch требует exact `expected_revision`;
- resume token криптографически связан с exact state;
- изменение target между batches блокирует resume.

Raw source input остаётся только owner-private; public plan/evidence не содержит source records.

## Irreversible-action gate

На текущем этапе owner/repair/rebuild tools **не содержат активной команды write**. `execute`, `write` и `apply` возвращают:

`MIGRATION_IRREVERSIBLE_ACTION_TOOL_NOT_ENABLED`

Перед включением real write должны одновременно существовать:

- owner-private rebuild dry-run `PASS`;
- fresh verified encrypted backup не старше 24 часов;
- backup SHA совпадает со snapshot/plan;
- explicit owner action `IRREVERSIBLE_ACTION_AUTHORIZED`, привязанный к exact plan/rebuild hash;
- migration-specific scoped-rebuild write adapter с idempotency, expected revision, readback и rollback semantics;
- готовность остановиться после любого batch при mismatch.

Ни GitHub Actions, ни merge PR, ни AI-agent не могут создать это разрешение автоматически.

## Reconciliation

После последнего future authorized batch и до признания migration успешной обязательно:

- повторно прочитать canonical target;
- выполнить source-to-canonical reconciliation с учётом approved occurrence identities и explained quarantine;
- `unexplainedMismatch = 0`;
- все non-quarantined source events покрыты canonical provenance;
- explained quarantine привязана к exact source/rebuild revision;
- повторный full verification не предлагает новые необъяснённые writes;
- partial/ambiguous result остаётся fail-closed.

## Public-safe evidence

В GitHub допускаются только technical schema/status/hashes/PASS-FAIL/reason codes/timing. Не публикуются counts, dates/period distributions, amounts, categories, descriptions, source positions, sheet names, mapper configuration, duplicate payload, owner resolution, resume token/secret или private reconciliation/diagnostic/repair rows.

## Rollback

До explicit irreversible authorization real workbook не меняется. После будущего authorized execution rollback authority опирается на отдельный verified encrypted DR-001 backup и batch ledger/readback. Любое необъяснённое partial состояние останавливает дальнейшие writes и требует восстановления/разбора владельцем.
