'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const htmlSource = fs.readFileSync(path.join(root, 'LocalFirstSpaWebApp.html'), 'utf8');
const dataExtensionHtml = fs.readFileSync(path.join(root, 'LocalFirstDataSpaExtension.html'), 'utf8');
const planningExtensionHtml = fs.readFileSync(path.join(root, 'LocalFirstPlanningSpaExtension.html'), 'utf8');
const serviceSource = fs.readFileSync(path.join(root, 'LocalFirstSpaService.js'), 'utf8');

function htmlOutput(content) {
  return {
    title:'',
    meta:[],
    setTitle(value){ this.title=String(value); return this; },
    addMetaTag(name,value){ this.meta.push([String(name),String(value)]); return this; },
    getContent(){ return String(content); }
  };
}

const context = vm.createContext({
  console, JSON, Object, Array, String, Number, Math, Date, RegExp, Error, encodeURIComponent,
  HtmlService:{
    createHtmlOutputFromFile(name){
      if (name === 'LocalFirstSpaWebApp') return htmlOutput(htmlSource);
      if (name === 'LocalFirstDataSpaExtension') return htmlOutput(dataExtensionHtml);
      if (name === 'LocalFirstPlanningSpaExtension') return htmlOutput(planningExtensionHtml);
      throw new Error(`unexpected HtmlService file: ${name}`);
    },
    createHtmlOutput(content){ return htmlOutput(content); }
  }
});
vm.runInContext(serviceSource, context, { filename:'LocalFirstSpaService.js' });

const household = vm.runInContext("prhLocalFirstSpaRender_({lf_route:'home',privacy:'NORMAL'}).getContent()", context);
const diagnostic = vm.runInContext("prhLocalFirstSpaRender_({lf_route:'home',privacy:'NORMAL',lf_diag:'1'}).getContent()", context);

const beforeDiagnostic = household.split('<section class="diagnostic"')[0];
for (const forbidden of [
  'Local-first finance',
  'Warm path без сети',
  'FIN-TRUTH',
  'Exact candidate only',
  'FIN-LF-001',
  'IndexedDB runtime',
  'canonical analytics Web Worker',
  'verified Local Read Model',
  'Вернуться к R2'
]) {
  assert(!beforeDiagnostic.includes(forbidden), `household visible copy leaked developer marker: ${forbidden}`);
}

for (const required of [
  'Семейные финансы',
  'Быстрый режим',
  'Проверенные данные',
  'Предыдущий интерфейс',
  'Показатели формируются только по вашим проверенным операциям.',
  'приложение не подменяет ваши данные демонстрационными суммами',
  'Список операций из вашей проверенной локальной копии с быстрыми фильтрами и просмотром деталей.',
  'Проверка полноты и согласованности текущей локальной копии без автоматического изменения данных.'
]) {
  assert(household.includes(required), `household copy missing: ${required}`);
}

assert(household.includes('data-prh-local-first-data-extension="1.0.0"'), 'Data extension must be part of server-rendered Local-first document');
assert(household.includes('data-prh-local-first-planning-extension="1.0.0"'), 'Planning extension must be part of server-rendered Local-first document');
assert(household.includes('id="lf-revision-chip" hidden'), 'technical revision chip must be hidden outside diagnostic mode');
assert(household.includes("function provenance(view){return '<div class=\"provenance\"><div>Источник: <strong>ваши проверенные операции</strong>"), 'normal provenance must be owner-facing');
assert(household.includes("'Данные готовы'"), 'READY status must be owner-facing');
assert(household.includes("'Обновляем…'"), 'SYNCING status must be owner-facing');
assert(household.includes('Не удалось обновить показатели. Попробуйте обновить данные.'), 'financial error state must be owner-facing');
assert(household.includes('Не удалось подготовить финансовые данные. Попробуйте обновить страницу.'), 'runtime boot error must be owner-facing');

// Explicit diagnostic mode keeps exact technical evidence available to the
// owner without making it part of the ordinary household-facing surface.
for (const technical of [
  'Local-first finance',
  'Warm path без сети',
  'FIN-TRUTH',
  'Exact candidate only',
  'FIN-LF-001',
  'canonical Web Worker',
  'UI financial formulas: <strong>0</strong>'
]) {
  assert(diagnostic.includes(technical), `diagnostic evidence unexpectedly removed: ${technical}`);
}
assert(!diagnostic.includes('id="lf-revision-chip" hidden'), 'diagnostic mode must keep revision evidence visible');
assert(diagnostic.includes('&lf_diag=1'), 'diagnostic bootstrap must preserve explicit opt-in');

for (const forbiddenAuthority of ['setValues(', 'appendRow(', 'deleteRow(', 'insertRowAfter(', 'UrlFetchApp.']) {
  assert(!serviceSource.includes(forbiddenAuthority), `presentation cleanup gained forbidden authority: ${forbiddenAuthority}`);
}
for (const forbiddenNetwork of ['google.script.run', 'fetch(', 'XMLHttpRequest(']) {
  assert(!dataExtensionHtml.includes(forbiddenNetwork), `Local-first Data warm path gained forbidden network primitive: ${forbiddenNetwork}`);
}

console.log('local_first_household_copy_runtime_test: PASS', {
  householdCopy:true,
  dataRoutesOwnerFacing:true,
  diagnosticOptInPreserved:true,
  revisionHiddenInHousehold:true,
  financialAuthorityChanged:false,
  dataWriteAuthority:false,
  financialWrite:false
});