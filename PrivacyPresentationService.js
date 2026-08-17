/**
 * PRIV-080 runtime presentation boundary for the private Apps Script Web App.
 *
 * This module owns no authorization and no financial truth. It transforms an
 * already-authorized presentation view before HTML serialization. DEMO never
 * accepts private input. MASKED/ZEN remove sensitive payload before DOM render.
 */
var PRH_PRIVACY_PRESENTATION_RUNTIME = Object.freeze({
  SCHEMA: 'PRH_PRIVACY_PRESENTATION_V1',
  VERSION: '1.0.0',
  MODES: Object.freeze(['NORMAL', 'MASKED', 'DEMO', 'ZEN']),
  DEFAULT_MODE: 'NORMAL',
  INVALID_FAIL_SAFE: 'MASKED',
  PRIVATE_SOURCE: 'PRIVATE_AUTHORIZED_PRESENTATION',
  SYNTHETIC_SOURCE: 'PUBLIC_SYNTHETIC',
  URL_PARAMETER: 'privacy',
  SECURITY_BOUNDARY: false,
  AUTHORIZATION_BOUNDARY: false,
  FINANCIAL_WRITE: false,
  FREE_ONLY: true
});

var PRH_PRIVACY_SENSITIVE_EXACT_ = Object.freeze([
  'amount', 'amount_minor', 'value', 'value_minor', 'income', 'income_minor', 'expense', 'expense_minor',
  'cash_flow', 'cash_flow_minor', 'budget', 'budget_minor', 'balance', 'balance_minor', 'savings', 'savings_minor',
  'net_worth', 'net_worth_minor', 'variance', 'variance_minor', 'reference_minor', 'delta_minor', 'target_minor',
  'transaction_id', 'account_id', 'account_name', 'category_id', 'category_name', 'member_id', 'member_name',
  'project_id', 'project_name', 'counterparty', 'description', 'note', 'comment', 'merchant', 'tag', 'tags'
]);
var PRH_PRIVACY_SENSITIVE_SUFFIXES_ = Object.freeze([
  '_amount', '_amount_minor', '_value', '_value_minor', '_balance', '_balance_minor', '_minor'
]);
var PRH_PRIVACY_ZEN_SAFE_ = Object.freeze([
  'schema', 'version', 'contract_version', 'state', 'status', 'reason', 'kind', 'type', 'currency',
  'count', 'total_count', 'row_count', 'alert_count', 'configured', 'available', 'partial', 'synthetic_only',
  'provenance', 'financial_truth_policy', 'mode', 'source'
]);

function prhPrivacyResolveMode_(value) {
  var raw = String(value == null ? '' : value).trim().toUpperCase();
  if (!raw) return PRH_PRIVACY_PRESENTATION_RUNTIME.DEFAULT_MODE;
  if (PRH_PRIVACY_PRESENTATION_RUNTIME.MODES.indexOf(raw) >= 0) return raw;
  return PRH_PRIVACY_PRESENTATION_RUNTIME.INVALID_FAIL_SAFE;
}

function prhPrivacyClone_(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(prhPrivacyClone_);
  var output = {};
  Object.keys(value).forEach(function(key) {
    output[key] = prhPrivacyClone_(value[key]);
  });
  return output;
}

function prhPrivacySensitiveKey_(key) {
  var normalized = String(key || '').toLowerCase();
  if (PRH_PRIVACY_SENSITIVE_EXACT_.indexOf(normalized) >= 0) return true;
  return PRH_PRIVACY_SENSITIVE_SUFFIXES_.some(function(suffix) {
    return normalized.slice(-suffix.length) === suffix;
  });
}

function prhPrivacyZenSafeKey_(key) {
  var normalized = String(key || '').toLowerCase();
  if (PRH_PRIVACY_ZEN_SAFE_.indexOf(normalized) >= 0) return true;
  return /_(count|available|configured)$/.test(normalized);
}

function prhPrivacyMask_(value, evidence) {
  if (Array.isArray(value)) {
    evidence.suppressed_count += value.length || 1;
    return [];
  }
  if (!value || typeof value !== 'object') return value;
  var output = {};
  Object.keys(value).forEach(function(key) {
    var child = value[key];
    evidence.field_count += 1;
    if (prhPrivacySensitiveKey_(key)) {
      if (Array.isArray(child)) {
        evidence.suppressed_count += child.length || 1;
        output[key] = [];
      } else if (child && typeof child === 'object') {
        output[key] = prhPrivacyMask_(child, evidence);
      } else {
        evidence.suppressed_count += 1;
        output[key] = null;
      }
      return;
    }
    output[key] = prhPrivacyMask_(child, evidence);
  });
  return output;
}

function prhPrivacyZen_(value, evidence, keyHint) {
  if (Array.isArray(value)) {
    if (keyHint && !prhPrivacyZenSafeKey_(keyHint)) {
      evidence.suppressed_count += value.length || 1;
      return [];
    }
    return value.map(function(item) { return prhPrivacyZen_(item, evidence, keyHint); });
  }
  if (!value || typeof value !== 'object') return value;
  var output = {};
  Object.keys(value).forEach(function(key) {
    evidence.field_count += 1;
    if (prhPrivacySensitiveKey_(key) || !prhPrivacyZenSafeKey_(key)) {
      evidence.suppressed_count += 1;
      return;
    }
    output[key] = prhPrivacyZen_(value[key], evidence, key);
  });
  return output;
}

function prhPrivacyTransform_(payload, mode, source) {
  var normalizedMode = prhPrivacyResolveMode_(mode);
  var normalizedSource = String(source || '').trim().toUpperCase();
  if (normalizedSource !== PRH_PRIVACY_PRESENTATION_RUNTIME.PRIVATE_SOURCE &&
      normalizedSource !== PRH_PRIVACY_PRESENTATION_RUNTIME.SYNTHETIC_SOURCE) {
    throw new Error('PRIV080_SOURCE_INVALID');
  }
  if (normalizedMode === 'DEMO' && normalizedSource !== PRH_PRIVACY_PRESENTATION_RUNTIME.SYNTHETIC_SOURCE) {
    throw new Error('PRIV080_DEMO_PRIVATE_SOURCE_FORBIDDEN');
  }
  var before = JSON.stringify(payload);
  var evidence = { field_count: 0, suppressed_count: 0 };
  var transformed;
  if (normalizedMode === 'NORMAL' || normalizedMode === 'DEMO') transformed = prhPrivacyClone_(payload);
  else if (normalizedMode === 'MASKED') transformed = prhPrivacyMask_(payload, evidence);
  else transformed = prhPrivacyZen_(payload, evidence, null);
  if (JSON.stringify(payload) !== before) throw new Error('PRIV080_SOURCE_MUTATED');
  return Object.freeze({
    schema: 'PRH_PRIVACY_TRANSFORM_RESULT_V1',
    version: PRH_PRIVACY_PRESENTATION_RUNTIME.VERSION,
    mode: normalizedMode,
    source: normalizedSource,
    synthetic_only: normalizedSource === PRH_PRIVACY_PRESENTATION_RUNTIME.SYNTHETIC_SOURCE,
    financial_truth_surface: normalizedMode === 'NORMAL' && normalizedSource === PRH_PRIVACY_PRESENTATION_RUNTIME.PRIVATE_SOURCE,
    security_boundary: false,
    payload: transformed,
    evidence: Object.freeze(evidence)
  });
}

function prhPrivacyDemoCard_(id, minor) {
  return {
    id: id,
    state: 'READY',
    source_kpi: 'PUBLIC_SYNTHETIC_DEMO',
    value_minor: minor,
    currency: 'RUB',
    drill: null
  };
}

function prhPrivacyDemoFinancialHome_() {
  return {
    schema: 'PRH_FINANCIAL_HOME_VIEW_V1',
    contract_version: '1.0.0',
    synthetic_only: true,
    privacy_demo: true,
    currency: 'RUB',
    financial_truth_policy: 'DEMO_SYNTHETIC_NOT_FIN_TRUTH',
    kpi_dictionary_version: '1.0.0',
    period: { kind: 'DEMO_SYNTHETIC_WINDOW', start: '2026-01-01', end: '2026-02-01', partial: false, day_count: 31, proration: 'NONE' },
    filter_context: { schema: 'PRH_FILTER_CONTEXT_V1', contract_version: '1.0.0', filters: [], context_hash: 'PUBLIC_SYNTHETIC_DEMO' },
    cards: {
      INCOME: prhPrivacyDemoCard_('INCOME', 125000),
      EXPENSE: prhPrivacyDemoCard_('EXPENSE', 83000),
      CASH_FLOW: prhPrivacyDemoCard_('CASH_FLOW', 42000),
      SAVINGS: prhPrivacyDemoCard_('SAVINGS', 42000),
      BUDGET: { id: 'BUDGET', state: 'READY', budget_minor: 100000, expense_minor: 83000, variance_minor: 17000, currency: 'RUB', drill: null },
      LIQUIDITY: { id: 'LIQUIDITY', state: 'UNAVAILABLE_PENDING_BALANCE_SOURCE', value_minor: null, currency: 'RUB', reason: 'DEMO_BALANCE_NOT_MODELED', future_dependency: 'NONE', drill: null },
      ALERTS: { id: 'ALERTS', state: 'READY', count: 0, highest_severity: 'NONE', drill: null }
    },
    alerts: [],
    widgets: [],
    visual_data: { cash_flow_minor: [26000, 31000, 28000, 36000, 42000], expense_mix: [['DEMO_HOME', 35000], ['DEMO_FOOD', 28000], ['DEMO_OTHER', 20000]] },
    provenance: {
      financial_values: 'PUBLIC_SYNTHETIC_DEMO',
      source: 'PUBLIC_SYNTHETIC',
      private_runtime_read: false,
      ui_financial_formula_used: false,
      financial_truth: false
    }
  };
}

function prhPrivacyBannerHtml_(mode, source) {
  var normalizedMode = prhPrivacyResolveMode_(mode);
  var label = normalizedMode === 'DEMO' ? 'ДЕМО • PUBLIC_SYNTHETIC • не финансовая истина' :
    normalizedMode === 'MASKED' ? 'Приватность: суммы и чувствительные поля удалены до рендера' :
    normalizedMode === 'ZEN' ? 'Дзен: только безопасное структурное состояние' :
    'Обычный приватный режим';
  return '<aside id="prh-privacy-banner" data-prh-privacy-mode="' + normalizedMode + '" data-security-boundary="false" data-source="' +
    String(source || '') + '" role="status" style="padding:8px 12px;background:#eef6ff;color:#10233f;border-bottom:1px solid #d7e0ea;font:700 12px/1.35 Inter,system-ui,sans-serif">' +
    label + ' • <a href="?surface=studio&mode=studio" style="color:#1558b0">настройки режима</a></aside>';
}

function prhPrivacyDecorateOutput_(output, mode, source, title) {
  var html = output && typeof output.getContent === 'function' ? output.getContent() : '';
  if (!html || html.indexOf('<body') < 0) throw new Error('PRIV080_RENDER_OUTPUT_INVALID');
  var normalizedMode = prhPrivacyResolveMode_(mode);
  var bodyStart = html.indexOf('<body');
  var bodyEnd = html.indexOf('>', bodyStart);
  if (bodyEnd < 0) throw new Error('PRIV080_RENDER_BODY_INVALID');
  var bodyTag = html.slice(bodyStart, bodyEnd + 1);
  var decoratedTag = bodyTag.replace('<body', '<body data-prh-privacy-mode="' + normalizedMode + '" data-prh-privacy-security-boundary="false"');
  html = html.slice(0, bodyStart) + decoratedTag + prhPrivacyBannerHtml_(normalizedMode, source) + html.slice(bodyEnd + 1);
  return HtmlService.createHtmlOutput(html)
    .setTitle(title || 'PrihRashOnline')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function prhPrivacyRenderZen_(result) {
  if (!result || result.mode !== 'ZEN' || result.source !== PRH_PRIVACY_PRESENTATION_RUNTIME.PRIVATE_SOURCE) {
    throw new Error('PRIV080_ZEN_RESULT_INVALID');
  }
  var safe = result.payload || {};
  var status = String(safe.status || safe.state || 'READY');
  var count = safe.alert_count != null ? safe.alert_count : (safe.count != null ? safe.count : null);
  var countHtml = count == null ? '' : '<p>Безопасный структурный счётчик: <strong>' + String(count) + '</strong></p>';
  var html = '<!doctype html><html lang="ru"><head><base target="_top"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><style>*{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#10233f;font:14px/1.5 Inter,system-ui,sans-serif}.zen{max-width:760px;margin:64px auto;padding:18px}.card{background:#fff;border:1px solid #d7e0ea;border-radius:20px;padding:28px;box-shadow:0 8px 24px rgba(16,35,63,.10)}h1{margin:0 0 8px}.pill{display:inline-block;padding:6px 10px;border-radius:999px;background:#eef6ff;color:#1558b0;font-weight:800}@media(prefers-color-scheme:dark){body{background:#0b1220;color:#f3f7fc}.card{background:#111b2c;border-color:#33445d}.pill{background:#142b46;color:#8fc5ff}}</style></head><body data-prh-zen-safe="1"><main class="zen"><section class="card"><span class="pill">ZEN • PRE-RENDER REDACTION</span><h1>Дзен-режим</h1><p>Финансовые суммы, транзакции и частные измерения не переданы в этот HTML.</p><p>Структурное состояние: <strong>' + status + '</strong></p>' + countHtml + '<p><a href="?surface=home&privacy=masked">Перейти в скрытый режим</a> · <a href="?surface=studio&mode=studio">Analytics Studio</a></p></section></main></body></html>';
  var output = HtmlService.createHtmlOutput(html);
  return prhPrivacyDecorateOutput_(output, 'ZEN', PRH_PRIVACY_PRESENTATION_RUNTIME.PRIVATE_SOURCE, 'PrihRashOnline — Дзен');
}
