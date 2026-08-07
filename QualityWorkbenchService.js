/**
 * ПрихРасхOnline v2 — Quality Workbench v1.0.0-rc.1
 *
 * Интерактивный обзор проблем и очередь решений.
 * Разрешены изменения только статуса предложений в «11 Предпросмотр».
 * «01 Операции» остаётся read-only.
 */
const PRH_QUALITY_WORKBENCH = Object.freeze({
  VERSION: '1.0.0-rc.1',
  OPERATIONS: '01 Операции',
  PREVIEW: '11 Предпросмотр',
  MAX_ROWS: 100,
  REVIEWABLE: Object.freeze(['НОВОЕ', 'ПОДТВЕРЖДЕНО', 'ОТКЛОНЕНО']),
  DECISIONS: Object.freeze({ APPROVE: 'ПОДТВЕРЖДЕНО', REJECT: 'ОТКЛОНЕНО', RESET: 'НОВОЕ' })
});

function prhGetQualityWorkbench() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const operations = ss.getSheetByName(PRH_QUALITY_WORKBENCH.OPERATIONS);
  const preview = ss.getSheetByName(PRH_QUALITY_WORKBENCH.PREVIEW);
  if (!operations) throw new Error('Лист «01 Операции» не найден.');
  if (!preview) throw new Error('Лист «11 Предпросмотр» не найден. Новые листы автоматически не создаются.');

  const rows = prhQualityWorkbenchRows_(preview);
  const counts = {};
  rows.forEach(function (item) {
    counts[item.issueType] = (counts[item.issueType] || 0) + 1;
  });

  const grouped = Object.keys(counts).map(function (issueType) {
    return { issueType: issueType, count: counts[issueType], label: prhQualityWorkbenchLabel_(issueType) };
  }).sort(function (a, b) { return b.count - a.count; });

  return {
    version: PRH_QUALITY_WORKBENCH.VERSION,
    readOnlyOperations: true,
    queueCount: rows.length,
    newCount: rows.filter(function (row) { return row.status === 'НОВОЕ'; }).length,
    approvedCount: rows.filter(function (row) { return row.status === 'ПОДТВЕРЖДЕНО'; }).length,
    rejectedCount: rows.filter(function (row) { return row.status === 'ОТКЛОНЕНО'; }).length,
    grouped: grouped,
    next: rows.find(function (row) { return row.status === 'НОВОЕ'; }) || null,
    rows: rows.slice(0, PRH_QUALITY_WORKBENCH.MAX_ROWS)
  };
}

function prhQualityWorkbenchReview(proposalId, decision) {
  proposalId = String(proposalId || '').trim();
  decision = String(decision || '').trim().toUpperCase();
  if (!proposalId) throw new Error('Не указан ID предложения.');
  if (!Object.prototype.hasOwnProperty.call(PRH_QUALITY_WORKBENCH.DECISIONS, decision)) {
    throw new Error('Недопустимое решение. Разрешено: APPROVE / REJECT / RESET.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const preview = ss.getSheetByName(PRH_QUALITY_WORKBENCH.PREVIEW);
  if (!preview) throw new Error('Лист «11 Предпросмотр» не найден.');

  const header = preview.getRange(1, 1, 1, preview.getLastColumn()).getDisplayValues()[0];
  const idColumn = header.indexOf('ID предложения');
  const statusColumn = header.indexOf('Статус');
  const checkedColumn = header.indexOf('Проверено');
  const commentColumn = header.indexOf('Комментарий');
  if (Math.min(idColumn, statusColumn, checkedColumn, commentColumn) < 0) throw new Error('Структура очереди качества повреждена.');

  const lastRow = preview.getLastRow();
  if (lastRow < 2) throw new Error('Очередь качества пуста.');
  const ids = preview.getRange(2, idColumn + 1, lastRow - 1, 1).getDisplayValues();
  const offset = ids.findIndex(function (row) { return String(row[0] || '').trim() === proposalId; });
  if (offset < 0) throw new Error('Предложение не найдено: ' + proposalId);

  const row = offset + 2;
  const status = PRH_QUALITY_WORKBENCH.DECISIONS[decision];
  preview.getRange(row, statusColumn + 1).setValue(status);
  preview.getRange(row, checkedColumn + 1).setValue(new Date());
  preview.getRange(row, commentColumn + 1).setValue('Quality Workbench: ' + decision + '. Финансовая операция не изменялась.');
  SpreadsheetApp.flush();

  const readback = String(preview.getRange(row, statusColumn + 1).getDisplayValue() || '').trim();
  if (readback !== status) throw new Error('Readback статуса очереди не совпал.');
  return { ok: true, proposalId: proposalId, status: status, operationWrite: false };
}

function prhQualityWorkbenchNextIssue() {
  const workbench = prhGetQualityWorkbench();
  if (!workbench.next) return { ok: true, empty: true, message: 'Новых проблем в очереди нет.' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const operations = ss.getSheetByName(PRH_QUALITY_WORKBENCH.OPERATIONS);
  return {
    ok: true,
    empty: false,
    item: workbench.next,
    operationUrl: ss.getUrl() + '#gid=' + operations.getSheetId() + '&range=A' + workbench.next.operationRow + ':S' + workbench.next.operationRow
  };
}

function prhQualityWorkbenchRows_(preview) {
  const lastRow = preview.getLastRow();
  if (lastRow < 2) return [];
  const header = preview.getRange(1, 1, 1, preview.getLastColumn()).getDisplayValues()[0];
  const columns = {
    proposalId: header.indexOf('ID предложения'), operationRow: header.indexOf('Строка операции'),
    operationId: header.indexOf('ID операции'), issueType: header.indexOf('Тип проблемы'),
    field: header.indexOf('Поле'), currentValue: header.indexOf('Текущее значение'),
    proposedValue: header.indexOf('Предложенное значение'), reason: header.indexOf('Основание'),
    confidence: header.indexOf('Уверенность'), status: header.indexOf('Статус')
  };
  Object.keys(columns).forEach(function (key) {
    if (columns[key] < 0) throw new Error('В очереди качества отсутствует поле: ' + key);
  });

  return preview.getRange(2, 1, Math.min(lastRow - 1, PRH_QUALITY_WORKBENCH.MAX_ROWS), preview.getLastColumn())
    .getDisplayValues().map(function (row) {
      return {
        proposalId: row[columns.proposalId],
        operationRow: Number(row[columns.operationRow]),
        operationId: row[columns.operationId],
        issueType: row[columns.issueType],
        issueLabel: prhQualityWorkbenchLabel_(row[columns.issueType]),
        field: row[columns.field],
        currentValue: row[columns.currentValue],
        proposedValue: row[columns.proposedValue],
        reason: row[columns.reason],
        confidence: row[columns.confidence],
        status: row[columns.status]
      };
    }).filter(function (item) { return item.proposalId; });
}

function prhQualityWorkbenchLabel_(issueType) {
  return ({
    MISSING_DATE: 'Без даты',
    INVALID_AMOUNT: 'Нулевая или некорректная сумма',
    MISSING_CATEGORY: 'Без категории',
    MISSING_DESCRIPTION: 'Без описания',
    POSSIBLE_DUPLICATE: 'Возможный дубль'
  })[issueType] || issueType || 'Неизвестная проблема';
}
