'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { generateSyntheticDashboardFixture } = require('./fixtures/synthetic_dashboard');

const VIEWPORTS = [
  { name:'desktop', width:1600, height:1000, maxPageHeight:1650 },
  { name:'laptop', width:1280, height:900, maxPageHeight:2850 },
  { name:'mobile', width:390, height:844, maxPageHeight:6800 }
];
const VIEWS = [
  ['overview','Обзор'],['years','Годы'],['months','Месяцы'],['month','Месяц'],
  ['seasonality','Сезонность'],['structure','Структура'],['operations','Операции'],
  ['forecast','Прогноз'],['quality','Качество'],['details','Детали']
];

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function spread(values) {
  return values.length ? Math.max(...values) - Math.min(...values) : 0;
}

function buildSyntheticHtml(html, fixture) {
  const json = JSON.stringify(fixture).replace(/</g, '\\u003c');
  const result = html.replace('<?!= initialData ?>', json);
  expect(result !== html, 'Synthetic initial-data injection failed');
  return result;
}

async function inspectOverview(page, viewport) {
  return page.evaluate(({ maxPageHeight, mobile }) => {
    const root = document.documentElement;
    const body = document.body;
    const month = document.getElementById('month-select');
    const filterHeights = Array.from(document.querySelectorAll('[data-testid="filter-card"]'))
      .map((el) => Math.round(el.getBoundingClientRect().height));
    const kpiRects = Array.from(document.querySelectorAll('[data-testid="kpi-card"]'))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return { top:Math.round(rect.top), height:Math.round(rect.height) };
      });
    const rowMap = {};
    kpiRects.forEach((rect) => {
      const rowKey = Object.keys(rowMap).find((key) => Math.abs(Number(key) - rect.top) <= 2) || String(rect.top);
      if (!rowMap[rowKey]) rowMap[rowKey] = [];
      rowMap[rowKey].push(rect.height);
    });
    const clipped = Array.from(document.querySelectorAll('.filter-card,.kpi-card,.secondary-card,.panel-title,.metric-value,.kpi-value,.secondary-value,.tab,.view-context'))
      .filter((el) => el.scrollWidth > el.clientWidth + 3 || el.scrollHeight > el.clientHeight + 3)
      .map((el) => el.textContent.trim().replace(/\s+/g,' ').slice(0,80));
    return {
      overflow:Math.max(root.scrollWidth, body.scrollWidth) - innerWidth,
      pageHeight:Math.max(root.scrollHeight, body.scrollHeight),
      maxPageHeight,
      clipped,
      tabCount:document.querySelectorAll('.tab').length,
      activeTabs:document.querySelectorAll('.tab.active[aria-selected="true"]').length,
      kpis:document.querySelectorAll('[data-testid="kpi-card"]').length,
      secondary:document.querySelectorAll('[data-testid="secondary-kpi"]').length,
      filters:document.querySelectorAll('[data-testid="filter-card"]').length,
      yearBars:document.querySelectorAll('#yearly-chart rect').length,
      month:Number(month.value),
      monthLabel:month.options[month.selectedIndex].textContent,
      periodNote:document.getElementById('period-note').textContent,
      quality:document.getElementById('quality-value').textContent,
      structure:document.getElementById('structure-legend').textContent.replace(/\s+/g,' '),
      chartCount:Array.from(document.querySelectorAll('.chart-host')).filter((el) => el.querySelector('svg,.chart-empty')).length,
      scrollbar:mobile ? getComputedStyle(document.getElementById('tabs')).scrollbarWidth : null,
      filterHeights,
      kpiRows:Object.values(rowMap)
    };
  }, { maxPageHeight:viewport.maxPageHeight, mobile:viewport.width <= 760 });
}

function assertOverview(result, fixture, viewport) {
  const label = viewport.name;
  expect(result.overflow <= 1, `[${label}] horizontal overflow ${result.overflow}`);
  expect(result.pageHeight <= result.maxPageHeight, `[${label}] page too tall ${result.pageHeight}`);
  expect(!result.clipped.length, `[${label}] clipped: ${result.clipped.join('; ')}`);
  expect(result.tabCount === 10 && result.activeTabs === 1, `[${label}] tab contract failed`);
  expect(result.kpis === 9 && result.secondary === 6 && result.filters === 5, `[${label}] dashboard card counts invalid`);
  expect(result.month === fixture.period.monthIndex && result.monthLabel === fixture.period.month, `[${label}] synthetic period mismatch`);
  expect(result.periodNote.includes(fixture.period.latestDate), `[${label}] latest-date note mismatch`);
  expect(result.quality.includes('/100'), `[${label}] quality format mismatch`);
  expect(result.yearBars === fixture.yearlyIncome.length, `[${label}] synthetic year chart mismatch`);
  expect(result.chartCount === 2, `[${label}] charts not rendered`);
  expect(result.structure.includes(fixture.monthStructure[0].label), `[${label}] synthetic structure missing`);
  if (viewport.width > 1250) expect(spread(result.filterHeights) <= 2, `[${label}] filter height mismatch`);
  result.kpiRows.forEach((row, index) => {
    expect(spread(row) <= 4, `[${label}] KPI row ${index + 1} height mismatch`);
  });
  if (result.scrollbar) expect(result.scrollbar === 'none', `[${label}] mobile scrollbar visible`);
}

async function assertViews(page, fixture) {
  for (const [view, title] of VIEWS) {
    await page.click(`.tab[data-view="${view}"]`);
    await page.waitForFunction((expected) => document.querySelector('.tab.active')?.dataset.view === expected, view);
    const state = await page.evaluate((currentView) => {
      const detail = document.getElementById('view-detail');
      return {
        active:document.querySelector('.tab.active')?.dataset.view,
        title:document.getElementById('view-title').textContent.trim(),
        hidden:detail.hidden,
        text:document.getElementById('detail-content').textContent.trim(),
        monthOps:currentView === 'months'
          ? Array.from(document.querySelectorAll('#detail-content tbody tr')).map((row) => row.children[1]?.textContent.trim())
          : []
      };
    }, view);
    expect(state.active === view && state.title === title, `View ${view} activation failed`);
    if (view === 'overview') expect(state.hidden, 'Overview detail must be hidden');
    else expect(!state.hidden && state.text, `View ${view} detail missing`);
    if (view === 'months') {
      const expected = fixture.monthlyIncome.map((item) => String(item.operations));
      expect(JSON.stringify(state.monthOps) === JSON.stringify(expected), 'Monthly counts differ from synthetic fixture');
    }
  }

  await page.click('.tab[data-view="overview"]');
  await page.waitForFunction(() => document.getElementById('view-detail').hidden);
}

async function assertDrilldowns(page, fixture) {
  await page.click('[data-testid="kpi-card"][data-drilldown="month"]');
  await page.waitForSelector('#view-detail:not([hidden])');
  const month = await page.evaluate(() => ({
    title:document.getElementById('detail-title').textContent,
    rows:document.querySelectorAll('#detail-content tbody tr').length,
    allSynthetic:Array.from(document.querySelectorAll('#detail-content tbody tr'))
      .every((row) => row.textContent.includes('Synthetic'))
  }));
  expect(month.title.includes(fixture.drilldowns.month.title), 'Synthetic month drill-down title mismatch');
  expect(month.rows === fixture.drilldowns.month.rows.length && month.allSynthetic, 'Month drill-down is not fully synthetic');
  await page.click('[data-close-drilldown]');
  await page.waitForFunction(() => document.getElementById('view-detail').hidden);

  await page.click('[data-testid="secondary-kpi"][data-drilldown="duplicates"]');
  await page.waitForSelector('#view-detail:not([hidden])');
  const duplicateTitle = await page.textContent('#detail-title');
  expect(duplicateTitle.includes(fixture.drilldowns.duplicates.title), 'Duplicate drill-down mismatch');
}

(async () => {
  const root = path.join(__dirname,'..');
  const artifactDir = path.join(root,'artifacts');
  fs.mkdirSync(artifactDir,{recursive:true});
  const html = fs.readFileSync(path.join(root,'DashboardWebApp.html'),'utf8');
  expect(html.includes('id="executive-secondary"') && html.includes('id="action-bar"'), 'Prepared v1 RC bundle is required');

  const fixture = generateSyntheticDashboardFixture({ seed:20260808 });
  expect(fixture.testMetadata.synthetic === true && fixture.testMetadata.privacy_class === 'PUBLIC_SYNTHETIC', 'Visual input must be synthetic');
  const syntheticHtmlPath = path.join(artifactDir,'dashboard-web-synthetic.html');
  fs.writeFileSync(syntheticHtmlPath, buildSyntheticHtml(html,fixture), 'utf8');

  const browser = await chromium.launch({headless:true});
  const results = [];
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1});
    const errors = [];
    page.on('pageerror',(error) => errors.push(error.message));
    await page.goto(`file://${syntheticHtmlPath}`,{waitUntil:'load'});
    await page.waitForTimeout(750);
    expect(!errors.length, `[${viewport.name}] startup errors: ${errors.join(' | ')}`);
    const result = await inspectOverview(page,viewport);
    assertOverview(result,fixture,viewport);
    await assertViews(page,fixture);
    await assertDrilldowns(page,fixture);
    expect(!errors.length, `[${viewport.name}] JavaScript errors: ${errors.join(' | ')}`);
    results.push(result);
    await page.screenshot({path:path.join(artifactDir,`dashboard-web-${viewport.name}.png`),fullPage:true});
    await page.close();
  }

  fs.writeFileSync(path.join(artifactDir,'dashboard-web-layout.json'),JSON.stringify({build:'synthetic-test-fixture',fixture:fixture.testMetadata,results},null,2));
  await browser.close();
  console.log('dashboard_web_visual_test: OK',{build:'synthetic-test-fixture',results});
})().catch((error) => { console.error(error); process.exit(1); });
