@echo off
setlocal

cd /d "%~dp0\.."

if not exist "config.json" (
  echo [ERROR] config.json not found.
  echo Copy config.template.json to config.json and fill machine values.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [WARN] .env not found. Copy .env.example to .env and add Converge credentials.
)

echo Starting POS hardware stack
echo   1. Payment bridge  http://127.0.0.1:7001
echo   2. Hardware agent  http://127.0.0.1:3001
echo Cloud/ngrok is optional for local device tests.
echo.

start "POS pax-bridge" cmd /k "cd /d "%~dp0\.." && node pax-bridge/server.mjs"
timeout /t 2 /nobreak >nul
start "POS hardware-agent" cmd /k "cd /d "%~dp0\.." && node src/hardware-service.js"

echo Launched two windows. Leave them open while testing.
echo Health: http://127.0.0.1:3001/health
echo Bridge: http://127.0.0.1:7001/health
pause

endlocal
