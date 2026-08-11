/** DASH-084 private per-user dashboard configuration storage adapter. */
var PRH_DASH084_STORAGE_NAMESPACE_ = 'PRH_DASH084_V1';
var PRH_DASH084_STORAGE_INDEX_KEY_ = PRH_DASH084_STORAGE_NAMESPACE_ + ':INDEX';
var PRH_DASH084_STORAGE_VIEW_PREFIX_ = PRH_DASH084_STORAGE_NAMESPACE_ + ':VIEW:';
var PRH_DASH084_STORAGE_INDEX_MAX_BYTES_ = 6000;
var PRH_DASH084_STORAGE_VIEW_MAX_BYTES_ = 8000;
var PRH_DASH084_STORAGE_MAX_VIEWS_ = 24;

function prhDash084StorageFail_(code) {
  throw new Error(code);
}

function prhDash084StorageUserProperties_() {
  if (typeof PropertiesService === 'undefined' || !PropertiesService || typeof PropertiesService.getUserProperties !== 'function') {
    prhDash084StorageFail_('DASH084_USER_PROPERTIES_UNAVAILABLE');
  }
  return PropertiesService.getUserProperties();
}

function prhDash084StorageLock_() {
  if (typeof LockService === 'undefined' || !LockService || typeof LockService.getUserLock !== 'function') {
    prhDash084StorageFail_('DASH084_USER_LOCK_UNAVAILABLE');
  }
  return LockService.getUserLock();
}

function prhDash084StorageBytes_(text) {
  var value = String(text == null ? '' : text);
  if (typeof Utilities !== 'undefined' && Utilities && typeof Utilities.newBlob === 'function') {
    return Utilities.newBlob(value).getBytes().length;
  }
  return unescape(encodeURIComponent(value)).length;
}

function prhDash084StorageViewId_(value) {
  var id = String(value == null ? '' : value).trim();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) prhDash084StorageFail_('DASH084_STORAGE_VIEW_ID_INVALID');
  return id;
}

function prhDash084StorageParseJson_(text, code) {
  try {
    var value = JSON.parse(String(text));
    if (!value || typeof value !== 'object' || Array.isArray(value)) prhDash084StorageFail_(code);
    return value;
  } catch (error) {
    if (error && String(error.message || error) === code) throw error;
    prhDash084StorageFail_(code);
  }
}

function prhDash084StorageDefaultIndex_() {
  return {
    schema: 'PRH_DASHBOARD_SAVED_VIEW_INDEX_V1',
    contract_version: '1.0.0',
    generation: 0,
    view_ids: []
  };
}

function prhDash084StorageNormalizeIndex_(text) {
  if (text == null || text === '') return prhDash084StorageDefaultIndex_();
  var value = prhDash084StorageParseJson_(text, 'DASH084_STORAGE_INDEX_JSON_INVALID');
  if (value.schema !== 'PRH_DASHBOARD_SAVED_VIEW_INDEX_V1' || value.contract_version !== '1.0.0' ||
      !Number.isInteger(value.generation) || value.generation < 0 || !Array.isArray(value.view_ids) ||
      value.view_ids.length > PRH_DASH084_STORAGE_MAX_VIEWS_) {
    prhDash084StorageFail_('DASH084_STORAGE_INDEX_INVALID');
  }
  var ids = [];
  var seen = {};
  for (var index = 0; index < value.view_ids.length; index += 1) {
    var id = prhDash084StorageViewId_(value.view_ids[index]);
    if (seen[id]) prhDash084StorageFail_('DASH084_STORAGE_INDEX_DUPLICATE');
    seen[id] = true;
    ids.push(id);
  }
  ids.sort();
  return {
    schema: value.schema,
    contract_version: value.contract_version,
    generation: value.generation,
    view_ids: ids
  };
}

function prhDash084StorageReadIndex_() {
  var properties = prhDash084StorageUserProperties_();
  return prhDash084StorageNormalizeIndex_(properties.getProperty(PRH_DASH084_STORAGE_INDEX_KEY_));
}

function prhDash084StorageReadView_(viewId) {
  var id = prhDash084StorageViewId_(viewId);
  var text = prhDash084StorageUserProperties_().getProperty(PRH_DASH084_STORAGE_VIEW_PREFIX_ + id);
  if (text == null || text === '') return null;
  var value = prhDash084StorageParseJson_(text, 'DASH084_STORAGE_VIEW_JSON_INVALID');
  if (value.schema === 'PRH_DASHBOARD_SAVED_VIEW_TOMBSTONE_V1' && value.view_id === id && value.deleted === true) return null;
  if (value.schema !== 'PRH_DASHBOARD_SAVED_VIEW_V1' || value.contract_version !== '1.0.0' || value.view_id !== id) {
    prhDash084StorageFail_('DASH084_STORAGE_VIEW_INVALID');
  }
  return text;
}

function prhDash084StorageReadSnapshot_() {
  var properties = prhDash084StorageUserProperties_();
  var index = prhDash084StorageNormalizeIndex_(properties.getProperty(PRH_DASH084_STORAGE_INDEX_KEY_));
  var views = {};
  for (var position = 0; position < index.view_ids.length; position += 1) {
    var id = index.view_ids[position];
    var text = properties.getProperty(PRH_DASH084_STORAGE_VIEW_PREFIX_ + id);
    if (text == null || text === '') prhDash084StorageFail_('DASH084_STORAGE_INDEX_VIEW_MISSING');
    var parsed = prhDash084StorageParseJson_(text, 'DASH084_STORAGE_VIEW_JSON_INVALID');
    if (parsed.schema !== 'PRH_DASHBOARD_SAVED_VIEW_V1' || parsed.contract_version !== '1.0.0' || parsed.view_id !== id) {
      prhDash084StorageFail_('DASH084_STORAGE_INDEX_VIEW_INVALID');
    }
    views[id] = text;
  }
  return {
    schema: 'PRH_DASHBOARD_SAVED_VIEW_STORAGE_SNAPSHOT_V1',
    contract_version: '1.0.0',
    generation: index.generation,
    index: index,
    view_json_by_id: views
  };
}

function prhDash084StorageCommit_(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) prhDash084StorageFail_('DASH084_STORAGE_COMMIT_INVALID');
  var expectedGeneration = request.expected_generation;
  if (!Number.isInteger(expectedGeneration) || expectedGeneration < 0) prhDash084StorageFail_('DASH084_STORAGE_EXPECTED_GENERATION_INVALID');
  var viewId = prhDash084StorageViewId_(request.view_id);
  var nextIndexText = String(request.index_json == null ? '' : request.index_json);
  if (!nextIndexText || prhDash084StorageBytes_(nextIndexText) > PRH_DASH084_STORAGE_INDEX_MAX_BYTES_) {
    prhDash084StorageFail_('DASH084_STORAGE_INDEX_SIZE_LIMIT');
  }
  var nextIndex = prhDash084StorageNormalizeIndex_(nextIndexText);
  if (nextIndex.generation !== expectedGeneration + 1) prhDash084StorageFail_('DASH084_STORAGE_NEXT_GENERATION_INVALID');

  var nextViewText;
  if (request.view_json == null) {
    if (nextIndex.view_ids.indexOf(viewId) >= 0) prhDash084StorageFail_('DASH084_STORAGE_DELETE_INDEX_CONFLICT');
    nextViewText = JSON.stringify({
      schema: 'PRH_DASHBOARD_SAVED_VIEW_TOMBSTONE_V1',
      contract_version: '1.0.0',
      view_id: viewId,
      deleted: true,
      index_generation: nextIndex.generation
    });
  } else {
    nextViewText = String(request.view_json);
    if (prhDash084StorageBytes_(nextViewText) > PRH_DASH084_STORAGE_VIEW_MAX_BYTES_) prhDash084StorageFail_('DASH084_STORAGE_VIEW_SIZE_LIMIT');
    var nextView = prhDash084StorageParseJson_(nextViewText, 'DASH084_STORAGE_VIEW_JSON_INVALID');
    if (nextView.schema !== 'PRH_DASHBOARD_SAVED_VIEW_V1' || nextView.contract_version !== '1.0.0' || nextView.view_id !== viewId) {
      prhDash084StorageFail_('DASH084_STORAGE_VIEW_INVALID');
    }
    if (nextIndex.view_ids.indexOf(viewId) < 0) prhDash084StorageFail_('DASH084_STORAGE_VIEW_INDEX_CONFLICT');
  }

  var lock = prhDash084StorageLock_();
  if (!lock.tryLock(5000)) prhDash084StorageFail_('DASH084_STORAGE_LOCK_TIMEOUT');
  try {
    var properties = prhDash084StorageUserProperties_();
    var currentIndex = prhDash084StorageNormalizeIndex_(properties.getProperty(PRH_DASH084_STORAGE_INDEX_KEY_));
    if (currentIndex.generation !== expectedGeneration) prhDash084StorageFail_('DASH084_STORAGE_GENERATION_CONFLICT');
    var updates = {};
    updates[PRH_DASH084_STORAGE_INDEX_KEY_] = nextIndexText;
    updates[PRH_DASH084_STORAGE_VIEW_PREFIX_ + viewId] = nextViewText;
    properties.setProperties(updates, false);
    return {
      schema: 'PRH_DASHBOARD_SAVED_VIEW_STORAGE_COMMIT_V1',
      contract_version: '1.0.0',
      generation: nextIndex.generation,
      view_id: viewId,
      deleted: request.view_json == null,
      index_bytes: prhDash084StorageBytes_(nextIndexText),
      view_bytes: prhDash084StorageBytes_(nextViewText)
    };
  } finally {
    lock.releaseLock();
  }
}
