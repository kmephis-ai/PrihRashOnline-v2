'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildPortablePackage } = require('../tools/private-backup');
const { buildMigrationPlan } = require('../lib/migration/full_history_migration');

const root = path.join(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig010-target-blank-date-'));
const privateMapperPath = path.join(temp, 'mapper.js');
const sourceName = 'SYN-SOURCE';
const targetName = 'SYN-TARGET';

function cell(value) {
  if (typeof value === 'number') return { t: 'n', v: value };
  return { t: 's', v: String(value == null ? '' : value) };
}
function cv(value) {
  if (!value || typeof value !== 'object') throw new Error('SYN_CELL_INVALID');
  if (value.t === 'n') return Number(value.v);
  return String(value.v == null ? '' : value.v);
}
const row = (values) => values.map(cell);

const sourceRows = [
  row(['Отметка времени','Тип операции','Счет','Категория','Наименование','Сумма','Счет','Источник','Сумма']),
  row(['','','','','','','','',''])
];
const targetHeaders = ['ID','Дата и время','Дата','Месяц','Тип','Сумма','Счёт','Счёт назначения','Категория','Подкатегория','Наименование','Член семьи','Проект','Теги','Регулярная','Комментарий','Источник','Строка источника','Статус','Исходный тип'];
const targetRows = [
  row(targetHeaders),
  row(['SYN-BAD-TARGET','','','','Расход',25.5,'Основной','','Дом','','Synthetic placeholder','','','','','',sourceName,2,'Перенесено','Расход'])
];

const pkg = buildPortablePackage({
  format: 'PRH_BACKUP_SOURCE_V1', schemaVersion: 1, sheetCount: 2,
  sourceBuildSha: 'a'.repeat(40), sourceTreeHash: 'b'.repeat(64)
}, [
  { metadata: { name: sourceName, index: 0, lastRow: 2, lastColumn: 9 }, rows: sourceRows },
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
  assert.strictEqual(snapshot.source_records.length, 0, 'blank legacy source row must remain absent');
  assert.strictEqual(snapshot.canonical_records.length, 1, 'malformed existing target must remain visible to reconciliation');
  assert.strictEqual(snapshot.canonical_records[0].occurred_at, '1900-01-01T00:00:00Z');

  const plan = buildMigrationPlan({
    source_records: snapshot.source_records,
    canonical_records: snapshot.canonical_records,
    mapping_version: mapper.mappingVersion,
    backup_binding: {
      schema: 'DR-001-EVIDENCE-v1', status: 'PASS', checksum: 'PASS', backupCipherSha256: 'c'.repeat(64)
    }
  });

  assert.strictEqual(plan.status, 'BLOCKED');
  assert(plan.blocked_reasons.includes('SOURCE_MISSING'));
  assert.strictEqual(plan.batches.length, 0, 'no write batch may exist while legacy target anomaly is unresolved');

  console.log('mig010_target_blank_date_contract_test: OK', {
    blankTargetDatePreservedAsDiagnostic: true,
    sourceMissingDetected: true,
    planBlocked: true,
    batches: 0,
    workbookMutation: false
  });
} finally {
  for (const key of Object.keys(process.env)) if (!(key in old)) delete process.env[key];
  for (const [key, value] of Object.entries(old)) process.env[key] = value;
  fs.rmSync(temp, { recursive: true, force: true });
}
