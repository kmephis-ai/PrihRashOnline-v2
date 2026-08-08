'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'DashboardWebApp.html');
const service = fs.readFileSync(path.join(root, 'DashboardWebDataService.js'), 'utf8');
const model = fs.readFileSync(path.join(root, 'DashboardWebDataModel.js'), 'utf8');
const executive = fs.readFileSync(path.join(root, 'DashboardWebExecutiveService.js'), 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');

function expect(condition, message) { if (!condition) throw new Error(message); }

// Build is a separate canonical pipeline phase. Tests must never mutate the bundle.
expect(html.includes('id="executive-secondary"'), 'Dashboard must be prepared through v1.3 before contract tests');
expect(html.includes('id="action-bar"'), 'Dashboard must be prepared through v1 RC before contract tests');

[
  'function doGet(e)', 'function prhOpenWebDashboard()',
  'HtmlService.createTemplateFromFile', 'ScriptApp.getService().getUrl()'
].forEach((required) => expect(service.includes(required), `Missing bootstrap service contract: ${required}`));

[
  'function prhGetWebDashboardData(', "OPERATIONS_SHEET: '01 Операции'",
  "QUALITY_CELL: 'E396'", "VERSION: '1.2.1'"
].forEach((required) => expect(model.includes(required), `Missing data model contract: ${required}`));

[
  "VERSION: '1.3.0'", 'function prhGetWebDashboardDataV13(', 'function prhWebExecutiveStabilityIndex_(',
  'function prhWebExecutiveForecast_(', 'function prhWebExecutiveGroup_(',
  "LARGE_AMOUNT: 100000", "OPERATIONS_SHEET: '01 Операции'", 'possibleDuplicateCount',
  'largestSource', 'qualityCounts', 'openFirstUrl'
].forEach((required) => expect(executive.includes(required), `Missing executive service contract: ${required}`));

[
  '.setValue(', '.setValues(', '.clearContent(', '.appendRow(', '.deleteRow(', '.deleteRows(',
  '.insertSheet(', '.deleteSheet(', '.hideRows(', '.showRows(', '.setColumnWidth(', '.setRowHeight('
].forEach((forbidden) => {
  expect(!service.includes(forbidden), `Web bootstrap must be read-only: ${forbidden}`);
  expect(!model.includes(forbidden), `Base web data model must be read-only: ${forbidden}`);
  expect(!executive.includes(forbidden), `Executive/drill-down service must be read-only: ${forbidden}`);
});

[
  'class="topbar"', 'class="tabs"', 'class="filters"', 'class="dashboard-grid"',
  'id="yearly-chart"', 'id="monthly-chart"', 'id="donut"', 'id="executive-secondary"',
  'id="view-detail"', 'id="detail-content"', 'data-drilldown', 'data-close-drilldown',
  'function renderExecutiveSecondary(data)', 'function openDrilldown(key)', 'function drilldownTable(rows)',
  '.prhGetWebDashboardDataV13(year, month, activeView)', 'Executive-панель',
  'const operations = [11,17,31,18,25,17,9,0,0,0,0,0]',
  "{label:'Зарплата',value:66712}", "{label:'Другое',value:58775}",
  'selectedYearIncome:3322811', 'selectedMonthIncome:151360',
  'scrollbar-width: none', '.dashboard-grid:has(#yearly-panel[hidden]) > .overview-kpis',
  'id="action-bar"', 'id="action-refresh"', 'id="action-quality"', 'id="action-snapshot"', 'id="action-pdf"',
  'function runUnifiedRefresh()', 'function loadQualityWorkbench()', 'function renderQualityWorkbench(workbench)',
  'function suggestClassification(proposalId)', 'function createSnapshot()', 'function createPdfReport()',
  '.prhRunUnifiedIncomeRefresh(', '.prhGetQualityWorkbench()', '.prhCreateIncomeDashboardSnapshot(',
  ".prhCreateIncomePdfReport('MONTH')", '.prhSuggestCategoryForQualityProposal(proposalId)',
  'v1.0 RC'
].forEach((required) => expect(html.includes(required), `Missing v1 RC dashboard contract: ${required}`));

expect(!model.includes("QUALITY_CELL: 'E397'"), 'Quality score must not use stale E397');
expect(!html.includes('scrollbar-width: thin'), 'Mobile tab scrollbar must remain hidden');
expect(!html.includes('charts.google.com'), 'Dashboard must not depend on Google Charts runtime');
expect(!html.includes('cdn.jsdelivr.net'), 'Dashboard must not depend on a public CDN');
expect(!html.includes('OP-F11-'), 'Public HTML fixture must not expose real operation identifiers');
expect(!html.includes('Ремонт класса'), 'Public HTML fixture must not expose private operation descriptions');
expect((html.match(/data-testid="kpi-card"/g) || []).length === 1, 'Primary KPI cards must come from one reusable template');
expect((html.match(/data-testid="secondary-kpi"/g) || []).length === 1, 'Secondary KPI cards must come from one reusable template');
expect((html.match(/data-testid="filter-card"/g) || []).length === 5, 'Dashboard must contain five context cards');
expect((html.match(/class="action-button/g) || []).length === 4, 'Dashboard must expose exactly four primary quick actions');
expect(html.length < 120000, `HTML payload is unexpectedly large: ${html.length}`);

console.log('dashboard_web_contract_test: OK', { htmlLength: html.length });
