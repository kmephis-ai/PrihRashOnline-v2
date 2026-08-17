# MIG-010 — owner-private repair/rebuild policy

`roadmap_id: MIG-010`  
`policy: MIG010_REPAIR_POLICY_V1@1.1.0`  
`strategy: REBUILD_LEGACY_SLICE_V1`  
`write_authority: false`

## Зачем нужен repair stage

Owner-private full-history dry-run может корректно завершиться `BLOCKED`. Это не повод ослаблять DATA-001/DATA-010 gates. Repair stage объясняет legacy anomalies и строит новый private rebuild candidate, но **не изменяет Google Sheets**.

Current flow:

```text
OWNER_DRY_RUN = BLOCKED
  -> OWNER_PRIVATE_DIAGNOSTICS
  -> REPAIR_PROPOSAL
  -> DUPLICATE_OWNER_REVIEW (только если требуется)
  -> REPAIR_RESOLVE
  -> RESOLVED_REBUILD_DRY_RUN
  -> AUTHORIZATION_REQUIRED
```

## Базовая стратегия

Старый частичный DEV-import не является источником финансовой истины. Источник для legacy history — owner-private source snapshot, привязанный к verified encrypted DR-001 backup. Поэтому repair strategy не исправляет случайные legacy target rows по одной: она строит proposal на **пересборку только target slice, принадлежащего migrating legacy source**.

Записи target, не входящие в этот source scope, repair proposal не затрагивает.

`CORE_MISMATCH`, `SOURCE_MISSING` и `SOURCE_ROW_MOVED` в scoped old target считаются repairable только через `REBUILD_SCOPED_TARGET`. Это proposal, а не write authority.

## SOURCE_INVALID

Malformed/incomplete source row не превращается в придуманную финансовую операцию и не удаляется из private evidence. Policy:

`SOURCE_INVALID -> QUARANTINE_EXPLAINED`

Quarantine остаётся owner-private и привязана к source revision / repair hash. Такая строка не создаёт canonical financial write. При будущей reconciliation она должна быть учтена как объяснённое исключение, а не как unexplained loss.

## SOURCE_DUPLICATE

Обычный DATA-001 path использует `CONTENT_FINGERPRINT_V1`: source identity включает content fingerprint, а `source_position` не является immutable identity. Поэтому duplicate group никогда не разрешается автоматически.

Для каждой duplicate group разрешены только три owner решения:

- `DEDUPLICATE_KEEP_ONE` — владелец подтверждает повторную отправку одного события и выбирает retained source row; остальные rows остаются private quarantine с reason `OWNER_CONFIRMED_DUPLICATE_RESUBMISSION`;
- `PRESERVE_ALL` — владелец подтверждает, что одинаковые rows являются разными реальными операциями; repair использует `CONTENT_FINGERPRINT_OCCURRENCE_V1` и сохраняет каждую occurrence как отдельную canonical transaction;
- `UNRESOLVED` — MIG-010 остаётся `BLOCKED` с `SOURCE_DUPLICATE_OWNER_DECISION_REQUIRED`.

GitHub CI, AI-agent и heuristic rule не имеют права автоматически выбирать `DEDUPLICATE_KEEP_ONE` или `PRESERVE_ALL`.

### `CONTENT_FINGERPRINT_OCCURRENCE_V1`

Occurrence identity активируется только после owner `PRESERVE_ALL`.

Для members одной duplicate group:

- content `source_fingerprint` остаётся одинаковым и не модифицируется;
- members детерминированно сортируются по source row внутри exact owner-private snapshot;
- каждому member присваивается `occurrence_ordinal`;
- distinct `source_record_id` и canonical `transaction_id` строятся из fingerprint + ordinal;
- `source_position` остаётся locator, а не identity;
- финансовые поля не меняются ради различения записей;
- repeated resolve на том же source snapshot/resolution возвращает те же identities и resolved hash.

Новая strategy является backward-compatible capability extension `PRH_CANONICAL_TRANSACTION_V1`; старые `EXTERNAL_ID` и `CONTENT_FINGERPRINT_V1` не меняются.

Architecture rationale: `docs/adr/ADR-MIG-010-OCCURRENCE-IDENTITY.md`.

## Offline duplicate review

`tools/mig010-repair.js propose` создаёт вне repository:

- `MIG010_OWNER_PRIVATE_REPAIR_PROPOSAL_V1`;
- опциональный self-contained private HTML review.

HTML не имеет network dependencies. Он содержит owner-private duplicate context только локально и генерирует download-файл `MIG010_OWNER_PRIVATE_REPAIR_RESOLUTION_V1`. Resolution binding включает exact `proposal_hash` и `source_revision`.

Публичный stdout не содержит amounts, dates, descriptions, source rows, counts или duplicate payload.

## Resolve

`tools/mig010-repair.js resolve` принимает private snapshot + proposal + owner resolution и создаёт `MIG010_OWNER_PRIVATE_REPAIR_RESOLVED_V1`.

- `DEDUPLICATE_KEEP_ONE` создаёт обычный `CONTENT_FINGERPRINT_V1` candidate + quarantine для подтверждённых повторных submit rows.
- `PRESERVE_ALL` создаёт deterministic `CONTENT_FINGERPRINT_OCCURRENCE_V1` candidate для каждой подтверждённой реальной occurrence.
- `UNRESOLVED` оставляет resolved state `BLOCKED`.

Если все duplicate groups получили owner decision `DEDUPLICATE_KEEP_ONE` или `PRESERVE_ALL`, resolved state может перейти в `READY_FOR_REBUILD_DRY_RUN`, но `write_authorized=false` остаётся обязательным.

## Compatibility с уже созданным owner resolution

Owner decision семантически привязан к `proposal_hash` и `source_revision`. Policy v1.1.0 не меняет смысл `PRESERVE_ALL`: он по-прежнему означает «не удалять ни одну подтверждённую реальную операцию». Изменился только технический способ представить это решение через versioned occurrence identity.

Current engine намеренно принимает только proposal policy versions:

- `MIG010_REPAIR_POLICY_V1@1.0.0`;
- `MIG010_REPAIR_POLICY_V1@1.1.0`.

Для carry-forward обязательны exact `schema`, `strategy=REBUILD_LEGACY_SLICE_V1`, `proposal_hash`, `source_revision` и target binding. Неизвестная policy version возвращает `MIG010_REPAIR_PROPOSAL_POLICY_INCOMPATIBLE`. Старый exact owner resolution не переписывается и не требует повторного financial decision.

## Resolved rebuild dry-run

После `resolve` и до любого irreversible-action stage запускается:

```text
node tools/mig010-rebuild-dry-run.js verify \
  --snapshot <private> \
  --proposal <private> \
  --resolution <private> \
  --resolved <private>
```

Verifier повторно вычисляет repair resolution и проверяет:

- exact resolved/proposal/source/target binding;
- `PRH_CANONICAL_TRANSACTION_V1` collection invariants;
- migration fingerprint parity;
- occurrence-aware identities для `PRESERVE_ALL`;
- deterministic candidate revision hash;
- `writeAuthorized=false`.

Публичный stdout не содержит candidate/quarantine counts или financial payload. Любой tampered/stale private artifact fail-closed. `PASS` означает только `reconciliationReady=true` для следующего policy stage.

## Неизменяемые safety rules

- owner, repair и rebuild-dry-run tools не имеют `execute/write/apply` authority;
- scoped rebuild не означает разрешение delete/replace;
- source/target/proposal/resolution/resolved hashes должны совпасть;
- private proposal/review/resolution/resolved state находятся вне Git repository;
- occurrence identity не является разрешением на запись;
- реальный first write всё ещё требует отдельный `IRREVERSIBLE_ACTION_AUTHORIZED`, свежий DR-001 backup, exact rebuild hash, migration-specific adapter, readback и rollback;
- public evidence остаётся без real/derived financial payload.
