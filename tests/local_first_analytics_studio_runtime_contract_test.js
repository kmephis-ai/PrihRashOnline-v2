'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const semantic = require('../lib/analytics/semantic_registry');

const root = path.resolve(__dirname, '..');
const extension = fs.readFileSync(path.join(root, 'LocalFirstVisualizationSpaExtension.html'), 'utf8');
const financeRuntime = fs.readFileSync(path.join(root, 'pwa/local_finance_runtime.js'), 'utf8');

semantic.assertRegistryContract();

const expenseCategory = semantic.validateSemanticSelection({
  measures: [{ id: 'EXPENSE', aggregation: 'SUM' }],
  dimensions: ['category_id'],
  grain: 'NONE'
});
assert.strictEqual(expenseCategory.decision, 'ALLOW');

const incomeCategory = semantic.validateSemanticSelection({
  measures: [{ id: 'INCOME', aggregation: 'SUM' }],
  dimensions: ['category_id'],
  grain: 'NONE'
});
assert.strictEqual(incomeCategory.decision, 'ALLOW');

const cashFlowMonth = semantic.validateSemanticSelection({
  measures: [{ id: 'CASH_FLOW', aggregation: 'SUM' }],
  dimensions: [],
  grain: 'MONTH'
});
assert.strictEqual(cashFlowMonth.decision, 'ALLOW');

assert(extension.includes('data-prh-local-first-analytics-studio="1.0.0"'));
assert(extension.includes("SCHEMA='PRH_LOCAL_ANALYTICS_STUDIO_WIDGET_V1'"));
assert(extension.includes("'expense-category'"));
assert(extension.includes("semanticMeasure:'EXPENSE'"));
assert(extension.includes("semanticDimension:'category_id'"));
assert(extension.includes("semanticMeasure:'INCOME'"));
assert(extension.includes("semanticMeasure:'CASH_FLOW'"));
assert(extension.includes("semanticDimension:'time_bucket'"));
assert(extension.includes("grain:'MONTH'"));
assert(!extension.includes('measure.outflow'));
assert(!extension.includes('measure.inflow'));
assert(!extension.includes('measure.net_change'));
assert(!extension.includes('dim.category'));
assert(!extension.includes('dim.month'));

assert(extension.includes('window.__PRH_LF_FINANCE_RUNTIME__'));
assert(extension.includes("typeof runtime.setRoute==='function'"));
assert(extension.includes("typeof runtime.setFilterContext==='function'"));
assert(extension.includes("result.schema!=='PRH_ANALYTICS_RESULT_V1'"));
assert(extension.includes("result.provenance.financial_truth_policy!=='FIN-TRUTH-v1'"));
assert(extension.includes('STUDIO_UNBOUND_TEMPLATE_REJECTED'));
assert(extension.includes('STUDIO_VERIFIED_SNAPSHOT_REQUIRED'));
assert(extension.includes('STUDIO_SAVED_QUERY_IDENTITY_MISMATCH'));
assert(extension.includes('parent_query_hash:activeWidget.query_identity'));
assert(extension.includes('private ID не сохраняется'));

assert(extension.includes("STORAGE_KEY='prh.localAnalyticsStudio.widget.v1'"));
assert(extension.includes('localStorage.setItem(STORAGE_KEY,JSON.stringify(safe))'));
assert(extension.includes('filter_context|query_identity|schema|semantic_binding|template_id|version|visualization'));
assert(extension.includes('Object.freeze({currency:safe.currency,start:safe.start,end:safe.end})'));
assert(!extension.includes('localStorage.setItem(STORAGE_KEY,JSON.stringify(result'));
assert(!extension.includes('localStorage.setItem(STORAGE_KEY,JSON.stringify(view'));

assert(extension.includes("privacyMode()!=='NORMAL'"));
assert(extension.includes('STUDIO_PRIVACY_RESTRICTED'));
assert(extension.includes("url.hash='studio'"));
assert(extension.includes("String(location.hash||'').toLowerCase()==='#studio'"));
assert(extension.includes('history.pushState({prhLfStudio:true}'));
assert(extension.includes('history.replaceState(history.state||{}'));
assert(extension.includes("studioLink.textContent='Аналитика'"));
assert(extension.includes('aria-live="polite"'));
assert(extension.includes('@media(max-width:600px)'));
assert(extension.includes('lf-studio-table'));
assert(extension.includes('aria-hidden="true"'));

assert(!/\bfetch\s*\(/.test(extension));
assert(!/XMLHttpRequest\s*\(/.test(extension));
assert(!/google\.script\.run/.test(extension));
assert(!/https?:\/\//i.test(extension));

assert(financeRuntime.includes("var ANALYTICS_QUERY_SCHEMA = 'PRH_ANALYTICS_QUERY_V1'"));
assert(financeRuntime.includes("measures: ['EXPENSE']"));
assert(financeRuntime.includes("dimensions: ['category_id']"));
assert(financeRuntime.includes("measures: ['INCOME']"));
assert(financeRuntime.includes("measures: ['CASH_FLOW'], grain: 'MONTH'"));
assert(financeRuntime.includes("financial_truth_policy: 'FIN-TRUTH-v1'"));

console.log('local_first_analytics_studio_runtime_contract_test: OK', {
  bindings: ['EXPENSE/category_id', 'INCOME/category_id', 'CASH_FLOW/MONTH'],
  execution: 'EXISTING_LOCAL_FIRST_CANONICAL_WORKER',
  persistence: 'CONFIG_ONLY',
  drill: 'LINEAGE_BOUND_PRIVATE_ID_NOT_PERSISTED',
  privacy: 'FAIL_CLOSED',
  warmNetworkRequired: false,
  financialWriteAuthority: false
});
