'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'trusted-dev-deploy.yml'), 'utf8');
const promoter = fs.readFileSync(path.join(root, 'tools', 'apps-script-api-promote.js'), 'utf8');

assert(workflow.includes('workflows: [PR Validation]'), 'trusted deploy must remain chained from PR Validation');
assert(workflow.includes('environment: DEV'), 'trusted deploy must remain in DEV environment');
assert(workflow.includes('CLASP_USER: prihrash-ci'), 'trusted deploy must bind to the named owner OAuth profile');
assert(workflow.includes('EVENT_PR_NUMBER: ${{ github.event.workflow_run.pull_requests[0].number }}'), 'trusted deploy should prefer the source PR carried by workflow_run');
assert(workflow.includes('commits/${CANDIDATE_SHA}/pulls'), 'post-merge replay must resolve a missing event PR by exact candidate SHA');
assert(workflow.includes(".head.sha == $sha and .head.repo.full_name == $repo and .base.ref == $base"), 'fallback PR lookup must retain exact SHA, same-repository and default-branch constraints');
assert(workflow.includes('if length == 1 then .[0].number else empty end'), 'fallback source resolution must fail closed on zero or ambiguous PR matches');
assert(workflow.includes('Exact validated candidate does not resolve to one same-repository PR targeting the default branch.'), 'ambiguous or missing source PR must be rejected explicitly');
assert(workflow.includes("auth.tokens['prihrash-ci']"), 'trusted deploy must fail closed if named OAuth profile is absent');

assert(workflow.includes('tools/apps-script-api-push.js'), 'candidate content push must use the trusted direct Apps Script API tool');
assert(workflow.includes('Push verified candidate through Apps Script API'), 'trusted deploy must update exact candidate content through projects.updateContent');
assert(!workflow.includes('push --user "${CLASP_USER}" --force'), 'clasp push must not remain authoritative for candidate content promotion');

assert(workflow.includes('tools/apps-script-api-promote.js'), 'deployment promotion must use the trusted direct Apps Script API promoter');
assert(workflow.includes('Promote exact Apps Script version to stable deployments'), 'trusted deploy must create and promote one immutable Apps Script version');
assert(workflow.includes('secrets.APPS_SCRIPT_API_DEPLOYMENT_ID'), 'trusted deploy must receive the API executable deployment id from DEV secret');
assert(workflow.includes('steps.version_promote.outputs.version_number'), 'deploy evidence must carry the explicit promoted version number');
assert(!workflow.includes('list-deployments --user "${CLASP_USER}"'), 'clasp deployment discovery must not remain in the mutation path');
assert(!workflow.includes('update-deployment --user "${CLASP_USER}"'), 'clasp deployment promotion must not remain in the mutation path');
assert(!workflow.includes('create-deployment --user "${CLASP_USER}"'), 'trusted deploy must not silently mint replacement stable deployment identities');

assert(promoter.includes('auth.tokens[profileName]'), 'direct deployment promoter must resolve the named owner OAuth profile');
assert(promoter.includes("profileName = String(process.env.CLASP_USER || 'prihrash-ci')"), 'direct deployment promoter must default to the canonical named owner profile');
assert(promoter.includes('/deployments`'), 'direct promoter must discover deployments through the official Apps Script API');
assert(promoter.includes('/versions`'), 'direct promoter must create an immutable Apps Script version through the official API');
assert(promoter.includes("'CI-002 authenticated runtime verification'"), 'API executable promotion must retain the canonical CI-002 deployment description');
assert(promoter.includes("'EXECUTION_API'"), 'API executable identity must be validated by entry point type');
assert(promoter.includes("'WEB_APP'"), 'Web deployment identity must be validated by entry point type');
assert(promoter.includes('DEPLOYMENT_EXACT_VERSION_VERIFY_FAILED'), 'both stable deployments must be re-read and exact-version verified');

assert(workflow.includes('DEPLOYED_AWAITING_AUTHENTICATED_HEALTH'), 'deploy evidence must still require downstream authenticated health');
assert(workflow.includes("context='trusted-dev-deploy'"), 'exact candidate deploy status must remain machine visible');
assert(!workflow.includes('issues: write'), 'trusted deploy must not gain issue mutation permission');
assert(!workflow.includes('contents: write'), 'trusted deploy must not gain repository content write permission');

console.log('trusted_dev_deploy_runtime_contract_test: OK', {
  replaySafeSourcePr: true,
  exactShaSameRepoMain: true,
  directContentPush: true,
  namedOAuth: true,
  exactImmutableVersionPromotion: true,
  webAndApiSameVersion: true,
  claspDeploymentMutation: false,
  exactCandidateStatus: true,
  repositoryWrite: false
});
