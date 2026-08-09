'use strict';

/**
 * ARCH-011 / PERF-010 Apps Script gateway for the current Google Sheets
 * transaction store.
 *
 * Boundary rules:
 * - functions ending with `_` are internal gateway helpers and must never be
 *   exposed as public finance-data Execution API endpoints;
 * - Google-specific services stay outside the pure domain/application core;
 * - canonical financial writes remain fail-closed;
 * - PERF-010 may discover the complete header row, but data rows are read only
 *   through requested mapped column spans and a bounded row interval.
 */
var PRH_GOOGLE_REPOSITORY_GATEWAY = Object.freeze({
  SCHEMA: 'PRH_GOOGLE_REPOSITORY_GATEWAY_V1',
  VERSION: '1.1.0',
  TABLE_SCHEMA: 'PRH_GOOGLE_OPERATIONS_TABLE_V1',
  PROJECTION_SCHEMA: 'PRH_GOOGLE_PROJECTED_READ_V1',
  MAPPING_VERSION: '1.0.0',
  REQUIRED_HEADERS: Object.freeze([
    'ID', 'Дата и время', 'Тип', 'Сумма', 'Счёт', 'Счёт назначения',
    'Категория', 'Наименование', 'Член семьи', 'Проект', 'Теги',
    'Комментарий', 'Источник', 'Строка источника', 'Статус'
  ])
});

function prhGoogleRepositoryAssertHeaders_(headers) {
  if (!Array.isArray(headers)) {
    throw new Error('GOOGLE_REPOSITORY_HEADERS_INVALID');
  }
  var normalized = headers.map(function (value) { return String(value || '').trim(); });
  PRH_GOOGLE_REPOSITORY_GATEWAY.REQUIRED_HEADERS.forEach(function (required) {
    if (normalized.indexOf(required) < 0) {
      throw new Error('GOOGLE_REPOSITORY_REQUIRED_HEADER_MISSING');
    }
  });
  return true;
}

function prhGoogleRepositoryNormalizeReadRequest_(request, headers, lastRow) {
  var source = request == null ? {} : request;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('GOOGLE_REPOSITORY_READ_REQUEST_INVALID');
  }
  Object.keys(source).forEach(function (key) {
    if (['required_headers', 'start_row', 'row_count'].indexOf(key) < 0) {
      throw new Error('GOOGLE_REPOSITORY_READ_REQUEST_FIELD_UNKNOWN');
    }
  });

  var required = source.required_headers == null
    ? PRH_GOOGLE_REPOSITORY_GATEWAY.REQUIRED_HEADERS.slice()
    : source.required_headers.slice();
  if (!Array.isArray(required) || required.length < 1) {
    throw new Error('GOOGLE_REPOSITORY_READ_HEADERS_INVALID');
  }
  var allowed = {};
  PRH_GOOGLE_REPOSITORY_GATEWAY.REQUIRED_HEADERS.forEach(function (header) { allowed[header] = true; });
  var seen = {};
  required = required.map(function (value) {
    var header = String(value || '').trim();
    if (!allowed[header]) throw new Error('GOOGLE_REPOSITORY_READ_HEADER_NOT_ALLOWED');
    if (seen[header]) throw new Error('GOOGLE_REPOSITORY_READ_HEADER_DUPLICATE');
    seen[header] = true;
    return header;
  });

  var normalizedHeaders = headers.map(function (value) { return String(value || '').trim(); });
  var positions = {};
  normalizedHeaders.forEach(function (header, index) {
    if (header && positions[header] == null) positions[header] = index + 1;
  });
  required.forEach(function (header) {
    if (!positions[header]) throw new Error('GOOGLE_REPOSITORY_READ_HEADER_MISSING');
  });

  var startRow = source.start_row == null ? 2 : Number(source.start_row);
  if (!Number.isInteger(startRow) || startRow < 2) throw new Error('GOOGLE_REPOSITORY_READ_START_ROW_INVALID');
  var availableRows = Math.max(0, lastRow - startRow + 1);
  var rowCount = source.row_count == null ? availableRows : Number(source.row_count);
  if (!Number.isInteger(rowCount) || rowCount < 0 || rowCount > availableRows) {
    throw new Error('GOOGLE_REPOSITORY_READ_ROW_COUNT_INVALID');
  }

  var located = required.map(function (header) {
    return { header: header, column: positions[header] };
  }).sort(function (left, right) { return left.column - right.column; });
  var spans = [];
  located.forEach(function (item) {
    var previous = spans.length ? spans[spans.length - 1] : null;
    if (previous && item.column === previous.start_column + previous.width) {
      previous.width += 1;
      previous.headers.push(item.header);
    } else {
      spans.push({ start_column: item.column, width: 1, headers: [item.header] });
    }
  });

  return {
    required_headers: required,
    positions: positions,
    start_row: startRow,
    row_count: rowCount,
    spans: spans
  };
}

function prhGoogleRepositoryReadOperationsTable_(request) {
  var sheet = getSheetRequired_(PR_CONFIG.SHEETS.OPERATIONS);
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  // Header discovery is control-plane only. Data rows below are never read at
  // lastColumn width unless all columns are explicitly mapped/requested.
  var sourceHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  prhGoogleRepositoryAssertHeaders_(sourceHeaders);
  var plan = prhGoogleRepositoryNormalizeReadRequest_(request, sourceHeaders, lastRow);

  var rows = Array.from({ length: plan.row_count }, function () {
    return Array(plan.required_headers.length).fill('');
  });
  var requestedIndex = {};
  plan.required_headers.forEach(function (header, index) { requestedIndex[header] = index; });

  if (plan.row_count > 0) {
    plan.spans.forEach(function (span) {
      var values = sheet.getRange(plan.start_row, span.start_column, plan.row_count, span.width).getValues();
      values.forEach(function (record, rowOffset) {
        span.headers.forEach(function (header, spanOffset) {
          rows[rowOffset][requestedIndex[header]] = record[spanOffset];
        });
      });
    });
  }

  var projectedColumns = plan.spans.reduce(function (sum, span) { return sum + span.width; }, 0);
  return {
    schema: PRH_GOOGLE_REPOSITORY_GATEWAY.TABLE_SCHEMA,
    gateway_version: PRH_GOOGLE_REPOSITORY_GATEWAY.VERSION,
    mapping_version: PRH_GOOGLE_REPOSITORY_GATEWAY.MAPPING_VERSION,
    sheet_name: PR_CONFIG.SHEETS.OPERATIONS,
    start_row: plan.start_row,
    headers: plan.required_headers.slice(),
    rows: rows,
    read_plan: {
      schema: PRH_GOOGLE_REPOSITORY_GATEWAY.PROJECTION_SCHEMA,
      requested_header_count: plan.required_headers.length,
      projected_column_count: projectedColumns,
      column_span_count: plan.spans.length,
      row_count: plan.row_count,
      range_read_count: plan.row_count > 0 ? plan.spans.length : 0,
      cell_read_count: projectedColumns * plan.row_count
    }
  };
}

function prhGoogleRepositoryApplyCanonicalBatch_() {
  operationWriteGuard_();
  throw new Error('GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED');
}

/**
 * Public-safe capability metadata only. No workbook values, row counts,
 * revisions or private locators are returned.
 */
function prhGoogleRepositoryGatewayStatus() {
  return {
    schema: PRH_GOOGLE_REPOSITORY_GATEWAY.SCHEMA,
    version: PRH_GOOGLE_REPOSITORY_GATEWAY.VERSION,
    mapping_version: PRH_GOOGLE_REPOSITORY_GATEWAY.MAPPING_VERSION,
    projection_schema: PRH_GOOGLE_REPOSITORY_GATEWAY.PROJECTION_SCHEMA,
    read_capability: true,
    query_capability: true,
    projected_read_capability: true,
    write_interface: true,
    write_authorized: false,
    write_reason: 'GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED'
  };
}
