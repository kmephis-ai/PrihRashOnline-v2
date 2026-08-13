'use strict';

const fs = require('fs');
const path = require('path');
const { generateSyntheticDashboardFixture } = require('./fixtures/synthetic_dashboard');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'DashboardWebApp.html');
const service = fs.readFileSync(path.join(root, 'DashboardWebDataService.js'), 'utf8');
const canonicalRouter = fs.readFileSync(path.join(root, 'CanonicalR2WebAppService.js'), 'utf8');
const executive = fs.readFileSync(path.join(root, 'DashboardWebExecutiveService.js'), 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');

function expect(condition, message) { if (!condition) throw new Error(message); }

// Build is a separate canonical pipeline phase. Tests must never mutate the bundle.
expect(html.includes('id="executive-secondary"'), 'Dashboard must be prepared through v1.3 before contract tests');
expect(html.includes('id="action-bar"'), 'Dashboard must be prepared through v1 RC before contract tests');

[
  'function prhGetWebDashboardData(', 'function prhOpenWebDashboard()',
  "OPERATIONS_SHEET: '01 Операции'", "QUALITY_CELL: 'E396'", "VERSION: '1.2.0'",
  "HtmlService.createHtmlOutputFromFile('DashboardWebApp')", 'HtmlService.createHtmlOutput(html)',
  'function prhWebAppSmokeToken()', 'ScriptApp.getService().getUrl()'
].forEach((required) => expect(service.includes(required), `Missing base service contract: ${required}`));

// UI-MIG-020 deliberately moves the single Web App entry point out of the legacy
// data service. Keep the rollback renderer/data API intact, but make canonical R2
// the only doGet authority so the legacy contract cannot accidentally reclaim it.
expect(!service.includes('function doGet('),
  'Legacy dashboard data service must not own canonical doGet after UI-MIG-020');
[
  'function doGet(e)', "DEFAULT_SURFACE: 'home'", 'function prhR2RenderLegacy_('
].forEach((required) => expect(canonicalRouter.includes(required), `Missing canonical R2 router contract: ${required}`));
expect(/LEGACY_SURFACE\s*:\s*'legacy'/.test(canonicalRouter),
  'Missing canonical R2 router contract: LEGACY_SURFACE=legacy');

expect(!service.includes("HtmlService.createTemplateFromFile('DashboardWebApp')"),
  'Dashboard must not reintroduce Apps Script template parser for DashboardWebApp');
expect(!service.includes('.evaluate()'),
  'Dashboard Web App render path must not use HtmlTemplate.evaluate()');

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
  expect(!service.includes(forbidden), `Base web service must be read-only: ${forbidden}`);
  expect(!executive.includes(forbidden), `Executive/drill-down service must be read-only: ${forbidden}`);
});

[
  'class="topbar"', 'class="tabs"', 'class="filters"', 'class="dashboard-grid"',
  'id="yearly-chart"', 'id="monthly-chart"', 'id="donut"', 'id="executive-secondary"',
  'id="view-detail"', 'id="detail-content"', 'data-drilldown', 'data-close-drilldown',
  'function renderExecutiveSecondary(data)', 'function openDrilldown(key)', 'function drilldownTable(rows)',
  '.prhGetWebDashboardDataV13(year, month, activeView)', 'Executive-панель',
  'monthlyIncome:', 'monthStructure:', 'summary:', 'executive:', 'drilldowns:',
  'id="action-bar"', 'id="action-refresh"', 'id="action-quality"', 'id="action-snapshot"', 'id="action-pdf"',
  'function runUnifiedRefresh()', 'function loadQualityWorkbench()', 'function renderQualityWorkbench(workbench)',
  'function suggestClassification(proposalId)', 'function createSnapshot()', 'function createPdfReport()',
  '.prhRunUnifiedIncomeRefresh(', '.prhGetQualityWorkbench()', '.prhCreateIncomeDashboardSnapshot(',
  ".prhCreateIncomePdfReport('MONTH')", '.prhSuggestCategoryForQualityProposal(proposalId)',
  'v1.0 RC', "privacyClass:'PUBLIC_SYNTHETIC'"
].forEach((required) => expect(html.includes(required), `Missing v1 RC dashboard contract: ${required}`));

// CSS formatting is not part of the runtime contract: validate the semantics, not spaces around punctuation.
expect(/scrollbar-width\s*:\s*none/i.test(html), 'Mobile tab scrollbar must remain hidden');
expect(/\.dashboard-grid:has\(#yearly-panel\[hidden\]\)\s*>\s*\.overview-kpis/.test(html),
  'Single visible overview KPI panel must span the dashboard grid');

const synthetic = generateSyntheticDashboardFixture({ seed: 20260808 });
expect(synthetic.testMetadata.synthetic === true, 'Public dashboard test input must be explicitly synthetic');
expect(synthetic.testMetadata.privacy_class === 'PUBLIC_SYNTHETIC', 'Synthetic dashboard privacy marker missing');
expect(synthetic.period.months.length === 12, 'Synthetic dashboard must expose twelve months');
expect(synthetic.monthlyIncome.length === 12, 'Synthetic dashboard must expose twelve monthly buckets');
expect(synthetic.yearlyIncome.length > 0, 'Synthetic dashboard needs at least one year for chart contracts');
expect(synthetic.drilldowns.month.rows.every((row) => row.id.startsWith('SYN-')), 'Synthetic drill-down ids must use SYN- prefix');
expect(synthetic.drilldowns.month.rows.every((row) => /Synthetic/i.test(row.description)), 'Synthetic drill-down descriptions must remain fictional');

expect(!service.includes("QUALITY_CELL: 'E397'"), 'Quality score must not use stale E397');
expect(!html.includes('scrollbar-width: thin'), 'Mobile tab scrollbar must remain hidden');
expect(!html.includes('charts.google.com'), 'Dashboard must not depend on Google Charts runtime');
expect(!html.includes('cdn.jsdelivr.net'), 'Dashboard must not depend on a public CDN');
expect((html.match(/data-testid="kpi-card"/g) || []).length === 1, 'Primary KPI cards must come from one reusable template');
expect((html.match(/data-testid="secondary-kpi"/g) || []).length === 1, 'Secondary KPI cards must come from one reusable template');
expect((html.match(/data-testid="filter-card"/g) || []).length === 5, 'Dashboard must contain five context cards');
expect((html.match(/class="action-button/g) || []).length === 4, 'Dashboard must expose exactly four primary quick actions');
expect(html.length < 120000, `HTML payload is unexpectedly large: ${html.length}`);

console.log('dashboard_web_contract_test: OK', {
  htmlLength: html.length,
  renderMode: 'RAW_HTML_OUTPUT_PLACEHOLDER_INJECTION',
  templateParserUsed: false,
  canonicalDoGetOwner: 'CanonicalR2WebAppService.js',
  legacyRollbackRetained: true,
  syntheticYears: synthetic.yearlyIncome.length,
  syntheticMonthRows: synthetic.drilldowns.month.rows.length
});