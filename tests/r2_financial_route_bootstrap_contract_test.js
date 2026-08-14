'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const bootstrapSource = fs.readFileSync(path.join(root, 'R2RouteBootstrapService.js'), 'utf8');
const routerSource = fs.readFileSync(path.join(root, 'CanonicalR2WebAppService.js'), 'utf8');
const financialHtml = fs.readFileSync(path.join(root, 'FinancialSectionsWebApp.html'), 'utf8');

new vm.Script(bootstrapSource, { filename:'R2RouteBootstrapService.js' });
new vm.Script(routerSource, { filename:'CanonicalR2WebAppService.js' });

function output(content) {
  return { setTitle(){ return this; }, addMetaTag(){ return this; }, getContent(){ return content; } };
}

const selfUrl = 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec';
const context = vm.createContext({
  Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent,
  ScriptApp:{ getService(){ return { getUrl(){ return selfUrl; } }; } },
  HtmlService:{
    createHtmlOutputFromFile(name){
      if (name !== 'FinancialSectionsWebApp') throw new Error(`unexpected file ${name}`);
      return output(financialHtml);
    },
    createHtmlOutput(content){ return output(String(content)); }
  }
});
vm.runInContext(bootstrapSource, context, { filename:'R2RouteBootstrapService.js' });
vm.runInContext(routerSource, context, { filename:'CanonicalR2WebAppService.js' });

const params = context.prhR2FinancialRouteBootstrapParams_({
  surface:'expenses', privacy:'normal', window_days:'30',
  account_id:'ACC-1', category_id:'CAT-1', member_id:'MEM-1'
});
assert.strictEqual(JSON.stringify(params), JSON.stringify({
  surface:'expenses', privacy:'NORMAL', window_days:'30',
  account_id:'ACC-1', category_id:'CAT-1', member_id:'MEM-1'
}));

const filtered = context.prhR2RenderFile_('expenses', null, {
  surface:'expenses', privacy:'NORMAL', window_days:'30',
  account_id:'ACC-1', category_id:'CAT-1', member_id:'MEM-1'
}).getContent();
assert(filtered.includes('id="prh-r2-financial-route-bootstrap"'));
assert(filtered.includes('history.replaceState(history.state||null,"","?"+q.toString())'));
assert(filtered.includes('"surface":"expenses"'));
assert(filtered.includes('"window_days":"30"'));
assert(filtered.includes('"account_id":"ACC-1"'));
assert(filtered.includes('"category_id":"CAT-1"'));
assert(filtered.includes('"member_id":"MEM-1"'));
assert(filtered.indexOf('id="prh-r2-financial-route-bootstrap"') < filtered.indexOf("var TITLES={expenses:"), 'route bootstrap must run before FinancialSections runtime reads location.search');

const invalid = context.prhR2FinancialRouteBootstrapParams_({
  surface:'expenses', privacy:'???', window_days:'31', account_id:'A'.repeat(161)
});
assert.strictEqual(JSON.stringify(invalid), JSON.stringify({surface:'expenses', privacy:'MASKED'}));
assert.strictEqual(context.prhR2FinancialRouteBootstrapScript_({surface:'transactions'}), '');

assert(routerSource.includes("prhR2InjectFinancialRouteBootstrap_"), 'financial routes must receive server route state before shell runtime');
assert(!bootstrapSource.includes('setValue('));
assert(!bootstrapSource.includes('setValues('));
assert(!bootstrapSource.includes('appendRow('));

console.log('r2_financial_route_bootstrap_contract_test: OK', {
  appsScriptIframeQueryRehydrated:true,
  boundedRouteState:true,
  financialValuesInRouteState:false,
  zeroWrite:true
});
