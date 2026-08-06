'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const prepareDashboardWeb = require('../tools/prepare-dashboard-web.js');

const VIEWPORTS = [
  { name: 'desktop', width: 1600, height: 1000, maxPageHeight: 1450 },
  { name: 'laptop', width: 1280, height: 900, maxPageHeight: 2350 },
  { name: 'mobile', width: 390, height: 844, maxPageHeight: 5300 }
];

async function inspectLayout(page, viewport) {
  return page.evaluate(({ maxPageHeight, mobile }) => {
    function visibleRect(element) {
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return null;
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return null;
      return {
        name: element.getAttribute('data-testid') || element.className || element.tagName,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom
      };
    }

    const root = document.documentElement;
    const body = document.body;
    const boxes = Array.from(document.querySelectorAll('.filters > *, .dashboard-grid > .panel, .bottom-grid > *'))
      .map(visibleRect)
      .filter(Boolean);
    const overlaps = [];

    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        const intersectW = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const intersectH = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (intersectW > 2 && intersectH > 2) overlaps.push(`${a.name} overlaps ${b.name}`);
      }
    }

    const clipped = Array.from(document.querySelectorAll([
      '.filter-card', '.kpi-card', '.panel-title', '.metric-value', '.kpi-value',
      '.insight-text', '.legend-label', '.legend-value', '.tab', '.view-context'
    ].join(',')))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.overflowX === 'auto' || style.overflowX === 'scroll') return false;
        return element.scrollWidth > element.clientWidth + 3 || element.scrollHeight > element.clientHeight + 3;
      })
      .map((element) => ({
        className: element.className,
        text: element.textContent.trim().replace(/\s+/g, ' ').slice(0, 100),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight
      }));

    const month = document.getElementById('month-select');
    const tabsStyle = window.getComputedStyle(document.getElementById('tabs'));
    const charts = Array.from(document.querySelectorAll('.chart-host')).map((element) => ({
      width: Math.round(element.getBoundingClientRect().width),
      height: Math.round(element.getBoundingClientRect().height),
      hasSvgOrEmptyState: Boolean(element.querySelector('svg, .chart-empty'))
    }));
    const filterHeights = Array.from(document.querySelectorAll('[data-testid="filter-card"]'))
      .map((element) => Math.round(element.getBoundingClientRect().height));
    const kpiHeights = Array.from(document.querySelectorAll('[data-testid="kpi-card"]'))
      .map((element) => Math.round(element.getBoundingClientRect().height));

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      overflow: Math.max(root.scrollWidth, body.scrollWidth) - window.innerWidth,
      pageHeight: Math.max(root.scrollHeight, body.scrollHeight),
      maxPageHeight,
      overlaps,
      clipped,
      tabCount: document.querySelectorAll('.tab').length,
      activeTabCount: document.querySelectorAll('.tab.active[aria-selected="true"]').length,
      kpiCount: document.querySelectorAll('[data-testid="kpi-card"]').length,
      filterCount: document.querySelectorAll('[data-testid="filter-card"]').length,
      selectedMonth: Number(month.value),
      selectedMonthLabel: month.options[month.selectedIndex].textContent,
      currentPeriod: document.getElementById('current-period').textContent,
      periodNote: document.getElementById('period-note').textContent,
      structureTitle: document.getElementById('structure-title').textContent,
      structureLegend: document.getElementById('structure-legend').textContent.replace(/\s+/g, ' ').trim(),
      donutTotal: document.getElementById('donut-total').textContent,
      qualityValue: document.getElementById('quality-value').textContent,
      yearlyBarCount: document.querySelectorAll('#yearly-chart rect').length,
      mobileScrollbarWidth: mobile ? tabsStyle.scrollbarWidth : null,
      filterHeights,
      kpiHeights,
      charts
    };
  }, { maxPageHeight: viewport.maxPageHeight, mobile: viewport.width <= 760 });
}

function spread(values) {
  return values.length ? Math.max(...values) - Math.min(...values) : 0;
}

function assertLayout(result) {
  const label = `${result.viewport.width}x${result.viewport.height}`;
  if (result.overflow > 1) throw new Error(`[${label}] Horizontal overflow: ${result.overflow}px`);
  if (result.pageHeight > result.maxPageHeight) throw new Error(`[${label}] Page too tall: ${result.pageHeight}px > ${result.maxPageHeight}px`);
  if (result.overlaps.length) throw new Error(`[${label}] Layout overlaps: ${result.overlaps.join('; ')}`);
  if (result.clipped.length) throw new Error(`[${label}] Clipped content: ${JSON.stringify(result.clipped)}`);
  if (result.tabCount !== 10) throw new Error(`[${label}] Expected 10 tabs, found ${result.tabCount}`);
  if (result.activeTabCount !== 1) throw new Error(`[${label}] Expected one active tab, found ${result.activeTabCount}`);
  if (result.kpiCount !== 8) throw new Error(`[${label}] Expected 8 KPI cards, found ${result.kpiCount}`);
  if (result.filterCount !== 5) throw new Error(`[${label}] Expected 5 context cards, found ${result.filterCount}`);
  if (result.selectedMonth !== 6 || result.selectedMonthLabel !== 'Июль') {
    throw new Error(`[${label}] Default month/data mismatch: ${JSON.stringify(result)}`);
  }
  if (!result.currentPeriod.toLowerCase().includes('июль') || !result.structureTitle.includes('Июль 2026')) {
    throw new Error(`[${label}] July labels are inconsistent: ${JSON.stringify(result)}`);
  }
  if (!result.periodNote.includes('28.07.2026')) throw new Error(`[${label}] Fixture latest date is stale: ${result.periodNote}`);
  if (!result.donutTotal.includes('151') || !result.donutTotal.includes('360')) {
    throw new Error(`[${label}] July structure total is inconsistent: ${result.donutTotal}`);
  }
  ['66 712', '58 775', '16 320', '9 553'].forEach((amount) => {
    if (!result.structureLegend.includes(amount)) throw new Error(`[${label}] Real July structure is missing ${amount}: ${result.structureLegend}`);
  });
  if (!result.qualityValue.includes('86/100')) throw new Error(`[${label}] Quality fixture must match DEV analytics: ${result.qualityValue}`);
  if (result.yearlyBarCount !== 9) throw new Error(`[${label}] Expected 9 real-history year bars, found ${result.yearlyBarCount}`);
  if (result.viewport.width > 1250 && spread(result.filterHeights) > 2) {
    throw new Error(`[${label}] Desktop filter cards are not equal height: ${result.filterHeights.join(',')}`);
  }
  if (spread(result.kpiHeights) > 3) throw new Error(`[${label}] KPI cards are not equal height: ${result.kpiHeights.join(',')}`);
  if (result.mobileScrollbarWidth && result.mobileScrollbarWidth !== 'none') {
    throw new Error(`[${label}] Mobile tab scrollbar must be hidden: ${result.mobileScrollbarWidth}`);
  }
  if (result.charts.length !== 2) throw new Error(`[${label}] Expected 2 chart hosts, found ${result.charts.length}`);
  result.charts.forEach((chart, index) => {
    if (chart.width < 250 || chart.height < 220) throw new Error(`[${label}] Chart ${index + 1} too small: ${chart.width}x${chart.height}`);
    if (!chart.hasSvgOrEmptyState) throw new Error(`[${label}] Chart ${index + 1} was not rendered`);
  });
}

async function assertInteraction(page) {
  await page.click('.tab[data-view="forecast"]');
  await page.waitForSelector('#view-detail:not([hidden])');
  const forecast = await page.evaluate(() => {
    const params = new URL(window.location.href).searchParams;
    const kpi = document.getElementById('kpi-panel').getBoundingClientRect();
    const monthly = document.getElementById('monthly-panel').getBoundingClientRect();
    const detail = document.getElementById('view-detail').getBoundingClientRect();
    return {
      active: document.querySelector('.tab.active')?.dataset.view,
      urlView: params.get('view'),
      urlMonth: params.get('month'),
      detailHidden: document.getElementById('view-detail').hidden,
      hasForecast: document.getElementById('detail-content').textContent.includes('Оценка года'),
      viewportWidth: window.innerWidth,
      kpiWidth: Math.round(kpi.width),
      monthlyWidth: Math.round(monthly.width),
      detailWidth: Math.round(detail.width)
    };
  });
  if (forecast.active !== 'forecast' || forecast.urlView !== 'forecast' || forecast.urlMonth !== '6') {
    throw new Error(`Forecast URL state is inconsistent: ${JSON.stringify(forecast)}`);
  }
  if (forecast.detailHidden || !forecast.hasForecast) throw new Error(`Forecast detail was not rendered: ${JSON.stringify(forecast)}`);
  if (forecast.viewportWidth > 1250) {
    const minimumWidePanel = forecast.viewportWidth * .9;
    if (forecast.kpiWidth < minimumWidePanel || forecast.monthlyWidth < minimumWidePanel || forecast.detailWidth < minimumWidePanel) {
      throw new Error(`Forecast view leaves an empty desktop column: ${JSON.stringify(forecast)}`);
    }
  }

  await page.click('.tab[data-view="overview"]');
  await page.waitForFunction(() => document.getElementById('view-detail').hidden === true);
}

(async () => {
  const root = path.join(__dirname, '..');
  const htmlPath = path.join(root, 'DashboardWebApp.html');
  const artifactDir = path.join(root, 'artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });
  const preparation = prepareDashboardWeb(htmlPath);

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="overview-kpis"]');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="kpi-card"]').length === 8);
    await page.waitForTimeout(250);

    const result = await inspectLayout(page, viewport);
    assertLayout(result);
    await assertInteraction(page);
    results.push(result);

    await page.screenshot({ path: path.join(artifactDir, `dashboard-web-${viewport.name}.png`), fullPage: true });
    await page.close();
  }

  fs.writeFileSync(path.join(artifactDir, 'dashboard-web-layout.json'), JSON.stringify({ preparation, results }, null, 2));
  await browser.close();
  console.log('dashboard_web_visual_test: OK', { preparation, results });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});