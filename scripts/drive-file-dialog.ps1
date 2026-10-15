param(
  [string]$FilePath = "C:\Users\oriol\source\repos\spanish-site-translation-plan\anexo-2026-09-21-locales\anexo-2026-09-21-locales.zip",
  [int]$WaitSeconds = 3
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32Dialog {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
}
"@

Start-Sleep -Seconds $WaitSeconds
Set-Clipboard -Value $FilePath

$found = $null
[Win32Dialog]::EnumWindows({
  param($hWnd, $lParam)
  if (-not [Win32Dialog]::IsWindowVisible($hWnd)) { return $true }
  $cls = New-Object System.Text.StringBuilder 256
  [void][Win32Dialog]::GetClassName($hWnd, $cls, 256)
  $title = New-Object System.Text.StringBuilder 512
  [void][Win32Dialog]::GetWindowText($hWnd, $title, 512)
  $c = $cls.ToString()
  $t = $title.ToString()
  if ($c -eq '#32770' -or $t -match 'Abrir|Open|Upload|Subir|archivo|File') {
    $script:found = @{ Handle = $hWnd; Class = $c; Title = $t }
    return $false
  }
  return $true
}, [IntPtr]::Zero) | Out-Null

if (-not $found) {
  Write-Output "NO_DIALOG"
  exit 1
}

[void][Win32Dialog]::SetForegroundWindow($found.Handle)
Start-Sleep -Milliseconds 400
Add-Type -AssemblyName System.Windows.Forms
# Focus filename field (Alt+N works in classic dialogs)
[System.Windows.Forms.SendKeys]::SendWait('%n')
Start-Sleep -Milliseconds 150
[System.Windows.Forms.SendKeys]::SendWait('^v')
Start-Sleep -Milliseconds 150
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Write-Output ("OK " + $found.Title)
