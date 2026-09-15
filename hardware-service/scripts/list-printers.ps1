$ErrorActionPreference = "Continue"
Write-Host "Windows printers (Get-Printer):"
try {
  Get-Printer | Select-Object Name, DriverName, PortName, Shared | Format-Table -AutoSize
} catch {
  Write-Host "Get-Printer failed: $($_.Exception.Message)"
  Write-Host "wmic fallback:"
  wmic printer get name
}

Write-Host ""
Write-Host "Copy the exact Name of the Epson receipt printer into config.json printer_name."
