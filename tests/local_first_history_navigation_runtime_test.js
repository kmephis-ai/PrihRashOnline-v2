'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  HISTORY_RESTORE_LEGACY,
  HISTORY_RESTORE_REPAIRED,
  applyHistoryRestoreRepair
} = require('../tools/build-local-first-browser-runtime');

const source = fs.readFileSync(path.join(__dirname, '..', 'LocalFirstSpaWebApp.html'), 'utf8');

function count(text, token) {
  return String(text).split(token).length - 1;
}

assert.ok(
  source.includes("if(!opts.fromPopstate&&opts.history!==false)history.pushState"),
  'navigate() must keep popstate/history:false transitions from creating a new history entry'
);
assert.ok(
  source.includes('if(focusMain)main.focus({preventScroll:true})'),
  'explicit link navigation may retain the intentional focus-to-main behavior'
);
assert.strictEqual(
  count(source, HISTORY_RESTORE_LEGACY) + count(source, HISTORY_RESTORE_REPAIRED),
  1,
  'source must contain exactly one known history restore handler'
);

const repaired = applyHistoryRestoreRepair(source);
assert.strictEqual(count(repaired, HISTORY_RESTORE_LEGACY), 0, 'exact candidate must not retain forced-focus popstate');
assert.strictEqual(count(repaired, HISTORY_RESTORE_REPAIRED), 1, 'exact candidate must contain one optimized popstate handler');
assert.strictEqual(applyHistoryRestoreRepair(repaired), repaired, 'history restore repair must be idempotent');
assert.throws(
  () => applyHistoryRestoreRepair(source.replace(HISTORY_RESTORE_LEGACY, '').replace(HISTORY_RESTORE_REPAIRED, '')),
  /LOCAL_FIRST_HISTORY_RESTORE_HANDLER_INVALID/,
  'unknown or missing handler must fail closed'
);

console.log('local_first_history_navigation_runtime_test: PASS');
