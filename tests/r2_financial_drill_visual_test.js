'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const routerSource = fs.readFileSync(path.join(root, 'CanonicalR2WebAppService.js'), 'utf8');
const bootstrapSource = fs.readFileSync(path.join(root, 'R2RouteBootstrapService.js'), 'utf8');
const transactionsHtml = fs.readFileSync(path.join(root, 'TransactionExplorerWebApp.html'), 'utf8');
const artifactDir = path.join(root, 'artifacts');
fs.mkdirSync(artifactDir, { recursive: true });

function output(content) {
  return { setTitle() { return this; }, addMetaTag() { return this; }, getContent() { return content; } };
}

const context = vm.createContext({
  console, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent,
  HtmlService: {
    createHtmlOutputFromFile(name) {
      assert.strictEqual(name, 'TransactionExplorerWebApp');
      return output(transactionsHtml);
    },
    createHtmlOutput(content) { return output(String(content)); }
  }
});
vm.runInContext(bootstrapSource, context, { filename: 'R2RouteBootstrapService.js' });
vm.runInContext(routerSource, context, { filename: 'CanonicalR2WebAppService.js' });

const route = {
  date_from: '2026-07-01',
  date_to: '2026-08-01',
  account_id: 'account:main',
  category_id: 'category:food',
  member_id: 'member:family'
};
const rendered = vm.runInContext(`prhR2RenderFile_('transactions',null,${JSON.stringify(route)}).getContent()`, context);
assert(rendered.includes('id="prh-r2-transaction-route-bootstrap"'));
assert(rendered.includes('category:food'));
assert(rendered.includes('2026-07-01'));
assert(rendered.includes('2026-08-01'));
assert(!/[?&](?:amount|amount_minor|income_minor|expense_minor|cash_flow_minor|value_minor)=/i.test(rendered));

const tempFile = path.join(os.tmpdir(), `prh-fin-drill-${process.pid}.html`);
fs.writeFileSync(tempFile, rendered, 'utf8');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 820, height: 980 } });
    await page.addInitScript(() => {
      window.__finDrillRequests = [];
      const fixture = {
        schema: 'PRH_R2_PRIVATE_TRANSACTIONS_VIEW_V1',
        version: '1.0.0',
        state: 'READY',
        privacy_mode: 'NORMAL',
        currency: 'RUB',
        snapshot_revision: 'c'.repeat(64),
        snapshot_revision_prefix: 'cccccccccccc',
        matched_count: 1,
        page_count: 1,
        has_more: false,
        rows: [{
          occurred_at: '2026-07-17T12:00:00Z', type: 'expense', status: 'posted', amount_minor: 12345, currency: 'RUB',
          account: 'Основной счёт', destination_account: null, category: 'Продукты', member: 'Семья', project: null,
          counterparty: 'Магазин', description: 'Покупка', masked: false
        }],
        filters: {
          accounts: [{ value: 'account:main', label: 'Основной счёт' }],
          categories: [{ value: 'category:food', label: 'Продукты' }],
          members: [{ value: 'member:family', label: 'Семья' }]
        },
        page_financials: { policy_version: 'FIN-TRUTH-v1', included_count: 1, income_minor: 0, expense_minor: 12345, cash_flow_minor: -12345 },
        financial_write_authorized: false,
        canonical_mutation_performed: false
      };
      const runner = {
        success: null,
        failure: null,
        withSuccessHandler(fn) { this.success = fn; return this; },
        withFailureHandler(fn) { this.failure = fn; return this; },
        prhR2FetchTransactionsPayload(request) {
          window.__finDrillRequests.push(JSON.parse(JSON.stringify(request)));
          const callback = this.success;
          setTimeout(() => callback(fixture), 0);
          return this;
        }
      };
      window.google = { script: { run: runner } };
    });

    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`file://${tempFile}`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-private-transactions-ready') === '1', null, { timeout: 10000 });
    assert.deepStrictEqual(errors, []);

    const evidence = await page.evaluate(() => ({
      requests: window.__finDrillRequests,
      account: document.getElementById('account').value,
      category: document.getElementById('category').value,
      member: document.getElementById('member').value,
      dateFrom: document.getElementById('date-from').value,
      dateTo: document.getElementById('date-to').value,
      bodyOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      visibleText: document.body.innerText.replace(/\s+/g, ' ').trim()
    }));

    assert.strictEqual(evidence.requests.length, 1, 'drill route must affect the first Explorer request');
    const query = evidence.requests[0].query;
    assert.deepStrictEqual(query.account_ids, ['account:main']);
    assert.deepStrictEqual(query.category_ids, ['category:food']);
    assert.deepStrictEqual(query.member_ids, ['member:family']);
    assert.strictEqual(query.date_from, '2026-07-01');
    assert.strictEqual(query.date_to, '2026-08-01');
    assert.strictEqual(evidence.account, 'account:main');
    assert.strictEqual(evidence.category, 'category:food');
    assert.strictEqual(evidence.member, 'member:family');
    assert.strictEqual(evidence.dateFrom, '2026-07-01');
    assert.strictEqual(evidence.dateTo, '2026-07-31');
    assert(evidence.visibleText.includes('Продукты'));
    assert(evidence.visibleText.includes('Основной счёт'));
    assert(evidence.bodyOverflow <= 1, `drill tablet overflow ${evidence.bodyOverflow}`);

    await page.screenshot({ path: path.join(artifactDir, 'r2-financial-drill-tablet.png'), fullPage: true });
    fs.writeFileSync(path.join(artifactDir, 'r2-financial-drill.json'), JSON.stringify({
      schema: 'PRH_R2_FINANCIAL_DRILL_VISUAL_EVIDENCE_V1',
      privacy_class: 'PUBLIC_SYNTHETIC_TEST_HARNESS',
      first_request_hydrated: true,
      date_to_semantics: 'EXCLUSIVE_SERVER_INCLUSIVE_UI',
      financial_values_in_route: false,
      body_overflow_px: evidence.bodyOverflow
    }, null, 2));

    console.log('r2_financial_drill_visual_test: OK', {
      firstRequestHydrated: true,
      accountFilter: true,
      categoryFilter: true,
      memberFilter: true,
      periodFilter: true,
      financialValuesInRoute: false,
      tabletOverflow: evidence.bodyOverflow
    });
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(tempFile, { force: true });
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
