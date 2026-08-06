'use strict';

const fs = require('fs');
const path = require('path');
const prepareDashboardWeb = require('../tools/prepare-dashboard-web.js');

const root = path.join(__dirname, '..');
const preparation = prepareDashboardWeb(path.join(root, 'DashboardWebApp.html'));
const service = fs.readFileSync(path.join(root, 'DashboardWebDataService.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'DashboardWebApp.html'), 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

[
  'function doGet(e)',
  'function prhGetWebDashboardData(',
  'function prhOpenWebDashboard()',
  'function prhWebResolveView_(',
  "OPERATIONS_SHEET: '01 Операции'",
  "QUALITY_CELL: 'E397'",
  "VERSION: '1.1.0'",
  'VIEWS: Object.freeze',
  'params.view',
  'HtmlService.createTemplateFromFile',
  'ScriptApp.getService().getUrl()'
].forEach((required) => expect(service.includes(required), `Missing service contract: ${required}`));

[
  '.setValue(', '.setValues(', '.clearContent(', '.appendRow(',
  '.deleteRow(', '.deleteRows(', '.insertSheet(', '.deleteSheet(',
  '.hideRows(', '.showRows(', '.setColumnWidth(', '.setRowHeight('
].forEach((forbidden) => expect(!service.includes(forbidden), `Web data service must be read-only: ${forbidden}`));

[
  'class="topbar"', 'class="tabs"', 'class="filters"', 'class="dashboard-grid"',
  'id="yearly-chart"', 'id="monthly-chart"', 'id="donut"',
  'id="year-select"', 'id="month-select"', 'id="kpi-layout"',
  'id="view-detail"', 'id="detail-content"', 'id="view-title"',
  'grid-template-columns: 1.06fr 1fr', 'grid-template-columns: 1.08fr .92fr',
  '@media (max-width: 1250px)', 'const FIXTURE =', 'google.script.run',
  "window.addEventListener('popstate'", 'window.history[method]',
  '.prhGetWebDashboardData(year, month, activeView)',
  'function forecastYear(data)', 'function renderDetail(data, view)',
  'function emptyState(title,note)',
  "const yearRaw = params.get('year')",
  "const monthRaw = params.get('month')",
  "yearRaw === null || yearRaw === '' ? null : Number(yearRaw)",
  "monthRaw === null || monthRaw === '' ? null : Number(monthRaw)",
  "month !== null && month !== '' && Number.isInteger(Number(month))",
  'scrollbar-width: none',
  '.tabs::-webkit-scrollbar { display: none; }'
].forEach((required) => expect(html.includes(required), `Missing HTML dashboard contract: ${required}`));

expect(!html.includes('scrollbar-width: thin'), 'Mobile tab scrollbar must not be visible in screenshots');
expect(!html.includes('const month = Number(params.get(\'month\'))'), 'Absent month must not coerce to January');
expect(!html.includes('charts.google.com'), 'Dashboard must not depend on external Google Charts runtime');
expect(!html.includes('cdn.jsdelivr.net'), 'Dashboard must not depend on a public CDN');
expect((html.match(/data-testid="kpi-card"/g) || []).length === 1, 'KPI cards must be generated from one reusable template');
expect((html.match(/data-testid="filter-card"/g) || []).length === 5, 'Dashboard must contain five context cards');
expect(html.length < 60000, `HTML payload is unexpectedly large: ${html.length}`);

console.log('dashboard_web_contract_test: OK', preparation);
