'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const VIEWPORTS = [
  { name:'desktop', width:1440, height:1000, maxPageHeight:2200 },
  { name:'laptop', width:1024, height:900, maxPageHeight:2800 },
  { name:'mobile', width:390, height:844, maxPageHeight:5200 }
];
function expect(condition, message) { if (!condition) throw new Error(message); }

(async () => {
  const root = path.join(__dirname, '..');
  const dir = path.join(root, 'artifacts');
  const htmlPath = path.join(root, 'DataQualityWebApp.html');
  fs.mkdirSync(dir, { recursive:true });
  const html = fs.readFileSync(htmlPath, 'utf8');
  expect(html.includes('data-private-runtime="READ_ONLY"'), 'DQ product HTML must declare private read-only runtime');
  expect(html.includes('prhR2FetchDataQualityPayload'), 'DQ product HTML must call private runtime endpoint');
  expect(html.includes('Автоисправление выключено'), 'DQ human no-autofix boundary missing');
  expect(!/SYNTHETIC • READ_ONLY|WRITE NOT AUTHORIZED|IRREVERSIBLE_ACTION_AUTHORIZED|GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED/i.test(html), 'Product DQ HTML must not expose synthetic/developer policy markers');
  expect(!/https?:\/\/(?:cdn\.|unpkg\.|jsdelivr\.)/i.test(html), 'External CDN forbidden');

  const browser = await chromium.launch({ headless:true });
  const results = [];
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport:{ width:viewport.width, height:viewport.height }, deviceScaleFactor:1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const revision = 'a'.repeat(64);
      const payload = {
        schema:'PRH_R2_PRIVATE_DATA_QUALITY_VIEW_V1', version:'1.0.0', state:'READY', privacy_mode:'NORMAL',
        snapshot_revision:revision, snapshot_revision_prefix:revision.slice(0,12), record_count:42, valid_record_count:41, issue_count:4,
        findings_truncated:false,
        kind_counts:{MISSING_INVALID:1,EXACT_DUPLICATE:1,SUSPICIOUS:1,PROVENANCE:1},
        reason_counts:{MISSING_CATEGORY_ID:1,EXACT_BUSINESS_PAYLOAD_DUPLICATE:1,SELF_TRANSFER:1,SHEET_SOURCE_LOCATION_INCOMPLETE:1},
        findings:[
          {kind:'MISSING_INVALID',reason:'MISSING_CATEGORY_ID',severity:'ERROR',state:'REVIEW_REQUIRED',action:'Исправьте обязательные поля в исходных данных и повторите проверку.',autofix:false},
          {kind:'EXACT_DUPLICATE',reason:'EXACT_BUSINESS_PAYLOAD_DUPLICATE',severity:'WARNING',state:'REVIEW_REQUIRED',action:'Сверьте одинаковые операции перед любым ручным исправлением.',autofix:false},
          {kind:'SUSPICIOUS',reason:'SELF_TRANSFER',severity:'ERROR',state:'REVIEW_REQUIRED',action:'Проверьте отмеченную операцию вручную; автоматическое исправление отключено.',autofix:false},
          {kind:'PROVENANCE',reason:'SHEET_SOURCE_LOCATION_INCOMPLETE',severity:'WARNING',state:'REVIEW_REQUIRED',action:'Проверьте источник и привязку исходной строки.',autofix:false}
        ],
        repair_preview:{proposal_count:4,preview_only:true,write_performed:false},retryable:true,reason_code:null,repair_write_authorized:false,canonical_mutation_performed:false
      };
      const runner = {
        success:null,failure:null,
        withSuccessHandler(fn){this.success=fn;return this;},
        withFailureHandler(fn){this.failure=fn;return this;},
        prhR2FetchDataQualityPayload(){const self=this;setTimeout(() => self.success(payload), 0);return this;}
      };
      window.google={script:{run:runner}};
    });
    await page.goto(`file://${htmlPath}`, { waitUntil:'load' });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-private-data-quality-ready') === '1');
    expect(!errors.length, `[${viewport.name}] startup ${errors.join('|')}`);
    const r = await page.evaluate((max) => {
      const root=document.documentElement, body=document.body;
      const clipped=Array.from(document.querySelectorAll('.card,.label,.value,.head h2,.badge,.finding,.kind,.finding-title,.finding-action,.policy,.pill'))
        .filter((el) => el.scrollWidth > el.clientWidth + 3 || el.scrollHeight > el.clientHeight + 3)
        .map((el) => el.textContent.trim().replace(/\s+/g,' ').slice(0,100));
      return {
        overflow:Math.max(root.scrollWidth,body.scrollWidth)-innerWidth,
        pageHeight:Math.max(root.scrollHeight,body.scrollHeight),
        max,
        clipped,
        cards:document.querySelectorAll('.summary .card').length,
        findings:document.querySelectorAll('.finding').length,
        txHref:document.getElementById('tx-link').getAttribute('href'),
        runtime:document.getElementById('runtime-pill').textContent,
        summary:document.getElementById('finding-summary').textContent,
        text:document.body.innerText.replace(/\s+/g,' ')
      };
    }, viewport.maxPageHeight);
    expect(r.overflow <= 1, `[${viewport.name}] horizontal overflow ${r.overflow}`);
    expect(r.pageHeight <= r.max, `[${viewport.name}] page too tall ${r.pageHeight}`);
    expect(!r.clipped.length, `[${viewport.name}] clipped ${r.clipped.join(';')}`);
    expect(r.cards === 4 && r.findings === 4, `[${viewport.name}] DQ components missing`);
    expect(r.txHref.includes('surface=transactions&revision='), `[${viewport.name}] same-snapshot Transactions link missing`);
    expect(r.runtime.includes('Реальные данные'), `[${viewport.name}] private runtime truth missing`);
    expect(r.summary.includes('Найдено проблем: 4'), `[${viewport.name}] issue summary missing`);
    for (const phrase of ['Некорректная операция','Возможный дубликат','Подозрительная операция','Проблема источника','Автоисправление выключено','Финансовая запись запрещена']) {
      expect(r.text.includes(phrase), `[${viewport.name}] missing ${phrase}`);
    }
    expect(!/MISSING_CATEGORY_ID|EXACT_BUSINESS_PAYLOAD_DUPLICATE|SHEET_SOURCE_LOCATION_INCOMPLETE|WRITE NOT AUTHORIZED|SYNTHETIC/.test(r.text), `[${viewport.name}] developer/synthetic marker visible`);
    results.push({ name:viewport.name, overflow:r.overflow, pageHeight:r.pageHeight, cards:r.cards, findings:r.findings });
    await page.screenshot({ path:path.join(dir,`data-quality-${viewport.name}.png`), fullPage:true });
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(dir,'data-quality-layout.json'), JSON.stringify({
    schema:'PRH_PRIVATE_DATA_QUALITY_VISUAL_EVIDENCE_V2',
    privacy_class:'PUBLIC_SYNTHETIC_TEST_HARNESS',
    product_html_private_runtime:true,
    results
  }, null, 2));
  console.log('data_quality_visual_test: OK', { productRuntime:'PRIVATE_READ_ONLY', results });
})().catch((error) => { console.error(error); process.exit(1); });
