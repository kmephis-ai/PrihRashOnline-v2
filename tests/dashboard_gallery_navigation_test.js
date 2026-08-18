'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sourceHtml = fs.readFileSync(path.join(root, 'LocalFirstSpaWebApp.html'), 'utf8');
const dataExtensionHtml = fs.readFileSync(path.join(root, 'LocalFirstDataSpaExtension.html'), 'utf8');
const planningExtensionHtml = fs.readFileSync(path.join(root, 'LocalFirstPlanningSpaExtension.html'), 'utf8');
const visualizationExtensionHtml = fs.readFileSync(path.join(root, 'LocalFirstVisualizationSpaExtension.html'), 'utf8');
const serviceSource = fs.readFileSync(path.join(root, 'LocalFirstSpaService.js'), 'utf8');

function output(content) {
  return {
    getContent(){ return String(content); },
    setTitle(){ return this; },
    addMetaTag(){ return this; }
  };
}

const selfUrl = 'https://script.google.com/macros/s/PRH_DASH090_NAV_TEST/exec';
const context = vm.createContext({
  JSON, Object, Array, String, Number, Math, Date, RegExp, Error, encodeURIComponent,
  ScriptApp:{getService:()=>({getUrl:()=>`${selfUrl}?sandbox_source=1`})},
  HtmlService:{
    createHtmlOutputFromFile(name){
      if (name === 'LocalFirstSpaWebApp') return output(sourceHtml);
      if (name === 'LocalFirstDataSpaExtension') return output(dataExtensionHtml);
      if (name === 'LocalFirstPlanningSpaExtension') return output(planningExtensionHtml);
      if (name === 'LocalFirstVisualizationSpaExtension') return output(visualizationExtensionHtml);
      throw new Error(`unexpected HtmlService file: ${name}`);
    },
    createHtmlOutput(content){ return output(content); }
  }
});

vm.runInContext(serviceSource, context, {filename:'LocalFirstSpaService.js'});
const rendered = context.prhLocalFirstSpaRender_({lf_route:'home',privacy:'NORMAL',lf_diag:'1'}).getContent();
const absoluteGallery = `class="lf-studio-gallery-link" href="${selfUrl}?surface=gallery" target="_top"`;

assert(visualizationExtensionHtml.includes('class="lf-studio-gallery-link" href="?surface=gallery"'), 'DASH090 source launcher marker missing');
assert(rendered.includes(absoluteGallery), 'DASH090 rendered launcher must target deployed Web App self URL at the top browsing context');
assert(!rendered.includes('class="lf-studio-gallery-link" href="?surface=gallery"'), 'DASH090 rendered launcher must not remain HtmlService-sandbox-relative');
assert(!rendered.includes(`<iframe src="${selfUrl}?surface=gallery"`), 'DASH090 gallery must never embed script.google.com in an iframe');
assert(rendered.includes(`href="${selfUrl}?surface=home"`), 'canonical Local-first rollback self URL must remain intact');

console.log('dashboard_gallery_navigation_test: PASS', {self_url_routing:true, top_level_gallery:true, sandbox_relative_gallery:false, framed_script_google:false, financial_payload:false});
