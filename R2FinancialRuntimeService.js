/**
 * UI-MIG-020 read-only runtime bridge for the canonical Financial Home.
 *
 * Financial semantics are NOT reimplemented here. The immutable candidate
 * contains generated `R2CanonicalRuntimeBundle.js`, assembled by the trusted
 * packager directly from the canonical versioned `lib/**` sources. This bridge
 * only connects Apps Script services/config to those canonical modules.
 *
 * Runtime authority:
 * - read existing `01 Операции` through GoogleTransactionRepositoryGateway;
 * - normalize through canonical `google_sheets_transaction_repository`;
 * - evaluate FIN/KPI/Home through canonical `financial_reconciliation`,
 *   `kpi_dictionary` and `financial_home` modules;
 * - project current human-facing dimension labels to deterministic, machine-safe
 *   read-only IDs without creating persistent identity authority;
 * - read explicit currency from existing `09 Настройки`;
 * - never write financial data and never use legacy total cells as truth.
 */
var PRH_R2_FIN_RUNTIME = Object.freeze({
  SCHEMA: 'PRH_R2_FIN_RUNTIME_BRIDGE_V1',
  VERSION: '1.2.0',
  CANONICAL_RUNTIME_SCHEMA: 'PRH_R2_CANONICAL_RUNTIME_BUNDLE_V1',
  FINANCIAL_TRUTH_POLICY: 'FIN-TRUTH-v1',
  KPI_DICTIONARY_VERSION: '1.0.0',
  HOME_VIEW_SCHEMA: 'PRH_FINANCIAL_HOME_VIEW_V1',
  DIMENSION_RESOLVER_SCHEMA: 'PRH_RUNTIME_DIMENSION_LABEL_HASH_V1',
  WRITE_AUTHORITY: false,
  PERSISTENT_IDENTITY_AUTHORITY: false,
  UI_FINANCIAL_FORMULA_AUTHORITY: false,
  FINANCIAL_FORMULA_COPY: false,
  FREE_ONLY: true
});

function prhR2FinFail_(reason) {
  var error = new Error(reason);
  error.code = reason;
  throw error;
}

function prhR2CanonicalRuntime_() {
  if (typeof PRH_R2_CANONICAL_RUNTIME !== 'object' || !PRH_R2_CANONICAL_RUNTIME) {
    prhR2FinFail_('R2_CANONICAL_RUNTIME_BUNDLE_MISSING');
  }
  if (PRH_R2_CANONICAL_RUNTIME.schema !== PRH_R2_FIN_RUNTIME.CANONICAL_RUNTIME_SCHEMA ||
      PRH_R2_CANONICAL_RUNTIME.generated_from_canonical_lib !== true ||
      PRH_R2_CANONICAL_RUNTIME.financial_formula_copy !== false) {
    prhR2FinFail_('R2_CANONICAL_RUNTIME_BUNDLE_INVALID');
  }
  if (!PRH_R2_CANONICAL_RUNTIME.home ||
      !PRH_R2_CANONICAL_RUNTIME.financialReconciliation ||
      !PRH_R2_CANONICAL_RUNTIME.googleAdapter) {
    prhR2FinFail_('R2_CANONICAL_RUNTIME_MODULE_MISSING');
  }
  return PRH_R2_CANONICAL_RUNTIME;
}

function prhR2FinCurrency_() {
  var settings = getSettingsMap_();
  var currency = String(settings.currency || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) prhR2FinFail_('R2_RUNTIME_CURRENCY_SETTING_REQUIRED');
  return currency;
}

function prhR2FinNormalizeDimensionLabel_(value) {
  var display = String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  if (!display) prhR2FinFail_('R2_RUNTIME_DIMENSION_EMPTY');
  return Object.freeze({ display: display, normalized: display.toLowerCase() });
}

function prhR2FinSha256Hex_(value) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8
  );
  if (!bytes || bytes.length !== 32) prhR2FinFail_('R2_RUNTIME_DIMENSION_HASH_INVALID');
  return bytes.map(function(byte) {
    var unsigned = byte < 0 ? byte + 256 : byte;
    return ('0' + unsigned.toString(16)).slice(-2);
  }).join('');
}

function prhR2FinCreateDimensionResolverState_() {
  var byKind = {};
  ['account', 'category', 'member', 'project'].forEach(function(kind) {
    byKind[kind] = { normalized_by_id: {}, display_by_id: {} };
  });

  function resolver(kind) {
    if (!Object.prototype.hasOwnProperty.call(byKind, kind)) {
      prhR2FinFail_('R2_RUNTIME_DIMENSION_KIND_INVALID');
    }
    return function(value) {
      var label = prhR2FinNormalizeDimensionLabel_(value);
      var digest = prhR2FinSha256Hex_(
        PRH_R2_FIN_RUNTIME.DIMENSION_RESOLVER_SCHEMA + '|' + kind + '|' + label.normalized
      );
      var id = kind + ':' + digest;
      var registry = byKind[kind];
      if (Object.prototype.hasOwnProperty.call(registry.normalized_by_id, id) &&
          registry.normalized_by_id[id] !== label.normalized) {
        prhR2FinFail_('R2_RUNTIME_DIMENSION_HASH_COLLISION');
      }
      registry.normalized_by_id[id] = label.normalized;
      if (!Object.prototype.hasOwnProperty.call(registry.display_by_id, id)) {
        registry.display_by_id[id] = label.display;
      }
      return id;
    };
  }

  return Object.freeze({
    schema: PRH_R2_FIN_RUNTIME.DIMENSION_RESOLVER_SCHEMA,
    version: '1.0.0',
    persistent_identity_authority: false,
    resolvers: Object.freeze({
      account: resolver('account'),
      category: resolver('category'),
      member: resolver('member'),
      project: resolver('project')
    }),
    displayLabel: function(kind, id) {
      if (!Object.prototype.hasOwnProperty.call(byKind, kind)) {
        prhR2FinFail_('R2_RUNTIME_DIMENSION_KIND_INVALID');
      }
      var label = byKind[kind].display_by_id[String(id || '')];
      if (!label) prhR2FinFail_('R2_RUNTIME_DIMENSION_DISPLAY_LABEL_MISSING');
      return label;
    }
  });
}

function prhR2FinReadTransactions_() {
  var runtime = prhR2CanonicalRuntime_();
  var currency = prhR2FinCurrency_();
  var dimensions = prhR2FinCreateDimensionResolverState_();
  var gateway = Object.freeze({
    readOperationsTable: function(request) {
      return prhGoogleRepositoryReadOperationsTable_(request);
    }
  });
  var repository = runtime.googleAdapter.createGoogleSheetsTransactionRepository(gateway, {
    default_currency: currency,
    resolvers: dimensions.resolvers
  });
  if (!repository || repository.capabilities.read !== true || repository.capabilities.write !== false) {
    prhR2FinFail_('R2_RUNTIME_REPOSITORY_CAPABILITY_INVALID');
  }
  var transactions = repository.readAll();
  if (!Array.isArray(transactions) || !transactions.length) prhR2FinFail_('R2_RUNTIME_NO_TRANSACTIONS');
  return Object.freeze({
    currency: currency,
    transactions: Object.freeze(transactions.slice()),
    dimensions: dimensions
  });
}

function prhR2FinIsoDay_(date) {
  return Utilities.formatDate(date, 'UTC', 'yyyy-MM-dd');
}

function prhR2FinLatestMonthPeriod_(transactions) {
  var latest = null;
  transactions.forEach(function(tx) {
    var date = new Date(tx.occurred_at);
    if (!Number.isFinite(date.getTime())) prhR2FinFail_('R2_RUNTIME_TRANSACTION_DATE_INVALID');
    if (!latest || date > latest) latest = date;
  });
  if (!latest) prhR2FinFail_('R2_RUNTIME_PERIOD_UNAVAILABLE');
  var start = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), 1));
  var end = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() + 1, 1));
  return Object.freeze({
    start: prhR2FinIsoDay_(start),
    end: prhR2FinIsoDay_(end),
    partial: false
  });
}

function prhR2FinPeriodTransactions_(transactions, period) {
  return transactions.filter(function(tx) {
    var day = String(tx.occurred_at || '').slice(0, 10);
    return day >= period.start && day < period.end;
  });
}

function prhR2FinVisualData_(runtime, source, homeView) {
  var periodTransactions = prhR2FinPeriodTransactions_(source.transactions, homeView.period);
  var aggregate = runtime.financialReconciliation.aggregateTransactions(periodTransactions);
  if (aggregate.policy_version !== PRH_R2_FIN_RUNTIME.FINANCIAL_TRUTH_POLICY) {
    prhR2FinFail_('R2_RUNTIME_FIN_POLICY_MISMATCH');
  }
  if (aggregate.income_minor !== homeView.cards.INCOME.value_minor ||
      aggregate.external_expense_minor !== homeView.cards.EXPENSE.value_minor ||
      aggregate.cash_flow_minor !== homeView.cards.CASH_FLOW.value_minor) {
    prhR2FinFail_('R2_RUNTIME_HOME_FIN_PARITY_FAILED');
  }
  var expenseMix = Object.keys(aggregate.by_expense_category_minor)
    .map(function(categoryId) {
      return [source.dimensions.displayLabel('category', categoryId), aggregate.by_expense_category_minor[categoryId]];
    })
    .filter(function(row) { return row[1] !== 0; })
    .sort(function(left, right) { return right[1] - left[1] || left[0].localeCompare(right[0]); });
  return Object.freeze({
    cash_flow_minor: Object.freeze([homeView.cards.CASH_FLOW.value_minor]),
    expense_mix: Object.freeze(expenseMix)
  });
}

function prhR2BuildFinancialHomeRuntime_() {
  var runtime = prhR2CanonicalRuntime_();
  var source = prhR2FinReadTransactions_();
  var period = prhR2FinLatestMonthPeriod_(source.transactions);
  var canonicalHome = runtime.home.buildFinancialHome(source.transactions, {
    currency: source.currency,
    period: period
  });
  if (!canonicalHome || canonicalHome.schema !== PRH_R2_FIN_RUNTIME.HOME_VIEW_SCHEMA ||
      canonicalHome.financial_truth_policy !== PRH_R2_FIN_RUNTIME.FINANCIAL_TRUTH_POLICY ||
      canonicalHome.kpi_dictionary_version !== PRH_R2_FIN_RUNTIME.KPI_DICTIONARY_VERSION) {
    prhR2FinFail_('R2_RUNTIME_HOME_CONTRACT_INVALID');
  }
  var visualData = prhR2FinVisualData_(runtime, source, canonicalHome);
  var provenance = {};
  Object.keys(canonicalHome.provenance || {}).forEach(function(key) {
    provenance[key] = canonicalHome.provenance[key];
  });
  provenance.runtime_bridge = 'GENERATED_CANONICAL_LIB_BUNDLE';
  provenance.generated_from_canonical_lib = true;
  provenance.financial_formula_copy = false;
  provenance.google_repository_adapter = 'PRH_GOOGLE_SHEETS_TRANSACTION_ADAPTER_V1';
  provenance.dimension_resolver = PRH_R2_FIN_RUNTIME.DIMENSION_RESOLVER_SCHEMA;
  provenance.persistent_identity_authority = false;
  provenance.legacy_total_cells_used = false;

  return Object.freeze({
    schema: canonicalHome.schema,
    contract_version: canonicalHome.contract_version,
    currency: canonicalHome.currency,
    period: canonicalHome.period,
    financial_truth_policy: canonicalHome.financial_truth_policy,
    kpi_dictionary_version: canonicalHome.kpi_dictionary_version,
    filter_context: canonicalHome.filter_context,
    cards: canonicalHome.cards,
    alerts: canonicalHome.alerts,
    widgets: canonicalHome.widgets,
    visual_data: visualData,
    provenance: Object.freeze(provenance)
  });
}
