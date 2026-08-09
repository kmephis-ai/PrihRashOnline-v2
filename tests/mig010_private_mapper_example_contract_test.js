'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildPortablePackage } = require('../tools/private-backup');
const { buildMigrationPlan } = require('../lib/migration/full_history_migration');

const root = path.join(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig010-private-mapper-'));
const privateMapperPath = path.join(temp, 'private-mapper.js');
const SOURCE_SHEET = 'SYN-SOURCE-HISTORY';
const TARGET_SHEET = 'SYN-CANONICAL-TARGET';
const SOURCE_LABEL = 'SYN-SOURCE-HISTORY';

function cell(value) {
  if (value instanceof Date) return { t: 'd', v: value.toISOString() };
  if (typeof value === 'number') return { t: 'n', v: value };
  if (typeof value === 'boolean') return { t: 'b', v: value };
  return { t: 's', v: String(value == null ? '' : value) };
}

function cellValue(value) {
  if (value.t === 'd' || value.t === 's') return String(value.v == null ? '' : value.v);
  if (value.t === 'n') return Number(value.v);
  if (value.t === 'b') return Boolean(value.v);
  throw new Error('SYN_CELL_INVALID');
}

function encodedRow(values) {
  return values.map(cell);
}

const sourceHeaders = [
  'Дата', 'Тип операции', 'Счет', 'Категория', 'Наименование', 'Сумма',
  'Счет', 'Источник', 'Сумма', 'Extra-J', 'Extra-K'
];
const sourceRows = [
  sourceHeaders,
  ['2025-01-02T10:00:00.000Z', 'Расход', 'Основной', 'Дом', 'Synthetic home', 25.50, '', '', '', '', ''],
  ['2025-01-03T10:00:00.000Z', 'Доход', '', '', '', '', 'Основной', 'Synthetic income', 1000.00, '', '']
].map(encodedRow);

const targetHeaders = [
  'ID', 'Дата и время', 'Дата', 'Месяц', 'Тип', 'Сумма', 'Счёт', 'Счёт назначения',
  'Категория', 'Подкатегория', 'Наименование', 'Член семьи', 'Проект', 'Теги',
  'Регулярная', 'Комментарий', 'Источник', 'Строка источника', 'Статус', 'Исходный тип'
];

function targetRows(amount = 25.50) {
  return [
    targetHeaders,
    ['SYN-TX-001', '2025-01-02T10:00:00.000Z', '', '', 'Расход', amount, 'Основной', '',
      'Дом', '', 'Synthetic home', '', '', '', '', '', SOURCE_LABEL, 2, 'Перенесено', 'Расход']
  ].map(encodedRow);
}

function pkg(targetAmount = 25.50) {
  return buildPortablePackage({
    format: 'PRH_BACKUP_SOURCE_V1',
    schemaVersion: 1,
    sheetCount: 2,
    sourceBuildSha: 'a'.repeat(40),
    sourceTreeHash: 'b'.repeat(64)
  }, [
    { metadata: { name: SOURCE_SHEET, index: 0, lastRow: sourceRows.length, lastColumn: sourceHeaders.length }, rows: sourceRows },
    { metadata: { name: TARGET_SHEET, index: 1, lastRow: 2, lastColumn: targetHeaders.length }, rows: targetRows(targetAmount) }
  ], '2026-08-09T08:00:00.000Z');
}

const oldEnv = {
  MIG010_REPO_ROOT: process.env.MIG010_REPO_ROOT,
  MIG010_SOURCE_SHEET: process.env.MIG010_SOURCE_SHEET,
  MIG010_TARGET_SHEET: process.env.MIG010_TARGET_SHEET,
  MIG010_SOURCE_LABEL: process.env.MIG010_SOURCE_LABEL,
  MIG010_CURRENCY: process.env.MIG010_CURRENCY
};

try {
  fs.copyFileSync(path.join(root, 'tools', 'mig010-private-mapper.example.js'), privateMapperPath);
  process.env.MIG010_REPO_ROOT = root;
  process.env.MIG010_SOURCE_SHEET = SOURCE_SHEET;
  process.env.MIG010_TARGET_SHEET = TARGET_SHEET;
  process.env.MIG010_SOURCE_LABEL = SOURCE_LABEL;
  process.env.MIG010_CURRENCY = 'RUB';

  let mapper = require(privateMapperPath);
  assert.strictEqual(mapper.schema, 'MIG010_OWNER_PRIVATE_MAPPER_V1');
  const cleanSnapshot = mapper.buildSnapshot({ backupPackage: pkg(), cellValue });
  assert.strictEqual(cleanSnapshot.source_records.length, 2);
  assert.strictEqual(cleanSnapshot.canonical_records.length, 1);
  assert.strictEqual(cleanSnapshot.source_records[0].type, 'expense');
  assert.strictEqual(cleanSnapshot.source_records[1].type, 'income');
  assert.strictEqual(cleanSnapshot.source_records[0].amount_minor, 2550);
  assert.strictEqual(cleanSnapshot.source_records[1].amount_minor, 100000);
  assert.strictEqual(cleanSnapshot.canonical_records[0].provenance.source_position, 'row:2');
  assert.strictEqual(cleanSnapshot.canonical_records[0].provenance.identity_strategy, 'CONTENT_FINGERPRINT_V1');

  const cleanPlan = buildMigrationPlan({
    source_records: cleanSnapshot.source_records,
    canonical_records: cleanSnapshot.canonical_records,
    mapping_version: mapper.mappingVersion,
    backup_binding: {
      schema: 'DR-001-EVIDENCE-v1', status: 'PASS', checksum: 'PASS', backupCipherSha256: 'c'.repeat(64)
    }
  });
  assert.strictEqual(cleanPlan.status, 'READY');
  assert.strictEqual(cleanPlan.existing_target_preflight, 'PASS');
  assert.strictEqual(cleanPlan.dry_run.filter((item) => item.action === 'REUSE').length, 1);
  assert.strictEqual(cleanPlan.dry_run.filter((item) => item.action === 'INSERT').length, 1);
  assert.strictEqual(cleanPlan.batches.length, 1);

  delete require.cache[require.resolve(privateMapperPath)];
  mapper = require(privateMapperPath);
  const driftSnapshot = mapper.buildSnapshot({ backupPackage: pkg(26.00), cellValue });
  const driftPlan = buildMigrationPlan({
    source_records: driftSnapshot.source_records,
    canonical_records: driftSnapshot.canonical_records,
    mapping_version: mapper.mappingVersion,
    backup_binding: {
      schema: 'DR-001-EVIDENCE-v1', status: 'PASS', checksum: 'PASS', backupCipherSha256: 'c'.repeat(64)
    }
  });
  assert.strictEqual(driftPlan.status, 'BLOCKED');
  assert.strictEqual(driftPlan.existing_target_preflight, 'BLOCKED');
  assert(driftPlan.blocked_reasons.includes('CORE_MISMATCH'));
  assert.strictEqual(driftPlan.batches.length, 0);

  console.log('mig010_private_mapper_example_contract_test: OK', {
    splitExpenseIncomeMapping: true,
    sourceProvenanceRestored: true,
    cleanExistingReuse: true,
    coreDriftBlockedBeforeInsert: true,
    privateConfigInEnvironmentOnly: true
  });
} finally {
  for (const [key, value] of Object.entries(oldEnv)) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(temp, { recursive: true, force: true });
}
