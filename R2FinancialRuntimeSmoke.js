/**
 * Authenticated privacy-safe proof that the canonical R2 Financial Home can
 * build its private read-only view model from the currently deployed workbook.
 *
 * The returned scalar contains no amounts, categories, account IDs, row values,
 * runtime locators or other household payload.
 */
function prhR2FinancialHomeReadSmokeToken() {
  if (typeof prhR2BuildFinancialHomeRuntime_ !== 'function') {
    throw new Error('R2_HOME_RUNTIME_BUILDER_MISSING');
  }
  var view = prhR2BuildFinancialHomeRuntime_();
  if (!view || view.schema !== 'PRH_FINANCIAL_HOME_VIEW_V1') {
    throw new Error('R2_HOME_RUNTIME_VIEW_INVALID');
  }
  if (view.financial_truth_policy !== 'FIN-TRUTH-v1' || view.kpi_dictionary_version !== '1.0.0') {
    throw new Error('R2_HOME_RUNTIME_FIN_AUTHORITY_MISMATCH');
  }
  var cards = view.cards && typeof view.cards === 'object' ? view.cards : null;
  var required = ['INCOME', 'EXPENSE', 'CASH_FLOW', 'SAVINGS', 'BUDGET', 'LIQUIDITY', 'ALERTS'];
  if (!cards || required.some(function(id) { return !Object.prototype.hasOwnProperty.call(cards, id); })) {
    throw new Error('R2_HOME_RUNTIME_CARDS_INCOMPLETE');
  }
  if (!view.provenance || view.provenance.ui_financial_formula_used !== false ||
      view.provenance.legacy_total_cells_used !== false) {
    throw new Error('R2_HOME_RUNTIME_PROVENANCE_INVALID');
  }
  return 'PRH_R2_HOME_READ_V1|OK|7';
}
