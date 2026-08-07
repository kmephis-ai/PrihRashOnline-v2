const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'ApplicationMenuService.js'), 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

[
  "createMenu('ПрихРасхOnline')",
  "createMenu('Листовая аналитика')",
  "createMenu('Действия')",
  "createMenu('Экспорт')",
  "createMenu('Настройки')"
].forEach((required) => expect(source.includes(required), `Missing menu contract: ${required}`));

[
  'Открыть Web Dashboard', 'prhOpenWebDashboard', 'Обновить расчёты',
  'Текущий год', 'Текущий месяц', 'Сбросить фильтры',
  'Открыть операции периода', 'Проверить качество данных', 'Создать PDF',
  'Сделать снимок показателей', 'Восстановить диаграммы обзора'
].forEach((label) => expect(source.includes(label), `Missing required action: ${label}`));

expect(source.includes('function onOpen(e)'), 'Missing single onOpen entry point');
expect(source.includes('function onEdit(e)'), 'Missing single onEdit entry point');
expect(source.includes('prhHandleDashboardModeEdit(e)'), 'onEdit must route dashboard mode changes');
expect(source.includes("primaryUx:'WEB_DASHBOARD'"), 'Web Dashboard must be declared as the primary UX');
expect(source.includes('getCharts().length'), 'Missing fallback chart-count read');
expect(/!==\s*20/.test(source), 'Missing 20-chart validation');
expect(source.includes('prhEnsureCriticalChartSources()'), 'Missing critical chart repair lifecycle');
expect(source.includes("YEAR_CELL: 'A7'"), 'Current year action must target A7');
expect(source.includes("MONTH_CELL: 'D7'"), 'Current month action must target D7');
expect(source.includes("CATEGORY_CELL: 'A545'"), 'Reset must target dashboard category control');
expect(source.includes("MIN_AMOUNT_CELL: 'D545'"), 'Reset must target dashboard amount control');

[
  "getSheetByName('01 Операции')", 'insertSheet(', 'deleteSheet(', '.appendRow(',
  '.clearContent(', '.deleteRow(', '.deleteRows('
].forEach((forbidden) => {
  expect(!source.includes(forbidden), `Forbidden financial or structural operation found: ${forbidden}`);
});

console.log('application_menu_contract_test: OK');
