'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'FinancialSectionsWebApp.html'), 'utf8');

assert(source.includes('data-filter-navigation="IN_PAGE_RPC_STATE"'));
assert(source.includes('function filterStateFromForm()'));
assert(source.includes('function applyFilterState('));
assert(source.includes("document.getElementById('filters').addEventListener('submit',filterSubmit)"));
assert(!source.includes('CANONICAL_TOP_GET'));

const shell = '<div id="prh-r2-shell" data-active-surface="expenses">' +
  '<a data-r2-nav="expenses" href="https://script.google.com/macros/s/TEST_DEPLOYMENT/exec?surface=expenses">Расходы</a>' +
  '<a data-r2-nav="income" href="https://script.google.com/macros/s/TEST_DEPLOYMENT/exec?surface=income">Доходы</a>' +
  '<a data-r2-nav="cash-flow" href="https://script.google.com/macros/s/TEST_DEPLOYMENT/exec?surface=cash-flow">Денежный поток</a>' +
  '</div>';
const rendered = source.replace(/(<body[^>]*>)/, `$1${shell}`);
const tempFile = path.join(os.tmpdir(), `prh-fin-filter-${process.pid}.html`);
fs.writeFileSync(tempFile, rendered, 'utf8');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => {
      window.__requests = [];
      window.__fixture = (request) => {
        const section = request.section;
        const filtered = request.window_days === 30 && request.filters.account_ids[0] === 'ACC-1' && request.filters.category_ids[0] === 'CAT-1' && request.filters.member_ids[0] === 'MEM-1';
        const common = {
          schema:'PRH_R2_PRIVATE_FINANCIAL_SECTIONS_VIEW_V1',version:'1.0.0',state:'READY',section,
          privacy_mode:'NORMAL',currency:'RUB',window_days:request.window_days,snapshot_revision:'a'.repeat(64),snapshot_revision_prefix:'aaaaaaaaaaaa',
          period:{start:filtered?'2026-07-13':'2026-05-14',end:'2026-08-12'},comparison_period:{start:filtered?'2026-06-13':'2026-02-13',end:filtered?'2026-07-13':'2026-05-14'},
          filters:{selected:request.filters,options:{accounts:[{value:'ACC-1',label:'Основной'},{value:'ACC-2',label:'Накопительный'}],categories:[{value:'CAT-1',label:'Продукты'},{value:'CAT-2',label:'Дом'}],members:[{value:'MEM-1',label:'Семья'},{value:'MEM-2',label:'Другой'}]}}
        };
        const factor = filtered ? 1 : 10;
        if(section==='expenses')common.expenses={total_expense_minor:1000*factor,comparison_expense_minor:900*factor,delta_minor:100*factor,trend:[{time_bucket:'2026-08-10',expense_minor:500*factor},{time_bucket:'2026-08-11',expense_minor:500*factor}],category_mix:[{category_id:'CAT-1',category_label:'Продукты',expense_minor:1000*factor}],drivers:[{category_id:'CAT-1',category_label:'Продукты',delta_minor:100*factor}]};
        if(section==='income')common.income={total_income_minor:2000*factor,comparison_income_minor:1800*factor,delta_minor:200*factor,stability:{stability_score:90},trend:[{time_bucket:'2026-08-10',income_minor:1000*factor},{time_bucket:'2026-08-11',income_minor:1000*factor}],source_mix:[{source_id:'CAT-1',source_label:'Зарплата',income_minor:2000*factor}],source_deltas:[{source_id:'CAT-1',source_label:'Зарплата',delta_minor:200*factor}]};
        if(section==='cash-flow')common.cash_flow={inflow_minor:2000*factor,outflow_minor:1000*factor,net_minor:1000*factor,trend:[{time_bucket:'2026-08-10',net_minor:500*factor},{time_bucket:'2026-08-11',net_minor:500*factor}],comparison:{inflow_minor:1800*factor,outflow_minor:900*factor,net_minor:900*factor}};
        return common;
      };
      const runner={success:null,failure:null,withSuccessHandler(fn){this.success=fn;return this;},withFailureHandler(fn){this.failure=fn;return this;},prhR2FetchFinancialSectionsPayload(request){window.__requests.push(JSON.parse(JSON.stringify(request)));const callback=this.success;setTimeout(()=>callback(window.__fixture(request)),0);return this;}};
      window.google={script:{run:runner}};
    });

    const errors=[];
    page.on('pageerror',(error)=>errors.push(error.message));
    await page.goto(`file://${tempFile}?surface=expenses`,{waitUntil:'load',timeout:15000});
    await page.waitForFunction(()=>document.documentElement.getAttribute('data-fin-initial-ready')==='1',null,{timeout:10000});
    assert.deepStrictEqual(errors,[]);

    const baseline = await page.evaluate(() => ({
      request: window.__requests[0],
      amount: document.querySelector('#summary .value').textContent,
      search: location.search
    }));
    assert.strictEqual(baseline.request.window_days,90);
    assert.deepStrictEqual(baseline.request.filters,{account_ids:[],category_ids:[],member_ids:[]});

    await page.evaluate(()=>{
      document.getElementById('window-days').value='30';
      document.getElementById('account-filter').value='ACC-1';
      document.getElementById('category-filter').value='CAT-1';
      document.getElementById('member-filter').value='MEM-1';
      document.getElementById('filters').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    });
    await page.waitForFunction(()=>document.documentElement.getAttribute('data-fin-filter-ready')==='1',null,{timeout:10000});

    const filtered = await page.evaluate(() => ({
      request: window.__requests[window.__requests.length-1],
      amount: document.querySelector('#summary .value').textContent,
      search: location.search,
      period: document.getElementById('window-days').value,
      account: document.getElementById('account-filter').value,
      category: document.getElementById('category-filter').value,
      member: document.getElementById('member-filter').value
    }));
    assert.strictEqual(filtered.request.window_days,30);
    assert.deepStrictEqual(filtered.request.filters,{account_ids:['ACC-1'],category_ids:['CAT-1'],member_ids:['MEM-1']});
    assert.notStrictEqual(filtered.amount,baseline.amount,'filtered payload must replace visible financial result');
    assert(filtered.search.includes('window_days=30'));
    assert(filtered.search.includes('account_id=ACC-1'));
    assert.deepStrictEqual({period:filtered.period,account:filtered.account,category:filtered.category,member:filtered.member},{period:'30',account:'ACC-1',category:'CAT-1',member:'MEM-1'});

    await page.evaluate(()=>{
      document.getElementById('window-days').value='90';
      document.getElementById('account-filter').value='';
      document.getElementById('category-filter').value='';
      document.getElementById('member-filter').value='';
      document.documentElement.setAttribute('data-fin-filter-ready','0');
      document.getElementById('filters').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    });
    await page.waitForFunction(()=>document.documentElement.getAttribute('data-fin-filter-ready')==='1',null,{timeout:10000});
    const reset = await page.evaluate(() => ({request:window.__requests[window.__requests.length-1],search:location.search}));
    assert.strictEqual(reset.request.window_days,90);
    assert.deepStrictEqual(reset.request.filters,{account_ids:[],category_ids:[],member_ids:[]});
    assert(!reset.search.includes('account_id='));

    console.log('r2_financial_filter_web_ui_test: OK',{inPageRpc:true,semanticRequest:true,visibleResultChanged:true,historyState:true,reset:true});
  }finally{
    await browser.close().catch(()=>{});
    fs.rmSync(tempFile,{force:true});
  }
})().catch((error)=>{console.error(error.stack||error.message);process.exitCode=1;});
