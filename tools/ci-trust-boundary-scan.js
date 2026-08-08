'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PR_WORKFLOW = '.github/workflows/pr-validation.yml';
const TRUSTED_WORKFLOW = '.github/workflows/trusted-dev-deploy.yml';
const RUNTIME_WORKFLOW = '.github/workflows/trusted-runtime-health.yml';
const MAIN_VERIFY_WORKFLOW = '.github/workflows/main-verification.yml';
const LEGACY_WORKFLOW = '.github/workflows/chat-driven-dev-release.yml';

function read(root, file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function scanPrWorkflow(text) {
  const findings = [];
  if (!/permissions:\s*\n\s*contents:\s*read\b/.test(text)) findings.push('pr-permissions-not-minimal-read');
  if (/\$\{\{\s*secrets\./.test(text)) findings.push('pr-references-secrets');
  if (/\benvironment:\s*DEV\b/.test(text)) findings.push('pr-references-dev-environment');
  if (hasAny(text, [/\bclasp\s+push\b/, /\bcreate-deployment\b/, /\bupdate-deployment\b/, /APPS_SCRIPT_ID/, /CLASPRC_JSON/])) {
    findings.push('pr-contains-deploy-capability');
  }
  if (/startsWith\([^\n]*agent\/release\//.test(text)) findings.push('pr-release-branch-skipped');
  if (!/Build immutable Apps Script candidate/.test(text)) findings.push('pr-candidate-build-missing');
  if (!/apps-script-candidate-\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\}\}/.test(text)) findings.push('pr-candidate-artifact-not-sha-bound');
  return findings;
}

function scanTrustedWorkflow(text) {
  const findings = [];
  if (!/workflow_run:\s*\n\s*workflows:\s*\[PR Validation\]/.test(text)) findings.push('trusted-not-workflow-run-from-pr-validation');
  if (!/types:\s*\[completed\]/.test(text)) findings.push('trusted-workflow-run-not-completed-only');
  if (!/github\.event\.workflow_run\.conclusion\s*==\s*'success'/.test(text)) findings.push('trusted-does-not-require-success');
  if (!/github\.event\.workflow_run\.event\s*==\s*'pull_request'/.test(text)) findings.push('trusted-does-not-require-pr-origin');
  if (!/environment:\s*DEV\b/.test(text)) findings.push('trusted-dev-environment-missing');
  if (!/CANDIDATE_SHA:\s*\$\{\{\s*github\.event\.workflow_run\.head_sha\s*\}\}/.test(text)) findings.push('trusted-candidate-sha-not-from-trigger');
  if (!/Verify candidate artifact against trusted reconstruction/.test(text)) findings.push('trusted-independent-artifact-verification-missing');
  if (!/build-apps-script-candidate\.js[\\\s]+--verify/.test(text)) findings.push('trusted-packager-verification-command-missing');
  if (/node\s+candidate-source\//.test(text) || /npm\s+(?:run|exec).*candidate-source/.test(text)) findings.push('trusted-executes-candidate-code');
  if (!/head\.repo\.full_name/.test(text)) findings.push('trusted-same-repository-pr-check-missing');
  if (!/base\.ref/.test(text)) findings.push('trusted-main-base-check-missing');
  if (!/\$\{\{\s*secrets\.APPS_SCRIPT_ID\s*\}\}/.test(text) || !/\$\{\{\s*secrets\.CLASPRC_JSON\s*\}\}/.test(text)) findings.push('trusted-deploy-secrets-missing');
  return findings;
}

function scanRuntimeWorkflow(text) {
  const findings = [];
  if (!/workflow_run:\s*\n\s*workflows:\s*\[Trusted DEV Deploy\]/.test(text)) findings.push('runtime-not-chained-from-trusted-deploy');
  if (!/github\.event\.workflow_run\.conclusion\s*==\s*'success'/.test(text)) findings.push('runtime-does-not-require-trusted-deploy-success');
  if (!/environment:\s*DEV\b/.test(text)) findings.push('runtime-dev-environment-missing');
  if (!/permissions:[\s\S]*contents:\s*write\b/.test(text)) findings.push('runtime-merge-content-write-missing');
  if (!/pull-requests:\s*read\b/.test(text) || !/issues:\s*read\b/.test(text) || !/statuses:\s*write\b/.test(text)) findings.push('runtime-autonomy-permissions-invalid');
  if (!/steps\.probe\.outputs\.result\s*==\s*'PASS'/.test(text)) findings.push('runtime-automerge-not-health-gated');
  if (!/head\.repo\.full_name/.test(text) || !/base\.ref/.test(text) || !/head\.sha/.test(text)) findings.push('runtime-exact-source-pr-check-missing');
  if (!/Closes[[:space:]]/.test(text) && !/Closes/.test(text)) findings.push('runtime-roadmap-issue-link-missing');
  if (!/status:\[\[:space:\]\]\*IN_PROGRESS/.test(text) && !/IN_PROGRESS/.test(text)) findings.push('runtime-roadmap-issue-state-check-missing');
  if (!/merge_method='squash'/.test(text)) findings.push('runtime-squash-merge-missing');
  if (!/-f sha="\$\{CANDIDATE_SHA\}"/.test(text)) findings.push('runtime-merge-not-exact-head-bound');
  if (!/trusted-dev-deploy/.test(text) || !/trusted-runtime-health/.test(text)) findings.push('runtime-required-gate-recheck-missing');
  if (!/ci003-main-verification/.test(text) || !/repos\/\$\{GITHUB_REPOSITORY\}\/dispatches/.test(text)) findings.push('runtime-main-verification-dispatch-missing');
  if (hasAny(text, [/\bgit\s+push\b/, /--admin\b/, /manual[_ -]?marker/i, /release[_ -]?snapshot/i, /rev-list[^\n]*--count/])) findings.push('runtime-legacy-or-bypass-gate-present');
  return findings;
}

function scanMainVerification(text) {
  const findings = [];
  if (!/repository_dispatch:\s*\n\s*types:\s*\[ci003-main-verification\]/.test(text)) findings.push('main-verification-trigger-invalid');
  if (/\$\{\{\s*secrets\./.test(text) || /\benvironment:\s*DEV\b/.test(text)) findings.push('main-verification-must-be-secret-free');
  if (!/contents:\s*read\b/.test(text) || !/pull-requests:\s*read\b/.test(text) || !/issues:\s*write\b/.test(text) || !/statuses:\s*write\b/.test(text)) findings.push('main-verification-permissions-invalid');
  if (!/merge_commit_sha/.test(text) || !/merged_by\.login/.test(text) || !/github-actions\[bot\]/.test(text)) findings.push('main-verification-autonomous-merge-identity-check-missing');
  if (!/trusted-dev-deploy/.test(text) || !/trusted-runtime-health/.test(text) || !/autonomous-merge/.test(text)) findings.push('main-verification-candidate-gates-missing');
  if (!/merge_base_commit\.sha/.test(text)) findings.push('main-verification-main-ancestry-check-missing');
  if (!/status: DONE/.test(text) || !/state:\"closed\"/.test(text) || !/state_reason:\"completed\"/.test(text)) findings.push('main-verification-issue-close-missing');
  if (hasAny(text, [/\bgit\s+push\b/, /README\.md[^\n]*(?:>|tee|sed)/, /manual[_ -]?marker/i, /release[_ -]?snapshot/i])) findings.push('main-verification-post-merge-direct-commit-or-legacy-gate');
  return findings;
}

function scanLegacyWorkflow(text) {
  const findings = [];
  if (/\$\{\{\s*secrets\./.test(text)) findings.push('legacy-still-references-secrets');
  if (hasAny(text, [/\bclasp\s+push\b/, /\bcreate-deployment\b/, /\bupdate-deployment\b/, /APPS_SCRIPT_ID/, /CLASPRC_JSON/])) findings.push('legacy-still-can-deploy');
  if (!/Trusted DEV Deploy/.test(text)) findings.push('legacy-does-not-point-to-trusted-flow');
  return findings;
}

function scan(root = ROOT) {
  const required = [PR_WORKFLOW, TRUSTED_WORKFLOW, RUNTIME_WORKFLOW, MAIN_VERIFY_WORKFLOW, LEGACY_WORKFLOW];
  const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
  const findings = missing.map((file) => ({ file, rule: 'required-workflow-missing' }));
  if (!missing.includes(PR_WORKFLOW)) scanPrWorkflow(read(root, PR_WORKFLOW)).forEach((rule) => findings.push({ file: PR_WORKFLOW, rule }));
  if (!missing.includes(TRUSTED_WORKFLOW)) scanTrustedWorkflow(read(root, TRUSTED_WORKFLOW)).forEach((rule) => findings.push({ file: TRUSTED_WORKFLOW, rule }));
  if (!missing.includes(RUNTIME_WORKFLOW)) scanRuntimeWorkflow(read(root, RUNTIME_WORKFLOW)).forEach((rule) => findings.push({ file: RUNTIME_WORKFLOW, rule }));
  if (!missing.includes(MAIN_VERIFY_WORKFLOW)) scanMainVerification(read(root, MAIN_VERIFY_WORKFLOW)).forEach((rule) => findings.push({ file: MAIN_VERIFY_WORKFLOW, rule }));
  if (!missing.includes(LEGACY_WORKFLOW)) scanLegacyWorkflow(read(root, LEGACY_WORKFLOW)).forEach((rule) => findings.push({ file: LEGACY_WORKFLOW, rule }));
  return findings;
}

function main() {
  const findings = scan(ROOT);
  if (findings.length) {
    console.error(`ci-trust-boundary: FAIL (${findings.length} finding(s))`);
    findings.forEach((finding) => {
      console.error(`CI trust finding: ${finding.file} -> ${finding.rule}`);
      console.error(`::error file=${finding.file}::CI trust rule ${finding.rule}`);
    });
    process.exitCode = 1;
    return;
  }
  console.log('ci-trust-boundary: PASS', {
    pr: 'no-secrets+all-main-targeting-branches',
    promotion: 'workflow_run/default-branch',
    candidate: 'immutable-sha+trusted-reconstruction',
    merge: 'health-gated exact-head squash',
    mainVerification: 'repository_dispatch+automatic-issue-close'
  });
}

if (require.main === module) main();
module.exports = {
  scanPrWorkflow,
  scanTrustedWorkflow,
  scanRuntimeWorkflow,
  scanMainVerification,
  scanLegacyWorkflow,
  scan
};
