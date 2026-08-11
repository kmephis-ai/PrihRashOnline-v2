'use strict';

const assert = require('assert');
const COMPOSER = require('../lib/dashboard/dashboard_composer');

assert.strictEqual(COMPOSER.assertContract(), true);
assert.strictEqual(COMPOSER.SCHEMA, 'PRH_DASHBOARD_COMPOSER_V1');
assert.strictEqual(COMPOSER.VERSION, '1.0.0');
assert.strictEqual(COMPOSER.SPEC_SCHEMA, 'PRH_DASHBOARD_SPEC_V1');
assert.strictEqual(COMPOSER.WIDGET_SCHEMA, 'PRH_DASHBOARD_PLACEHOLDER_WIDGET_V1');
assert.strictEqual(COMPOSER.CONTRACT.persistence, 'SESSION_ONLY');
assert.strictEqual(COMPOSER.CONTRACT.widget_semantic_binding_status, 'UNBOUND');
assert.strictEqual(COMPOSER.CONTRACT.free_only, true);
assert.ok(Object.values(COMPOSER.CONTRACT.authority).every((value) => value === false));

function widget(id, x, y, w = 4, h = 2, title = id) {
  return {
    schema: COMPOSER.WIDGET_SCHEMA,
    id,
    title,
    semantic_binding_status: 'UNBOUND',
    geometry: { x, y, w, h }
  };
}

function assertNoOverlap(widgets, columns, maxRows) {
  const occupied = new Set();
  for (const item of widgets) {
    const g = item.geometry;
    assert(g.x >= 0 && g.y >= 0 && g.w >= 1 && g.h >= 1);
    assert(g.x + g.w <= columns, `${item.id} exceeds columns`);
    assert(g.y + g.h <= maxRows, `${item.id} exceeds rows`);
    for (let y = g.y; y < g.y + g.h; y += 1) {
      for (let x = g.x; x < g.x + g.w; x += 1) {
        const key = `${x}:${y}`;
        assert.strictEqual(occupied.has(key), false, `overlap ${item.id} at ${key}`);
        occupied.add(key);
      }
    }
  }
}

const defaultSpec = COMPOSER.defaultSpec();
assert(Object.isFrozen(defaultSpec));
assert(Object.isFrozen(defaultSpec.widgets));
assert.strictEqual(defaultSpec.widgets.length, 2);
assert.deepStrictEqual(defaultSpec.widgets.map((item) => item.id), ['w-0001', 'w-0002']);
assert(defaultSpec.widgets.every((item) => item.semantic_binding_status === 'UNBOUND'));
assertNoOverlap(defaultSpec.widgets, 12, 48);

// Derived identity is read-only input metadata: canonicalization ignores and recomputes it.
const recanonical = COMPOSER.canonicalSpec({ ...JSON.parse(JSON.stringify(defaultSpec)), layout_identity: 'deadbeef' });
assert.strictEqual(recanonical.layout_identity, defaultSpec.layout_identity);
assert.deepStrictEqual(recanonical.widgets, defaultSpec.widgets);

// Requested order must not affect deterministic overlap/out-of-bounds repair.
const requested = [
  widget('w-0003', 0, 0, 4, 2, 'Третий'),
  widget('w-0001', 0, 0, 6, 2, 'Первый'),
  widget('w-0004', 99, 99, 20, 99, 'Четвёртый'),
  widget('w-0002', 0, 0, 6, 2, 'Второй')
];
const a = COMPOSER.canonicalSpec({ id: 'repair-test', title: 'Repair', widgets: requested });
const b = COMPOSER.canonicalSpec({ title: 'Repair', widgets: requested.slice().reverse(), id: 'repair-test' });
const c = COMPOSER.canonicalSpec({ widgets: [requested[1], requested[3], requested[0], requested[2]], id: 'repair-test', title: 'Repair' });
assert.strictEqual(a.layout_identity, b.layout_identity);
assert.strictEqual(a.layout_identity, c.layout_identity);
assert.strictEqual(COMPOSER.stableStringify(a), COMPOSER.stableStringify(b));
assert.strictEqual(COMPOSER.stableStringify(a), COMPOSER.stableStringify(c));
assertNoOverlap(a.widgets, 12, 48);
assert(a.widgets.every((item) => item.geometry.w <= 12 && item.geometry.h <= 6));

// Input immutability.
const mutableInput = { id: 'immutability', title: 'Input', widgets: [widget('w-0001', 0, 0)] };
const before = JSON.stringify(mutableInput);
COMPOSER.canonicalSpec(mutableInput);
assert.strictEqual(JSON.stringify(mutableInput), before);

// Operation lifecycle over canonical output must be valid and deterministic.
let state = defaultSpec;
const id0 = state.layout_identity;
state = COMPOSER.applyOperation(state, { type: 'ADD', title: 'Новый placeholder' });
assert.strictEqual(state.widgets.length, 3);
assert.strictEqual(state.widgets.some((item) => item.id === 'w-0003'), true);
assert.notStrictEqual(state.layout_identity, id0);

const afterAdd = state;
const moved1 = COMPOSER.applyOperation(afterAdd, { type: 'MOVE', widget_id: 'w-0001', dx: 5, dy: 3 });
const moved2 = COMPOSER.applyOperation(afterAdd, { dy: 3, dx: 5, widget_id: 'w-0001', type: 'MOVE' });
assert.strictEqual(moved1.layout_identity, moved2.layout_identity);
assertNoOverlap(moved1.widgets, 12, 48);

const resized = COMPOSER.applyOperation(moved1, { type: 'RESIZE', widget_id: 'w-0001', dw: 99, dh: 99 });
const resizedWidget = resized.widgets.find((item) => item.id === 'w-0001');
assert(resizedWidget.geometry.w <= 12 && resizedWidget.geometry.h <= 6);
assertNoOverlap(resized.widgets, 12, 48);

const duplicated = COMPOSER.applyOperation(resized, { type: 'DUPLICATE', widget_id: 'w-0002' });
assert.strictEqual(duplicated.widgets.length, 4);
const copy = duplicated.widgets.find((item) => item.id === 'w-0004');
assert(copy);
assert(copy.title.endsWith('копия'));
assert.strictEqual(copy.semantic_binding_status, 'UNBOUND');
assertNoOverlap(duplicated.widgets, 12, 48);

const removed = COMPOSER.applyOperation(duplicated, { type: 'REMOVE', widget_id: 'w-0003' });
assert.strictEqual(removed.widgets.length, 3);
assert.strictEqual(removed.widgets.some((item) => item.id === 'w-0003'), false);
const reset = COMPOSER.applyOperation(removed, { type: 'RESET' });
assert.strictEqual(reset.layout_identity, defaultSpec.layout_identity);
assert.deepStrictEqual(reset.widgets, defaultSpec.widgets);

// Fail-closed schema/binding/payload/operation boundaries.
assert.throws(() => COMPOSER.canonicalSpec({ widgets: [widget('w-0001', 0, 0), widget('w-0001', 4, 0)] }), /DASH080_WIDGET_ID_DUPLICATE/);
assert.throws(() => COMPOSER.canonicalSpec({ widgets: [{ ...widget('w-0001', 0, 0), semantic_binding_status: 'BOUND' }] }), /DASH080_WIDGET_BOUND_BEFORE_DASH081/);
assert.throws(() => COMPOSER.canonicalSpec({ widgets: [{ ...widget('w-0001', 0, 0), analytics_query: { measures: ['EXPENSE'] } }] }), /DASH080_WIDGET_FIELD_INVALID|DASH080_FORBIDDEN_PAYLOAD_KEY/);
assert.throws(() => COMPOSER.canonicalSpec({ widgets: [widget('w-0001', 0, 0)], filters: [] }), /DASH080_SPEC_FIELD_INVALID|DASH080_FORBIDDEN_PAYLOAD_KEY/);
assert.throws(() => COMPOSER.applyOperation(defaultSpec, { type: 'MOVE', widget_id: 'w-0001', query: {} }), /DASH080_FORBIDDEN_PAYLOAD_KEY/);
assert.throws(() => COMPOSER.applyOperation(defaultSpec, { type: 'DELETE', widget_id: 'w-0001' }), /DASH080_OPERATION_UNSUPPORTED/);
assert.throws(() => COMPOSER.applyOperation(defaultSpec, { type: 'REMOVE', widget_id: 'w-9999' }), /DASH080_WIDGET_NOT_FOUND/);

// Bounded grid must fail closed when full instead of silently dropping widgets.
const capacityWidgets = Array.from({ length: 9 }, (_, index) => widget(`w-${String(index + 1).padStart(4, '0')}`, 0, index * 6, 12, 6));
assert.throws(() => COMPOSER.canonicalSpec({ id: 'capacity', title: 'Capacity', widgets: capacityWidgets }), /DASH080_GRID_CAPACITY_EXHAUSTED/);

// Responsive derivation must retain every widget and deterministic canonical order.
const responsiveBase = COMPOSER.canonicalSpec({
  id: 'responsive',
  title: 'Responsive',
  widgets: [widget('w-0003', 8, 0, 4, 1), widget('w-0001', 0, 0, 4, 2), widget('w-0002', 4, 0, 4, 3)]
});
const desktop = COMPOSER.responsiveLayout(responsiveBase, 'DESKTOP');
const tablet = COMPOSER.responsiveLayout(responsiveBase, 'TABLET');
const mobile = COMPOSER.responsiveLayout(responsiveBase, 'MOBILE');
for (const layout of [desktop, tablet, mobile]) {
  assert.strictEqual(layout.widgets.length, responsiveBase.widgets.length);
  assert.deepStrictEqual(layout.widgets.map((item) => item.id), responsiveBase.widgets.map((item) => item.id));
  assert(layout.widgets.every((item) => item.semantic_binding_status === 'UNBOUND'));
}
assertNoOverlap(desktop.widgets, 12, 48);
assertNoOverlap(tablet.widgets, 6, 72);
assertNoOverlap(mobile.widgets, 1, 192);
assert(mobile.widgets.every((item) => item.geometry.x === 0 && item.geometry.w === 1));
for (let index = 1; index < mobile.widgets.length; index += 1) {
  const previous = mobile.widgets[index - 1].geometry;
  assert.strictEqual(mobile.widgets[index].geometry.y, previous.y + previous.h);
}
assert.strictEqual(COMPOSER.viewportClass(390), 'MOBILE');
assert.strictEqual(COMPOSER.viewportClass(760), 'MOBILE');
assert.strictEqual(COMPOSER.viewportClass(768), 'TABLET');
assert.strictEqual(COMPOSER.viewportClass(1250), 'TABLET');
assert.strictEqual(COMPOSER.viewportClass(1440), 'DESKTOP');
assert.throws(() => COMPOSER.viewportClass(200), /DASH080_VIEWPORT_WIDTH_INVALID/);

const telemetry = COMPOSER.telemetry(responsiveBase, { action: 'MOVE', viewport_class: 'DESKTOP' });
assert.deepStrictEqual(Object.keys(telemetry).sort(), COMPOSER.CONTRACT.telemetry_allowlist.slice().sort());
const telemetryText = JSON.stringify(telemetry).toLowerCase();
for (const forbidden of ['amount', 'balance', 'income', 'expense', 'transaction', 'query', 'filter', 'account', 'category', 'member', 'project']) {
  assert.strictEqual(telemetryText.includes(forbidden), false, `telemetry leak token: ${forbidden}`);
}

console.log('dashboard-composer-contract: PASS', {
  deterministicRepair: true,
  operations: COMPOSER.CONTRACT.operations,
  responsive: ['DESKTOP', 'TABLET', 'MOBILE'],
  semanticBinding: 'UNBOUND',
  persistence: 'SESSION_ONLY',
  freeOnly: true
});
