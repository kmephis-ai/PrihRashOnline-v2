# DR-001 — Portable encrypted backup and isolated restore drill

## Purpose

GitHub Actions artifacts and Releases are delivery evidence, not database backups. DR-001 creates an independent, portable, encrypted copy of the private workbook on an owner-controlled trusted machine and proves that copy can be restored without using the Google primary workbook as the restore target.

The authoritative backup/drill runs locally with the owner's existing OAuth profile. GitHub CI uses synthetic data only.

## Security boundary

The backup path is intentionally split:

1. The owner-only Apps Script API executable reads the spreadsheet bound to the project.
2. `BackupService.js` returns metadata and at most 200 rows per call. It performs no spreadsheet, Drive, Properties, mail, or external-service writes.
3. `tools/private-backup.js` assembles the portable package only in local process memory.
4. The full package is encrypted with AES-256-GCM before a backup file is written.
5. The encryption key is a separate file and must not be stored beside the backup, in the repository, in GitHub secrets, or in a Google-synced backup folder.
6. Restore drills decrypt into a temporary local SQLite database, reconcile the restored content, measure RPO/RTO, and delete that database before the command completes.

Do not commit or upload `.prhbackup`, backup key files, `.clasprc.json`, `.clasp.json`, SQLite restore targets, or private drill evidence containing anything beyond the documented technical evidence schema.

## Portable backup contents

The plaintext package exists only in process memory and contains:

- format/schema version;
- creation timestamp and dataset revision;
- deployed source build SHA and source-tree hash when available;
- sheet metadata;
- typed cell values and formulas;
- per-sheet SHA-256 digests;
- full content SHA-256 digest;
- private control totals used by the restore drill;
- an explicit `credentialsIncluded: false` contract.

The encrypted file is an authenticated AES-256-GCM envelope. Sheet names, rows, formulas, control totals, and financial values are inside ciphertext rather than cleartext file metadata.

## Recovery objectives

Initial DR-001 targets:

- RPO: no more than 24 hours;
- RTO: no more than 4 hours;
- unexplained reconciliation mismatch: exactly 0;
- backup verification: target daily;
- isolated restore drill: target quarterly.

A stale backup or reconciliation mismatch is a failed drill, not a warning.

## Prerequisites

- trusted owner machine;
- Node.js 24 used by the repository;
- current repository checkout on `main`;
- private `.clasprc.json` containing the named owner profile `prihrash-ci`;
- private `.clasp.json` for the DEV Apps Script project;
- an owner-controlled backup destination outside the Google primary store;
- a second, separate location for the encryption key.

The local tool discovers the owner-only API executable by its canonical deployment description. It does not require the deployment ID to be placed in the backup file or command line.

## Windows PowerShell runbook

Set paths for your machine. Keep the key and encrypted backup in different storage locations.

```powershell
$repo    = 'C:\path\to\PrihRashOnline-v2'
$auth    = Join-Path $HOME '.clasprc.json'
$project = 'C:\path\to\private\.clasp.json'
$key     = 'C:\secure-key-location\prihrash-dr001.backupkey'
$backup  = 'E:\offline-backups\PrihRashOnline-v2\prihrash-dev-latest.prhbackup'
$evidence = Join-Path $env:TEMP 'dr001-evidence.private.json'

Set-Location $repo
node -v
git status --short
git rev-parse HEAD
```

The repository checkout should be clean and on the intended merged `main` before creating a real backup.

### 1. Create the encryption key once

```powershell
node .\tools\private-backup.js init-key --key $key
```

Expected safe output:

```text
{"status":"KEY_CREATED"}
```

The command refuses to overwrite an existing key. Never paste or print the key value into chat, GitHub, CI logs, issues, screenshots, or documentation.

### 2. Create an encrypted backup

Use a unique backup filename for each snapshot; the tool refuses overwrite.

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "E:\offline-backups\PrihRashOnline-v2\prihrash-dev-$stamp.prhbackup"

node .\tools\private-backup.js backup `
  --auth $auth `
  --project $project `
  --user prihrash-ci `
  --key $key `
  --out $backup
```

Safe output contains only technical state, encrypted-file SHA-256, format, and whether source build metadata was available. It never prints workbook rows or OAuth material.

### 3. Verify encryption/integrity without restoring

```powershell
node .\tools\private-backup.js verify --backup $backup --key $key
```

Expected result has `status: PASS` and `checksum: PASS`.

### 4. Run the isolated restore drill

```powershell
node .\tools\private-backup.js drill `
  --backup $backup `
  --key $key `
  --evidence $evidence
```

The drill:

- authenticates and decrypts the backup;
- verifies content and sheet SHA-256 digests;
- restores every sheet row into a temporary local SQLite target;
- reads the temporary target back;
- rechecks sheet digests and private control totals;
- requires unexplained mismatch = 0;
- measures RPO and RTO;
- deletes the temporary SQLite target even on failure.

Expected safe evidence fields are limited to:

- schema;
- PASS/FAIL status;
- encrypted backup SHA-256;
- checksum/reconciliation PASS;
- unexplained mismatch count;
- RPO milliseconds;
- RTO milliseconds;
- temporary-target-destroyed flag.

Do not upload private backup files or the key as evidence.

## Independent-copy rule

The encrypted `.prhbackup` must exist outside the Google primary workbook. For meaningful disaster recovery, keep at least one copy on owner-controlled storage that is not automatically deleted or corrupted together with the Google account/workbook. A removable/offline disk is acceptable and does not require a paid service.

The key must remain separate from that encrypted copy. Losing both the Google primary and the encryption key makes the portable backup intentionally unrecoverable.

## Rotation and retention

A practical FREE_ONLY baseline is:

- create a new encrypted backup at least daily when the workbook is actively used;
- verify the newest backup after creation;
- retain multiple dated encrypted snapshots rather than overwriting one file;
- keep at least one independent/offline copy;
- run the isolated restore drill at least quarterly and after material schema/migration changes.

Exact retention count is an owner policy and can be tightened later without changing the backup format.

## Failure handling

Treat the following as fail-closed DR failures:

- OAuth/API executable unavailable;
- malformed source chunk;
- missing/duplicate sheet metadata;
- wrong key or modified ciphertext;
- package/content/sheet checksum mismatch;
- control-total mismatch;
- RPO > 24h;
- RTO > 4h;
- temporary restore target cannot be deleted.

Do not bypass a failed drill by manually marking it successful.

## Evidence and Issue closure

The DR-001 implementation PR uses `Refs #56` and does not close the Roadmap Issue. DR-001 becomes DONE only after a real private DEV encrypted backup and isolated restore drill pass on the owner machine.

After that private drill, only the privacy-safe technical evidence may be added through a final validated PR using `Closes #56`. The encrypted backup, key, OAuth files, workbook rows, financial values, descriptions, categories, and private control totals remain outside GitHub.
