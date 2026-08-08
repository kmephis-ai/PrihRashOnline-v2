# DR-001 direct owner backup path

## Status

DR-001 is **DONE**. A real owner-local encrypted DEV backup was created, independently verified and restored into an isolated temporary SQLite target. Privacy-safe evidence records checksum/reconciliation PASS, `unexplainedMismatch = 0`, RPO/RTO inside target and successful destruction of the temporary restore target.

The public evidence contains only technical fields. The real backup, encryption key, OAuth material, deployment identity, workbook rows/formulas/descriptions/categories/financial values/private control totals remain private.

The successful drill proves the mechanism; it does not make GitHub/CI a backup store. Future real backups and restore drills remain owner-local operations.

## Purpose

This owner-local path exists for environments where authenticated Apps Script Execution API works while local OAuth access to the Apps Script deployment-management endpoint is unavailable/unreliable.

## Security model

- The owner supplies the already-provisioned stable API Executable deployment ID **locally**.
- The tool calls only `scripts/{deploymentId}:run` with `devMode:false` for `prhBackupDescribe` and `prhBackupReadChunk`.
- Before workbook rows are accepted, runtime `sourceTreeHash` must match the deterministic local deployable Apps Script tree.
- Runtime must report a valid trusted 40-character candidate build SHA.
- Source-tree mismatch fails closed with `BACKUP_RUNTIME_SOURCE_TREE_MISMATCH`.
- Windows CRLF/LF worktree representation is normalized only for source-tree binding; substantive source differences still fail closed.
- Workbook access is read-only. The exporter performs no Google workbook/Drive/Properties writes.
- Complete portable package is assembled in local memory and encrypted with AES-256-GCM before `.prhbackup` is written.
- Encryption key remains separate from backup destination.
- Backup/key/OAuth/deployment locator/private payload are never GitHub artifacts, Releases, Issues, CI logs or public docs.

## Windows owner example

The concrete owner paths below are examples only. Do not commit real private paths or identifiers if they reveal private operational state.

```powershell
Set-Location 'C:\PrihRashOnline\repo'

$auth = Join-Path $HOME '.clasprc.json'
$key = '<owner-private-key-path>\prihrash-dr001.backupkey'
$backupDir = '<owner-controlled-independent-backup-path>'
$deployment = Read-Host 'Stable API Executable deployment ID'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $backupDir "prihrash-dev-$stamp.prhbackup"
$evidence = Join-Path $env:TEMP "dr001-evidence-$stamp.json"

node .\tools\private-backup-direct.js backup --auth "$auth" --user prihrash-ci --source . --deployment "$deployment" --key "$key" --out "$backup"
node .\tools\private-backup.js verify --backup "$backup" --key "$key"
node .\tools\private-backup.js drill --backup "$backup" --key "$key" --evidence "$evidence"
```

A full real backup can take minutes because data is read in bounded authenticated chunks. The direct tool intentionally emits the final JSON only after the complete encrypted backup has been created or a fail-closed error occurs.

## Expected privacy-safe evidence

`backup` success contains only encrypted format/hash and build/source binding booleans.

`verify` publishes only schema/status/encrypted backup hash/checksum state.

`drill` publishes only:

- schema/status;
- encrypted backup SHA-256;
- checksum/reconciliation PASS/FAIL;
- unexplained mismatch count;
- RPO/RTO milliseconds;
- temporary-target-destroyed boolean.

The canonical public evidence file is `docs/operations/evidence/DR001_OWNER_DRILL_EVIDENCE.json`. It intentionally does not contain private backup contents, key, OAuth data, deployment ID, workbook rows or control totals.

## Operational retention rule

At least one independent encrypted copy should be retained outside the Google primary store, with the key stored separately. Recovery confidence requires periodic verify/restore drills, not merely the existence of an encrypted file.

## Fail-closed recovery

If source-tree binding, OAuth, runtime execution, encrypted checksum, reconciliation, RPO/RTO or temporary target destruction fails, treat the drill as failed. Do not weaken private runtime access, publish deployment identifiers or move private backup data through GitHub to diagnose it.
