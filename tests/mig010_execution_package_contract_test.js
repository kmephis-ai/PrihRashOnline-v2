'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { buildPortablePackage } = require('../tools/private-backup');
const baseMapper = require('../tools/mig010-private-mapper.example');
const { normalizeSnapshot } = require('../tools/mig010-owner');
const {
  buildRepairProposal,
  applyRepairResolution,
  RESOLUTION_SCHEMA,
  OCCURRENCE_IDENTITY
} = require('../lib/migration/mig010_repair_policy');
const { sourceRevision } = require('../lib/migration/full_history_migration');
const { repositoryRevision } = require('../lib/repository/transaction_repository');
const {
  PACKAGE_SCHEMA,
  MAX_BATCH_ROWS,
  buildExecutionPackage,
  commandContract
} = require('../tools/mig010-execution-package');

const SOURCE = 'SYN-LEGACY-SOURCE';
const TARGET = 'SYN-TARGET';
const BACKUP_HASH = 'a'.repeat(64);

function cell(value, formula) {
  let encoded;
  if (value instanceof Date) encoded = { t: 'd', v: value.toISOString() };
  else if (typeof value === 'number') encoded = { t: 'n', v: value };
  else if (typeof value === 'boolean') encoded = { t: 'b', v: value };
  else encoded = { t: 's', v: String(value == null ? '' : value) };
  if (formula) encoded.f = formula;
  return encoded;
}
function row(values) { return values.map((value) => cell(value)); }
function cellValue(encoded) {
  if (encoded.t === 'n') return Number(encoded.v);
  if (encoded.t === 'b') return Boolean(encoded.v);
  return String(encoded.v == null ? '' : encoded.v);
}

const sourceHeaders = ['Дата','Тип операции','Счет','Категория','Наименование','Сумма','Счет','Источник','Сумма'];
const sourceRows = [
  row(sourceHeaders),
  row(['2025-07-01T10:00:00Z','Расход','Основной','Дом','Synthetic repeated',42.00,'','','']),
  row(['2025-07-01T10:00:00Z','Расход','Основной','Дом','Synthetic repeated',42.00,'','',''])
];

const targetHeaders = [
  'ID','Дата и время','Дата','Месяц','Тип','Сумма','Счёт','Счёт назначения','Категория','Подкатегория',
  'Наименование','Член семьи','Проект','Теги','Регулярная','Комментарий','Источник','Строка источника','Статус','Исходный тип'
];
function targetDataRow(id, sourceLabel, sourceRow, name) {
  const values = [
    cell(id), cell('2025-07-01T10:00:00Z'),
    cell('2025-07-01', '=IF(B2="";"";INT(B2))'),
    cell('2025-07-01', '=IF(C2="";"";DATE(YEAR(C2);MONTH(C2);1))'),
    cell('Расход'), cell(42), cell('Основной'), cell(''), cell('Дом'), cell(''), cell(name),
    cell(''), cell(''), cell(''), cell(''), cell(''), cell(sourceLabel), cell(sourceRow), cell('Перенесено'), cell('Расход')
  ];
  return values;
}
const targetRows = [
  row(targetHeaders),
  targetDataRow('OLD-SCOPED', SOURCE, 2, 'Synthetic repeated'),
  targetDataRow('KEEP-OTHER', 'OTHER-SOURCE', 77, 'Synthetic retained')
];

const pkg = buildPortablePackage({
  format: 'PRH_BACKUP_SOURCE_V1', schemaVersion: 1, sheetCount: 2,
  sourceBuildSha: 'b'.repeat(40), sourceTreeHash: 'c'.repeat(64)
}, [
  { metadata: { name: SOURCE, index: 0, lastRow: sourceRows.length, lastColumn: sourceHeaders.length }, rows: sourceRows },
  { metadata: { name: TARGET, index: 1, lastRow: targetRows.length, lastColumn: targetHeaders.length }, rows: targetRows }
], '2026-08-09T10:00:00.000Z');

const oldEnv = {
  MIG010_REPO_ROOT: process.env.MIG010_REPO_ROOT,
  MIG010_SOURCE_SHEET: process.env.MIG010_SOURCE_SHEET,
  MIG010_TARGET_SHEET: process.env.MIG010_TARGET_SHEET,
  MIG010_SOURCE_LABEL: process.env.MIG010_SOURCE_LABEL,
  MIG010_CURRENCY: process.env.MIG010_CURRENCY
};

try {
  process.env.MIG010_REPO_ROOT = require('path').join(__dirname, '..');
  process.env.MIG010_SOURCE_SHEET = SOURCE;
  process.env.MIG010_TARGET_SHEET = TARGET;
  process.env.MIG010_SOURCE_LABEL = SOURCE;
  process.env.MIG010_CURRENCY = 'RUB';

  const mapped = baseMapper.buildSnapshot({ backupPackage: pkg, cellValue });
  const snapshot = normalizeSnapshot({
    schema: 'MIG010_OWNER_PRIVATE_SNAPSHOT_V1',
    mapping_version: baseMapper.mappingVersion,
    backup_cipher_sha256: BACKUP_HASH,
    source_records: mapped.source_records,
    canonical_records: mapped.canonical_records
  });
  assert.strictEqual(snapshot.source_records.length, 2);
  assert.strictEqual(snapshot.canonical_records.length, 1);

  const proposal = buildRepairProposal({
    source_records: snapshot.source_records,
    canonical_records: snapshot.canonical_records,
    plan_hash: 'd'.repeat(64),
    source_revision: sourceRevision(snapshot.source_records),
    target_revision: repositoryRevision(snapshot.canonical_records),
    backup_cipher_sha256: BACKUP_HASH,
    mapping_version: snapshot.mapping_version
  });
  assert.strictEqual(proposal.status, 'OWNER_DECISION_REQUIRED');
  const resolution = {
    schema: RESOLUTION_SCHEMA,
    proposal_hash: proposal.proposal_hash,
    source_revision: proposal.source_revision,
    duplicate_decisions: proposal.duplicate_groups.map((group) => ({
      fingerprint: group.fingerprint,
      decision: 'PRESERVE_ALL'
    }))
  };
  const resolved = applyRepairResolution({
    proposal,
    source_records: snapshot.source_records,
    resolution
  });
  assert.strictEqual(resolved.status, 'READY_FOR_REBUILD_DRY_RUN');
  assert.strictEqual(resolved.occurrence_identity_strategy, OCCURRENCE_IDENTITY);

  const executionPackage = buildExecutionPackage({
    pkg,
    cipherSha256: BACKUP_HASH,
    snapshot,
    proposal,
    resolution,
    resolved,
    sourceName: SOURCE,
    targetName: TARGET,
    sourceLabel: SOURCE
  });

  assert.strictEqual(executionPackage.schema, PACKAGE_SCHEMA);
  assert.strictEqual(executionPackage.write_authorized, false);
  assert(/^[0-9a-f]{64}$/.test(executionPackage.package_hash));
  assert(/^[0-9a-f]{64}$/.test(executionPackage.current_raw_table_hash));
  assert(/^[0-9a-f]{64}$/.test(executionPackage.final_raw_table_hash));
  assert.strictEqual(executionPackage.candidate_revision_hash, repositoryRevision(resolved.canonical_candidate));
  assert(executionPackage.batches.every((batch) => batch.rows.length <= MAX_BATCH_ROWS));

  const allRows = executionPackage.batches.flatMap((batch) => batch.rows);
  assert.strictEqual(allRows.length, 3, 'one unrelated target + two preserved occurrences expected');
  assert.strictEqual(allRows[0][0].v, 'KEEP-OTHER', 'non-scoped target row must be retained');
  assert.strictEqual(allRows[0][16].v, 'OTHER-SOURCE');
  assert.strictEqual(allRows[0][2].f, '=IF(B2="";"";INT(B2))');
  assert.strictEqual(allRows[0][3].f, '=IF(C2="";"";DATE(YEAR(C2);MONTH(C2);1))');

  const rebuilt = allRows.slice(1);
  assert.notStrictEqual(rebuilt[0][0].v, rebuilt[1][0].v, 'PRESERVE_ALL occurrences need distinct transaction IDs');
  assert(rebuilt.every((item) => item[16].v === SOURCE));
  assert(rebuilt.every((item) => item[18].v === 'Перенесено'));
  assert.deepStrictEqual(rebuilt.map((item) => item[17].v).sort((a, b) => a - b), [2, 3]);
  assert.strictEqual(rebuilt[0][2].f, '=IF(B3="";"";INT(B3))');
  assert.strictEqual(rebuilt[1][2].f, '=IF(B4="";"";INT(B4))');

  const contract = commandContract();
  assert.strictEqual(contract.writeCommandEnabled, false);
  assert.strictEqual(contract.maxBatchRows, 100);
  assert.strictEqual(contract.retainNonScopedTargetRows, true);
  assert.strictEqual(contract.rawTableHashBinding, true);

  console.log('mig010_execution_package_contract_test: OK', {
    preserveAllOccurrenceIdentity: true,
    nonScopedRowsRetained: true,
    rawTableHashBinding: true,
    maxBatchRows: 100,
    writeAuthority: false
  });
} finally {
  for (const [key, value] of Object.entries(oldEnv)) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
}
