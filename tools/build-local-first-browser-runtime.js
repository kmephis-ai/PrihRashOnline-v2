'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildWorkerBundle } = require('./build-local-analytics-worker');

const MARKER_FILE = 'local-first-browser-runtime.json';
const MARKER_SCHEMA = 'PRH_LOCAL_FIRST_BROWSER_RUNTIME_MARKER_V1';
const MARKER_VERSION = '1.0.0';
const TARGET_HTML = 'LocalFirstSpaWebApp.html';
const PLACEHOLDER = '<!-- PRH_LOCAL_FIRST_BROWSER_RUNTIME -->';
const RUNTIME_SCHEMA = 'PRH_LOCAL_FIRST_BROWSER_RUNTIME_BUNDLE_V1';
const RUNTIME_VERSION = '1.0.0';
const WORKER_ENTRY = 'pwa/local_analytics_worker_entry.js';
const HISTORY_RESTORE_APP_MARKER = 'data-prh-local-first-spa="1"';
const HISTORY_RESTORE_LEGACY = "window.addEventListener('popstate',function(){render(routeFromUrl(),true)});";
const HISTORY_RESTORE_REPAIRED = "window.addEventListener('popstate',function(){navigate(routeFromUrl(),{fromPopstate:true,history:false,focusMain:false})});";
const ALLOWED_BROWSER_MODULES = Object.freeze([
  'pwa/local_read_model_store.js',
  'pwa/local_first_sync.js',
  'pwa/local_first_delta.js',
  'pwa/local_finance_runtime.js',
  'pwa/local_first_performance.js'
]);
const ALLOWED_INERT_HTTP_URIS = Object.freeze([
  'https://github.com/kmephis-ai/PrihRashOnline-v2/lib/domain/canonical_transaction.v1.schema.json',
  'https://json-schema.org/draft/2020-12/schema'
]);
const MARKER_KEYS = Object.freeze([
  'cost_class',
  'enabled',
  'external_cdn_required',
  'modules',
  'runtime_network_required_for_warm_route',
  'schema',
  'target_html',
  'version',
  'worker_entry'
]);

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sameKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify(Array.from(expected).sort());
}

function safeRegularFile(root, relative) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relative);
  const expectedPrefix = resolvedRoot + path.sep;
  if (!resolved.startsWith(expectedPrefix)) fail('LOCAL_FIRST_RUNTIME_PATH_ESCAPE');
  if (!fs.existsSync(resolved)) fail(`LOCAL_FIRST_RUNTIME_FILE_MISSING:${relative}`);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`LOCAL_FIRST_RUNTIME_FILE_INVALID:${relative}`);
  return resolved;
}

function escapeScriptSource(source) {
  return String(source).replace(/<\/script/gi, '<\\/script');
}

function normalizeMarker(marker) {
  if (!sameKeys(marker, MARKER_KEYS)) fail('LOCAL_FIRST_RUNTIME_MARKER_SHAPE_INVALID');
  if (marker.schema !== MARKER_SCHEMA || marker.version !== MARKER_VERSION || marker.enabled !== true) {
    fail('LOCAL_FIRST_RUNTIME_MARKER_IDENTITY_INVALID');
  }
  if (marker.target_html !== TARGET_HTML || marker.worker_entry !== WORKER_ENTRY) {
    fail('LOCAL_FIRST_RUNTIME_MARKER_TARGET_INVALID');
  }
  if (marker.runtime_network_required_for_warm_route !== false || marker.external_cdn_required !== false || marker.cost_class !== 'FREE_ONLY') {
    fail('LOCAL_FIRST_RUNTIME_MARKER_POLICY_INVALID');
  }
  if (!Array.isArray(marker.modules) || marker.modules.length === 0 || new Set(marker.modules).size !== marker.modules.length) {
    fail('LOCAL_FIRST_RUNTIME_MARKER_MODULES_INVALID');
  }
  const allowed = new Set(ALLOWED_BROWSER_MODULES);
  for (const modulePath of marker.modules) {
    if (!allowed.has(modulePath)) fail(`LOCAL_FIRST_RUNTIME_MODULE_FORBIDDEN:${modulePath}`);
  }
  return Object.freeze({
    schema: marker.schema,
    version: marker.version,
    enabled: true,
    target_html: marker.target_html,
    modules: Object.freeze(marker.modules.slice()),
    worker_entry: marker.worker_entry,
    runtime_network_required_for_warm_route: false,
    external_cdn_required: false,
    cost_class: 'FREE_ONLY'
  });
}

function localFirstBrowserRuntimeConfig(sourceRoot) {
  const markerPath = path.join(path.resolve(sourceRoot), MARKER_FILE);
  if (!fs.existsSync(markerPath)) return Object.freeze({ enabled: false, marker: null });
  const stat = fs.lstatSync(markerPath);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('LOCAL_FIRST_RUNTIME_MARKER_FILE_INVALID');
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  } catch (error) {
    fail('LOCAL_FIRST_RUNTIME_MARKER_JSON_INVALID');
  }
  return Object.freeze({ enabled: true, marker: normalizeMarker(parsed) });
}

function embeddedHttpUris(text) {
  return Array.from(String(text).matchAll(/https?:\/\/[^\s'"<\\]+/gi), (match) => match[0]);
}

function assertNoExternalRuntimeLoaders(text) {
  const source = String(text);
  const uris = Array.from(new Set(embeddedHttpUris(source))).sort();
  const allowed = Array.from(ALLOWED_INERT_HTTP_URIS).filter((uri) => uris.includes(uri)).sort();
  if (JSON.stringify(uris) !== JSON.stringify(allowed)) fail('LOCAL_FIRST_RUNTIME_HTTP_URI_FORBIDDEN');
  const forbidden = [
    /<(?:script|link)\b[^>]*(?:src|href)\s*=\s*["']https?:\/\//i,
    /\b(?:fetch|importScripts)\s*\(\s*["']https?:\/\//i,
    /\bnew\s+(?:Worker|SharedWorker|WebSocket)\s*\(\s*["']https?:\/\//i,
    /\.open\s*\(\s*["'][A-Z]+["']\s*,\s*["']https?:\/\//i
  ];
  if (forbidden.some((pattern) => pattern.test(source))) fail('LOCAL_FIRST_RUNTIME_EXTERNAL_LOADER_FORBIDDEN');
  return Object.freeze({ inert_http_uris: Object.freeze(allowed) });
}

function buildLocalFirstRuntimeInjection(options = {}) {
  const repositoryRoot = path.resolve(options.repositoryRoot || path.resolve(__dirname, '..'));
  const marker = normalizeMarker(options.marker || {});
  const moduleRecords = marker.modules.map((relative) => {
    const bytes = fs.readFileSync(safeRegularFile(repositoryRoot, relative));
    return Object.freeze({
      path: relative,
      sha256: sha256(bytes),
      size: bytes.length,
      source: bytes.toString('utf8')
    });
  });
  const worker = buildWorkerBundle({ root: repositoryRoot, entry: marker.worker_entry });
  if (!worker || worker.schema !== 'PRH_LOCAL_ANALYTICS_WORKER_BUNDLE_V1' || !worker.source) {
    fail('LOCAL_FIRST_RUNTIME_WORKER_BUNDLE_INVALID');
  }
  const workerSha256 = sha256(Buffer.from(worker.source, 'utf8'));
  const identity = {
    schema: RUNTIME_SCHEMA,
    version: RUNTIME_VERSION,
    marker_schema: marker.schema,
    marker_version: marker.version,
    modules: moduleRecords.map((record) => ({ path: record.path, sha256: record.sha256, size: record.size })),
    worker: {
      schema: worker.schema,
      entry: worker.entry,
      sha256: workerSha256,
      module_count: worker.module_ids.length
    }
  };
  const identityJson = JSON.stringify(identity);
  const runtimeSha256 = sha256(Buffer.from(identityJson, 'utf8'));
  const lines = [
    `<script data-prh-local-first-runtime="${RUNTIME_VERSION}" data-runtime-sha256="${runtimeSha256}">`,
    `'use strict';`,
    `window.__PRH_LF_BROWSER_RUNTIME_IDENTITY__=Object.freeze(${identityJson});`,
    `window.__PRH_LF_WORKER_BUNDLE_SOURCE__=${JSON.stringify(worker.source)};`
  ];
  moduleRecords.forEach((record) => {
    lines.push(`/* BEGIN TRACKED MODULE ${record.path} ${record.sha256} */`);
    lines.push(escapeScriptSource(record.source));
    lines.push(`/* END TRACKED MODULE ${record.path} */`);
  });
  lines.push('</script>');
  const html = lines.join('\n');
  const networkPolicy = assertNoExternalRuntimeLoaders(html);
  return Object.freeze({
    schema: RUNTIME_SCHEMA,
    version: RUNTIME_VERSION,
    marker_schema: marker.schema,
    marker_version: marker.version,
    runtime_sha256: runtimeSha256,
    worker_sha256: workerSha256,
    worker_module_count: worker.module_ids.length,
    modules: Object.freeze(identity.modules.map(Object.freeze)),
    inert_http_uris: networkPolicy.inert_http_uris,
    html
  });
}

function applyHistoryRestoreRepair(htmlInput) {
  const html = String(htmlInput || '');
  if (!html.includes(HISTORY_RESTORE_APP_MARKER)) return html;
  const legacyCount = html.split(HISTORY_RESTORE_LEGACY).length - 1;
  const repairedCount = html.split(HISTORY_RESTORE_REPAIRED).length - 1;
  if (legacyCount === 1 && repairedCount === 0) {
    return html.replace(HISTORY_RESTORE_LEGACY, HISTORY_RESTORE_REPAIRED);
  }
  if (legacyCount === 0 && repairedCount === 1) return html;
  fail('LOCAL_FIRST_HISTORY_RESTORE_HANDLER_INVALID');
}

function injectIntoHtml(htmlInput, runtime) {
  const html = applyHistoryRestoreRepair(htmlInput);
  const count = html.split(PLACEHOLDER).length - 1;
  if (count !== 1) fail('LOCAL_FIRST_RUNTIME_PLACEHOLDER_COUNT_INVALID');
  if (!runtime || runtime.schema !== RUNTIME_SCHEMA || runtime.version !== RUNTIME_VERSION || !runtime.html) {
    fail('LOCAL_FIRST_RUNTIME_INJECTION_INVALID');
  }
  const injected = html.replace(PLACEHOLDER, runtime.html);
  assertNoExternalRuntimeLoaders(runtime.html);
  return injected;
}

module.exports = Object.freeze({
  MARKER_FILE,
  MARKER_SCHEMA,
  MARKER_VERSION,
  TARGET_HTML,
  PLACEHOLDER,
  RUNTIME_SCHEMA,
  RUNTIME_VERSION,
  WORKER_ENTRY,
  HISTORY_RESTORE_APP_MARKER,
  HISTORY_RESTORE_LEGACY,
  HISTORY_RESTORE_REPAIRED,
  ALLOWED_BROWSER_MODULES,
  ALLOWED_INERT_HTTP_URIS,
  localFirstBrowserRuntimeConfig,
  normalizeMarker,
  buildLocalFirstRuntimeInjection,
  assertNoExternalRuntimeLoaders,
  applyHistoryRestoreRepair,
  injectIntoHtml
});
