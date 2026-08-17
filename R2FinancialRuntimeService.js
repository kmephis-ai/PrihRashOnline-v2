/**
 * UI-MIG-020 / PERF-REC-001 read-only runtime bridge for Financial Home.
 *
 * Financial semantics are owned by generated canonical lib modules. The bridge
 * connects Apps Script services to those modules and adds runtime-only
 * performance orchestration without creating financial/write authority.
 */
var PRH_R2_FIN_RUNTIME = Object.freeze({
  SCHEMA: 'PRH_R2_FIN_RUNTIME_BRIDGE_V1',
  VERSION: '1.4.0',
  CANONICAL_RUNTIME_SCHEMA: 'PRH_R2_CANONICAL_RUNTIME_BUNDLE_V1',
  FINANCIAL_TRUTH_POLICY: 'FIN-TRUTH-v1',
  KPI_DICTIONARY_VERSION: '1.0.0',
  HOME_VIEW_SCHEMA: 'PRH_FINANCIAL_HOME_VIEW_V1',
  DIMENSION_RESOLVER_SCHEMA: 'PRH_RUNTIME_DIMENSION_LABEL_HASH_V1',
  HOME_PROJECTION_SCHEMA: 'PRH_GOOGLE_LATEST_MONTH_SNAPSHOT_V1',
  HOME_PROJECTION_CONTRACT: 'PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0',
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
      !PRH_R2_CANONICAL_RUNTIME.googleAdapter ||
      !PRH_R2_CANONICAL_RUNTIME.revisionAwareCache ||
      !PRH_R2_CANONICAL_RUNTIME.singleScanRefresh) {
    prhR2FinFail_('R2_CANONICAL_RUNTIME_MODULE_MISSING');
  }
  return PRH_R2_CANONICAL_RUNTIME;
}

function prhR2FinCurrency_() {
  var started = Date.now();
  var settings = getSettingsMap_();
  var currency = String(settings.currency || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) prhR2FinFail_('R2_RUNTIME_CURRENCY_SETTING_REQUIRED');
  if (typeof prhPerfRecRecordPhase_ === 'function') {
    prhPerfRecRecordPhase_('settings_read_ms', Date.now() - started);
  }
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
  var hashCount = 0;
  var memoHitCount = 0;
  ['account', 'category', 'member', 'project'].forEach(function(kind) {
    byKind[kind] = { normalized_by_id: {}, display_by_id: {}, id_by_normalized: {} };
  });

  function resolver(kind) {
    if (!Object.prototype.hasOwnProperty.call(byKind, kind)) {
      prhR2FinFail_('R2_RUNTIME_DIMENSION_KIND_INVALID');
    }
    return function(value) {
      var label = prhR2FinNormalizeDimensionLabel_(value);
      var registry = byKind[kind];
      if (Object.prototype.hasOwnProperty.call(registry.id_by_normalized, label.normalized)) {
        memoHitCount += 1;
        return registry.id_by_normalized[label.normalized];
      }
      var digest = prhR2FinSha256Hex_(
        PRH_R2_FIN_RUNTIME.DIMENSION_RESOLVER_SCHEMA + '|' + kind + '|' + label.normalized
      );
      hashCount += 1;
      var id = kind + ':' + digest;
      if (Object.prototype.hasOwnProperty.call(registry.normalized_by_id, id) &&
          registry.normalized_by_id[id] !== label.normalized) {
        prhR2FinFail_('R2_RUNTIME_DIMENSION_HASH_COLLISION');
      }
      registry.normalized_by_id[id] = label.normalized;
      registry.id_by_normalized[label.normalized] = id;
      if (!Object.prototype.hasOwnProperty.call(registry.display_by_id, id)) {
        registry.display_by_id[id] = label.display;
      }
      return id;
    };
  }

  return Object.freeze({
    schema: PRH_R2_FIN_RUNTIME.DIMENSION_RESOLVER_SCHEMA,
    version: '1.1.0',
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
    },
    telemetry: function() {
      return Object.freeze({
        unique_dimension_hash_count: hashCount,
        dimension_hash_memo_hit_count: memoHitCount
      });
    }
  });
}

function prhR2FinReadTransactions_() {
  var started = Date.now();
  var runtime = prhR2CanonicalRuntime_();
  var currency = prhR2FinCurrency_();
  var dimensions = prhR2FinCreateDimensionResolverState_();
  var gatewayCallCount = 0;
  var gatewayRangeReadCount = 0;
  var gatewayCellReadCount = 0;
  var gateway = Object.freeze({
    readOperationsTable: function(request) {
      var readStarted = Date.now();
      var snapshot = prhGoogleRepositoryReadOperationsTable_(request);
      gatewayCallCount += 1;
      if (snapshot && snapshot.read_plan) {
        gatewayRangeReadCount += Number(snapshot.read_plan.range_read_count || 0);
        gatewayCellReadCount += Number(snapshot.read_plan.cell_read_count || 0);
      }
      if (typeof prhPerfRecRecordPhase_ === 'function') {
        prhPerfRecRecordPhase_('sheet_read_ms', Date.now() - readStarted);
      }
      return snapshot;
    }
  });
  var repository = runtime.googleAdapter.createGoogleSheetsTransactionRepository(gateway, {
    default_currency: currency,
    resolvers: dimensions.resolvers
  });
  if (!repository || repository.capabilities.read !== true || repository.capabilities.write !== false ||
      repository.capabilities.latest_month_projection !== true ||
      typeof repository.readLatestCalendarMonth !== 'function') {
    prhR2FinFail_('R2_RUNTIME_REPOSITORY_CAPABILITY_INVALID');
  }

  // PERF-REC recovery: Home is a latest-calendar-month view. Scan only the
  // lightweight ID/timestamp projection across history, then canonicalize full
  // rows for the selected month. Full-history readAll remains available to
  // other repository consumers but is intentionally not used by Home.
  var projected = repository.readLatestCalendarMonth();
  if (!projected || projected.schema !== PRH_R2_FIN_RUNTIME.HOME_PROJECTION_SCHEMA ||
      !projected.period || !Array.isArray(projected.items) || !projected.items.length) {
    prhR2FinFail_('R2_RUNTIME_HOME_PROJECTION_INVALID');
  }
  var transactions = projected.items;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(projected.period.start || '')) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(projected.period.end || '')) ||
      projected.period.start >= projected.period.end) {
    prhR2FinFail_('R2_RUNTIME_HOME_PERIOD_INVALID');
  }
  if (gatewayCallCount < 2) prhR2FinFail_('R2_RUNTIME_HOME_PROJECTION_READ_PLAN_INVALID');

  var revisionMaterial = transactions.map(function(tx) {
    if (!tx || !tx.provenance || !/^[0-9a-f]{64}$/.test(String(tx.provenance.source_fingerprint || ''))) {
      prhR2FinFail_('R2_RUNTIME_HOME_FINGERPRINT_INVALID');
    }
    return String(tx.transaction_id) + ':' + String(tx.provenance.source_fingerprint);
  }).join('|');
  var canonicalRevision = prhR2FinSha256Hex_(
    'PRH_HOME_PERIOD_SNAPSHOT_V1|' + projected.period.start + '|' + projected.period.end + '|' + revisionMaterial
  );
  if (!/^[0-9a-f]{64}$/.test(canonicalRevision)) prhR2FinFail_('R2_RUNTIME_HOME_REVISION_INVALID');

  var dimensionTelemetry = dimensions.telemetry();
  if (typeof prhPerfRecRecordSource_ === 'function') {
    prhPerfRecRecordSource_({
      gateway_call_count: gatewayCallCount,
      range_read_count: gatewayRangeReadCount,
      cell_read_count: gatewayCellReadCount,
      canonical_snapshot_read_count: 1,
      snapshot_reuse_count: 0,
      unique_dimension_hash_count: dimensionTelemetry.unique_dimension_hash_count,
      dimension_hash_memo_hit_count: dimensionTelemetry.dimension_hash_memo_hit_count,
      canonical_revision_hash_prefix: canonicalRevision.slice(0, 12)
    });
    prhPerfRecRecordPhase_('canonical_snapshot_ms', Date.now() - started);
  }
  return Object.freeze({
    currency: currency,
    transactions: Object.freeze(transactions.slice()),
    dimensions: dimensions,
    period: Object.freeze({
      start: projected.period.start,
      end: projected.period.end,
      partial: projected.period.partial === true
    }),
    canonical_revision: canonicalRevision
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

function prhR2BuildFinancialHomeRuntimeUncached_() {
  var started = Date.now();
  var runtime = prhR2CanonicalRuntime_();
  var source = prhR2FinReadTransactions_();
  var period = source.period;
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
  provenance.perf_projection_contract = PRH_R2_FIN_RUNTIME.HOME_PROJECTION_CONTRACT;
  provenance.perf_full_history_canonical_scan_used = false;

  var result = Object.freeze({
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
  if (typeof prhPerfRecRecordPhase_ === 'function') {
    prhPerfRecRecordPhase_('home_build_ms', Date.now() - started);
  }
  return result;
}

function prhR2BuildFinancialHomeRuntime_() {
  if (typeof prhPerfRecGetOrBuildHome_ === 'function') {
    return prhPerfRecGetOrBuildHome_(prhR2BuildFinancialHomeRuntimeUncached_);
  }
  return prhR2BuildFinancialHomeRuntimeUncached_();
}