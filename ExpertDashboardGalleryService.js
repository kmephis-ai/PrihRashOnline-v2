/** DASH-090 configuration-only Apps Script bridge. No financial/query authority. */
var PRH_DASH090_RUNTIME_SCHEMA_ = 'PRH_EXPERT_DASHBOARD_GALLERY_RUNTIME_V1';

function prhDash090Runtime_() {
  if (typeof PRH_R2_CANONICAL_RUNTIME === 'undefined' || !PRH_R2_CANONICAL_RUNTIME ||
      !PRH_R2_CANONICAL_RUNTIME.expertDashboardGallery || !PRH_R2_CANONICAL_RUNTIME.dashboardSavedViews) {
    throw new Error('DASH090_CANONICAL_RUNTIME_UNAVAILABLE');
  }
  return PRH_R2_CANONICAL_RUNTIME;
}

function prhDash090StoreFromStorage_() {
  var runtime = prhDash090Runtime_();
  var snapshot = prhDash084StorageReadSnapshot_();
  var views = snapshot.index.view_ids.map(function(viewId) {
    var text = snapshot.view_json_by_id[viewId];
    if (!text) throw new Error('DASH090_STORAGE_VIEW_MISSING:' + viewId);
    return JSON.parse(text);
  });
  return runtime.dashboardSavedViews.hydrateStore(snapshot.generation, views);
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
    presets: gallery.catalog().map(function(preset) {
      var available = gallery.availability(preset.preset_id, capabilityState);
      return {
        preset_id: preset.preset_id,
        title: preset.title,
        description: preset.description,
        required_capabilities: preset.required_capabilities.slice(),
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
  var viewId = String(request.view_id || '').trim().toLowerCase();
  var name = String(request.name || '').trim();
  var runtime = prhDash090Runtime_();
  var saved = runtime.dashboardSavedViews;
  var gallery = runtime.expertDashboardGallery;
  var before = prhDash090StoreFromStorage_();
  var result = gallery.cloneToSavedView(before, presetId, { view_id: viewId, name: name }, before.generation, gallery.allAvailableCapabilities());
  var view = result.view;
  var commit = prhDash084StorageCommit_({
    expected_generation: before.generation,
    index_json: saved.serializeIndex(result.store),
    view_id: view.view_id,
    view_json: saved.serializeView(view)
  });
  var readback = prhDash084StorageReadView_(view.view_id);
  if (!readback || JSON.parse(readback).view_hash !== view.view_hash || commit.generation !== result.store.generation) {
    throw new Error('DASH090_CLONE_READBACK_MISMATCH');
  }
  return {
    schema: PRH_DASH090_RUNTIME_SCHEMA_, contract_version: gallery.VERSION,
    decision: 'APPLIED', reason: 'OK', preset_id: presetId, view_id: view.view_id,
    generation: commit.generation, preset_hash_prefix: result.preset_hash.slice(0, 12), view_hash_prefix: view.view_hash.slice(0, 12),
    financial_payload: false, query_execution: false, financial_write: false
  };
}
