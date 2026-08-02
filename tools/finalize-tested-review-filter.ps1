[CmdletBinding()]
param(
    [string]$Branch = "agent/income-review-filter-v0.2.1"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Run([string]$Title, [scriptblock]$Command) {
    Write-Host "`n==> $Title" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "Step failed: $Title" }
}

$currentBranch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0) { throw "Cannot read current branch." }
if ($currentBranch -ne $Branch) {
    throw "Wrong branch: $currentBranch. Expected: $Branch"
}

$file = Join-Path $repoRoot "DashboardController.js"
if (-not (Test-Path $file)) { throw "DashboardController.js not found." }

$content = Get-Content $file -Raw -Encoding UTF8
if ($content.Contains(".setVisibleValues(PRH_INCOME_DASHBOARD.REVIEW_STATUSES)")) {
    throw "Unsafe setVisibleValues call is still present. Finalization stopped."
}
if (-not $content.Contains(".setHiddenValues(hiddenStatuses)")) {
    throw "Tested setHiddenValues implementation was not found. Finalization stopped."
}

$statusLines = @(git status --porcelain)
if ($LASTEXITCODE -ne 0) { throw "Cannot read git status." }

$unexpected = @($statusLines | Where-Object {
    $_ -notmatch '^ M DashboardController\.js$' -and
    $_ -notmatch '^M  DashboardController\.js$' -and
    $_ -notmatch '^\?\? tools/finalize-tested-review-filter\.ps1$'
})
if ($unexpected.Count -gt 0) {
    Write-Host "Unexpected working tree changes:" -ForegroundColor Yellow
    $unexpected | ForEach-Object { Write-Host $_ }
    throw "Finalization stopped fail-closed. Commit or stash unrelated changes first."
}

$controllerChanged = @($statusLines | Where-Object { $_ -match 'DashboardController\.js$' }).Count -gt 0
if (-not $controllerChanged) {
    Write-Host "DashboardController.js already matches the branch. Nothing to commit." -ForegroundColor Green
    exit 0
}

Run "Stage tested controller" { git add -- DashboardController.js }
Run "Commit tested filter implementation" { git commit -m "Fix review filter compatibility" }
Run "Push tested commit" { git push origin $Branch }

Write-Host "`nDone: tested DashboardController.js was committed and pushed." -ForegroundColor Green
Write-Host "PR #2 can now be marked ready for review."
