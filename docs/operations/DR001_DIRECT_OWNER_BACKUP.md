# DR-001 direct owner backup path

This owner-local path exists for environments where the authenticated Apps Script Execution API works but the Apps Script management endpoint `projects.deployments.list` is not available to the local OAuth client.

## Security model

- The owner supplies the already-provisioned stable API Executable deployment ID locally.
- The tool calls only `scripts/{deploymentId}:run` with `devMode:false` for `prhBackupDescribe` and `prhBackupReadChunk`.
- Before any workbook rows are accepted, the runtime-reported `sourceTreeHash` must exactly match a deterministic hash of the deployable Apps Script files in the current local checkout.
- The runtime must also report a valid 40-character trusted candidate build SHA.
- A source-tree mismatch fails closed with `BACKUP_RUNTIME_SOURCE_TREE_MISMATCH`.
- Workbook access is read-only. No Google workbook/Drive/Properties writes are performed.
- The complete portable package is assembled in local memory and encrypted with AES-256-GCM before the `.prhbackup` file is written.
- The encryption key remains separate from the backup destination.

## Windows example

```powershell
Set-Location 'C:\PrihRashOnline\repo'

$auth = Join-Path $HOME '.clasprc.json'
$key = 'G:\PrihRashOnline-Keys\prihrash-dr001.backupkey'
$backupDir = 'M:\YandexDisk\DashBoard\PrihRashOnline\Backups'
$deployment = '<owner stable API Executable deployment ID>'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $backupDir "prihrash-dev-$stamp.prhbackup"

node .\tools\private-backup-direct.js backup --auth "$auth" --user prihrash-ci --source . --deployment "$deployment" --key "$key" --out "$backup"
```

Safe success output contains only technical fields: status, encrypted format, encrypted backup SHA-256, source-build binding and runtime source-tree binding.

The deployment ID, OAuth material, key, backup bytes, workbook rows, formulas, descriptions, categories, financial values and private control totals must not be copied to GitHub issues, CI logs, chat or other shared surfaces.

After backup creation, continue with the existing `tools/private-backup.js verify` and `drill` commands. The encrypted file format is unchanged.
