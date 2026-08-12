'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const EXPECTED_ECHARTS_VERSION = '6.1.0';
const EXPECTED_RENDERER = 'ECHARTS_6';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000, maxPageHeight: 2200 },
  { name: 'mobile', width: 390, height: 844, maxPageHeight: 7600 }
];
const FORBIDDEN_VISIBLE = [
  'ECharts', 'ECHARTS', 'ChartSpec', 'renderer', 'options', 'FIN-TRUTH', 'FIN-010', 'VIZ-', 'BAL-030',
  'SYN-HOME', 'SYN-FOOD', 'SYN-OTHER'
];

function fail(message) {
  throw new Error(message);
}

function expect(condition, message) {
  if (!condition) fail(message);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key || !key.startsWith('--') || value == null) fail('usage: --candidate <dir> --sha <40-char-sha>');
    result[key.slice(2)] = value;
  }
  return result;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function manifestFile(manifest, filePath) {
  return Array.isArray(manifest.files) ? manifest.files.find((item) => item.path === filePath) : null;
}

function verifyManifestFile(manifest, candidateRoot, filePath) {
  const diskPath = path.join(candidateRoot, 'files', filePath);
  expect(fs.existsSync(diskPath), `candidate ${filePath} missing`);
  const bytes = fs.readFileSync(diskPath);
  const descriptor = manifestFile(manifest, filePath);
  expect(descriptor && descriptor.sha256 === sha256(bytes) && descriptor.size === bytes.length,
    `candidate ${filePath} does not match manifest hash/size`);
  return { diskPath, bytes, text: bytes.toString('utf8') };
}

function canonicalShellHtml(routerSource, homeHtml) {
  const context = vm.createContext({
    console, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent,
    __candidateHomeHtml: homeHtml
  });
  vm.runInContext(routerSource, context, { filename: 'CanonicalR2WebAppService.js' });
  const rendered = vm.runInContext("prhR2InjectShell_(__candidateHomeHtml,'home')", context);
  expect(typeof rendered === 'string' && rendered.includes('data-prh-canonical-r2-shell="1"'),
    'exact-SHA canonical router did not inject R2 shell into Home');
  return rendered;
}

async function inspectRenderedHome(page) {
  return page.evaluate(() => {
    function first(value) {
      return Array.isArray(value) ? value[0] : value;
    }
    function optionTitle(option) {
      const title = first(option && option.title);
      return title && title.text || '';
    }
    function ariaDescription(option) {
      const aria = first(option && option.aria);
      const label = aria && first(aria.label);
      return label && label.description || '';
    }
    function heightOf(node) {
      return node ? Math.round(node.getBoundingClientRect().height) : 0;
    }
    function chartInfo(id) {
      const host = document.getElementById(id);
      const instance = host && window.echarts && window.echarts.getInstanceByDom(host);
      const option = instance && instance.getOption();
      const series = option && option.series || [];
      const legend = first(option && option.legend);
      const title = first(option && option.title);
      return {
        exists: Boolean(host),
        instance: Boolean(instance),
        className: host && host.className || '',
        canvasCount: host ? host.querySelectorAll('canvas').length : 0,
        svgCount: host ? host.querySelectorAll('svg').length : 0,
        width: host ? Math.round(host.getBoundingClientRect().width) : 0,
        height: host ? Math.round(host.getBoundingClientRect().height) : 0,
        ariaLive: host && host.getAttribute('aria-live') || '',
        ariaLabel: host && host.getAttribute('aria-label') || '',
        title: optionTitle(option),
        titleShown: title ? title.show !== false : true,
        ariaDescription: ariaDescription(option),
        seriesType: series[0] && series[0].type || '',
        seriesCount: series.length,
        dataCount: series[0] && Array.isArray(series[0].data) ? series[0].data.length : 0,
        dataNames: series[0] && Array.isArray(series[0].data)
          ? series[0].data.map((item) => item && typeof item === 'object' ? String(item.name || '') : '')
          : [],
        legendBottom: legend && legend.bottom,
        legendTextColor: legend && legend.textStyle && legend.textStyle.color || ''
      };
    }
    const root = document.documentElement;
    const body = document.body;
    const visualRoot = document.querySelector('.visuals');
    const shell = document.getElementById('prh-r2-shell');
    const primary = document.getElementById('prh-r2-canonical-nav');
    const secondary = document.getElementById('prh-r2-secondary-nav');
    return {
      rendererVersion: window.echarts && window.echarts.version || '',
      dataReady: root.getAttribute('data-home-data-ready') || '',
      visualReady: root.getAttribute('data-home-visual-ready') || '',
      fetchStrategy: root.getAttribute('data-home-fetch-strategy') || '',
      overflow: Math.max(root.scrollWidth, body.scrollWidth) - innerWidth,
      pageHeight: Math.max(root.scrollHeight, body.scrollHeight),
      layout: {
        shellHeight: heightOf(shell),
        heroHeight: heightOf(document.querySelector('.hero')),
        mainHeight: heightOf(document.querySelector('.main')),
        cardHeights: Array.from(document.querySelectorAll('.card')).map(heightOf),
        panelHeights: Array.from(document.querySelectorAll('.panel')).map(heightOf)
      },
      visibleText: body.innerText.replace(/\s+/g, ' ').trim(),
      headings: Array.from(document.querySelectorAll('h1,h2,h3')).map((node) => `${node.tagName}:${node.textContent.trim()}`),
      chartActions: visualRoot ? visualRoot.querySelectorAll('button,a,[role="button"]').length : -1,
      chartExplicitTabStops: visualRoot ? visualRoot.querySelectorAll('[tabindex]:not([tabindex="-1"])').length : -1,
      semanticFallbacks: visualRoot ? visualRoot.querySelectorAll('.semantic-fallback').length : -1,
      errorFallbacks: visualRoot ? visualRoot.querySelectorAll('.visual-empty,.visual-mask').length : -1,
      shell: shell ? {
        activeSurface: shell.dataset.activeSurface || '',
        navigationPolicy: shell.dataset.navigationPolicy || '',
        primary: primary ? Array.from(primary.querySelectorAll('a')).map((link) => ({
          id: link.dataset.r2Nav || '',
          label: link.textContent.trim(),
          href: link.getAttribute('href') || '',
          current: link.getAttribute('aria-current') || ''
        })) : [],
        secondary: secondary ? Array.from(secondary.querySelectorAll('a')).map((link) => ({
          id: link.dataset.r2Nav || '',
          label: link.textContent.trim(),
          href: link.getAttribute('href') || '',
          current: link.getAttribute('aria-current') || ''
        })) : []
      } : null,
      cash: chartInfo('cashflow-chart'),
      expense: chartInfo('expense-mix')
    };
  });
}

(async () => {
  const args = parseArgs(process.argv);
  const candidateRoot = path.resolve(String(args.candidate || ''));
  const expectedSha = String(args.sha || '');
  expect(/^[0-9a-f]{40}$/.test(expectedSha), 'expected SHA must be 40 lowercase hex characters');

  const manifestPath = path.join(candidateRoot, 'manifest.json');
  expect(fs.existsSync(manifestPath), 'candidate manifest missing');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  expect(manifest.schemaVersion === 2, 'candidate manifest schema invalid');
  expect(manifest.candidateSha === expectedSha, 'candidate manifest is not bound to exact PR SHA');

  const home = verifyManifestFile(manifest, candidateRoot, 'FinancialHomeWebApp.html');
  const router = verifyManifestFile(manifest, candidateRoot, 'CanonicalR2WebAppService.js');
  const html = home.text;
  expect(manifest.echartsVendor && manifest.echartsVendor.packageVersion === EXPECTED_ECHARTS_VERSION,
    'candidate ECharts package version invalid');
  expect(manifest.echartsVendor.delivery === 'LOCAL_ONLY' && manifest.echartsVendor.runtimeNetworkRequired === false &&
    manifest.echartsVendor.externalCdnRequired === false, 'candidate ECharts delivery must remain LOCAL_ONLY/no-network');
  expect(manifest.echartsVendor.targetHtml === 'FinancialHomeWebApp.html', 'candidate ECharts target HTML invalid');
  expect(html.includes('data-prh-vendor="apache-echarts"') && html.includes('data-version="6.1.0"') &&
    html.includes('data-delivery="LOCAL_ONLY"'), 'candidate Home does not contain pinned local ECharts vendor');
  expect(!html.includes('<!-- PRH_LOCAL_ECHARTS_VENDOR -->'), 'candidate ECharts placeholder was not materialized');
  expect(!/https?:\/\/(?:cdn\.|unpkg\.|jsdelivr\.)/i.test(html), 'candidate Home contains external CDN reference');
  expect(html.includes('synthetic:true') && html.includes('synthetic_compiled_fixture:true'),
    'candidate screenshot fixture must remain explicitly synthetic');
  expect(router.text.includes("Object.freeze(['home', 'Главная'])") && router.text.includes("Object.freeze(['studio', 'Студия аналитики'])"),
    'candidate canonical router does not contain required household primary tabs');

  const routedHtml = canonicalShellHtml(router.text, html);
  const routedHtmlPath = path.join(os.tmpdir(), `prh-financial-home-candidate-shell-${process.pid}.html`);
  fs.writeFileSync(routedHtmlPath, routedHtml, 'utf8');

  const artifactDir = path.resolve('artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const externalRequests = [];
  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('request', (request) => {
        if (/^https?:/i.test(request.url())) externalRequests.push({ viewport: viewport.name, url: request.url() });
      });

      await page.goto(pathToFileURL(routedHtmlPath).href, { waitUntil: 'load' });
      await page.waitForFunction(() => document.documentElement.getAttribute('data-home-visual-ready') === '1', null, { timeout: 15000 });
      await page.waitForTimeout(700);
      const result = await inspectRenderedHome(page);

      await page.screenshot({
        path: path.join(artifactDir, `financial-home-candidate-${viewport.name}.png`),
        fullPage: true
      });
      results.push({ viewport: viewport.name, ...result });
      console.log('financial_home_candidate_layout', JSON.stringify({
        viewport: viewport.name,
        pageHeight: result.pageHeight,
        layout: result.layout,
        cash: { width: result.cash.width, height: result.cash.height },
        expense: { width: result.expense.width, height: result.expense.height }
      }));

      expect(!errors.length, `[${viewport.name}] candidate browser errors: ${errors.join(' | ')}`);
      expect(result.rendererVersion === EXPECTED_ECHARTS_VERSION,
        `[${viewport.name}] expected ECharts ${EXPECTED_ECHARTS_VERSION}, got ${result.rendererVersion}`);
      expect(result.dataReady === '1' && result.visualReady === '1', `[${viewport.name}] Home did not reach rendered state`);
      expect(result.overflow <= 1, `[${viewport.name}] horizontal overflow ${result.overflow}`);
      expect(result.pageHeight <= viewport.maxPageHeight, `[${viewport.name}] page too tall ${result.pageHeight}`);
      expect(result.layout.shellHeight > 0 && result.layout.shellHeight <= 80,
        `[${viewport.name}] canonical shell height is pathological: ${result.layout.shellHeight}`);
      expect(result.layout.cardHeights.length === 7 && result.layout.cardHeights.every((height) => height >= 120 && height <= 320),
        `[${viewport.name}] KPI card height out of bounds: ${result.layout.cardHeights.join(',')}`);
      expect(result.layout.panelHeights.length === 2 && result.layout.panelHeights.every((height) => height >= 260 && height <= 620),
        `[${viewport.name}] chart panel height out of bounds: ${result.layout.panelHeights.join(',')}`);
      expect(result.headings.filter((item) => item.startsWith('H1:')).length === 1,
        `[${viewport.name}] Home must have exactly one H1`);
      expect(result.headings.includes('H3:Динамика денежного потока') && result.headings.includes('H3:Структура расходов'),
        `[${viewport.name}] Russian chart headings missing`);
      expect(result.chartActions === 0, `[${viewport.name}] unbound chart actions must not render`);
      expect(result.chartExplicitTabStops === 0, `[${viewport.name}] unbound charts must not create keyboard traps/actions`);
      expect(result.semanticFallbacks === 0 && result.errorFallbacks === 0,
        `[${viewport.name}] working renderer must not fall back to placeholder/text state`);

      expect(result.shell && result.shell.activeSurface === 'home', `[${viewport.name}] canonical Home shell missing`);
      expect(result.shell.navigationPolicy === 'PROVEN_DESTINATIONS_ONLY', `[${viewport.name}] canonical navigation policy missing`);
      expect(JSON.stringify(result.shell.primary.map((item) => item.label)) === JSON.stringify(['Главная', 'Студия аналитики']),
        `[${viewport.name}] primary household tabs missing or reordered`);
      expect(result.shell.primary[0].id === 'home' && result.shell.primary[0].current === 'page' && result.shell.primary[0].href === '?surface=home',
        `[${viewport.name}] Home tab is not the active canonical destination`);
      expect(result.shell.primary[1].id === 'studio' && result.shell.primary[1].href === '?surface=studio&mode=explore',
        `[${viewport.name}] Analytics Studio tab is not routed truthfully`);
      expect(JSON.stringify(result.shell.secondary.map((item) => item.label)) === JSON.stringify(['Старый интерфейс']),
        `[${viewport.name}] legacy emergency route must remain secondary`);

      expect(result.cash.instance && result.cash.canvasCount >= 1 && result.cash.width > 200 && result.cash.height >= 190 && result.cash.height <= 420,
        `[${viewport.name}] cash-flow canvas dimensions are not useful: ${result.cash.width}x${result.cash.height}`);
      expect(result.expense.instance && result.expense.canvasCount >= 1 && result.expense.width > 200 && result.expense.height >= 190 && result.expense.height <= 480,
        `[${viewport.name}] expense canvas dimensions are not useful: ${result.expense.width}x${result.expense.height}`);
      expect(result.cash.seriesType === 'line' && result.cash.dataCount === 6,
        `[${viewport.name}] cash-flow must be a six-period line series`);
      expect(result.expense.seriesType === 'pie' && result.expense.dataCount === 3,
        `[${viewport.name}] expense composition must be a bounded pie series`);
      expect(result.cash.title === 'Денежный поток' && result.expense.title === 'Структура расходов',
        `[${viewport.name}] Russian chart titles missing`);
      expect(result.cash.titleShown === false && result.expense.titleShown === false,
        `[${viewport.name}] duplicate internal ECharts titles must be visually suppressed`);
      expect(result.cash.ariaLive === 'polite' && result.expense.ariaLive === 'polite',
        `[${viewport.name}] chart live regions missing`);
      expect(result.cash.ariaDescription === 'Денежный поток' && result.expense.ariaDescription === 'Структура расходов',
        `[${viewport.name}] Russian chart ARIA descriptions missing from exact rendered option`);
      expect(result.cash.ariaLabel.includes('Денежный поток') && result.expense.ariaLabel.includes('Структура расходов'),
        `[${viewport.name}] ECharts did not materialize Russian ARIA labels on rendered chart hosts`);
      expect(JSON.stringify(result.expense.dataNames) === JSON.stringify(['Дом', 'Продукты', 'Прочее']),
        `[${viewport.name}] synthetic candidate category labels must remain Russian and household-readable`);
      expect(result.expense.legendTextColor, `[${viewport.name}] expense legend lacks theme-aware text color`);
      if (viewport.name === 'mobile') {
        expect(String(result.expense.legendBottom) === '0', '[mobile] expense legend must be anchored below donut');
      }

      for (const term of FORBIDDEN_VISIBLE) {
        expect(!result.visibleText.includes(term), `[${viewport.name}] developer-facing term is visible: ${term}`);
      }

      await page.close();
    }
  } finally {
    await browser.close();
    fs.rmSync(routedHtmlPath, { force: true });
  }

  expect(externalRequests.length === 0,
    `candidate renderer attempted runtime network access: ${externalRequests.map((item) => item.url).join(', ')}`);

  const evidence = {
    schema: 'PRH_FINANCIAL_HOME_CANDIDATE_VISUAL_EVIDENCE_V2',
    privacy_class: 'PUBLIC_SYNTHETIC',
    candidate_sha: expectedSha,
    source_tree_hash: manifest.sourceTreeHash,
    artifact_hash: manifest.artifactHash,
    renderer: EXPECTED_RENDERER,
    renderer_version: EXPECTED_ECHARTS_VERSION,
    delivery: manifest.echartsVendor.delivery,
    runtime_network_required: false,
    external_requests: externalRequests,
    exact_sha_canvas_rendered: true,
    exact_sha_canonical_shell_rendered: true,
    primary_navigation: ['Главная', 'Студия аналитики'],
    semantic_fallback_covered_by_source_gate: true,
    russian_household_strings: true,
    accessibility_aria: true,
    keyboard_trap_free_unbound_charts: true,
    bounded_component_heights: true,
    results
  };
  fs.writeFileSync(
    path.join(artifactDir, 'financial-home-candidate-evidence.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8'
  );
  console.log('financial_home_candidate_visual_gate: OK', {
    candidateSha: expectedSha,
    renderer: `${EXPECTED_RENDERER}@${EXPECTED_ECHARTS_VERSION}`,
    delivery: 'LOCAL_ONLY',
    exactShaCanvasRendered: true,
    exactShaCanonicalShellRendered: true,
    primaryNavigation: ['Главная', 'Студия аналитики'],
    desktopMobile: true,
    boundedComponentHeights: true,
    russianHouseholdStrings: true,
    accessibilityAria: true,
    runtimeNetworkRequests: 0
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});