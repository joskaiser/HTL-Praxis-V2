$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktop = [Environment]::GetFolderPath('Desktop')
$target = Join-Path $here 'start_local.ps1'
$shortcut = Join-Path $desktop 'HTL Praxis.lnk'
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($shortcut)
$sc.TargetPath = 'powershell.exe'
$sc.Arguments = '-ExecutionPolicy Bypass -File "' + $target + '"'
$sc.WorkingDirectory = $here
$icon = Join-Path $here 'icon-192.png'
$sc.Save()
Write-Host "Desktop-Verknuepfung 'HTL Praxis' wurde erstellt." -ForegroundColor Green
Write-Host "Danach in Edge/Chrome zusaetzlich 'App installieren' waehlen, sobald die App geoeffnet ist." -ForegroundColor Cyan
Read-Host 'Enter zum Schliessen'
