const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'DashboardChartStyleService.js'),
  'utf8'
);

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const profileCount = (source.match(/\{ match:/g) || []).length;
expect(profileCount === 20, `Expected 20 chart profiles, found ${profileCount}`);

[
  'insertSheet(',
  'deleteSheet(',
  '.setValue(',
  '.setValues(',
  '.appendRow(',
  '.clearContent('
].forEach((forbidden) => {
  expect(!source.includes(forbidden), `Forbidden financial-data mutation found: ${forbidden}`);
});

expect(source.includes("EXPECTED_COUNT: 20"), 'Missing fail-closed chart count guard');
expect(source.includes("repairRange: 'A39:B51'"), 'Missing known empty chart repair range');
expect(source.includes('sheet.updateChart(builder.build())'), 'Missing chart-only update operation');
expect(source.includes("VERSION: '0.6.0'"), 'Unexpected chart style version');

console.log('dashboard_chart_style_contract_test: OK');
