'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const docs = {
  readme: read('README.md'),
  release: read('docs/RELEASE_PROCESS.md'),
  architecture: read('docs/architecture.md'),
  pureCore: read('docs/architecture/PURE_DOMAIN_APPLICATION_CORE.md'),
  dashboard: read('docs/dashboard.md'),
  dataModel: read('docs/data-model.md'),
  userGuide: read('docs/user-guide.md'),
  status: read('docs/PROJECT_STATUS.md'),
  kpiDictionary: read('docs/finance/KPI_DICTIONARY.md'),
  canonicalSchema: read('docs/data/CANONICAL_TRANSACTION_SCHEMA.md'),
  dr: read('docs/operations/DR001_DIRECT_OWNER_BACKUP.md'),
  observability: read('docs/operations/OBS001_AUDIT_TELEMETRY.md'),
  finops: read('docs/operations/FINOPS001_FREE_ONLY_GUARD.md'),
  historySecurity: read('docs/security/PUBLIC_HISTORY_REMEDIATION_PLAN.md'),
  prValidation: read('.github/workflows/pr-validation.yml'),
  trustedDeploy: read('.github/workflows/trusted-dev-deploy.yml'),
  runtimeHealth: read('.github/workflows/trusted-runtime-health.yml'),
  mainVerification: read('.github/workflows/main-verification.yml')
};

const failures = [];

function requireMatch(ruleId, text, pattern, description) {
  if (!pattern.test(text)) failures.push({ ruleId, description });
}

function forbidMatch(ruleId, text, pattern, description) {
  if (pattern.test(text)) failures.push({ ruleId, description });
}

const currentOperationalDocs = [
  ['README.md', docs.readme],
  ['docs/RELEASE_PROCESS.md', docs.release],
  ['docs/architecture.md', docs.architecture],
  ['docs/architecture/PURE_DOMAIN_APPLICATION_CORE.md', docs.pureCore],
  ['docs/dashboard.md', docs.dashboard],
  ['docs/data-model.md', docs.dataModel],
  ['docs/user-guide.md', docs.userGuide],
  ['docs/PROJECT_STATUS.md', docs.status],
  ['docs/finance/KPI_DICTIONARY.md', docs.kpiDictionary],
  ['docs/data/CANONICAL_TRANSACTION_SCHEMA.md', docs.canonicalSchema]
];

for (const [name, text] of currentOperationalDocs) {
  forbidMatch('DOC_STALE_RC_STATUS', text, /v1\.0\.0-rc\.1|Income Dashboard v1\.0 RC|Web Dashboard v1\.0 RC/i,
    `${name}: stale RC status/instruction`);
  forbidMatch('DOC_PUBLIC_RUNTIME_LOCATOR', text, /script\.google\.com\/macros\/s\/|\bAKfy[A-Za-z0-9_-]+\b/,
    `${name}: public runtime/deployment locator`);
}

requireMatch('DOC_RELEASE_SNAPSHOT_RETIRED', docs.release,
  /Штатная модель \*\*не использует\*\* release snapshot branches, ограничения по числу commits/i,
  'Release process must explicitly retire release-snapshot/commit-count gates');
requireMatch('DOC_RELEASE_LEGACY_SECTION', docs.release,
  /Следующие механизмы исторические и не должны возвращаться[\s\S]{0,900}agent\/release\/\*\*[\s\S]{0,900}Chat-Driven DEV Release[\s\S]{0,900}post-merge direct commit/i,
  'Release process must keep legacy release mechanics in an explicit retired section');
forbidMatch('DOC_RELEASE_ACTIVE_SNAPSHOT_INSTRUCTION', docs.release,
  /(?:create|созда(?:ть|йте)|build|rebuild|пересобер)[^\n]{0,100}agent\/release\//i,
  'Release process must not prescribe a release snapshot branch');
forbidMatch('DOC_RELEASE_ACTIVE_COMMIT_GATE', docs.release,
  /(?:must|должен|требуется|require)[^\n]{0,120}(?:максимум|maximum|max|не более)[^\n]{0,40}10[^\n]{0,20}commit/i,
  'Release process must not prescribe a commit-count gate');
forbidMatch('DOC_RELEASE_ACTIVE_POST_MERGE_WRITE', docs.release,
  /(?:must|должен|требуется|update|обновить)[^\n]{0,120}post-merge[^\n]{0,80}(?:README|Dashboard URL)/i,
  'Release process must not prescribe a post-merge README/runtime-locator write');

requireMatch('DOC_README_R0_BASELINE', docs.readme, /R0 platform baseline/,
  'README must identify the proven R0 platform baseline');
requireMatch('DOC_README_PRIVATE_MYSELF', docs.readme, /MYSELF/,
  'README must state the private Web App access boundary');
requireMatch('DOC_README_SYNTHETIC_ONLY', docs.readme, /independently generated synthetic|независимо сгенерированные synthetic/i,
  'README must state independently generated synthetic public finance data');
requireMatch('DOC_README_FREE_ONLY', docs.readme, /FREE_ONLY/,
  'README must state executable FREE_ONLY policy');
requireMatch('DOC_README_DR_OBS_FINOPS', docs.readme, /DR-001[\s\S]*OBS-001[\s\S]*FINOPS-001/,
  'README must summarize recovery/observability/cost baseline');

const deliveryAnchors = [
  ['PR Validation', /PR Validation/],
  ['Trusted DEV Deploy', /Trusted DEV Deploy/],
  ['Trusted Runtime Health', /Trusted Runtime Health/],
  ['CI-003 autonomous squash merge', /CI-003[\s\S]{0,80}autonomous squash merge/i],
  ['Main Verification', /Main Verification/]
];
for (const [label, pattern] of deliveryAnchors) {
  requireMatch(`DOC_RELEASE_${label.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`, docs.release, pattern,
    `Release process missing ${label}`);
}
requireMatch('DOC_RELEASE_ZERO_SECRET', docs.release, /zero-secret|zero deploy secrets/i,
  'Release process must state zero-secret PR validation');
requireMatch('DOC_RELEASE_EXACT_SHA', docs.release, /exact PR head SHA|exact candidate SHA|exact-SHA/i,
  'Release process must require exact SHA identity');
requireMatch('DOC_RELEASE_ISSUE_STATE', docs.release, /IN_PROGRESS[\s\S]{0,80}DONE/,
  'Release process must document Roadmap Issue state transition');
requireMatch('DOC_RELEASE_NO_ANON_HEALTH', docs.release, /Anonymous `curl`|anonymous Web App health/i,
  'Release process must reject anonymous private-runtime health as authoritative');
requireMatch('DOC_RELEASE_NO_MANUAL_MARKER', docs.release, /manual runtime marker/i,
  'Release process must explicitly retire manual runtime marker');

requireMatch('DOC_ARCH_GITHUB_CONTROL_PLANE', docs.architecture, /GitHub[^\n]{0,100}control plane/i,
  'Architecture must identify GitHub control plane');
requireMatch('DOC_ARCH_ADAPTER_TARGET', docs.architecture, /Google Sheets adapter[\s\S]{0,180}(?:future )?YDB adapter/i,
  'Architecture must state adapter-based target');
requireMatch('DOC_ARCH_FINANCIAL_TRUTH', docs.architecture, /Legacy[^\n]{0,100}(?:golden truth|authoritative)/i,
  'Architecture must reject legacy totals as financial truth');
requireMatch('DOC_ARCH_TRUST_CHAIN', docs.architecture, /PR Validation[\s\S]*Trusted DEV Deploy[\s\S]*Trusted Runtime Health[\s\S]*Main Verification/,
  'Architecture must match exact delivery trust chain');
requireMatch('DOC_ARCH_PUBLIC_REAL_DERIVED_FORBIDDEN', docs.architecture, /real-derived/,
  'Architecture must forbid real-derived public financial data');
requireMatch('DOC_ARCH_PURE_CORE', docs.architecture, /PRH_APPLICATION_CORE_V1[\s\S]{0,900}io_authority: false/i,
  'Architecture must expose the pure application core authority boundary');

requireMatch('DOC_PURE_CORE_SCHEMA', docs.pureCore, /PRH_APPLICATION_CORE_V1/,
  'Pure core doc must identify application core contract');
requireMatch('DOC_PURE_CORE_NO_IO', docs.pureCore, /io_authority: false/,
  'Pure core doc must deny I/O authority');
requireMatch('DOC_PURE_CORE_NO_WRITE', docs.pureCore, /financial_write_authority: false/,
  'Pure core doc must deny financial write authority');
requireMatch('DOC_PURE_CORE_NO_NETWORK', docs.pureCore, /network_authority: false/,
  'Pure core doc must deny network authority');
requireMatch('DOC_PURE_CORE_PLATFORM_FORBIDDEN', docs.pureCore, /SpreadsheetApp[\s\S]{0,500}window[\s\S]{0,120}document/,
  'Pure core doc must identify platform/UI dependencies as forbidden');
requireMatch('DOC_PURE_CORE_ARCH011_HANDOFF', docs.pureCore, /ARCH-011[\s\S]{0,300}repository adapter/i,
  'Pure core doc must preserve repository-adapter handoff');

requireMatch('DOC_DATA_REAL_DERIVED_FORBIDDEN', docs.dataModel, /real-derived/,
  'Data model must explicitly forbid real-derived public financial data');
requireMatch('DOC_DATA_FULL_HISTORY_NOT_DONE', docs.dataModel,
  /(?:full[- ]history|full history|полный history) migration[^\n]{0,120}(?:не считается заверш|not)/i,
  'Data model must not claim full-history migration complete');
requireMatch('DOC_DATA_CANONICAL_V1', docs.dataModel,
  /PRH_CANONICAL_TRANSACTION_V1|Canonical Transaction v1/i,
  'Data model must reference Canonical Transaction v1');
requireMatch('DOC_DATA_SOURCE_POSITION_NOT_IDENTITY', docs.dataModel,
  /source_position[\s\S]{0,260}(?:не является|not)[^\n]{0,80}(?:identity|logical)/i,
  'Data model must separate source position from logical identity');
requireMatch('DOC_USER_PRIVATE_URL', docs.userGuide, /README[^\n]{0,100}(?:не хранит|не обновляет)[^\n]{0,100}deployment URL/i,
  'User guide must not source private Dashboard locator from README');
requireMatch('DOC_DASHBOARD_SYNTHETIC_ONLY', docs.dashboard, /independently generated synthetic financial data/i,
  'Dashboard docs must require independently generated synthetic public finance data');

requireMatch('DOC_STATUS_G0', docs.status, /MASTER-G0/,
  'Project status must expose MASTER-G0');
requireMatch('DOC_STATUS_G1', docs.status, /MASTER-G1/,
  'Project status must expose MASTER-G1');
requireMatch('DOC_STATUS_G2', docs.status, /MASTER-G2/,
  'Project status must expose MASTER-G2');
requireMatch('DOC_STATUS_R0_COMPLETE', docs.status, /R0[^\n]{0,100}(?:завершён|complete)/i,
  'Project status must state proven R0 completion');
requireMatch('DOC_STATUS_AIENG_CHAIN', docs.status, /AIENG-001[\s\S]*AIENG-002[\s\S]*AIENG-003/,
  'Project status must preserve the completed AIENG chain');
requireMatch('DOC_STATUS_FIN010_DONE', docs.status, /FIN-010[^\n]{0,180}(?:DONE|заверш)/i,
  'Project status must identify FIN-010 as DONE');
requireMatch('DOC_STATUS_DATA010_DONE', docs.status, /DATA-010[^\n]{0,180}(?:DONE|заверш)/i,
  'Project status must identify DATA-010 as DONE');
requireMatch('DOC_STATUS_ARCH010_CURRENT', docs.status, /ARCH-010[^\n]{0,180}IN_PROGRESS/i,
  'Project status must identify ARCH-010 as current R1 item');
requireMatch('DOC_STATUS_G3_OPEN', docs.status, /MASTER-G3[\s\S]{0,120}open/i,
  'Project status must expose open MASTER-G3');

requireMatch('DOC_KPI_SCHEMA', docs.kpiDictionary, /PRH_KPI_DICTIONARY_V1/,
  'KPI Dictionary doc must identify its machine schema');
requireMatch('DOC_KPI_FIN_TRUTH', docs.kpiDictionary, /FIN-TRUTH-v1/,
  'KPI Dictionary doc must bind to FIN-TRUTH-v1');
requireMatch('DOC_KPI_EXACT_MONEY', docs.kpiDictionary, /целых `minor units`|integer minor units/i,
  'KPI Dictionary doc must require exact minor-unit money');
requireMatch('DOC_KPI_TRANSFER_NEUTRAL', docs.kpiDictionary, /transfer[^\n]{0,160}нейтрален/i,
  'KPI Dictionary doc must state transfer neutrality');
requireMatch('DOC_KPI_MIXED_CURRENCY_FAIL_CLOSED', docs.kpiDictionary, /Mixed-currency[^\n]{0,160}fail-closed/i,
  'KPI Dictionary doc must fail closed on mixed currency in v1');
requireMatch('DOC_KPI_NO_LEGACY_TRUTH', docs.kpiDictionary, /Legacy total cells[^\n]{0,120}(?:не являются|not)/i,
  'KPI Dictionary doc must reject legacy totals as truth');

requireMatch('DOC_CANONICAL_SCHEMA_ID', docs.canonicalSchema, /PRH_CANONICAL_TRANSACTION_V1/,
  'Canonical transaction doc must identify machine schema');
requireMatch('DOC_CANONICAL_EXACT_MONEY', docs.canonicalSchema, /amount_minor[\s\S]{0,120}(?:integer minor units|minor units)/i,
  'Canonical transaction doc must require exact minor-unit money');
requireMatch('DOC_CANONICAL_SOURCE_POSITION', docs.canonicalSchema,
  /source position[^\n]{0,100}(?:не является|not)[^\n]{0,80}(?:logical identity|identity)/i,
  'Canonical transaction doc must separate source position from logical identity');
requireMatch('DOC_CANONICAL_FINGERPRINT_STRATEGY', docs.canonicalSchema, /CONTENT_FINGERPRINT_V1/,
  'Canonical transaction doc must document DATA-001 fingerprint identity strategy');
requireMatch('DOC_CANONICAL_NO_MIGRATION_CLAIM', docs.canonicalSchema,
  /не выполняет migration\/cutover|не выполняет[^\n]{0,100}migration/i,
  'Canonical transaction doc must not claim migration/cutover');
requireMatch('DOC_CANONICAL_PRIVACY', docs.canonicalSchema, /independently generated synthetic/i,
  'Canonical transaction doc must preserve synthetic-only public-data boundary');

requireMatch('DOC_DR_DONE', docs.dr, /DR-001 is \*\*DONE\*\*/,
  'DR runbook must state the proven DR-001 status');
requireMatch('DOC_DR_EVIDENCE_LINK', docs.dr, /DR001_OWNER_DRILL_EVIDENCE\.json/,
  'DR runbook must point to privacy-safe evidence');
forbidMatch('DOC_DR_PRIVATE_PATH_SAMPLE', docs.dr, /[A-Z]:\\(?:YandexDisk|PrihRashOnline-Keys)|\bAKfy[A-Za-z0-9_-]+\b/,
  'DR runbook must not contain owner-specific private path/deployment ID');
requireMatch('DOC_SECURITY_HISTORY_NOT_AUTHORIZED', docs.historySecurity, /NOT AUTHORIZED \/ NOT EXECUTED/,
  'Security docs must keep history rewrite state explicit');
requireMatch('DOC_OBS_BASELINE', docs.observability, /OBS-001/,
  'OBS runbook must remain present');
requireMatch('DOC_FINOPS_BASELINE', docs.finops, /FREE_ONLY/,
  'FINOPS runbook must remain present');

requireMatch('WORKFLOW_PR_VALIDATION_NAME', docs.prValidation, /^name: PR Validation$/m,
  'PR workflow name drifted');
requireMatch('WORKFLOW_TRUSTED_DEPLOY_NAME', docs.trustedDeploy, /^name: Trusted DEV Deploy$/m,
  'Trusted deploy workflow name drifted');
requireMatch('WORKFLOW_RUNTIME_HEALTH_NAME', docs.runtimeHealth, /^name: Trusted Runtime Health$/m,
  'Runtime health workflow name drifted');
requireMatch('WORKFLOW_MAIN_VERIFICATION_NAME', docs.mainVerification, /^name: Main Verification$/m,
  'Main verification workflow name drifted');
requireMatch('WORKFLOW_DOC_TRUTH_GATE', docs.prValidation, /- name: Documentation truth\s+run: node tools\/docs-drift-scan\.js/m,
  'PR Validation must run named Documentation truth gate');
requireMatch('WORKFLOW_KPI_DICTIONARY_GATE', docs.prValidation, /- name: KPI Dictionary\s+run: node tests\/kpi_dictionary_contract_test\.js/m,
  'PR Validation must run named KPI Dictionary gate');
requireMatch('WORKFLOW_CANONICAL_SCHEMA_GATE', docs.prValidation,
  /- name: Canonical transaction schema\s+run: node tests\/canonical_transaction_schema_contract_test\.js/m,
  'PR Validation must run named Canonical transaction schema gate');
requireMatch('WORKFLOW_PURE_CORE_GATE', docs.prValidation,
  /- name: Pure domain\/application core\s+run: node tests\/pure_domain_application_core_contract_test\.js/m,
  'PR Validation must run named Pure domain/application core gate');

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(`docs-truth: FAIL ${failure.ruleId} ${failure.description}\n`);
  }
  process.exitCode = 1;
} else {
  console.log('docs-truth: PASS', {
    operationalDocs: currentOperationalDocs.length,
    currentReleaseModel: 'EXACT_SHA_AUTONOMOUS',
    currentRoadmapWave: 'R1',
    currentRoadmapItem: 'ARCH-010',
    publicRuntimeLocator: false,
    r0MasterGatesComplete: true,
    historicalChangelogExcludedFromInstructionScan: true
  });
}
