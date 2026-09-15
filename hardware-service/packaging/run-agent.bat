@echo off
setlocal

cd /d "%~dp0"

if not exist "config.json" (
  echo [ERROR] config.json not found.
  echo Copy config.template.json to config.json and fill machine values.
  pause
  exit /b 1
)

echo Starting POS Hardware Agent...
pos-hardware-agent.exe

endlocal
