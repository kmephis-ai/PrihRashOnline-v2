'use strict';

const assert = require('assert');
const GALLERY = require('../lib/dashboard/expert_dashboard_gallery');
const SAVED = require('../lib/dashboard/dashboard_saved_views');

GALLERY.assertContract();
assert.strictEqual(GALLERY.SCHEMA, 'PRH_EXPERT_DASHBOARD_GALLERY_V1');
assert.strictEqual(GALLERY.VERSION, '1.0.0');
assert.strictEqual(GALLERY.CONTRACT.roadmap_id, 'DASH-090');
assert.strictEqual(GALLERY.CONTRACT.principles.clone_to_saved_views_only, true);
assert.strictEqual(GALLERY.CONTRACT.principles.separate_storage_engine_allowed, false);
assert.strictEqual(GALLERY.CONTRACT.principles.financial_payload_in_catalog_allowed, false);
assert.strictEqual(GALLERY.CONTRACT.principles.private_filter_values_in_catalog_allowed, false);
assert.strictEqual(GALLERY.CONTRACT.principles.warm_mandatory_network_read, false);
assert.strictEqual(GALLERY.CONTRACT.principles.free_only, true);
for (const [key, value] of Object.entries(GALLERY.CONTRACT.authority)) assert.strictEqual(value, false, key);

const expected = [
  'CASH_FLOW_DECOMPOSITION','SPENDING_DRIVERS','SEASONALITY','CONCENTRATION','LONG_TERM_TRENDS','WEALTH_RISK','FINANCIAL_HEALTH_XRAY'
];
const catalog = GALLERY.catalog();
assert.deepStrictEqual(catalog.map((item) => item.preset_id), expected);
assert.strictEqual(catalog.length, 7);
for (const preset of catalog) {
  assert.match(preset.preset_hash, /^[0-9a-f]{64}$/);
  assert.strictEqual(preset.cloneable, true);
  assert.strictEqual(preset.editable_after_clone, true);
  assert.strictEqual(preset.financial_payload, false);
  assert.strictEqual(preset.private_filters, false);
  assert(SAVED.PRESET_IDS.includes(preset.base_preset_id));
  assert(preset.required_capabilities.length >= 2);
  assert(preset.panels.length >= 1);
  assert.strictEqual(GALLERY.assertNoPrivatePayload(preset), true);
  for (const panel of preset.panels) assert(preset.required_capabilities.includes(panel.source_contract));
}
assert.deepStrictEqual(GALLERY.catalog(), GALLERY.catalog());
assert.strictEqual(GALLERY.presetById('seasonality').preset_hash, GALLERY.presetById('SEASONALITY').preset_hash);
assert.throws(() => GALLERY.presetById('UNKNOWN'), /DASH090_PRESET_UNKNOWN/);

// Availability is fail-closed: absent/degraded capabilities never produce a fake dashboard.
const capabilities = GALLERY.allAvailableCapabilities();
for (const preset of catalog) assert.strictEqual(GALLERY.availability(preset.preset_id, capabilities).status, 'AVAILABLE');
const xray = GALLERY.presetById('FINANCIAL_HEALTH_XRAY');
const degraded = { ...capabilities, [GALLERY.CAP.XRAY]: 'DEGRADED' };
const unavailable = GALLERY.availability(xray.preset_id, degraded);
assert.strictEqual(unavailable.status, 'UNAVAILABLE');
assert.strictEqual(unavailable.reason, 'REQUIRED_CAPABILITY_NOT_AVAILABLE');
assert.deepStrictEqual(unavailable.missing_capabilities, [GALLERY.CAP.XRAY]);
assert.throws(() => GALLERY.cloneToSavedView(SAVED.emptyStore(), xray.preset_id, {view_id:'xray-copy'}, 0, degraded), /DASH090_PRESET_UNAVAILABLE/);
assert.throws(() => GALLERY.availability('SEASONALITY', {[GALLERY.CAP.SDC]:'PASS'}), /DASH090_CAPABILITY_STATE_INVALID/);

// Clone delegates storage/history to DASH-084 and never mutates the immutable catalog original.
let store = SAVED.emptyStore();
const sourceHash = GALLERY.presetById('SPENDING_DRIVERS').preset_hash;
const clone = GALLERY.cloneToSavedView(store, 'SPENDING_DRIVERS', {view_id:'spending-drivers-copy'}, store.generation, capabilities);
assert.strictEqual(clone.schema, GALLERY.CLONE_SCHEMA);
assert.strictEqual(clone.storage_authority, 'DASH-084');
assert.strictEqual(clone.saved_views_action, 'CREATE');
assert.strictEqual(clone.view.view_id, 'spending-drivers-copy');
assert.strictEqual(clone.view.revisions.length, 1);
assert.strictEqual(clone.view.revisions[0].source, 'CREATE');
assert.strictEqual(clone.view.origin_preset_id, null);
assert.strictEqual(GALLERY.presetById('SPENDING_DRIVERS').preset_hash, sourceHash);
store = clone.store;

// Existing DASH-084 edit/version semantics remain canonical after gallery cloning.
const cloned = store.views.find((view) => view.view_id === 'spending-drivers-copy');
const cfg = cloned.revisions[0].configuration;
const noChange = SAVED.saveVersion(store, cloned.view_id, cfg, store.generation);
assert.strictEqual(noChange.decision, 'NOOP');
assert.strictEqual(noChange.reason, 'CONFIGURATION_UNCHANGED');
const renamed = SAVED.renameView(store, cloned.view_id, 'Мои драйверы расходов', store.generation);
const renamedView = renamed.store.views.find((view) => view.view_id === cloned.view_id);
assert.strictEqual(renamedView.name, 'Мои драйверы расходов');
assert.strictEqual(renamedView.revisions[0].revision_hash, cloned.revisions[0].revision_hash);

// Catalog and telemetry reject financial/private payload and expose technical identities only.
assert.throws(() => GALLERY.assertNoPrivatePayload({analytics_result:{rows:[]}}), /DASH090_CATALOG_PRIVATE_OR_FINANCIAL_PAYLOAD_FORBIDDEN/);
assert.throws(() => GALLERY.assertNoPrivatePayload({nested:{amount_minor:100}}), /DASH090_CATALOG_PRIVATE_OR_FINANCIAL_PAYLOAD_FORBIDDEN/);
assert.throws(() => GALLERY.assertNoPrivatePayload({private_ids:['secret']}), /DASH090_CATALOG_PRIVATE_OR_FINANCIAL_PAYLOAD_FORBIDDEN/);
const telemetry = GALLERY.telemetry('LONG_TERM_TRENDS', 'OPEN');
assert.deepStrictEqual(Object.keys(telemetry).sort(), GALLERY.CONTRACT.telemetry_allowlist.slice().sort());
assert.strictEqual(JSON.stringify(telemetry).includes('amount'), false);
assert.strictEqual(JSON.stringify(telemetry).includes('filter'), false);
assert.strictEqual(JSON.stringify(telemetry).includes('private'), false);

// Explicit X-Ray boundary: gallery references the canonical contract; it never owns rule evaluation.
assert(xray.panels.every((panel) => panel.source_contract === GALLERY.CAP.XRAY));
assert.strictEqual(GALLERY.CONTRACT.authority.financial_truth, false);
assert.strictEqual(GALLERY.CONTRACT.authority.query_execution, false);

console.log('expert_dashboard_gallery_contract_test: PASS', {
  presets: catalog.length,
  clone_view: clone.view.view_id,
  xray_capability: GALLERY.CAP.XRAY,
  source_hash_prefix: sourceHash.slice(0,12)
});
