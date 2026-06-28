@echo off
REM Ambiente local — funciona mesmo com PowerShell a bloquear scripts (.ps1).
REM Uso: scripts\dev-local.cmd  (duplo-clique ou CMD)

cd /d "%~dp0.."

echo === singlestake — sandbox local ===

if not exist node_modules (
  echo A instalar dependencias...
  call npm.cmd install
  if errorlevel 1 exit /b 1
)

call npm.cmd run setup:local
if errorlevel 1 exit /b 1

echo.
echo Documentacao: docs\ambiente-local.md
echo.
call npm.cmd run dev
