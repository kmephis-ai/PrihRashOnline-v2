'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'CanonicalR2WebAppService.js'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'FinancialHomeWebApp.html'), 'utf8');
const artifactDir = path.join(root, 'artifacts');
fs.mkdirSync(artifactDir, { recursive: true });

function output(content) {
  return { setTitle() { return this; }, addMetaTag() { return this; }, getContent() { return content; } };
}
const context = vm.createContext({
  console, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent,
  HtmlService: {
    createHtmlOutputFromFile(name) { assert.strictEqual(name, 'FinancialHomeWebApp'); return output(homeHtml); },
    createHtmlOutput(content) { return output(String(content)); }
  },
  prhR2BuildFinancialHomeRuntime_() { throw new Error('visual test must use synthetic technical payload only'); },
  prhGetWebDashboardData() { throw new Error('legacy data must not be read by R2 visual test'); },
  prhRenderWebDashboard_() { throw new Error('legacy renderer must not be used by R2 visual test'); }
});
vm.runInContext(source, context, { filename: 'CanonicalR2WebAppService.js' });
const rendered = vm.runInContext("prhR2RenderFile_('home',prhR2SmokePayload_()).getContent()", context);
const tempFile = path.join(os.tmpdir(), `prh-r2-nav-${process.pid}.html`);
fs.writeFileSync(tempFile, rendered, 'utf8');

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 980 },
  { name: 'mobile', width: 390, height: 844 }
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const evidence = [];
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      try {
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`file://${tempFile}`, { waitUntil: 'load', timeout: 15000 });
        await page.waitForTimeout(150);
        assert.deepStrictEqual(errors, [], `${viewport.name} startup errors: ${errors.join(' | ')}`);
        const state = await page.evaluate(() => {
          const nav = document.getElementById('prh-r2-canonical-nav');
          if (!nav) throw new Error('R2_NAV_MISSING');
          const primary = Array.from(nav.querySelectorAll('a[data-r2-nav]:not([data-r2-nav="legacy"])'));
          const legacy = nav.querySelector('a[data-r2-nav="legacy"]');
          const root = document.documentElement;
          const body = document.body;
          return {
            primary: primary.map((link) => ({ id: link.dataset.r2Nav, href: link.getAttribute('href'), current: link.getAttribute('aria-current') })),
            legacyHref: legacy && legacy.getAttribute('href'),
            active: nav.dataset.activeSurface,
            navScrollWidth: nav.scrollWidth,
            navClientWidth: nav.clientWidth,
            bodyOverflow: Math.max(root.scrollWidth, body.scrollWidth) - innerWidth,
            marker: document.querySelector('meta[name="prh-canonical-r2"]')?.content || '',
            financialPayloadInHrefs: primary.concat(legacy ? [legacy] : []).some((link) => /amount|income|expense|cash_flow|balance|value_minor/i.test(link.getAttribute('href') || ''))
          };
        });
        assert.strictEqual(state.marker, '1.0.0');
        assert.strictEqual(state.active, 'home');
        assert.strictEqual(state.primary.length, 8);
        assert.deepStrictEqual(state.primary.map((item) => item.id), ['home','transactions','expenses','income','cash-flow','budget','obligations','data-quality']);
        assert.strictEqual(state.primary[0].current, 'page');
        assert(state.primary.slice(1).every((item) => item.current == null));
        assert.strictEqual(state.legacyHref, '?surface=legacy');
        assert.strictEqual(state.financialPayloadInHrefs, false);
        assert(state.bodyOverflow <= 1, `${viewport.name} body overflow ${state.bodyOverflow}`);
        // Horizontal scrolling inside the sticky nav is an intentional mobile/tablet behavior.
        assert(state.navScrollWidth >= state.navClientWidth);
        evidence.push({ viewport: viewport.name, ...state, primary: state.primary.map((item) => item.id) });
        await page.screenshot({ path: path.join(artifactDir, `canonical-r2-nav-${viewport.name}.png`), fullPage: true });
      } finally {
        await page.close().catch(() => {});
      }
    }
    fs.writeFileSync(path.join(artifactDir, 'canonical-r2-navigation.json'), JSON.stringify({
      schema: 'PRH_CANONICAL_R2_NAV_VISUAL_EVIDENCE_V1', privacy_class: 'PUBLIC_SYNTHETIC', evidence
    }, null, 2));
    console.log('canonical_r2_navigation_visual_test: OK', { viewports: viewports.map((item) => item.name), primaryRoutes: 8, legacyRollback: true });
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(tempFile, { force: true });
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
