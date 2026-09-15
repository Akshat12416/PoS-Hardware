$ErrorActionPreference = "Continue"
Write-Host "Serial ports:"
Get-CimInstance Win32_SerialPort | Select-Object DeviceID, Name, Description, PNPDeviceID | Format-List
Write-Host "PnP ports that look like COM devices:"
Get-PnpDevice -Class Ports -Status OK -ErrorAction SilentlyContinue |
  Select-Object Status, Class, FriendlyName, InstanceId |
  Format-Table -AutoSize
Write-Host "Record the Magellan scale, Zebra scanner (if serial), and cash drawer COM numbers."
Write-Host "Do not assume COM3/COM4/COM5 from the template."
