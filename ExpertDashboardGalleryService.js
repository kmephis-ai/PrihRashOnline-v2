/** DASH-090 configuration-only Apps Script bridge. No financial/query authority. */
var PRH_DASH090_RUNTIME_SCHEMA_ = 'PRH_EXPERT_DASHBOARD_GALLERY_RUNTIME_V1';
var PRH_DASH090_PROJECTION_BLOCK_REASON_ = 'LOSSLESS_EXPERT_PROJECTION_NOT_READY';

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
        status: available.status === 'AVAILABLE' ? 'UNAVAILABLE' : available.status,
        reason: available.status === 'AVAILABLE' ? PRH_DASH090_PROJECTION_BLOCK_REASON_ : available.reason,
        preset_hash: preset.preset_hash
      };
    })
  };
}

function prhDash090ClonePreset(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('DASH090_RUNTIME_REQUEST_INVALID');
  var presetId = String(request.preset_id || '').trim().toUpperCase();
  var gallery = prhDash090Runtime_().expertDashboardGallery;
  gallery.presetById(presetId);

  // Fail closed until DASH-090 can losslessly project every expert panel semantic into
  // the canonical DASH-080/081 configuration persisted by DASH-084. Cloning only the
  // nearest generic DASH-084 preset would create a valid saved view with the wrong
  // expert meaning, which is more dangerous than an explicit unavailable state.
  throw new Error('DASH090_' + PRH_DASH090_PROJECTION_BLOCK_REASON_);
}