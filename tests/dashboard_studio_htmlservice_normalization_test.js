'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const routerSource = fs.readFileSync(path.join(root, 'CanonicalR2WebAppService.js'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'FinancialHomeWebApp.html'), 'utf8');

function output(content) {
  return {
    setTitle() { return this; },
    addMetaTag() { return this; },
    getContent() { return content; }
  };
}

const context = vm.createContext({
  console, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent,
  HtmlService: {
    createHtmlOutputFromFile(name) {
      if (name === 'FinancialHomeWebApp') return output(homeHtml);
      throw new Error(`UNEXPECTED_HTML_FILE:${name}`);
    },
    createHtmlOutput(content) {
      const normalized = String(content).replace(
        /\?surface=studio&mode=explore/g,
        '?surface=studio&amp;mode=explore'
      );
      return output(normalized);
    }
  },
  prhR2BuildFinancialHomeRuntime_() {
    throw new Error('SMOKE_MUST_USE_TECHNICAL_PAYLOAD');
  },
  prhGetWebDashboardData() {
    throw new Error('LEGACY_ROUTE_MUST_NOT_BE_USED');
  },
  prhRenderWebDashboard_() {
    throw new Error('LEGACY_RENDER_MUST_NOT_BE_USED');
  }
});

vm.runInContext(routerSource, context, { filename: 'CanonicalR2WebAppService.js' });

const token = context.prhCanonicalR2WebAppSmokeToken();
assert.strictEqual(token, 'PRH_WEBAPP_SMOKE_V3|R2|OK');

const html = context.prhR2RenderFile_(
  context.PRH_CANONICAL_R2_WEB.DEFAULT_SURFACE,
  context.prhR2SmokePayload_()
).getContent();
assert(html.includes('data-r2-studio-launcher="1"'));
assert(html.includes('surface=studio'));
assert(html.includes('mode=explore'));
assert(html.includes('?surface=studio&amp;mode=explore'));
assert(!html.includes('?surface=studio&mode=explore'));
assert(html.includes('R2_PRIVATE_HOME_PAYLOAD_REQUIRED'));

console.log('dashboard-studio-htmlservice-normalization: PASS', {
  smoke: token,
  studioLauncher: true,
  entityNormalized: true,
  privateHomeFailClosed: true
});
