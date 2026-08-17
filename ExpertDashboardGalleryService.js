/** DASH-090 configuration-only Apps Script bridge. No financial/query authority. */
var PRH_DASH090_RUNTIME_SCHEMA_ = 'PRH_EXPERT_DASHBOARD_GALLERY_RUNTIME_V1';

function prhDash090Runtime_() {
  if (typeof PRH_R2_CANONICAL_RUNTIME === 'undefined' || !PRH_R2_CANONICAL_RUNTIME ||
      !PRH_R2_CANONICAL_RUNTIME.expertDashboardGallery || !PRH_R2_CANONICAL_RUNTIME.dashboardSavedViews) {
    throw new Error('DASH090_CANONICAL_RUNTIME_UNAVAILABLE');
  }
  return PRH_R2_CANONICAL_RUNTIME;
}

function prhDash090ProjectionFromSnapshot_(snapshot, viewId) {
  var runtime = prhDash090Runtime_();
  if (viewId == null) return runtime.dashboardSavedViews.hydrateStore(snapshot.generation, []);
  var id = prhDash084StorageViewId_(viewId);
  var text = snapshot.view_json_by_id[id];
  if (!text) throw new Error('DASH090_STORAGE_VIEW_MISSING:' + id);
  return runtime.dashboardSavedViews.hydrateStore(snapshot.generation, [JSON.parse(text)]);
}

function prhDash090FindView_(store, viewId) {
  var id = String(viewId || '').trim();
  var view = store.views.filter(function(item) { return item.view_id === id; })[0];
  if (!view) throw new Error('DASH090_VIEW_NOT_FOUND');
  return view;
}

function prhDash090ViewSummary_(store, view) {
  var runtime = prhDash090Runtime_();
  var revision = view.revisions[view.active_revision - 1];
  var preset = runtime.expertDashboardGallery.presetFromConfiguration(revision.configuration);
  return {
    schema: PRH_DASH090_RUNTIME_SCHEMA_,
    contract_version: runtime.expertDashboardGallery.VERSION,
    financial_payload: false,
    query_execution: false,
    financial_write: false,
    google_sheets_read: false,
    view_id: view.view_id,
    view_name: view.name,
    store_generation: store.generation,
    view_generation: view.generation,
    active_revision: view.active_revision,
    preset_id: preset.preset_id,
    preset_hash: preset.preset_hash,
    preset_title: preset.title,
    preset_description: preset.description,
    panels: preset.panels.map(function(panel) {
      return {
        panel_id: panel.panel_id,
        title: panel.title,
        kind: panel.kind,
        source_contract: panel.source_contract,
        semantic_ref: panel.semantic_ref,
        visual_ref: panel.visual_ref
      };
    }),
    dashboard_spec: revision.configuration.dashboard_spec
  };
}

function prhDash090CommitOperation_(snapshot, operation, viewId, createMode) {
  if (operation.store.generation === snapshot.generation) return null;
  if (operation.store.generation !== snapshot.generation + 1) throw new Error('DASH090_STORE_GENERATION_INVALID');
  var runtime = prhDash090Runtime_();
  var id = prhDash084StorageViewId_(viewId);
  var ids = snapshot.index.view_ids.slice();
  var present = ids.indexOf(id) >= 0;
  if (createMode === true) {
    if (present) throw new Error('DASH090_VIEW_ID_CONFLICT');
    ids.push(id);
  } else if (!present) {
    throw new Error('DASH090_VIEW_NOT_FOUND');
  }
  ids.sort();
  var view = prhDash090FindView_(operation.store, id);
  return prhDash084StorageCommit_({
    expected_generation: snapshot.generation,
    view_id: id,
    index_json: JSON.stringify({schema:'PRH_DASHBOARD_SAVED_VIEW_INDEX_V1',contract_version:'1.0.0',generation:operation.store.generation,view_ids:ids}),
    view_json: runtime.dashboardSavedViews.serializeView(view)
  });
}

function prhDash090PublicCatalog() {
  var gallery = prhDash090Runtime_().expertDashboardGallery;
  var capabilityState = gallery.allAvailableCapabilities();
  return {
    schema: PRH_DASH090_RUNTIME_SCHEMA_,
    contract_version: gallery.VERSION,
    financial_payload: false,
    query_execution: false,
    financial_write: false,
    google_sheets_read: false,
    presets: gallery.catalog().map(function(preset) {
      var available = gallery.availability(preset.preset_id, capabilityState);
      if (available.status === 'AVAILABLE') gallery.projectToSavedConfiguration(preset.preset_id);
      return {
        preset_id: preset.preset_id,
        title: preset.title,
        description: preset.description,
        required_capabilities: preset.required_capabilities.slice(),
        panels: preset.panels.map(function(panel) { return { panel_id: panel.panel_id, title: panel.title, visual_ref: panel.visual_ref }; }),
        status: available.status,
        reason: available.reason,
        preset_hash: preset.preset_hash
      };
    })
  };
}

function prhDash090ClonePreset(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('DASH090_RUNTIME_REQUEST_INVALID');
  var presetId = String(request.preset_id || '').trim().toUpperCase();
  var runtime = prhDash090Runtime_();
  var gallery = runtime.expertDashboardGallery;
  var snapshot = prhDash084StorageReadSnapshot_();
  var id = prhDash084StorageViewId_(request.view_id);
  if (snapshot.index.view_ids.indexOf(id) >= 0) throw new Error('DASH090_VIEW_ID_CONFLICT');
  var store = prhDash090ProjectionFromSnapshot_(snapshot, null);
  var result = gallery.cloneToSavedView(store, presetId, {
    view_id: id,
    name: request.name
  }, store.generation, gallery.allAvailableCapabilities());
  prhDash090CommitOperation_(snapshot, result, result.view_id, true);
  return prhDash090ViewSummary_(result.store, result.view);
}

function prhDash090ReadView(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('DASH090_RUNTIME_REQUEST_INVALID');
  var snapshot = prhDash084StorageReadSnapshot_();
  var store = prhDash090ProjectionFromSnapshot_(snapshot, request.view_id);
  return prhDash090ViewSummary_(store, prhDash090FindView_(store, request.view_id));
}

function prhDash090SaveViewConfiguration(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('DASH090_RUNTIME_REQUEST_INVALID');
  var runtime = prhDash090Runtime_();
  var saved = runtime.dashboardSavedViews;
  var gallery = runtime.expertDashboardGallery;
  var snapshot = prhDash084StorageReadSnapshot_();
  var store = prhDash090ProjectionFromSnapshot_(snapshot, request.view_id);
  if (!Number.isInteger(request.expected_generation) || request.expected_generation !== store.generation) throw new Error('DASH090_STORE_GENERATION_CONFLICT');
  var view = prhDash090FindView_(store, request.view_id);
  var revision = view.revisions[view.active_revision - 1];
  var preset = gallery.presetFromConfiguration(revision.configuration);
  var title = String(request.dashboard_title || '').trim();
  if (!title || title.length > 100) throw new Error('DASH090_DASHBOARD_TITLE_INVALID');
  var currentSpec = revision.configuration.dashboard_spec;
  var nextSpec = {
    schema: currentSpec.schema,
    version: currentSpec.version,
    id: currentSpec.id,
    title: title,
    widgets: currentSpec.widgets
  };
  var nextConfiguration = {
    schema: saved.CONFIG_SCHEMA,
    contract_version: saved.VERSION,
    dashboard_spec: nextSpec,
    bound_widgets: revision.configuration.bound_widgets
  };
  if (gallery.presetFromConfiguration(nextConfiguration).preset_id !== preset.preset_id) throw new Error('DASH090_PRESET_IDENTITY_MUTATION_FORBIDDEN');
  var operation = saved.saveVersion(store, view.view_id, nextConfiguration, store.generation);
  prhDash090CommitOperation_(snapshot, operation, view.view_id, false);
  var nextView = prhDash090FindView_(operation.store, view.view_id);
  return prhDash090ViewSummary_(operation.store, nextView);
}
