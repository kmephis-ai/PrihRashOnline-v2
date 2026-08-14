'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'FinancialSectionsWebApp.html'), 'utf8');

assert(source.includes('data-filter-navigation="CANONICAL_TOP_GET"'));
assert(source.includes('function syncFilterAction()'));
assert(source.includes("url.hostname!=='script.google.com'"));
assert(source.includes("form.target='_top'"));
assert(source.includes("document.getElementById('filters').addEventListener('submit',filterSubmit)"));
assert(!/form\.action\s*=\s*window\.location|action=["']\?/.test(source));

const shell = '<div id="prh-r2-shell" data-active-surface="expenses">' +
  '<a data-r2-nav="expenses" href="https://script.google.com/macros/s/TEST_DEPLOYMENT/exec?surface=expenses">Расходы</a>' +
  '<a data-r2-nav="income" href="https://script.google.com/macros/s/TEST_DEPLOYMENT/exec?surface=income">Доходы</a>' +
  '<a data-r2-nav="cash-flow" href="https://script.google.com/macros/s/TEST_DEPLOYMENT/exec?surface=cash-flow">Денежный поток</a>' +
  '</div>';
const rendered = source.replace(/(<body[^>]*>)/, `$1${shell}`);
const tempFile = path.join(os.tmpdir(), `prh-fin-filter-${process.pid}.html`);
fs.writeFileSync(tempFile, rendered, 'utf8');

function fixture(section) {
  const common = {
    schema: 'PRH_R2_PRIVATE_FINANCIAL_SECTIONS_VIEW_V1', version: '1.0.0', state: 'READY', section,
    privacy_mode: 'NORMAL', currency: 'RUB', window_days: 90,
    snapshot_revision: 'a'.repeat(64), snapshot_revision_prefix: 'aaaaaaaaaaaa',
    period: { start: '2026-05-01', end: '2026-08-01' },
    comparison_period: { start: '2026-02-01', end: '2026-05-01' },
    filters: { options: {
      accounts: [{ value: 'ACC-1', label: 'Основной' }],
      categories: [{ value: 'CAT-1', label: 'Продукты' }],
      members: [{ value: 'MEM-1', label: 'Семья' }]
    } }
  };
  if (section === 'expenses') common.expenses = {
    total_expense_minor: 10000, comparison_expense_minor: 9000, delta_minor: 1000,
    trend: [{ time_bucket: '2026-07-31', expense_minor: 5000 }, { time_bucket: '2026-08-01', expense_minor: 5000 }],
    category_mix: [{ category_id: 'CAT-1', category_label: 'Продукты', expense_minor: 10000 }],
    drivers: [{ category_id: 'CAT-1', category_label: 'Продукты', delta_minor: 1000 }]
  };
  if (section === 'income') common.income = {
    total_income_minor: 20000, comparison_income_minor: 18000, delta_minor: 2000,
    stability: { stability_score: 90 },
    trend: [{ time_bucket: '2026-07-31', income_minor: 10000 }, { time_bucket: '2026-08-01', income_minor: 10000 }],
    source_mix: [{ source_id: 'CAT-1', source_label: 'Зарплата', income_minor: 20000 }],
    source_deltas: [{ source_id: 'CAT-1', source_label: 'Зарплата', delta_minor: 2000 }]
  };
  if (section === 'cash-flow') common.cash_flow = {
    inflow_minor: 20000, outflow_minor: 10000, net_minor: 10000,
    trend: [{ time_bucket: '2026-07-31', net_minor: 5000 }, { time_bucket: '2026-08-01', net_minor: 5000 }],
    comparison: { inflow_minor: 18000, outflow_minor: 9000, net_minor: 9000 }
  };
  return common;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => {
      const runner = {
        success: null,
        failure: null,
        withSuccessHandler(fn) { this.success = fn; return this; },
        withFailureHandler(fn) { this.failure = fn; return this; },
        prhR2FetchFinancialSectionsPayload(request) {
          const callback = this.success;
          const section = request.section;
          setTimeout(() => callback(window.__fixture(section)), 0);
          return this;
        }
      };
      window.google = { script: { run: runner } };
    });
    await page.exposeFunction('__fixtureHost', fixture);
    await page.addInitScript(() => {
      window.__fixture = (section) => {
        const common = {
          schema: 'PRH_R2_PRIVATE_FINANCIAL_SECTIONS_VIEW_V1', version: '1.0.0', state: 'READY', section,
          privacy_mode: 'NORMAL', currency: 'RUB', window_days: 90,
          snapshot_revision: 'a'.repeat(64), snapshot_revision_prefix: 'aaaaaaaaaaaa',
          period: { start: '2026-05-01', end: '2026-08-01' }, comparison_period: { start: '2026-02-01', end: '2026-05-01' },
          filters: { options: { accounts: [{ value: 'ACC-1', label: 'Основной' }], categories: [{ value: 'CAT-1', label: 'Продукты' }], members: [{ value: 'MEM-1', label: 'Семья' }] } }
        };
        if (section === 'expenses') common.expenses = { total_expense_minor: 10000, comparison_expense_minor: 9000, delta_minor: 1000, trend: [{time_bucket:'2026-07-31',expense_minor:5000},{time_bucket:'2026-08-01',expense_minor:5000}], category_mix:[{category_id:'CAT-1',category_label:'Продукты',expense_minor:10000}], drivers:[{category_id:'CAT-1',category_label:'Продукты',delta_minor:1000}] };
        if (section === 'income') common.income = { total_income_minor:20000, comparison_income_minor:18000, delta_minor:2000, stability:{stability_score:90}, trend:[{time_bucket:'2026-07-31',income_minor:10000},{time_bucket:'2026-08-01',income_minor:10000}], source_mix:[{source_id:'CAT-1',source_label:'Зарплата',income_minor:20000}], source_deltas:[{source_id:'CAT-1',source_label:'Зарплата',delta_minor:2000}] };
        if (section === 'cash-flow') common.cash_flow = { inflow_minor:20000, outflow_minor:10000, net_minor:10000, trend:[{time_bucket:'2026-07-31',net_minor:5000},{time_bucket:'2026-08-01',net_minor:5000}], comparison:{inflow_minor:18000,outflow_minor:9000,net_minor:9000} };
        return common;
      };
    });

    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`file://${tempFile}`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-fin-initial-ready') === '1', null, { timeout: 10000 });
    assert.deepStrictEqual(errors, []);

    const state = await page.evaluate(() => {
      const form = document.getElementById('filters');
      document.getElementById('window-days').value = '30';
      document.getElementById('account-filter').value = 'ACC-1';
      document.getElementById('category-filter').value = 'CAT-1';
      document.getElementById('member-filter').value = 'MEM-1';
      const event = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
      const data = new FormData(form);
      return {
        defaultPrevented: event.defaultPrevented,
        action: form.action,
        target: form.target,
        canonicalAction: form.dataset.canonicalAction,
        surface: data.get('surface'), privacy: data.get('privacy'), windowDays: data.get('window_days'),
        account: data.get('account_id'), category: data.get('category_id'), member: data.get('member_id')
      };
    });

    assert.strictEqual(state.defaultPrevented, false, 'canonical form submit must remain a normal top-level GET');
    assert.strictEqual(state.action, 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec');
    assert.strictEqual(state.target, '_top');
    assert.strictEqual(state.canonicalAction, '1');
    assert.deepStrictEqual({surface:state.surface,privacy:state.privacy,windowDays:state.windowDays,account:state.account,category:state.category,member:state.member}, {
      surface:'expenses',privacy:'NORMAL',windowDays:'30',account:'ACC-1',category:'CAT-1',member:'MEM-1'
    });

    const unsafe = await page.evaluate(() => {
      const link = document.querySelector('#prh-r2-shell a[data-r2-nav="expenses"]');
      link.setAttribute('href', 'https://script.googleusercontent.com/blank?surface=expenses');
      const form = document.getElementById('filters');
      const event = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
      return { prevented: event.defaultPrevented, status: document.getElementById('status').textContent };
    });
    assert.strictEqual(unsafe.prevented, true, 'unsafe iframe-origin form target must fail closed');
    assert(unsafe.status.includes('Не удалось применить фильтры'));

    console.log('r2_financial_filter_web_ui_test: OK', { canonicalTopGet:true, blankScreenRegressionClosed:true, unsafeTargetFailClosed:true });
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(tempFile, { force: true });
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
