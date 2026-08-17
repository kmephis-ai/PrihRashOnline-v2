'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');
const PRIVACY = require('../lib/privacy/privacy_presentation');

const root = path.join(__dirname, '..');
const artifactDir = path.join(root, 'artifacts');
fs.mkdirSync(artifactDir, { recursive: true });

const PRIVATE_FIXTURE = {
  schema: 'PRH_PRIVATE_PRESENTATION_FIXTURE_V1',
  contract_version: '1.0.0',
  status: 'READY',
  currency: 'RUB',
  total_count: 2,
  cards: {
    income: { state: 'READY', income_minor: 918273645, account_name: 'SECRET_ACCOUNT_ALPHA' },
    expense: { state: 'READY', expense_minor: 817263544, category_name: 'SECRET_CATEGORY_BETA' }
  },
  rows: [
    { transaction_id: 'SECRET_TX_001', amount_minor: 123456789, member_name: 'SECRET_MEMBER_GAMMA' }
  ],
  nested: { balance_minor: 99887766, project_name: 'SECRET_PROJECT_DELTA', alert_count: 3 }
};

const DEMO_FIXTURE = {
  schema: 'PRH_PUBLIC_SYNTHETIC_PRIVACY_DEMO_V1',
  contract_version: '1.0.0',
  status: 'READY',
  currency: 'RUB',
  synthetic_only: true,
  cards: {
    income: { state: 'READY', income_minor: 420000, category_name: 'SYNTHETIC_CATEGORY_A' },
    expense: { state: 'READY', expense_minor: 310000, account_name: 'SYNTHETIC_ACCOUNT_B' }
  }
};

const SECRET_TOKENS = [
  '918273645', '817263544', '123456789', '99887766',
  'SECRET_ACCOUNT_ALPHA', 'SECRET_CATEGORY_BETA', 'SECRET_TX_001',
  'SECRET_MEMBER_GAMMA', 'SECRET_PROJECT_DELTA'
];

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function collectLeaves(value, pathParts = [], output = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectLeaves(item, pathParts.concat(String(index)), output));
    return output;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => collectLeaves(child, pathParts.concat(key), output));
    return output;
  }
  output.push({ path: pathParts.join('.'), value });
  return output;
}

function renderTransformed(result) {
  const leaves = collectLeaves(result.payload).filter((item) => item.value !== null && item.value !== undefined);
  const rows = leaves.map((item) => `<tr><th>${escapeHtml(item.path)}</th><td>${escapeHtml(item.value)}</td></tr>`).join('');
  const synthetic = result.synthetic_only ? '<strong data-synthetic-label="1">ДЕМО • PUBLIC_SYNTHETIC</strong>' : '';
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:18px;background:#f4f7fb;color:#10233f;font:14px/1.45 system-ui}.card{max-width:900px;margin:auto;background:white;border:1px solid #d7e0ea;border-radius:16px;padding:18px}.mode{display:inline-block;padding:6px 9px;border-radius:999px;background:#eef6ff;font-weight:800}table{width:100%;border-collapse:collapse;margin-top:14px;table-layout:fixed}th,td{padding:8px;border-bottom:1px solid #d7e0ea;text-align:left;overflow-wrap:anywhere}th{width:45%}@media(max-width:520px){body{padding:10px}.card{padding:12px}}</style></head><body data-privacy-mode="${escapeHtml(result.mode)}" data-security-boundary="false"><main class="card"><span class="mode">${escapeHtml(result.mode)}</span> ${synthetic}<h1>Privacy presentation evidence</h1><table><tbody>${rows}</tbody></table></main></body></html>`;
}

function studioWithPrivacySelector() {
  const privacyRuntimeSource = fs.readFileSync(path.join(root, 'PrivacyPresentationService.js'), 'utf8');
  const privacyStudioSource = fs.readFileSync(path.join(root, 'PrivacyStudioControlService.js'), 'utf8');
  const studioHtml = fs.readFileSync(path.join(root, 'AnalyticsStudioWebApp.html'), 'utf8');
  function output(content) {
    return {
      setTitle() { return this; },
      addMetaTag() { return this; },
      getContent() { return content; }
    };
  }
  const context = vm.createContext({
    console, Object, Array, String, Number, Boolean, Math, Date, RegExp, Error, JSON, encodeURIComponent,
    HtmlService: { createHtmlOutput(content) { return output(String(content)); } }
  });
  vm.runInContext(privacyRuntimeSource, context, { filename: 'PrivacyPresentationService.js' });
  vm.runInContext(privacyStudioSource, context, { filename: 'PrivacyStudioControlService.js' });
  return context.prhPrivacyDecorateStudioOutput_(output(studioHtml), 'MASKED').getContent();
}

(async () => {
  assert.throws(
    () => PRIVACY.transformPresentation(PRIVATE_FIXTURE, { mode: 'DEMO', source: 'PRIVATE_AUTHORIZED_PRESENTATION' }),
    /PRIV080_DEMO_PRIVATE_SOURCE_FORBIDDEN/
  );

  const masked = PRIVACY.transformPresentation(PRIVATE_FIXTURE, { mode: 'MASKED', source: 'PRIVATE_AUTHORIZED_PRESENTATION' });
  const zen = PRIVACY.transformPresentation(PRIVATE_FIXTURE, { mode: 'ZEN', source: 'PRIVATE_AUTHORIZED_PRESENTATION' });
  const demo = PRIVACY.transformPresentation(DEMO_FIXTURE, { mode: 'DEMO', source: 'PUBLIC_SYNTHETIC' });

  const maskedHtml = renderTransformed(masked);
  const zenHtml = renderTransformed(zen);
  const demoHtml = renderTransformed(demo);
  const studioHtml = studioWithPrivacySelector();

  for (const token of SECRET_TOKENS) {
    assert.strictEqual(maskedHtml.includes(token), false, `MASKED pre-DOM leak: ${token}`);
    assert.strictEqual(zenHtml.includes(token), false, `ZEN pre-DOM leak: ${token}`);
    assert.strictEqual(demoHtml.includes(token), false, `DEMO contamination: ${token}`);
    assert.strictEqual(studioHtml.includes(token), false, `Studio selector contamination: ${token}`);
  }
  assert.strictEqual(maskedHtml.includes('filter:blur'), false);
  assert.strictEqual(maskedHtml.includes('opacity:0'), false);
  assert.strictEqual(zenHtml.includes('filter:blur'), false);

  const browser = await chromium.launch({ headless: true });
  const evidence = [];
  try {
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 390, height: 844 }
    ]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      try {
        for (const [mode, html] of [['MASKED', maskedHtml], ['ZEN', zenHtml], ['DEMO', demoHtml]]) {
          await page.setContent(html, { waitUntil: 'load' });
          const state = await page.evaluate(() => ({
            mode: document.body.dataset.privacyMode,
            securityBoundary: document.body.dataset.securityBoundary,
            text: document.body.innerText,
            html: document.documentElement.innerHTML,
            overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
            syntheticLabel: Boolean(document.querySelector('[data-synthetic-label="1"]'))
          }));
          assert.strictEqual(state.mode, mode);
          assert.strictEqual(state.securityBoundary, 'false');
          assert(state.overflow <= 1, `${viewport.name}/${mode} overflow=${state.overflow}`);
          for (const token of SECRET_TOKENS) {
            assert.strictEqual(state.text.includes(token), false, `${viewport.name}/${mode} DOM text leak: ${token}`);
            assert.strictEqual(state.html.includes(token), false, `${viewport.name}/${mode} DOM html leak: ${token}`);
          }
          if (mode === 'DEMO') {
            assert.strictEqual(state.syntheticLabel, true);
            assert(state.text.includes('PUBLIC_SYNTHETIC'));
          } else {
            assert.strictEqual(state.syntheticLabel, false);
          }
          evidence.push({ viewport: viewport.name, mode, overflow: state.overflow, syntheticLabel: state.syntheticLabel, secretLeak: false });
          await page.screenshot({ path: path.join(artifactDir, `privacy-presentation-${viewport.name}-${mode.toLowerCase()}.png`), fullPage: true });
        }

        await page.setContent(studioHtml, { waitUntil: 'load' });
        const selectorState = await page.evaluate(() => ({
          selector: Boolean(document.getElementById('prh-privacy-selector')),
          groupRole: document.querySelector('.prh-privacy-choices')?.getAttribute('role'),
          maskedChecked: document.querySelector('[data-privacy-choice="MASKED"]')?.getAttribute('aria-checked'),
          securityBoundary: document.getElementById('prh-privacy-selector')?.dataset.securityBoundary,
          overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth
        }));
        assert.strictEqual(selectorState.selector, true);
        assert.strictEqual(selectorState.groupRole, 'radiogroup');
        assert.strictEqual(selectorState.maskedChecked, 'true');
        assert.strictEqual(selectorState.securityBoundary, 'false');
        assert(selectorState.overflow <= 1, `${viewport.name}/selector overflow=${selectorState.overflow}`);
        await page.locator('[data-privacy-choice="MASKED"]').focus();
        await page.keyboard.press('ArrowRight');
        const focusedMode = await page.evaluate(() => document.activeElement?.getAttribute('data-privacy-choice'));
        assert.strictEqual(focusedMode, 'DEMO', `${viewport.name} selector ArrowRight`);
        assert.strictEqual(await page.locator('[data-privacy-choice="DEMO"]').getAttribute('href'), '?surface=home&privacy=demo');
        evidence.push({ viewport: viewport.name, mode: 'SELECTOR', overflow: selectorState.overflow, keyboardArrowRight: true, securityBoundary: false });
        await page.screenshot({ path: path.join(artifactDir, `privacy-selector-${viewport.name}.png`), fullPage: true });
      } finally {
        await page.close().catch(() => {});
      }
    }

    fs.writeFileSync(path.join(artifactDir, 'privacy-presentation-visual.json'), JSON.stringify({
      schema: 'PRH_PRIVACY_PRESENTATION_VISUAL_EVIDENCE_V1',
      privacy_class: 'PUBLIC_CONFIGURATION_SYNTHETIC_ONLY',
      security_boundary: false,
      modes: ['MASKED', 'ZEN', 'DEMO'],
      selector_keyboard: true,
      evidence
    }, null, 2));
    console.log('privacy-presentation-visual: PASS', {
      viewports: ['desktop', 'tablet', 'mobile'],
      maskedPreDom: true,
      zenPreDom: true,
      demoSyntheticOnly: true,
      selectorKeyboard: true,
      securityBoundary: false
    });
  } finally {
    await browser.close().catch(() => {});
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
