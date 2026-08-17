'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const html = fs.readFileSync(path.join(__dirname, '..', 'ExpertDashboardGalleryWebApp.html'), 'utf8');
const catalog = [
  ['CASH_FLOW_DECOMPOSITION','Декомпозиция денежного потока','Вклад в денежный поток'],
  ['SPENDING_DRIVERS','Драйверы расходов','Что меняет расходы'],
  ['SEASONALITY','Сезонность','Календарная сезонность'],
  ['CONCENTRATION','Концентрация','Концентрация расходов'],
  ['LONG_TERM_TRENDS','Долгосрочные тренды','Доходы и расходы'],
  ['WEALTH_RISK','Капитал и финансовая устойчивость','Капитал'],
  ['FINANCIAL_HEALTH_XRAY','Финансовый рентген семьи','Главные сигналы']
].map(([preset_id,title,panelTitle]) => ({
  preset_id,title,description:`Описание ${title}`,required_capabilities:['PRH_TEST_CAPABILITY_V1@1.0.0'],status:'AVAILABLE',reason:'OK',preset_hash:'a'.repeat(64),
  panels:[{panel_id:'panel-1',title:panelTitle,visual_ref:'BAR'}]
}));

function listen(server) { return new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server.address())); }); }
function close(server) { return new Promise((resolve) => server.close(resolve)); }

(async () => {
  const server = http.createServer((req,res) => { res.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'no-store'}); res.end(html); });
  const address = await listen(server);
  const browser = await chromium.launch({headless:true});
  const results = [];
  try {
    for (const viewport of [{name:'desktop',width:1280,height:900},{name:'mobile',width:390,height:844}]) {
      const context = await browser.newContext({viewport:{width:viewport.width,height:viewport.height}});
      const page = await context.newPage();
      const errors = [];
      const requests = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(`console:${msg.text()}`); });
      page.on('pageerror', error => errors.push(`page:${error.message}`));
      page.on('request', request => requests.push(request.url()));
      await page.addInitScript(({catalog}) => {
        const key='dash090-visual-state';
        function read(){const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null;}
        function write(value){localStorage.setItem(key,JSON.stringify(value));return value;}
        function summary(preset,viewId,title,generation,revision){return {schema:'PRH_EXPERT_DASHBOARD_GALLERY_RUNTIME_V1',contract_version:'1.0.0',financial_payload:false,query_execution:false,financial_write:false,google_sheets_read:false,view_id:viewId,view_name:preset.title,store_generation:generation,view_generation:revision,active_revision:revision,preset_id:preset.preset_id,preset_hash:preset.preset_hash,preset_title:preset.title,preset_description:preset.description,panels:preset.panels.map((p)=>({...p,kind:'ANALYTICS',source_contract:'PRH_TEST_CAPABILITY_V1@1.0.0',semantic_ref:'TEST'})),dashboard_spec:{schema:'PRH_DASHBOARD_SPEC_V1',version:'1.0.0',id:'expert-v1-'+preset.preset_id.toLowerCase().replace(/_/g,'-'),title,widgets:preset.panels.map((p,i)=>({id:'w-'+String(i+1).padStart(4,'0'),title:p.title,geometry:{x:0,y:i*3,w:6,h:3}}))}};}
        const runner={success:null,failure:null,withSuccessHandler(fn){this.success=fn;return this;},withFailureHandler(fn){this.failure=fn;return this;},done(value){queueMicrotask(()=>this.success&&this.success(value));},bad(error){queueMicrotask(()=>this.failure&&this.failure(error));},prhDash090PublicCatalog(){this.done({schema:'PRH_EXPERT_DASHBOARD_GALLERY_RUNTIME_V1',contract_version:'1.0.0',financial_payload:false,query_execution:false,financial_write:false,google_sheets_read:false,presets:catalog});},prhDash090ClonePreset(request){const preset=catalog.find(p=>p.preset_id===request.preset_id);if(!preset)return this.bad(new Error('UNKNOWN'));const value=summary(preset,request.view_id,preset.title,1,1);write(value);this.done(value);},prhDash090ReadView(request){const value=read();if(!value||value.view_id!==request.view_id)return this.bad(new Error('NOT_FOUND'));this.done(value);},prhDash090SaveViewConfiguration(request){const current=read();if(!current||current.view_id!==request.view_id)return this.bad(new Error('NOT_FOUND'));if(current.store_generation!==request.expected_generation)return this.bad(new Error('GENERATION_CONFLICT'));const preset=catalog.find(p=>p.preset_id===current.preset_id);const value=summary(preset,current.view_id,request.dashboard_title,current.store_generation+1,current.active_revision+1);write(value);this.done(value);}};
        Object.defineProperty(window,'google',{value:{script:{run:runner}},configurable:true});
      }, {catalog});
      await page.goto(`http://127.0.0.1:${address.port}/?surface=gallery`, {waitUntil:'load'});
      await page.waitForSelector('.card[data-preset-id="CASH_FLOW_DECOMPOSITION"] button:not([disabled])');
      assert.strictEqual(await page.locator('.card').count(),7,`${viewport.name} catalog count`);
      assert.strictEqual(await page.locator('.preview').count(),7,`${viewport.name} visual structure previews`);
      assert(await page.locator('.sidebar').isVisible(),`${viewport.name} integrated finance navigation`);
      assert(await page.getByText('Конфигурация проверена').isVisible(),`${viewport.name} truthful verified catalog state`);
      const initialRequests=requests.length;
      await page.locator('#catalog-search').fill('сезонность');
      await page.waitForFunction(() => document.querySelectorAll('.card').length === 1);
      assert.strictEqual(await page.locator('.card[data-preset-id="SEASONALITY"]').count(),1,`${viewport.name} local catalog search`);
      await page.locator('#catalog-search').fill('');
      await page.waitForFunction(() => document.querySelectorAll('.card').length === 7);
      await page.locator('#catalog-filter').selectOption('AVAILABLE');
      assert.strictEqual(await page.locator('.card').count(),7,`${viewport.name} availability filter`);
      await page.locator('#catalog-filter').selectOption('ALL');
      assert.strictEqual(requests.length,initialRequests,`${viewport.name} search/filter must stay local`);
      const first=page.locator('.card[data-preset-id="CASH_FLOW_DECOMPOSITION"] button');
      await first.focus();
      await page.keyboard.press('Enter');
      await page.waitForSelector('#dashboard-title');
      assert((await page.locator('#dashboard-title').inputValue()).includes('Декомпозиция'),`${viewport.name} cloned view opens`);
      await page.locator('#dashboard-title').fill('Мой экспертный денежный поток');
      await page.locator('#save-view').focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.getElementById('result').textContent.includes('новая версия'));
      assert.strictEqual(requests.length,initialRequests,`${viewport.name} warm clone/edit must not add browser network requests`);
      const overflow=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
      assert(overflow.scrollWidth<=overflow.clientWidth+1,`${viewport.name} horizontal overflow`);
      await page.reload({waitUntil:'load'});
      await page.waitForSelector('#dashboard-title');
      assert.strictEqual(await page.locator('#dashboard-title').inputValue(),'Мой экспертный денежный поток',`${viewport.name} reload persisted title`);
      assert.strictEqual(errors.length,0,`${viewport.name} browser errors: ${errors.join('; ')}`);
      results.push({viewport:viewport.name,cards:7,previews:7,local_search:true,integrated_navigation:true,active_revision:2,warm_extra_requests:0,overflow:false});
      await context.close();
    }
    console.log('expert_dashboard_gallery_visual_test: PASS', results);
  } finally { await browser.close(); await close(server); }
})().catch((error) => { console.error(error); process.exit(1); });
