'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'CanonicalR2WebAppService.js'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'FinancialHomeWebApp.html'), 'utf8');
const artifactDir = path.join(root, 'artifacts');
fs.mkdirSync(artifactDir, { recursive:true });

function output(content) { return { setTitle(){return this;}, addMetaTag(){return this;}, getContent(){return content;} }; }
const context = vm.createContext({
  console, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent,
  HtmlService:{
    createHtmlOutputFromFile(name){ assert.strictEqual(name,'FinancialHomeWebApp'); return output(homeHtml); },
    createHtmlOutput(content){ return output(String(content)); }
  },
  prhR2BuildFinancialHomeRuntime_(){ throw new Error('visual nav test must not read private data'); },
  prhGetWebDashboardData(){ throw new Error('legacy data must not be read'); },
  prhRenderWebDashboard_(){ throw new Error('legacy renderer must not be used'); }
});
vm.runInContext(source, context, { filename:'CanonicalR2WebAppService.js' });
const rendered = vm.runInContext("prhR2RenderFile_('home',prhR2SmokePayload_()).getContent()", context);
const maskedRendered = vm.runInContext("prhR2RenderFile_('home',prhR2SmokePayload_(),{privacy:'MASKED'}).getContent()", context)
  .replace('</body>', '<a id="dq-link" href="?surface=data-quality&revision=synthetic-revision">dynamic cross-link</a></body>');
const tempFile = path.join(os.tmpdir(), `prh-r2-nav-${process.pid}.html`);
const maskedTempFile = path.join(os.tmpdir(), `prh-r2-nav-masked-${process.pid}.html`);
fs.writeFileSync(tempFile, rendered, 'utf8');
fs.writeFileSync(maskedTempFile, maskedRendered, 'utf8');

const viewports = [
  { name:'desktop', width:1440, height:900 },
  { name:'tablet', width:820, height:980 },
  { name:'mobile', width:390, height:844 }
];
const UNBOUND = ['expenses','income','cash-flow','budget','obligations'];

(async () => {
  const browser = await chromium.launch({ headless:true });
  const evidence = [];
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport:{ width:viewport.width, height:viewport.height } });
      try {
        const errors=[]; page.on('pageerror',(error)=>errors.push(error.message));
        await page.goto(`file://${tempFile}`, { waitUntil:'load', timeout:15000 });
        await page.waitForTimeout(120);
        assert.deepStrictEqual(errors, [], `${viewport.name} startup errors: ${errors.join(' | ')}`);
        const state = await page.evaluate(() => {
          const shell=document.getElementById('prh-r2-shell');
          const primaryNav=document.getElementById('prh-r2-canonical-nav');
          const secondaryNav=document.getElementById('prh-r2-secondary-nav');
          if(!shell||!primaryNav||!secondaryNav) throw new Error('R2_NAV_MISSING');
          const primary=Array.from(primaryNav.querySelectorAll('a'));
          const secondary=Array.from(secondaryNav.querySelectorAll('a'));
          const links=primary.concat(secondary);
          const forbiddenFinancialKeys=/^(?:amount|amount_minor|income|income_minor|expense|expense_minor|cash_flow|cash_flow_minor|balance|balance_minor|value|value_minor|budget_minor)$/i;
          return {
            primary:primary.map((link)=>({id:link.dataset.r2Nav,href:link.getAttribute('href'),label:link.textContent.trim(),current:link.getAttribute('aria-current')})),
            secondary:secondary.map((link)=>({href:link.getAttribute('href'),label:link.textContent.trim(),current:link.getAttribute('aria-current')})),
            active:shell.dataset.activeSurface,
            policy:shell.dataset.navigationPolicy,
            privacyPolicy:shell.dataset.privacyRoutePolicy,
            marker:document.querySelector('meta[name="prh-canonical-r2"]')?.content||'',
            bodyOverflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,
            shellOverflow:shell.scrollWidth-shell.clientWidth,
            visibleShellText:shell.innerText.replace(/\s+/g,' ').trim(),
            financialPayloadInHrefs:links.some((link)=>{const url=new URL(link.getAttribute('href')||'',location.href);return Array.from(url.searchParams.keys()).some((key)=>forbiddenFinancialKeys.test(key));}),
            hrefs:links.map((link)=>link.getAttribute('href'))
          };
        });
        assert.strictEqual(state.marker,'1.2.0');
        assert.strictEqual(state.active,'home');
        assert.strictEqual(state.policy,'PROVEN_DESTINATIONS_ONLY');
        assert.strictEqual(state.privacyPolicy,'PRESERVE_EXPLICIT_MODE');
        assert.deepStrictEqual(state.primary,[
          {id:'home',href:'?surface=home',label:'Главная',current:'page'},
          {id:'transactions',href:'?surface=transactions',label:'Операции',current:null},
          {id:'data-quality',href:'?surface=data-quality',label:'Качество данных',current:null}
        ]);
        assert.deepStrictEqual(state.secondary.map((item)=>item.label),['Студия аналитики','Старый интерфейс']);
        assert.strictEqual(state.financialPayloadInHrefs,false);
        for(const route of UNBOUND) assert(!state.hrefs.includes(`?surface=${route}`),`${viewport.name}: unbound ${route} is visible`);
        assert(!/Explore|Studio|Legacy|rollback|configuration/i.test(state.visibleShellText),`${viewport.name}: English/developer navigation terminology visible`);
        assert(state.bodyOverflow<=1,`${viewport.name} body overflow ${state.bodyOverflow}`);
        assert(state.shellOverflow<=1,`${viewport.name} shell overflow ${state.shellOverflow}`);
        evidence.push({viewport:viewport.name,...state});
        await page.screenshot({path:path.join(artifactDir,`canonical-r2-nav-${viewport.name}.png`),fullPage:true});
      } finally { await page.close().catch(()=>{}); }
    }

    const privacyPage = await browser.newPage({ viewport:{ width:1280, height:900 } });
    try {
      const errors=[]; privacyPage.on('pageerror',(error)=>errors.push(error.message));
      await privacyPage.goto(`file://${maskedTempFile}?privacy=MASKED`, { waitUntil:'load', timeout:15000 });
      await privacyPage.waitForTimeout(120);
      assert.deepStrictEqual(errors, [], `MASKED continuity startup errors: ${errors.join(' | ')}`);
      const privacyState = await privacyPage.evaluate(() => ({
        shellLinks:Array.from(document.querySelectorAll('#prh-r2-shell a')).map((a)=>new URL(a.getAttribute('href'),location.href).searchParams.get('privacy')),
        dynamicPrivacy:new URL(document.getElementById('dq-link').getAttribute('href'),location.href).searchParams.get('privacy'),
        dynamicRevision:new URL(document.getElementById('dq-link').getAttribute('href'),location.href).searchParams.get('revision')
      }));
      assert(privacyState.shellLinks.length >= 5 && privacyState.shellLinks.every((mode)=>mode==='MASKED'),'MASKED must survive every canonical/secondary shell link');
      assert.strictEqual(privacyState.dynamicPrivacy,'MASKED','dynamic DATA cross-link must preserve MASKED mode');
      assert.strictEqual(privacyState.dynamicRevision,'synthetic-revision','privacy preservation must not drop existing route params');
      evidence.push({viewport:'masked-continuity',privacyMode:'MASKED',dynamicInternalLink:true});
    } finally { await privacyPage.close().catch(()=>{}); }

    fs.writeFileSync(path.join(artifactDir,'canonical-r2-navigation.json'),JSON.stringify({
      schema:'PRH_CANONICAL_R2_NAV_VISUAL_EVIDENCE_V4',privacy_class:'PUBLIC_SYNTHETIC_TEST_HARNESS',truthfulNavigation:true,privacyModeContinuity:true,evidence
    },null,2));
    console.log('canonical_r2_navigation_visual_test: OK',{
      viewports:viewports.map((item)=>item.name),primaryRoutes:3,secondaryTools:2,hiddenUnboundRoutes:UNBOUND.length,privacyCheck:'MASKED_ROUTE_CONTINUITY'
    });
  } finally {
    await browser.close().catch(()=>{});
    fs.rmSync(tempFile,{force:true});
    fs.rmSync(maskedTempFile,{force:true});
  }
})().catch((error)=>{console.error(error.stack||error.message);process.exitCode=1;});
