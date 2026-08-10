# PERF-014 — Synthetic scale performance gate

Статус: `IN_PROGRESS` до Main Verification.  
Machine contract: `PRH_SYNTHETIC_SCALE_GATE_V1@1.0.0`.  
Roadmap: `PERF-014`, dependency `PERF-013 = DONE`.

## Назначение

PERF-014 создаёт блокирующий CI guardrail на 20 000 и 50 000 independently generated synthetic canonical operations. Это regression gate инженерной производительности, а не обещание пользовательского production SLA.

Production-derived данные запрещены. Полные synthetic arrays не сохраняются как repository fixture или CI artifact: они генерируются детерминированно в памяти на каждом запуске.

## Профили и budgets

`lib/performance/synthetic_scale_gate.v1.json` фиксирует два профиля:

- `SCALE_20K` — 20 000 операций, bounded delta 100;
- `SCALE_50K` — 50 000 операций, bounded delta 250.

Для каждого профиля versioned wall-clock ceilings заданы для:

- authoritative canonical revision;
- representative ANL-010 full recompute;
- PERF-012 linked single-scan refresh;
- PERF-013 aggregate full build;
- PERF-013 incremental update;
- fresh aggregate rebuild для parity proof.

Ceilings намеренно имеют запас для shared GitHub-hosted runner variability. Их нарушение возвращает non-zero и блокирует PR. Эти значения не публикуются как UX/SLA latency promise.

## Read/write budget

PERF-012 benchmark оборачивает synthetic repository техническими счётчиками:

- canonical `readAll()` на один linked refresh cycle: ровно `1`;
- underlying financial writes: `0`;
- cycle `writeBatch()` остаётся blocked и не вызывает underlying writer.

Таким образом performance improvement не покупается ценой дополнительных write side effects.

## Correctness-first

Performance gate не заменяет correctness tests.

- revision берётся из `repositoryRevision()`;
- analytics использует ANL-010 `evaluateAnalytics()`;
- aggregate full/incremental используют PERF-013;
- после bounded delta incremental projection/state обязаны exact-match fresh full aggregate build;
- `recomputed_bucket_count == affected_bucket_count` и delta остаётся bounded.

Если оптимизация не проходит parity, latency result не имеет значения — gate красный.

## Synthetic generator

`PRH_SYNTHETIC_SCALE_FIXTURE_V1` использует deterministic LCG seed и генерирует только искусственные income/expense/refund/transfer rows с synthetic accounts/categories/members/projects/tags. Generator не читает private runtime и не использует production-derived distributions/values.

## Public-safe evidence

Разрешены:

- profile ID;
- operation/delta counts;
- elapsed milliseconds по именованным этапам;
- canonical read/write counters;
- changed/affected/recomputed bucket counts;
- PASS/FAIL.

Запрещены transaction IDs, bucket labels, financial values, canonical rows, source fingerprints и private-derived aggregates.

## Rollback

Удалить scale contract, generator, benchmark test, named CI gate и этот runbook. PERF-010..013 остаются работоспособными, но `PERF-014` и `MASTER-G3` снова считаются незавершёнными до восстановления synthetic performance evidence.
