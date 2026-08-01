[CmdletBinding()]
param(
    [string]$Branch = "agent/income-review-filter-v0.2.1",
    [switch]$OpenEditor
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Run([string]$Title, [scriptblock]$Command) {
    Write-Host "`n==> $Title" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "Ошибка шага: $Title" }
}

$clasp = Get-Command clasp.cmd -ErrorAction SilentlyContinue
if (-not $clasp) { $clasp = Get-Command clasp -ErrorAction SilentlyContinue }
if (-not $clasp) { throw "clasp не найден. Выполните: npm install -g @google/clasp" }

Run "Получение обновлений" { git fetch origin --prune }
Run "Переключение на $Branch" { git checkout $Branch }
Run "Синхронизация без merge-коммита" { git pull --ff-only origin $Branch }

$file = Join-Path $repoRoot "DashboardController.js"
$content = Get-Content $file -Raw -Encoding UTF8

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

if ($content.Contains(".setVisibleValues(PRH_INCOME_DASHBOARD.REVIEW_STATUSES)")) {
    if (-not $content.Contains($old)) {
        throw "Найдена устаревшая конструкция, но шаблон не совпал. Публикация остановлена fail-closed."
    }
    $content = $content.Replace($old, $new)
    Set-Content -Path $file -Value $content -Encoding UTF8 -NoNewline
    Write-Host "Совместимость фильтра автоматически исправлена." -ForegroundColor Green
} elseif ($content.Contains(".setHiddenValues(hiddenStatuses)")) {
    Write-Host "Исправление фильтра уже присутствует." -ForegroundColor Green
} else {
    throw "Не удалось подтвердить безопасную реализацию фильтра. Публикация остановлена fail-closed."
}

Run "Проверка отслеживаемых файлов" { & $clasp.Source status }
Run "Публикация в Apps Script" { & $clasp.Source push --force }

if ($OpenEditor) {
    Run "Открытие Apps Script" { & $clasp.Source open }
}

Write-Host "`nГотово: код опубликован." -ForegroundColor Green
Write-Host "Обновите таблицу через Ctrl+F5. Меню «Доходы» создаст установленный onOpen-триггер."
Write-Host "Проверьте: Доходы → Показать проблемные операции."
