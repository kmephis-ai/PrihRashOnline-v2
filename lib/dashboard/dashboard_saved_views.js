'use strict';

const crypto = require('crypto');
const CONTRACT = require('./dashboard_saved_views.v1.json');
const COMPOSER = require('./dashboard_composer');
const FACTORY = require('./widget_factory');

const SCHEMA = 'PRH_DASHBOARD_SAVED_VIEWS_V1';
const VERSION = '1.0.0';
const CONFIG_SCHEMA = 'PRH_DASHBOARD_SAVED_CONFIGURATION_V1';
const STORE_SCHEMA = 'PRH_DASHBOARD_SAVED_VIEW_STORE_V1';
const VIEW_SCHEMA = 'PRH_DASHBOARD_SAVED_VIEW_V1';
const REVISION_SCHEMA = 'PRH_DASHBOARD_SAVED_VIEW_REVISION_V1';
const PRESET_SCHEMA = 'PRH_DASHBOARD_PRESET_V1';
const MIGRATION_SCHEMA = 'PRH_DASHBOARD_SAVED_VIEW_MIGRATION_V1';
const LEGACY_SCHEMA = 'PRH_DASHBOARD_SAVED_VIEW_V0';
const OP_RESULT_SCHEMA = 'PRH_DASHBOARD_SAVED_VIEW_OPERATION_RESULT_V1';
const VIEW_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PRESET_IDS = Object.freeze(CONTRACT.presets.slice());
const FORBIDDEN_SNAPSHOT_KEYS = new Set([
  'analytics_result', 'analytics_results', 'transaction_rows', 'transactions', 'dataset', 'datasets',
  'result_rows', 'financial_values', 'actual_total_minor', 'expected_total_minor', 'value_minor',
  'balance_minor', 'income_minor', 'expense_minor', 'cash_flow_minor', 'savings_minor',
  'gross_expense_minor', 'refund_minor', 'transfer_minor', 'runtime_locator', 'deployment_url',
  'oauth_token', 'access_token', 'refresh_token', 'credential', 'credentials', 'secret', 'secrets'
]);

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function clone(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(clone);
  const output = {};
  for (const key of Object.keys(value)) output[key] = clone(value[key]);
  return output;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function stableStringify(value) {
  return COMPOSER.stableStringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function byteLength(value) {
  return Buffer.byteLength(stableStringify(value), 'utf8');
}

function exactKeys(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(keys.slice().sort())) fail(code);
  return value;
}

function safeViewId(value) {
  const id = String(value || '').trim();
  if (!VIEW_ID_RE.test(id)) fail('DASH084_VIEW_ID_INVALID');
  return id;
}

function safeName(value) {
  const name = String(value || '').trim();
  if (!name || name.length > CONTRACT.limits.max_name_length) fail('DASH084_VIEW_NAME_INVALID');
  return name;
}

function assertNoSnapshotPayload(value, path = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSnapshotPayload(item, path.concat(String(index))));
    return true;
  }
  if (!value || typeof value !== 'object') return true;
  for (const [key, child] of Object.entries(value)) {
    const normalized = String(key).toLowerCase();
    if (FORBIDDEN_SNAPSHOT_KEYS.has(normalized)) fail('DASH084_FINANCIAL_SNAPSHOT_FORBIDDEN', path.concat(key).join('.'));
    assertNoSnapshotPayload(child, path.concat(key));
  }
  return true;
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'DASH-084' ||
      CONTRACT.store_schema !== STORE_SCHEMA || CONTRACT.view_schema !== VIEW_SCHEMA ||
      CONTRACT.revision_schema !== REVISION_SCHEMA || CONTRACT.preset_schema !== PRESET_SCHEMA ||
      CONTRACT.migration_receipt_schema !== MIGRATION_SCHEMA || CONTRACT.legacy_schema !== LEGACY_SCHEMA) {
    fail('DASH084_CONTRACT_INVALID');
  }
  COMPOSER.assertContract();
  FACTORY.assertContract();
  if (CONTRACT.upstream.dashboard_composer !== `${COMPOSER.SCHEMA}@${COMPOSER.VERSION}` ||
      CONTRACT.upstream.widget_factory !== `${FACTORY.SCHEMA}@${FACTORY.VERSION}` ||
      CONTRACT.upstream.financial_truth_policy !== 'FIN-TRUTH-v1') fail('DASH084_UPSTREAM_CONTRACT_INVALID');
  const p = CONTRACT.principles || {};
  if (p.configuration_only !== true || p.dashboard_layout_authority_reused !== true || p.widget_binding_authority_reused !== true ||
      p.financial_dataset_snapshot_allowed !== false || p.analytics_result_snapshot_allowed !== false || p.transaction_rows_allowed !== false ||
      p.financial_output_values_allowed !== false || p.query_configuration_allowed !== true ||
      p.private_dimension_filter_ids_allowed_in_private_store !== true || p.revision_history_immutable !== true ||
      p.identical_save !== 'NOOP' || p.restore_appends_revision !== true || p.timestamps_in_identity !== false ||
      p.public_financial_evidence !== 'SYNTHETIC_ONLY' || p.free_only !== true) fail('DASH084_BOUNDARY_INVALID');
  const authority = CONTRACT.authority || {};
  for (const [key, value] of Object.entries(authority)) {
    if (key === 'dashboard_config_storage') {
      if (value !== true) fail('DASH084_STORAGE_AUTHORITY_INVALID');
    } else if (value !== false) fail('DASH084_AUTHORITY_INVALID');
  }
  const storage = CONTRACT.storage || {};
  if (storage.adapter !== 'APPS_SCRIPT_USER_PROPERTIES_V1' || storage.user_scoped !== true ||
      storage.script_properties_allowed !== false || storage.document_properties_allowed !== false ||
      storage.browser_storage_required !== false || storage.financial_sheet_storage_allowed !== false ||
      storage.optimistic_generation_required !== true || storage.single_batch_commit_required !== true) {
    fail('DASH084_STORAGE_BOUNDARY_INVALID');
  }
  if (JSON.stringify(PRESET_IDS.slice().sort()) !== JSON.stringify(['BUDGET','CASH_FLOW','EXPENSE','FAMILY','INCOME','NET_WORTH','RISK','SUBSCRIPTIONS'].sort())) {
    fail('DASH084_PRESET_CATALOG_INVALID');
  }
  return true;
}

function rawFactoryPresentation(binding) {
  const p = binding.presentation;
  if ((binding.kind === 'KPI' || binding.kind === 'CARD') && p && p.mode === binding.kind) {
    return { schema: p.schema, contract_version: p.contract_version, title: p.title, show_comparison: p.show_comparison };
  }
  return p;
}

function normalizeBoundDescriptor(input) {
  exactKeys(input, ['schema','contract_version','widget_id','semantic_binding_status','layout_identity_authority','geometry_mutation','binding'], 'DASH084_BOUND_DESCRIPTOR_SHAPE_INVALID');
  if (input.schema !== FACTORY.BOUND_DESCRIPTOR_SCHEMA || input.contract_version !== FACTORY.VERSION ||
      input.semantic_binding_status !== 'BOUND' || input.layout_identity_authority !== false || input.geometry_mutation !== false) {
    fail('DASH084_BOUND_DESCRIPTOR_INVALID');
  }
  FACTORY.assertNoFinancialResultPayload(input);
  assertNoSnapshotPayload(input);
  const b = input.binding;
  const normalized = FACTORY.normalizeBinding({
    schema: b.schema,
    contract_version: b.contract_version,
    widget_id: b.widget_id,
    kind: b.kind,
    query: b.query,
    presentation: rawFactoryPresentation(b)
  });
  if (stableStringify(normalized) !== stableStringify(b)) fail('DASH084_BINDING_DERIVED_STATE_MISMATCH');
  if (input.widget_id !== normalized.widget_id) fail('DASH084_BOUND_WIDGET_ID_MISMATCH');
  return deepFreeze({
    schema: FACTORY.BOUND_DESCRIPTOR_SCHEMA,
    contract_version: FACTORY.VERSION,
    widget_id: input.widget_id,
    semantic_binding_status: 'BOUND',
    layout_identity_authority: false,
    geometry_mutation: false,
    binding: normalized
  });
}

function normalizeConfiguration(input) {
  assertContract();
  exactKeys(input, ['schema','contract_version','dashboard_spec','bound_widgets'], 'DASH084_CONFIGURATION_SHAPE_INVALID');
  if (input.schema !== CONFIG_SCHEMA || input.contract_version !== VERSION || !Array.isArray(input.bound_widgets)) {
    fail('DASH084_CONFIGURATION_VERSION_INVALID');
  }
  assertNoSnapshotPayload(input);
  const dashboardSpec = COMPOSER.canonicalSpec(input.dashboard_spec);
  const layoutIds = new Set(dashboardSpec.widgets.map((widget) => widget.id));
  const bound = input.bound_widgets.map(normalizeBoundDescriptor).sort((a,b) => a.widget_id.localeCompare(b.widget_id));
  if (new Set(bound.map((item) => item.widget_id)).size !== bound.length) fail('DASH084_BOUND_WIDGET_DUPLICATE');
  for (const item of bound) if (!layoutIds.has(item.widget_id)) fail('DASH084_BOUND_WIDGET_NOT_IN_LAYOUT', item.widget_id);
  const body = deepFreeze({
    schema: CONFIG_SCHEMA,
    contract_version: VERSION,
    dashboard_spec: dashboardSpec,
    bound_widgets: Object.freeze(bound)
  });
  if (byteLength(body) > CONTRACT.limits.max_configuration_bytes) fail('DASH084_CONFIGURATION_SIZE_LIMIT');
  return deepFreeze({ ...body, configuration_hash: sha256(stableStringify(body)) });
}

function rawConfiguration(configuration) {
  return {
    schema: CONFIG_SCHEMA,
    contract_version: VERSION,
    dashboard_spec: configuration.dashboard_spec,
    bound_widgets: configuration.bound_widgets
  };
}

function makeRevision(number, source, configurationInput, parentRevisionHash = null) {
  if (!Number.isInteger(number) || number < 1) fail('DASH084_REVISION_NUMBER_INVALID');
  const operation = String(source || '').toUpperCase();
  if (!['CREATE','PRESET','SAVE_VERSION','CLONE','RESET','RESTORE_REVISION','MIGRATE'].includes(operation)) fail('DASH084_REVISION_SOURCE_INVALID');
  const configuration = normalizeConfiguration(configurationInput);
  const body = deepFreeze({
    schema: REVISION_SCHEMA,
    contract_version: VERSION,
    revision: number,
    source: operation,
    parent_revision_hash: parentRevisionHash,
    configuration: rawConfiguration(configuration),
    configuration_hash: configuration.configuration_hash
  });
  return deepFreeze({ ...body, revision_hash: sha256(stableStringify(body)) });
}

function normalizeRevision(input) {
  exactKeys(input, ['schema','contract_version','revision','source','parent_revision_hash','configuration','configuration_hash','revision_hash'], 'DASH084_REVISION_SHAPE_INVALID');
  if (input.schema !== REVISION_SCHEMA || input.contract_version !== VERSION) fail('DASH084_REVISION_VERSION_INVALID');
  const rebuilt = makeRevision(input.revision, input.source, input.configuration, input.parent_revision_hash);
  if (rebuilt.configuration_hash !== input.configuration_hash || rebuilt.revision_hash !== input.revision_hash) fail('DASH084_REVISION_HASH_MISMATCH');
  return rebuilt;
}

function viewBody({ view_id, name, origin_preset_id, generation, active_revision, revisions }) {
  return {
    schema: VIEW_SCHEMA,
    contract_version: VERSION,
    view_id,
    name,
    origin_preset_id,
    generation,
    active_revision,
    revisions
  };
}

function makeView({ view_id, name, origin_preset_id = null, generation = 1, active_revision, revisions }) {
  const id = safeViewId(view_id);
  const safe = safeName(name);
  if (origin_preset_id != null && !PRESET_IDS.includes(origin_preset_id)) fail('DASH084_ORIGIN_PRESET_INVALID');
  if (!Number.isInteger(generation) || generation < 1) fail('DASH084_VIEW_GENERATION_INVALID');
  if (!Array.isArray(revisions) || revisions.length < 1 || revisions.length > CONTRACT.limits.max_revisions_per_view) fail('DASH084_REVISION_LIMIT');
  const normalized = revisions.map(normalizeRevision);
  for (let index = 0; index < normalized.length; index += 1) if (normalized[index].revision !== index + 1) fail('DASH084_REVISION_SEQUENCE_INVALID');
  if (!Number.isInteger(active_revision) || active_revision < 1 || active_revision > normalized.length) fail('DASH084_ACTIVE_REVISION_INVALID');
  const body = deepFreeze(viewBody({
    view_id: id,
    name: safe,
    origin_preset_id,
    generation,
    active_revision,
    revisions: Object.freeze(normalized)
  }));
  const view = deepFreeze({ ...body, view_hash: sha256(stableStringify(body)) });
  if (byteLength(view) > CONTRACT.limits.max_view_document_bytes) fail('DASH084_VIEW_DOCUMENT_SIZE_LIMIT');
  return view;
}

function normalizeView(input) {
  exactKeys(input, ['schema','contract_version','view_id','name','origin_preset_id','generation','active_revision','revisions','view_hash'], 'DASH084_VIEW_SHAPE_INVALID');
  if (input.schema !== VIEW_SCHEMA || input.contract_version !== VERSION) fail('DASH084_VIEW_VERSION_INVALID');
  const rebuilt = makeView(input);
  if (rebuilt.view_hash !== input.view_hash) fail('DASH084_VIEW_HASH_MISMATCH');
  return rebuilt;
}

function storeBody(generation, views) {
  return { schema: STORE_SCHEMA, contract_version: VERSION, generation, views };
}

function makeStore(generation, views) {
  if (!Number.isInteger(generation) || generation < 0) fail('DASH084_STORE_GENERATION_INVALID');
  if (!Array.isArray(views) || views.length > CONTRACT.limits.max_views) fail('DASH084_VIEW_LIMIT');
  const normalized = views.map(normalizeView).sort((a,b) => a.view_id.localeCompare(b.view_id));
  if (new Set(normalized.map((view) => view.view_id)).size !== normalized.length) fail('DASH084_VIEW_ID_DUPLICATE');
  const body = deepFreeze(storeBody(generation, Object.freeze(normalized)));
  return deepFreeze({ ...body, store_hash: sha256(stableStringify(body)) });
}

function emptyStore() {
  return makeStore(0, []);
}

function hydrateStore(generation, views) {
  return makeStore(generation, views);
}

function normalizeStore(input) {
  exactKeys(input, ['schema','contract_version','generation','views','store_hash'], 'DASH084_STORE_SHAPE_INVALID');
  if (input.schema !== STORE_SCHEMA || input.contract_version !== VERSION) fail('DASH084_STORE_VERSION_INVALID');
  const rebuilt = makeStore(input.generation, input.views);
  if (rebuilt.store_hash !== input.store_hash) fail('DASH084_STORE_HASH_MISMATCH');
  return rebuilt;
}

function assertExpectedGeneration(store, expected) {
  if (!Number.isInteger(expected) || expected !== store.generation) fail('DASH084_STORE_GENERATION_CONFLICT');
}

function findView(store, viewId) {
  const id = safeViewId(viewId);
  const index = store.views.findIndex((view) => view.view_id === id);
  if (index < 0) fail('DASH084_VIEW_NOT_FOUND');
  return { id, index, view: store.views[index] };
}

function currentRevision(view) {
  return view.revisions[view.active_revision - 1];
}

function operationResult(store, action, decision, reason, view = null, revision = null) {
  return deepFreeze({
    schema: OP_RESULT_SCHEMA,
    contract_version: VERSION,
    action,
    decision,
    reason,
    store,
    view_id: view ? view.view_id : null,
    view_hash: view ? view.view_hash : null,
    revision_hash: revision ? revision.revision_hash : null
  });
}

function replaceView(store, index, nextView) {
  const views = store.views.slice();
  views[index] = nextView;
  return makeStore(store.generation + 1, views);
}

function createView(storeInput, { view_id, name, configuration, origin_preset_id = null } = {}, expectedGeneration) {
  const store = normalizeStore(storeInput);
  assertExpectedGeneration(store, expectedGeneration);
  const id = safeViewId(view_id);
  if (store.views.some((view) => view.view_id === id)) fail('DASH084_VIEW_ALREADY_EXISTS');
  if (store.views.length >= CONTRACT.limits.max_views) fail('DASH084_VIEW_LIMIT');
  const revision = makeRevision(1, origin_preset_id ? 'PRESET' : 'CREATE', configuration, null);
  const view = makeView({ view_id: id, name, origin_preset_id, generation: 1, active_revision: 1, revisions: [revision] });
  const next = makeStore(store.generation + 1, store.views.concat(view));
  return operationResult(next, origin_preset_id ? 'CREATE_FROM_PRESET' : 'CREATE', 'APPLIED', 'OK', view, revision);
}

function saveVersion(storeInput, viewId, configuration, expectedGeneration, source = 'SAVE_VERSION') {
  const store = normalizeStore(storeInput);
  assertExpectedGeneration(store, expectedGeneration);
  const found = findView(store, viewId);
  const current = currentRevision(found.view);
  const normalized = normalizeConfiguration(configuration);
  if (normalized.configuration_hash === current.configuration_hash) return operationResult(store, 'SAVE_VERSION', 'NOOP', 'CONFIGURATION_UNCHANGED', found.view, current);
  if (found.view.revisions.length >= CONTRACT.limits.max_revisions_per_view) fail('DASH084_REVISION_LIMIT');
  const revision = makeRevision(found.view.revisions.length + 1, source, rawConfiguration(normalized), current.revision_hash);
  const view = makeView({
    ...found.view,
    generation: found.view.generation + 1,
    active_revision: revision.revision,
    revisions: found.view.revisions.concat(revision)
  });
  return operationResult(replaceView(store, found.index, view), source, 'APPLIED', 'OK', view, revision);
}

function renameView(storeInput, viewId, name, expectedGeneration) {
  const store = normalizeStore(storeInput);
  assertExpectedGeneration(store, expectedGeneration);
  const found = findView(store, viewId);
  const safe = safeName(name);
  if (safe === found.view.name) return operationResult(store, 'RENAME', 'NOOP', 'NAME_UNCHANGED', found.view, currentRevision(found.view));
  const view = makeView({ ...found.view, name: safe, generation: found.view.generation + 1 });
  return operationResult(replaceView(store, found.index, view), 'RENAME', 'APPLIED', 'OK', view, currentRevision(view));
}

function cloneView(storeInput, sourceViewId, { view_id, name } = {}, expectedGeneration) {
  const store = normalizeStore(storeInput);
  assertExpectedGeneration(store, expectedGeneration);
  const source = findView(store, sourceViewId).view;
  const id = safeViewId(view_id);
  if (store.views.some((view) => view.view_id === id)) fail('DASH084_VIEW_ALREADY_EXISTS');
  if (store.views.length >= CONTRACT.limits.max_views) fail('DASH084_VIEW_LIMIT');
  const sourceRevision = currentRevision(source);
  const revision = makeRevision(1, 'CLONE', sourceRevision.configuration, sourceRevision.revision_hash);
  const view = makeView({
    view_id: id,
    name: name || `${source.name} копия`,
    origin_preset_id: source.origin_preset_id,
    generation: 1,
    active_revision: 1,
    revisions: [revision]
  });
  return operationResult(makeStore(store.generation + 1, store.views.concat(view)), 'CLONE', 'APPLIED', 'OK', view, revision);
}

function restoreRevision(storeInput, viewId, revisionNumber, expectedGeneration) {
  const store = normalizeStore(storeInput);
  assertExpectedGeneration(store, expectedGeneration);
  const found = findView(store, viewId);
  if (!Number.isInteger(revisionNumber) || revisionNumber < 1 || revisionNumber > found.view.revisions.length) fail('DASH084_RESTORE_REVISION_INVALID');
  const source = found.view.revisions[revisionNumber - 1];
  return saveVersion(store, found.id, source.configuration, expectedGeneration, 'RESTORE_REVISION');
}

function resetView(storeInput, viewId, expectedGeneration) {
  const store = normalizeStore(storeInput);
  assertExpectedGeneration(store, expectedGeneration);
  const found = findView(store, viewId);
  const baseline = found.view.origin_preset_id
    ? presetById(found.view.origin_preset_id).configuration
    : found.view.revisions[0].configuration;
  return saveVersion(store, found.id, baseline, expectedGeneration, 'RESET');
}

function deleteView(storeInput, viewId, expectedGeneration) {
  const store = normalizeStore(storeInput);
  assertExpectedGeneration(store, expectedGeneration);
  const found = findView(store, viewId);
  const next = makeStore(store.generation + 1, store.views.filter((_, index) => index !== found.index));
  return operationResult(next, 'DELETE', 'APPLIED', 'OK', found.view, currentRevision(found.view));
}

function presetSpec(presetId, title, widgetTitles) {
  const widgets = widgetTitles.map((widgetTitle, index) => ({
    schema: COMPOSER.WIDGET_SCHEMA,
    id: `w-${String(index + 1).padStart(4, '0')}`,
    title: widgetTitle,
    semantic_binding_status: 'UNBOUND',
    geometry: { x: (index % 3) * 4, y: Math.floor(index / 3) * 2, w: 4, h: 2 }
  }));
  return normalizeConfiguration({
    schema: CONFIG_SCHEMA,
    contract_version: VERSION,
    dashboard_spec: {
      schema: COMPOSER.SPEC_SCHEMA,
      version: COMPOSER.VERSION,
      id: `preset-${presetId.toLowerCase().replace('_','-')}`,
      title,
      widgets
    },
    bound_widgets: []
  });
}

const PRESET_BLUEPRINTS = Object.freeze({
  FAMILY: ['Семейный обзор', ['Доходы и расходы','Денежный поток','Сбережения']],
  EXPENSE: ['Расходы', ['Расходы по категориям','Динамика расходов','Крупные расходы']],
  INCOME: ['Доходы', ['Источники дохода','Динамика доходов','Стабильность дохода']],
  CASH_FLOW: ['Денежный поток', ['Cash Flow','Входящий поток','Исходящий поток']],
  BUDGET: ['Бюджет', ['План и факт','Отклонения бюджета','Лимиты']],
  NET_WORTH: ['Капитал', ['Net Worth','Активы','Обязательства']],
  RISK: ['Риски', ['Финансовая устойчивость','Концентрация','Резерв']],
  SUBSCRIPTIONS: ['Подписки', ['Регулярные списания','Подписки по категориям','Изменение стоимости']]
});

function presetById(presetId) {
  const id = String(presetId || '').toUpperCase();
  if (!PRESET_IDS.includes(id)) fail('DASH084_PRESET_UNKNOWN');
  const [title, widgets] = PRESET_BLUEPRINTS[id];
  const configuration = presetSpec(id, title, widgets);
  const body = deepFreeze({
    schema: PRESET_SCHEMA,
    contract_version: VERSION,
    preset_id: id,
    title,
    editable: true,
    cloneable: true,
    configuration: rawConfiguration(configuration),
    configuration_hash: configuration.configuration_hash
  });
  return deepFreeze({ ...body, preset_hash: sha256(stableStringify(body)) });
}

function presetCatalog() {
  return Object.freeze(PRESET_IDS.map(presetById));
}

function createFromPreset(storeInput, presetId, { view_id, name } = {}, expectedGeneration) {
  const preset = presetById(presetId);
  return createView(storeInput, {
    view_id,
    name: name || preset.title,
    configuration: preset.configuration,
    origin_preset_id: preset.preset_id
  }, expectedGeneration);
}

function migrateLegacyView(legacyInput) {
  exactKeys(legacyInput, ['schema','view_id','name','preset_id','layout','bindings'], 'DASH084_LEGACY_SHAPE_INVALID');
  if (legacyInput.schema !== LEGACY_SCHEMA) fail('DASH084_MIGRATION_SOURCE_UNSUPPORTED');
  const presetId = legacyInput.preset_id == null ? null : String(legacyInput.preset_id).toUpperCase();
  if (presetId != null && !PRESET_IDS.includes(presetId)) fail('DASH084_ORIGIN_PRESET_INVALID');
  const configuration = normalizeConfiguration({
    schema: CONFIG_SCHEMA,
    contract_version: VERSION,
    dashboard_spec: legacyInput.layout,
    bound_widgets: legacyInput.bindings
  });
  const revision = makeRevision(1, 'MIGRATE', rawConfiguration(configuration), null);
  const view = makeView({
    view_id: legacyInput.view_id,
    name: legacyInput.name,
    origin_preset_id: presetId,
    generation: 1,
    active_revision: 1,
    revisions: [revision]
  });
  const body = deepFreeze({
    schema: MIGRATION_SCHEMA,
    contract_version: VERSION,
    from_schema: LEGACY_SCHEMA,
    to_schema: VIEW_SCHEMA,
    view_id: view.view_id,
    source_hash: sha256(stableStringify(legacyInput)),
    target_view_hash: view.view_hash,
    status: 'PASS'
  });
  return deepFreeze({ view, receipt: { ...body, migration_hash: sha256(stableStringify(body)) } });
}

function migrateIntoStore(storeInput, legacyInput, expectedGeneration) {
  const store = normalizeStore(storeInput);
  assertExpectedGeneration(store, expectedGeneration);
  const migrated = migrateLegacyView(legacyInput);
  if (store.views.some((view) => view.view_id === migrated.view.view_id)) fail('DASH084_VIEW_ALREADY_EXISTS');
  if (store.views.length >= CONTRACT.limits.max_views) fail('DASH084_VIEW_LIMIT');
  const next = makeStore(store.generation + 1, store.views.concat(migrated.view));
  return deepFreeze({ ...operationResult(next, 'MIGRATE', 'APPLIED', 'OK', migrated.view, currentRevision(migrated.view)), migration_receipt: migrated.receipt });
}

function serializeIndex(storeInput) {
  const store = normalizeStore(storeInput);
  const index = deepFreeze({
    schema: 'PRH_DASHBOARD_SAVED_VIEW_INDEX_V1',
    contract_version: VERSION,
    generation: store.generation,
    view_ids: Object.freeze(store.views.map((view) => view.view_id))
  });
  if (byteLength(index) > CONTRACT.limits.max_index_bytes) fail('DASH084_INDEX_SIZE_LIMIT');
  return JSON.stringify(index);
}

function serializeView(viewInput) {
  const view = normalizeView(viewInput);
  if (byteLength(view) > CONTRACT.limits.max_view_document_bytes) fail('DASH084_VIEW_DOCUMENT_SIZE_LIMIT');
  return JSON.stringify(view);
}

function telemetry(action, storeInput, viewInput = null, revisionInput = null, decision = 'ALLOW', reason = 'OK') {
  const store = normalizeStore(storeInput);
  const view = viewInput == null ? null : normalizeView(viewInput);
  const revision = revisionInput == null ? null : normalizeRevision(revisionInput);
  const output = deepFreeze({
    schema: SCHEMA,
    version: VERSION,
    action: String(action || '').toUpperCase(),
    view_hash_prefix: view ? view.view_hash.slice(0, 12) : '',
    revision_hash_prefix: revision ? revision.revision_hash.slice(0, 12) : '',
    view_count: store.views.length,
    revision_count: view ? view.revisions.length : 0,
    decision: String(decision || '').toUpperCase(),
    reason: String(reason || '').toUpperCase()
  });
  if (JSON.stringify(Object.keys(output).sort()) !== JSON.stringify(CONTRACT.telemetry_allowlist.slice().sort())) fail('DASH084_TELEMETRY_SHAPE_INVALID');
  return output;
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  CONFIG_SCHEMA,
  STORE_SCHEMA,
  VIEW_SCHEMA,
  REVISION_SCHEMA,
  PRESET_SCHEMA,
  MIGRATION_SCHEMA,
  LEGACY_SCHEMA,
  OP_RESULT_SCHEMA,
  PRESET_IDS,
  assertContract,
  assertNoSnapshotPayload,
  normalizeConfiguration,
  normalizeRevision,
  normalizeView,
  emptyStore,
  hydrateStore,
  normalizeStore,
  createView,
  createFromPreset,
  saveVersion,
  cloneView,
  renameView,
  resetView,
  restoreRevision,
  deleteView,
  presetById,
  presetCatalog,
  migrateLegacyView,
  migrateIntoStore,
  serializeIndex,
  serializeView,
  telemetry
});
