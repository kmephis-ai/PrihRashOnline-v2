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
const UNBOUND = ['transactions','expenses','income','cash-flow','budget','obligations','data-quality'];

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
        await page.waitForTimeout(120);
        assert.deepStrictEqual(errors, [], `${viewport.name} startup errors: ${errors.join(' | ')}`);
        const state = await page.evaluate(() => {
          const shell = document.getElementById('prh-r2-shell');
          const primaryNav = document.getElementById('prh-r2-canonical-nav');
          const secondaryNav = document.getElementById('prh-r2-secondary-nav');
          if (!shell || !primaryNav || !secondaryNav) throw new Error('R2_NAV_MISSING');
          const primary = Array.from(primaryNav.querySelectorAll('a'));
          const secondary = Array.from(secondaryNav.querySelectorAll('a'));
          const root = document.documentElement;
          const body = document.body;
          const forbiddenFinancialKeys = /^(?:amount|amount_minor|income|income_minor|expense|expense_minor|cash_flow|cash_flow_minor|balance|balance_minor|value|value_minor|budget_minor)$/i;
          const links = primary.concat(secondary);
          return {
            primary: primary.map((link) => ({ id: link.dataset.r2Nav, href: link.getAttribute('href'), label: link.textContent.trim(), current: link.getAttribute('aria-current') })),
            secondary: secondary.map((link) => ({ href: link.getAttribute('href'), label: link.textContent.trim(), current: link.getAttribute('aria-current') })),
            active: shell.dataset.activeSurface,
            policy: shell.dataset.navigationPolicy,
            bodyOverflow: Math.max(root.scrollWidth, body.scrollWidth) - innerWidth,
            marker: document.querySelector('meta[name="prh-canonical-r2"]')?.content || '',
            visibleShellText: shell.innerText.replace(/\s+/g, ' ').trim(),
            financialPayloadInHrefs: links.some((link) => {
              const url = new URL(link.getAttribute('href') || '', location.href);
              return Array.from(url.searchParams.keys()).some((key) => forbiddenFinancialKeys.test(key));
            }),
            hrefs: links.map((link) => link.getAttribute('href'))
          };
        });
        assert.strictEqual(state.marker, '1.1.0');
        assert.strictEqual(state.active, 'home');
        assert.strictEqual(state.policy, 'PROVEN_DESTINATIONS_ONLY');
        assert.deepStrictEqual(state.primary, [{ id: 'home', href: '?surface=home', label: 'Главная', current: 'page' }]);
        assert.deepStrictEqual(state.secondary.map((item) => item.label), ['Студия аналитики','Старый интерфейс']);
        assert.strictEqual(state.financialPayloadInHrefs, false);
        for (const route of UNBOUND) assert(!state.hrefs.includes(`?surface=${route}`), `${viewport.name}: unbound ${route} is visible`);
        assert(!/Explore|Studio|Legacy|rollback|configuration/i.test(state.visibleShellText), `${viewport.name}: English/developer navigation terminology visible`);
        assert(state.bodyOverflow <= 1, `${viewport.name} body overflow ${state.bodyOverflow}`);
        evidence.push({ viewport: viewport.name, ...state });
        await page.screenshot({ path: path.join(artifactDir, `canonical-r2-nav-${viewport.name}.png`), fullPage: true });
      } finally {
        await page.close().catch(() => {});
      }
    }
    fs.writeFileSync(path.join(artifactDir, 'canonical-r2-navigation.json'), JSON.stringify({
      schema: 'PRH_CANONICAL_R2_NAV_VISUAL_EVIDENCE_V2', privacy_class: 'PUBLIC_SYNTHETIC', truthfulNavigation: true, evidence
    }, null, 2));
    console.log('canonical_r2_navigation_visual_test: OK', {
      viewports: viewports.map((item) => item.name), primaryRoutes: 1,
      secondaryTools: 2, hiddenUnboundRoutes: UNBOUND.length, privacyCheck: 'QUERY_PARAMETER_KEYS_ONLY'
    });
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(tempFile, { force: true });
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});