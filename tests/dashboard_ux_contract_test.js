const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('DashboardUxService.js', 'utf8').replace(/^\uFEFF/, '');
const context = { console, Object, Array, String, Math };
vm.createContext(context);
vm.runInContext(source, context, { filename: 'DashboardUxService.js' });

const config = context.PRH_DASHBOARD_UX;
assert.strictEqual(config.VERSION, '1.0.0');
assert.strictEqual(config.SHEET, '14 Аналитика');
assert.deepStrictEqual(Array.from(config.SECTION_ROWS), [10, 26, 53, 220, 289, 322, 382, 401, 541]);
assert.strictEqual(config.QUALITY_RANGE, 'C385:C392');

assert.ok(!source.includes("getSheetByName('01 Операции')"), 'UX service must not access operations sheet');
assert.ok(!source.includes('deleteRow('), 'UX service must not delete rows');
assert.ok(!source.includes('deleteColumn('), 'UX service must not delete columns');
assert.ok(!source.includes('clearContent('), 'UX service must not clear content');
assert.ok(!source.includes('setFormula('), 'UX service must not rewrite formulas');
assert.ok(!source.includes('setValue('), 'UX service must not rewrite dashboard values');

console.log('Dashboard UX safety contract passed.');
