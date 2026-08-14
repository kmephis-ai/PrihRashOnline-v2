'use strict';

const { evaluateAnalytics } = require('../lib/analytics/analytics_engine');

const WORKER_SCHEMA = 'PRH_LOCAL_ANALYTICS_WORKER_V1';
const WORKER_VERSION = '1.0.0';
const HEX64 = /^[0-9a-f]{64}$/;
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const MAX_TRANSACTIONS = 20000;
const MAX_PENDING = 32;
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
  'WORKER_CANONICAL_EVALUATION_FAILED'
]);

const state = {
  initialized: false,
  generationId: null,
  revision: null,
  epoch: 0,
  cancelled: false,
  pending: 0
};

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
  if (!HEX64.test(normalized)) {
    const error = new Error(reason);
    error.code = reason;
    throw error;
  }
  return normalized;
}

function validateRequestId(value) {
  const text = String(value || '');
  if (!REQUEST_ID.test(text)) {
    const error = new Error('WORKER_REQUEST_ID_INVALID');
    error.code = 'WORKER_REQUEST_ID_INVALID';
    throw error;
  }
  return text;
}

function assertReady() {
  if (!state.initialized) {
    const error = new Error('WORKER_NOT_READY');
    error.code = 'WORKER_NOT_READY';
    throw error;
  }
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
    const error = new Error('WORKER_TRANSACTIONS_INVALID');
    error.code = 'WORKER_TRANSACTIONS_INVALID';
    throw error;
  }
  if (!message.query || typeof message.query !== 'object' || Array.isArray(message.query)) {
    const error = new Error('WORKER_QUERY_INVALID');
    error.code = 'WORKER_QUERY_INVALID';
    throw error;
  }
  if (state.pending >= MAX_PENDING) {
    const error = new Error('WORKER_TOO_MANY_PENDING');
    error.code = 'WORKER_TOO_MANY_PENDING';
    throw error;
  }

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
      const result = evaluateAnalytics(message.transactions, message.query);
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
  }, 0);
}

self.onmessage = function onMessage(event) {
  const message = event && event.data;
  try {
    if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.type !== 'string') {
      throw Object.assign(new Error('WORKER_MESSAGE_INVALID'), { code: 'WORKER_MESSAGE_INVALID' });
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
        throw Object.assign(new Error('WORKER_UNSUPPORTED_MESSAGE'), { code: 'WORKER_UNSUPPORTED_MESSAGE' });
    }
  } catch (error) {
    emitError(message && message.request_id, error, safeReason(error, 'WORKER_MESSAGE_INVALID'));
  }
};
