[CmdletBinding()]
param(
    [string]$Branch = "agent/income-review-filter-v0.2.1",
    [switch]$Force,
    [switch]$OpenEditor
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Title,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    Write-Host "`n==> $Title" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "Шаг завершился с кодом $LASTEXITCODE: $Title"
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Test-Path ".git")) {
    throw "Скрипт должен запускаться из клонированного репозитория PrihRashOnline-v2."
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git не найден в PATH."
}

$clasp = Get-Command clasp.cmd -ErrorAction SilentlyContinue
if (-not $clasp) {
    $clasp = Get-Command clasp -ErrorAction SilentlyContinue
}
if (-not $clasp) {
    throw "clasp не найден. Установите его: npm install -g @google/clasp"
}

Invoke-Step "Проверка чистоты рабочей копии" {
    git diff --quiet
    git diff --cached --quiet
}

Invoke-Step "Получение данных из GitHub" {
    git fetch origin --prune
}

$remoteBranch = "origin/$Branch"
git show-ref --verify --quiet "refs/remotes/$remoteBranch"
if ($LASTEXITCODE -ne 0) {
    throw "Удалённая ветка $remoteBranch не найдена."
}

$localExists = $false
git show-ref --verify --quiet "refs/heads/$Branch"
if ($LASTEXITCODE -eq 0) {
    $localExists = $true
}

if ($localExists) {
    Invoke-Step "Переключение на ветку $Branch" {
        git checkout $Branch
    }
} else {
    Invoke-Step "Создание локальной ветки $Branch" {
        git checkout --track $remoteBranch
    }
}

Invoke-Step "Синхронизация ветки без merge-коммитов" {
    git pull --ff-only origin $Branch
}

Write-Host "`nТекущая версия:" -ForegroundColor DarkCyan
git log -1 --oneline

Invoke-Step "Проверка файлов clasp" {
    & $clasp.Source status
}

if ($Force) {
    Invoke-Step "Принудительная публикация в Apps Script" {
        & $clasp.Source push --force
    }
} else {
    Invoke-Step "Публикация в Apps Script" {
        & $clasp.Source push
    }
}

if ($OpenEditor) {
    Invoke-Step "Открытие Apps Script" {
        & $clasp.Source open
    }
}

Write-Host "`nГотово." -ForegroundColor Green
Write-Host "Обновите таблицу через Ctrl+F5. Установленный onOpen-триггер восстановит меню «Доходы»."
Write-Host "Если Google запросит повторную авторизацию, это действие нельзя безопасно выполнить без участия пользователя."
