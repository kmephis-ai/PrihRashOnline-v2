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
  dashboard: read('docs/dashboard.md'),
  dataModel: read('docs/data-model.md'),
  userGuide: read('docs/user-guide.md'),
  status: read('docs/PROJECT_STATUS.md'),
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
  ['docs/dashboard.md', docs.dashboard],
  ['docs/data-model.md', docs.dataModel],
  ['docs/user-guide.md', docs.userGuide],
  ['docs/PROJECT_STATUS.md', docs.status]
];

for (const [name, text] of currentOperationalDocs) {
  forbidMatch('DOC_STALE_RC_STATUS', text, /v1\.0\.0-rc\.1|Income Dashboard v1\.0 RC|Web Dashboard v1\.0 RC/i,
    `${name}: stale RC status/instruction`);
  forbidMatch('DOC_PUBLIC_RUNTIME_LOCATOR', text, /script\.google\.com\/macros\/s\/|\bAKfy[A-Za-z0-9_-]+\b/,
    `${name}: public runtime/deployment locator`);
}

forbidMatch('DOC_RELEASE_SNAPSHOT_BRANCH', docs.release, /agent\/release\//i,
  'Release process must not restore release snapshot branches');
forbidMatch('DOC_RELEASE_COMMIT_GATE', docs.release, /(?:maximum|max|не более|лимит|limit)[^\n]{0,40}10[^\n]{0,20}commit|10[^\n]{0,20}commit/i,
  'Release process must not use commit-count gate');
forbidMatch('DOC_CHAT_DRIVEN_RELEASE', docs.release, /Chat-Driven DEV Release/i,
  'Legacy Chat-Driven DEV Release state machine must stay removed');
forbidMatch('DOC_MANUAL_RUNTIME_MARKER', docs.release, /manual runtime marker[^\n]{0,30}(?:required|gate|approve)|ручн[^\n]{0,30}marker/i,
  'Manual runtime marker must not be documented as a gate');
forbidMatch('DOC_POST_MERGE_README_WRITE', docs.release, /post-merge direct (?:README )?commit[^\n]{0,40}(?:publish|URL)|update the stable Dashboard link on `main` after merge/i,
  'Post-merge direct README URL write must stay removed');

requireMatch('DOC_README_R0_BASELINE', docs.readme, /R0 platform baseline/,
  'README must identify the current R0 platform baseline');
requireMatch('DOC_README_PRIVATE_MYSELF', docs.readme, /MYSELF/,
  'README must state the private Web App access boundary');
requireMatch('DOC_README_SYNTHETIC_ONLY', docs.readme, /independently generated synthetic|independently generated synthetic financial/i,
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
requireMatch('DOC_RELEASE_NO_ANON_HEALTH', docs.release, /Anonymous `curl`[\s\S]{0,120}not|anonymous Web App health/i,
  'Release process must reject anonymous private-runtime health as authoritative');

requireMatch('DOC_ARCH_GITHUB_CONTROL_PLANE', docs.architecture, /GitHub[^\n]{0,80}control plane/i,
  'Architecture must identify GitHub control plane');
requireMatch('DOC_ARCH_ADAPTER_TARGET', docs.architecture, /Google Sheets adapter[\s\S]{0,120}YDB adapter/i,
  'Architecture must state adapter-based target');
requireMatch('DOC_ARCH_FINANCIAL_TRUTH', docs.architecture, /Legacy[^\n]{0,80}(?:golden truth|authoritative)/i,
  'Architecture must reject legacy totals as financial truth');
requireMatch('DOC_ARCH_TRUST_CHAIN', docs.architecture, /PR Validation[\s\S]*Trusted DEV Deploy[\s\S]*Trusted Runtime Health[\s\S]*Main Verification/,
  'Architecture must match exact delivery trust chain');
requireMatch('DOC_ARCH_PUBLIC_REAL_DERIVED_FORBIDDEN', docs.architecture, /real-derived/,
  'Architecture must forbid real-derived public financial data');

requireMatch('DOC_DATA_REAL_DERIVED_FORBIDDEN', docs.dataModel, /real-derived/,
  'Data model must explicitly forbid real-derived public financial data');
requireMatch('DOC_DATA_FULL_HISTORY_NOT_DONE', docs.dataModel, /full history migration[^\n]{0,80}(?:не считается заверш|not)/i,
  'Data model must not claim full-history migration complete');
requireMatch('DOC_USER_PRIVATE_URL', docs.userGuide, /README[^\n]{0,80}(?:не хранит|не обновляет)[^\n]{0,80}deployment URL/i,
  'User guide must not source private Dashboard locator from README');
requireMatch('DOC_DASHBOARD_SYNTHETIC_ONLY', docs.dashboard, /independently generated synthetic financial data/i,
  'Dashboard docs must require independently generated synthetic public finance data');

requireMatch('DOC_STATUS_G0', docs.status, /MASTER-G0/,
  'Project status must expose MASTER-G0');
requireMatch('DOC_STATUS_G1', docs.status, /MASTER-G1/,
  'Project status must expose MASTER-G1');
requireMatch('DOC_STATUS_G2', docs.status, /MASTER-G2/,
  'Project status must expose MASTER-G2');
requireMatch('DOC_STATUS_AIENG_REMAINING', docs.status, /AIENG-001[\s\S]*AIENG-002[\s\S]*AIENG-003/,
  'Project status must identify remaining R0 AIENG chain');
requireMatch('DOC_STATUS_R1_BLOCKED', docs.status, /Do not treat R1|не считается.*R1|until all R0/i,
  'Project status must not imply R1 is current before all R0 gates');

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

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(`docs-truth: FAIL ${failure.ruleId} ${failure.description}\n`);
  }
  process.exitCode = 1;
} else {
  console.log('docs-truth: PASS', {
    operationalDocs: currentOperationalDocs.length,
    currentReleaseModel: 'EXACT_SHA_AUTONOMOUS',
    publicRuntimeLocator: false,
    r0MasterGatesDocumented: true,
    historicalChangelogExcludedFromInstructionScan: true
  });
}
