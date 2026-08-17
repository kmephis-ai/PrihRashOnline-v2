'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const VIEWPORTS = [
  { name:'desktop', width:1600, height:1000, maxPageHeight:2400 },
  { name:'laptop', width:1280, height:900, maxPageHeight:3000 },
  { name:'mobile', width:390, height:844, maxPageHeight:7600 }
];

function expect(condition, message) { if (!condition) throw new Error(message); }

function fixtureRows() {
  const rows = [];
  for (let i = 0; i < 53; i += 1) {
    const d = new Date(Date.UTC(2026, 5, 1 + i));
    const type = i % 5 === 0 ? 'income' : 'expense';
    rows.push({
      row_key:`ROW-${i}`,
      occurred_at:d.toISOString(),
      type,
      status:i % 9 === 0 ? 'pending' : 'posted',
      amount_minor:12000 + i * 731,
      currency:'RUB',
      account_id:`account:${i % 3}`,
      category_id:type === 'income' ? 'category:income' : `category:${i % 5}`,
      member_id:`member:${i % 2}`,
      account:`Счёт ${i % 3 + 1}`,
      destination_account:null,
      category:type === 'income' ? 'Доход' : `Категория ${i % 5 + 1}`,
      member:`Член семьи ${i % 2 + 1}`,
      project:null,
      counterparty:`Контрагент ${i % 7 + 1}`,
      description:`Тестовая операция ${i + 1}`,
      masked:false
    });
  }
  return rows;
}

(async () => {
  const root = path.join(__dirname, '..');
  const artifactDir = path.join(root, 'artifacts');
  fs.mkdirSync(artifactDir, { recursive:true });
  const htmlPath = path.join(root, 'TransactionExplorerWebApp.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  expect(html.includes('data-private-runtime="READ_ONLY"'), 'Explorer must declare private read-only runtime');
  expect(html.includes('prhR2FetchTransactionsPayload'), 'Explorer must call private runtime endpoint');
  expect(html.includes('Только чтение'), 'Explorer must expose human read-only boundary');
  expect(!/SYN-TX-|PUBLIC_SYNTHETIC|Synthetic family transaction|WRITE_BLOCKED/i.test(html), 'Product Explorer must not contain synthetic/write-preview UI');
  expect(!/https?:\/\/(?:cdn\.|unpkg\.|jsdelivr\.)/i.test(html), 'Explorer must not require external CDN resources');

  const browser = await chromium.launch({ headless:true });
  const results = [];
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport:{ width:viewport.width, height:viewport.height }, deviceScaleFactor:1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(({ rows }) => {
      const revision = 'a'.repeat(64);
      const option = (items, field, labelField) => Array.from(new Map(items.map((row) => [row[field], row[labelField]])).entries()).map(([value,label]) => ({value,label}));
      function response(request) {
        const query = request.query || {};
        let filtered = rows.slice();
        const text = String(query.text || '').toLowerCase();
        if (text) filtered = filtered.filter((row) => `${row.counterparty}\n${row.description}`.toLowerCase().includes(text));
        if (query.types && query.types.length) filtered = filtered.filter((row) => query.types.includes(row.type));
        if (query.statuses && query.statuses.length) filtered = filtered.filter((row) => query.statuses.includes(row.status));
        if (query.account_ids && query.account_ids.length) filtered = filtered.filter((row) => query.account_ids.includes(row.account_id));
        if (query.category_ids && query.category_ids.length) filtered = filtered.filter((row) => query.category_ids.includes(row.category_id));
        if (query.member_ids && query.member_ids.length) filtered = filtered.filter((row) => query.member_ids.includes(row.member_id));
        const sort = query.sort || { field:'occurred_at', direction:'DESC' };
        filtered.sort((a,b) => {
          const left=a[sort.field], right=b[sort.field];
          const cmp=typeof left==='number'?left-right:String(left).localeCompare(String(right));
          return sort.direction==='ASC'?cmp:-cmp;
        });
        const offset = Number(query.offset || 0), limit = Number(query.limit || 20);
        const pageRows = filtered.slice(offset, offset + limit);
        const posted = pageRows.filter((row) => row.status === 'posted');
        const income = posted.filter((row) => row.type === 'income').reduce((sum,row) => sum + row.amount_minor, 0);
        const expense = posted.filter((row) => row.type === 'expense').reduce((sum,row) => sum + row.amount_minor, 0);
        return {
          schema:'PRH_R2_PRIVATE_TRANSACTIONS_VIEW_V1',version:'1.0.0',state:'READY',privacy_mode:'NORMAL',currency:'RUB',
          snapshot_revision:revision,snapshot_revision_prefix:revision.slice(0,12),matched_count:filtered.length,page_count:pageRows.length,
          has_more:offset+pageRows.length<filtered.length,query:{query_hash_prefix:'b'.repeat(12),offset,limit,sort},rows:pageRows,
          filters:{accounts:option(rows,'account_id','account'),categories:option(rows,'category_id','category'),members:option(rows,'member_id','member')},
          page_financials:{policy_version:'FIN-TRUTH-v1',included_count:posted.length,income_minor:income,expense_minor:expense,cash_flow_minor:income-expense},
          retryable:true,reason_code:null,financial_write_authorized:false,canonical_mutation_performed:false
        };
      }
      const runner = {
        success:null,failure:null,
        withSuccessHandler(fn){this.success=fn;return this;},
        withFailureHandler(fn){this.failure=fn;return this;},
        prhR2FetchTransactionsPayload(request){const self=this;setTimeout(() => { try { self.success(response(request)); } catch (e) { if (self.failure) self.failure(e); } }, 0);return this;}
      };
      window.google={script:{run:runner}};
    }, { rows:fixtureRows() });

    await page.goto(`file://${htmlPath}`, { waitUntil:'load' });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-private-transactions-ready') === '1');
    expect(!errors.length, `[${viewport.name}] startup error: ${errors.join(' | ')}`);

    const initial = await page.evaluate(() => ({
      overflow:Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      pageHeight:Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      matched:Number(document.getElementById('matched').textContent),
      rows:document.querySelectorAll('.row').length,
      pageLabel:document.getElementById('page-label').textContent,
      filterCount:document.querySelectorAll('.filters .field').length,
      dqHref:document.getElementById('dq-link').getAttribute('href'),
      runtime:document.getElementById('runtime-pill').textContent,
      text:document.body.textContent
    }));
    expect(initial.overflow <= 1, `[${viewport.name}] horizontal overflow ${initial.overflow}`);
    expect(initial.pageHeight <= viewport.maxPageHeight, `[${viewport.name}] page too tall ${initial.pageHeight}`);
    expect(initial.matched === 53, `[${viewport.name}] initial count mismatch`);
    expect(initial.rows === 20, `[${viewport.name}] bounded page must render 20 rows`);
    expect(initial.pageLabel.includes('Страница 1'), `[${viewport.name}] page label missing`);
    expect(initial.filterCount === 9, `[${viewport.name}] expected nine bounded filters`);
    expect(initial.dqHref.includes('surface=data-quality&revision='), `[${viewport.name}] same-snapshot DQ link missing`);
    expect(initial.runtime.includes('Реальные данные'), `[${viewport.name}] private runtime truth missing`);
    expect(!/SYN-|WRITE_BLOCKED|Canonical edit|developer/i.test(initial.text), `[${viewport.name}] developer/synthetic text visible`);

    await page.selectOption('#type', 'expense');
    await page.selectOption('#status', 'posted');
    await page.click('#apply');
    await page.waitForFunction(() => !document.getElementById('runtime-pill').textContent.includes('Загрузка'));
    const filtered = await page.evaluate(() => ({
      matched:Number(document.getElementById('matched').textContent),
      rows:Array.from(document.querySelectorAll('.row')).map((row) => row.textContent.replace(/\s+/g,' '))
    }));
    expect(filtered.matched > 0 && filtered.matched < 53, `[${viewport.name}] filters did not narrow results`);
    expect(filtered.rows.every((text) => text.includes('Расход') && text.includes('Проведено')), `[${viewport.name}] filtered rows violate type/status`);

    await page.click('#reset');
    await page.waitForFunction(() => Number(document.getElementById('matched').textContent) === 53);
    await page.click('#next');
    await page.waitForFunction(() => document.getElementById('page-label').textContent.includes('Страница 2'));
    await page.click('#prev');
    await page.waitForFunction(() => document.getElementById('page-label').textContent.includes('Страница 1'));

    await page.click('.row');
    await page.waitForFunction(() => document.getElementById('drawer').classList.contains('open'));
    const drawer = await page.evaluate(() => ({
      hidden:document.getElementById('drawer').getAttribute('aria-hidden'),
      text:document.getElementById('drawer').textContent.replace(/\s+/g,' '),
      editable:document.querySelectorAll('#drawer input,#drawer select,#drawer textarea').length
    }));
    expect(drawer.hidden === 'false', `[${viewport.name}] detail drawer not accessible`);
    expect(drawer.text.includes('Только чтение'), `[${viewport.name}] read-only boundary missing in details`);
    expect(drawer.editable === 0, `[${viewport.name}] detail drawer must not contain edit controls`);
    await page.click('#close');

    const metrics = await page.evaluate(() => ({
      overflow:Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      pageHeight:Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      drawerOpen:document.getElementById('drawer').classList.contains('open')
    }));
    expect(metrics.overflow <= 1, `[${viewport.name}] interaction introduced horizontal overflow ${metrics.overflow}`);
    expect(metrics.drawerOpen === false, `[${viewport.name}] drawer must close`);
    expect(!errors.length, `[${viewport.name}] runtime errors: ${errors.join(' | ')}`);
    results.push({ viewport:viewport.name, ...metrics });
    await page.screenshot({ path:path.join(artifactDir, `transaction-explorer-${viewport.name}.png`), fullPage:true });
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(artifactDir, 'transaction-explorer-layout.json'), JSON.stringify({
    schema:'PRH_PRIVATE_TRANSACTION_EXPLORER_VISUAL_EVIDENCE_V2',
    privacy_class:'PUBLIC_SYNTHETIC_TEST_HARNESS',
    product_html_private_runtime:true,
    results
  }, null, 2));
  console.log('transaction_explorer_visual_test: OK', { productRuntime:'PRIVATE_READ_ONLY', results });
})().catch((error) => { console.error(error); process.exit(1); });
