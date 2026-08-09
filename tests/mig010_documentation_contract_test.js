'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const status = read('docs/PROJECT_STATUS.md');
const context = read('.ai-context/PROJECT_CONTEXT.md');
const architecture = read('docs/architecture.md');
const runbook = read('docs/operations/MIG010_FULL_HISTORY_MIGRATION.md');
const llms = read('llms.txt');
const workflow = read('.github/workflows/pr-validation.yml');
const ownerTool = read('tools/mig010-owner.js');
const contract = JSON.parse(read('lib/migration/full_history_migration.v1.json'));

function match(text, pattern, message) {
  assert(pattern.test(text), message);
}

match(status, /ARCH-011[^\n]{0,220}\*\*DONE\*\*|ARCH-011[^\n]{0,220}DONE/i,
  'ARCH-011 must be DONE in current status');
match(status, /MIG-010[^\n]{0,220}\*\*IN_PROGRESS\*\*|MIG-010[^\n]{0,220}IN_PROGRESS/i,
  'MIG-010 must be current IN_PROGRESS item');
match(status, /Private full-history migration[^\n]{0,180}(?:не выполнена|not)/i,
  'status must not claim owner-private migration complete');
match(status, /IRREVERSIBLE_ACTION_AUTHORIZED/,
  'status must expose separate irreversible-action boundary');

match(context, /MIG-010[^\n]{0,180}current P0 writer[^\n]{0,120}Issue #96/i,
  'AI context must identify current MIG-010 writer');
match(context, /ARCH-011[^\n]{0,180}(?:now DONE|DONE)/i,
  'AI context must preserve ARCH-011 completion');
match(context, /GitHub Actions[^\n]{0,220}cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`/i,
  'AI context must deny autonomous irreversible authorization');

match(architecture, /PRH_FULL_HISTORY_MIGRATION_V1/,
  'architecture must identify migration machine contract');
match(architecture, /Current write authority = false/i,
  'architecture must keep current real-write authority false');
match(architecture, /MIGRATION_IRREVERSIBLE_ACTION_TOOL_NOT_ENABLED/,
  'architecture must expose disabled real-write command');

match(runbook, /CODE_READY[\s\S]{0,500}OWNER_PRIVATE_SNAPSHOT[\s\S]{0,500}OWNER_DRY_RUN[\s\S]{0,500}AUTHORIZATION_REQUIRED[\s\S]{0,500}PRIVATE_RECONCILIATION/,
  'runbook migration state machine missing');
match(runbook, /write commands?[^\n]{0,240}(?:не содержит|disabled|выключ)/i,
  'runbook must keep owner tool write disabled');
match(runbook, /private mapper[\s\S]{0,220}вне Git repository/i,
  'runbook must keep private mapper outside repository');
match(runbook, /unexplainedMismatch = 0/,
  'runbook must require zero unexplained mismatch');

assert.strictEqual(contract.schema, 'PRH_FULL_HISTORY_MIGRATION_V1');
assert.strictEqual(contract.batch.max_size, 100);
assert.strictEqual(contract.resume.integrity, 'HMAC-SHA256');
assert.strictEqual(contract.pre_write.authorization, 'IRREVERSIBLE_ACTION_AUTHORIZED');
assert.strictEqual(contract.pre_write.public_ci_can_authorize_real_write, false);
assert.strictEqual(contract.reconciliation.required_unexplained_mismatch, 0);

match(ownerTool, /writeCommandEnabled:\s*false/,
  'owner tool contract must advertise write disabled');
match(ownerTool, /MIGRATION_IRREVERSIBLE_ACTION_TOOL_NOT_ENABLED/,
  'owner tool must fail closed on write command');
match(ownerTool, /MIG010_PRIVATE_MAPPER_INSIDE_REPOSITORY/,
  'owner tool must reject private mapper inside repository');
match(ownerTool, /MIG010_SNAPSHOT_BACKUP_MISMATCH/,
  'owner tool must bind snapshot to backup evidence');

match(workflow, /- name: Full-history migration protocol[\s\S]{0,300}full_history_migration_contract_test\.js[\s\S]{0,300}mig010_owner_tool_contract_test\.js/m,
  'PR Validation must have named full-history migration gate');

for (const required of [
  'docs/operations/MIG010_FULL_HISTORY_MIGRATION.md',
  'lib/migration/full_history_migration.v1.json',
  'lib/migration/full_history_migration.js',
  'tests/full_history_migration_contract_test.js',
  'tools/mig010-owner.js',
  'tests/mig010_owner_tool_contract_test.js'
]) {
  assert(llms.includes(required), `llms.txt missing ${required}`);
}

for (const [name, text] of [
  ['status', status], ['context', context], ['architecture', architecture], ['runbook', runbook], ['llms', llms]
]) {
  assert(!/script\.google\.com\/macros\/s\/|\bAKfy[A-Za-z0-9_-]+\b/.test(text), `${name} contains private runtime locator`);
  assert(!/[A-Z]:\\(?:YandexDisk|PrihRashOnline-Keys|PrihRashOnline(?:\\|$))/i.test(text), `${name} contains owner-private path`);
}

console.log('mig010_documentation_contract_test: OK', {
  currentWriter: 'MIG-010',
  arch011: 'DONE',
  realWriteAuthority: false,
  publicCiCanAuthorizeWrite: false,
  privatePathsOutsideRepository: true,
  unexplainedMismatchRequired: 0
});
