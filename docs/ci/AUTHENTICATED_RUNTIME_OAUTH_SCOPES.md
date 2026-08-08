# CI-002 authenticated runtime OAuth scopes

CI-002 executes the private Apps Script API Executable with the owner OAuth profile `prihrash-ci`. Google requires the caller token to cover the runtime scopes used by the deployed script, not only the Apps Script management scopes used by `clasp`.

## Explicit project scopes

`appsscript.json` is the canonical runtime scope contract:

- `https://www.googleapis.com/auth/spreadsheets.currentonly` — access only to the container-bound spreadsheet. The repository must not use `SpreadsheetApp.openById/openByUrl` while this narrower scope is declared.
- `https://www.googleapis.com/auth/drive` — required by the existing PDF export path that creates a Drive file with `DriveApp`.
- `https://www.googleapis.com/auth/script.external_request` — required by the existing `UrlFetchApp` export request.
- `https://www.googleapis.com/auth/script.scriptapp` — required by installable trigger management.
- `https://www.googleapis.com/auth/script.container.ui` — required by dialogs/sidebar/container UI.
- `https://www.googleapis.com/auth/userinfo.email` — required by existing `Session.getActiveUser()/getEffectiveUser()` calls.

The PR contract fails closed if the manifest scope set drifts, if arbitrary spreadsheet opening is introduced, or if selected new OAuth-sensitive services appear without a scope review.

## Owner reauthorization after a scope change

Run from a trusted local checkout whose `appsscript.json` matches the merged default branch and with the private Desktop OAuth client file available locally:

```bash
clasp login --user prihrash-ci --use-project-scopes --include-clasp-scopes --creds client_secret.json
```

Grant the requested project permissions to the owner account. `--include-clasp-scopes` keeps the locked deployment/project management capabilities required by trusted CI, while `--use-project-scopes` adds the explicit runtime scopes from `appsscript.json`.

The generated `.clasprc.json` is a secret. Do not commit it, paste it into an issue/PR/chat, or upload it as an artifact. Replace the GitHub `DEV` environment secret `CLASPRC_JSON` with the complete newly authorized credential file value.

After the secret is updated, replay the exact validated candidate. CI-002 is complete only when both machine statuses are green on the same immutable candidate SHA:

- `trusted-dev-deploy = success`
- `trusted-runtime-health = success` with reason `OK`

The Web App and Execution API access remain `MYSELF`; this scope procedure must never be replaced by anonymous/public health access.
