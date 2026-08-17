'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pr = fs.readFileSync(path.join(root, '.github/workflows/pr-validation.yml'), 'utf8');
const runtime = fs.readFileSync(path.join(root, '.github/workflows/trusted-runtime-health.yml'), 'utf8');
const recovery = fs.readFileSync(path.join(root, '.github/workflows/ci003-postmerge-recovery.yml'), 'utf8');
const main = fs.readFileSync(path.join(root, '.github/workflows/main-verification.yml'), 'utf8');

assert(!/startsWith\([^\n]*agent\/release\//.test(pr), 'release branches must use the same PR Validation gate');
assert(/permissions:\s*\n\s*contents:\s*read\b/.test(pr), 'PR Validation must stay read-only');
assert(!/\$\{\{\s*secrets\./.test(pr), 'PR Validation must stay secret-free');

assert(/workflow_run:\s*\n\s*workflows:\s*\[Trusted DEV Deploy\]/.test(runtime), 'autonomous merge must live behind trusted deploy');
assert(/steps\.probe\.outputs\.result\s*==\s*'PASS'/.test(runtime), 'autonomous merge eligibility must require authenticated runtime PASS');
assert(/merge_method='squash'/.test(runtime), 'merge method must be squash');
assert(/-f sha="\$\{CANDIDATE_SHA\}"/.test(runtime), 'merge API must atomically match the exact candidate head SHA');
assert(/head\.repo\.full_name/.test(runtime) && /base\.ref/.test(runtime) && /head\.sha/.test(runtime), 'same-repo/main/exact-head checks are required');
assert(/trusted-dev-deploy/.test(runtime) && /trusted-runtime-health/.test(runtime), 'merge must re-check trusted candidate statuses');
assert(/Closes/.test(runtime) && /roadmap_id/.test(runtime) && /IN_PROGRESS/.test(runtime), 'only linked in-progress Roadmap Issues are autonomous-merge eligible');
assert(/work_class/.test(runtime) && /target_stage/.test(runtime) && /engineering_status/.test(runtime) && /product_stage/.test(runtime),
  'autonomous merge must validate dual engineering/product stage metadata');
assert(/product-ready-e2e/.test(runtime) && /PRODUCT_READY_E2E_NOT_PROVEN/.test(runtime),
  'user-facing Product E2E must be green before autonomous merge');

// CI-003 post-merge recovery is deliberately not a second merge/Issue-close authority.
assert(/name:\s*CI-003 Post-Merge Recovery/.test(recovery));
assert(/on:\s*\n\s*push:\s*\n\s*branches:\s*\[main\]/.test(recovery), 'recovery must run only after a main push');
assert(/merged_by\.login/.test(recovery) && /github-actions\[bot\]/.test(recovery), 'recovery must prove automation-owned merge');
assert(/merge_commit_sha/.test(recovery) && /head\.sha/.test(recovery) && /base\.ref/.test(recovery), 'recovery must prove exact merged PR identity');
assert(/trusted-dev-deploy/.test(recovery) && /trusted-runtime-health/.test(recovery), 'recovery must require trusted exact candidate gates');
assert(/seq 1 12/.test(recovery) && /sleep 5/.test(recovery), 'recovery must allow the normal CI-003 pipeline a bounded grace period');
assert(/autonomous-merge-reason:POSTMERGE_RECOVERED/.test(recovery), 'recovery evidence must be explicit and machine-visible');
assert(/ci003-main-verification/.test(recovery), 'recovery must delegate final verification to Main Verification');
assert(/main-verification-dispatch-reason:POSTMERGE_RECOVERED/.test(recovery), 'recovered dispatch must be explicit');
assert(!/pulls\/\$\{?[^\n]*\/merge/.test(recovery) && !/merge_method/.test(recovery), 'post-merge recovery must not own merge authority');
assert(!/state:\s*["']?closed/i.test(recovery) && !/issues\/\$\{?[^\n]*PATCH/i.test(recovery), 'post-merge recovery must not close Roadmap Issues');
assert(!/\$\{\{\s*secrets\./.test(recovery), 'post-merge recovery must not require secrets');

assert(/repository_dispatch/.test(main) && /ci003-main-verification/.test(main), 'main verification must be a separate default-branch dispatch workflow');
assert(/merged_by\.login/.test(main) && /github-actions\[bot\]/.test(main), 'main verification must prove automation-owned merge');
assert(/merge_base_commit\.sha/.test(main), 'main verification must prove merge SHA remains on main');
assert(/trusted-dev-deploy/.test(main) && /trusted-runtime-health/.test(main) && /autonomous-merge/.test(main), 'main verification must prove source candidate gates');
assert(/status: DONE/.test(main) && /state:\"closed\"/.test(main) && /state_reason:\"completed\"/.test(main), 'main verification must transition and close the Roadmap Issue');
assert(/work_class/.test(main) && /target_stage/.test(main) && /engineering_status/.test(main) && /product_stage/.test(main),
  'main verification must validate dual engineering/product stage metadata');
assert(/product-ready-e2e/.test(main) && /PRODUCT_READY_E2E_NOT_PROVEN/.test(main),
  'user-facing completion must require exact-candidate Product E2E');
assert(/engineering_status: DONE_ENGINEERING/.test(main) && /product_stage: DONE/.test(main),
  'main verification must persist stage-aware completion');
assert(!/\$\{\{\s*secrets\./.test(main), 'main verification must not require secrets');
assert(!/^```/m.test(main), 'workflow source must not contain unindented markdown/heredoc lines that invalidate YAML');
assert(!/<<EOF/.test(main), 'Main Verification evidence append must avoid fragile unindented heredocs');
assert(/printf 'main_verification:\\n'/.test(main), 'Main Verification must append bounded technical evidence from an indented shell block');

const autonomousSurface = `${pr}\n${runtime}\n${recovery}\n${main}`;
[
  /manual[_ -]?marker/i,
  /release[_ -]?snapshot/i,
  /rev-list[^\n]*--count/,
  /\bgit\s+push\b/,
  /--admin\b/
].forEach((pattern) => assert(!pattern.test(autonomousSurface), `legacy/bypass gate forbidden: ${pattern}`));

console.log('autonomous_merge_contract_test: OK', {
  exactHead: true,
  squash: true,
  runtimeHealthRequired: true,
  postMergeRecovery: true,
  recoveryMergeAuthority: false,
  recoveryIssueCloseAuthority: false,
  recoveryGraceSeconds: 60,
  releaseBranchSkip: false,
  manualMarker: false,
  snapshotGate: false,
  postMergeDirectCommit: false,
  mainVerificationYamlGuard: true,
  automaticIssueClose: true,
  stageAwareCompletion: true,
  productReadyE2ERequired: true,
  productReadyE2EPreMerge: true
});
