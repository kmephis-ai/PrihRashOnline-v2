'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'LocalFirstSpaWebApp.html'), 'utf8');
const serviceSource = fs.readFileSync(path.join(ROOT, 'LocalFirstSpaService.js'), 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(serviceSource, context, { filename: 'LocalFirstSpaService.js' });

const legacy = "window.addEventListener('popstate',function(){render(routeFromUrl(),true)});";
const repairedHandler = "window.addEventListener('popstate',function(){navigate(routeFromUrl(),{fromPopstate:true,history:false,focusMain:false})});";

function count(text, token) {
  return String(text).split(token).length - 1;
}

function extractMarkedScript(html, marker) {
  const open = `<script ${marker}>`;
  const start = html.indexOf(open);
  assert(start >= 0, `missing marked script: ${marker}`);
  assert.strictEqual(html.indexOf(open, start + open.length), -1, `duplicate marked script: ${marker}`);
  const bodyStart = start + open.length;
  const end = html.indexOf('</script>', bodyStart);
  assert(end > bodyStart, `unterminated marked script: ${marker}`);
  return { start, body: html.slice(bodyStart, end) };
}

const scrollRestorationMarker = 'data-lf-history-scroll-restoration="manual"';
const scrollRestorationScript = extractMarkedScript(source, scrollRestorationMarker);
assert.strictEqual(source.indexOf('<script'), scrollRestorationScript.start, 'manual scroll restoration must be the first script in the document head');
assert(scrollRestorationScript.start < source.indexOf('<style>'), 'manual scroll restoration must run before style/layout work and history entries');
assert(!/scrollRestoration\s*=\s*['"]auto['"]/.test(source), 'SPA must never opt back into browser automatic scroll restoration');

const supportedHistory = { scrollRestoration: 'auto' };
vm.runInNewContext(scrollRestorationScript.body, { history: supportedHistory }, { filename: 'history-scroll-restoration.js' });
assert.strictEqual(supportedHistory.scrollRestoration, 'manual', 'canonical head script must disable browser-native scroll restoration');
const unsupportedHistory = {};
assert.doesNotThrow(
  () => vm.runInNewContext(scrollRestorationScript.body, { history: unsupportedHistory }, { filename: 'history-scroll-restoration-unsupported.js' }),
  'unsupported history implementations must remain fail-safe'
);
assert.strictEqual(Object.prototype.hasOwnProperty.call(unsupportedHistory, 'scrollRestoration'), false, 'unsupported history must not be mutated');

assert.strictEqual(typeof context.prhLocalFirstSpaRepairHistoryRestore_, 'function', 'server renderer must expose the bounded history repair');

assert.ok(source.includes('financeWarmReady:false'), 'SPA runtime must distinguish cached paint from fully hydrated warm runtime');
assert.ok(
  source.includes('await finance.start(routeFromUrl());render(routeFromUrl(),false);await lastFinanceRender;runtime.financeWarmReady=true'),
  'warm runtime latch must open only after full finance start and final route render complete'
);
assert.ok(
  source.includes("if(!opts.fromPopstate&&opts.history!==false)history.pushState"),
  'navigate() must keep popstate/history:false transitions from creating a new history entry'
);
assert.ok(
  source.includes('if(focusMain)main.focus({preventScroll:true})'),
  'explicit link navigation may retain intentional focus-to-main behavior'
);
assert.strictEqual(count(source, legacy), 1, 'tracked source must contain exactly one legacy history handler until renderer migration is complete');
assert.strictEqual(count(source, repairedHandler), 0, 'tracked source must not contain two competing history handlers');
assert.ok(
  serviceSource.includes('html = prhLocalFirstSpaRepairHistoryRestore_(html);'),
  'canonical server render pipeline must apply history repair before serving HTML'
);

const repaired = context.prhLocalFirstSpaRepairHistoryRestore_(source);
assert.strictEqual(count(repaired, legacy), 0, 'served HTML must not retain forced-focus popstate');
assert.strictEqual(count(repaired, repairedHandler), 1, 'served HTML must contain exactly one optimized popstate handler');
assert.strictEqual(context.prhLocalFirstSpaRepairHistoryRestore_(repaired), repaired, 'history repair must be idempotent');
assert.throws(
  () => context.prhLocalFirstSpaRepairHistoryRestore_(source.replace(legacy, '')),
  (error) => error && error.message === 'LF_SPA_HISTORY_RESTORE_HANDLER_INVALID',
  'missing/unknown history handler must fail closed'
);
assert.throws(
  () => context.prhLocalFirstSpaRepairHistoryRestore_(source + legacy),
  (error) => error && error.message === 'LF_SPA_HISTORY_RESTORE_HANDLER_INVALID',
  'duplicate history handlers must fail closed'
);

console.log('local_first_history_navigation_runtime_test: PASS');
