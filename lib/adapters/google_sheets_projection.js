'use strict';

const CONTRACT = require('./google_sheets_projection.v1.json');
const MAPPING = require('./google_sheets_operations_mapping.v1.json');
const { normalizeQuery } = require('../repository/transaction_repository');

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function assertContract() {
  if (CONTRACT.schema !== 'PRH_GOOGLE_QUERY_PROJECTION_V1' || CONTRACT.version !== '1.0.0' ||
      CONTRACT.roadmap_id !== 'PERF-010') fail('GOOGLE_PROJECTION_CONTRACT_INVALID');
  if (`${MAPPING.schema}@${MAPPING.version}` !== CONTRACT.mapping_schema) {
    fail('GOOGLE_PROJECTION_MAPPING_MISMATCH');
  }
  const mappedHeaders = new Set(MAPPING.required_headers);
  for (const header of CONTRACT.base_query_headers) {
    if (!mappedHeaders.has(header)) fail('GOOGLE_PROJECTION_BASE_HEADER_INVALID', header);
  }
  for (const [key, headers] of Object.entries(CONTRACT.query_filter_headers)) {
    if (!Array.isArray(headers)) fail('GOOGLE_PROJECTION_FILTER_HEADERS_INVALID', key);
    for (const header of headers) {
      if (!mappedHeaders.has(header)) fail('GOOGLE_PROJECTION_FILTER_HEADER_INVALID', `${key}:${header}`);
    }
  }
  return true;
}

function uniqueInMappingOrder(headers) {
  const requested = new Set(headers);
  return Object.freeze(MAPPING.required_headers.filter((header) => requested.has(header)));
}

function queryProjectionHeaders(queryInput = {}) {
  assertContract();
  const query = normalizeQuery(queryInput);
  const headers = CONTRACT.base_query_headers.slice();
  for (const [queryKey, mappedHeaders] of Object.entries(CONTRACT.query_filter_headers)) {
    const value = query[queryKey];
    if (value !== null && value !== undefined) headers.push(...mappedHeaders);
  }
  return uniqueInMappingOrder(headers);
}

function fullProjectionHeaders() {
  assertContract();
  return Object.freeze(MAPPING.required_headers.slice());
}

function normalizeHeaderPositions(headers) {
  if (!Array.isArray(headers) || headers.length === 0) fail('GOOGLE_PROJECTION_HEADERS_INVALID');
  const normalized = headers.map((value) => String(value == null ? '' : value).trim());
  const positions = new Map();
  normalized.forEach((header, index) => {
    if (header && !positions.has(header)) positions.set(header, index + 1);
  });
  return positions;
}

function buildColumnSpans(headers, requiredHeaders) {
  assertContract();
  if (!Array.isArray(requiredHeaders) || requiredHeaders.length === 0) {
    fail('GOOGLE_PROJECTION_REQUIRED_HEADERS_INVALID');
  }
  const allowed = new Set(MAPPING.required_headers);
  const requested = [];
  const seen = new Set();
  for (const raw of requiredHeaders) {
    const header = String(raw == null ? '' : raw).trim();
    if (!allowed.has(header)) fail('GOOGLE_PROJECTION_HEADER_NOT_ALLOWED', header);
    if (seen.has(header)) fail('GOOGLE_PROJECTION_HEADER_DUPLICATE', header);
    seen.add(header);
    requested.push(header);
  }
  const positions = normalizeHeaderPositions(headers);
  const located = requested.map((header) => {
    const column = positions.get(header);
    if (!column) fail('GOOGLE_PROJECTION_HEADER_MISSING', header);
    return { header, column };
  }).sort((a, b) => a.column - b.column);

  const spans = [];
  for (const item of located) {
    const previous = spans[spans.length - 1];
    if (previous && item.column === previous.end_column + 1) {
      previous.end_column = item.column;
      previous.width += 1;
      previous.headers.push(item.header);
    } else {
      spans.push({
        start_column: item.column,
        end_column: item.column,
        width: 1,
        headers: [item.header]
      });
    }
  }
  return Object.freeze(spans.map((span) => Object.freeze({
    start_column: span.start_column,
    end_column: span.end_column,
    width: span.width,
    headers: Object.freeze(span.headers.slice())
  })));
}

function groupConsecutiveRows(rowNumbers) {
  if (!Array.isArray(rowNumbers)) fail('GOOGLE_PROJECTION_ROW_NUMBERS_INVALID');
  if (rowNumbers.length === 0) return Object.freeze([]);
  const sorted = rowNumbers.map((value) => Number(value)).sort((a, b) => a - b);
  if (sorted.some((value) => !Number.isInteger(value) || value < 2)) {
    fail('GOOGLE_PROJECTION_ROW_NUMBER_INVALID');
  }
  if (new Set(sorted).size !== sorted.length) fail('GOOGLE_PROJECTION_ROW_NUMBER_DUPLICATE');
  const groups = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    if (current === previous + 1) {
      previous = current;
      continue;
    }
    groups.push({ start_row: start, row_count: previous - start + 1 });
    start = current;
    previous = current;
  }
  groups.push({ start_row: start, row_count: previous - start + 1 });
  return Object.freeze(groups.map((group) => Object.freeze(group)));
}

function projectionTelemetry(requiredHeaders, spans, rowCount) {
  if (!Array.isArray(requiredHeaders) || !Array.isArray(spans) ||
      !Number.isInteger(rowCount) || rowCount < 0) fail('GOOGLE_PROJECTION_TELEMETRY_INPUT_INVALID');
  const projectedColumns = spans.reduce((sum, span) => sum + span.width, 0);
  return Object.freeze({
    projection_id: 'PRH_GOOGLE_QUERY_PROJECTION_V1',
    requested_header_count: requiredHeaders.length,
    projected_column_count: projectedColumns,
    column_span_count: spans.length,
    row_count: rowCount,
    range_read_count: spans.length,
    cell_read_count: projectedColumns * rowCount
  });
}

module.exports = {
  CONTRACT,
  assertContract,
  queryProjectionHeaders,
  fullProjectionHeaders,
  buildColumnSpans,
  groupConsecutiveRows,
  projectionTelemetry
};
