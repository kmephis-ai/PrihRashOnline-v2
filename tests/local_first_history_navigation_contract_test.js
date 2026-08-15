'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'LocalFirstSpaWebApp.html'), 'utf8');

const expectedPopstate = "window.addEventListener('popstate',function(){navigate(routeFromUrl(),{fromPopstate:true,history:false,focusMain:false})});";
const legacyPopstate = "window.addEventListener('popstate',function(){render(routeFromUrl(),true)});";

assert.ok(
  source.includes("if(!opts.fromPopstate&&opts.history!==false)history.pushState"),
  'navigate() must keep popstate/history:false transitions from creating a new history entry'
);
assert.ok(
  source.includes('if(focusMain)main.focus({preventScroll:true})'),
  'explicit link navigation may retain the intentional focus-to-main behavior'
);
assert.ok(
  source.includes(expectedPopstate),
  'popstate must reuse navigate() without pushState and without forced focus'
);
assert.ok(
  !source.includes(legacyPopstate),
  'popstate must not call render(..., true), which forces focus during browser history restoration'
);

console.log('local_first_history_navigation_contract_test: PASS');
