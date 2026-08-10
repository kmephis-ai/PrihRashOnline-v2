'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000, maxPageHeight: 1600 },
  { name: 'laptop', width: 1024, height: 900, maxPageHeight: 2500 },
  { name: 'mobile', width: 390, height: 844, maxPageHeight: 5000 }
];

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function inspect(page, viewport) {
  return page.evaluate((maxPageHeight) => {
    const root = document.documentElement;
    const body = document.body;
    const clipped = Array.from(document.querySelectorAll('.card,.card-label,.value,.meta,.budget-cell,.panel h3,.section-note,.period-pill'))
      .filter((el) => el.scrollWidth > el.clientWidth + 3 || el.scrollHeight > el.clientHeight + 3)
      .map((el) => el.textContent.trim().replace(/\s+/g, ' ').slice(0, 90));
    return {
      overflow: Math.max(root.scrollWidth, body.scrollWidth) - innerWidth,
      pageHeight: Math.max(root.scrollHeight, body.scrollHeight),
      maxPageHeight,
      clipped,
      cards: document.querySelectorAll('[data-home-card]').length,
      alerts: document.querySelectorAll('.alert-chip').length,
      trendBars: document.querySelectorAll('#cashflow-chart .bar').length,
      mixRows: document.querySelectorAll('#expense-mix .mix-row').length,
      liquidity: document.querySelector('[data-home-card="LIQUIDITY"]')?.textContent.replace(/\s+/g, ' ').trim() || '',
      budget: document.querySelector('[data-home-card="BUDGET"]')?.textContent.replace(/\s+/g, ' ').trim() || '',
      truth: document.getElementById('truth-note')?.textContent || ''
    };
  }, viewport.maxPageHeight);
}

(async () => {
  const root = path.join(__dirname, '..');
  const artifactDir = path.join(root, 'artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });
  const htmlPath = path.join(root, 'FinancialHomeWebApp.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  expect(html.includes('PRH_FINANCIAL_HOME_VIEW_V1'), 'Financial Home view schema marker missing');
  expect(html.includes('synthetic:true'), 'Financial Home public preview must be explicitly synthetic');
  expect(html.includes('SYN-ACCOUNT'), 'Financial Home preview must use synthetic identifiers');
  expect(!/https?:\/\/(?:cdn\.|unpkg\.|jsdelivr\.)/i.test(html), 'Financial Home must not require external CDN');
  expect(html.includes('VERSIONED_BALANCE_OBSERVATION_REQUIRED'), 'Liquidity fail-safe reason missing');
  expect(html.includes('cash_flow_proxy_used:false'), 'Liquidity proxy prohibition missing');

  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    expect(!errors.length, `[${viewport.name}] startup errors: ${errors.join(' | ')}`);

    const result = await inspect(page, viewport);
    expect(result.overflow <= 1, `[${viewport.name}] horizontal overflow ${result.overflow}`);
    expect(result.pageHeight <= result.maxPageHeight, `[${viewport.name}] page too tall ${result.pageHeight}`);
    expect(!result.clipped.length, `[${viewport.name}] clipped: ${result.clipped.join('; ')}`);
    expect(result.cards === 7, `[${viewport.name}] expected 7 Home cards, got ${result.cards}`);
    expect(result.alerts >= 1, `[${viewport.name}] alerts summary missing`);
    expect(result.trendBars === 5, `[${viewport.name}] synthetic cash-flow trend missing`);
    expect(result.mixRows === 3, `[${viewport.name}] synthetic expense mix missing`);
    expect(/Недоступно/.test(result.liquidity) && /BAL-030/.test(result.liquidity), `[${viewport.name}] liquidity fail-safe UI missing`);
    expect(/План/.test(result.budget) && /Отклонение/.test(result.budget), `[${viewport.name}] budget summary missing`);
    expect(result.truth.includes('FIN-TRUTH-v1'), `[${viewport.name}] financial truth provenance missing`);

    await page.evaluate(() => {
      window.__homeDrill = null;
      window.addEventListener('prh-home-drill', (event) => { window.__homeDrill = event.detail; }, { once: true });
    });
    await page.click('[data-home-card="CASH_FLOW"] [data-drill-card="CASH_FLOW"]');
    await page.waitForFunction(() => window.__homeDrill !== null);
    const drill = await page.evaluate(() => window.__homeDrill);
    expect(drill.schema === 'PRH_HOME_DRILL_ENVELOPE_V1', `[${viewport.name}] Home drill envelope missing`);
    expect(drill.period.start === '2026-01-01' && drill.period.end === '2026-02-01', `[${viewport.name}] period not preserved`);
    expect(drill.drill_context.schema === 'PRH_DRILL_CONTEXT_V1', `[${viewport.name}] VIZ drill context missing`);
    expect(drill.drill_context.filter_context.filters[0].field === 'account_id', `[${viewport.name}] base filter field lost`);
    expect(drill.drill_context.filter_context.filters[0].values[0] === 'SYN-ACCOUNT', `[${viewport.name}] base filter value lost`);
    const drillText = JSON.stringify(drill);
    for (const forbidden of ['value_minor', 'amount_minor', 'income_minor', 'expense_minor', 'cash_flow_minor', 'budget_minor']) {
      expect(!drillText.includes(forbidden), `[${viewport.name}] financial payload leaked into navigation state: ${forbidden}`);
    }

    expect(!errors.length, `[${viewport.name}] JavaScript errors: ${errors.join(' | ')}`);
    results.push(result);
    await page.screenshot({ path: path.join(artifactDir, `financial-home-${viewport.name}.png`), fullPage: true });
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(
    path.join(artifactDir, 'financial-home-layout.json'),
    JSON.stringify({ schema: 'PRH_FINANCIAL_HOME_VISUAL_EVIDENCE_V1', privacy_class: 'PUBLIC_SYNTHETIC', results }, null, 2)
  );
  console.log('financial_home_visual_test: OK', { privacy: 'PUBLIC_SYNTHETIC', results });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});