'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pr = fs.readFileSync(path.join(root, '.github/workflows/pr-validation.yml'), 'utf8');
const runtime = fs.readFileSync(path.join(root, '.github/workflows/trusted-runtime-health.yml'), 'utf8');
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
assert(/repository_dispatch/.test(main) && /ci003-main-verification/.test(main), 'main verification must be a separate default-branch dispatch workflow');
assert(/merged_by\.login/.test(main) && /github-actions\[bot\]/.test(main), 'main verification must prove automation-owned merge');
assert(/merge_base_commit\.sha/.test(main), 'main verification must prove merge SHA remains on main');
assert(/trusted-dev-deploy/.test(main) && /trusted-runtime-health/.test(main) && /autonomous-merge/.test(main), 'main verification must prove source candidate gates');
assert(/status: DONE/.test(main) && /state:\"closed\"/.test(main) && /state_reason:\"completed\"/.test(main), 'main verification must transition and close the Roadmap Issue');
assert(!/\$\{\{\s*secrets\./.test(main), 'main verification must not require secrets');

const autonomousSurface = `${pr}\n${runtime}\n${main}`;
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
  releaseBranchSkip: false,
  manualMarker: false,
  snapshotGate: false,
  postMergeDirectCommit: false,
  automaticIssueClose: true
});
