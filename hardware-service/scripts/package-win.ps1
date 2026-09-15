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
Copy-Item -Path (Join-Path $Root "packaging/run-agent.bat") -Destination $PackageDir

$ReadmePath = Join-Path $PackageDir "README.txt"
@"
POS Hardware Agent (Windows)

Files:
- pos-hardware-agent.exe
- config.template.json
- run-agent.bat

Setup:
1) Copy config.template.json to config.json
2) Edit config.json with machine-specific values
3) Run run-agent.bat
"@ | Set-Content -Path $ReadmePath -Encoding ASCII

if (Test-Path $ZipPath) {
  Remove-Item -Force $ZipPath
}

Compress-Archive -Path (Join-Path $PackageDir "*") -DestinationPath $ZipPath

Write-Host "Package ready:" $ZipPath
