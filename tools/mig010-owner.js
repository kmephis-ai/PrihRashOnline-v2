'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  MIGRATION_SCHEMA,
  RESUME_SCHEMA,
  buildMigrationPlan,
  createInitialResumeToken,
  decodeResumeToken
} = require('../lib/migration/full_history_migration');

const SNAPSHOT_SCHEMA = 'MIG010_OWNER_PRIVATE_SNAPSHOT_V1';
const STATE_SCHEMA = 'MIG010_OWNER_PRIVATE_STATE_V1';
const DR_EVIDENCE_SCHEMA = 'DR-001-EVIDENCE-v1';

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function safeReason(error, fallback = 'MIG010_OWNER_TOOL_FAILED') {
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

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

function readJson(filePath, reason) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  } catch (_) {
    fail(reason);
  }
}

function writePrivateJson(filePath, value) {
  ensureParent(filePath);
  fs.writeFileSync(path.resolve(filePath), `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'w',
    mode: 0o600
  });
  try { fs.chmodSync(path.resolve(filePath), 0o600); } catch (_) { /* Windows ACL owner-managed. */ }
}

function createResumeSecret(filePath) {
  const resolved = path.resolve(filePath);
  ensureParent(resolved);
  const secret = crypto.randomBytes(32).toString('base64');
  fs.writeFileSync(resolved, `${secret}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  try { fs.chmodSync(resolved, 0o600); } catch (_) { /* Windows ACL owner-managed. */ }
  return { status: 'SECRET_CREATED' };
}

function readResumeSecret(filePath) {
  let text;
  try { text = fs.readFileSync(path.resolve(filePath), 'utf8').trim(); } catch (_) { fail('MIG010_RESUME_SECRET_FILE_INVALID'); }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) fail('MIG010_RESUME_SECRET_FILE_INVALID');
  const secret = Buffer.from(text, 'base64');
  if (secret.length !== 32) fail('MIG010_RESUME_SECRET_LENGTH_INVALID');
  return secret;
}

function normalizeSnapshot(snapshot) {
  if (!snapshot || snapshot.schema !== SNAPSHOT_SCHEMA || !Array.isArray(snapshot.source_records) ||
      !Array.isArray(snapshot.canonical_records)) {
    fail('MIG010_PRIVATE_SNAPSHOT_INVALID');
  }
  const mappingVersion = String(snapshot.mapping_version || '').trim();
  if (!mappingVersion || mappingVersion.length > 80) fail('MIG010_PRIVATE_MAPPING_VERSION_INVALID');
  return {
    schema: SNAPSHOT_SCHEMA,
    mapping_version: mappingVersion,
    source_records: snapshot.source_records,
    canonical_records: snapshot.canonical_records
  };
}

function normalizeBackupEvidence(evidence) {
  if (!evidence || evidence.schema !== DR_EVIDENCE_SCHEMA || evidence.status !== 'PASS' || evidence.checksum !== 'PASS' ||
      !/^[0-9a-f]{64}$/.test(String(evidence.backupCipherSha256 || ''))) {
    fail('MIG010_BACKUP_EVIDENCE_INVALID');
  }
  return {
    schema: DR_EVIDENCE_SCHEMA,
    status: 'PASS',
    checksum: 'PASS',
    backupCipherSha256: String(evidence.backupCipherSha256)
  };
}

function privateStateFromPlan(plan, resumeToken) {
  return {
    schema: STATE_SCHEMA,
    created_at: new Date().toISOString(),
    plan: {
      schema: plan.schema,
      version: plan.version,
      status: plan.status,
      source_revision: plan.source_revision,
      initial_target_revision: plan.initial_target_revision,
      transform_version: plan.transform_version,
      mapping_version: plan.mapping_version,
      backup_binding: plan.backup_binding,
      batch_size: plan.batch_size,
      plan_hash: plan.plan_hash,
      dry_run: plan.dry_run,
      blocked_reasons: plan.blocked_reasons,
      batches: plan.batches
    },
    resume_token: resumeToken || null
  };
}

function publicDryRunResult(plan, stateWritten) {
  return {
    schema: 'MIG010_OWNER_DRY_RUN_V1',
    status: plan.status,
    planHash: plan.plan_hash,
    sourceRevisionHash: plan.source_revision,
    initialTargetRevisionHash: plan.initial_target_revision,
    backupCipherSha256: plan.backup_binding.backupCipherSha256,
    blocked: plan.status !== 'READY',
    blockedReasons: plan.status === 'READY' ? [] : Array.from(new Set(plan.blocked_reasons)).sort(),
    stateWritten: Boolean(stateWritten),
    writeAuthorized: false
  };
}

function commandDryRun(args) {
  for (const required of ['snapshot', 'backup-evidence', 'secret', 'state']) {
    if (!args[required]) fail('MIG010_OWNER_DRY_RUN_ARGUMENTS_REQUIRED');
  }
  const snapshot = normalizeSnapshot(readJson(args.snapshot, 'MIG010_PRIVATE_SNAPSHOT_READ_FAILED'));
  const backup = normalizeBackupEvidence(readJson(args['backup-evidence'], 'MIG010_BACKUP_EVIDENCE_READ_FAILED'));
  const secret = readResumeSecret(args.secret);
  const batchSize = args['batch-size'] == null ? undefined : Number(args['batch-size']);
  const plan = buildMigrationPlan({
    source_records: snapshot.source_records,
    canonical_records: snapshot.canonical_records,
    mapping_version: snapshot.mapping_version,
    backup_binding: backup,
    batch_size: batchSize
  });
  const resumeToken = plan.status === 'READY' ? createInitialResumeToken(plan, secret) : null;
  writePrivateJson(args.state, privateStateFromPlan(plan, resumeToken));
  return publicDryRunResult(plan, true);
}

function normalizePrivateState(state) {
  if (!state || state.schema !== STATE_SCHEMA || !state.plan || state.plan.schema !== MIGRATION_SCHEMA) {
    fail('MIG010_PRIVATE_STATE_INVALID');
  }
  return state;
}

function commandVerifyState(args) {
  if (!args.state || !args.secret) fail('MIG010_VERIFY_STATE_ARGUMENTS_REQUIRED');
  const state = normalizePrivateState(readJson(args.state, 'MIG010_PRIVATE_STATE_READ_FAILED'));
  const secret = readResumeSecret(args.secret);
  if (state.plan.status === 'READY') {
    if (!state.resume_token) fail('MIG010_PRIVATE_STATE_RESUME_MISSING');
    const resume = decodeResumeToken(state.resume_token, secret);
    if (resume.schema !== RESUME_SCHEMA || resume.plan_hash !== state.plan.plan_hash ||
        resume.expected_revision !== state.plan.initial_target_revision || resume.next_batch !== 0) {
      fail('MIG010_PRIVATE_STATE_BINDING_INVALID');
    }
  } else if (state.resume_token !== null) {
    fail('MIG010_BLOCKED_STATE_RESUME_FORBIDDEN');
  }
  return {
    schema: 'MIG010_OWNER_STATE_VERIFY_V1',
    status: 'PASS',
    planHash: state.plan.plan_hash,
    planStatus: state.plan.status,
    resumeBound: state.plan.status === 'READY',
    writeAuthorized: false
  };
}

function commandContract() {
  return {
    schema: 'MIG010_OWNER_TOOL_V1',
    privateSnapshotSchema: SNAPSHOT_SCHEMA,
    privateStateSchema: STATE_SCHEMA,
    dryRun: true,
    writeCommandEnabled: false,
    irreversibleActionRequired: true,
    realFinancialPayloadStdout: false
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  try {
    let result;
    if (command === 'init-secret') {
      if (!args.out) fail('MIG010_SECRET_OUTPUT_REQUIRED');
      result = createResumeSecret(args.out);
    } else if (command === 'dry-run') {
      result = commandDryRun(args);
    } else if (command === 'verify-state') {
      result = commandVerifyState(args);
    } else if (command === 'contract') {
      result = commandContract();
    } else if (command === 'execute' || command === 'write' || command === 'apply') {
      fail('MIGRATION_IRREVERSIBLE_ACTION_TOOL_NOT_ENABLED');
    } else {
      fail('MIG010_OWNER_COMMAND_INVALID');
    }
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'FAIL', reason: safeReason(error) })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  SNAPSHOT_SCHEMA,
  STATE_SCHEMA,
  parseArgs,
  readResumeSecret,
  normalizeSnapshot,
  normalizeBackupEvidence,
  privateStateFromPlan,
  publicDryRunResult,
  commandDryRun,
  commandVerifyState,
  commandContract
};
