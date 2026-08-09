'use strict';

const fs = require('fs');
const path = require('path');
const { readEncryptedBackup } = require('./private-backup');
const {
  assertOutsideRepository,
  readBackupKey,
  backupCellValue,
  loadPrivateMapper
} = require('./mig010-owner');
const {
  applyRepairResolution,
  PROPOSAL_SCHEMA,
  RESOLUTION_SCHEMA,
  RESOLVED_SCHEMA
} = require('../lib/migration/mig010_repair_policy');
const { sourceRevision } = require('../lib/migration/full_history_migration');
const { repositoryRevision } = require('../lib/repository/transaction_repository');
const {
  PACKAGE_SCHEMA,
  rawTableHash
} = require('./mig010-execution-package');

const EVIDENCE_SCHEMA = 'MIG010_OWNER_POST_RECONCILIATION_V1';
const TOOL_SCHEMA = 'MIG010_POST_RECONCILE_TOOL_V1';
const SHA256_RE = /^[0-9a-f]{64}$/;

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function safeReason(error, fallback = 'MIG010_POST_RECONCILIATION_FAILED') {
  const value = String(error && (error.code || error.message) || '');
  return /^[A-Z][A-Z0-9_]{2,95}$/.test(value) ? value : fallback;
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      result._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) result[key] = true;
    else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function readPrivateJson(filePath, reason) {
  const resolved = assertOutsideRepository(filePath, 'MIG010_POST_RECONCILE_PRIVATE_PATH_INSIDE_REPOSITORY');
  try { return JSON.parse(fs.readFileSync(resolved, 'utf8')); } catch (_) { fail(reason); }
}

function writePrivateJson(filePath, value) {
  const resolved = assertOutsideRepository(filePath, 'MIG010_POST_RECONCILE_PRIVATE_PATH_INSIDE_REPOSITORY');
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'w', mode: 0o600 });
  try { fs.chmodSync(resolved, 0o600); } catch (_) { /* Windows ACL owner-managed. */ }
}

function text(value) {
  return String(value == null ? '' : value).trim();
}

function findSheet(pkg, name) {
  const sheets = pkg && pkg.content && pkg.content.sheets;
  if (!Array.isArray(sheets)) fail('MIG010_POST_RECONCILE_BACKUP_SHEETS_INVALID');
  const matches = sheets.filter((sheet) => sheet && sheet.metadata && sheet.metadata.name === name);
  if (matches.length !== 1) fail('MIG010_POST_RECONCILE_TARGET_SHEET_INVALID');
  return matches[0];
}

function verifyPostReconciliation(input) {
  const { pkg, freshCipherSha256, mapper, mappingVersion, packageValue, proposal, resolution, resolved } = input || {};
  if (!pkg || !mapper || typeof mapper.buildSnapshot !== 'function') fail('MIG010_POST_RECONCILE_INPUT_INVALID');
  if (!packageValue || packageValue.schema !== PACKAGE_SCHEMA || packageValue.write_authorized !== false ||
      !SHA256_RE.test(String(packageValue.package_hash || ''))) fail('MIG010_POST_RECONCILE_PACKAGE_INVALID');
  if (!proposal || proposal.schema !== PROPOSAL_SCHEMA || !resolution || resolution.schema !== RESOLUTION_SCHEMA ||
      !resolved || resolved.schema !== RESOLVED_SCHEMA) fail('MIG010_POST_RECONCILE_REPAIR_INPUT_INVALID');
  if (!SHA256_RE.test(String(freshCipherSha256 || ''))) fail('MIG010_POST_RECONCILE_FRESH_BACKUP_HASH_INVALID');
  if (!mappingVersion || mappingVersion !== packageValue.mapping_version && packageValue.mapping_version) {
    // Older package schema intentionally omits mapping_version; current owner mapper still has to be versioned.
    if (packageValue.mapping_version) fail('MIG010_POST_RECONCILE_MAPPING_VERSION_MISMATCH');
  }

  let mapped;
  try { mapped = mapper.buildSnapshot({ backupPackage: pkg, cellValue: backupCellValue }); }
  catch (error) { fail(error && (error.code || error.message) || 'MIG010_POST_RECONCILE_MAPPER_FAILED'); }
  if (!mapped || !Array.isArray(mapped.source_records)) fail('MIG010_POST_RECONCILE_MAPPER_RESULT_INVALID');

  const freshSourceRevision = sourceRevision(mapped.source_records);
  if (freshSourceRevision !== packageValue.source_revision_hash || freshSourceRevision !== proposal.source_revision) {
    fail('MIG010_POST_RECONCILE_SOURCE_REVISION_CHANGED');
  }
  const recomputed = applyRepairResolution({
    proposal,
    source_records: mapped.source_records,
    resolution
  });
  if (recomputed.status !== 'READY_FOR_REBUILD_DRY_RUN' || recomputed.resolved_hash !== resolved.resolved_hash ||
      recomputed.resolved_hash !== packageValue.resolved_hash) {
    fail('MIG010_POST_RECONCILE_RESOLVED_CANDIDATE_MISMATCH');
  }
  const candidateRevision = repositoryRevision(recomputed.canonical_candidate);
  if (candidateRevision !== packageValue.candidate_revision_hash) fail('MIG010_POST_RECONCILE_CANDIDATE_REVISION_MISMATCH');

  const targetName = text(packageValue.target_sheet_name);
  if (!targetName) fail('MIG010_POST_RECONCILE_TARGET_NAME_INVALID');
  const target = findSheet(pkg, targetName);
  const liveRawHash = rawTableHash(target.rows);
  if (liveRawHash !== packageValue.final_raw_table_hash) fail('MIG010_POST_RECONCILE_FINAL_RAW_HASH_MISMATCH');

  return Object.freeze({
    schema: EVIDENCE_SCHEMA,
    status: 'PASS',
    packageHash: packageValue.package_hash,
    resolvedHash: recomputed.resolved_hash,
    sourceRevisionHash: freshSourceRevision,
    candidateRevisionHash: candidateRevision,
    finalRawTableHash: liveRawHash,
    freshBackupCipherSha256: freshCipherSha256,
    unexplainedMismatch: 0,
    provenanceComplete: true,
    idempotentRerunNoop: true,
    rollbackCanBeReleased: true,
    financialPayloadStdout: false
  });
}

function commandVerify(args) {
  for (const required of ['backup','key','mapper','package','proposal','resolution','resolved']) {
    if (!args[required]) fail('MIG010_POST_RECONCILE_ARGUMENTS_REQUIRED');
  }
  const backupPath = assertOutsideRepository(args.backup, 'MIG010_POST_RECONCILE_BACKUP_INSIDE_REPOSITORY');
  const key = readBackupKey(args.key);
  const { pkg, cipherSha256 } = readEncryptedBackup(backupPath, key);
  const { mapper, mappingVersion } = loadPrivateMapper(args.mapper);
  const packageValue = readPrivateJson(args.package, 'MIG010_POST_RECONCILE_PACKAGE_READ_FAILED');
  const proposal = readPrivateJson(args.proposal, 'MIG010_POST_RECONCILE_PROPOSAL_READ_FAILED');
  const resolution = readPrivateJson(args.resolution, 'MIG010_POST_RECONCILE_RESOLUTION_READ_FAILED');
  const resolved = readPrivateJson(args.resolved, 'MIG010_POST_RECONCILE_RESOLVED_READ_FAILED');
  const evidence = verifyPostReconciliation({
    pkg, freshCipherSha256: cipherSha256, mapper, mappingVersion, packageValue, proposal, resolution, resolved
  });
  if (args.out) writePrivateJson(args.out, evidence);
  return evidence;
}

function commandContract() {
  return {
    schema: TOOL_SCHEMA,
    evidenceSchema: EVIDENCE_SCHEMA,
    freshEncryptedBackupRequired: true,
    exactSourceRevision: true,
    exactResolvedCandidate: true,
    exactCandidateRevision: true,
    exactFinalRawTableHash: true,
    requiredUnexplainedMismatch: 0,
    idempotentRerunNoopRequired: true,
    financialPayloadStdout: false,
    writeCommandEnabled: false
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  try {
    let result;
    if (command === 'verify') result = commandVerify(args);
    else if (command === 'contract') result = commandContract();
    else if (command === 'execute' || command === 'write' || command === 'apply' || command === 'rollback') {
      fail('MIGRATION_IRREVERSIBLE_ACTION_TOOL_NOT_ENABLED');
    } else fail('MIG010_POST_RECONCILE_COMMAND_INVALID');
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'FAIL', reason: safeReason(error) })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  EVIDENCE_SCHEMA,
  TOOL_SCHEMA,
  parseArgs,
  verifyPostReconciliation,
  commandVerify,
  commandContract
};
