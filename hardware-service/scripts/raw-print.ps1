param(
  [Parameter(Mandatory = $true)][string]$PrinterName,
  [Parameter(Mandatory = $true)][string]$Base64
)

$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DocInfo {
    [MarshalAs(UnmanagedType.LPStr)] public string DocName;
    [MarshalAs(UnmanagedType.LPStr)] public string OutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string DataType;
  }
  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.Drv", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool StartDocPrinter(IntPtr handle, int level, [In] DocInfo doc);
  [DllImport("winspool.Drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.Drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.Drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.Drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr handle, IntPtr bytes, int count, out int written);
}
"@

$bytes = [Convert]::FromBase64String($Base64)
$handle = [IntPtr]::Zero
if (-not [RawPrinter]::OpenPrinter($PrinterName, [ref]$handle, [IntPtr]::Zero)) {
  throw "OpenPrinter failed for $PrinterName"
}
try {
  $doc = New-Object RawPrinter+DocInfo
  $doc.DocName = "drawer-kick"
  $doc.DataType = "RAW"
  if (-not [RawPrinter]::StartDocPrinter($handle, 1, $doc)) { throw "StartDocPrinter failed" }
  if (-not [RawPrinter]::StartPagePrinter($handle)) { throw "StartPagePrinter failed" }
  $ptr = [Runtime.InteropServices.Marshal]::AllocCoTaskMem($bytes.Length)
  try {
    [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
    $written = 0
    if (-not [RawPrinter]::WritePrinter($handle, $ptr, $bytes.Length, [ref]$written)) {
      throw "WritePrinter failed"
    }
    if ($written -ne $bytes.Length) { throw "WritePrinter wrote $written of $($bytes.Length) bytes" }
  } finally {
    [Runtime.InteropServices.Marshal]::FreeCoTaskMem($ptr)
  }
  [RawPrinter]::EndPagePrinter($handle) | Out-Null
  [RawPrinter]::EndDocPrinter($handle) | Out-Null
} finally {
  [RawPrinter]::ClosePrinter($handle) | Out-Null
}
Write-Output "RAW_OK $PrinterName $($bytes.Length)"
