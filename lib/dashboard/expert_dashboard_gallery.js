'use strict';

const crypto = require('crypto');
const CONTRACT = require('./expert_dashboard_gallery.v1.json');
const SAVED = require('./dashboard_saved_views');
const COMPOSER = require('./dashboard_composer');

const SCHEMA = 'PRH_EXPERT_DASHBOARD_GALLERY_V1';
const VERSION = '1.0.0';
const PRESET_SCHEMA = 'PRH_EXPERT_DASHBOARD_PRESET_V1';
const AVAILABILITY_SCHEMA = 'PRH_EXPERT_DASHBOARD_AVAILABILITY_V1';
const CLONE_SCHEMA = 'PRH_EXPERT_DASHBOARD_CLONE_RESULT_V1';
const ID_RE = /^[A-Z][A-Z0-9_]{2,63}$/;
const CAPABILITY_RE = /^PRH_[A-Z0-9_]+_V[0-9]+@[0-9]+\.[0-9]+\.[0-9]+$/;
const FORBIDDEN_KEYS = new Set([
  'analytics_result','analytics_results','transaction_rows','transactions','rows','dataset','datasets',
  'financial_values','amount','amount_minor','income_minor','expense_minor','cash_flow_minor','balance_minor',
  'private_id','private_ids','filter_value','filter_values','runtime_locator','deployment_url','credential','credentials',
  'secret','secrets','access_token','refresh_token','oauth_token'
]);

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value); Object.values(value).forEach(deepFreeze); return value;
}
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}
function sha256(value) { return crypto.createHash('sha256').update(String(value),'utf8').digest('hex'); }
function safeText(value, max, code) {
  const text = String(value || '').trim(); if (!text || text.length > max) fail(code); return text;
}
function assertNoPrivatePayload(value, path = 'gallery') {
  if (Array.isArray(value)) { value.forEach((item, i) => assertNoPrivatePayload(item, `${path}[${i}]`)); return true; }
  if (!value || typeof value !== 'object') return true;
  for (const [key, child] of Object.entries(value)) {
    const normalized = String(key).toLowerCase();
    if (FORBIDDEN_KEYS.has(normalized) || normalized.endsWith('_amount') || normalized.endsWith('_amount_minor')) {
      fail('DASH090_CATALOG_PRIVATE_OR_FINANCIAL_PAYLOAD_FORBIDDEN', `${path}.${key}`);
    }
    assertNoPrivatePayload(child, `${path}.${key}`);
  }
  return true;
}

function capability(schema, version) { return `${schema}@${version}`; }
const CAP = deepFreeze({
  SAVED: capability(SAVED.SCHEMA, SAVED.VERSION),
  COMPOSER: capability(COMPOSER.SCHEMA, COMPOSER.VERSION),
  WIDGET_FACTORY: String(CONTRACT.upstream.widget_factory),
  DECOMP: String(CONTRACT.upstream.contribution_decomposition),
  SDC: String(CONTRACT.upstream.seasonality_distribution_concentration),
  TRENDS: String(CONTRACT.upstream.long_term_trends),
  RISK: String(CONTRACT.upstream.liquidity_financial_risk),
  XRAY: String(CONTRACT.upstream.financial_health_xray),
  ADV_VIZ: String(CONTRACT.upstream.advanced_visualization_pack)
});

const BLUEPRINTS = deepFreeze([
  {
    preset_id:'CASH_FLOW_DECOMPOSITION', title:'Декомпозиция денежного потока',
    description:'Какие изменения доходов и расходов сформировали итоговый денежный поток и что сильнее всего повлияло на период.',
    base_preset_id:'CASH_FLOW', required_capabilities:[CAP.SAVED,CAP.COMPOSER,CAP.WIDGET_FACTORY,CAP.DECOMP,CAP.ADV_VIZ],
    panels:[
      {panel_id:'cash-flow-waterfall', title:'Вклад в денежный поток', kind:'ANALYTICS', source_contract:CAP.DECOMP, semantic_ref:'CASH_FLOW_CONTRIBUTION', visual_ref:'WATERFALL'},
      {panel_id:'cash-flow-drivers', title:'Главные драйверы', kind:'ANALYTICS', source_contract:CAP.DECOMP, semantic_ref:'TOP_CONTRIBUTORS', visual_ref:'BAR'}
    ]
  },
  {
    preset_id:'SPENDING_DRIVERS', title:'Драйверы расходов',
    description:'Основные категории и изменения, которые объясняют рост или снижение расходов без дублирования финансовых формул.',
    base_preset_id:'EXPENSE', required_capabilities:[CAP.SAVED,CAP.COMPOSER,CAP.WIDGET_FACTORY,CAP.DECOMP,CAP.SDC,CAP.ADV_VIZ],
    panels:[
      {panel_id:'expense-drivers', title:'Что меняет расходы', kind:'ANALYTICS', source_contract:CAP.DECOMP, semantic_ref:'EXPENSE_CONTRIBUTION', visual_ref:'BAR'},
      {panel_id:'expense-distribution', title:'Структура расходов', kind:'ANALYTICS', source_contract:CAP.SDC, semantic_ref:'EXPENSE_DISTRIBUTION', visual_ref:'TREEMAP'}
    ]
  },
  {
    preset_id:'SEASONALITY', title:'Сезонность',
    description:'Повторяющиеся календарные закономерности расходов и доходов с явной опорой на canonical seasonality contract.',
    base_preset_id:'FAMILY', required_capabilities:[CAP.SAVED,CAP.COMPOSER,CAP.WIDGET_FACTORY,CAP.SDC,CAP.ADV_VIZ],
    panels:[
      {panel_id:'seasonality-heatmap', title:'Календарная сезонность', kind:'ANALYTICS', source_contract:CAP.SDC, semantic_ref:'SEASONALITY_PROFILE', visual_ref:'HEATMAP'},
      {panel_id:'seasonality-distribution', title:'Распределение', kind:'ANALYTICS', source_contract:CAP.SDC, semantic_ref:'DISTRIBUTION_PROFILE', visual_ref:'BOXPLOT'}
    ]
  },
  {
    preset_id:'CONCENTRATION', title:'Концентрация',
    description:'Насколько семейные расходы или доходы зависят от небольшого числа категорий и источников.',
    base_preset_id:'RISK', required_capabilities:[CAP.SAVED,CAP.COMPOSER,CAP.WIDGET_FACTORY,CAP.SDC,CAP.ADV_VIZ],
    panels:[
      {panel_id:'expense-concentration', title:'Концентрация расходов', kind:'ANALYTICS', source_contract:CAP.SDC, semantic_ref:'EXPENSE_CONCENTRATION', visual_ref:'PARETO'},
      {panel_id:'income-concentration', title:'Концентрация доходов', kind:'ANALYTICS', source_contract:CAP.SDC, semantic_ref:'INCOME_CONCENTRATION', visual_ref:'PARETO'}
    ]
  },
  {
    preset_id:'LONG_TERM_TRENDS', title:'Долгосрочные тренды',
    description:'Долгосрочная динамика доходов, расходов и сбережений с versioned trend evidence и без скрытой экстраполяции.',
    base_preset_id:'FAMILY', required_capabilities:[CAP.SAVED,CAP.COMPOSER,CAP.WIDGET_FACTORY,CAP.TRENDS,CAP.ADV_VIZ],
    panels:[
      {panel_id:'trend-income-expense', title:'Доходы и расходы', kind:'ANALYTICS', source_contract:CAP.TRENDS, semantic_ref:'INCOME_EXPENSE_TREND', visual_ref:'LINE'},
      {panel_id:'trend-savings', title:'Сбережения', kind:'ANALYTICS', source_contract:CAP.TRENDS, semantic_ref:'SAVINGS_TREND', visual_ref:'LINE'}
    ]
  },
  {
    preset_id:'WEALTH_RISK', title:'Капитал и финансовая устойчивость',
    description:'Капитал, ликвидность, резерв и сценарные риски в одном экспертном представлении без превращения cash flow в balance truth.',
    base_preset_id:'NET_WORTH', required_capabilities:[CAP.SAVED,CAP.COMPOSER,CAP.WIDGET_FACTORY,CAP.RISK,CAP.ADV_VIZ],
    panels:[
      {panel_id:'wealth-overview', title:'Капитал', kind:'SAVED_VIEW', source_contract:CAP.SAVED, semantic_ref:'NET_WORTH_CONFIGURATION', visual_ref:'KPI_GRID'},
      {panel_id:'liquidity-risk', title:'Ликвидность и риск', kind:'RISK', source_contract:CAP.RISK, semantic_ref:'LIQUIDITY_SCENARIO', visual_ref:'RISK_MATRIX'}
    ]
  },
  {
    preset_id:'FINANCIAL_HEALTH_XRAY', title:'Финансовый рентген семьи',
    description:'Объяснимые findings Financial Health X-Ray с severity, provenance и drill-through; gallery не вычисляет правила самостоятельно.',
    base_preset_id:'RISK', required_capabilities:[CAP.SAVED,CAP.COMPOSER,CAP.WIDGET_FACTORY,CAP.XRAY,CAP.ADV_VIZ],
    panels:[
      {panel_id:'xray-findings', title:'Главные сигналы', kind:'XRAY', source_contract:CAP.XRAY, semantic_ref:'TYPED_FINDINGS', visual_ref:'FINDING_LIST'},
      {panel_id:'xray-drill', title:'Причины и детали', kind:'XRAY', source_contract:CAP.XRAY, semantic_ref:'DRILL_METADATA', visual_ref:'DRILL_TABLE'}
    ]
  }
]);

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'DASH-090' ||
      CONTRACT.preset_schema !== PRESET_SCHEMA || CONTRACT.availability_schema !== AVAILABILITY_SCHEMA || CONTRACT.clone_schema !== CLONE_SCHEMA) fail('DASH090_CONTRACT_INVALID');
  SAVED.assertContract(); COMPOSER.assertContract();
  const expected = {
    saved_views:CAP.SAVED, dashboard_composer:CAP.COMPOSER, widget_factory:CAP.WIDGET_FACTORY, contribution_decomposition:CAP.DECOMP, seasonality_distribution_concentration:CAP.SDC,
    long_term_trends:CAP.TRENDS, liquidity_financial_risk:CAP.RISK, financial_health_xray:CAP.XRAY,
    advanced_visualization_pack:CAP.ADV_VIZ, financial_truth_policy:'FIN-TRUTH-v1'
  };
  if (stableStringify(CONTRACT.upstream) !== stableStringify(expected)) fail('DASH090_UPSTREAM_CONTRACT_INVALID');
  if (stableStringify(CONTRACT.preset_order) !== stableStringify(BLUEPRINTS.map((p) => p.preset_id))) fail('DASH090_PRESET_ORDER_INVALID');
  const p = CONTRACT.principles || {};
  if (p.configuration_only !== true || p.catalog_immutable !== true || p.clone_to_saved_views_only !== true || p.separate_storage_engine_allowed !== false ||
      p.query_execution_authority !== false || p.financial_formula_authority !== false || p.financial_write_authority !== false ||
      p.financial_payload_in_catalog_allowed !== false || p.private_filter_values_in_catalog_allowed !== false || p.capability_fail_closed !== true ||
      p.warm_mandatory_network_read !== false || p.free_only !== true) fail('DASH090_BOUNDARY_INVALID');
  if (!CONTRACT.authority || Object.values(CONTRACT.authority).some((value) => value !== false)) fail('DASH090_AUTHORITY_INVALID');
  if (BLUEPRINTS.length > CONTRACT.limits.max_presets || new Set(BLUEPRINTS.map((x) => x.preset_id)).size !== BLUEPRINTS.length) fail('DASH090_PRESET_CATALOG_INVALID');
  return true;
}

function normalizePreset(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('DASH090_PRESET_INVALID');
  const id = String(raw.preset_id || '').toUpperCase(); if (!ID_RE.test(id)) fail('DASH090_PRESET_ID_INVALID');
  if (!SAVED.PRESET_IDS.includes(raw.base_preset_id)) fail('DASH090_BASE_PRESET_INVALID', id);
  const title = safeText(raw.title, CONTRACT.limits.max_title_length, 'DASH090_TITLE_INVALID');
  const description = safeText(raw.description, CONTRACT.limits.max_description_length, 'DASH090_DESCRIPTION_INVALID');
  if (!Array.isArray(raw.required_capabilities) || raw.required_capabilities.length < 1 || raw.required_capabilities.length > CONTRACT.limits.max_capabilities_per_preset) fail('DASH090_CAPABILITIES_INVALID');
  const required = raw.required_capabilities.map(String);
  if (new Set(required).size !== required.length || required.some((item) => !CAPABILITY_RE.test(item))) fail('DASH090_CAPABILITIES_INVALID');
  if (!Array.isArray(raw.panels) || raw.panels.length < 1 || raw.panels.length > CONTRACT.limits.max_panels_per_preset) fail('DASH090_PANELS_INVALID');
  const panels = raw.panels.map((panel) => {
    const keys = Object.keys(panel).sort();
    if (stableStringify(keys) !== stableStringify(['kind','panel_id','title','semantic_ref','source_contract','visual_ref'].sort())) fail('DASH090_PANEL_SHAPE_INVALID');
    if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(String(panel.panel_id || '')) || !required.includes(String(panel.source_contract || ''))) fail('DASH090_PANEL_INVALID');
    return deepFreeze({panel_id:String(panel.panel_id),title:safeText(panel.title,80,'DASH090_PANEL_TITLE_INVALID'),kind:String(panel.kind),source_contract:String(panel.source_contract),semantic_ref:String(panel.semantic_ref),visual_ref:String(panel.visual_ref)});
  });
  const body = deepFreeze({schema:PRESET_SCHEMA,contract_version:VERSION,preset_id:id,title,description,base_preset_id:raw.base_preset_id,required_capabilities:deepFreeze(required.slice()),panels:deepFreeze(panels),cloneable:true,editable_after_clone:true,financial_payload:false,private_filters:false});
  assertNoPrivatePayload(body);
  return deepFreeze({...body,preset_hash:sha256(stableStringify(body))});
}

const PRESETS = deepFreeze(BLUEPRINTS.map(normalizePreset));
function presetById(id) { const key=String(id||'').toUpperCase(); const item=PRESETS.find((p)=>p.preset_id===key); if(!item) fail('DASH090_PRESET_UNKNOWN'); return item; }
function catalog() { return PRESETS; }
function normalizeCapabilities(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('DASH090_CAPABILITY_STATE_INVALID');
  const output = {};
  for (const [key,value] of Object.entries(input)) {
    if (!CAPABILITY_RE.test(key) || !['AVAILABLE','DEGRADED','UNAVAILABLE'].includes(String(value))) fail('DASH090_CAPABILITY_STATE_INVALID',key);
    output[key]=String(value);
  }
  return output;
}
function availability(presetId, capabilityState) {
  const preset=presetById(presetId), state=normalizeCapabilities(capabilityState);
  const missing=preset.required_capabilities.filter((cap)=>state[cap]!=='AVAILABLE');
  const body={schema:AVAILABILITY_SCHEMA,contract_version:VERSION,preset_id:preset.preset_id,status:missing.length?'UNAVAILABLE':'AVAILABLE',reason:missing.length?'REQUIRED_CAPABILITY_NOT_AVAILABLE':'OK',missing_capabilities:deepFreeze(missing.slice()),preset_hash:preset.preset_hash};
  return deepFreeze(body);
}
function allAvailableCapabilities() { const result={}; Object.values(CAP).forEach((cap)=>{result[cap]='AVAILABLE';}); return deepFreeze(result); }
function projectionId(presetId) { return `expert-v1-${presetById(presetId).preset_id.toLowerCase().replace(/_/g,'-')}`; }
function projectToSavedConfiguration(presetId) {
  const preset=presetById(presetId);
  const widgets=preset.panels.map((panel,index)=>({
    schema:COMPOSER.WIDGET_SCHEMA, id:`w-${String(index+1).padStart(4,'0')}`,
    title:panel.title, semantic_binding_status:'UNBOUND',
    geometry:{x:(index%2)*6,y:Math.floor(index/2)*3,w:6,h:3}
  }));
  const normalized=SAVED.normalizeConfiguration({
    schema:SAVED.CONFIG_SCHEMA, contract_version:SAVED.VERSION,
    dashboard_spec:{schema:COMPOSER.SPEC_SCHEMA,version:COMPOSER.VERSION,id:projectionId(preset.preset_id),title:preset.title,widgets},
    bound_widgets:[]
  });
  return deepFreeze({schema:normalized.schema,contract_version:normalized.contract_version,dashboard_spec:normalized.dashboard_spec,bound_widgets:normalized.bound_widgets});
}
function presetFromConfiguration(configurationInput) {
  const configuration=SAVED.normalizeConfiguration(configurationInput);
  const id=String(configuration.dashboard_spec.id||'');
  const prefix='expert-v1-';
  if (!id.startsWith(prefix)) fail('DASH090_CONFIGURATION_NOT_EXPERT');
  const presetId=id.slice(prefix.length).replace(/-/g,'_').toUpperCase();
  const preset=presetById(presetId);
  if (projectionId(preset.preset_id)!==id) fail('DASH090_CONFIGURATION_PROJECTION_REF_INVALID');
  return preset;
}
function cloneToSavedView(storeInput,presetId,{view_id,name}={},expectedGeneration,capabilityState) {
  const preset=presetById(presetId); const ready=availability(preset.preset_id, capabilityState);
  if (ready.status!=='AVAILABLE') fail('DASH090_PRESET_UNAVAILABLE', ready.missing_capabilities.join(','));
  const configuration=projectToSavedConfiguration(preset.preset_id);
  const op=SAVED.createView(storeInput,{view_id,name:name||preset.title,configuration,origin_preset_id:null},expectedGeneration);
  const view=op.store.views.find((item)=>item.view_id===op.view_id);
  if (!view) fail('DASH090_CLONE_VIEW_READBACK_MISSING');
  const revision=view.revisions[view.active_revision-1];
  if (presetFromConfiguration(revision.configuration).preset_id!==preset.preset_id) fail('DASH090_CLONE_PROJECTION_MISMATCH');
  const body={schema:CLONE_SCHEMA,contract_version:VERSION,preset_id:preset.preset_id,preset_hash:preset.preset_hash,view_id:view.view_id,view_hash:view.view_hash,decision:'APPLIED',reason:'OK',saved_views_action:op.action,storage_authority:'DASH-084'};
  return deepFreeze({...body,store:op.store,view,revision});
}
function telemetry(presetId,action,decision='ALLOW',reason='OK') {
  const preset=presetById(presetId); const out={schema:SCHEMA,version:VERSION,preset_id:preset.preset_id,preset_hash_prefix:preset.preset_hash.slice(0,12),action:String(action||'').toUpperCase(),decision:String(decision||'').toUpperCase(),reason:String(reason||'').toUpperCase(),required_capability_count:preset.required_capabilities.length};
  if (stableStringify(Object.keys(out).sort())!==stableStringify(CONTRACT.telemetry_allowlist.slice().sort())) fail('DASH090_TELEMETRY_SHAPE_INVALID');
  return deepFreeze(out);
}

assertContract();
module.exports=deepFreeze({CONTRACT,SCHEMA,VERSION,PRESET_SCHEMA,AVAILABILITY_SCHEMA,CLONE_SCHEMA,CAP,PRESETS,assertContract,assertNoPrivatePayload,presetById,catalog,availability,allAvailableCapabilities,projectionId,projectToSavedConfiguration,presetFromConfiguration,cloneToSavedView,telemetry,stableStringify});
