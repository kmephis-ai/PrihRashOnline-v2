const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('IncomeSidebarController.js', 'utf8').replace(/^\uFEFF/, '');
const context = { console, Object, Number, String, Array, Date, Math, isFinite };
vm.createContext(context);
vm.runInContext(source, context, { filename: 'IncomeSidebarController.js' });

const state = {
  years: [2026, 2025, 2024],
  categories: ['Все', 'Зарплата', 'Проценты']
};

const valid = context.prhValidateIncomeSidebarPayload_({
  mode: 'Обзор',
  year: '2026',
  month: 'Август',
  category: 'Зарплата',
  minAmount: '1000'
}, state);
assert.strictEqual(valid.year, 2026);
assert.strictEqual(valid.minAmount, 1000);
assert.strictEqual(valid.category, 'Зарплата');

function mustFail(payload, fragment) {
  assert.throws(
    () => context.prhValidateIncomeSidebarPayload_(payload, state),
    error => Boolean(error && String(error.message || error).includes(fragment))
  );
}

mustFail({ mode: 'Удалить', year: 2026, month: 'Август', category: 'Все', minAmount: 0 }, 'режим');
mustFail({ mode: 'Обзор', year: 2023, month: 'Август', category: 'Все', minAmount: 0 }, 'Год отсутствует');
mustFail({ mode: 'Обзор', year: 2026, month: 'Тринадцатый', category: 'Все', minAmount: 0 }, 'месяц');
mustFail({ mode: 'Обзор', year: 2026, month: 'Август', category: 'Несуществующая', minAmount: 0 }, 'Категория');
mustFail({ mode: 'Обзор', year: 2026, month: 'Август', category: 'Все', minAmount: -1 }, 'неотрицательной');
mustFail({ mode: 'Обзор', year: 2026, month: 'Август', category: 'Все', minAmount: 'abc' }, 'неотрицательной');

assert.ok(!/01 Операции[^\n]*setValue/.test(source), 'Controller must not write to operations sheet');
console.log('Income sidebar validation tests passed.');
