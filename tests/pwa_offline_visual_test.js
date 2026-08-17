'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

function expect(condition, message) { if (!condition) throw new Error(message); }

const ROOT = path.join(__dirname, '..');
const PWA_ROOT = path.join(ROOT, 'pwa');
const ARTIFACTS = path.join(ROOT, 'artifacts');
const PROGRESS_PATH = path.join(ARTIFACTS, 'pwa-offline-progress.json');
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000, maxHeight: 1700 },
  { name: 'laptop', width: 1024, height: 900, maxHeight: 1900 },
  { name: 'mobile', width: 390, height: 844, maxHeight: 2600 }
];

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.webmanifest')) return 'application/manifest+json; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml; charset=utf-8';
  return 'application/octet-stream';
}

function writeProgress(stage, details = {}) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify({
    schema: 'PRH_PWA_OFFLINE_PROGRESS_V1',
    privacy_class: 'PUBLIC_SYNTHETIC',
    stage,
    ...details
  }, null, 2));
}

function makeServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/pwa/api/private/finance/summary') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ synthetic_private: 'NETWORK_ONLY_TEST_PAYLOAD' }));
      return;
    }
    if (!url.pathname.startsWith('/pwa/')) {
      res.writeHead(404); res.end('not found'); return;
    }
    let relative = url.pathname.slice('/pwa/'.length);
    if (!relative) relative = 'index.html';
    const normalized = path.normalize(relative).replace(/^([.][.][\\/])+/, '');
    const file = path.join(PWA_ROOT, normalized);
    if (!file.startsWith(PWA_ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end('not found'); return;
    }
    const headers = { 'content-type': contentType(file), 'cache-control': 'no-store' };
    if (normalized === 'service-worker.js') headers['service-worker-allowed'] = '/pwa/';
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  });
}

async function closeServer(instance) {
  if (!instance) return;
  await new Promise((resolve, reject) => instance.close((error) => error ? reject(error) : resolve()));
}

async function cacheSnapshot(page) {
  return page.evaluate(async () => {
    const names = await caches.keys();
    const entries = [];
    for (const name of names) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      for (const request of keys) entries.push({ cache: name, url: request.url });
    }
    return { names, entries };
  });
}

let server = null;
let browser = null;
let context = null;
let page = null;
let stage = 'BOOT';

(async () => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  writeProgress(stage);

  stage = 'SERVER_LISTEN';
  server = makeServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/pwa/`;
  const privateUrl = `${base}api/private/finance/summary`;
  writeProgress(stage, { server: 'LISTENING' });

  stage = 'BROWSER_LAUNCH';
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'allow' });
  page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  writeProgress(stage, { browser: 'READY' });

  stage = 'SERVICE_WORKER_CONTROL';
  await page.goto(`${base}index.html`, { waitUntil: 'load' });
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  expect(pageErrors.length === 0, `PWA startup errors: ${pageErrors.join(' | ')}`);
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  expect(controlled, 'Service worker must control the PWA page after reload');
  writeProgress(stage, { controlled });

  stage = 'ONLINE_PRIVATE_NETWORK_ONLY';
  const onlinePrivate = await page.evaluate((url) => fetch(url, { credentials: 'include' }).then((response) => response.json()), privateUrl);
  expect(onlinePrivate.synthetic_private === 'NETWORK_ONLY_TEST_PAYLOAD', 'Online private route fixture failed');
  writeProgress(stage, { private_request: 'NETWORK_OK' });

  stage = 'ONLINE_CACHE_SNAPSHOT';
  const onlineCache = await cacheSnapshot(page);
  const shellEntries = onlineCache.entries.filter((entry) => entry.cache === 'prh-pwa-shell-v1');
  const pwaCacheNames = onlineCache.names.filter((name) => name.startsWith('prh-pwa-shell-'));
  const privateEntries = onlineCache.entries.filter((entry) => /\/api\/|\/private\/|\/finance\//i.test(new URL(entry.url).pathname));
  writeProgress(stage, {
    cache_names: onlineCache.names,
    shell_entry_count: shellEntries.length,
    pwa_cache_count: pwaCacheNames.length,
    private_cache_entry_count: privateEntries.length,
    shell_paths: shellEntries.map((entry) => new URL(entry.url).pathname).sort()
  });
  expect(shellEntries.length === 5, `Expected exactly 5 shell cache entries, got ${shellEntries.length}`);
  expect(pwaCacheNames.length === 1, 'Only current versioned shell cache may remain');
  expect(!onlineCache.entries.some((entry) => entry.url === privateUrl), 'Private endpoint must never enter CacheStorage');
  expect(privateEntries.length === 0, 'Private-path cache entry detected');

  // Simulate a real origin outage rather than relying on Playwright offline emulation.
  // Chromium may let service-worker-initiated fetches bypass context.setOffline(), which
  // would test the emulator instead of the NETWORK_ONLY cache policy. Closing the origin
  // makes both navigation fallback and private network failure deterministic.
  stage = 'ORIGIN_OUTAGE';
  await closeServer(server);
  server = null;
  writeProgress(stage, { origin: 'CLOSED' });

  stage = 'OFFLINE_SHELL';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.panel');
  const offlineText = await page.textContent('body');
  expect(offlineText.includes('Безопасная offline-оболочка'), 'Offline shell content unavailable');
  expect(offlineText.includes('NOT_PROVEN_CURRENT_HOST'), 'Apps Script hosting boundary missing offline');
  writeProgress(stage, { offline_shell: true, outage_method: 'ORIGIN_CLOSED' });

  stage = 'OFFLINE_PRIVATE_NETWORK_ONLY';
  const privateOfflineFailed = await page.evaluate(async (url) => {
    try { await fetch(url, { credentials: 'include' }); return false; } catch (error) { return true; }
  }, privateUrl);
  expect(privateOfflineFailed, 'Offline private request must fail instead of using stale cache');
  const afterOffline = await cacheSnapshot(page);
  expect(!afterOffline.entries.some((entry) => entry.url === privateUrl), 'Offline private request must not populate cache');
  writeProgress(stage, { private_offline_failed: true, private_cache_entries: 0, outage_method: 'ORIGIN_CLOSED' });

  stage = 'RESPONSIVE';
  const responsive = [];
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(50);
    const layout = await page.evaluate((maxHeight) => {
      const root = document.documentElement;
      const body = document.body;
      const clipped = Array.from(document.querySelectorAll('.hero,.panel,.status,.item,.boundary'))
        .filter((element) => element.scrollWidth > element.clientWidth + 3 || element.scrollHeight > element.clientHeight + 3)
        .map((element) => element.textContent.trim().replace(/\s+/g, ' ').slice(0, 100));
      return {
        overflow: Math.max(root.scrollWidth, body.scrollWidth) - innerWidth,
        pageHeight: Math.max(root.scrollHeight, body.scrollHeight),
        maxHeight,
        clipped,
        panels: document.querySelectorAll('.panel').length,
        items: document.querySelectorAll('.item').length
      };
    }, viewport.maxHeight);
    expect(layout.overflow <= 1, `[${viewport.name}] horizontal overflow ${layout.overflow}`);
    expect(layout.pageHeight <= layout.maxHeight, `[${viewport.name}] page too tall ${layout.pageHeight}`);
    expect(layout.clipped.length === 0, `[${viewport.name}] clipped: ${layout.clipped.join('; ')}`);
    expect(layout.panels === 1 && layout.items === 2, `[${viewport.name}] shell components missing`);
    responsive.push({ name: viewport.name, overflow: layout.overflow, pageHeight: layout.pageHeight });
    await page.screenshot({ path: path.join(ARTIFACTS, `pwa-offline-${viewport.name}.png`), fullPage: true });
    writeProgress(stage, { viewport: viewport.name, responsive });
  }

  stage = 'COMPLETE';
  await browser.close();
  browser = null;

  const evidence = {
    schema: 'PRH_PWA_OFFLINE_EVIDENCE_V1',
    privacy_class: 'PUBLIC_SYNTHETIC',
    cache_version: 'prh-pwa-shell-v1',
    controlled,
    offline_shell: true,
    outage_method: 'ORIGIN_CLOSED',
    cached_shell_count: shellEntries.length,
    private_cache_entries: 0,
    private_offline_network_only: privateOfflineFailed,
    current_apps_script_host_activation: 'NOT_PROVEN_CURRENT_HOST',
    responsive,
    status: 'PASS',
    reason_code: null
  };
  fs.writeFileSync(path.join(ARTIFACTS, 'pwa-offline-evidence.json'), JSON.stringify(evidence, null, 2));
  writeProgress(stage, { status: 'PASS', outage_method: 'ORIGIN_CLOSED' });
  console.log('pwa_offline_visual_test: OK', evidence);
})().catch(async (error) => {
  try {
    writeProgress(stage, {
      status: 'FAIL',
      reason_code: 'PWA_OFFLINE_TEST_FAILED',
      error_name: String(error && error.name || 'Error').slice(0, 80),
      error_message: String(error && error.message || error || 'unknown').slice(0, 500)
    });
  } catch (writeError) {
    // Keep original error authoritative.
  }
  try { if (browser) await browser.close(); } catch (ignore) {}
  try { if (server) await closeServer(server); } catch (ignore) {}
  console.error(error);
  process.exitCode = 1;
});
