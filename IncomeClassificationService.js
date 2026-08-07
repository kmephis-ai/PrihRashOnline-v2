/**
 * ПрихРасхOnline v2 — Explainable Income Classification v1.0.0-rc.1
 *
 * Предлагает категорию, уверенность и объяснение.
 * Никогда не записывает предложение в «01 Операции».
 * Подтверждённые пользователем правила хранятся в DocumentProperties.
 */
const PRH_CLASSIFICATION = Object.freeze({
  VERSION: '1.0.0-rc.1',
  OPERATIONS: '01 Операции',
  RULE_PREFIX: 'prh_income_rule:',
  OTHER: 'Другое',
  MIN_EXAMPLES: 2,
  MAX_EXAMPLES: 8
});

function prhSuggestIncomeCategory(description, amount) {
  const text = prhClassificationNormalize_(description);
  const numericAmount = Number(amount || 0);
  if (!text) return { category: '', confidence: 0, source: 'NONE', reason: 'Недостаточно текста для классификации.' };

  const confirmed = prhClassificationFindConfirmedRule_(text);
  if (confirmed) {
    return {
      category: confirmed.category,
      confidence: 0.99,
      source: 'CONFIRMED_RULE',
      reason: 'Совпало подтверждённое пользователем правило «' + confirmed.pattern + '».'
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PRH_CLASSIFICATION.OPERATIONS);
  if (!sheet) throw new Error('Лист «01 Операции» не найден.');
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return { category: '', confidence: 0, source: 'HISTORY', reason: 'История операций пуста.' };

  const header = values[0].map(function (value) { return String(value || '').trim(); });
  const typeIndex = prhClassificationHeader_(header, ['Тип', 'Тип операции']);
  const categoryIndex = prhClassificationHeader_(header, ['Категория']);
  const descriptionIndex = prhClassificationHeader_(header, ['Наименование', 'Описание', 'Комментарий', 'Назначение']);
  const amountIndex = prhClassificationHeader_(header, ['Сумма', 'Сумма операции']);
  if (Math.min(typeIndex, categoryIndex, descriptionIndex) < 0) throw new Error('Недостаточно колонок для классификации.');

  const candidates = {};
  values.slice(1).forEach(function (row) {
    if (String(row[typeIndex] || '').trim().toLowerCase() !== 'доход') return;
    const category = String(row[categoryIndex] || '').trim();
    if (!category || category === PRH_CLASSIFICATION.OTHER) return;
    const candidateText = prhClassificationNormalize_(row[descriptionIndex]);
    if (!candidateText) return;

    const similarity = prhClassificationSimilarity_(text, candidateText);
    if (similarity < 0.35) return;
    const candidateAmount = amountIndex >= 0 ? prhClassificationNumber_(row[amountIndex]) : 0;
    const amountScore = numericAmount > 0 && candidateAmount > 0
      ? Math.max(0, 1 - Math.abs(numericAmount - candidateAmount) / Math.max(numericAmount, candidateAmount))
      : 0;
    const score = similarity * 0.85 + amountScore * 0.15;
    if (!candidates[category]) candidates[category] = { category: category, count: 0, score: 0, examples: [] };
    candidates[category].count += 1;
    candidates[category].score += score;
    if (candidates[category].examples.length < PRH_CLASSIFICATION.MAX_EXAMPLES) {
      candidates[category].examples.push({ similarity: similarity, amountScore: amountScore });
    }
  });

  const ranked = Object.keys(candidates).map(function (category) {
    const item = candidates[category];
    const average = item.score / item.count;
    const support = Math.min(1, item.count / 5);
    return {
      category: item.category,
      count: item.count,
      confidence: Math.min(0.95, average * 0.8 + support * 0.2)
    };
  }).sort(function (a, b) { return b.confidence - a.confidence || b.count - a.count; });

  const best = ranked[0];
  if (!best || best.count < PRH_CLASSIFICATION.MIN_EXAMPLES || best.confidence < 0.55) {
    return {
      category: '', confidence: best ? best.confidence : 0, source: 'HISTORY',
      reason: 'Нет достаточно уверенного исторического совпадения. Требуется ручной выбор.', alternatives: ranked.slice(0, 3)
    };
  }

  return {
    category: best.category,
    confidence: Number(best.confidence.toFixed(2)),
    source: 'HISTORY',
    reason: 'Категория встречалась в ' + best.count + ' похожих доходных операциях; учитывались текст и близость суммы.',
    alternatives: ranked.slice(1, 3)
  };
}

function prhConfirmIncomeClassificationRule(pattern, category) {
  const normalized = prhClassificationNormalize_(pattern);
  category = String(category || '').trim();
  if (normalized.length < 3) throw new Error('Правило должно содержать не менее 3 значимых символов.');
  if (!category || category === PRH_CLASSIFICATION.OTHER) throw new Error('Нужна конкретная подтверждённая категория, отличная от «Другое».');

  const key = PRH_CLASSIFICATION.RULE_PREFIX + Utilities.base64EncodeWebSafe(normalized).replace(/=+$/g, '');
  const payload = JSON.stringify({
    pattern: normalized,
    category: category,
    confirmedAt: new Date().toISOString(),
    confirmedBy: Session.getEffectiveUser().getEmail() || 'user',
    version: PRH_CLASSIFICATION.VERSION
  });
  PropertiesService.getDocumentProperties().setProperty(key, payload);
  return { ok: true, pattern: normalized, category: category, operationWrite: false };
}

function prhListIncomeClassificationRules() {
  const all = PropertiesService.getDocumentProperties().getProperties();
  return Object.keys(all).filter(function (key) { return key.indexOf(PRH_CLASSIFICATION.RULE_PREFIX) === 0; })
    .map(function (key) {
      try { return JSON.parse(all[key]); } catch (error) { return null; }
    }).filter(Boolean).sort(function (a, b) { return String(b.confirmedAt).localeCompare(String(a.confirmedAt)); });
}

function prhClassificationFindConfirmedRule_(text) {
  const rules = prhListIncomeClassificationRules();
  return rules.find(function (rule) { return text.indexOf(rule.pattern) >= 0; }) || null;
}

function prhClassificationHeader_(headers, aliases) {
  const normalized = headers.map(function (value) { return String(value || '').trim().toLowerCase(); });
  for (let i = 0; i < aliases.length; i += 1) {
    const index = normalized.indexOf(String(aliases[i]).toLowerCase());
    if (index >= 0) return index;
  }
  return -1;
}

function prhClassificationNormalize_(value) {
  return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, ' ').replace(/\s+/g, ' ').trim();
}

function prhClassificationTokens_(text) {
  return Array.from(new Set(prhClassificationNormalize_(text).split(' ').filter(function (token) { return token.length >= 3; })));
}

function prhClassificationSimilarity_(a, b) {
  if (a === b) return 1;
  const left = prhClassificationTokens_(a);
  const right = prhClassificationTokens_(b);
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  const intersection = left.filter(function (token) { return rightSet.has(token); }).length;
  const union = new Set(left.concat(right)).size;
  return union ? intersection / union : 0;
}

function prhClassificationNumber_(value) {
  const normalized = String(value || '').replace(/[^0-9,.-]/g, '').replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}
