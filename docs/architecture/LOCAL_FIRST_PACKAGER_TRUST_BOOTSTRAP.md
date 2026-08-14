# PACK-LF-001 — trusted Local-first packager bootstrap

## Зачем нужен отдельный bootstrap

`Trusted DEV Deploy` не доверяет build tooling из candidate branch. Он скачивает уже собранный PR artifact, затем checkout-ит exact candidate source, но **реконструирует artifact packager-ом из trusted `main`**. Это преднамеренная защита от self-attestation: PR не может изменить упаковщик и тем же изменённым упаковщиком доказать собственную корректность.

FIN-LF-001 обнаружил этот boundary корректным fail-closed образом: PR Validation #862/#863 собрал новый Local-first artifact, а Trusted DEV Deploy #829 остановился на `CANDIDATE_VERIFY_FAILED`, потому что старый `main` packager воспроизвёл прежний artifact format.

## Двухступенчатая схема

### Шаг A — PACK-LF-001

В `main` вводится новая capability, но root marker **отсутствует**.

```text
marker absent
  -> Local-first browser packager DISABLED
  -> root .js/.html bytes идут старым путём
  -> manifest не получает localFirstBrowserRuntime
  -> old trusted main builder == candidate builder artifact
  -> trusted reconstruction может независимо PASS
```

В этом же PR tests отдельно включают marker только внутри synthetic temporary source и доказывают новую capability без изменения реального root candidate output.

### Шаг B — FIN-LF-001

Только после Main Verification PACK-LF-001 FIN branch переносится на новый `main` и добавляет explicit `local-first-browser-runtime.json`.

```text
trusted main already knows marker contract
  -> FIN candidate marker ENABLED
  -> candidate builder injects browser modules + canonical Worker
  -> trusted main builder independently performs the same injection
  -> manifests/bytes must match exactly
```

## Marker contract

Authority: `PRH_LOCAL_FIRST_BROWSER_RUNTIME_MARKER_CONTRACT_V1@1.0.0`.

Marker file: `local-first-browser-runtime.json`.

Разрешены только:

- target `LocalFirstSpaWebApp.html`;
- worker entry `pwa/local_analytics_worker_entry.js`;
- browser modules из закрытой allow-list;
- `runtime_network_required_for_warm_route=false`;
- `external_cdn_required=false`;
- `cost_class=FREE_ONLY`.

Unknown field, module, target, version или policy value блокирует build.

## Что marker не делает

Marker не выдаёт write authority, не меняет FIN-TRUTH, не создаёт network provider и не является runtime locator. Он только разрешает deterministic build-time embedding tracked repository bytes в один Apps Script HTML candidate.

## CDN / URI boundary

External runtime loaders запрещены. Canonical Worker dependency graph содержит два inert URI JSON Schema (`$schema`/`$id`); они exact-allowlisted как metadata и не являются сетевыми ресурсами. Любой новый literal HTTP URI или external loader требует явного review и по умолчанию fail-closed.

## Rollback

Удаление/отсутствие marker полностью выключает capability. PACK-LF-001 сам marker не добавляет, поэтому его trusted deployment эквивалентен прежнему artifact format и не активирует Local-first product runtime.
