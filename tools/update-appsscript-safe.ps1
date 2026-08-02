[CmdletBinding()]
param(
    [string]$Branch = 'agent/income-review-filter-v0.2.1',
    [switch]$OpenEditor
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Title,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    Write-Host ''
    Write-Host ('==> ' + $Title) -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw ('Step failed: ' + $Title)
    }
}

$claspCommand = Get-Command 'clasp.cmd' -ErrorAction SilentlyContinue
if (-not $claspCommand) {
    $claspCommand = Get-Command 'clasp' -ErrorAction SilentlyContinue
}
if (-not $claspCommand) {
    throw 'clasp was not found. Install it with: npm install -g @google/clasp'
}

Invoke-Step -Title 'Fetch repository updates' -Command { git fetch origin --prune }
Invoke-Step -Title ('Checkout branch ' + $Branch) -Command { git checkout $Branch }
Invoke-Step -Title 'Fast-forward branch' -Command { git pull --ff-only origin $Branch }

$file = Join-Path $repoRoot 'DashboardController.js'
if (-not (Test-Path $file)) {
    throw 'DashboardController.js was not found.'
}

$content = Get-Content -Path $file -Raw -Encoding UTF8

$old = @'
  var criteria = SpreadsheetApp.newFilterCriteria()
    .setVisibleValues(PRH_INCOME_DASHBOARD.REVIEW_STATUSES)
    .build();
  filter.setColumnFilterCriteria(PRH_INCOME_DASHBOARD.STATUS_COLUMN, criteria);
  var statuses = sheet.getRange(2, PRH_INCOME_DASHBOARD.STATUS_COLUMN, lastRow - 1, 1).getDisplayValues();
'@

$new = @'
  var statuses = sheet.getRange(2, PRH_INCOME_DASHBOARD.STATUS_COLUMN, lastRow - 1, 1).getDisplayValues();
  var hiddenStatuses = [];
  statuses.forEach(function (row) {
    var status = String(row[0] || '').trim();
    if (PRH_INCOME_DASHBOARD.REVIEW_STATUSES.indexOf(status) < 0 && hiddenStatuses.indexOf(status) < 0) {
      hiddenStatuses.push(status);
    }
  });
  var criteria = SpreadsheetApp.newFilterCriteria()
    .setHiddenValues(hiddenStatuses)
    .build();
  filter.setColumnFilterCriteria(PRH_INCOME_DASHBOARD.STATUS_COLUMN, criteria);
'@

if ($content.Contains('.setVisibleValues(PRH_INCOME_DASHBOARD.REVIEW_STATUSES)')) {
    if (-not $content.Contains($old)) {
        throw 'Legacy filter call was found, but the expected code block did not match. Publication stopped fail-closed.'
    }

    $content = $content.Replace($old, $new)
    Set-Content -Path $file -Value $content -Encoding UTF8 -NoNewline
    Write-Host 'Filter compatibility patch applied.' -ForegroundColor Green
}
elseif ($content.Contains('.setHiddenValues(hiddenStatuses)')) {
    Write-Host 'Filter compatibility patch is already present.' -ForegroundColor Green
}
else {
    throw 'Safe filter implementation could not be verified. Publication stopped fail-closed.'
}

Invoke-Step -Title 'Check clasp tracked files' -Command { & $claspCommand.Source status }
Invoke-Step -Title 'Push code to Apps Script' -Command { & $claspCommand.Source push --force }

if ($OpenEditor) {
    Invoke-Step -Title 'Open Apps Script editor' -Command { & $claspCommand.Source open }
}

Write-Host ''
Write-Host 'Done: Apps Script code was published.' -ForegroundColor Green
Write-Host 'Refresh the spreadsheet with Ctrl+F5.'
Write-Host 'Then run: Income menu -> Show problematic operations.'
