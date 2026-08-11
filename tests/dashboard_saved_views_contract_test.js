'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SAVED = require('../lib/dashboard/dashboard_saved_views');
const COMPOSER = require('../lib/dashboard/dashboard_composer');
const FACTORY = require('../lib/dashboard/widget_factory');
const ANALYTICS = require('../lib/analytics/analytics_engine');

SAVED.assertContract();
assert.strictEqual(SAVED.CONTRACT.schema, 'PRH_DASHBOARD_SAVED_VIEWS_V1');
assert.strictEqual(SAVED.CONTRACT.version, '1.0.0');
assert.strictEqual(SAVED.CONTRACT.roadmap_id, 'DASH-084');
assert.strictEqual(SAVED.CONTRACT.storage.adapter, 'APPS_SCRIPT_USER_PROPERTIES_V1');
assert.strictEqual(SAVED.CONTRACT.storage.user_scoped, true);
assert.strictEqual(SAVED.CONTRACT.storage.script_properties_allowed, false);
assert.strictEqual(SAVED.CONTRACT.storage.document_properties_allowed, false);
assert.strictEqual(SAVED.CONTRACT.storage.financial_sheet_storage_allowed, false);
assert.strictEqual(SAVED.CONTRACT.principles.financial_dataset_snapshot_allowed, false);
assert.strictEqual(SAVED.CONTRACT.principles.analytics_result_snapshot_allowed, false);
assert.strictEqual(SAVED.CONTRACT.principles.identical_save, 'NOOP');
assert.strictEqual(SAVED.CONTRACT.limits.max_revisions_per_view, 6);
assert.strictEqual(SAVED.CONTRACT.authority.dashboard_config_storage, true);
for (const [key, value] of Object.entries(SAVED.CONTRACT.authority)) {
  if (key !== 'dashboard_config_storage') assert.strictEqual(value, false, key);
}

function rawQuery(overrides = {}) {
  return {
    schema: ANALYTICS.QUERY_SCHEMA,
    contract_version: ANALYTICS.CONTRACT_VERSION,
    currency: 'RUB',
    measures: ['EXPENSE'],
    dimensions: [],
    filters: [{ field: 'category_id', operator: 'IN', values: ['synthetic-private-category'] }],
    time_range: null,
    grain: 'NONE',
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 5000,
    ...overrides
  };
}

function boundKpi(spec, widgetId = 'w-0001') {
  const placeholder = spec.widgets.find((widget) => widget.id === widgetId);
  return FACTORY.bindPlaceholder(placeholder, {
    schema: FACTORY.BINDING_SCHEMA,
    contract_version: FACTORY.VERSION,
    widget_id: widgetId,
    kind: 'KPI',
    query: rawQuery(),
    presentation: {
      schema: FACTORY.VALUE_PRESENTATION_SCHEMA,
      contract_version: FACTORY.VERSION,
      title: 'Расходы',
      show_comparison: false
    }
  });
}

function configuration(spec = COMPOSER.defaultSpec(), withBinding = true) {
  return {
    schema: SAVED.CONFIG_SCHEMA,
    contract_version: SAVED.VERSION,
    dashboard_spec: spec,
    bound_widgets: withBinding ? [boundKpi(spec)] : []
  };
}

function currentView(store, id) {
  return store.views.find((view) => view.view_id === id);
}

let store = SAVED.emptyStore();
assert.strictEqual(store.generation, 0);
assert.deepStrictEqual(store.views, []);

// CREATE creates immutable revision 1 and accepts private configuration IDs without public telemetry exposure.
let result = SAVED.createView(store, {
  view_id: 'family-main',
  name: 'Семейный дашборд',
  configuration: configuration()
}, store.generation);
assert.strictEqual(result.action, 'CREATE');
assert.strictEqual(result.decision, 'APPLIED');
store = result.store;
let family = currentView(store, 'family-main');
assert.strictEqual(family.active_revision, 1);
assert.strictEqual(family.revisions.length, 1);
assert.match(family.view_hash, /^[0-9a-f]{64}$/);
assert.match(family.revisions[0].revision_hash, /^[0-9a-f]{64}$/);
assert.strictEqual(family.revisions[0].configuration.bound_widgets[0].binding.query.filters[0].values[0], 'synthetic-private-category');

// Identical save is a deterministic NOOP and does not consume a generation/history slot.
result = SAVED.saveVersion(store, 'family-main', family.revisions[0].configuration, store.generation);
assert.strictEqual(result.decision, 'NOOP');
assert.strictEqual(result.reason, 'CONFIGURATION_UNCHANGED');
assert.strictEqual(result.store.generation, store.generation);
assert.strictEqual(result.store.views[0].revisions.length, 1);

// SAVE_VERSION appends only configuration changes.
const movedSpec = COMPOSER.applyOperation(COMPOSER.defaultSpec(), { type: 'MOVE', widget_id: 'w-0002', dx: 1, dy: 2 });
result = SAVED.saveVersion(store, 'family-main', configuration(movedSpec), store.generation);
assert.strictEqual(result.decision, 'APPLIED');
store = result.store;
family = currentView(store, 'family-main');
assert.strictEqual(family.revisions.length, 2);
assert.strictEqual(family.active_revision, 2);
assert.notStrictEqual(family.revisions[0].configuration_hash, family.revisions[1].configuration_hash);
assert.strictEqual(family.revisions[1].parent_revision_hash, family.revisions[0].revision_hash);

// RENAME changes metadata only, preserving revision identity/history.
const beforeRenameRevision = family.revisions[1].revision_hash;
result = SAVED.renameView(store, 'family-main', 'Семейный обзор', store.generation);
store = result.store;
family = currentView(store, 'family-main');
assert.strictEqual(family.name, 'Семейный обзор');
assert.strictEqual(family.revisions.length, 2);
assert.strictEqual(family.revisions[1].revision_hash, beforeRenameRevision);

// CLONE copies only current configuration into a fresh revision-1 history.
result = SAVED.cloneView(store, 'family-main', { view_id: 'family-copy', name: 'Копия обзора' }, store.generation);
store = result.store;
const cloned = currentView(store, 'family-copy');
assert.strictEqual(cloned.revisions.length, 1);
assert.strictEqual(cloned.revisions[0].source, 'CLONE');
assert.strictEqual(cloned.revisions[0].configuration_hash, family.revisions[1].configuration_hash);
assert.strictEqual(cloned.revisions[0].parent_revision_hash, family.revisions[1].revision_hash);

// Curated preset catalog is complete, deterministic, editable and snapshot-free.
const catalog = SAVED.presetCatalog();
assert.deepStrictEqual(catalog.map((preset) => preset.preset_id), SAVED.PRESET_IDS);
assert.strictEqual(catalog.length, 8);
for (const preset of catalog) {
  assert.strictEqual(preset.editable, true);
  assert.strictEqual(preset.cloneable, true);
  assert.strictEqual(preset.configuration.bound_widgets.length, 0);
  assert.strictEqual(SAVED.assertNoSnapshotPayload(preset.configuration), true);
  assert.match(preset.preset_hash, /^[0-9a-f]{64}$/);
}
assert.strictEqual(SAVED.presetById('FAMILY').preset_hash, SAVED.presetById('FAMILY').preset_hash);

// CREATE_FROM_PRESET + SAVE + RESET restore preset baseline by appending, never rewriting history.
result = SAVED.createFromPreset(store, 'EXPENSE', { view_id: 'expense-view', name: 'Мои расходы' }, store.generation);
store = result.store;
let expense = currentView(store, 'expense-view');
assert.strictEqual(expense.origin_preset_id, 'EXPENSE');
const presetBaselineHash = expense.revisions[0].configuration_hash;
const expenseChangedSpec = COMPOSER.applyOperation(expense.revisions[0].configuration.dashboard_spec, { type: 'ADD' });
result = SAVED.saveVersion(store, 'expense-view', configuration(expenseChangedSpec, false), store.generation);
store = result.store;
expense = currentView(store, 'expense-view');
assert.strictEqual(expense.revisions.length, 2);
result = SAVED.resetView(store, 'expense-view', store.generation);
store = result.store;
expense = currentView(store, 'expense-view');
assert.strictEqual(expense.revisions.length, 3);
assert.strictEqual(expense.revisions[2].source, 'RESET');
assert.strictEqual(expense.revisions[2].configuration_hash, presetBaselineHash);

// RESTORE_REVISION appends a new immutable revision rather than moving active pointer backwards.
result = SAVED.restoreRevision(store, 'family-main', 1, store.generation);
store = result.store;
family = currentView(store, 'family-main');
assert.strictEqual(family.active_revision, 3);
assert.strictEqual(family.revisions[2].source, 'RESTORE_REVISION');
assert.strictEqual(family.revisions[2].configuration_hash, family.revisions[0].configuration_hash);

// DELETE removes only configuration view from logical store.
result = SAVED.deleteView(store, 'family-copy', store.generation);
store = result.store;
assert.strictEqual(currentView(store, 'family-copy'), undefined);
assert(currentView(store, 'family-main'));

// Explicit V0 -> V1 migration creates a stable receipt and one migration revision.
const legacy = {
  schema: SAVED.LEGACY_SCHEMA,
  view_id: 'legacy-view',
  name: 'Старый вид',
  preset_id: null,
  layout: COMPOSER.defaultSpec(),
  bindings: []
};
const migratedA = SAVED.migrateLegacyView(legacy);
const migratedB = SAVED.migrateLegacyView({ bindings: [], layout: COMPOSER.defaultSpec(), preset_id: null, name: 'Старый вид', view_id: 'legacy-view', schema: SAVED.LEGACY_SCHEMA });
assert.strictEqual(migratedA.receipt.migration_hash, migratedB.receipt.migration_hash);
assert.strictEqual(migratedA.view.revisions[0].source, 'MIGRATE');
result = SAVED.migrateIntoStore(store, legacy, store.generation);
store = result.store;
assert(currentView(store, 'legacy-view'));
assert.strictEqual(result.migration_receipt.status, 'PASS');
assert.throws(() => SAVED.migrateLegacyView({ ...legacy, schema: 'PRH_DASHBOARD_SAVED_VIEW_V99' }), /DASH084_MIGRATION_SOURCE_UNSUPPORTED|DASH084_LEGACY_SHAPE_INVALID/);

// Object key order cannot change configuration identity.
const cfg = configuration();
const cfgA = SAVED.normalizeConfiguration(cfg);
const cfgB = SAVED.normalizeConfiguration({ bound_widgets: cfg.bound_widgets, dashboard_spec: cfg.dashboard_spec, contract_version: SAVED.VERSION, schema: SAVED.CONFIG_SCHEMA });
assert.strictEqual(cfgA.configuration_hash, cfgB.configuration_hash);

// Hostile snapshots/secrets are rejected while query configuration remains allowed.
assert.throws(() => SAVED.assertNoSnapshotPayload({ transaction_rows: [] }), /DASH084_FINANCIAL_SNAPSHOT_FORBIDDEN/);
assert.throws(() => SAVED.assertNoSnapshotPayload({ nested: { actual_total_minor: 42 } }), /DASH084_FINANCIAL_SNAPSHOT_FORBIDDEN/);
assert.throws(() => SAVED.assertNoSnapshotPayload({ runtime_locator: 'private-runtime' }), /DASH084_FINANCIAL_SNAPSHOT_FORBIDDEN/);
assert.strictEqual(SAVED.assertNoSnapshotPayload({ query: rawQuery() }), true);

// Optimistic pure-store generation conflict is fail-closed.
assert.throws(() => SAVED.renameView(store, 'family-main', 'Не должно пройти', store.generation - 1), /DASH084_STORE_GENERATION_CONFLICT/);

// Bounded revision history fails before unbounded persistence growth.
let limitStore = SAVED.emptyStore();
result = SAVED.createView(limitStore, { view_id: 'bounded', name: 'Bounded', configuration: configuration(COMPOSER.canonicalSpec({ id: 'bounded-base', title: 'Bounded', widgets: [] }), false) }, 0);
limitStore = result.store;
for (let revision = 2; revision <= SAVED.CONTRACT.limits.max_revisions_per_view; revision += 1) {
  const spec = COMPOSER.canonicalSpec({ id: 'bounded-base', title: `Bounded ${revision}`, widgets: [] });
  result = SAVED.saveVersion(limitStore, 'bounded', configuration(spec, false), limitStore.generation);
  limitStore = result.store;
}
assert.strictEqual(currentView(limitStore, 'bounded').revisions.length, SAVED.CONTRACT.limits.max_revisions_per_view);
assert.throws(() => SAVED.saveVersion(limitStore, 'bounded', configuration(COMPOSER.canonicalSpec({ id: 'bounded-base', title: 'Overflow', widgets: [] }), false), limitStore.generation), /DASH084_REVISION_LIMIT/);

// Telemetry carries hashes/counts only: no view names, private filter IDs or financial values.
family = currentView(store, 'family-main');
const telemetry = SAVED.telemetry('VIEW', store, family, family.revisions[family.active_revision - 1]);
assert.deepStrictEqual(Object.keys(telemetry).sort(), SAVED.CONTRACT.telemetry_allowlist.slice().sort());
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['Семейный обзор', 'synthetic-private-category', 'RUB', 'EXPENSE']) {
  assert(!telemetryText.includes(forbidden), `telemetry leak: ${forbidden}`);
}

// Apps Script adapter: only UserProperties + user lock, single setProperties batch, optimistic generation.
const servicePath = path.join(__dirname, '..', 'DashboardSavedViewsStorageService.js');
const serviceSource = fs.readFileSync(servicePath, 'utf8');
assert(serviceSource.includes('PropertiesService.getUserProperties()'));
assert(!serviceSource.includes('getScriptProperties'));
assert(!serviceSource.includes('getDocumentProperties'));
assert(!serviceSource.includes('Logger.'));
assert(!serviceSource.includes('console.'));

const propertyMap = new Map();
let batchWrites = 0;
let userPropertiesCalls = 0;
const fakeProperties = {
  getProperty(key) { return propertyMap.has(key) ? propertyMap.get(key) : null; },
  setProperties(updates) {
    batchWrites += 1;
    const clone = new Map(propertyMap);
    Object.entries(updates).forEach(([key, value]) => clone.set(key, String(value)));
    propertyMap.clear();
    clone.forEach((value, key) => propertyMap.set(key, value));
  }
};
const fakeLock = {
  held: false,
  tryLock() { if (this.held) return false; this.held = true; return true; },
  releaseLock() { this.held = false; }
};
const sandbox = {
  PropertiesService: {
    getUserProperties() { userPropertiesCalls += 1; return fakeProperties; },
    getScriptProperties() { throw new Error('forbidden script properties'); },
    getDocumentProperties() { throw new Error('forbidden document properties'); }
  },
  LockService: { getUserLock() { return fakeLock; } },
  Utilities: { newBlob(value) { return { getBytes() { return Buffer.from(String(value), 'utf8'); } }; } },
  JSON,
  Number,
  String,
  Object,
  Array,
  RegExp,
  Error,
  Buffer,
  unescape,
  encodeURIComponent
};
vm.createContext(sandbox);
vm.runInContext(serviceSource, sandbox, { filename: 'DashboardSavedViewsStorageService.js' });

// Persist one view at generation 1.
const persistedStore1 = SAVED.createView(SAVED.emptyStore(), { view_id: 'persisted', name: 'Persisted', configuration: configuration(COMPOSER.canonicalSpec({ id: 'persisted', title: 'Persisted', widgets: [] }), false) }, 0).store;
let persistedView = currentView(persistedStore1, 'persisted');
let commit = sandbox.prhDash084StorageCommit_({
  expected_generation: 0,
  index_json: SAVED.serializeIndex(persistedStore1),
  view_id: 'persisted',
  view_json: SAVED.serializeView(persistedView)
});
assert.strictEqual(commit.generation, 1);
assert.strictEqual(commit.deleted, false);
assert.strictEqual(batchWrites, 1);
let snapshot = sandbox.prhDash084StorageReadSnapshot_();
assert.strictEqual(snapshot.generation, 1);
assert.strictEqual(JSON.parse(snapshot.view_json_by_id.persisted).name, 'Persisted');

// Stale expected generation cannot overwrite current data.
assert.throws(() => sandbox.prhDash084StorageCommit_({
  expected_generation: 0,
  index_json: SAVED.serializeIndex(persistedStore1),
  view_id: 'persisted',
  view_json: SAVED.serializeView(persistedView)
}), /DASH084_STORAGE_GENERATION_CONFLICT/);
assert.strictEqual(batchWrites, 1);

// Rename -> generation 2 and one atomic batch.
const persistedStore2 = SAVED.renameView(persistedStore1, 'persisted', 'Persisted renamed', 1).store;
persistedView = currentView(persistedStore2, 'persisted');
commit = sandbox.prhDash084StorageCommit_({
  expected_generation: 1,
  index_json: SAVED.serializeIndex(persistedStore2),
  view_id: 'persisted',
  view_json: SAVED.serializeView(persistedView)
});
assert.strictEqual(commit.generation, 2);
assert.strictEqual(batchWrites, 2);
assert.strictEqual(JSON.parse(sandbox.prhDash084StorageReadView_('persisted')).name, 'Persisted renamed');

// Delete is a tombstone + index update in one batch; logical read returns null.
const persistedStore3 = SAVED.deleteView(persistedStore2, 'persisted', 2).store;
commit = sandbox.prhDash084StorageCommit_({
  expected_generation: 2,
  index_json: SAVED.serializeIndex(persistedStore3),
  view_id: 'persisted',
  view_json: null
});
assert.strictEqual(commit.generation, 3);
assert.strictEqual(commit.deleted, true);
assert.strictEqual(batchWrites, 3);
assert.strictEqual(sandbox.prhDash084StorageReadView_('persisted'), null);
assert.strictEqual(sandbox.prhDash084StorageReadSnapshot_().index.view_ids.length, 0);
assert(userPropertiesCalls > 0);

// Adapter byte limit fails before a storage write.
assert.throws(() => sandbox.prhDash084StorageCommit_({
  expected_generation: 3,
  index_json: JSON.stringify({ schema: 'PRH_DASHBOARD_SAVED_VIEW_INDEX_V1', contract_version: '1.0.0', generation: 4, view_ids: ['oversized'] }),
  view_id: 'oversized',
  view_json: JSON.stringify({ schema: 'PRH_DASHBOARD_SAVED_VIEW_V1', contract_version: '1.0.0', view_id: 'oversized', padding: 'x'.repeat(9000) })
}), /DASH084_STORAGE_VIEW_SIZE_LIMIT/);
assert.strictEqual(batchWrites, 3);

console.log('dashboard_saved_views_contract_test: OK', {
  contract: `${SAVED.SCHEMA}@${SAVED.VERSION}`,
  presets: SAVED.PRESET_IDS,
  revisionLimit: SAVED.CONTRACT.limits.max_revisions_per_view,
  runtimeStore: SAVED.CONTRACT.privacy.runtime_store,
  userPropertiesOnly: true,
  financialTruthAuthority: false,
  financialWriteAuthority: false,
  publicEvidence: SAVED.CONTRACT.privacy.public_evidence,
  freeOnly: true
});
