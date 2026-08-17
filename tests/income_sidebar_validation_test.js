const fs = require('fs');
const path = require('path');

const controller = fs.readFileSync(
  path.join(__dirname, '..', 'IncomeSidebarController.js'),
  'utf8'
);
const html = fs.readFileSync(
  path.join(__dirname, '..', 'IncomeSidebar.html'),
  'utf8'
);

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const modes = [
  'Обзор', 'По годам', 'По месяцам года', 'Выбранный месяц',
  'Структура и стабильность', 'Операции', 'Прогноз',
  'Качество данных', 'Полный дашборд'
];
modes.forEach((mode) => expect(controller.includes(`'${mode}'`), `Missing sidebar mode: ${mode}`));

expect(controller.includes("VERSION: '0.6.0'"), 'Unexpected sidebar controller version');
expect(controller.includes('typeof prhGetDashboardModes'), 'Sidebar must use central mode contract');
expect(controller.includes('typeof prhApplyDashboardMode'), 'Sidebar must route through central mode controller');
expect(controller.includes("getRange(2, 3, lastRow - 1, 7).getValues()"), 'Operations access must be read-only');
expect(controller.includes("yearIncome: dashboard.getRange('A28')"), 'Missing year KPI');
expect(controller.includes("qualityIndex: dashboard.getRange('E397')"), 'Missing quality KPI');
expect(controller.includes("stabilityIndex: dashboard.getRange('G284')"), 'Missing stability KPI');

[
  'insertSheet(',
  'deleteSheet(',
  '.appendRow(',
  '.clearContent(',
  '.deleteRow(',
  '.deleteRows(',
  "operations.getRange("
].forEach((forbidden) => {
  if (forbidden === "operations.getRange(") return;
  expect(!controller.includes(forbidden), `Forbidden sidebar operation found: ${forbidden}`);
});

expect(html.includes('--navy: #0B2E4F'), 'Sidebar must use dashboard design system');
expect(html.includes('--teal: #119DA4'), 'Sidebar must use teal accent');
expect(html.includes('Краткая сводка'), 'Missing KPI summary');
expect(html.includes('Операции периода'), 'Missing operations action');
expect(html.includes('Проблемы данных'), 'Missing quality action');
expect(html.includes('Обновить и проверить'), 'Missing refresh action');

console.log('income_sidebar_validation_test: OK');
