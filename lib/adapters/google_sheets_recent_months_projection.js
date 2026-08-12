'use strict';

const googleAdapter = require('./google_sheets_transaction_repository');
const { groupConsecutiveRows } = require('./google_sheets_projection');
const { compareTransactions } = require('../repository/transaction_repository');
const { validateCanonicalCollection } = require('../domain/canonical_transaction');

const SCHEMA = 'PRH_GOOGLE_RECENT_MONTHS_SNAPSHOT_V1';
const VERSION = '1.0.0';
const DEFAULT_PERIOD_COUNT = 6;
const MAX_PERIOD_COUNT = 24;
const TIMELINE_HEADERS = Object.freeze(['ID', 'Дата и время']);
const FULL_HEADERS = Object.freeze(googleAdapter.MAPPING.required_headers.slice());

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function normalizePeriodCount(value) {
  const count = value == null ? DEFAULT_PERIOD_COUNT : Number(value);
  if (!Number.isInteger(count) || count < 1 || count > MAX_PERIOD_COUNT) {
    fail('GOOGLE_RECENT_MONTHS_COUNT_INVALID');
  }
  return count;
}

function normalizeSnapshot(snapshot, requiredHeaders) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    fail('GOOGLE_RECENT_MONTHS_GATEWAY_SNAPSHOT_INVALID');
  }
  if (snapshot.schema !== 'PRH_GOOGLE_OPERATIONS_TABLE_V1' ||
      snapshot.sheet_name !== googleAdapter.MAPPING.sheet_name ||
      !Array.isArray(snapshot.headers) || !Array.isArray(snapshot.rows)) {
    fail('GOOGLE_RECENT_MONTHS_GATEWAY_SNAPSHOT_INVALID');
  }
  const startRow = snapshot.start_row == null ? 2 : Number(snapshot.start_row);
  if (!Number.isInteger(startRow) || startRow < 2) fail('GOOGLE_RECENT_MONTHS_START_ROW_INVALID');
  googleAdapter.normalizeHeaderIndex(snapshot.headers, requiredHeaders);
  return Object.freeze({
    headers: snapshot.headers,
    rows: snapshot.rows,
    start_row: startRow
  });
}

function monthPeriod(monthKey) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ''));
  if (!match) fail('GOOGLE_RECENT_MONTHS_KEY_INVALID');
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) fail('GOOGLE_RECENT_MONTHS_KEY_INVALID');
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return Object.freeze({
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    partial: false
  });
}

function readRecentCalendarMonths(gateway, options = {}, periodCount = DEFAULT_PERIOD_COUNT) {
  if (!gateway || typeof gateway.readOperationsTable !== 'function') {
    fail('GOOGLE_RECENT_MONTHS_GATEWAY_REQUIRED');
  }
  const count = normalizePeriodCount(periodCount);
  const config = {
    default_currency: String(options.default_currency || ''),
    resolvers: options.resolvers || {}
  };
  if (!/^[A-Z]{3}$/.test(config.default_currency)) fail('GOOGLE_ADAPTER_DEFAULT_CURRENCY_REQUIRED');

  const timeline = normalizeSnapshot(
    gateway.readOperationsTable({ required_headers: TIMELINE_HEADERS.slice() }),
    TIMELINE_HEADERS
  );
  const timelineIndex = googleAdapter.normalizeHeaderIndex(timeline.headers, TIMELINE_HEADERS);
  const ids = new Set();
  const candidates = [];
  const observedMonths = new Set();

  timeline.rows.forEach((row, offset) => {
    if (!Array.isArray(row)) fail('GOOGLE_RECENT_MONTHS_TIMELINE_ROW_INVALID');
    const transactionId = String(row[timelineIndex.ID] == null ? '' : row[timelineIndex.ID]).trim();
    if (!transactionId) return;
    if (ids.has(transactionId)) fail('GOOGLE_ADAPTER_TRANSACTION_ID_DUPLICATE');
    ids.add(transactionId);
    const occurredAt = googleAdapter.toRfc3339(row[timelineIndex['Дата и время']]);
    const monthKey = occurredAt.slice(0, 7);
    observedMonths.add(monthKey);
    candidates.push(Object.freeze({
      row_number: timeline.start_row + offset,
      transaction_id: transactionId,
      month_key: monthKey
    }));
  });

  const allMonthKeys = Array.from(observedMonths).sort();
  const selectedMonthKeys = allMonthKeys.slice(Math.max(0, allMonthKeys.length - count));
  const selectedKeySet = new Set(selectedMonthKeys);
  const selected = candidates.filter((candidate) => selectedKeySet.has(candidate.month_key));
  const selectedIds = new Set(selected.map((candidate) => candidate.transaction_id));
  const byId = new Map();

  for (const group of groupConsecutiveRows(selected.map((candidate) => candidate.row_number))) {
    const full = normalizeSnapshot(gateway.readOperationsTable({
      required_headers: FULL_HEADERS.slice(),
      start_row: group.start_row,
      row_count: group.row_count
    }), FULL_HEADERS);
    const fullIndex = googleAdapter.normalizeHeaderIndex(full.headers, FULL_HEADERS);
    full.rows.forEach((row, offset) => {
      const tx = googleAdapter.rowToCanonical(row, full.start_row + offset, fullIndex, config);
      if (tx && selectedIds.has(tx.transaction_id)) byId.set(tx.transaction_id, tx);
    });
  }

  const transactionsByMonth = new Map(selectedMonthKeys.map((key) => [key, []]));
  selected.forEach((candidate) => {
    const tx = byId.get(candidate.transaction_id);
    if (!tx) fail('GOOGLE_ADAPTER_SELECTED_ROW_READBACK_MISSING');
    transactionsByMonth.get(candidate.month_key).push(tx);
  });

  const periods = selectedMonthKeys.map((monthKey) => {
    const items = transactionsByMonth.get(monthKey).slice().sort(compareTransactions);
    validateCanonicalCollection(items);
    return Object.freeze({
      month_key: monthKey,
      period: monthPeriod(monthKey),
      items: Object.freeze(items)
    });
  });

  return Object.freeze({
    schema: SCHEMA,
    contract_version: VERSION,
    requested_period_count: count,
    available_period_count: periods.length,
    observed_period_count: allMonthKeys.length,
    complete: periods.length === count,
    periods: Object.freeze(periods)
  });
}

module.exports = Object.freeze({
  SCHEMA,
  VERSION,
  DEFAULT_PERIOD_COUNT,
  MAX_PERIOD_COUNT,
  TIMELINE_HEADERS,
  FULL_HEADERS,
  normalizePeriodCount,
  monthPeriod,
  readRecentCalendarMonths
});
