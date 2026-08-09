# MIG-010 — owner-private repair/rebuild policy

`roadmap_id: MIG-010`  
`policy: MIG010_REPAIR_POLICY_V1`  
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

Canonical v1 использует `CONTENT_FINGERPRINT_V1`: source identity включает content fingerprint, а `source_position` не является immutable identity. Поэтому две полностью одинаковые source transactions имеют одну и ту же canonical source identity и не могут быть молча представлены как две разные canonical records.

Для каждой duplicate group разрешены только три owner решения:

- `DEDUPLICATE_KEEP_ONE` — владелец подтверждает, что группа содержит повторную отправку одного события, и выбирает одну source row как retained position; остальные rows остаются private quarantine с reason `OWNER_CONFIRMED_DUPLICATE_RESUBMISSION`;
- `PRESERVE_ALL` — владелец подтверждает, что это разные реальные операции; MIG-010 остаётся `BLOCKED` с `CANONICAL_IDENTITY_EXTENSION_REQUIRED`;
- `UNRESOLVED` — MIG-010 остаётся `BLOCKED` с `SOURCE_DUPLICATE_OWNER_DECISION_REQUIRED`.

GitHub CI, AI-agent и heuristic rule не имеют права автоматически выбирать `DEDUPLICATE_KEEP_ONE`.

## Offline duplicate review

`tools/mig010-repair.js propose` создаёт вне repository:

- `MIG010_OWNER_PRIVATE_REPAIR_PROPOSAL_V1`;
- опциональный self-contained private HTML review.

HTML не имеет network dependencies. Он содержит owner-private duplicate context только локально и генерирует download-файл `MIG010_OWNER_PRIVATE_REPAIR_RESOLUTION_V1`. Resolution cryptographically/logically binding включает exact `proposal_hash` и `source_revision`.

Публичный stdout не содержит amounts, dates, descriptions, source rows, counts или duplicate payload.

## Resolve

`tools/mig010-repair.js resolve` принимает private snapshot + proposal + owner resolution и создаёт `MIG010_OWNER_PRIVATE_REPAIR_RESOLVED_V1`.

Если все duplicate groups подтверждены как `DEDUPLICATE_KEEP_ONE`, resolved state содержит deterministic canonical rebuild candidate, private quarantine и scoped target replacement set, но `write_authorized=false`.

Если хотя бы одна group имеет `PRESERVE_ALL` или `UNRESOLVED`, resolved state остаётся `BLOCKED`, canonical write candidate не создаётся.

## Неизменяемые safety rules

- repair tool не имеет `execute/write/apply` authority;
- scoped rebuild не означает разрешение delete/replace;
- source/target/proposal/resolution hashes должны совпасть;
- private proposal/review/resolution/resolved state находятся вне Git repository;
- реальный first write всё ещё требует отдельный `IRREVERSIBLE_ACTION_AUTHORIZED`, свежий DR-001 backup, migration-specific adapter, readback и rollback;
- public evidence остаётся без real/derived financial payload.
