'use strict';

const fs = require('fs');
const path = require('path');

const GENERATED_RUNTIME_BUNDLE = 'R2CanonicalRuntimeBundle.js';
const RUNTIME_SCHEMA = 'PRH_R2_CANONICAL_RUNTIME_BUNDLE_V1';

// Stable R2 financial entry set. Keep this contract narrow because the
// financial parity gate intentionally proves that DATA/FIN recovery is additive
// and does not redefine the Home/FIN runtime graph.
const ENTRY_MODULES = Object.freeze({
  financialReconciliation: 'lib/finance/financial_reconciliation.js',
  kpiDictionary: 'lib/finance/kpi_dictionary.js',
  home: 'lib/home/financial_home.js',
  googleAdapter: 'lib/adapters/google_sheets_transaction_repository.js',
  revisionAwareCache: 'lib/repository/revision_aware_cache.js',
  singleScanRefresh: 'lib/repository/single_scan_refresh.js'
});

// DATA-REC-001 is an additive runtime capability.
const DATA_ENTRY_MODULES = Object.freeze({
  transactionExplorer: 'lib/explorer/transaction_explorer.js',
  dataQuality: 'lib/data_quality/data_quality_center.js'
});

// FIN-REC-001 reuses the already-approved canonical domain engines. The Apps
// Script bridge receives these modules from the generated bundle; it does not
// copy their formulas or semantics.
const FIN_ENTRY_MODULES = Object.freeze({
  expenseAnalytics: 'lib/expense/expense_analytics.js',
  incomeAnalytics: 'lib/income/income_analytics.js',
  cashFlowDashboard: 'lib/cashflow/cash_flow_dashboard.js'
});

// Optional configuration/runtime entries are admitted only when the candidate source owns the module.
// This keeps default-branch trusted reconstruction safe before a product module lands.
const DASH_CONFIGURATION_ENTRY_MODULES = Object.freeze({
  dashboardSavedViews: 'lib/dashboard/dashboard_saved_views.js',
  expertDashboardGallery: 'lib/dashboard/expert_dashboard_gallery.js'
});

const OPTIONAL_ENTRY_MODULES = Object.freeze({
  recentMonthsProjection: 'lib/adapters/google_sheets_recent_months_projection.js'
});

const REQUIRE_RE = /require\(\s*['\"]([^'\"]+)['\"]\s*\)/g;

function normalizeId(value) {
  return String(value || '').replace(/\\/g, '/');
}

function effectiveEntryModules(root, entryModules = ENTRY_MODULES) {
  const result = Object.fromEntries(Object.entries(entryModules).map(([name, id]) => [name, normalizeId(id)]));
  if (entryModules === ENTRY_MODULES) {
    for (const group of [DATA_ENTRY_MODULES, FIN_ENTRY_MODULES]) {
      for (const [name, id] of Object.entries(group)) result[name] = normalizeId(id);
    }
    for (const [name, id] of Object.entries(DASH_CONFIGURATION_ENTRY_MODULES)) {
      const normalized = normalizeId(id);
      const fullPath = path.join(root, normalized);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) result[name] = normalized;
    }
    for (const [name, id] of Object.entries(OPTIONAL_ENTRY_MODULES)) {
      const normalized = normalizeId(id);
      const fullPath = path.join(root, normalized);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) result[name] = normalized;
    }
  }
  return Object.freeze(result);
}

function resolveLocalModule(root, parentId, request) {
  if (request === 'crypto') return 'crypto';
  if (!request.startsWith('.')) throw new Error(`unsupported runtime dependency: ${request}`);
  const base = path.resolve(root, path.dirname(parentId), request);
  const candidates = [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')];
  for (const candidate of candidates) {
    if (!candidate.startsWith(path.resolve(root) + path.sep) && candidate !== path.resolve(root)) {
      throw new Error(`runtime dependency escapes repository root: ${request}`);
    }
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return normalizeId(path.relative(root, candidate));
    }
  }
  throw new Error(`runtime dependency not found: ${parentId} -> ${request}`);
}

function collectModules(root, entryModules = ENTRY_MODULES) {
  const queue = Object.values(entryModules).map(normalizeId);
  const modules = new Map();
  while (queue.length) {
    const id = queue.shift();
    if (modules.has(id)) continue;
    const fullPath = path.join(root, id);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) throw new Error(`runtime entry missing: ${id}`);
    const ext = path.extname(id);
    if (ext === '.json') {
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      modules.set(id, { id, type: 'json', source: JSON.stringify(parsed), dependencies: {} });
      continue;
    }
    if (ext !== '.js') throw new Error(`unsupported runtime module type: ${id}`);
    const source = fs.readFileSync(fullPath, 'utf8');
    const dependencies = {};
    let match;
    REQUIRE_RE.lastIndex = 0;
    while ((match = REQUIRE_RE.exec(source))) {
      const request = match[1];
      const resolved = resolveLocalModule(root, id, request);
      dependencies[request] = resolved;
      if (resolved !== 'crypto') queue.push(resolved);
    }
    modules.set(id, { id, type: 'js', source, dependencies });
  }
  return modules;
}

function lowerBigIntLiteralsForAppsScript(source, moduleId = 'runtime-module') {
  const text = String(source);
  const out = [];
  let state = 'CODE';
  let index = 0;
  while (index < text.length) {
    const ch = text[index];
    const next = text[index + 1] || '';
    if (state === 'LINE_COMMENT') {
      out.push(ch); index += 1;
      if (ch === '\n') state = 'CODE';
      continue;
    }
    if (state === 'BLOCK_COMMENT') {
      out.push(ch);
      if (ch === '*' && next === '/') { out.push(next); index += 2; state = 'CODE'; } else index += 1;
      continue;
    }
    if (state === 'SINGLE' || state === 'DOUBLE' || state === 'TEMPLATE') {
      out.push(ch); index += 1;
      if (ch === '\\' && index < text.length) { out.push(text[index]); index += 1; continue; }
      if ((state === 'SINGLE' && ch === "'") || (state === 'DOUBLE' && ch === '"') || (state === 'TEMPLATE' && ch === '`')) state = 'CODE';
      continue;
    }
    if (ch === '/' && next === '/') { out.push(ch, next); index += 2; state = 'LINE_COMMENT'; continue; }
    if (ch === '/' && next !== '/' && next !== '*') {
      let close = index + 1;
      let escaped = false;
      while (close < text.length && text[close] !== '\n' && text[close] !== '\r') {
        if (!escaped && text[close] === '/') break;
        escaped = !escaped && text[close] === '\\';
        if (text[close] !== '\\') escaped = false;
        close += 1;
      }
      if (close < text.length && text[close] === '/') {
        const slashSegment = text.slice(index, close + 1);
        if (/(?:\b0[xX][0-9A-Fa-f]+n\b|\b0[bB][01]+n\b|\b0[oO][0-7]+n\b|\b[0-9]+n\b)/.test(slashSegment)) {
          out.push(slashSegment);
          index = close + 1;
          continue;
        }
      }
    }
    if (ch === '/' && next === '*') { out.push(ch, next); index += 2; state = 'BLOCK_COMMENT'; continue; }
    if (ch === "'") { out.push(ch); index += 1; state = 'SINGLE'; continue; }
    if (ch === '"') { out.push(ch); index += 1; state = 'DOUBLE'; continue; }
    if (ch === '`') { out.push(ch); index += 1; state = 'TEMPLATE'; continue; }
    if (/[0-9]/.test(ch) && (index === 0 || !/[A-Za-z0-9_$]/.test(text[index - 1]))) {
      if (ch === '0' && /[xXbBoO]/.test(next)) {
        let end = index + 2;
        while (end < text.length && /[0-9A-Fa-f]/.test(text[end])) end += 1;
        if (text[end] === 'n') throw new Error(`Apps Script BigInt literal lowering incomplete: ${moduleId}:${text.slice(index, end + 1)}`);
      }
      let end = index;
      while (end < text.length && /[0-9]/.test(text[end])) end += 1;
      if (text[end] === 'n' && (end + 1 === text.length || !/[A-Za-z0-9_$]/.test(text[end + 1]))) {
        const digits = text.slice(index, end);
        out.push(`BigInt(${JSON.stringify(digits)})`);
        index = end + 1;
        continue;
      }
    }
    out.push(ch); index += 1;
  }
  return out.join('');
}

function runtimeCryptoShimSource() {
  return [
    'function __prhSha256Hex(value){',
    "  var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8);",
    "  return bytes.map(function(b){var v=b<0?b+256:b;return ('0'+v.toString(16)).slice(-2);}).join('');",
    '}',
    'var __prhCrypto=Object.freeze({createHash:function(algorithm){',
    "  if(String(algorithm).toLowerCase()!=='sha256')throw new Error('R2_RUNTIME_CRYPTO_ALGORITHM_UNSUPPORTED');",
    "  var chunks=[];return {update:function(value){chunks.push(String(value));return this;},digest:function(encoding){if(String(encoding||'hex')!=='hex')throw new Error('R2_RUNTIME_CRYPTO_ENCODING_UNSUPPORTED');return __prhSha256Hex(chunks.join(''));}};",
    '}});'
  ].join('\n');
}

function buildRuntimeBundleSource(sourceRoot, entryModules = ENTRY_MODULES) {
  const root = path.resolve(sourceRoot);
  const effectiveEntries = effectiveEntryModules(root, entryModules);
  const modules = collectModules(root, effectiveEntries);
  const lines = [
    '/** Generated by trusted candidate packager from canonical lib sources. Do not edit or commit. */',
    'var PRH_R2_CANONICAL_RUNTIME = (function(){',
    `var __schema=${JSON.stringify(RUNTIME_SCHEMA)};`,
    'var __modules={};var __cache={};',
    runtimeCryptoShimSource()
  ];
  [...modules.values()].sort((a, b) => a.id.localeCompare(b.id)).forEach((module) => {
    if (module.type === 'json') {
      lines.push(`__modules[${JSON.stringify(module.id)}]=function(module){module.exports=${module.source};};`);
      return;
    }
    const runtimeSource = lowerBigIntLiteralsForAppsScript(module.source, module.id);
    const remainingBigIntLiteral = /(?:\b0[xX][0-9A-Fa-f]+n\b|\b0[bB][01]+n\b|\b0[oO][0-7]+n\b|\b[0-9]+n\b)/.exec(runtimeSource);
    if (remainingBigIntLiteral) throw new Error(`Apps Script BigInt literal remains after lowering: ${module.id}:${remainingBigIntLiteral[0]}`);
    lines.push(`__modules[${JSON.stringify(module.id)}]=function(module,exports,require){\n${runtimeSource}\n};`);
  });
  lines.push(
    'var __dependencyMaps=' + JSON.stringify(Object.fromEntries([...modules.values()].map((module) => [module.id, module.dependencies]))) + ';',
    'function __load(id){',
    " if(id==='crypto')return __prhCrypto;",
    " if(__cache[id])return __cache[id].exports;",
    " var factory=__modules[id];if(!factory)throw new Error('R2_RUNTIME_MODULE_UNKNOWN:'+id);",
    ' var module={exports:{}};__cache[id]=module;',
    ' var dependencyMap=__dependencyMaps[id]||{};',
    " factory(module,module.exports,function(request){var resolved=dependencyMap[request];if(!resolved)throw new Error('R2_RUNTIME_REQUIRE_UNKNOWN:'+id+':'+request);return __load(resolved);});",
    ' return module.exports;',
    '}',
    'var runtime={schema:__schema,version:"1.3.0",generated_from_canonical_lib:true,financial_formula_copy:false};'
  );
  Object.entries(effectiveEntries).forEach(([name, id]) => {
    lines.push(`runtime[${JSON.stringify(name)}]=__load(${JSON.stringify(normalizeId(id))});`);
  });
  lines.push('return Object.freeze(runtime);})();', '');
  return lines.join('\n');
}

function writeRuntimeBundle(sourceRoot, outFilesRoot) {
  const source = buildRuntimeBundleSource(sourceRoot);
  const output = path.join(outFilesRoot, GENERATED_RUNTIME_BUNDLE);
  fs.writeFileSync(output, source, 'utf8');
  return { path: GENERATED_RUNTIME_BUNDLE, source };
}

if (require.main === module) {
  const root = process.argv[2] || '.';
  process.stdout.write(buildRuntimeBundleSource(root));
}

module.exports = {
  GENERATED_RUNTIME_BUNDLE,
  RUNTIME_SCHEMA,
  ENTRY_MODULES,
  DATA_ENTRY_MODULES,
  FIN_ENTRY_MODULES,
  DASH_CONFIGURATION_ENTRY_MODULES,
  OPTIONAL_ENTRY_MODULES,
  effectiveEntryModules,
  resolveLocalModule,
  collectModules,
  lowerBigIntLiteralsForAppsScript,
  buildRuntimeBundleSource,
  writeRuntimeBundle
};
