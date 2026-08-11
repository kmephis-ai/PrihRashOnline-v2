/**
 * Authenticated privacy-safe proof that the canonical R2 Financial Home can
 * build its private read-only view model from the currently deployed workbook.
 *
 * The returned scalar contains no amounts, categories, account IDs, row values,
 * runtime locators or other household payload. On failure, a bounded machine
 * reason code may be prefixed with RUNTIME_HEALTH_HOME_ so trusted CI can
 * identify the violated contract without exposing private values.
 */
function prhR2FinancialHomeReadSmokeToken() {
  if (typeof prhR2BuildFinancialHomeRuntime_ !== 'function') {
    throw new Error('RUNTIME_HEALTH_HOME_BUILDER_MISSING');
  }
  var view;
  try {
    view = prhR2BuildFinancialHomeRuntime_();
  } catch (error) {
    var code = String(error && error.code || '').trim();
    if (/^[A-Z][A-Z0-9_]{0,80}$/.test(code)) {
      throw new Error('RUNTIME_HEALTH_HOME_' + code);
    }
    throw new Error('RUNTIME_HEALTH_HOME_UNCLASSIFIED_FAILURE');
  }
  if (!view || view.schema !== 'PRH_FINANCIAL_HOME_VIEW_V1') {
    throw new Error('RUNTIME_HEALTH_HOME_VIEW_INVALID');
  }
  if (view.financial_truth_policy !== 'FIN-TRUTH-v1' || view.kpi_dictionary_version !== '1.0.0') {
    throw new Error('RUNTIME_HEALTH_HOME_FIN_AUTHORITY_MISMATCH');
  }
  var cards = view.cards && typeof view.cards === 'object' ? view.cards : null;
  var required = ['INCOME', 'EXPENSE', 'CASH_FLOW', 'SAVINGS', 'BUDGET', 'LIQUIDITY', 'ALERTS'];
  if (!cards || required.some(function(id) { return !Object.prototype.hasOwnProperty.call(cards, id); })) {
    throw new Error('RUNTIME_HEALTH_HOME_CARDS_INCOMPLETE');
  }
  if (!view.provenance || view.provenance.ui_financial_formula_used !== false ||
      view.provenance.legacy_total_cells_used !== false ||
      view.provenance.generated_from_canonical_lib !== true ||
      view.provenance.financial_formula_copy !== false ||
      view.provenance.persistent_identity_authority !== false ||
      view.provenance.dimension_resolver !== 'PRH_RUNTIME_DIMENSION_LABEL_HASH_V1' ||
      view.provenance.runtime_bridge !== 'GENERATED_CANONICAL_LIB_BUNDLE') {
    throw new Error('RUNTIME_HEALTH_HOME_PROVENANCE_INVALID');
  }
  return 'PRH_R2_HOME_READ_V3|CANONICAL_LIB|DIMENSION_HASH|OK|7';
}
