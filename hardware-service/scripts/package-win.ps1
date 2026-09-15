$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Dist = Join-Path $Root "dist"
$ExePath = Join-Path $Dist "pos-hardware-agent.exe"
$PackageDir = Join-Path $Dist "pos-hardware-agent-win"
$ZipPath = Join-Path $Dist "pos-hardware-agent-win.zip"

if (-not (Test-Path $ExePath)) {
  Write-Host "Executable not found. Building it first..."
  Push-Location $Root
  try {
    npm run build:exe:win | Out-Host
  } finally {
    Pop-Location
  }
}

if (Test-Path $PackageDir) {
  Remove-Item -Recurse -Force $PackageDir
}

New-Item -ItemType Directory -Path $PackageDir | Out-Null

Copy-Item -Path (Join-Path $Dist "pos-hardware-agent.exe") -Destination $PackageDir
Copy-Item -Path (Join-Path $Root "config.template.json") -Destination $PackageDir
Copy-Item -Path (Join-Path $Root ".env.example") -Destination $PackageDir
Copy-Item -Path (Join-Path $Root "packaging/run-agent.bat") -Destination $PackageDir
Copy-Item -Path (Join-Path $Root "packaging/run-bridge.bat") -Destination $PackageDir
Copy-Item -Path (Join-Path $Root "packaging/run-all.bat") -Destination $PackageDir

$ReadmePath = Join-Path $PackageDir "README.txt"
@"
POS Hardware Agent (Windows)

Preferred runtime is Node 18, not the pkg exe, because serialport and node-hid are native modules.

Files:
- pos-hardware-agent.exe (experimental; native addons may fail)
- config.template.json
- .env.example
- run-agent.bat / run-bridge.bat / run-all.bat

Setup:
1) Install Node 18, Epson driver, and Elavon Commerce Web Services
2) Copy config.template.json to config.json and set approved/store_id/COM ports/printer_name
3) Copy .env.example to .env and set Converge credentials
4) Run run-all.bat from a Node checkout, or start:
     npm run start:pax-bridge
     npm run start:hardware
"@ | Set-Content -Path $ReadmePath -Encoding ASCII

if (Test-Path $ZipPath) {
  Remove-Item -Force $ZipPath
}

Compress-Archive -Path (Join-Path $PackageDir "*") -DestinationPath $ZipPath

Write-Host "Package ready:" $ZipPath
