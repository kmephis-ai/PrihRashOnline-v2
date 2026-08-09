# ADR-MIG-010 — bounded carry-forward owner repair proposal

- Статус: Accepted for MIG-010 candidate
- Roadmap: MIG-010
- Current repair policy: `MIG010_REPAIR_POLICY_V1@1.1.0`
- Compatible private proposal policies: `1.0.0`, `1.1.0`
- Write authority: false

## Контекст

Owner duplicate decision является финансовой семантикой и не должен требовать повторного выбора только потому, что реализация repair layer получила новую безопасную capability. Policy v1.1.0 добавила `CONTENT_FINGERPRINT_OCCURRENCE_V1` как технический способ представить ранее существующее решение `PRESERVE_ALL` без потери одинаковых реальных операций.

Private proposal/resolution, сформированные при policy v1.0.0, уже связаны exact `proposal_hash` и `source_revision`. Перегенерация review без необходимости увеличивает риск человеческой ошибки и не добавляет новой финансовой информации.

## Решение

Current repair engine принимает только:

- `MIG010_REPAIR_POLICY_V1@1.0.0` proposal;
- `MIG010_REPAIR_POLICY_V1@1.1.0` proposal.

Carry-forward разрешён только если одновременно совпадают:

- proposal schema `MIG010_OWNER_PRIVATE_REPAIR_PROPOSAL_V1`;
- `policy_schema=MIG010_REPAIR_POLICY_V1`;
- `strategy=REBUILD_LEGACY_SLICE_V1`;
- exact `proposal_hash`;
- exact `source_revision`;
- валидный target revision;
- owner resolution с теми же exact proposal/source bindings.

Неизвестная policy version fail-closed с `MIG010_REPAIR_PROPOSAL_POLICY_INCOMPATIBLE`.

## Семантика `PRESERVE_ALL`

Carry-forward не переинтерпретирует owner decision. `PRESERVE_ALL` в proposal v1.0 означает то же, что в v1.1: одинаковые source records являются отдельными реальными операциями и ни одна не должна быть потеряна.

Policy v1.1 меняет только representation: вместо прежнего технического blocker используется owner-confirmed `CONTENT_FINGERPRINT_OCCURRENCE_V1`.

## Safety

- proposal/resolution не публикуются;
- carry-forward не создаёт write authority;
- engine не переписывает proposal hash/source revision;
- stale/tampered/unknown proposal блокируется;
- resolved candidate после carry-forward обязан пройти отдельный `tools/mig010-rebuild-dry-run.js verify`;
- real write по-прежнему требует отдельный `IRREVERSIBLE_ACTION_AUTHORIZED`.
