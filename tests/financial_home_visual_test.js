'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000, maxPageHeight: 1900 },
  { name: 'laptop', width: 1024, height: 900, maxPageHeight: 2800 },
  { name: 'mobile', width: 390, height: 844, maxPageHeight: 5200 }
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
    const clipped = Array.from(document.querySelectorAll('.card,.card-label,.value,.meta,.budget-cell,.panel h3,.section-note,.period-pill,.semantic-row'))
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
      legacyTrendBars: document.querySelectorAll('#cashflow-chart .bar').length,
      legacyMixRows: document.querySelectorAll('#expense-mix .mix-row').length,
      cashSemanticRows: document.querySelectorAll('#cashflow-chart .semantic-row').length,
      expenseSemanticRows: document.querySelectorAll('#expense-mix .semantic-row').length,
      cashClass: document.getElementById('cashflow-chart')?.className || '',
      expenseClass: document.getElementById('expense-mix')?.className || '',
      liquidity: document.querySelector('[data-home-card="LIQUIDITY"]')?.textContent.replace(/\s+/g, ' ').trim() || '',
      budget: document.querySelector('[data-home-card="BUDGET"]')?.textContent.replace(/\s+/g, ' ').trim() || '',
      truth: document.getElementById('truth-note')?.textContent || '',
      visualReady: root.getAttribute('data-home-visual-ready') || '',
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
  const visualRuntimeSource = fs.readFileSync(path.join(root, 'R2VisualizationRuntimeService.js'), 'utf8');

  expect(html.includes('PRH_FINANCIAL_HOME_VIEW_V1'), 'Financial Home view schema marker missing');
  expect(html.includes('PRH_R2_HOUSEHOLD_VISUAL_PRESENTATION_V1'), 'Visual presentation schema marker missing');
  expect(html.includes('synthetic:true'), 'Public preview must remain explicitly synthetic in source');
  expect(html.includes('synthetic_compiled_fixture:true'), 'Browser bridge needs explicit synthetic compiled fixture');
  expect(html.includes('SYN-ACCOUNT'), 'Public preview must use synthetic identifiers');
  expect(html.includes('<!-- PRH_LOCAL_ECHARTS_VENDOR -->'), 'Local ECharts packager placeholder missing');
  expect(!/https?:\/\/(?:cdn\.|unpkg\.|jsdelivr\.)/i.test(html), 'Financial Home must not require external CDN');
  expect(html.includes('VERSIONED_BALANCE_OBSERVATION_REQUIRED'), 'Internal liquidity contract fixture missing');
  expect(html.includes('cash_flow_proxy_used:false'), 'Liquidity proxy prohibition missing');
  expect(!html.includes('data-drill-card='), 'Source Home must not render fake drill affordances');
  expect(!html.includes('Показать контекст'), 'Source Home must not render fake context action');
  expect(html.includes('.prhR2FetchFinancialHomeVisualPayload(marker.privacy_mode||\'NORMAL\')'), 'Separate async visual RPC missing');
  expect(html.includes('instance.setOption(compiled.option'), 'Browser must pass the server-compiled option directly to ECharts');
  expect(!html.includes('Math.round(value/total*100)'), 'Browser must not rebuild expense percentages as chart authority');
  expect(!html.includes('class="bar"'), 'CSS pseudo-trend must be removed');
  expect(!html.includes('class="mix-row"'), 'Legacy percentage-bar expense mix must be removed');

  expect(visualRuntimeSource.includes("SCHEMA: 'PRH_R2_HOUSEHOLD_VISUAL_PRESENTATION_V1'"), 'Server visual presentation boundary missing');
  expect(visualRuntimeSource.includes('chart_options_redacted: true'), 'MASKED chart-option redaction marker missing');
  expect(visualRuntimeSource.includes('private_visual_runtime_read: false'), 'MASKED visual runtime no-read marker missing');
  const endpointStart = visualRuntimeSource.indexOf('function prhR2FetchFinancialHomeVisualPayload');
  expect(endpointStart >= 0, 'Public async visual endpoint missing');
  const endpointSource = visualRuntimeSource.slice(endpointStart);
  expect(endpointSource.indexOf('PRH_R2_VISUAL_PRESENTATION.MASKED') < endpointSource.indexOf('prhR2BuildFinancialHomeVisualRuntime_()'), 'MASKED endpoint must redact before any private visual runtime read');

  const visualContext = vm.createContext({ console });
  vm.runInContext(visualRuntimeSource, visualContext, { filename: 'R2VisualizationRuntimeService.js' });
  const masked = visualContext.prhR2VisualPresentation_('MASKED', null);
  const maskedJson = JSON.stringify(masked);
  expect(masked.schema === 'PRH_R2_HOUSEHOLD_VISUAL_PRESENTATION_V1', 'MASKED presentation schema invalid');
  expect(masked.mode === 'MASKED' && masked.status === 'REDACTED', 'MASKED presentation state invalid');
  expect(masked.charts.cash_flow === null && masked.charts.expense_mix === null, 'MASKED presentation must not contain chart options');
  expect(masked.cash_flow_periods.length === 0 && masked.expense_mix.length === 0, 'MASKED presentation must not contain raw visual values');
  expect(masked.privacy.private_visual_runtime_read === false, 'MASKED presentation must not require private visual runtime');
  expect(!/cash_flow_minor|series|value_minor|31000|30000/.test(maskedJson), 'MASKED presentation leaked numeric chart payload');

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
    expect(result.legacyTrendBars === 0, `[${viewport.name}] CSS pseudo-trend remains`);
    expect(result.legacyMixRows === 0, `[${viewport.name}] legacy expense percentage bars remain`);
    expect(result.cashSemanticRows === 5, `[${viewport.name}] semantic cash-flow fallback must preserve five synthetic preview periods`);
    expect(result.expenseSemanticRows === 3, `[${viewport.name}] semantic expense fallback must preserve three synthetic preview categories`);
    expect(result.visualReady === 'FALLBACK', `[${viewport.name}] raw source preview should use semantic fallback without bundled vendor`);
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

  const bridgePage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const bridgeErrors = [];
  bridgePage.on('pageerror', (error) => bridgeErrors.push(error.message));
  await bridgePage.addInitScript(() => {
    window.__prhEchartsCalls = [];
    window.echarts = {
      getInstanceByDom() { return null; },
      init(host) {
        return {
          setOption(option, settings) {
            window.__prhEchartsCalls.push({ id: host.id, option, settings });
            host.dataset.echartsRendered = '1';
          },
          resize() {},
          dispose() {}
        };
      }
    };
  });
  await bridgePage.goto(`file://${htmlPath}`, { waitUntil: 'load' });
  await bridgePage.waitForTimeout(150);
  const bridge = await bridgePage.evaluate(() => ({
    calls: window.__prhEchartsCalls,
    cashRendered: document.getElementById('cashflow-chart')?.dataset.echartsRendered || '',
    expenseRendered: document.getElementById('expense-mix')?.dataset.echartsRendered || '',
    visualReady: document.documentElement.getAttribute('data-home-visual-ready') || ''
  }));
  expect(!bridgeErrors.length, `ECharts bridge startup errors: ${bridgeErrors.join(' | ')}`);
  expect(bridge.calls.length === 2, `ECharts bridge must initialize exactly two charts, got ${bridge.calls.length}`);
  expect(bridge.calls[0].id === 'cashflow-chart' && bridge.calls[0].option.series[0].type === 'line', 'Cash-flow server option was not passed to ECharts');
  expect(bridge.calls[1].id === 'expense-mix' && bridge.calls[1].option.series[0].type === 'pie', 'Expense server option was not passed to ECharts');
  expect(bridge.calls.every((call) => call.settings && call.settings.notMerge === true), 'ECharts bridge must use bounded replacement semantics');
  expect(bridge.cashRendered === '1' && bridge.expenseRendered === '1' && bridge.visualReady === '1', 'ECharts bridge render markers missing');
  await bridgePage.close();

  const onePeriodHtml = html.replace('cash_flow_minor:[12000,18000,9000,24000,30000]', 'cash_flow_minor:[30000]');
  expect(onePeriodHtml !== html, 'One-period truthful visual fixture replacement failed');
  const onePeriodPath = path.join(os.tmpdir(), `prh-home-one-period-${process.pid}.html`);
  fs.writeFileSync(onePeriodPath, onePeriodHtml, 'utf8');
  const fallbackPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const fallbackErrors = [];
  fallbackPage.on('pageerror', (error) => fallbackErrors.push(error.message));
  await fallbackPage.goto(`file://${onePeriodPath}`, { waitUntil: 'load' });
  await fallbackPage.waitForTimeout(120);
  const fallback = await inspect(fallbackPage, { maxPageHeight: 2200 });
  expect(!fallbackErrors.length, `one-period startup errors: ${fallbackErrors.join(' | ')}`);
  expect(fallback.legacyTrendBars === 0, 'One-period data must never render the removed CSS pseudo-trend');
  expect(fallback.cashSemanticRows === 1, 'One-period data may only render one truthful semantic row');
  expect(!/echart-host/.test(fallback.cashClass), 'One-period raw fallback must not masquerade as an ECharts trend');
  await fallbackPage.close();
  fs.rmSync(onePeriodPath, { force: true });

  await browser.close();
  fs.writeFileSync(
    path.join(artifactDir, 'financial-home-layout.json'),
    JSON.stringify({
      schema: 'PRH_FINANCIAL_HOME_VISUAL_EVIDENCE_V3',
      privacy_class: 'PUBLIC_SYNTHETIC',
      truthfulHouseholdUi: true,
      localEchartsBridge: true,
      serverCompiledOptions: true,
      maskedChartOptionRedaction: true,
      cssPseudoTrendRemoved: true,
      semanticFallback: true,
      results
    }, null, 2)
  );
  console.log('financial_home_visual_test: OK', {
    privacy: 'PUBLIC_SYNTHETIC',
    truthfulHouseholdUi: true,
    localEchartsBridge: true,
    serverCompiledOptions: true,
    maskedChartOptionRedaction: true,
    cssPseudoTrendRemoved: true,
    semanticFallback: true,
    results
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});