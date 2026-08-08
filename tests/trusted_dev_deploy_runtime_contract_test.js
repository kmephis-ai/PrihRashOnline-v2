'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'trusted-dev-deploy.yml'), 'utf8');

assert(workflow.includes('workflows: [PR Validation]'), 'trusted deploy must remain chained from PR Validation');
assert(workflow.includes('environment: DEV'), 'trusted deploy must remain in DEV environment');
assert(workflow.includes('CLASP_USER: prihrash-ci'), 'trusted deploy must bind to the named owner OAuth profile');
assert(workflow.includes('EVENT_PR_NUMBER: ${{ github.event.workflow_run.pull_requests[0].number }}'), 'trusted deploy should prefer the source PR carried by workflow_run');
assert(workflow.includes('commits/${CANDIDATE_SHA}/pulls'), 'post-merge replay must resolve a missing event PR by exact candidate SHA');
assert(workflow.includes(".head.sha == $sha and .head.repo.full_name == $repo and .base.ref == $base"), 'fallback PR lookup must retain exact SHA, same-repository and default-branch constraints');
assert(workflow.includes('if length == 1 then .[0].number else empty end'), 'fallback source resolution must fail closed on zero or ambiguous PR matches');
assert(workflow.includes('Exact validated candidate does not resolve to one same-repository PR targeting the default branch.'), 'ambiguous or missing source PR must be rejected explicitly');
assert(workflow.includes("auth.tokens['prihrash-ci']"), 'trusted deploy must fail closed if named OAuth profile is absent');
assert(workflow.includes('push --user "${CLASP_USER}" --force'), 'candidate push must use the named owner OAuth profile');
assert(workflow.includes('list-deployments --user "${CLASP_USER}"'), 'deployment discovery must use the named owner OAuth profile');
assert(workflow.includes('update-deployment --user "${CLASP_USER}"'), 'deployment promotion must use the named owner OAuth profile');
assert(workflow.includes('secrets.APPS_SCRIPT_API_DEPLOYMENT_ID'), 'trusted deploy must receive the API executable deployment id from DEV secret');
assert(workflow.includes('Update stable API executable deployment'), 'trusted deploy must promote the immutable candidate to the API executable');
assert(workflow.includes("'CI-002 authenticated runtime verification'"), 'API executable update must target the CI-002 deployment description');
assert(workflow.includes('DEPLOYED_AWAITING_AUTHENTICATED_HEALTH'), 'deploy evidence must still require downstream authenticated health');
assert(workflow.includes("context='trusted-dev-deploy'"), 'exact candidate deploy status must remain machine visible');
assert(!workflow.includes('issues: write'), 'trusted deploy must not gain issue mutation permission');
assert(!workflow.includes('contents: write'), 'trusted deploy must not gain repository content write permission');

console.log('trusted_dev_deploy_runtime_contract_test: OK', {
  replaySafeSourcePr: true,
  exactShaSameRepoMain: true,
  namedOAuth: true,
  apiExecutablePromotion: true,
  exactCandidateStatus: true,
  repositoryWrite: false
});
