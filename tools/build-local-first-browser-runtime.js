'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildWorkerBundle } = require('./build-local-analytics-worker');

const TARGET_HTML = 'LocalFirstSpaWebApp.html';
const PLACEHOLDER = '<!-- PRH_LOCAL_FIRST_BROWSER_RUNTIME -->';
const RUNTIME_SCHEMA = 'PRH_LOCAL_FIRST_BROWSER_RUNTIME_BUNDLE_V1';
const RUNTIME_VERSION = '1.0.0';
const TRACKED_BROWSER_MODULES = Object.freeze([
  'pwa/local_read_model_store.js',
  'pwa/local_first_sync.js',
  'pwa/local_first_delta.js',
  'pwa/local_finance_runtime.js'
]);

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeRegularFile(root, relative) {
  const resolved = path.resolve(root, relative);
  const expectedPrefix = path.resolve(root) + path.sep;
  if (!resolved.startsWith(expectedPrefix)) fail('LOCAL_FIRST_RUNTIME_PATH_ESCAPE');
  if (!fs.existsSync(resolved)) fail(`LOCAL_FIRST_RUNTIME_FILE_MISSING:${relative}`);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`LOCAL_FIRST_RUNTIME_FILE_INVALID:${relative}`);
  return resolved;
}

function escapeScriptSource(source) {
  return String(source).replace(/<\/script/gi, '<\\/script');
}

function buildLocalFirstRuntimeInjection(options = {}) {
  const repositoryRoot = path.resolve(options.repositoryRoot || path.resolve(__dirname, '..'));
  const moduleRecords = TRACKED_BROWSER_MODULES.map((relative) => {
    const bytes = fs.readFileSync(safeRegularFile(repositoryRoot, relative));
    return Object.freeze({
      path: relative,
      sha256: sha256(bytes),
      size: bytes.length,
      source: bytes.toString('utf8')
    });
  });
  const worker = buildWorkerBundle({ root: repositoryRoot });
  if (!worker || worker.schema !== 'PRH_LOCAL_ANALYTICS_WORKER_BUNDLE_V1' || !worker.source) {
    fail('LOCAL_FIRST_RUNTIME_WORKER_BUNDLE_INVALID');
  }
  const workerSha256 = sha256(Buffer.from(worker.source, 'utf8'));
  const identity = {
    schema: RUNTIME_SCHEMA,
    version: RUNTIME_VERSION,
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
  return Object.freeze({
    schema: RUNTIME_SCHEMA,
    version: RUNTIME_VERSION,
    runtime_sha256: runtimeSha256,
    worker_sha256: workerSha256,
    worker_module_count: worker.module_ids.length,
    modules: Object.freeze(identity.modules.map(Object.freeze)),
    html: lines.join('\n')
  });
}

function injectIntoHtml(htmlInput, runtime) {
  const html = String(htmlInput || '');
  const count = html.split(PLACEHOLDER).length - 1;
  if (count !== 1) fail('LOCAL_FIRST_RUNTIME_PLACEHOLDER_COUNT_INVALID');
  if (!runtime || runtime.schema !== RUNTIME_SCHEMA || runtime.version !== RUNTIME_VERSION || !runtime.html) {
    fail('LOCAL_FIRST_RUNTIME_INJECTION_INVALID');
  }
  return html.replace(PLACEHOLDER, runtime.html);
}

module.exports = Object.freeze({
  TARGET_HTML,
  PLACEHOLDER,
  RUNTIME_SCHEMA,
  RUNTIME_VERSION,
  TRACKED_BROWSER_MODULES,
  buildLocalFirstRuntimeInjection,
  injectIntoHtml
});
