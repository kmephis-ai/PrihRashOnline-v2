'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000, maxPageHeight: 1700 },
  { name: 'laptop', width: 1024, height: 900, maxPageHeight: 2600 },
  { name: 'mobile', width: 390, height: 844, maxPageHeight: 5000 }
];
const RUSSIAN_CARD_LABELS = ['Доходы','Расходы','Денежный поток','Сбережения','Бюджет','Ликвидность','Сигналы'];
const FORBIDDEN_VISIBLE = [
  'INCOME','EXPENSE','CASH FLOW','SAVINGS','BUDGET','LIQUIDITY','ALERTS',
  'FIN-TRUTH','KPI','VIZ-020','BAL-030','Synthetic','versioned','Показать контекст','FIN-010'
];

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function inspect(page, viewport) {
  return page.evaluate((maxPageHeight) => {
    const root = document.documentElement;
    const body = document.body;
    const clipped = Array.from(document.querySelectorAll('.card,.card-label,.value,.meta,.budget-cell,.panel h3,.section-note,.period-pill,.mix-name'))
      .filter((el) => el.scrollWidth > el.clientWidth + 3 || el.scrollHeight > el.clientHeight + 3)
      .map((el) => el.textContent.trim().replace(/\s+/g, ' ').slice(0, 90));
    return {
      overflow: Math.max(root.scrollWidth, body.scrollWidth) - innerWidth,
      pageHeight: Math.max(root.scrollHeight, body.scrollHeight),
      maxPageHeight,
      clipped,
      cards: document.querySelectorAll('[data-home-card]').length,
      cardLabels: Array.from(document.querySelectorAll('.card-label')).map((el) => el.textContent.trim()),
      alerts: document.querySelectorAll('.alert-chip').length,
      interactiveAlerts: document.querySelectorAll('#alert-strip button,#alert-strip a').length,
      drillActions: document.querySelectorAll('[data-drill-card],.drill').length,
      trendBars: document.querySelectorAll('#cashflow-chart .bar').length,
      trendFallback: document.querySelector('#cashflow-chart.visual-empty')?.textContent.replace(/\s+/g, ' ').trim() || '',
      mixRows: document.querySelectorAll('#expense-mix .mix-row').length,
      liquidity: document.querySelector('[data-home-card="LIQUIDITY"]')?.textContent.replace(/\s+/g, ' ').trim() || '',
      budget: document.querySelector('[data-home-card="BUDGET"]')?.textContent.replace(/\s+/g, ' ').trim() || '',
      truth: document.getElementById('truth-note')?.textContent || '',
      visibleText: document.body.innerText.replace(/\s+/g, ' ').trim()
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
  expect(html.includes('synthetic:true'), 'Public preview must remain explicitly synthetic in source');
  expect(html.includes('SYN-ACCOUNT'), 'Public preview must use synthetic identifiers');
  expect(!/https?:\/\/(?:cdn\.|unpkg\.|jsdelivr\.)/i.test(html), 'Financial Home must not require external CDN');
  expect(html.includes('VERSIONED_BALANCE_OBSERVATION_REQUIRED'), 'Internal liquidity contract fixture missing');
  expect(html.includes('cash_flow_proxy_used:false'), 'Liquidity proxy prohibition missing');
  expect(!html.includes('data-drill-card='), 'Source Home must not render fake drill affordances');
  expect(!html.includes('Показать контекст'), 'Source Home must not render fake context action');

  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
    await page.waitForTimeout(200);
    expect(!errors.length, `[${viewport.name}] startup errors: ${errors.join(' | ')}`);

    const result = await inspect(page, viewport);
    expect(result.overflow <= 1, `[${viewport.name}] horizontal overflow ${result.overflow}`);
    expect(result.pageHeight <= result.maxPageHeight, `[${viewport.name}] page too tall ${result.pageHeight}`);
    expect(!result.clipped.length, `[${viewport.name}] clipped: ${result.clipped.join('; ')}`);
    expect(result.cards === 7, `[${viewport.name}] expected 7 Home cards, got ${result.cards}`);
    expect(JSON.stringify(result.cardLabels) === JSON.stringify(RUSSIAN_CARD_LABELS), `[${viewport.name}] visible card labels are not Russian household labels: ${result.cardLabels.join(', ')}`);
    expect(result.alerts >= 1, `[${viewport.name}] alerts summary missing`);
    expect(result.interactiveAlerts === 0, `[${viewport.name}] alerts are interactive without a proven destination`);
    expect(result.drillActions === 0, `[${viewport.name}] false drill actions remain`);
    expect(result.trendBars === 5, `[${viewport.name}] public synthetic preview trend fixture missing`);
    expect(result.mixRows === 3, `[${viewport.name}] synthetic expense mix missing`);
    expect(/Недоступно/.test(result.liquidity) && /остатках на счетах/.test(result.liquidity), `[${viewport.name}] human liquidity state missing`);
    expect(!/BAL-|versioned|source/i.test(result.liquidity), `[${viewport.name}] developer liquidity terminology visible`);
    expect(/План/.test(result.budget) && /Отклонение/.test(result.budget), `[${viewport.name}] budget summary missing`);
    expect(!/FIN-TRUTH|KPI|VIZ/i.test(result.truth), `[${viewport.name}] developer provenance visible in truth note`);
    for (const forbidden of FORBIDDEN_VISIBLE) {
      expect(!result.visibleText.includes(forbidden), `[${viewport.name}] forbidden household-visible term: ${forbidden}`);
    }

    results.push(result);
    await page.screenshot({ path: path.join(artifactDir, `financial-home-${viewport.name}.png`), fullPage: true });
    await page.close();
  }

  const onePeriodHtml = html.replace('cash_flow_minor:[12000,18000,9000,24000,30000]', 'cash_flow_minor:[30000]');
  expect(onePeriodHtml !== html, 'One-period truthful visual fixture replacement failed');
  const onePeriodPath = path.join(os.tmpdir(), `prh-home-one-period-${process.pid}.html`);
  fs.writeFileSync(onePeriodPath, onePeriodHtml, 'utf8');
  const fallbackPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const fallbackErrors = [];
  fallbackPage.on('pageerror', (error) => fallbackErrors.push(error.message));
  await fallbackPage.goto(`file://${onePeriodPath}`, { waitUntil: 'load' });
  await fallbackPage.waitForTimeout(150);
  const fallback = await inspect(fallbackPage, { maxPageHeight: 2000 });
  expect(!fallbackErrors.length, `one-period startup errors: ${fallbackErrors.join(' | ')}`);
  expect(fallback.trendBars === 0, 'One-period data must not masquerade as a trend chart');
  expect(/недостаточно данных/i.test(fallback.trendFallback), 'One-period data needs an honest insufficient-history state');
  await fallbackPage.close();
  fs.rmSync(onePeriodPath, { force: true });

  await browser.close();
  fs.writeFileSync(
    path.join(artifactDir, 'financial-home-layout.json'),
    JSON.stringify({ schema: 'PRH_FINANCIAL_HOME_VISUAL_EVIDENCE_V2', privacy_class: 'PUBLIC_SYNTHETIC', truthfulHouseholdUi: true, results }, null, 2)
  );
  console.log('financial_home_visual_test: OK', { privacy: 'PUBLIC_SYNTHETIC', truthfulHouseholdUi: true, results });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});