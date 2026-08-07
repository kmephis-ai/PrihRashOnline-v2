const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'DashboardModeService.js'), 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const requiredModes = [
  'Обзор', 'По годам', 'По месяцам года', 'Выбранный месяц',
  'Структура и стабильность', 'Операции', 'Прогноз', 'Качество данных',
  'Полный дашборд'
];
requiredModes.forEach((mode) => expect(source.includes(`'${mode}'`), `Missing mode: ${mode}`));

const sectionHeaders = (source.match(/^\s+\d+: '\d+\./gm) || []).length;
expect(sectionHeaders === 13, `Expected 13 guarded section headers, found ${sectionHeaders}`);
expect(/VERSION:\s*'0\.8\.\d+'/.test(source), 'Dashboard mode service must use the v0.8 contract');
expect(source.includes("MODE_CELL: 'E3'"), 'Mode selector must stay in E3');
expect(source.includes("YEAR_CELL: 'A7'"), 'Year guard must stay in A7');
expect(source.includes("MONTH_CELL: 'D7'"), 'Month guard must stay in D7');
expect(source.includes("FIRST_BODY_ROW: 10"), 'Dashboard body must still start at row 10');
expect(source.includes("LAST_BODY_ROW: 700"), 'Dashboard body must still end at row 700');
expect(source.includes("'Обзор': Object.freeze({ ranges: Object.freeze([[10, 52]])"), 'Overview must remain the compact rows 10-52 view');
expect(source.includes("[322, 381], [541, 690]"), 'Operations mode must expose summary and drill-down details');
expect(source.includes("[10, 700]"), 'Full mode must expose the complete dashboard');
expect(source.includes('sheet.showRows('), 'Missing visibility reset/show operation');
expect(source.includes('sheet.hideRows('), 'Missing visibility hide operation');
expect(source.includes('Защитная остановка'), 'Missing period preservation guard');
expect(source.includes("PropertiesService.getUserProperties().setProperty('prh.dashboard.mode'"), 'Selected mode must be persisted per user');

[
  "getSheetByName('01 Операции')", 'insertSheet(', 'deleteSheet(', '.appendRow(',
  '.clearContent(', '.deleteRow(', '.deleteRows('
].forEach((forbidden) => {
  expect(!source.includes(forbidden), `Forbidden operation found: ${forbidden}`);
});

console.log('dashboard_mode_contract_test: OK');
