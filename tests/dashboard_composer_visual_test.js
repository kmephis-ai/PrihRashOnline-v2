'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const COMPOSER = require('../lib/dashboard/dashboard_composer');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'DashboardComposerWebApp.html'), 'utf8');
const artifactDir = path.join(root, 'artifacts');
fs.mkdirSync(artifactDir, { recursive: true });

const forbiddenSource = ['google.script.run', 'localStorage', 'sessionStorage', '<?!=', 'amount_minor', 'income_minor', 'expense_minor', 'cash_flow_minor', 'balance_minor'];
for (const token of forbiddenSource) assert.strictEqual(html.includes(token), false, `composer source forbidden token: ${token}`);
assert(html.includes('data-prh-dashboard-composer="1"'));
assert(html.includes('data-persistence="SESSION_ONLY"'));
assert(html.includes('data-financial-runtime-fetch="false"'));
assert(html.includes('data-semantic-binding="UNBOUND"'));
assert(html.includes('PRH_DASHBOARD_COMPOSER_V1'));
assert(html.includes('UNBOUND • DASH-081'));
assert(html.includes('@media(max-width:1250px)'));
assert(html.includes('@media(max-width:760px)'));
assert(html.includes('@media(prefers-reduced-motion:reduce)'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const evidence = [];
  try {
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900, expectedClass: 'DESKTOP', columns: 12 },
      { name: 'tablet', width: 768, height: 1024, expectedClass: 'TABLET', columns: 6 },
      { name: 'mobile', width: 390, height: 844, expectedClass: 'MOBILE', columns: 1 }
    ]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      try {
        await page.setContent(html, { waitUntil: 'load' });
        await page.waitForFunction(() => Boolean(window.PRH_DASHBOARD_COMPOSER));

        const initial = await page.evaluate(() => ({
          state: window.PRH_DASHBOARD_COMPOSER.getState(),
          layout: window.PRH_DASHBOARD_COMPOSER.getLayout(),
          viewport: document.getElementById('composer-grid').dataset.viewportClass,
          count: document.querySelectorAll('[data-widget-id]').length,
          unboundCount: document.querySelectorAll('[data-semantic-binding-status="UNBOUND"]').length,
          overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
          persistence: document.body.dataset.persistence,
          financialFetch: document.body.dataset.financialRuntimeFetch
        }));
        const expectedDefault = COMPOSER.defaultSpec();
        assert.strictEqual(initial.state.layout_identity, expectedDefault.layout_identity, `${viewport.name} default identity parity`);
        assert.deepStrictEqual(initial.state.widgets, expectedDefault.widgets, `${viewport.name} default widgets parity`);
        assert.strictEqual(initial.viewport, viewport.expectedClass);
        assert.strictEqual(initial.layout.columns, viewport.columns);
        assert.strictEqual(initial.layout.widgets.length, 2);
        assert.strictEqual(initial.count, 2);
        assert.strictEqual(initial.unboundCount, 2);
        assert.strictEqual(initial.persistence, 'SESSION_ONLY');
        assert.strictEqual(initial.financialFetch, 'false');
        assert(initial.overflow <= 1, `${viewport.name} initial overflow=${initial.overflow}`);

        // Keyboard activation: native button Enter -> ADD.
        await page.locator('#add-widget').focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelectorAll('[data-widget-id]').length === 3);
        let state = await page.evaluate(() => window.PRH_DASHBOARD_COMPOSER.getState());
        let expected = COMPOSER.applyOperation(expectedDefault, { type: 'ADD' });
        assert.strictEqual(state.layout_identity, expected.layout_identity, `${viewport.name} ADD parity`);
        assert.strictEqual(state.widgets.length, 3);
        assert(state.widgets.every((item) => item.semantic_binding_status === 'UNBOUND'));

        // Move first widget right via real control.
        await page.locator('[data-widget-id="w-0001"] button[data-action="right"]').click();
        expected = COMPOSER.applyOperation(expected, { type: 'MOVE', widget_id: 'w-0001', dx: 1, dy: 0 });
        state = await page.evaluate(() => window.PRH_DASHBOARD_COMPOSER.getState());
        assert.strictEqual(state.layout_identity, expected.layout_identity, `${viewport.name} MOVE parity`);

        // Resize width and height.
        await page.locator('[data-widget-id="w-0001"] button[data-action="wide"]').click();
        expected = COMPOSER.applyOperation(expected, { type: 'RESIZE', widget_id: 'w-0001', dw: 1, dh: 0 });
        await page.locator('[data-widget-id="w-0001"] button[data-action="tall"]').click();
        expected = COMPOSER.applyOperation(expected, { type: 'RESIZE', widget_id: 'w-0001', dw: 0, dh: 1 });
        state = await page.evaluate(() => window.PRH_DASHBOARD_COMPOSER.getState());
        assert.strictEqual(state.layout_identity, expected.layout_identity, `${viewport.name} RESIZE parity`);

        // Duplicate w-0002 -> stable w-0004.
        await page.locator('[data-widget-id="w-0002"] button[data-action="duplicate"]').click();
        expected = COMPOSER.applyOperation(expected, { type: 'DUPLICATE', widget_id: 'w-0002' });
        state = await page.evaluate(() => window.PRH_DASHBOARD_COMPOSER.getState());
        assert.strictEqual(state.layout_identity, expected.layout_identity, `${viewport.name} DUPLICATE parity`);
        assert.strictEqual(state.widgets.some((item) => item.id === 'w-0004'), true);
        assert.strictEqual(await page.locator('[data-widget-id="w-0004"]').count(), 1);

        // Remove added w-0003.
        await page.locator('[data-widget-id="w-0003"] button[data-action="remove"]').click();
        expected = COMPOSER.applyOperation(expected, { type: 'REMOVE', widget_id: 'w-0003' });
        state = await page.evaluate(() => window.PRH_DASHBOARD_COMPOSER.getState());
        assert.strictEqual(state.layout_identity, expected.layout_identity, `${viewport.name} REMOVE parity`);
        assert.strictEqual(state.widgets.some((item) => item.id === 'w-0003'), false);

        const beforeResetOverflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
        assert(beforeResetOverflow <= 1, `${viewport.name} post-ops overflow=${beforeResetOverflow}`);

        // Reset through keyboard and recover exact default identity.
        await page.locator('#reset-layout').focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction((identity) => window.PRH_DASHBOARD_COMPOSER.getState().layout_identity === identity, expectedDefault.layout_identity);
        const final = await page.evaluate(() => ({
          state: window.PRH_DASHBOARD_COMPOSER.getState(),
          layout: window.PRH_DASHBOARD_COMPOSER.getLayout(),
          count: document.querySelectorAll('[data-widget-id]').length,
          unboundCount: document.querySelectorAll('[data-semantic-binding-status="UNBOUND"]').length,
          overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
          regions: Array.from(document.querySelectorAll('[data-widget-id]')).map((node) => ({
            id: node.dataset.widgetId,
            role: node.getAttribute('role'),
            label: node.getAttribute('aria-label')
          }))
        }));
        assert.strictEqual(final.state.layout_identity, expectedDefault.layout_identity);
        assert.strictEqual(final.count, 2);
        assert.strictEqual(final.unboundCount, 2);
        assert.strictEqual(final.layout.columns, viewport.columns);
        assert(final.overflow <= 1, `${viewport.name} final overflow=${final.overflow}`);
        assert(final.regions.every((item) => item.role === 'region' && item.label && item.label.includes('незаполненный виджет')));

        const bodyText = await page.locator('body').innerText();
        assert(bodyText.includes('SESSION ONLY'));
        assert(bodyText.includes('UNBOUND'));
        assert(!/₽|руб\.|доход|расход|баланс|транзакци/i.test(bodyText), `${viewport.name} financial-looking content in placeholder composer`);

        evidence.push({
          viewport: viewport.name,
          viewportClass: viewport.expectedClass,
          columns: viewport.columns,
          initialWidgets: 2,
          operationSequence: ['ADD', 'MOVE', 'RESIZE', 'RESIZE', 'DUPLICATE', 'REMOVE', 'RESET'],
          nodeBrowserParity: true,
          keyboardActivation: true,
          overflow: final.overflow,
          semanticBinding: 'UNBOUND',
          persistence: 'SESSION_ONLY'
        });
        await page.screenshot({ path: path.join(artifactDir, `dashboard-composer-${viewport.name}.png`), fullPage: true });
      } finally {
        await page.close().catch(() => {});
      }
    }

    fs.writeFileSync(path.join(artifactDir, 'dashboard-composer-visual.json'), JSON.stringify({
      schema: 'PRH_DASHBOARD_COMPOSER_VISUAL_EVIDENCE_V1',
      version: '1.0.0',
      public_data: 'CONFIGURATION_ONLY',
      financial_payload: false,
      semantic_binding: 'UNBOUND',
      persistence: 'SESSION_ONLY',
      evidence
    }, null, 2));

    console.log('dashboard-composer-visual: PASS', {
      viewports: evidence.map((item) => item.viewport),
      nodeBrowserParity: true,
      keyboardActivation: true,
      sessionOnly: true,
      semanticBinding: 'UNBOUND'
    });
  } finally {
    await browser.close().catch(() => {});
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
