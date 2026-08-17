const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'DashboardChartStyleService.js'), 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const profileCount = (source.match(/\{ match:/g) || []).length;
expect(profileCount === 20, `Expected 20 chart profiles, found ${profileCount}`);

['insertSheet(', 'deleteSheet(', '.setValue(', '.setValues(', '.appendRow(', '.clearContent(']
  .forEach((forbidden) => expect(!source.includes(forbidden), `Forbidden financial-data mutation found: ${forbidden}`));

expect(source.includes('EXPECTED_COUNT: 20'), 'Missing fail-closed chart count guard');
expect(source.includes("repairRange: 'A39:B51'"), 'Missing monthly chart repair range');
expect(source.includes("'Доходы по годам': 'A87:B96'"), 'Missing yearly chart source repair');
expect(source.includes("'Структура доходов •': 'N140:O146'"), 'Missing selected-month structure source repair');
expect(source.includes("'Специальные доходы •': 'Q140:R143'"), 'Missing selected-month special-income source repair');
expect(source.includes('clearRanges().addRange(expected)'), 'Critical chart repair must replace stale ranges');
expect(source.includes('sheet.updateChart(builder.build())'), 'Missing chart-only update operation');
expect(/VERSION:\s*'0\.7\.0'/.test(source), 'Unexpected chart style version');

console.log('dashboard_chart_style_contract_test: OK');
