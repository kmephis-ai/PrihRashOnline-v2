# CI Trust Boundary v1

Roadmap item: `CI-001`  
Cost class: `FREE_ONLY`

## Trust zones

### PR Validation — unprivileged

PR code runs only in a read-only GitHub Actions context:

- repository permission: `contents: read`;
- no DEV environment;
- no deploy secrets;
- no Apps Script push/deployment commands;
- deterministic security/privacy/financial/migration/contracts/UI gates;
- after all gates are green, a public-safe Apps Script candidate is packaged from the exact PR head SHA.

The candidate artifact contains only deployable top-level Apps Script `.js` / `.html` files plus `appsscript.json`. Its manifest binds the artifact to the immutable candidate SHA and records SHA-256 + size for every file and a deterministic aggregate artifact hash.

### Trusted DEV Deploy — privileged

Secret-bearing promotion is a separate `workflow_run` workflow. Its workflow definition lives on the default branch and is triggered only after successful `PR Validation` completion.

Before any secret-backed deploy command, trusted workflow code verifies:

1. the trigger is a successful `pull_request` validation;
2. the candidate SHA is immutable 40-character lowercase hex;
3. the source PR belongs to this repository and targets the current default branch;
4. the PR head still equals the validated candidate SHA;
5. the SHA-bound candidate artifact exists on the successful validation run;
6. the exact candidate Git tree is checked out without credentials;
7. trusted default-branch packager code independently reconstructs the expected deploy artifact;
8. promoted and reconstructed manifests/file bytes match exactly.

Candidate scripts are never executed in the privileged phase. The deploy CLI and packager come from trusted `main` and the locked npm dependency graph. Only after artifact verification are `APPS_SCRIPT_ID` / `CLASPRC_JSON` referenced to push/update DEV.

## Fork boundary

A successful validation from a fork or cross-repository head can never receive DEV deployment credentials. Trusted promotion requires `head.repo.full_name == github.repository`.

## Runtime verification boundary

`CI-001` proves trusted promotion and deploy separation. It does **not** claim authenticated runtime correctness. Trusted deployment evidence is therefore recorded as `DEPLOYED_AWAITING_AUTHENTICATED_HEALTH`. `CI-002` owns authenticated exact-SHA runtime verification for the private Apps Script runtime.

## Legacy flow

The old release-branch workflow no longer references secrets or deployment commands and only explains the replacement flow. This removes the previous state where candidate/release-branch workflow code could share the same trust zone as deployment credentials.

## Public evidence

Allowed evidence contains only technical metadata: candidate SHA, workflow/run IDs, artifact SHA-256, file counts, and PASS/FAIL/deployment state. No authenticated runtime body, screenshots of private financial UI, transaction data, financial values, categories, or derived metrics may be uploaded.
