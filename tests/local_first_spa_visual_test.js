'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const sourceHtml = fs.readFileSync(path.join(root, 'LocalFirstSpaWebApp.html'), 'utf8');
const serviceSource = fs.readFileSync(path.join(root, 'LocalFirstSpaService.js'), 'utf8');
function htmlOutput(content) {
  return {
    title:'', meta:[],
    setTitle(value){ this.title=String(value); return this; },
    addMetaTag(name,value){ this.meta.push([name,value]); return this; },
    getContent(){ return String(content); }
  };
}
const serviceContext = vm.createContext({
  console, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent,
  HtmlService:{
    createHtmlOutputFromFile(name){
      assert.strictEqual(name,'LocalFirstSpaWebApp');
      return htmlOutput(sourceHtml);
    },
    createHtmlOutput(content){ return htmlOutput(content); }
  }
});
vm.runInContext(serviceSource, serviceContext, { filename:'LocalFirstSpaService.js' });
const html = serviceContext.prhLocalFirstSpaRender_({ lf_route:'home', privacy:'MASKED', lf_diag:'1' }).getContent();
assert(html.includes('data-lf-server-responsive-guard="1"'),'server-rendered responsive guard missing');
const artifactDir = path.join(root, 'artifacts');
fs.mkdirSync(artifactDir, { recursive:true });
const tempFile = path.join(os.tmpdir(), `prh-local-first-spa-${process.pid}.html`);
fs.writeFileSync(tempFile, html, 'utf8');

const routes = ['home','transactions','expenses','income','cash-flow','data-quality'];
const viewports = [
  {name:'desktop',width:1440,height:900},
  {name:'mobile',width:390,height:844}
];

function p95(values) {
  const sorted = values.slice().sort((a,b)=>a-b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

(async () => {
  const browser = await chromium.launch({ headless:true });
  const evidence = [];
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport:{width:viewport.width,height:viewport.height} });
      let loadCount = 0;
      let warmPhase = false;
      const warmRequests = [];
      const errors = [];
      page.on('load', () => { loadCount += 1; });
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('request', (request) => { if (warmPhase) warmRequests.push(request.url()); });
      try {
        const url = `${pathToFileURL(tempFile).href}?surface=local-first&lf_route=home&privacy=MASKED&lf_diag=1`;
        await page.goto(url, { waitUntil:'load', timeout:15000 });
        await page.waitForFunction(() => window.__PRH_LF_SPA_TEST__ && document.body.dataset.activeLfRoute === 'home');
        assert.deepStrictEqual(errors, [], `${viewport.name} startup errors: ${errors.join(' | ')}`);
        assert.strictEqual(loadCount, 1, `${viewport.name} initial document must load once`);
        assert.strictEqual(await page.isVisible('#lf-diagnostic'), true, `${viewport.name} diagnostic mode must be visible`);
        warmPhase = true;

        for (const route of routes.slice(1)) {
          await page.click(`[data-lf-route="${route}"]`);
          await page.waitForFunction((expected) => document.body.dataset.activeLfRoute === expected, route);
          const state = await page.evaluate(() => ({
            active:document.body.dataset.activeLfRoute,
            title:document.getElementById('lf-title').textContent.trim(),
            current:document.querySelector('#lf-nav [aria-current="page"]')?.dataset.lfRoute || '',
            focus:document.activeElement?.id || '',
            url:location.href,
            runtime:window.__PRH_LF_SPA_TEST__.getState()
          }));
          assert.strictEqual(state.active, route);
          assert.strictEqual(state.current, route);
          assert.strictEqual(state.focus, 'lf-main');
          assert.strictEqual(state.runtime.bootCount, 1);
          assert.strictEqual(state.runtime.mandatoryNetworkCalls, 0);
          assert.strictEqual(state.runtime.googleSheetsReads, 0);
          assert.strictEqual(state.runtime.diagnosticMode, true);
          assert(new URL(state.url).searchParams.get('privacy') === 'MASKED');
          assert(new URL(state.url).searchParams.get('lf_diag') === '1');
        }

        assert.strictEqual(loadCount, 1, `${viewport.name} warm route clicks must not reload document`);
        assert.deepStrictEqual(warmRequests, [], `${viewport.name} warm route clicks emitted requests: ${warmRequests.join(' | ')}`);

        await page.evaluate(() => history.back());
        await page.waitForFunction(() => document.body.dataset.activeLfRoute === 'cash-flow');
        assert.strictEqual(loadCount, 1, `${viewport.name} Back must not reload document`);
        await page.evaluate(() => history.forward());
        await page.waitForFunction(() => document.body.dataset.activeLfRoute === 'data-quality');
        assert.strictEqual(loadCount, 1, `${viewport.name} Forward must not reload document`);
        assert.deepStrictEqual(warmRequests, [], `${viewport.name} Back/Forward emitted requests`);

        // Server-rendered source preview intentionally has no injected finance
        // runtime/Worker. It must never manufacture a Product P95, and a long
        // machine-readable fail-closed reason must remain responsive on mobile.
        await page.click('#lf-diag-run');
        await page.waitForFunction(() => document.getElementById('lf-diag-result')?.dataset.status === 'FAIL', null, { timeout:5000 });
        const previewDiagnostic = await page.evaluate(() => {
          const state=window.__PRH_LF_SPA_TEST__.getState();
          const output=document.getElementById('lf-diag-result');
          return {
            status:output.dataset.status,
            reason:output.dataset.reason || null,
            p95Ms:output.dataset.p95Ms || null,
            text:output.textContent.trim(),
            disabled:document.getElementById('lf-diag-run').disabled,
            lastDiagnostic:state.lastDiagnostic || null,
            activeRoute:state.activeRoute
          };
        });
        assert.strictEqual(previewDiagnostic.status,'FAIL');
        assert.strictEqual(previewDiagnostic.reason,'LOCAL_FINANCE_DIAGNOSTIC_RUNTIME_NOT_READY');
        assert.strictEqual(previewDiagnostic.p95Ms,null,`${viewport.name} source preview must not publish finance P95`);
        assert.strictEqual(previewDiagnostic.lastDiagnostic,null,`${viewport.name} source preview must not publish finance diagnostic evidence`);
        assert.strictEqual(previewDiagnostic.text,'Измерение недоступно: LOCAL_FINANCE_DIAGNOSTIC_RUNTIME_NOT_READY');
        assert.strictEqual(previewDiagnostic.disabled,false,`${viewport.name} diagnostic button must be reusable after fail-closed result`);
        assert.strictEqual(previewDiagnostic.activeRoute,'data-quality',`${viewport.name} rejected diagnostic must preserve route`);
        assert.strictEqual(loadCount,1,`${viewport.name} rejected diagnostic must stay in one document`);
        assert.deepStrictEqual(warmRequests,[],`${viewport.name} rejected diagnostic emitted requests`);

        // Shell timing remains a separate SPA engineering metric and is never
        // presented as finance-ready Product latency.
        const durations = await page.evaluate((routeList) => {
          const out=[];
          for(let i=0;i<60;i+=1){
            const route=routeList[i%routeList.length];
            const started=performance.now();
            window.__PRH_LF_SPA_TEST__.navigate(route);
            out.push(performance.now()-started);
          }
          return out;
        }, routes);
        const routeP95 = p95(durations);
        assert(routeP95 <= 100, `${viewport.name} synthetic shell warm route p95 ${routeP95.toFixed(2)}ms > 100ms`);
        assert.strictEqual(loadCount, 1, `${viewport.name} measured shell route loop must stay in one document`);
        assert.deepStrictEqual(warmRequests, [], `${viewport.name} measured shell route loop emitted requests`);

        const layout = await page.evaluate(() => ({
          bodyOverflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,
          routeLinks:Array.from(document.querySelectorAll('[data-lf-route]')).map((a)=>({route:a.dataset.lfRoute,label:a.textContent.trim()})),
          rollbackText:document.getElementById('lf-rollback').textContent.trim(),
          rollbackSurface:new URL(document.getElementById('lf-rollback').href).searchParams.get('surface'),
          rollbackPrivacy:new URL(document.getElementById('lf-rollback').href).searchParams.get('privacy'),
          financialLookingText:/\b\d[\d\s]{3,}[₽$€]|руб(?:\.|лей)/i.test(document.body.innerText),
          visibleText:document.body.innerText.replace(/\s+/g,' ').trim(),
          runtime:window.__PRH_LF_SPA_TEST__.getState()
        }));
        assert(layout.bodyOverflow <= 1, `${viewport.name} body overflow ${layout.bodyOverflow}`);
        assert.deepStrictEqual(layout.routeLinks.map((item)=>item.route), routes);
        assert.strictEqual(layout.rollbackSurface, 'home');
        assert.strictEqual(layout.rollbackPrivacy, 'MASKED');
        assert.strictEqual(layout.financialLookingText, false, `${viewport.name} must not show synthetic financial amounts`);
        assert(!/SYN-TX-|PUBLIC_SYNTHETIC|value_minor|amount_minor/.test(layout.visibleText));
        assert.strictEqual(layout.runtime.bootCount, 1);

        const screenshot = path.join(artifactDir, `local-first-spa-${viewport.name}.png`);
        await page.screenshot({ path:screenshot, fullPage:true });
        evidence.push({
          viewport:viewport.name,
          width:viewport.width,
          height:viewport.height,
          singleDocumentLoadCount:loadCount,
          warmNetworkRequestCount:warmRequests.length,
          shellWarmRouteSampleCount:durations.length,
          shellWarmRouteP95Ms:Number(routeP95.toFixed(3)),
          financeDiagnosticInSourcePreview:'BLOCKED_NO_RUNTIME',
          financeDiagnosticReason:previewDiagnostic.reason,
          financeDiagnosticP95Published:false,
          diagnosticButtonReusableAfterFailure:true,
          serverResponsiveGuard:true,
          bootCount:layout.runtime.bootCount,
          routeRenderCount:layout.runtime.routeRenderCount,
          privacyMode:'MASKED',
          rollbackSurface:layout.rollbackSurface,
          responsiveOverflowPx:layout.bodyOverflow
        });
      } finally {
        await page.close().catch(()=>{});
      }
    }

    fs.writeFileSync(path.join(artifactDir, 'local-first-spa-visual.json'), JSON.stringify({
      schema:'PRH_LOCAL_FIRST_SPA_VISUAL_EVIDENCE_V1',
      privacy_class:'PUBLIC_NO_FINANCIAL_PAYLOAD',
      candidate_scope:'SYNTHETIC_SHELL_ONLY_NOT_PRODUCT_UAT',
      zeroMandatoryWarmNetwork:true,
      singleDocument:true,
      financeDiagnosticRequiresInjectedRuntime:true,
      sourcePreviewFinanceP95Blocked:true,
      diagnosticFailureReasonVisible:true,
      serverResponsiveGuard:true,
      evidence
    }, null, 2));
    console.log('local_first_spa_visual_test: OK', {
      viewports:viewports.map((item)=>item.name),
      routes:routes.length,
      zeroWarmNetwork:true,
      singleDocument:true,
      sourcePreviewFinanceP95Blocked:true,
      diagnosticFailureReasonVisible:true,
      serverResponsiveGuard:true,
      maxSyntheticShellWarmRouteP95Ms:Math.max(...evidence.map((item)=>item.shellWarmRouteP95Ms))
    });
  } finally {
    await browser.close().catch(()=>{});
    fs.rmSync(tempFile, { force:true });
  }
})().catch((error)=>{ console.error(error.stack||error.message); process.exitCode=1; });
