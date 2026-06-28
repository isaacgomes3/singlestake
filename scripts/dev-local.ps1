# Ambiente local singlestake — sandbox isolado + Vite.
# Uso (PowerShell): .\scripts\dev-local.ps1

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "=== singlestake — sandbox local ===" -ForegroundColor Cyan

if (-not (Test-Path "node_modules")) {
  Write-Host "A instalar dependências…"
  npm install
}

npm run setup:local
Write-Host ""
Write-Host "Documentação: docs/ambiente-local.md" -ForegroundColor DarkGray
Write-Host ""
npm run dev
