const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const VIEWPORTS = [
  { name: 'desktop', width: 1600, height: 1000, maxPageHeight: 1300 },
  { name: 'laptop', width: 1280, height: 900, maxPageHeight: 2200 },
  { name: 'mobile', width: 390, height: 844, maxPageHeight: 5200 }
];

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

async function inspectLayout(page, viewport) {
  return page.evaluate(({ maxPageHeight }) => {
    const root = document.documentElement;
    const body = document.body;
    const overflow = Math.max(root.scrollWidth, body.scrollWidth) - window.innerWidth;
    const pageHeight = Math.max(root.scrollHeight, body.scrollHeight);

    const selectors = [
      '.filters > *',
      '.dashboard-grid > .panel',
      '.bottom-grid > *'
    ];
    const boxes = Array.from(document.querySelectorAll(selectors.join(',')))
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
      '.insight-text', '.legend-label', '.legend-value', '.tab'
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

    const charts = Array.from(document.querySelectorAll('.chart-host')).map((element) => ({
      width: Math.round(element.getBoundingClientRect().width),
      height: Math.round(element.getBoundingClientRect().height),
      hasSvgOrEmptyState: Boolean(element.querySelector('svg, .chart-empty'))
    }));

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      overflow,
      pageHeight,
      maxPageHeight,
      overlaps,
      clipped,
      tabCount: document.querySelectorAll('.tab').length,
      kpiCount: document.querySelectorAll('[data-testid="kpi-card"]').length,
      filterCount: document.querySelectorAll('[data-testid="filter-card"]').length,
      charts
    };
  }, viewport);
}

function assertLayout(result) {
  const label = `${result.viewport.width}x${result.viewport.height}`;
  if (result.overflow > 1) throw new Error(`[${label}] Horizontal overflow: ${result.overflow}px`);
  if (result.pageHeight > result.maxPageHeight) {
    throw new Error(`[${label}] Page is too tall: ${result.pageHeight}px > ${result.maxPageHeight}px`);
  }
  if (result.overlaps.length) throw new Error(`[${label}] Layout overlaps: ${result.overlaps.join('; ')}`);
  if (result.clipped.length) throw new Error(`[${label}] Clipped content: ${JSON.stringify(result.clipped)}`);
  if (result.tabCount !== 10) throw new Error(`[${label}] Expected 10 navigation tabs, found ${result.tabCount}`);
  if (result.kpiCount !== 8) throw new Error(`[${label}] Expected 8 KPI cards, found ${result.kpiCount}`);
  if (result.filterCount !== 5) throw new Error(`[${label}] Expected 5 context cards, found ${result.filterCount}`);
  if (result.charts.length !== 2) throw new Error(`[${label}] Expected 2 SVG chart hosts, found ${result.charts.length}`);
  result.charts.forEach((chart, index) => {
    if (chart.width < 250 || chart.height < 220) {
      throw new Error(`[${label}] Chart ${index + 1} is too small: ${chart.width}x${chart.height}`);
    }
    if (!chart.hasSvgOrEmptyState) throw new Error(`[${label}] Chart ${index + 1} was not rendered`);
  });
}

(async () => {
  const root = path.join(__dirname, '..');
  const htmlPath = path.join(root, 'DashboardWebApp.html');
  const artifactDir = path.join(root, 'artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1
    });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="overview-kpis"]');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="kpi-card"]').length === 8);
    await page.waitForTimeout(250);

    const result = await inspectLayout(page, viewport);
    assertLayout(result);
    results.push(result);

    await page.screenshot({
      path: path.join(artifactDir, `dashboard-web-${viewport.name}.png`),
      fullPage: true
    });
    await page.close();
  }

  fs.writeFileSync(
    path.join(artifactDir, 'dashboard-web-layout.json'),
    JSON.stringify(results, null, 2)
  );
  await browser.close();
  console.log('dashboard_web_visual_test: OK', results);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
