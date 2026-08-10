'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000, maxPageHeight: 1700 },
  { name: 'laptop', width: 1024, height: 900, maxPageHeight: 2400 },
  { name: 'mobile', width: 390, height: 844, maxPageHeight: 5000 }
];
function expect(condition, message) { if (!condition) throw new Error(message); }

(async () => {
  const root = path.join(__dirname, '..');
  const artifactDir = path.join(root, 'artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });
  const htmlPath = path.join(root, 'ExpenseAnalyticsWebApp.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  expect(html.includes('PRH_EXPENSE_ANALYTICS_VIEW_V1'), 'Expense view schema marker missing');
  expect(html.includes('synthetic:true'), 'Public preview must be explicitly synthetic');
  expect(html.includes('SYN-ACCOUNT') && html.includes('SYN-FOOD'), 'Public preview must use synthetic identifiers');
  expect(html.includes('FIN-TRUTH-v1') && html.includes('PRH_KPI_DICTIONARY_V1'), 'FIN truth provenance missing');
  expect(html.includes('LINE • VIZ-020') && html.includes('DONUT • VIZ-020') && html.includes('BAR • VIZ-020'), 'VIZ widget markers missing');
  expect(!/https?:\/\/(?:cdn\.|unpkg\.|jsdelivr\.)/i.test(html), 'Expense Analytics must not require external CDN');

  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
    await page.waitForTimeout(250);
    expect(!errors.length, `[${viewport.name}] startup errors: ${errors.join(' | ')}`);
    const result = await page.evaluate((maxPageHeight) => {
      const root = document.documentElement, body = document.body;
      const clipped = Array.from(document.querySelectorAll('.card,.card-label,.value,.meta,.panel h2,.section-note,.mix-name,.mix-value,.driver-name,.driver-value,.period-pill'))
        .filter((el) => el.scrollWidth > el.clientWidth + 3 || el.scrollHeight > el.clientHeight + 3)
        .map((el) => el.textContent.trim().replace(/\s+/g, ' ').slice(0, 90));
      return {
        overflow: Math.max(root.scrollWidth, body.scrollWidth) - innerWidth,
        pageHeight: Math.max(root.scrollHeight, body.scrollHeight), maxPageHeight, clipped,
        summaryCards: document.querySelectorAll('.summary .card').length,
        trendBars: document.querySelectorAll('#trend .trend-bar').length,
        mixRows: document.querySelectorAll('#mix .mix-row').length,
        driverRows: document.querySelectorAll('#drivers .driver-row').length,
        truth: document.getElementById('truth-note')?.textContent || ''
      };
    }, viewport.maxPageHeight);
    expect(result.overflow <= 1, `[${viewport.name}] horizontal overflow ${result.overflow}`);
    expect(result.pageHeight <= result.maxPageHeight, `[${viewport.name}] page too tall ${result.pageHeight}`);
    expect(!result.clipped.length, `[${viewport.name}] clipped: ${result.clipped.join('; ')}`);
    expect(result.summaryCards === 3, `[${viewport.name}] summary cards missing`);
    expect(result.trendBars === 2, `[${viewport.name}] trend points missing`);
    expect(result.mixRows === 3, `[${viewport.name}] category mix missing`);
    expect(result.driverRows === 3, `[${viewport.name}] driver rows missing`);
    expect(result.truth.includes('FIN-TRUTH-v1'), `[${viewport.name}] financial truth note missing`);

    await page.evaluate(() => { window.__expenseDrill = null; window.addEventListener('prh-expense-drill', (event) => { window.__expenseDrill = event.detail; }, { once: true }); });
    await page.click('[data-drill-category="SYN-FOOD"]');
    await page.waitForFunction(() => window.__expenseDrill !== null);
    const drill = await page.evaluate(() => window.__expenseDrill);
    expect(drill.schema === 'PRH_EXPENSE_DRILL_ENVELOPE_V1', `[${viewport.name}] expense drill envelope missing`);
    expect(drill.period.start === '2026-01-01' && drill.period.end === '2026-03-01', `[${viewport.name}] period not preserved`);
    expect(drill.drill_context.schema === 'PRH_DRILL_CONTEXT_V1' && drill.drill_context.target === 'TRANSACTION_EXPLORER', `[${viewport.name}] VIZ/TX drill context missing`);
    expect(drill.explorer_query.category_ids[0] === 'SYN-FOOD', `[${viewport.name}] category filter not preserved`);
    expect(drill.explorer_query.account_ids[0] === 'SYN-ACCOUNT', `[${viewport.name}] account filter not preserved`);
    const drillText = JSON.stringify(drill);
    for (const forbidden of ['amount_minor','expense_minor','total_expense_minor','comparison_expense_minor','delta_minor','value_minor']) {
      expect(!drillText.includes(forbidden), `[${viewport.name}] financial payload leaked into drill: ${forbidden}`);
    }
    expect(!errors.length, `[${viewport.name}] JavaScript errors: ${errors.join(' | ')}`);
    results.push(result);
    await page.screenshot({ path: path.join(artifactDir, `expense-analytics-${viewport.name}.png`), fullPage: true });
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(artifactDir, 'expense-analytics-layout.json'), JSON.stringify({ schema:'PRH_EXPENSE_ANALYTICS_VISUAL_EVIDENCE_V1', privacy_class:'PUBLIC_SYNTHETIC', results }, null, 2));
  console.log('expense_analytics_visual_test: OK', { privacy:'PUBLIC_SYNTHETIC', results });
})().catch((error) => { console.error(error); process.exit(1); });
