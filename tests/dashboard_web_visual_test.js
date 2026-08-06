const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const root = path.join(__dirname, '..');
  const htmlPath = path.join(root, 'DashboardWebApp.html');
  const artifactDir = path.join(root, 'artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="overview-kpis"]');
  await page.waitForTimeout(250);

  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const overflow = Math.max(root.scrollWidth, body.scrollWidth) - window.innerWidth;
    const height = Math.max(root.scrollHeight, body.scrollHeight);

    const topLevel = Array.from(document.querySelectorAll('.filters > *, .dashboard-grid > .panel, .bottom-grid > *'));
    const boxes = topLevel.map((element) => {
      const rect = element.getBoundingClientRect();
      return { name: element.getAttribute('data-testid') || element.className, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
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

    const clipped = Array.from(document.querySelectorAll('.filter-card, .kpi-card, .panel-title, .metric-value, .kpi-value'))
      .filter((element) => element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2)
      .map((element) => ({ className: element.className, text: element.textContent.trim().slice(0, 80) }));

    return { overflow, height, overlaps, clipped, tabCount: document.querySelectorAll('.tab').length, kpiCount: document.querySelectorAll('[data-testid="kpi-card"]').length };
  });

  if (result.overflow > 1) throw new Error(`Horizontal overflow: ${result.overflow}px`);
  if (result.height > 1250) throw new Error(`Overview is too tall for the visual contract: ${result.height}px`);
  if (result.overlaps.length) throw new Error(`Layout overlaps: ${result.overlaps.join('; ')}`);
  if (result.clipped.length) throw new Error(`Clipped content: ${JSON.stringify(result.clipped)}`);
  if (result.tabCount !== 10) throw new Error(`Expected 10 navigation tabs, found ${result.tabCount}`);
  if (result.kpiCount !== 8) throw new Error(`Expected 8 KPI cards, found ${result.kpiCount}`);

  await page.screenshot({ path: path.join(artifactDir, 'dashboard-web-overview.png'), fullPage: true });
  fs.writeFileSync(path.join(artifactDir, 'dashboard-web-layout.json'), JSON.stringify(result, null, 2));
  await browser.close();
  console.log('dashboard_web_visual_test: OK', result);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
