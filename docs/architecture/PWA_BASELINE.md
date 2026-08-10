# PWA-020 — installable PWA baseline

## Назначение

`PRH_PWA_BASELINE_V1@1.0.0` вводит host-neutral PWA bundle для PrihRashOnline: manifest, responsive offline shell, versioned service worker и строгую private-cache policy.

PWA-020 не меняет FIN-TRUTH, canonical transactions, Google Sheets или private Web App access policy.

## Hosting boundary

Service Worker требует поддерживаемый secure origin; `localhost` используется только как browser-test secure-context exception. Bundle спроектирован host-neutral и может быть размещён на подходящем private/static host в будущем.

Для текущего Apps Script HtmlService runtime machine state намеренно:

```text
NOT_PROVEN_CURRENT_HOST
```

PWA-020 **не утверждает**, что текущий private Apps Script Web App уже способен безопасно активировать этот service worker. Private deployment locator не публикуется, `MYSELF` boundary не меняется.

## Manifest

`pwa/manifest.webmanifest` содержит name/short_name/start_url/scope/display/background/theme и локальные 192/512 icons. Внешние CDN/font/PWA providers не требуются.

## Cache policy

Default policy = `NETWORK_ONLY`.

Только explicit shell allowlist использует `CACHE_FIRST_EXPLICIT_ALLOWLIST`:

- `./`;
- `./index.html`;
- `./manifest.webmanifest`;
- `./icons/icon-192.svg`;
- `./icons/icon-512.svg`.

Никакой runtime discovery/recursive caching нет.

Private path tokens (`/api/`, `/private/`, `/finance/`, `/dashboard/`, `/transactions/`, `/analytics/`, `/home/`, `/explorer/`) получают `NETWORK_ONLY_NO_CACHE_FALLBACK`. Offline private request должен завершиться ошибкой сети, а не stale response.

Cross-origin и non-GET requests никогда не сохраняются в CacheStorage.

Authenticated/financial response cache = forbidden.

## Update strategy

Current cache = `prh-pwa-shell-v1`.

Install precaches explicit shell. Activate удаляет старые caches с prefix `prh-pwa-shell-`, кроме current version, затем вызывает `clients.claim()`.

Stale shell cache reuse и runtime financial cache migration запрещены.

## Offline meaning

Offline shell — только безопасная статическая оболочка. Он не содержит household financial rows/totals, не подменяет private Home/TX/Analytics данные и не обещает offline financial truth.

При отсутствии сети пользователь видит shell/hosting boundary; приватные financial responses не возвращаются из cache.

## Real browser evidence

`tests/pwa_offline_visual_test.js`:

1. поднимает localhost HTTP origin;
2. загружает PWA shell в Chromium;
3. регистрирует настоящий service worker и после reload требует `navigator.serviceWorker.controller`;
4. проверяет ровно пять explicit shell cache entries;
5. выполняет synthetic private route online и доказывает отсутствие этого URL в CacheStorage;
6. переводит browser context offline;
7. повторно загружает cached shell;
8. доказывает, что private route offline падает по сети и не появляется в cache;
9. проверяет desktop/laptop/mobile layout.

Evidence public-safe и содержит только contract/cache/control/offline/count/status metadata.

## Machine evidence

- `lib/pwa/pwa_baseline.v1.json`;
- `pwa/manifest.webmanifest`;
- `pwa/service-worker.js`;
- `pwa/index.html`;
- `tests/pwa_baseline_contract_test.js`;
- `tests/pwa_offline_visual_test.js`;
- named gates `PWA baseline`, `PWA offline visual gate`.

## Privacy / cost / authority

PWA layer не владеет financial truth, canonical override, network provider, financial write или private runtime publication authority. `FREE_ONLY` mandatory; CDN/external provider/paid hosting не требуются для required evidence.

Generic Google financial write остаётся blocked with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`. Historical `IRREVERSIBLE_ACTION_AUTHORIZED` остаётся exact-bound/non-reusable и к PWA не относится.
