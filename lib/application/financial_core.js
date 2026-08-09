'use strict';

const CONTRACT = require('./application_core.v1.json');
const {
  SCHEMA_ID: CANONICAL_SCHEMA,
  SCHEMA_VERSION: CANONICAL_VERSION,
  validateCanonicalCollection,
  toMigrationCompatibilityRecord
} = require('../domain/canonical_transaction');
const {
  DICTIONARY,
  evaluateKpis
} = require('../finance/kpi_dictionary');
const {
  POLICY_VERSION
} = require('../finance/financial_reconciliation');
const {
  TRANSFORM_VERSION,
  reconcileMigrations,
  planIdempotentImport
} = require('../migration/migration_reconciliation');

const APPLICATION_SCHEMA = 'PRH_APPLICATION_CORE_V1';
const APPLICATION_VERSION = '1.0.0';
const USE_CASES = Object.freeze([
  'VALIDATE_CANONICAL_DATASET',
  'CALCULATE_FINANCIAL_SNAPSHOT',
  'REVIEW_MIGRATION',
  'PLAN_IDEMPOTENT_IMPORT'
]);

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function boundedReason(error, fallback = 'APP_CORE_USE_CASE_FAILED') {
  const raw = String(error && (error.code || error.message) || '');
  return /^[A-Z][A-Z0-9_]{2,79}$/.test(raw) ? raw : fallback;
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== APPLICATION_SCHEMA || CONTRACT.version !== APPLICATION_VERSION) {
    fail('APP_CORE_CONTRACT_VERSION_INVALID');
  }
  if (CONTRACT.runtime_model !== 'PURE_IN_PROCESS' || CONTRACT.io_authority !== false
      || CONTRACT.financial_write_authority !== false || CONTRACT.network_authority !== false) {
    fail('APP_CORE_AUTHORITY_INVALID');
  }
  if (CONTRACT.required_dependencies.financial_truth !== POLICY_VERSION) fail('APP_CORE_FIN_TRUTH_MISMATCH');
  if (CONTRACT.required_dependencies.kpi_dictionary !== `PRH_KPI_DICTIONARY_V1@${DICTIONARY.version}`) {
    fail('APP_CORE_KPI_DICTIONARY_MISMATCH');
  }
  if (CONTRACT.required_dependencies.canonical_transaction !== `${CANONICAL_SCHEMA}@${CANONICAL_VERSION}`) {
    fail('APP_CORE_CANONICAL_SCHEMA_MISMATCH');
  }
  if (CONTRACT.required_dependencies.migration_transform !== TRANSFORM_VERSION) fail('APP_CORE_MIGRATION_POLICY_MISMATCH');
  if (USE_CASES.some((id) => !CONTRACT.use_cases[id])) fail('APP_CORE_USE_CASE_CONTRACT_MISSING');
  return true;
}

function assertPlainObject(value, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  return value;
}

function validateCanonicalDataset(transactions) {
  assertContract();
  const normalized = validateCanonicalCollection(transactions);
  return Object.freeze({
    schema: 'PRH_DATASET_VALIDATION_RESULT_V1',
    application_core_version: APPLICATION_VERSION,
    canonical_schema: `${CANONICAL_SCHEMA}@${CANONICAL_VERSION}`,
    status: 'PASS',
    transaction_count: normalized.length,
    transactions: Object.freeze(normalized.slice())
  });
}

function calculateFinancialSnapshot(transactions, options = {}) {
  assertContract();
  const dataset = validateCanonicalDataset(transactions);
  assertPlainObject(options, 'APP_CORE_KPI_OPTIONS_INVALID');
  const kpis = evaluateKpis(dataset.transactions, options);
  return Object.freeze({
    schema: 'PRH_FINANCIAL_SNAPSHOT_V1',
    application_core_version: APPLICATION_VERSION,
    canonical_schema: dataset.canonical_schema,
    kpi_dictionary_version: kpis.dictionary_version,
    financial_truth_policy: kpis.financial_truth_policy,
    currency: kpis.currency,
    period: kpis.period,
    values: Object.freeze({
      income_minor: kpis.income_minor,
      expense_minor: kpis.expense_minor,
      cash_flow_minor: kpis.cash_flow_minor,
      savings_minor: kpis.savings_minor,
      budget_variance_minor: kpis.budget_variance_minor,
      gross_expense_minor: kpis.gross_expense_minor,
      refund_minor: kpis.refund_minor,
      transfer_minor: kpis.transfer_minor
    }),
    transaction_count: dataset.transaction_count
  });
}

function asMigrationCompatibilityRecords(transactions) {
  const dataset = validateCanonicalDataset(transactions);
  return dataset.transactions.map(toMigrationCompatibilityRecord);
}

function reviewMigration(sourceRecords, canonicalTransactions) {
  assertContract();
  if (!Array.isArray(sourceRecords)) fail('APP_CORE_MIGRATION_SOURCE_INVALID');
  const compatible = asMigrationCompatibilityRecords(canonicalTransactions);
  const result = reconcileMigrations(sourceRecords, compatible);
  return Object.freeze({
    schema: 'PRH_MIGRATION_REVIEW_RESULT_V1',
    application_core_version: APPLICATION_VERSION,
    transform_version: TRANSFORM_VERSION,
    summary: Object.freeze({ ...result.summary }),
    results: Object.freeze(result.results.map((item) => Object.freeze({ ...item })))
  });
}

function planIdempotentMigration(sourceRecords, canonicalTransactions) {
  assertContract();
  if (!Array.isArray(sourceRecords)) fail('APP_CORE_MIGRATION_SOURCE_INVALID');
  const compatible = asMigrationCompatibilityRecords(canonicalTransactions);
  const plan = planIdempotentImport(sourceRecords, compatible);
  return Object.freeze({
    schema: 'PRH_MIGRATION_IMPORT_PLAN_V1',
    application_core_version: APPLICATION_VERSION,
    transform_version: TRANSFORM_VERSION,
    plan: Object.freeze(plan.map((item) => Object.freeze({ ...item })))
  });
}

function runUseCase(useCase, payload) {
  try {
    assertContract();
    if (!USE_CASES.includes(useCase)) fail('APP_CORE_USE_CASE_UNKNOWN');
    const input = assertPlainObject(payload, 'APP_CORE_PAYLOAD_INVALID');
    let result;
    switch (useCase) {
      case 'VALIDATE_CANONICAL_DATASET':
        result = validateCanonicalDataset(input.transactions);
        break;
      case 'CALCULATE_FINANCIAL_SNAPSHOT':
        result = calculateFinancialSnapshot(input.transactions, input.options || {});
        break;
      case 'REVIEW_MIGRATION':
        result = reviewMigration(input.source_records, input.canonical_transactions);
        break;
      case 'PLAN_IDEMPOTENT_IMPORT':
        result = planIdempotentMigration(input.source_records, input.canonical_transactions);
        break;
      default:
        fail('APP_CORE_USE_CASE_UNKNOWN');
    }
    return Object.freeze({
      schema: 'PRH_APPLICATION_USE_CASE_RESULT_V1',
      status: 'PASS',
      use_case: useCase,
      application_core_version: APPLICATION_VERSION,
      result
    });
  } catch (error) {
    return Object.freeze({
      schema: 'PRH_APPLICATION_USE_CASE_RESULT_V1',
      status: 'BLOCKED',
      use_case: USE_CASES.includes(useCase) ? useCase : 'UNKNOWN',
      application_core_version: APPLICATION_VERSION,
      reason_code: boundedReason(error)
    });
  }
}

module.exports = {
  CONTRACT,
  APPLICATION_SCHEMA,
  APPLICATION_VERSION,
  USE_CASES,
  assertContract,
  boundedReason,
  validateCanonicalDataset,
  calculateFinancialSnapshot,
  asMigrationCompatibilityRecords,
  reviewMigration,
  planIdempotentMigration,
  runUseCase
};
