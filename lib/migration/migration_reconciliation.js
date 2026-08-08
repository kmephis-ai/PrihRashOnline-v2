'use strict';

const crypto = require('crypto');

const TRANSFORM_VERSION = 'SOURCE-TRANSFORM-v1';
const REASON = Object.freeze({
  CLEAN: 'CLEAN',
  PROVENANCE_MISSING: 'PROVENANCE_MISSING',
  SOURCE_MISSING: 'SOURCE_MISSING',
  SOURCE_ROW_MOVED: 'SOURCE_ROW_MOVED',
  SOURCE_DUPLICATE: 'SOURCE_DUPLICATE',
  SOURCE_INVALID: 'SOURCE_INVALID',
  CORE_MISMATCH: 'CORE_MISMATCH',
  CANONICAL_ID_DUPLICATE: 'CANONICAL_ID_DUPLICATE',
  SOURCE_REF_DUPLICATE: 'SOURCE_REF_DUPLICATE'
});

const CORE_FIELDS = Object.freeze([
  'occurred_at',
  'type',
  'amount_minor',
  'currency',
  'account_id',
  'destination_account_id',
  'category_id',
  'name'
]);

function normalizeText(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
}

function normalizeSourceRecord(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('source record must be an object');
  const sourceSystem = normalizeText(input.source_system);
  const sourceSheet = normalizeText(input.source_sheet);
  const sourceRow = Number(input.source_row);
  if (!sourceSystem || !sourceSheet || !Number.isInteger(sourceRow) || sourceRow < 2) {
    throw new Error('source provenance requires source_system/source_sheet/source_row');
  }
  if (!Number.isInteger(input.amount_minor)) throw new Error('source amount_minor must be integer');
  const type = normalizeText(input.type);
  if (!type) throw new Error('source type is required');
  const occurredAt = normalizeText(input.occurred_at);
  if (!occurredAt) throw new Error('source occurred_at is required');
  return {
    source_system: sourceSystem,
    source_sheet: sourceSheet,
    source_row: sourceRow,
    transform_version: normalizeText(input.transform_version || TRANSFORM_VERSION),
    occurred_at: occurredAt,
    type,
    amount_minor: input.amount_minor,
    currency: normalizeText(input.currency || 'XXX'),
    account_id: normalizeText(input.account_id),
    destination_account_id: normalizeText(input.destination_account_id),
    category_id: normalizeText(input.category_id),
    name: normalizeText(input.name),
    source_quality: normalizeText(input.source_quality || 'VALID')
  };
}

function normalizeCanonicalRecord(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('canonical record must be an object');
  const canonicalId = normalizeText(input.transaction_id);
  if (!canonicalId) throw new Error('canonical transaction_id is required');
  const sourceSystem = normalizeText(input.source_system);
  const sourceSheet = normalizeText(input.source_sheet);
  const sourceRow = Number(input.source_row);
  if (!sourceSystem || !sourceSheet || !Number.isInteger(sourceRow) || sourceRow < 2) {
    throw new Error('canonical provenance requires source_system/source_sheet/source_row');
  }
  if (!Number.isInteger(input.amount_minor)) throw new Error('canonical amount_minor must be integer');
  return {
    transaction_id: canonicalId,
    source_system: sourceSystem,
    source_sheet: sourceSheet,
    source_row: sourceRow,
    transform_version: normalizeText(input.transform_version || TRANSFORM_VERSION),
    occurred_at: normalizeText(input.occurred_at),
    type: normalizeText(input.type),
    amount_minor: input.amount_minor,
    currency: normalizeText(input.currency || 'XXX'),
    account_id: normalizeText(input.account_id),
    destination_account_id: normalizeText(input.destination_account_id),
    category_id: normalizeText(input.category_id),
    name: normalizeText(input.name)
  };
}

function coreProjection(record) {
  const out = {};
  CORE_FIELDS.forEach((field) => { out[field] = record[field]; });
  return out;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function sourceFingerprint(input) {
  const row = normalizeSourceRecord(input);
  const identity = {
    source_system: row.source_system,
    source_sheet: row.source_sheet,
    transform_version: row.transform_version,
    core: coreProjection(row)
  };
  return crypto.createHash('sha256').update(stableStringify(identity), 'utf8').digest('hex');
}

function canonicalFingerprint(input) {
  const row = normalizeCanonicalRecord(input);
  const identity = {
    source_system: row.source_system,
    source_sheet: row.source_sheet,
    transform_version: row.transform_version,
    core: coreProjection(row)
  };
  return crypto.createHash('sha256').update(stableStringify(identity), 'utf8').digest('hex');
}

function sourceRefKey(record) {
  return `${record.source_system}|${record.source_sheet}|${record.source_row}`;
}

function diffCore(source, canonical) {
  const diffs = [];
  CORE_FIELDS.forEach((field) => {
    if (source[field] !== canonical[field]) diffs.push(field);
  });
  return diffs;
}

function buildSourceIndex(sourceInputs) {
  const byRef = new Map();
  const byFingerprint = new Map();
  const invalid = [];
  sourceInputs.forEach((raw, index) => {
    try {
      const source = normalizeSourceRecord(raw);
      const ref = sourceRefKey(source);
      if (!byRef.has(ref)) byRef.set(ref, []);
      byRef.get(ref).push(source);
      const fingerprint = sourceFingerprint(source);
      if (!byFingerprint.has(fingerprint)) byFingerprint.set(fingerprint, []);
      byFingerprint.get(fingerprint).push(source);
    } catch (error) {
      invalid.push({ index, reason: REASON.SOURCE_INVALID });
    }
  });
  return { byRef, byFingerprint, invalid };
}

function reconcileMigrations(sourceInputs, canonicalInputs) {
  if (!Array.isArray(sourceInputs) || !Array.isArray(canonicalInputs)) throw new Error('source/canonical inputs must be arrays');
  const sourceIndex = buildSourceIndex(sourceInputs);
  const results = [];
  const canonicalIdCounts = new Map();
  const sourceRefCounts = new Map();
  const canonicals = [];

  canonicalInputs.forEach((raw, index) => {
    try {
      const canonical = normalizeCanonicalRecord(raw);
      canonicals.push({ index, canonical });
      canonicalIdCounts.set(canonical.transaction_id, (canonicalIdCounts.get(canonical.transaction_id) || 0) + 1);
      const ref = sourceRefKey(canonical);
      sourceRefCounts.set(ref, (sourceRefCounts.get(ref) || 0) + 1);
    } catch (error) {
      results.push({ index, transaction_id: normalizeText(raw && raw.transaction_id), status: 'REVIEW', reason: REASON.PROVENANCE_MISSING, core_diff_fields: [] });
    }
  });

  canonicals.forEach(({ index, canonical }) => {
    const ref = sourceRefKey(canonical);
    if (canonicalIdCounts.get(canonical.transaction_id) > 1) {
      results.push({ index, transaction_id: canonical.transaction_id, status: 'REVIEW', reason: REASON.CANONICAL_ID_DUPLICATE, core_diff_fields: [] });
      return;
    }
    if (sourceRefCounts.get(ref) > 1) {
      results.push({ index, transaction_id: canonical.transaction_id, status: 'REVIEW', reason: REASON.SOURCE_REF_DUPLICATE, core_diff_fields: [] });
      return;
    }

    const currentRows = sourceIndex.byRef.get(ref) || [];
    const fingerprint = canonicalFingerprint(canonical);
    const fingerprintRows = sourceIndex.byFingerprint.get(fingerprint) || [];

    if (currentRows.length === 0) {
      if (fingerprintRows.length === 1) {
        results.push({ index, transaction_id: canonical.transaction_id, status: 'REVIEW', reason: REASON.SOURCE_ROW_MOVED, core_diff_fields: [], current_source_row: fingerprintRows[0].source_row });
      } else if (fingerprintRows.length > 1) {
        results.push({ index, transaction_id: canonical.transaction_id, status: 'REVIEW', reason: REASON.SOURCE_DUPLICATE, core_diff_fields: [] });
      } else {
        results.push({ index, transaction_id: canonical.transaction_id, status: 'REVIEW', reason: REASON.SOURCE_MISSING, core_diff_fields: [] });
      }
      return;
    }
    if (currentRows.length > 1) {
      results.push({ index, transaction_id: canonical.transaction_id, status: 'REVIEW', reason: REASON.SOURCE_DUPLICATE, core_diff_fields: [] });
      return;
    }

    const current = currentRows[0];
    const diffs = diffCore(current, canonical);
    if (diffs.length === 0 && current.source_quality === 'VALID') {
      results.push({ index, transaction_id: canonical.transaction_id, status: 'CLEAN', reason: REASON.CLEAN, core_diff_fields: [] });
      return;
    }

    if (fingerprintRows.length === 1 && fingerprintRows[0].source_row !== canonical.source_row) {
      results.push({ index, transaction_id: canonical.transaction_id, status: 'REVIEW', reason: REASON.SOURCE_ROW_MOVED, core_diff_fields: diffs, current_source_row: fingerprintRows[0].source_row });
      return;
    }
    if (fingerprintRows.length > 1) {
      results.push({ index, transaction_id: canonical.transaction_id, status: 'REVIEW', reason: REASON.SOURCE_DUPLICATE, core_diff_fields: diffs });
      return;
    }
    results.push({ index, transaction_id: canonical.transaction_id, status: 'REVIEW', reason: current.source_quality === 'VALID' ? REASON.CORE_MISMATCH : REASON.SOURCE_INVALID, core_diff_fields: diffs });
  });

  results.sort((a, b) => a.index - b.index);
  const summary = {
    transform_version: TRANSFORM_VERSION,
    source_count: sourceInputs.length,
    canonical_count: canonicalInputs.length,
    invalid_source_count: sourceIndex.invalid.length,
    clean_count: results.filter((item) => item.status === 'CLEAN').length,
    review_count: results.filter((item) => item.status !== 'CLEAN').length,
    by_reason: {}
  };
  results.forEach((item) => { summary.by_reason[item.reason] = (summary.by_reason[item.reason] || 0) + 1; });
  return { summary, results };
}

function planIdempotentImport(sourceInputs, canonicalInputs) {
  const sourceIndex = buildSourceIndex(sourceInputs);
  const canonicalFingerprints = new Map();
  canonicalInputs.forEach((raw) => {
    const fp = canonicalFingerprint(raw);
    canonicalFingerprints.set(fp, (canonicalFingerprints.get(fp) || 0) + 1);
  });
  const plan = [];
  sourceInputs.forEach((raw, index) => {
    let source;
    try {
      source = normalizeSourceRecord(raw);
    } catch (error) {
      plan.push({ index, action: 'BLOCK', reason: REASON.SOURCE_INVALID });
      return;
    }
    const fp = sourceFingerprint(source);
    const duplicateSource = (sourceIndex.byFingerprint.get(fp) || []).length > 1;
    if (duplicateSource) {
      plan.push({ index, action: 'BLOCK', reason: REASON.SOURCE_DUPLICATE, fingerprint: fp });
    } else if ((canonicalFingerprints.get(fp) || 0) === 1) {
      plan.push({ index, action: 'REUSE', reason: REASON.CLEAN, fingerprint: fp });
    } else if ((canonicalFingerprints.get(fp) || 0) > 1) {
      plan.push({ index, action: 'BLOCK', reason: REASON.CANONICAL_ID_DUPLICATE, fingerprint: fp });
    } else {
      plan.push({ index, action: 'INSERT', reason: 'NEW_SOURCE', fingerprint: fp });
    }
  });
  return plan;
}

module.exports = {
  TRANSFORM_VERSION,
  REASON,
  CORE_FIELDS,
  normalizeText,
  normalizeSourceRecord,
  normalizeCanonicalRecord,
  coreProjection,
  sourceFingerprint,
  canonicalFingerprint,
  sourceRefKey,
  diffCore,
  reconcileMigrations,
  planIdempotentImport
};
