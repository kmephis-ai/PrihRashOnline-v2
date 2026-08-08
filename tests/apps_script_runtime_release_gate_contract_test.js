'use strict';

const fs = require('fs');

const service = fs.readFileSync('DashboardWebDataService.js', 'utf8');
const model = fs.readFileSync('DashboardWebDataModel.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/chat-driven-dev-release.yml', 'utf8');

if (/[^\x00-\x7F]/.test(service)) {
  throw new Error('DashboardWebDataService.js must remain ASCII-only');
}

const start = service.indexOf('function doGet(e) {');
const end = service.indexOf('function prhOpenWebDashboard', start);
if (start < 0 || end < 0) throw new Error('minimal doGet bootstrap not found');
const doGet = service.slice(start, end);

if (!doGet.includes("HtmlService.createTemplateFromFile('DashboardWebApp')")) {
  throw new Error('doGet must render DashboardWebApp');
}
if (!doGet.includes('prhGetWebDashboardData(params.year, params.month, params.view)')) {
  throw new Error('doGet must load dashboard data through the data model');
}
if (!doGet.includes("json.split('<').join(escapedLessThan)")) {
  throw new Error('doGet must escape less-than characters without a regex literal');
}
if (!doGet.includes('return template.evaluate();')) {
  throw new Error('doGet must return the evaluated template directly');
}
if (doGet.includes('.setTitle(') || doGet.includes('.addMetaTag(')) {
  throw new Error('doGet bootstrap must not contain optional HtmlOutput decoration');
}

const serverSource = service + '\n' + model;
const forbidden = [
  { label: 'const declaration', pattern: /(^|\n)\s*const\s/m },
  { label: 'let declaration', pattern: /(^|\n)\s*let\s/m },
  { label: 'arrow function', pattern: /=>/ },
  { label: 'Set constructor', pattern: /new\s+Set\s*\(/ },
  { label: 'Array.from', pattern: /Array\.from\s*\(/ },
  { label: 'Array.fill', pattern: /\.fill\s*\(/ }
];
forbidden.forEach(function (rule) {
  if (rule.pattern.test(serverSource)) {
    throw new Error('Apps Script parser-safe profile violated: ' + rule.label);
  }
});

if (!model.includes('function prhGetWebDashboardData(')) {
  throw new Error('Dashboard data model function is missing');
}
if (!workflow.includes('Invalid or unexpected token')) {
  throw new Error('Release smoke gate must reject Apps Script syntax-error pages');
}
if (!workflow.includes('anonymous CI smoke did not execute doGet')) {
  throw new Error('Release gate must reject an unauthenticated Google login response');
}
if (!workflow.includes("grep -Fqi 'PrihRashOnline'")) {
  throw new Error('Release gate must require a positive Dashboard identity marker');
}
if (!workflow.includes('create-deployment --deploymentId')) {
  throw new Error('Release workflow must redeploy existing Web App with clasp v3 create-deployment --deploymentId');
}
if (workflow.includes('clasp update-deployment')) {
  throw new Error('Release workflow must not use unavailable clasp v3 update-deployment command');
}
if (workflow.includes('open-web-app')) {
  throw new Error('Release workflow must not depend on unavailable clasp v3 open-web-app command');
}

console.log('apps_script_runtime_release_gate_contract_test: OK');
