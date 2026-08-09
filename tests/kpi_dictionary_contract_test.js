'use strict';

const assert = require('assert');
const {
  DICTIONARY,
  KPI_SCHEMA,
  REQUIRED_KPIS,
  validateDictionary,
  resolveKpiDefinition,
  normalizePeriod,
  assertComparablePeriods,
  evaluateKpis,
  evaluateKpi,
  assertKpiInvariants
} = require('../lib/finance/kpi_dictionary');
const {
  POLICY_VERSION,
  aggregateTransactions
} = require('../lib/finance/financial_reconciliation');
const { generateSyntheticFinanceFixture } = require('./fixtures/synthetic_finance');

const golden = generateSyntheticFinanceFixture({ profile: 'golden' }).transactions;

assert.strictEqual(validateDictionary(), true);
assert.strictEqual(KPI_SCHEMA, 'PRH_KPI_DICTIONARY_V1');
assert.strictEqual(DICTIONARY.version, '1.0.0');
assert.strictEqual(DICTIONARY.financial_truth_policy, POLICY_VERSION);
assert.strictEqual(DICTIONARY.scope.money_representation, 'integer_minor_units');
assert.strictEqual(DICTIONARY.scope.rounding_policy, 'NO_IMPLICIT_ROUNDING');
assert.strictEqual(DICTIONARY.scope.currency_mode, 'SINGLE_CURRENCY');
assert.strictEqual(DICTIONARY.scope.partial_period_policy, 'EXPLICIT_WINDOW_NO_IMPLICIT_PRORATION');
assert.strictEqual(DICTIONARY.provenance.legacy_total_cells_authoritative, false);
assert.strictEqual(DICTIONARY.provenance.ui_or_chart_logic_authoritative, false);
assert.deepStrictEqual(Object.keys(DICTIONARY.kpis).sort(), REQUIRED_KPIS.slice().sort());

for (const id of REQUIRED_KPIS) {
  const definition = resolveKpiDefinition(id);
  assert.strictEqual(typeof definition.formula, 'string');
  assert.strictEqual(definition.unit, 'minor_currency_unit');
}
assert.throws(() => resolveKpiDefinition('UNKNOWN'), /KPI_ID_UNKNOWN/);
assert.throws(() => resolveKpiDefinition('INCOME', '2.0.0'), /KPI_VERSION_UNSUPPORTED/);

// FIN-001 parity: the dictionary must formalize existing canonical truth, not create a second calculation model.
const canonical = aggregateTransactions(golden);
const evaluated = evaluateKpis(golden, { currency: 'USD' });
assert.strictEqual(evaluated.financial_truth_policy, canonical.policy_version);
assert.strictEqual(evaluated.income_minor, canonical.income_minor);
assert.strictEqual(evaluated.expense_minor, canonical.external_expense_minor);
assert.strictEqual(evaluated.cash_flow_minor, canonical.cash_flow_minor);
assert.strictEqual(evaluated.savings_minor, canonical.cash_flow_minor);
assert.strictEqual(evaluated.gross_expense_minor, canonical.gross_expense_minor);
assert.strictEqual(evaluated.refund_minor, canonical.refund_minor);
assert.strictEqual(evaluated.transfer_minor, canonical.transfer_minor);
assert.strictEqual(evaluated.budget_variance_minor, null);
assert.strictEqual(evaluated.provenance.legacy_total_cells_used, false);
assert.strictEqual(assertKpiInvariants(evaluated), true);

// Transfers are measured but neutral to the core household KPIs.
const withoutTransfers = evaluateKpis(golden.filter((row) => row.type !== 'transfer'), { currency: 'USD' });
for (const field of ['income_minor', 'expense_minor', 'cash_flow_minor', 'savings_minor']) {
  assert.strictEqual(evaluated[field], withoutTransfers[field]);
}
assert(evaluated.transfer_minor > 0);

// Refund is expense reduction, not income.
const refund = golden.find((row) => row.type === 'refund');
const refundOnly = evaluateKpis([refund], { currency: 'USD' });
assert.strictEqual(refundOnly.income_minor, 0);
assert.strictEqual(refundOnly.expense_minor, -refund.amount_minor);
assert.strictEqual(refundOnly.cash_flow_minor, refund.amount_minor);
assert.strictEqual(refundOnly.savings_minor, refund.amount_minor);

// Budget variance is plan minus canonical net expense for the same explicit scope.
const budgetMinor = evaluated.expense_minor + 50000;
const withBudget = evaluateKpis(golden, { currency: 'USD', budget_minor: budgetMinor });
assert.strictEqual(withBudget.budget_variance_minor, 50000);
const budgetKpi = evaluateKpi('BUDGET_VARIANCE', golden, { currency: 'USD', budget_minor: budgetMinor });
assert.strictEqual(budgetKpi.value_minor, 50000);
assert.throws(() => evaluateKpi('BUDGET_VARIANCE', golden, { currency: 'USD' }), /KPI_BUDGET_REQUIRED/);
assert.throws(() => evaluateKpis(golden, { currency: 'USD', budget_minor: 10.5 }), /integer minor units/);

// Partial periods are explicit [start,end) windows; no hidden budget or time proration is performed.
const feb = { start: '2024-02-01', end: '2024-03-01', partial: true };
const febRows = golden.filter((row) => row.occurred_at.slice(0, 10) >= feb.start && row.occurred_at.slice(0, 10) < feb.end);
const febCanonical = aggregateTransactions(febRows);
const febKpis = evaluateKpis(golden, { currency: 'USD', period: feb, budget_minor: 30000 });
assert.strictEqual(febKpis.period.kind, 'EXPLICIT_WINDOW');
assert.strictEqual(febKpis.period.partial, true);
assert.strictEqual(febKpis.period.proration, 'NONE');
assert.strictEqual(febKpis.expense_minor, febCanonical.external_expense_minor);
assert.strictEqual(febKpis.cash_flow_minor, febCanonical.cash_flow_minor);
assert.strictEqual(febKpis.budget_variance_minor, 30000 - febCanonical.external_expense_minor);
assert.strictEqual(normalizePeriod(feb).day_count, 29);
assert.throws(() => normalizePeriod({ start: '2024-02-30', end: '2024-03-01', partial: true }), /KPI_PERIOD_START_INVALID/);
assert.throws(() => normalizePeriod({ start: '2024-03-01', end: '2024-03-01' }), /KPI_PERIOD_RANGE_INVALID/);

assert.strictEqual(
  assertComparablePeriods(
    { start: '2024-01-01', end: '2024-02-01', partial: false },
    { start: '2024-03-01', end: '2024-04-01', partial: false }
  ),
  true
);
assert.throws(
  () => assertComparablePeriods(
    { start: '2024-01-01', end: '2024-02-01' },
    { start: '2024-02-01', end: '2024-03-01' }
  ),
  /KPI_PERIODS_NOT_COMPARABLE/
);

// Current KPI Dictionary is deliberately single-currency until the future FX layer exists.
const expense = golden.find((row) => row.type === 'expense');
assert.throws(
  () => evaluateKpis([...golden, { ...expense, transaction_id: 'SYN-EUR', currency: 'EUR' }], { currency: 'USD' }),
  /KPI_MIXED_CURRENCY_UNSUPPORTED/
);
assert.throws(() => evaluateKpis(golden, { currency: 'US' }), /KPI_CURRENCY_INVALID/);
const pendingEur = { ...expense, transaction_id: 'SYN-PENDING-EUR', status: 'pending', currency: 'EUR' };
assert.doesNotThrow(() => evaluateKpis([...golden, pendingEur], { currency: 'USD' }));

// Exact money remains integer minor units end-to-end.
assert.throws(
  () => evaluateKpis([{ ...expense, transaction_id: 'SYN-FLOAT', amount_minor: 1.25 }], { currency: 'USD' }),
  /integer minor units/
);

// Property-style parity over a larger independent deterministic synthetic fixture.
const generated = generateSyntheticFinanceFixture({ profile: 'small', seed: 20260809 }).transactions;
const generatedCanonical = aggregateTransactions(generated);
const generatedKpis = evaluateKpis(generated, { currency: 'USD' });
assert.strictEqual(generatedKpis.income_minor, generatedCanonical.income_minor);
assert.strictEqual(generatedKpis.expense_minor, generatedCanonical.external_expense_minor);
assert.strictEqual(generatedKpis.cash_flow_minor, generatedCanonical.cash_flow_minor);
assert.strictEqual(generatedKpis.savings_minor, generatedCanonical.cash_flow_minor);
assert.strictEqual(assertKpiInvariants(generatedKpis), true);

console.log('kpi_dictionary_contract_test: OK', {
  schema: KPI_SCHEMA,
  version: DICTIONARY.version,
  financialTruthPolicy: DICTIONARY.financial_truth_policy,
  kpis: REQUIRED_KPIS,
  transferNeutral: true,
  refundAsExpenseReduction: true,
  exactMinorUnits: true,
  singleCurrencyFailClosed: true,
  explicitPartialPeriods: true,
  noImplicitProration: true,
  legacyTotalsAuthoritative: false,
  fin001Parity: true
});
