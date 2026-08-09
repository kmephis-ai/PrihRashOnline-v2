'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildPortablePackage } = require('../tools/private-backup');

const root = path.join(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig010-leading-column-'));
const privateMapperPath = path.join(temp, 'mapper.js');
const sourceName = 'SYN-SOURCE';
const targetName = 'SYN-TARGET';

function cell(value) {
  if (typeof value === 'number') return { t: 'n', v: value };
  return { t: 's', v: String(value == null ? '' : value) };
}
function cv(value) { return value.t === 'n' ? Number(value.v) : String(value.v == null ? '' : value.v); }
const row = (values) => values.map(cell);

const sourceRows = [
  row(['', 'Отметка времени', 'Тип операции', 'Счет', 'Категория', 'Наименование', 'Сумма', 'Счет', 'Источник', 'Сумма']),
  row(['', '2025-01-02T10:00:00.000Z', 'Расход', 'Основной', 'Дом', 'Synthetic', 25.5, '', '', ''])
];
const targetHeaders = ['ID','Дата и время','Дата','Месяц','Тип','Сумма','Счёт','Счёт назначения','Категория','Подкатегория','Наименование','Член семьи','Проект','Теги','Регулярная','Комментарий','Источник','Строка источника','Статус','Исходный тип'];
const targetRows = [
  row(targetHeaders),
  row(['SYN-1','2025-01-02T10:00:00.000Z','','','Расход',25.5,'Основной','','Дом','','Synthetic','','','','','',sourceName,2,'Перенесено','Расход'])
];
const pkg = buildPortablePackage({
  format: 'PRH_BACKUP_SOURCE_V1', schemaVersion: 1, sheetCount: 2,
  sourceBuildSha: 'a'.repeat(40), sourceTreeHash: 'b'.repeat(64)
}, [
  { metadata: { name: sourceName, index: 0, lastRow: 2, lastColumn: 10 }, rows: sourceRows },
  { metadata: { name: targetName, index: 1, lastRow: 2, lastColumn: 20 }, rows: targetRows }
], '2026-08-09T08:00:00.000Z');

const old = { ...process.env };
try {
  fs.copyFileSync(path.join(root, 'tools', 'mig010-private-mapper-leading-columns.example.js'), privateMapperPath);
  process.env.MIG010_REPO_ROOT = root;
  process.env.MIG010_SOURCE_SHEET = sourceName;
  process.env.MIG010_TARGET_SHEET = targetName;
  process.env.MIG010_SOURCE_LABEL = sourceName;
  process.env.MIG010_CURRENCY = 'RUB';
  const mapper = require(privateMapperPath);
  const snapshot = mapper.buildSnapshot({ backupPackage: pkg, cellValue: cv });
  assert.strictEqual(snapshot.source_records.length, 1);
  assert.strictEqual(snapshot.canonical_records.length, 1);
  assert.strictEqual(snapshot.source_records[0].source_row, 2);
  assert.strictEqual(snapshot.source_records[0].type, 'expense');
  assert.strictEqual(snapshot.source_records[0].amount_minor, 2550);
  assert.strictEqual(snapshot.source_records[0].source_system, 'GOOGLE_FORM_LEGACY');
  assert.strictEqual(snapshot.source_records[0].source_sheet, sourceName);
  assert.strictEqual(snapshot.canonical_records[0].provenance.source_system, 'GOOGLE_FORM_LEGACY');
  assert.strictEqual(snapshot.canonical_records[0].provenance.source_container, sourceName);
  assert.strictEqual(snapshot.canonical_records[0].provenance.source_position, 'row:2');

  const dateAlias = JSON.parse(JSON.stringify(pkg));
  dateAlias.content.sheets[0].rows[0][1] = cell('Дата');
  const dateSnapshot = mapper.buildSnapshot({ backupPackage: dateAlias, cellValue: cv });
  assert.strictEqual(dateSnapshot.source_records.length, 1);

  const bad = JSON.parse(JSON.stringify(pkg));
  bad.content.sheets[0].rows[0][0] = cell('NOT-EMPTY');
  assert.throws(() => mapper.buildSnapshot({ backupPackage: bad, cellValue: cv }), /MIG010_PRIVATE_SOURCE_HEADER_BLOCK_NOT_FOUND/);

  const unknownTimestampHeader = JSON.parse(JSON.stringify(pkg));
  unknownTimestampHeader.content.sheets[0].rows[0][1] = cell('Время');
  assert.throws(() => mapper.buildSnapshot({ backupPackage: unknownTimestampHeader, cellValue: cv }), /MIG010_PRIVATE_SOURCE_HEADER_BLOCK_NOT_FOUND/);

  console.log('mig010_leading_columns_mapper_contract_test: OK', {
    oneEmptyLeadingColumnAccepted: true,
    timestampAliases: ['Дата', 'Отметка времени'],
    sourceSystemMachineSafe: true,
    sourceContainerHumanReadable: true,
    sourceRowPreserved: true,
    nonEmptyPrefixRejected: true,
    unknownTimestampHeaderRejected: true,
    fuzzyMapping: false
  });
} finally {
  for (const key of Object.keys(process.env)) if (!(key in old)) delete process.env[key];
  for (const [key, value] of Object.entries(old)) process.env[key] = value;
  fs.rmSync(temp, { recursive: true, force: true });
}
