'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_ENTRY = 'pwa/local_analytics_worker_entry.js';
const VIRTUAL_CRYPTO = '__virtual__/crypto.js';
const SHA_MODULE = 'lib/crypto/sha256.js';
const REQUIRE_RE = /\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g;

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function posix(value) {
  return value.split(path.sep).join('/');
}

function safeModuleId(root, absolutePath) {
  const relative = posix(path.relative(root, absolutePath));
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    fail('WORKER_BUNDLE_PATH_ESCAPE');
  }
  return relative;
}

function resolveRelative(root, parentId, request) {
  const parentDir = path.dirname(path.join(root, parentId));
  const base = path.resolve(parentDir, request);
  const candidates = [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
    return safeModuleId(root, candidate);
  }
  fail(`WORKER_BUNDLE_MODULE_NOT_FOUND:${parentId}:${request}`);
}

function virtualCryptoSource() {
  return [
    `'use strict';`,
    `const { sha256Hex } = __require__(${JSON.stringify(SHA_MODULE)});`,
    `function createHash(algorithm) {`,
    `  if (algorithm !== 'sha256') throw Object.assign(new Error('WORKER_CRYPTO_ALGORITHM_FORBIDDEN'), { code: 'WORKER_CRYPTO_ALGORITHM_FORBIDDEN' });`,
    `  let input = '';`,
    `  let digested = false;`,
    `  return {`,
    `    update(value, encoding) {`,
    `      if (digested || (encoding != null && encoding !== 'utf8')) throw Object.assign(new Error('WORKER_CRYPTO_UPDATE_INVALID'), { code: 'WORKER_CRYPTO_UPDATE_INVALID' });`,
    `      input += String(value);`,
    `      return this;`,
    `    },`,
    `    digest(encoding) {`,
    `      if (digested || encoding !== 'hex') throw Object.assign(new Error('WORKER_CRYPTO_DIGEST_INVALID'), { code: 'WORKER_CRYPTO_DIGEST_INVALID' });`,
    `      digested = true;`,
    `      return sha256Hex(input);`,
    `    }`,
    `  };`,
    `}`,
    `module.exports = { createHash };`
  ].join('\n');
}

function collectGraph(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const entry = posix(options.entry || DEFAULT_ENTRY);
  const modules = new Map();
  const visiting = new Set();

  function visit(id) {
    if (modules.has(id)) return;
    if (visiting.has(id)) fail(`WORKER_BUNDLE_CYCLE_UNRESOLVED:${id}`);
    visiting.add(id);

    if (id === VIRTUAL_CRYPTO) {
      visit(SHA_MODULE);
      modules.set(id, virtualCryptoSource());
      visiting.delete(id);
      return;
    }

    const absolute = path.resolve(root, id);
    safeModuleId(root, absolute);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) fail(`WORKER_BUNDLE_MODULE_NOT_FOUND:${id}`);
    const extension = path.extname(id).toLowerCase();
    if (extension === '.json') {
      const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'));
      modules.set(id, `module.exports = ${JSON.stringify(parsed)};`);
      visiting.delete(id);
      return;
    }
    if (extension !== '.js') fail(`WORKER_BUNDLE_EXTENSION_FORBIDDEN:${id}`);

    const source = fs.readFileSync(absolute, 'utf8');
    const requests = [];
    source.replace(REQUIRE_RE, (_match, _quote, request) => {
      requests.push(request);
      return _match;
    });
    const resolutions = new Map();
    for (const request of requests) {
      let target;
      if (request === 'crypto') {
        target = VIRTUAL_CRYPTO;
      } else if (request.startsWith('./') || request.startsWith('../')) {
        target = resolveRelative(root, id, request);
      } else {
        fail(`WORKER_BUNDLE_EXTERNAL_REQUIRE_FORBIDDEN:${request}`);
      }
      resolutions.set(request, target);
      visit(target);
    }
    const transformed = source.replace(REQUIRE_RE, (_match, _quote, request) => {
      const target = resolutions.get(request);
      if (!target) fail(`WORKER_BUNDLE_DYNAMIC_REQUIRE_FORBIDDEN:${id}`);
      return `__require__(${JSON.stringify(target)})`;
    });
    modules.set(id, transformed);
    visiting.delete(id);
  }

  visit(entry);
  return { root, entry, modules };
}

function buildWorkerBundle(options = {}) {
  const graph = collectGraph(options);
  const ids = Array.from(graph.modules.keys()).sort();
  const lines = [
    `'use strict';`,
    `/* PRH_LOCAL_ANALYTICS_WORKER_V1 deterministic bundle; generated from tracked canonical modules. */`,
    `(function(){`,
    `const __modules__ = Object.create(null);`
  ];
  for (const id of ids) {
    lines.push(`__modules__[${JSON.stringify(id)}] = function(module, exports, __require__){`);
    lines.push(graph.modules.get(id));
    lines.push(`};`);
  }
  lines.push(
    `const __cache__ = Object.create(null);`,
    `function __require__(id){`,
    `  if (Object.prototype.hasOwnProperty.call(__cache__, id)) return __cache__[id].exports;`,
    `  const factory = __modules__[id];`,
    `  if (!factory) throw new Error('WORKER_BUNDLE_MODULE_MISSING:' + id);`,
    `  const module = { exports: {} };`,
    `  __cache__[id] = module;`,
    `  factory(module, module.exports, __require__);`,
    `  return module.exports;`,
    `}`,
    `__require__(${JSON.stringify(graph.entry)});`,
    `})();`,
    ``
  );
  return {
    schema: 'PRH_LOCAL_ANALYTICS_WORKER_BUNDLE_V1',
    entry: graph.entry,
    module_ids: ids,
    source: lines.join('\n')
  };
}

if (require.main === module) {
  const output = process.argv[2];
  if (!output) fail('WORKER_BUNDLE_OUTPUT_REQUIRED');
  const bundle = buildWorkerBundle();
  fs.writeFileSync(path.resolve(output), bundle.source, 'utf8');
  process.stdout.write(JSON.stringify({ schema: bundle.schema, entry: bundle.entry, modules: bundle.module_ids.length }) + '\n');
}

module.exports = {
  DEFAULT_ENTRY,
  VIRTUAL_CRYPTO,
  SHA_MODULE,
  collectGraph,
  buildWorkerBundle
};
