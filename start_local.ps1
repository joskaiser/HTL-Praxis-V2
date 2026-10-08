$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
$port = 8080
Write-Host "HTL Praxis startet auf http://localhost:$port" -ForegroundColor Green
Write-Host "Zum Beenden dieses Fenster schließen oder Strg+C." -ForegroundColor DarkGray
Start-Process "http://localhost:$port"
if (Get-Command py -ErrorAction SilentlyContinue) { py -m http.server $port }
elseif (Get-Command python -ErrorAction SilentlyContinue) { python -m http.server $port }
elseif (Get-Command python3 -ErrorAction SilentlyContinue) { python3 -m http.server $port }
else { throw "Python wurde nicht gefunden. Für lokalen Test bitte Python installieren oder die App statisch hosten." }
