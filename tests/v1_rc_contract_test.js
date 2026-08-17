'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }
function expect(condition, message) { if (!condition) throw new Error(message); }

const files = {
  refresh: read('DashboardUnifiedRefreshService.js'),
  quality: read('QualityWorkbenchService.js'),
  classification: read('IncomeClassificationService.js'),
  reports: read('IncomeReportService.js'),
  snapshots: read('IncomeSnapshotService.js'),
  menu: read('ApplicationMenuService.js'),
  packageJson: read('package.json')
};

const required = {
  refresh: ['prhRunUnifiedIncomeRefresh', "OPERATIONS: '01 Операции'", "CONTROL: '10 Контроль'", 'writeToOperations: false'],
  quality: ['prhGetQualityWorkbench', 'prhQualityWorkbenchReview', 'prhQualityWorkbenchNextIssue', "PREVIEW: '11 Предпросмотр'", 'operationWrite: false'],
  classification: ['prhSuggestIncomeCategory', 'prhSuggestCategoryForQualityProposal', 'prhStageClassificationSuggestion', 'prhConfirmClassificationRuleForProposal', 'CONFIRMED_RULE', 'operationWrite: false'],
  reports: ['prhCreateIncomePdfReport', 'MONTH', 'YEAR', 'FAMILY', 'SPECIAL', 'QUALITY', "ANALYTICS: '14 Аналитика'", 'operationWrite: false'],
  snapshots: ['prhCreateIncomeDashboardSnapshot', 'prhListIncomeDashboardSnapshots', "CONTROL: '10 Контроль'", "MARKER: 'DASHBOARD_SNAPSHOT_V1'", 'operationWrite: false'],
  menu: ['Открыть Web Dashboard', 'Обновить всё', 'PDF за выбранный месяц', 'Сделать снимок KPI', 'prhRunUnifiedIncomeRefresh', "prhCreateIncomePdfReport('MONTH')"]
};

Object.keys(required).forEach((key) => {
  required[key].forEach((needle) => expect(files[key].includes(needle), `${key}: missing ${needle}`));
});

['refresh','quality','classification','reports','snapshots'].forEach((key) => {
  expect(!files[key].includes('.insertSheet('), `${key}: new sheet creation is forbidden in v1 RC`);
  expect(!files[key].includes('.deleteSheet('), `${key}: sheet deletion is forbidden in v1 RC`);
  expect(!files[key].includes('.deleteRow(') && !files[key].includes('.deleteRows('), `${key}: row deletion is forbidden in v1 RC`);
});

expect(!files.quality.includes("getSheetByName(PRH_QUALITY_WORKBENCH.OPERATIONS).set"), 'Quality Workbench must not write operations');
expect(files.quality.includes("preview.getRange(row, statusColumn + 1).setValue(status)"), 'Quality review must be staged in preview only');
expect(files.classification.includes("preview.getRange(location.row, proposedColumn + 1).setValue(category)"), 'Classification must stage suggestion in preview');
expect(files.classification.includes('PropertiesService.getDocumentProperties().setProperty'), 'Confirmed classification rules must use document properties');
expect(files.reports.includes("ss.getSheetByName(PRH_REPORTS.ANALYTICS)"), 'Reports must export existing analytics sheet');
expect(files.snapshots.includes("ss.getSheetByName(PRH_SNAPSHOTS.CONTROL)"), 'Snapshots must target existing control sheet');
expect(files.snapshots.includes('control.getRange(rowNumber, 1, 1, PRH_SNAPSHOTS.WIDTH).setValues([row])'), 'Snapshot must append KPI row only to control sheet');

const pkg = JSON.parse(files.packageJson);
expect(/^1\.0\.0-rc\.\d+$/.test(pkg.version), `Unexpected package version ${pkg.version}`);
expect(pkg.scripts['prepare:web'].includes('prepare-dashboard-web-v1rc.js'), 'v1 RC build step is not enabled');

console.log('v1_rc_contract_test: OK', {
  version: pkg.version,
  modules: ['design-system','unified-refresh','quality-workbench','classification','reports','snapshots','stable-docs']
});
