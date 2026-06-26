# Ambiente local singlestake — instala, prepara BD e inicia Vite.
# Uso (PowerShell): .\scripts\dev-local.ps1

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "=== singlestake — ambiente local ===" -ForegroundColor Cyan

if (-not (Test-Path "node_modules")) {
  Write-Host "A instalar dependências…"
  npm install
}

npm run setup:local
npm run dev
