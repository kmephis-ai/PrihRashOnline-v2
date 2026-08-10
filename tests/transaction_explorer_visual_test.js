'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const VIEWPORTS = [
  { name:'desktop', width:1600, height:1000, maxPageHeight:1900 },
  { name:'laptop', width:1280, height:900, maxPageHeight:2200 },
  { name:'mobile', width:390, height:844, maxPageHeight:7200 }
];

function expect(condition, message) { if (!condition) throw new Error(message); }

(async () => {
  const root = path.join(__dirname, '..');
  const artifactDir = path.join(root, 'artifacts');
  fs.mkdirSync(artifactDir, { recursive:true });
  const htmlPath = path.join(root, 'TransactionExplorerWebApp.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  expect(html.includes('data-privacy="PUBLIC_SYNTHETIC"'), 'Explorer visual surface must be explicitly synthetic');
  expect(html.includes('GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED'), 'Explorer UI must expose fail-closed write state');
  expect(!/https?:\/\//i.test(html), 'Explorer visual surface must not require external network resources');

  const browser = await chromium.launch({ headless:true });
  const results = [];
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport:{ width:viewport.width, height:viewport.height }, deviceScaleFactor:1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`file://${htmlPath}`, { waitUntil:'load' });
    await page.waitForTimeout(150);
    expect(!errors.length, `[${viewport.name}] startup error: ${errors.join(' | ')}`);

    const initial = await page.evaluate(() => ({
      overflow:Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      pageHeight:Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      matched:Number(document.getElementById('matched').textContent),
      rows:document.querySelectorAll('.tx-row').length,
      pageLabel:document.getElementById('page-label').textContent,
      filterCount:document.querySelectorAll('.filters .field').length,
      clipped:Array.from(document.querySelectorAll('.filters input,.filters select,.pager button,.tx-row'))
        .filter((el) => el.scrollWidth > el.clientWidth + 3 || el.scrollHeight > el.clientHeight + 3)
        .map((el) => (el.textContent || el.value || '').trim().replace(/\s+/g,' ').slice(0,70))
    }));
    expect(initial.overflow <= 1, `[${viewport.name}] page horizontal overflow ${initial.overflow}`);
    expect(initial.pageHeight <= viewport.maxPageHeight, `[${viewport.name}] page too tall ${initial.pageHeight}`);
    expect(initial.matched === 137, `[${viewport.name}] initial synthetic count mismatch`);
    expect(initial.rows === 20, `[${viewport.name}] bounded page must render 20 rows`);
    expect(initial.pageLabel.includes('из 7'), `[${viewport.name}] pagination total mismatch`);
    expect(initial.filterCount === 6, `[${viewport.name}] expected six primary filter controls`);
    expect(!initial.clipped.length, `[${viewport.name}] clipped primary controls: ${initial.clipped.join('; ')}`);

    await page.selectOption('#type', 'expense');
    await page.selectOption('#status', 'posted');
    await page.fill('#search', 'counterparty 3');
    await page.waitForTimeout(50);
    const filtered = await page.evaluate(() => ({
      matched:Number(document.getElementById('matched').textContent),
      rows:Array.from(document.querySelectorAll('.tx-row')).map((row) => row.textContent.replace(/\s+/g,' ')),
      state:document.getElementById('query-state').textContent
    }));
    expect(filtered.matched > 0 && filtered.matched < 137, `[${viewport.name}] filters did not narrow results`);
    expect(filtered.rows.every((text) => text.includes('Расход') && text.includes('Проведено')), `[${viewport.name}] filtered rows violate type/status`);
    expect(filtered.state.includes('filters:2'), `[${viewport.name}] query state did not preserve active filters`);

    await page.fill('#search', '');
    await page.selectOption('#type', '');
    await page.selectOption('#status', '');
    await page.selectOption('#sort', 'amount-desc');
    await page.waitForTimeout(50);
    const amounts = await page.evaluate(() => Array.from(document.querySelectorAll('.tx-row .money')).slice(0,5).map((el) => el.textContent.trim()));
    expect(amounts.length === 5, `[${viewport.name}] sorted page missing rows`);

    await page.click('#next');
    expect((await page.textContent('#page-label')).includes('Страница 2'), `[${viewport.name}] next-page interaction failed`);
    await page.click('#prev');
    expect((await page.textContent('#page-label')).includes('Страница 1'), `[${viewport.name}] previous-page interaction failed`);

    await page.click('.tx-row');
    await page.waitForFunction(() => document.getElementById('drawer').classList.contains('open'));
    const drawer = await page.evaluate(() => ({
      hidden:document.getElementById('drawer').getAttribute('aria-hidden'),
      id:document.getElementById('edit-id').textContent,
      policy:document.getElementById('drawer').textContent.replace(/\s+/g,' '),
      amount:document.getElementById('edit-amount').value
    }));
    expect(drawer.hidden === 'false', `[${viewport.name}] edit drawer not accessible`);
    expect(/^SYN-TX-/.test(drawer.id), `[${viewport.name}] edit drawer must use synthetic transaction`);
    expect(drawer.policy.includes('WRITE_BLOCKED') && drawer.policy.includes('GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED'), `[${viewport.name}] fail-closed write policy missing`);
    expect(Number(drawer.amount) >= 0, `[${viewport.name}] edit amount invalid`);
    await page.click('#save');
    const saveResult = await page.textContent('#save-result');
    expect(saveResult.includes('WRITE_BLOCKED') && saveResult.includes('данные не изменены'), `[${viewport.name}] save action must remain blocked`);

    // The drawer is modal by design: background controls must remain non-interactive while it is open.
    // Close the modal before testing an unrelated global theme control.
    await page.click('#drawer-close');
    await page.waitForFunction(() => {
      const drawer = document.getElementById('drawer');
      return !drawer.classList.contains('open') && drawer.getAttribute('aria-hidden') === 'true';
    });

    await page.click('#theme-toggle');
    expect(await page.getAttribute('html','data-theme') === 'dark', `[${viewport.name}] theme toggle failed`);
    expect(!errors.length, `[${viewport.name}] runtime errors: ${errors.join(' | ')}`);

    const metrics = await page.evaluate(() => ({
      overflow:Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      pageHeight:Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      drawerOpen:document.getElementById('drawer').classList.contains('open'),
      writeBlocked:document.getElementById('save-result').textContent.includes('WRITE_BLOCKED')
    }));
    expect(metrics.overflow <= 1, `[${viewport.name}] interaction introduced horizontal overflow ${metrics.overflow}`);
    expect(metrics.drawerOpen === false, `[${viewport.name}] modal drawer must be closed before background interaction`);
    expect(metrics.writeBlocked === true, `[${viewport.name}] blocked-save evidence must remain visible in state`);
    results.push({ viewport:viewport.name, ...metrics });
    await page.screenshot({ path:path.join(artifactDir, `transaction-explorer-${viewport.name}.png`), fullPage:true });
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(artifactDir, 'transaction-explorer-layout.json'), JSON.stringify({ fixture:'PUBLIC_SYNTHETIC', results }, null, 2));
  console.log('transaction_explorer_visual_test: OK', { privacy:'PUBLIC_SYNTHETIC', results });
})().catch((error) => { console.error(error); process.exit(1); });
