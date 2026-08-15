'use strict';

const { evaluateAnalytics } = require('../lib/analytics/analytics_engine');
const {
  CANONICAL_FIELDS,
  PROVENANCE_FIELDS
} = require('../lib/domain/canonical_transaction');

const WORKER_SCHEMA = 'PRH_LOCAL_ANALYTICS_WORKER_V1';
const WORKER_VERSION = '1.0.0';
const HEX64 = /^[0-9a-f]{64}$/;
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const MAX_TRANSACTIONS = 20000;
const MAX_PENDING = 32;
const SCHEDULE_DELAY_MS = 4;
const SAFE_REASONS = new Set([
  'WORKER_NOT_READY',
  'WORKER_MESSAGE_INVALID',
  'WORKER_GENERATION_INVALID',
  'WORKER_REVISION_INVALID',
  'WORKER_REQUEST_ID_INVALID',
  'WORKER_TRANSACTIONS_INVALID',
  'WORKER_QUERY_INVALID',
  'WORKER_TOO_MANY_PENDING',
  'WORKER_UNSUPPORTED_MESSAGE',
  'WORKER_CANONICAL_EVALUATION_FAILED',
  'WORKER_CANONICAL_TX_NOT_OBJECT',
  'WORKER_CANONICAL_TOP_LEVEL_EXTRA',
  'WORKER_CANONICAL_PROVENANCE_NOT_OBJECT',
  'WORKER_CANONICAL_PROVENANCE_EXTRA',
  'WORKER_CANONICAL_SHAPE_DIVERGENCE'
]);

const state = {
  initialized: false,
  generationId: null,
  revision: null,
  epoch: 0,
  cancelled: false,
  pending: 0
};

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function safeSchemaFieldToken(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'UNKNOWN';
}

function canonicalShapeReason(transactions) {
  if (!Array.isArray(transactions)) return 'WORKER_TRANSACTIONS_INVALID';
  for (const tx of transactions) {
    if (!tx || typeof tx !== 'object' || Array.isArray(tx)) return 'WORKER_CANONICAL_TX_NOT_OBJECT';
    const keys = Object.keys(tx);
    for (const field of CANONICAL_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(tx, field)) {
        return `WORKER_CANONICAL_FIELD_MISSING_${safeSchemaFieldToken(field)}`;
      }
    }
    if (keys.some((key) => !CANONICAL_FIELDS.includes(key))) return 'WORKER_CANONICAL_TOP_LEVEL_EXTRA';
    if (keys.length !== CANONICAL_FIELDS.length) return 'WORKER_CANONICAL_TOP_LEVEL_EXTRA';
    const provenance = tx.provenance;
    if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
      return 'WORKER_CANONICAL_PROVENANCE_NOT_OBJECT';
    }
    const provenanceKeys = Object.keys(provenance);
    for (const field of PROVENANCE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(provenance, field)) {
        return `WORKER_CANONICAL_PROVENANCE_MISSING_${safeSchemaFieldToken(field)}`;
      }
    }
    if (provenanceKeys.some((key) => !PROVENANCE_FIELDS.includes(key))) return 'WORKER_CANONICAL_PROVENANCE_EXTRA';
    if (provenanceKeys.length !== PROVENANCE_FIELDS.length) return 'WORKER_CANONICAL_PROVENANCE_EXTRA';
  }
  return null;
}

function safeReason(error, fallback) {
  const code = error && typeof error.code === 'string' ? error.code : '';
  if (/^[A-Z][A-Z0-9_]{2,96}$/.test(code)) return code;
  if (SAFE_REASONS.has(fallback)) return fallback;
  return 'WORKER_CANONICAL_EVALUATION_FAILED';
}

function emit(message) {
  self.postMessage(message);
}

function emitError(requestId, error, fallback) {
  emit({
    type: 'ERROR',
    request_id: REQUEST_ID.test(String(requestId || '')) ? String(requestId) : null,
    reason: safeReason(error, fallback)
  });
}

function validateHex64(value, reason) {
  const normalized = String(value || '').toLowerCase();
  if (!HEX64.test(normalized)) throw codedError(reason);
  return normalized;
}

function validateRequestId(value) {
  const text = String(value || '');
  if (!REQUEST_ID.test(text)) throw codedError('WORKER_REQUEST_ID_INVALID');
  return text;
}

function assertReady() {
  if (!state.initialized) throw codedError('WORKER_NOT_READY');
}

function exactBinding(generationId, revision, epoch) {
  return state.initialized &&
    !state.cancelled &&
    state.generationId === generationId &&
    state.revision === revision &&
    state.epoch === epoch;
}

function stale(requestId, generationId, revision, reason) {
  emit({
    type: 'STALE_DISCARDED',
    request_id: requestId,
    generation_id: generationId,
    revision,
    reason
  });
}

function handleInit() {
  state.initialized = true;
  emit({ type: 'READY', schema: WORKER_SCHEMA, version: WORKER_VERSION });
}

function handleSetRevision(message) {
  assertReady();
  const generationId = validateHex64(message.generation_id, 'WORKER_GENERATION_INVALID');
  const revision = validateHex64(message.revision, 'WORKER_REVISION_INVALID');
  state.epoch += 1;
  state.generationId = generationId;
  state.revision = revision;
  state.cancelled = false;
}

function handleCancelGeneration(message) {
  assertReady();
  const generationId = validateHex64(message.generation_id, 'WORKER_GENERATION_INVALID');
  if (generationId !== state.generationId) return;
  state.epoch += 1;
  state.cancelled = true;
}

function handleAnalyticsQuery(message) {
  assertReady();
  const requestId = validateRequestId(message.request_id);
  const generationId = validateHex64(message.generation_id, 'WORKER_GENERATION_INVALID');
  const revision = validateHex64(message.revision, 'WORKER_REVISION_INVALID');
  if (!Array.isArray(message.transactions) || message.transactions.length > MAX_TRANSACTIONS) {
    throw codedError('WORKER_TRANSACTIONS_INVALID');
  }
  if (!message.query || typeof message.query !== 'object' || Array.isArray(message.query)) {
    throw codedError('WORKER_QUERY_INVALID');
  }
  if (state.pending >= MAX_PENDING) throw codedError('WORKER_TOO_MANY_PENDING');

  const epoch = state.epoch;
  if (!exactBinding(generationId, revision, epoch)) {
    stale(requestId, generationId, revision, 'BINDING_NOT_CURRENT');
    return;
  }

  state.pending += 1;
  setTimeout(() => {
    try {
      if (!exactBinding(generationId, revision, epoch)) {
        stale(requestId, generationId, revision, 'STALE_BEFORE_EVALUATE');
        return;
      }
      const shapeReason = canonicalShapeReason(message.transactions);
      if (shapeReason) throw codedError(shapeReason);
      let result;
      try {
        result = evaluateAnalytics(message.transactions, message.query);
      } catch (error) {
        if (error && error.code === 'CANONICAL_TRANSACTION_SHAPE_INVALID') {
          throw codedError('WORKER_CANONICAL_SHAPE_DIVERGENCE');
        }
        throw error;
      }
      if (!exactBinding(generationId, revision, epoch)) {
        stale(requestId, generationId, revision, 'STALE_AFTER_EVALUATE');
        return;
      }
      emit({
        type: 'ANALYTICS_RESULT',
        request_id: requestId,
        generation_id: generationId,
        revision,
        result
      });
    } catch (error) {
      emitError(requestId, error, 'WORKER_CANONICAL_EVALUATION_FAILED');
    } finally {
      state.pending = Math.max(0, state.pending - 1);
    }
  }, SCHEDULE_DELAY_MS);
}

self.onmessage = function onMessage(event) {
  const message = event && event.data;
  try {
    if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.type !== 'string') {
      throw codedError('WORKER_MESSAGE_INVALID');
    }
    switch (message.type) {
      case 'INIT':
        handleInit();
        return;
      case 'SET_REVISION':
        handleSetRevision(message);
        return;
      case 'ANALYTICS_QUERY':
        handleAnalyticsQuery(message);
        return;
      case 'CANCEL_GENERATION':
        handleCancelGeneration(message);
        return;
      default:
        throw codedError('WORKER_UNSUPPORTED_MESSAGE');
    }
  } catch (error) {
    emitError(message && message.request_id, error, safeReason(error, 'WORKER_MESSAGE_INVALID'));
  }
};
