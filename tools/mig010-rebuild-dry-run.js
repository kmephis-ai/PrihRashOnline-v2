'use strict';

const fs = require('fs');
const path = require('path');
const { assertOutsideRepository, normalizeSnapshot } = require('./mig010-owner');
const {
  applyRepairResolution,
  PROPOSAL_SCHEMA,
  RESOLUTION_SCHEMA,
  RESOLVED_SCHEMA
} = require('../lib/migration/mig010_repair_policy');
const {
  validateCanonicalCollection,
  assertMigrationFingerprintParity
} = require('../lib/domain/canonical_transaction');
const { repositoryRevision } = require('../lib/repository/transaction_repository');

const SHA256_RE = /^[0-9a-f]{64}$/;

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function safeReason(error, fallback = 'MIG010_REBUILD_DRY_RUN_FAILED') {
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
  const resolved = assertOutsideRepository(filePath, 'MIG010_REBUILD_PRIVATE_PATH_INSIDE_REPOSITORY');
  try {
    return JSON.parse(fs.readFileSync(path.resolve(resolved), 'utf8'));
  } catch (_) {
    fail(reason);
  }
}

function verifyResolvedCandidate(input) {
  const { snapshot, proposal, resolution, resolved } = input || {};
  if (!snapshot || !proposal || !resolution || !resolved) fail('MIG010_REBUILD_VERIFY_INPUT_INVALID');
  if (proposal.schema !== PROPOSAL_SCHEMA) fail('MIG010_REBUILD_PROPOSAL_INVALID');
  if (resolution.schema !== RESOLUTION_SCHEMA) fail('MIG010_REBUILD_RESOLUTION_INVALID');
  if (resolved.schema !== RESOLVED_SCHEMA) fail('MIG010_REBUILD_RESOLVED_INVALID');
  if (resolved.write_authorized !== false) fail('MIG010_REBUILD_WRITE_AUTHORITY_INVALID');

  const recomputed = applyRepairResolution({
    proposal,
    source_records: snapshot.source_records,
    resolution
  });
  if (recomputed.resolved_hash !== resolved.resolved_hash ||
      recomputed.proposal_hash !== resolved.proposal_hash ||
      recomputed.source_revision !== resolved.source_revision ||
      recomputed.target_revision !== resolved.target_revision) {
    fail('MIG010_REBUILD_RESOLVED_BINDING_INVALID');
  }

  if (recomputed.status !== 'READY_FOR_REBUILD_DRY_RUN') {
    return Object.freeze({
      schema: 'MIG010_OWNER_REBUILD_DRY_RUN_V1',
      status: 'BLOCKED',
      resolvedHash: recomputed.resolved_hash,
      blockers: recomputed.blockers,
      writeAuthorized: false
    });
  }

  const candidate = validateCanonicalCollection(recomputed.canonical_candidate);
  candidate.forEach((tx) => {
    if (tx.provenance.identity_strategy === 'CONTENT_FINGERPRINT_V1' ||
        tx.provenance.identity_strategy === 'CONTENT_FINGERPRINT_OCCURRENCE_V1') {
      assertMigrationFingerprintParity(tx);
    }
  });
  const revision = repositoryRevision(candidate);
  if (!SHA256_RE.test(revision)) fail('MIG010_REBUILD_CANDIDATE_REVISION_INVALID');

  return Object.freeze({
    schema: 'MIG010_OWNER_REBUILD_DRY_RUN_V1',
    status: 'PASS',
    resolvedHash: recomputed.resolved_hash,
    candidateRevisionHash: revision,
    targetRevisionHash: recomputed.target_revision,
    reconciliationReady: true,
    financialPayloadStdout: false,
    writeAuthorized: false
  });
}

function commandVerify(args) {
  for (const required of ['snapshot', 'proposal', 'resolution', 'resolved']) {
    if (!args[required]) fail('MIG010_REBUILD_VERIFY_ARGUMENTS_REQUIRED');
  }
  const snapshot = normalizeSnapshot(readPrivateJson(args.snapshot, 'MIG010_REBUILD_SNAPSHOT_READ_FAILED'));
  const proposal = readPrivateJson(args.proposal, 'MIG010_REBUILD_PROPOSAL_READ_FAILED');
  const resolution = readPrivateJson(args.resolution, 'MIG010_REBUILD_RESOLUTION_READ_FAILED');
  const resolved = readPrivateJson(args.resolved, 'MIG010_REBUILD_RESOLVED_READ_FAILED');
  return verifyResolvedCandidate({ snapshot, proposal, resolution, resolved });
}

function commandContract() {
  return {
    schema: 'MIG010_REBUILD_DRY_RUN_TOOL_V1',
    recomputeFromOwnerResolution: true,
    exactResolvedBinding: true,
    canonicalValidation: true,
    migrationFingerprintParity: true,
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
    else if (command === 'execute' || command === 'write' || command === 'apply') {
      fail('MIGRATION_IRREVERSIBLE_ACTION_TOOL_NOT_ENABLED');
    } else fail('MIG010_REBUILD_COMMAND_INVALID');
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'FAIL', reason: safeReason(error) })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  readPrivateJson,
  verifyResolvedCandidate,
  commandVerify,
  commandContract
};
