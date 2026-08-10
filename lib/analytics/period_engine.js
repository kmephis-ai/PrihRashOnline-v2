'use strict';

const CONTRACT = require('./period_engine.v1.json');
const ANALYTICS = require('./analytics_contract.v1.json');
const SEMANTIC = require('./semantic_registry.v1.json');
const { normalizeAnalyticsQuery, evaluateAnalytics } = require('./analytics_engine');

const SCHEMA = 'PRH_ANALYTICS_PERIOD_ENGINE_V1';
const VERSION = '1.0.0';
const QUERY_SCHEMA = 'PRH_ANALYTICS_PERIOD_QUERY_V1';
const RESULT_SCHEMA = 'PRH_ANALYTICS_PERIOD_RESULT_V1';
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86400000;
const GRAINS = Object.freeze(CONTRACT.grains.slice());
const COMPARISON_MODES = Object.freeze(CONTRACT.comparison_modes.slice());
const SELECTOR_KINDS = Object.freeze(Object.keys(CONTRACT.selectors));

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function exactKeys(value, keys, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(reason);
  return value;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function makeUtcDate(year, month, day) {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function parseDate(value) {
  const text = String(value || '');
  const match = DATE_RE.exec(text);
  if (!match) fail('PERIOD_DATE_INVALID');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) fail('PERIOD_DATE_INVALID');
  const date = makeUtcDate(year, month, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) fail('PERIOD_DATE_INVALID');
  return Object.freeze({ text, year, month, day, time: date.getTime() });
}

function formatDateFromParts(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatTime(time) {
  const date = new Date(time);
  return formatDateFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function addDays(value, days) {
  const parsed = parseDate(value);
  if (!Number.isSafeInteger(days)) fail('PERIOD_DAY_OFFSET_INVALID');
  return formatTime(parsed.time + days * DAY_MS);
}

function daysBetween(start, end) {
  const left = parseDate(start).time;
  const right = parseDate(end).time;
  const days = (right - left) / DAY_MS;
  if (!Number.isSafeInteger(days)) fail('PERIOD_DAY_COUNT_INVALID');
  return days;
}

function compareDate(left, right) {
  return parseDate(left).time - parseDate(right).time;
}

function minDate(left, right) {
  return compareDate(left, right) <= 0 ? left : right;
}

function maxDate(left, right) {
  return compareDate(left, right) >= 0 ? left : right;
}

function daysInMonth(year, month) {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const current = makeUtcDate(year, month, 1).getTime();
  const next = makeUtcDate(nextYear, nextMonth, 1).getTime();
  return (next - current) / DAY_MS;
}

function startOfMonth(value) {
  const date = parseDate(value);
  return formatDateFromParts(date.year, date.month, 1);
}

function startOfQuarter(value) {
  const date = parseDate(value);
  const month = Math.floor((date.month - 1) / 3) * 3 + 1;
  return formatDateFromParts(date.year, month, 1);
}

function startOfYear(value) {
  const date = parseDate(value);
  return formatDateFromParts(date.year, 1, 1);
}

function nextMonthStart(value) {
  const date = parseDate(startOfMonth(value));
  const year = date.month === 12 ? date.year + 1 : date.year;
  const month = date.month === 12 ? 1 : date.month + 1;
  return formatDateFromParts(year, month, 1);
}

function nextQuarterStart(value) {
  const date = parseDate(startOfQuarter(value));
  const total = date.year * 12 + (date.month - 1) + 3;
  return formatDateFromParts(Math.floor(total / 12), total % 12 + 1, 1);
}

function nextYearStart(value) {
  const date = parseDate(startOfYear(value));
  return formatDateFromParts(date.year + 1, 1, 1);
}

function startOfIsoWeek(value) {
  const date = parseDate(value);
  const day = new Date(date.time).getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  return addDays(value, -offset);
}

function nextBoundary(value, grain) {
  if (grain === 'DAY') return addDays(value, 1);
  if (grain === 'WEEK') return addDays(startOfIsoWeek(value), 7);
  if (grain === 'MONTH') return nextMonthStart(value);
  if (grain === 'QUARTER') return nextQuarterStart(value);
  if (grain === 'YEAR') return nextYearStart(value);
  fail('PERIOD_GRAIN_INVALID');
}

function naturalStart(value, grain) {
  if (grain === 'DAY') return value;
  if (grain === 'WEEK') return startOfIsoWeek(value);
  if (grain === 'MONTH') return startOfMonth(value);
  if (grain === 'QUARTER') return startOfQuarter(value);
  if (grain === 'YEAR') return startOfYear(value);
  fail('PERIOD_GRAIN_INVALID');
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION ||
      CONTRACT.query_schema !== QUERY_SCHEMA || CONTRACT.result_schema !== RESULT_SCHEMA || CONTRACT.roadmap_id !== 'ANL-071') {
    fail('PERIOD_CONTRACT_VERSION_INVALID');
  }
  if (!CONTRACT.upstream || CONTRACT.upstream.analytics_contract !== `${ANALYTICS.schema}@${ANALYTICS.version}` ||
      CONTRACT.upstream.semantic_registry !== `${SEMANTIC.schema}@${SEMANTIC.version}` ||
      CONTRACT.upstream.financial_truth_policy !== 'FIN-TRUTH-v1') {
    fail('PERIOD_UPSTREAM_CONTRACT_INVALID');
  }
  if (CONTRACT.calendar.system !== 'PROLEPTIC_GREGORIAN_UTC_DATE_ONLY' ||
      CONTRACT.calendar.range_semantics !== 'HALF_OPEN_START_INCLUSIVE_END_EXCLUSIVE' ||
      CONTRACT.calendar.week_start !== 'MONDAY_ISO' || CONTRACT.calendar.wall_clock_today_allowed !== false) {
    fail('PERIOD_CALENDAR_CONTRACT_INVALID');
  }
  if (CONTRACT.orchestration.mutate_analytics_v1_enum !== false ||
      CONTRACT.orchestration.bucket_query_grain !== 'NONE' ||
      CONTRACT.orchestration.bucket_query_comparison !== 'NONE' ||
      CONTRACT.orchestration.week_and_quarter_via_range_orchestration !== true ||
      CONTRACT.orchestration.kpi_formula_redefinition !== false) {
    fail('PERIOD_ORCHESTRATION_BOUNDARY_INVALID');
  }
  if (!CONTRACT.authorities || Object.values(CONTRACT.authorities).some((value) => value !== false) || CONTRACT.free_only !== true) {
    fail('PERIOD_AUTHORITY_INVALID');
  }
  return true;
}

function rangeObject(start, end, extra) {
  const dayCount = daysBetween(start, end);
  if (dayCount <= 0) fail('PERIOD_RANGE_INVALID');
  return Object.freeze(Object.assign({ start, end, day_count: dayCount }, extra || {}));
}

function resolveSelector(selector) {
  assertContract();
  if (!selector || typeof selector !== 'object' || Array.isArray(selector)) fail('PERIOD_SELECTOR_INVALID');
  const kind = String(selector.kind || '').trim();
  if (!SELECTOR_KINDS.includes(kind)) fail('PERIOD_SELECTOR_KIND_UNKNOWN');
  const definition = CONTRACT.selectors[kind];
  if (kind === 'EXPLICIT_RANGE') {
    exactKeys(selector, ['kind', 'start', 'end'], 'PERIOD_SELECTOR_SHAPE_INVALID');
    parseDate(selector.start);
    parseDate(selector.end);
    const range = rangeObject(selector.start, selector.end, {
      selector_kind: kind,
      as_of: null,
      natural_period: null,
      natural_period_start: null,
      natural_period_end: null,
      partial: false
    });
    return range;
  }

  exactKeys(selector, ['kind', 'as_of'], 'PERIOD_SELECTOR_SHAPE_INVALID');
  parseDate(selector.as_of);
  const end = addDays(selector.as_of, 1);
  if (definition.rolling_days != null) {
    const start = addDays(end, -definition.rolling_days);
    return rangeObject(start, end, {
      selector_kind: kind,
      as_of: selector.as_of,
      natural_period: null,
      natural_period_start: null,
      natural_period_end: null,
      partial: false
    });
  }

  let start;
  let naturalEnd;
  if (definition.natural_period === 'MONTH') {
    start = startOfMonth(selector.as_of);
    naturalEnd = nextMonthStart(start);
  } else if (definition.natural_period === 'QUARTER') {
    start = startOfQuarter(selector.as_of);
    naturalEnd = nextQuarterStart(start);
  } else if (definition.natural_period === 'YEAR') {
    start = startOfYear(selector.as_of);
    naturalEnd = nextYearStart(start);
  } else {
    fail('PERIOD_SELECTOR_DEFINITION_INVALID');
  }
  return rangeObject(start, end, {
    selector_kind: kind,
    as_of: selector.as_of,
    natural_period: definition.natural_period,
    natural_period_start: start,
    natural_period_end: naturalEnd,
    partial: end !== naturalEnd
  });
}

function buildBuckets(rangeInput, grain) {
  const range = rangeObject(rangeInput.start, rangeInput.end);
  const grainId = String(grain || '').trim();
  if (!GRAINS.includes(grainId)) fail('PERIOD_GRAIN_UNKNOWN');
  if (grainId === 'NONE') {
    return Object.freeze([Object.freeze({
      key: `${range.start}/${range.end}`,
      start: range.start,
      end: range.end,
      day_count: range.day_count,
      partial: false,
      natural_start: range.start,
      natural_end: range.end
    })]);
  }

  const buckets = [];
  let cursor = range.start;
  while (compareDate(cursor, range.end) < 0) {
    const natural = naturalStart(cursor, grainId);
    const naturalEnd = nextBoundary(natural, grainId);
    const start = maxDate(cursor, natural);
    const end = minDate(range.end, naturalEnd);
    const dayCount = daysBetween(start, end);
    if (dayCount <= 0) fail('PERIOD_BUCKET_INVALID');
    buckets.push(Object.freeze({
      key: `${grainId}:${natural}`,
      start,
      end,
      day_count: dayCount,
      partial: start !== natural || end !== naturalEnd,
      natural_start: natural,
      natural_end: naturalEnd
    }));
    cursor = end;
  }

  if (buckets.length === 0 || buckets[0].start !== range.start || buckets[buckets.length - 1].end !== range.end) {
    fail('PERIOD_BUCKET_COVERAGE_INVALID');
  }
  let total = 0;
  for (let i = 0; i < buckets.length; i += 1) {
    total += buckets[i].day_count;
    if (i > 0 && buckets[i - 1].end !== buckets[i].start) fail('PERIOD_BUCKET_GAP_OR_OVERLAP');
  }
  if (total !== range.day_count) fail('PERIOD_BUCKET_DAY_COUNT_MISMATCH');
  return Object.freeze(buckets);
}

function previousNaturalBounds(primary) {
  const before = addDays(primary.natural_period_start, -1);
  if (primary.natural_period === 'MONTH') return { start: startOfMonth(before), end: primary.natural_period_start };
  if (primary.natural_period === 'QUARTER') return { start: startOfQuarter(before), end: primary.natural_period_start };
  if (primary.natural_period === 'YEAR') return { start: startOfYear(before), end: primary.natural_period_start };
  fail('PERIOD_NATURAL_COMPARISON_INVALID');
}

function shiftYearClamped(value, deltaYears) {
  const date = parseDate(value);
  const targetYear = date.year + deltaYears;
  if (targetYear < 1 || targetYear > 9999) fail('PERIOD_YEAR_SHIFT_OUT_OF_RANGE');
  const targetDay = Math.min(date.day, daysInMonth(targetYear, date.month));
  return Object.freeze({
    date: formatDateFromParts(targetYear, date.month, targetDay),
    adjusted: targetDay !== date.day
  });
}

function resolveComparison(primary, mode) {
  const comparisonMode = String(mode || '').trim();
  if (!COMPARISON_MODES.includes(comparisonMode)) fail('PERIOD_COMPARISON_MODE_UNKNOWN');
  if (comparisonMode === 'NONE') return null;

  if (comparisonMode === 'PREVIOUS_COMPARABLE_PERIOD') {
    if (primary.natural_period == null) {
      const start = addDays(primary.start, -primary.day_count);
      return rangeObject(start, primary.start, {
        mode: comparisonMode,
        quality: 'EXACT_DAY_COUNT',
        clipped: false,
        leap_adjusted: false
      });
    }
    const bounds = previousNaturalBounds(primary);
    const desiredEnd = addDays(bounds.start, primary.day_count);
    const end = minDate(desiredEnd, bounds.end);
    const result = rangeObject(bounds.start, end, {
      mode: comparisonMode,
      quality: daysBetween(bounds.start, end) === primary.day_count ? 'EXACT_DAY_COUNT' : 'CLIPPED_SHORTER_CALENDAR_PERIOD',
      clipped: compareDate(desiredEnd, bounds.end) > 0,
      leap_adjusted: false
    });
    return result;
  }

  const shiftedStart = shiftYearClamped(primary.start, -1);
  const shiftedEnd = shiftYearClamped(primary.end, -1);
  let end = shiftedEnd.date;
  if (compareDate(end, shiftedStart.date) <= 0) end = addDays(shiftedStart.date, 1);
  const comparison = rangeObject(shiftedStart.date, end, {
    mode: comparisonMode,
    quality: 'CALENDAR_ALIGNED',
    clipped: false,
    leap_adjusted: shiftedStart.adjusted || shiftedEnd.adjusted
  });
  if (comparison.day_count !== primary.day_count) {
    return Object.freeze(Object.assign({}, comparison, { quality: 'CALENDAR_ALIGNED_DAY_COUNT_DIFF' }));
  }
  return comparison;
}

function normalizePeriodSpec(periodInput) {
  exactKeys(periodInput, ['selector', 'grain', 'comparison_mode'], 'PERIOD_SPEC_SHAPE_INVALID');
  const selector = periodInput.selector;
  const primary = resolveSelector(selector);
  const grain = String(periodInput.grain || '').trim();
  const comparisonMode = String(periodInput.comparison_mode || '').trim();
  if (!GRAINS.includes(grain)) fail('PERIOD_GRAIN_UNKNOWN');
  if (!COMPARISON_MODES.includes(comparisonMode)) fail('PERIOD_COMPARISON_MODE_UNKNOWN');
  return Object.freeze({
    selector: Object.freeze({ ...selector }),
    selector_kind: primary.selector_kind,
    grain,
    comparison_mode: comparisonMode,
    primary
  });
}

function buildAnalyticsProbe(input, timeRange) {
  return normalizeAnalyticsQuery({
    schema: 'PRH_ANALYTICS_QUERY_V1',
    contract_version: '1.0.0',
    currency: input.currency,
    measures: input.measures,
    dimensions: input.dimensions,
    filters: input.filters,
    time_range: timeRange,
    grain: 'NONE',
    comparison: { mode: 'NONE' },
    sort: input.sort,
    parameters: input.parameters,
    limit: input.limit
  });
}

function normalizePeriodQuery(input) {
  assertContract();
  exactKeys(input, ['schema', 'contract_version', 'currency', 'measures', 'dimensions', 'filters', 'sort', 'parameters', 'limit', 'period'], 'PERIOD_QUERY_SHAPE_INVALID');
  if (input.schema !== QUERY_SCHEMA || input.contract_version !== VERSION) fail('PERIOD_QUERY_VERSION_INVALID');
  const period = normalizePeriodSpec(input.period);
  const normalizedAnalytics = buildAnalyticsProbe(input, { start: period.primary.start, end: period.primary.end });
  const hasBudgetVariance = normalizedAnalytics.measures.includes('BUDGET_VARIANCE');
  if (hasBudgetVariance && (period.grain !== 'NONE' || period.comparison_mode !== 'NONE')) {
    fail('PERIOD_BUDGET_VARIANCE_TEMPORAL_UNSUPPORTED');
  }
  return Object.freeze({
    schema: QUERY_SCHEMA,
    contract_version: VERSION,
    currency: normalizedAnalytics.currency,
    measures: normalizedAnalytics.measures,
    dimensions: normalizedAnalytics.dimensions,
    filters: normalizedAnalytics.filters,
    sort: normalizedAnalytics.sort,
    parameters: normalizedAnalytics.parameters,
    limit: normalizedAnalytics.limit,
    period
  });
}

function bucketAnalyticsQuery(query, bucket) {
  return Object.freeze({
    schema: 'PRH_ANALYTICS_QUERY_V1',
    contract_version: '1.0.0',
    currency: query.currency,
    measures: query.measures,
    dimensions: query.dimensions,
    filters: query.filters,
    time_range: Object.freeze({ start: bucket.start, end: bucket.end }),
    grain: 'NONE',
    comparison: Object.freeze({ mode: 'NONE' }),
    sort: query.sort,
    parameters: query.parameters,
    limit: query.limit
  });
}

function evaluateBucket(transactions, query, bucket) {
  const analyticsQuery = bucketAnalyticsQuery(query, bucket);
  return Object.freeze({
    key: bucket.key,
    start: bucket.start,
    end: bucket.end,
    day_count: bucket.day_count,
    partial: bucket.partial,
    natural_start: bucket.natural_start,
    natural_end: bucket.natural_end,
    analytics_result: evaluateAnalytics(transactions, analyticsQuery)
  });
}

function evaluatePeriodSeries(transactions, queryInput) {
  const query = normalizePeriodQuery(queryInput);
  const primary = query.period.primary;
  const comparison = resolveComparison(primary, query.period.comparison_mode);
  const primaryBuckets = buildBuckets(primary, query.period.grain);
  const comparisonBuckets = comparison ? buildBuckets(comparison, query.period.grain) : Object.freeze([]);
  const primaryResults = Object.freeze(primaryBuckets.map((bucket) => evaluateBucket(transactions, query, bucket)));
  const comparisonResults = Object.freeze(comparisonBuckets.map((bucket) => evaluateBucket(transactions, query, bucket)));
  return Object.freeze({
    schema: RESULT_SCHEMA,
    contract_version: VERSION,
    selector_kind: primary.selector_kind,
    grain: query.period.grain,
    comparison_mode: query.period.comparison_mode,
    primary_range: primary,
    comparison: comparison ? Object.freeze({ ...comparison }) : null,
    primary_buckets: primaryResults,
    comparison_buckets: comparisonResults,
    provenance: Object.freeze({
      period_engine: `${SCHEMA}@${VERSION}`,
      analytics_contract: `${ANALYTICS.schema}@${ANALYTICS.version}`,
      semantic_registry: `${SEMANTIC.schema}@${SEMANTIC.version}`,
      financial_truth_policy: 'FIN-TRUTH-v1',
      calendar: CONTRACT.calendar.system,
      range_semantics: CONTRACT.calendar.range_semantics,
      orchestration_only: true,
      analytics_v1_enum_mutated: false
    })
  });
}

function serializePeriodSpec(periodInput) {
  const normalized = normalizePeriodSpec(periodInput);
  const safe = {
    selector: normalized.selector,
    grain: normalized.grain,
    comparison_mode: normalized.comparison_mode
  };
  return stableStringify(safe);
}

function periodTelemetry(result) {
  if (!result || result.schema !== RESULT_SCHEMA || result.contract_version !== VERSION) fail('PERIOD_RESULT_INVALID');
  const primaryPartial = result.primary_range.partial === true || result.primary_buckets.some((bucket) => bucket.partial === true);
  const output = {
    schema: SCHEMA,
    version: VERSION,
    selector_kind: result.selector_kind,
    grain: result.grain,
    comparison_mode: result.comparison_mode,
    primary_day_count: result.primary_range.day_count,
    primary_bucket_count: result.primary_buckets.length,
    primary_partial: primaryPartial,
    comparison_day_count: result.comparison ? result.comparison.day_count : 0,
    comparison_bucket_count: result.comparison_buckets.length,
    comparison_quality: result.comparison ? result.comparison.quality : 'NONE',
    comparison_clipped: result.comparison ? result.comparison.clipped === true : false,
    leap_adjusted: result.comparison ? result.comparison.leap_adjusted === true : false
  };
  return Object.freeze(output);
}

module.exports = Object.freeze({
  SCHEMA,
  VERSION,
  QUERY_SCHEMA,
  RESULT_SCHEMA,
  GRAINS,
  COMPARISON_MODES,
  SELECTOR_KINDS,
  CONTRACT,
  assertContract,
  parseDate,
  addDays,
  daysBetween,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  startOfIsoWeek,
  resolveSelector,
  buildBuckets,
  shiftYearClamped,
  resolveComparison,
  normalizePeriodSpec,
  normalizePeriodQuery,
  bucketAnalyticsQuery,
  evaluatePeriodSeries,
  serializePeriodSpec,
  periodTelemetry
});
