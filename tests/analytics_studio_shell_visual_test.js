'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const routerSource = fs.readFileSync(path.join(root, 'CanonicalR2WebAppService.js'), 'utf8');
const studioHtml = fs.readFileSync(path.join(root, 'AnalyticsStudioWebApp.html'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'FinancialHomeWebApp.html'), 'utf8');
const artifactDir = path.join(root, 'artifacts');
fs.mkdirSync(artifactDir, { recursive: true });

function output(content) {
  return { setTitle() { return this; }, addMetaTag() { return this; }, getContent() { return content; } };
}
let homeRuntimeCalls = 0;
const context = vm.createContext({
  console, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent,
  HtmlService: {
    createHtmlOutputFromFile(name) {
      if (name === 'AnalyticsStudioWebApp') return output(studioHtml);
      if (name === 'FinancialHomeWebApp') return output(homeHtml);
      throw new Error(`UNEXPECTED_HTML_FILE:${name}`);
    },
    createHtmlOutput(content) { return output(String(content)); }
  },
  prhR2BuildFinancialHomeRuntime_() { homeRuntimeCalls += 1; throw new Error('Studio visual test must not read private financial runtime'); },
  prhGetWebDashboardData() { throw new Error('legacy data must not be read by Studio visual test'); },
  prhRenderWebDashboard_() { throw new Error('legacy renderer must not be used by Studio visual test'); }
});
vm.runInContext(routerSource, context, { filename: 'CanonicalR2WebAppService.js' });
const rendered = vm.runInContext("prhR2RenderFile_('studio',null).getContent()", context);
assert.strictEqual(homeRuntimeCalls, 0);
const tempFile = path.join(os.tmpdir(), `prh-studio-shell-${process.pid}.html`);
fs.writeFileSync(tempFile, rendered, 'utf8');

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 }
];

async function snapshot(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const tabs = Array.from(document.querySelectorAll('[role="tab"][data-mode]'));
    const activePanels = Array.from(document.querySelectorAll('[data-mode-panel]')).filter((panel) => panel.dataset.active === 'true' && panel.hidden === false);
    const shell = document.getElementById('prh-r2-shell');
    const secondary = document.getElementById('prh-r2-secondary-nav');
    const storageRaw = (() => { try { return localStorage.getItem('prh.analyticsStudio.mode.v1'); } catch (_) { return null; } })();
    return {
      mode: body.dataset.studioMode,
      title: document.getElementById('mode-title')?.textContent || '',
      selected: tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true').map((tab) => tab.dataset.mode),
      tabIndexes: tabs.map((tab) => ({ mode: tab.dataset.mode, value: tab.tabIndex })),
      activePanels: activePanels.map((panel) => panel.dataset.modePanel),
      bodyOverflow: Math.max(root.scrollWidth, body.scrollWidth) - innerWidth,
      navActive: shell && shell.dataset.activeSurface,
      studioLauncherCurrent: secondary && secondary.querySelector('[data-r2-studio-launcher="1"]')?.getAttribute('aria-current'),
      hasFinancialRuntimeCall: document.documentElement.innerHTML.includes('google.script.run'),
      preference: storageRaw,
      urlMode: new URL(location.href).searchParams.get('mode')
    };
  });
}

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
        await page.waitForTimeout(100);
        const daily = await snapshot(page);
        assert.deepStrictEqual(errors, [], `${viewport.name} default startup errors: ${errors.join(' | ')}`);
        assert.strictEqual(daily.mode, 'DAILY');
        assert.deepStrictEqual(daily.selected, ['DAILY']);
        assert.deepStrictEqual(daily.activePanels, ['DAILY']);
        assert.strictEqual(daily.navActive, 'studio');
        assert.strictEqual(daily.studioLauncherCurrent, 'page');
        assert.strictEqual(daily.hasFinancialRuntimeCall, false);
        assert(daily.bodyOverflow <= 1, `${viewport.name} default overflow ${daily.bodyOverflow}`);

        await page.goto(`file://${tempFile}?surface=studio&mode=explore`, { waitUntil: 'load', timeout: 15000 });
        await page.waitForTimeout(100);
        const explore = await snapshot(page);
        assert.deepStrictEqual(errors, [], `${viewport.name} explore startup errors: ${errors.join(' | ')}`);
        assert.strictEqual(explore.mode, 'EXPLORE');
        assert.deepStrictEqual(explore.selected, ['EXPLORE']);
        assert.deepStrictEqual(explore.activePanels, ['EXPLORE']);
        assert.strictEqual(explore.urlMode, 'explore');
        assert(explore.bodyOverflow <= 1, `${viewport.name} explore overflow ${explore.bodyOverflow}`);

        await page.locator('#mode-explore').focus();
        await page.keyboard.press('ArrowRight');
        assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.id), 'mode-studio');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(50);
        const studio = await snapshot(page);
        assert.strictEqual(studio.mode, 'STUDIO');
        assert.deepStrictEqual(studio.selected, ['STUDIO']);
        assert.deepStrictEqual(studio.activePanels, ['STUDIO']);
        assert.strictEqual(studio.urlMode, 'studio');
        assert(studio.preference == null || /"mode":"STUDIO"/.test(studio.preference));
        assert(studio.bodyOverflow <= 1, `${viewport.name} studio overflow ${studio.bodyOverflow}`);

        await page.locator('#mode-studio').focus();
        await page.keyboard.press('Home');
        assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.id), 'mode-daily');
        await page.keyboard.press('End');
        assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.id), 'mode-studio');
        await page.keyboard.press('ArrowLeft');
        assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.id), 'mode-explore');

        const aria = await page.evaluate(() => ({
          tablist: document.getElementById('mode-tabs')?.getAttribute('role'),
          tabs: Array.from(document.querySelectorAll('[role="tab"]')).map((tab) => ({
            mode: tab.dataset.mode,
            selected: tab.getAttribute('aria-selected'),
            controls: tab.getAttribute('aria-controls')
          })),
          panels: Array.from(document.querySelectorAll('[role="tabpanel"]')).map((panel) => ({ id: panel.id, labelledby: panel.getAttribute('aria-labelledby') }))
        }));
        assert.strictEqual(aria.tablist, 'tablist');
        assert.strictEqual(aria.tabs.length, 3);
        assert.strictEqual(aria.panels.length, 3);
        assert(aria.tabs.every((tab) => tab.controls && aria.panels.some((panel) => panel.id === tab.controls && panel.labelledby === `mode-${tab.mode.toLowerCase()}`)));

        evidence.push({ viewport: viewport.name, daily, explore, studio: { ...studio, preference: studio.preference ? 'MODE_ONLY_PRESENT' : 'UNAVAILABLE' }, keyboard: 'PASS', aria: 'PASS' });
        await page.screenshot({ path: path.join(artifactDir, `analytics-studio-shell-${viewport.name}.png`), fullPage: true });
      } finally {
        await page.close().catch(() => {});
      }
    }
    fs.writeFileSync(path.join(artifactDir, 'analytics-studio-shell-visual.json'), JSON.stringify({
      schema: 'PRH_ANALYTICS_STUDIO_VISUAL_EVIDENCE_V1', privacy_class: 'PUBLIC_CONFIGURATION_ONLY', evidence
    }, null, 2));
    console.log('analytics-studio-shell-visual: PASS', {
      viewports: viewports.map((item) => item.name),
      dailyDefault: true,
      exploreOptIn: true,
      studioOptIn: true,
      keyboard: true,
      financialRuntimeFetch: false
    });
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(tempFile, { force: true });
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
