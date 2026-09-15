@echo off
setlocal

cd /d "%~dp0\.."

if not exist "config.json" (
  echo [ERROR] config.json not found.
  echo Copy config.template.json to config.json and fill machine values.
  pause
  exit /b 1
)

echo Starting Ingenico CWS payment bridge on 127.0.0.1:7001 ...
node pax-bridge/server.mjs

endlocal
