'use strict';

const viz = require('./visualization_foundation');

const SCHEMA = 'PRH_HOUSEHOLD_VISUAL_PROJECTION_V1';
const VERSION = '1.0.0';
const DEFAULT_EXPENSE_TOP_N = 6;
const MONTH_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function safeInteger(value, reason) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) fail(reason);
  return number;
}

function periodKey(period) {
  if (!period || typeof period !== 'object' || Array.isArray(period)) fail('VIZ_HOUSEHOLD_PERIOD_INVALID');
  const start = String(period.start || '');
  const end = String(period.end || '');
  if (!MONTH_RE.test(start) || !MONTH_RE.test(end) || start >= end) fail('VIZ_HOUSEHOLD_PERIOD_INVALID');
  return start.slice(0, 7);
}

function cashFlowRenderDataset(periodResults) {
  if (!Array.isArray(periodResults)) fail('VIZ_HOUSEHOLD_CASH_FLOW_PERIODS_INVALID');
  const seen = new Set();
  const normalized = periodResults.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail('VIZ_HOUSEHOLD_CASH_FLOW_PERIOD_INVALID');
    const key = periodKey(item.period);
    if (seen.has(key)) fail('VIZ_HOUSEHOLD_CASH_FLOW_PERIOD_DUPLICATE');
    seen.add(key);
    return {
      key,
      start: String(item.period.start),
      cash_flow_minor: safeInteger(item.cash_flow_minor, 'VIZ_HOUSEHOLD_CASH_FLOW_VALUE_INVALID')
    };
  }).sort((a, b) => a.start.localeCompare(b.start));

  return viz.normalizeRenderDataset({
    schema: viz.RENDER_DATASET_SCHEMA,
    contract_version: viz.VERSION,
    rows: normalized.map((item) => ({
      dimensions: { time_bucket: item.key },
      measures: { CASH_FLOW: item.cash_flow_minor }
    }))
  });
}

function normalizeExpenseEntries(entries) {
  if (!Array.isArray(entries)) fail('VIZ_HOUSEHOLD_EXPENSE_MIX_INVALID');
  const seen = new Set();
  return entries.map((entry) => {
    if (!Array.isArray(entry) || entry.length !== 2) fail('VIZ_HOUSEHOLD_EXPENSE_ENTRY_INVALID');
    const label = String(entry[0] == null ? '' : entry[0]).trim();
    const valueMinor = safeInteger(entry[1], 'VIZ_HOUSEHOLD_EXPENSE_VALUE_INVALID');
    if (!label || label.length > 128 || valueMinor < 0) fail('VIZ_HOUSEHOLD_EXPENSE_ENTRY_INVALID');
    if (seen.has(label)) fail('VIZ_HOUSEHOLD_EXPENSE_LABEL_DUPLICATE');
    seen.add(label);
    return { label, value_minor: valueMinor };
  }).filter((entry) => entry.value_minor > 0)
    .sort((a, b) => b.value_minor - a.value_minor || a.label.localeCompare(b.label, 'ru'));
}

function topNExpenseMix(entries, topN = DEFAULT_EXPENSE_TOP_N) {
  const limit = Number(topN);
  if (!Number.isInteger(limit) || limit < 1 || limit > 12) fail('VIZ_HOUSEHOLD_EXPENSE_TOP_N_INVALID');
  const normalized = normalizeExpenseEntries(entries);
  if (normalized.length <= limit) {
    return Object.freeze(normalized.map((entry) => Object.freeze({ ...entry, source_count: 1 })));
  }
  const visible = normalized.slice(0, limit).map((entry) => Object.freeze({ ...entry, source_count: 1 }));
  const omitted = normalized.slice(limit);
  const otherMinor = omitted.reduce((sum, entry) => {
    const next = sum + entry.value_minor;
    if (!Number.isSafeInteger(next)) fail('VIZ_HOUSEHOLD_EXPENSE_OTHER_RANGE_INVALID');
    return next;
  }, 0);
  visible.push(Object.freeze({ label: 'Прочее', value_minor: otherMinor, source_count: omitted.length }));
  return Object.freeze(visible);
}

function expenseMixRenderDataset(entries, topN = DEFAULT_EXPENSE_TOP_N) {
  const shaped = topNExpenseMix(entries, topN);
  return viz.normalizeRenderDataset({
    schema: viz.RENDER_DATASET_SCHEMA,
    contract_version: viz.VERSION,
    rows: shaped.map((entry) => ({
      dimensions: { category_id: entry.label },
      measures: { EXPENSE: entry.value_minor }
    }))
  });
}

function compileHouseholdChart(chartSpec, dataset) {
  return viz.compileEChartsOption(chartSpec, dataset);
}

module.exports = Object.freeze({
  SCHEMA,
  VERSION,
  DEFAULT_EXPENSE_TOP_N,
  cashFlowRenderDataset,
  topNExpenseMix,
  expenseMixRenderDataset,
  compileHouseholdChart
});
