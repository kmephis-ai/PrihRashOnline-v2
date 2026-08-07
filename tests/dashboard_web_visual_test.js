'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

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

function expect(condition, message) { if (!condition) throw new Error(message); }
function spread(values) { return values.length ? Math.max(...values) - Math.min(...values) : 0; }

async function inspectOverview(page, viewport) {
  return page.evaluate(({ maxPageHeight, mobile }) => {
    const root = document.documentElement;
    const body = document.body;
    const month = document.getElementById('month-select');
    const tabsStyle = getComputedStyle(document.getElementById('tabs'));
    const filterHeights = Array.from(document.querySelectorAll('[data-testid="filter-card"]'))
      .map((el) => Math.round(el.getBoundingClientRect().height));
    const kpiHeights = Array.from(document.querySelectorAll('[data-testid="kpi-card"]'))
      .map((el) => Math.round(el.getBoundingClientRect().height));
    const clipped = Array.from(document.querySelectorAll('.filter-card,.kpi-card,.secondary-card,.panel-title,.metric-value,.kpi-value,.secondary-value,.insight-text,.legend-label,.legend-value,.tab,.view-context'))
      .filter((el) => {
        const style = getComputedStyle(el);
        if (style.overflowX === 'auto' || style.overflowX === 'scroll') return false;
        return el.scrollWidth > el.clientWidth + 3 || el.scrollHeight > el.clientHeight + 3;
      }).map((el) => el.textContent.trim().replace(/\s+/g,' ').slice(0,80));
    const charts = Array.from(document.querySelectorAll('.chart-host')).map((el) => ({
      width:Math.round(el.getBoundingClientRect().width),
      height:Math.round(el.getBoundingClientRect().height),
      rendered:Boolean(el.querySelector('svg,.chart-empty'))
    }));
    return {
      viewport:{width:innerWidth,height:innerHeight},
      overflow:Math.max(root.scrollWidth,body.scrollWidth)-innerWidth,
      pageHeight:Math.max(root.scrollHeight,body.scrollHeight), maxPageHeight,
      clipped,
      tabCount:document.querySelectorAll('.tab').length,
      activeTabs:document.querySelectorAll('.tab.active[aria-selected="true"]').length,
      kpis:document.querySelectorAll('[data-testid="kpi-card"]').length,
      secondary:document.querySelectorAll('[data-testid="secondary-kpi"]').length,
      filters:document.querySelectorAll('[data-testid="filter-card"]').length,
      month:Number(month.value), monthLabel:month.options[month.selectedIndex].textContent,
      period:document.getElementById('current-period').textContent,
      periodNote:document.getElementById('period-note').textContent,
      structure:document.getElementById('structure-legend').textContent.replace(/\s+/g,' '),
      donut:document.getElementById('donut-total').textContent,
      quality:document.getElementById('quality-value').textContent,
      yearBars:document.querySelectorAll('#yearly-chart rect').length,
      executiveTitle:document.getElementById('kpi-title').textContent,
      scrollbar:mobile ? tabsStyle.scrollbarWidth : null,
      filterHeights,kpiHeights,charts
    };
  }, { maxPageHeight:viewport.maxPageHeight, mobile:viewport.width <= 760 });
}

function assertOverview(r) {
  const label = `${r.viewport.width}x${r.viewport.height}`;
  expect(r.overflow <= 1, `[${label}] horizontal overflow ${r.overflow}`);
  expect(r.pageHeight <= r.maxPageHeight, `[${label}] page too tall ${r.pageHeight}`);
  expect(!r.clipped.length, `[${label}] clipped: ${r.clipped.join('; ')}`);
  expect(r.tabCount === 10 && r.activeTabs === 1, `[${label}] tab contract failed`);
  expect(r.kpis === 9, `[${label}] expected 9 executive KPI, got ${r.kpis}`);
  expect(r.secondary === 6, `[${label}] expected 6 secondary KPI, got ${r.secondary}`);
  expect(r.filters === 5, `[${label}] expected 5 filters, got ${r.filters}`);
  expect(r.executiveTitle === 'Executive-панель', `[${label}] executive title missing`);
  expect(r.month === 6 && r.monthLabel === 'Июль', `[${label}] default month mismatch`);
  expect(r.period.toLowerCase().includes('июль') && r.periodNote.includes('28.07.2026'), `[${label}] period mismatch`);
  expect(r.donut.includes('151') && r.donut.includes('360'), `[${label}] July total mismatch`);
  ['66 712','58 775','16 320','9 553'].forEach((value) => expect(r.structure.includes(value), `[${label}] missing structure ${value}`));
  expect(r.quality.includes('86/100'), `[${label}] quality mismatch`);
  expect(r.yearBars === 9, `[${label}] expected 9 year bars, got ${r.yearBars}`);
  if (r.viewport.width > 1250) expect(spread(r.filterHeights) <= 2, `[${label}] filter height mismatch`);
  expect(spread(r.kpiHeights) <= 4, `[${label}] KPI height mismatch`);
  if (r.scrollbar) expect(r.scrollbar === 'none', `[${label}] mobile scrollbar visible`);
  expect(r.charts.length === 2, `[${label}] expected 2 charts`);
  r.charts.forEach((chart,i) => {
    expect(chart.width >= 250 && chart.height >= 220 && chart.rendered, `[${label}] chart ${i+1} invalid`);
  });
}

async function assertViews(page) {
  for (const [view,title] of VIEWS) {
    await page.click(`.tab[data-view="${view}"]`);
    await page.waitForFunction((expected) => document.querySelector('.tab.active')?.dataset.view === expected, view);
    const s = await page.evaluate((currentView) => {
      const params = new URL(location.href).searchParams;
      const detail = document.getElementById('view-detail');
      const text = document.getElementById('detail-content').textContent.replace(/\s+/g,' ').trim();
      const monthOps = currentView === 'months'
        ? Array.from(document.querySelectorAll('#detail-content tbody tr')).map((row) => row.children[1]?.textContent.trim()) : [];
      const kpiWidth = Math.round(document.getElementById('kpi-panel').getBoundingClientRect().width);
      const monthlyWidth = Math.round(document.getElementById('monthly-panel').getBoundingClientRect().width);
      const detailWidth = Math.round(detail.getBoundingClientRect().width);
      return {
        active:document.querySelector('.tab.active')?.dataset.view,
        title:document.getElementById('view-title').textContent.trim(),
        hidden:detail.hidden,text,urlView:params.get('view'),urlMonth:params.get('month'),monthOps,
        viewportWidth:innerWidth,kpiWidth,monthlyWidth,detailWidth
      };
    }, view);
    expect(s.active === view && s.title === title && s.urlView === view, `View ${view} activation failed`);
    if (view === 'overview') expect(s.hidden, 'Overview detail must be hidden');
    else expect(!s.hidden && s.text, `View ${view} detail missing`);
    if (view === 'months') {
      expect(JSON.stringify(s.monthOps) === JSON.stringify(['11','17','31','18','25','17','9','0','0','0','0','0']), 'Monthly counts differ from public aggregate fixture');
    }
    if (view === 'forecast') {
      expect(s.urlMonth === '6' && s.text.includes('Оценка года') && s.text.includes('Базовый доход'), 'Forecast detail mismatch');
      if (s.viewportWidth > 1250) {
        const min = s.viewportWidth * .9;
        expect(s.kpiWidth >= min && s.monthlyWidth >= min && s.detailWidth >= min, 'Forecast leaves empty desktop column');
      }
    }
  }
  await page.click('.tab[data-view="overview"]');
  await page.waitForFunction(() => document.getElementById('view-detail').hidden);
}

async function assertDrilldowns(page) {
  await page.click('[data-testid="kpi-card"][data-drilldown="month"]');
  await page.waitForSelector('#view-detail:not([hidden])');
  const month = await page.evaluate(() => ({
    title:document.getElementById('detail-title').textContent,
    text:document.getElementById('detail-content').textContent.replace(/\s+/g,' '),
    rows:document.querySelectorAll('#detail-content tbody tr').length,
    demo:Array.from(document.querySelectorAll('#detail-content tbody tr')).every((row) => row.textContent.includes('Синтетическая операция'))
  }));
  expect(month.title.includes('Доход выбранного месяца'), 'Month drill-down title missing');
  expect(month.text.includes('Операций: 9') && month.text.includes('151 360'), 'Month drill-down summary mismatch');
  expect(month.rows === 3 && month.demo, 'Public drill-down fixture must contain only three synthetic preview rows');
  await page.click('[data-close-drilldown]');
  await page.waitForFunction(() => document.getElementById('view-detail').hidden);

  await page.click('[data-testid="secondary-kpi"][data-drilldown="duplicates"]');
  await page.waitForSelector('#view-detail:not([hidden])');
  expect((await page.textContent('#detail-title')).includes('Возможные точные дубли'), 'Duplicate drill-down missing');
  await page.click('[data-close-drilldown]');
}

(async () => {
  const root = path.join(__dirname,'..');
  const htmlPath = path.join(root,'DashboardWebApp.html');
  const artifactDir = path.join(root,'artifacts');
  fs.mkdirSync(artifactDir,{recursive:true});
  const html = fs.readFileSync(htmlPath,'utf8');
  expect(html.includes('id="executive-secondary"') && html.includes('id="action-bar"'), 'Visual test requires the canonical prepared v1 RC bundle');
  const browser = await chromium.launch({headless:true});
  const results = [];

  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1});
    const errors = [];
    page.on('pageerror',(error) => errors.push(error.message));
    await page.goto(`file://${htmlPath}`,{waitUntil:'load'});
    await page.waitForTimeout(1000);
    const kpiCount = await page.locator('[data-testid="kpi-card"]').count();
    if (kpiCount !== 9 || errors.length) {
      const title = await page.title().catch(() => '');
      throw new Error(`[${viewport.name}] dashboard startup failed: kpiCount=${kpiCount}; title=${title}; JavaScript errors=${errors.join(' | ') || 'none'}`);
    }
    const result = await inspectOverview(page,viewport);
    assertOverview(result);
    await assertViews(page);
    await assertDrilldowns(page);
    expect(!errors.length, `[${viewport.name}] JavaScript errors: ${errors.join('; ')}`);
    results.push(result);
    await page.screenshot({path:path.join(artifactDir,`dashboard-web-${viewport.name}.png`),fullPage:true});
    await page.close();
  }

  fs.writeFileSync(path.join(artifactDir,'dashboard-web-layout.json'),JSON.stringify({build:'prebuilt-v1rc',results},null,2));
  await browser.close();
  console.log('dashboard_web_visual_test: OK',{build:'prebuilt-v1rc',results});
})().catch((error) => { console.error(error); process.exit(1); });
