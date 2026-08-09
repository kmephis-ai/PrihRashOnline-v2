'use strict';

const fs = require('fs');
const path = require('path');
const {
  assertOutsideRepository,
  normalizeSnapshot
} = require('./mig010-owner');
const {
  normalizeSourceRecord,
  sourceFingerprint
} = require('../lib/migration/migration_reconciliation');
const {
  buildRepairProposal,
  applyRepairResolution,
  PROPOSAL_SCHEMA,
  RESOLUTION_SCHEMA,
  RESOLVED_SCHEMA,
  OCCURRENCE_IDENTITY
} = require('../lib/migration/mig010_repair_policy');

const STATE_SCHEMA = 'MIG010_OWNER_PRIVATE_STATE_V1';
const DIAGNOSTIC_SCHEMA = 'MIG010_OWNER_PRIVATE_DIAGNOSTIC_V1';
const SHA256_RE = /^[0-9a-f]{64}$/;

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function safeReason(error, fallback = 'MIG010_REPAIR_TOOL_FAILED') {
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

function readJson(filePath, reason) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  } catch (_) {
    fail(reason);
  }
}

function writePrivate(filePath, content) {
  const resolved = assertOutsideRepository(filePath, 'MIG010_REPAIR_PRIVATE_PATH_INSIDE_REPOSITORY');
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, { encoding: 'utf8', flag: 'w', mode: 0o600 });
  try { fs.chmodSync(resolved, 0o600); } catch (_) { /* Windows ACL owner-managed. */ }
  return resolved;
}

function writePrivateJson(filePath, value) {
  return writePrivate(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeState(value) {
  if (!value || value.schema !== STATE_SCHEMA || !value.plan || !SHA256_RE.test(String(value.plan.plan_hash || '')) ||
      !SHA256_RE.test(String(value.plan.source_revision || '')) || !SHA256_RE.test(String(value.plan.initial_target_revision || '')) ||
      !value.plan.backup_binding || !SHA256_RE.test(String(value.plan.backup_binding.backupCipherSha256 || ''))) {
    fail('MIG010_REPAIR_STATE_INVALID');
  }
  return value;
}

function normalizeDiagnostic(value) {
  if (!value || value.schema !== DIAGNOSTIC_SCHEMA || !SHA256_RE.test(String(value.plan_hash || '')) ||
      !SHA256_RE.test(String(value.source_revision || '')) || !SHA256_RE.test(String(value.target_revision || ''))) {
    fail('MIG010_REPAIR_DIAGNOSTIC_INVALID');
  }
  return value;
}

function bindInputs(snapshot, state, diagnostic) {
  if (state.plan.plan_hash !== diagnostic.plan_hash ||
      state.plan.source_revision !== diagnostic.source_revision ||
      state.plan.initial_target_revision !== diagnostic.target_revision) {
    fail('MIG010_REPAIR_DIAGNOSTIC_STATE_MISMATCH');
  }
  if (snapshot.backup_cipher_sha256 !== state.plan.backup_binding.backupCipherSha256) {
    fail('MIG010_REPAIR_SNAPSHOT_BACKUP_MISMATCH');
  }
}

function duplicateReviewModel(snapshot, proposal) {
  const byFingerprint = new Map();
  snapshot.source_records.forEach((raw) => {
    try {
      const normalized = normalizeSourceRecord(raw);
      if (normalized.source_quality !== 'VALID') return;
      const fingerprint = sourceFingerprint(normalized);
      if (!byFingerprint.has(fingerprint)) byFingerprint.set(fingerprint, []);
      byFingerprint.get(fingerprint).push({
        source_row: normalized.source_row,
        occurred_at: normalized.occurred_at,
        type: normalized.type,
        amount_minor: normalized.amount_minor,
        currency: normalized.currency,
        name: normalized.name
      });
    } catch (_) { /* invalid source rows are quarantined and are not duplicate decisions */ }
  });

  return {
    schema: 'MIG010_OWNER_PRIVATE_DUPLICATE_REVIEW_V1',
    proposal_hash: proposal.proposal_hash,
    source_revision: proposal.source_revision,
    groups: proposal.duplicate_groups.map((group) => ({
      fingerprint: group.fingerprint,
      records: (byFingerprint.get(group.fingerprint) || []).slice().sort((a, b) => a.source_row - b.source_row)
    }))
  };
}

function safeJsonForHtml(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function reviewHtml(model) {
  const data = safeJsonForHtml(model);
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MIG-010 — private duplicate review</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#f5f5f7;color:#171717}main{max-width:1100px;margin:0 auto;padding:24px}.card{background:white;border:1px solid #ddd;border-radius:12px;padding:18px;margin:16px 0}.row{display:grid;grid-template-columns:90px 210px 110px 130px 1fr;gap:10px;padding:8px 0;border-top:1px solid #eee}.muted{color:#666}.decision{display:flex;gap:16px;flex-wrap:wrap;margin-top:14px}.keep{margin-top:10px}button{padding:10px 16px;border-radius:8px;border:1px solid #bbb;background:white;cursor:pointer}button.primary{background:#171717;color:white;border-color:#171717}.warn{background:#fff8e6;border:1px solid #f0c36d;padding:12px;border-radius:8px}.ok{background:#eef8ee;border:1px solid #a6d5a6;padding:12px;border-radius:8px}@media(max-width:760px){.row{grid-template-columns:1fr}.decision{display:block}.decision label{display:block;margin:8px 0}}</style>
</head>
<body><main>
<h1>MIG-010 — приватная проверка дублей</h1>
<p class="muted">Файл работает полностью локально. Ничего не отправляется в сеть. Выберите решение для каждой группы и скачайте resolution JSON.</p>
<div class="warn">«Сохранить все как отдельные операции» использует versioned occurrence identity ${OCCURRENCE_IDENTITY}. Это создаёт только private rebuild candidate и не разрешает запись в Google Sheets.</div>
<div id="groups"></div>
<div class="card"><button class="primary" id="download">Скачать MIG010 repair resolution</button> <span id="status" class="muted"></span></div>
<script id="model" type="application/json">${data}</script>
<script>
const model=JSON.parse(document.getElementById('model').textContent);const root=document.getElementById('groups');
function esc(s){return String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}
if(model.groups.length===0){root.innerHTML='<div class="card ok">Duplicate-групп нет. Owner decision не требуется.</div>';}else{
model.groups.forEach((g,i)=>{const box=document.createElement('section');box.className='card';box.dataset.fp=g.fingerprint;let html='<h2>Группа '+(i+1)+'</h2><div class="muted">fingerprint: '+esc(g.fingerprint)+'</div>';
g.records.forEach(r=>{html+='<div class="row"><div>row '+esc(r.source_row)+'</div><div>'+esc(r.occurred_at)+'</div><div>'+esc(r.type)+'</div><div>'+esc(r.amount_minor)+' '+esc(r.currency)+'</div><div>'+esc(r.name)+'</div></div>';});
html+='<div class="decision"><label><input type="radio" name="d'+i+'" value="DEDUPLICATE_KEEP_ONE"> Повторная отправка формы — оставить одну</label><label><input type="radio" name="d'+i+'" value="PRESERVE_ALL"> Это разные реальные операции — сохранить все</label><label><input type="radio" name="d'+i+'" value="UNRESOLVED" checked> Не уверен / оставить заблокированным</label></div><div class="keep" hidden>Оставить source row: <select></select></div>';
box.innerHTML=html;const select=box.querySelector('select');g.records.forEach(r=>{const o=document.createElement('option');o.value=String(r.source_row);o.textContent='row '+r.source_row;select.appendChild(o);});
box.querySelectorAll('input[type=radio]').forEach(el=>el.addEventListener('change',()=>{box.querySelector('.keep').hidden=el.value!=='DEDUPLICATE_KEEP_ONE';}));root.appendChild(box);});}
document.getElementById('download').addEventListener('click',()=>{const decisions=[];document.querySelectorAll('section.card[data-fp]').forEach(box=>{const chosen=box.querySelector('input[type=radio]:checked');const entry={fingerprint:box.dataset.fp,decision:chosen?chosen.value:'UNRESOLVED'};if(entry.decision==='DEDUPLICATE_KEEP_ONE')entry.keep_source_row=Number(box.querySelector('select').value);decisions.push(entry);});const payload={schema:'${RESOLUTION_SCHEMA}',proposal_hash:model.proposal_hash,source_revision:model.source_revision,duplicate_decisions:decisions};const blob=new Blob([JSON.stringify(payload,null,2)+'\\n'],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='mig010-repair-resolution.private.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);document.getElementById('status').textContent='Файл resolution создан локально.';});
</script></main></body></html>`;
}

function commandPropose(args) {
  for (const required of ['snapshot', 'state', 'diagnostic', 'proposal']) {
    if (!args[required]) fail('MIG010_REPAIR_PROPOSE_ARGUMENTS_REQUIRED');
  }
  const snapshot = normalizeSnapshot(readJson(assertOutsideRepository(args.snapshot), 'MIG010_REPAIR_SNAPSHOT_READ_FAILED'));
  const state = normalizeState(readJson(assertOutsideRepository(args.state), 'MIG010_REPAIR_STATE_READ_FAILED'));
  const diagnostic = normalizeDiagnostic(readJson(assertOutsideRepository(args.diagnostic), 'MIG010_REPAIR_DIAGNOSTIC_READ_FAILED'));
  bindInputs(snapshot, state, diagnostic);

  const proposal = buildRepairProposal({
    source_records: snapshot.source_records,
    canonical_records: snapshot.canonical_records,
    plan_hash: state.plan.plan_hash,
    source_revision: state.plan.source_revision,
    target_revision: state.plan.initial_target_revision,
    backup_cipher_sha256: snapshot.backup_cipher_sha256,
    mapping_version: snapshot.mapping_version
  });
  writePrivateJson(args.proposal, proposal);
  let reviewWritten = false;
  if (args.review) {
    const model = duplicateReviewModel(snapshot, proposal);
    writePrivate(args.review, reviewHtml(model));
    reviewWritten = true;
  }
  return {
    schema: 'MIG010_OWNER_REPAIR_PROPOSAL_V1',
    status: proposal.status,
    proposalHash: proposal.proposal_hash,
    strategy: proposal.strategy,
    manualDecisionRequired: proposal.manual_decision_required,
    proposalWritten: true,
    reviewWritten,
    financialPayloadStdout: false,
    writeAuthorized: false
  };
}

function commandResolve(args) {
  for (const required of ['snapshot', 'proposal', 'resolution', 'out']) {
    if (!args[required]) fail('MIG010_REPAIR_RESOLVE_ARGUMENTS_REQUIRED');
  }
  const snapshot = normalizeSnapshot(readJson(assertOutsideRepository(args.snapshot), 'MIG010_REPAIR_SNAPSHOT_READ_FAILED'));
  const proposal = readJson(assertOutsideRepository(args.proposal), 'MIG010_REPAIR_PROPOSAL_READ_FAILED');
  if (!proposal || proposal.schema !== PROPOSAL_SCHEMA) fail('MIG010_REPAIR_PROPOSAL_INVALID');
  const resolution = readJson(assertOutsideRepository(args.resolution), 'MIG010_REPAIR_RESOLUTION_READ_FAILED');
  if (!resolution || resolution.schema !== RESOLUTION_SCHEMA) fail('MIG010_REPAIR_RESOLUTION_INVALID');
  const resolved = applyRepairResolution({ proposal, source_records: snapshot.source_records, resolution });
  writePrivateJson(args.out, resolved);
  return {
    schema: 'MIG010_OWNER_REPAIR_RESOLVE_V1',
    status: resolved.status,
    resolvedHash: resolved.resolved_hash,
    proposalHash: resolved.proposal_hash,
    blockers: resolved.blockers,
    targetRebuild: true,
    quarantinePresent: resolved.quarantine.length > 0,
    occurrenceIdentityStrategy: resolved.occurrence_identity_strategy,
    resolvedWritten: true,
    financialPayloadStdout: false,
    writeAuthorized: false
  };
}

function commandContract() {
  return {
    schema: 'MIG010_REPAIR_TOOL_V1',
    privateProposalSchema: PROPOSAL_SCHEMA,
    privateResolutionSchema: RESOLUTION_SCHEMA,
    privateResolvedSchema: RESOLVED_SCHEMA,
    strategy: 'REBUILD_LEGACY_SLICE_V1',
    offlineDuplicateReview: true,
    invalidSourceQuarantine: true,
    preserveAllOccurrenceIdentity: OCCURRENCE_IDENTITY,
    writeCommandEnabled: false,
    financialPayloadStdout: false
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  try {
    let result;
    if (command === 'propose') result = commandPropose(args);
    else if (command === 'resolve') result = commandResolve(args);
    else if (command === 'contract') result = commandContract();
    else if (command === 'execute' || command === 'write' || command === 'apply') fail('MIGRATION_IRREVERSIBLE_ACTION_TOOL_NOT_ENABLED');
    else fail('MIG010_REPAIR_COMMAND_INVALID');
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'FAIL', reason: safeReason(error) })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  normalizeState,
  normalizeDiagnostic,
  bindInputs,
  duplicateReviewModel,
  reviewHtml,
  commandPropose,
  commandResolve,
  commandContract
};
