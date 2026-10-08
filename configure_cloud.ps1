$ErrorActionPreference='Stop'
$here=Split-Path -Parent $MyInvocation.MyCommand.Path
$client=Read-Host 'Microsoft Entra Client-ID'
$tenant=Read-Host 'Tenant-ID oder common [common]'
if([string]::IsNullOrWhiteSpace($tenant)){$tenant='common'}
$redirect=Read-Host 'Feste HTTPS-App-Adresse / Redirect URI (leer = aktuelle Browseradresse)'
$content=@"
window.HTL_CONFIG = {
  clientId: '$client',
  tenantId: '$tenant',
  redirectUri: '$redirect'
};
"@
Set-Content -Path (Join-Path $here 'config.js') -Value $content -Encoding UTF8
Write-Host 'config.js wurde aktualisiert.' -ForegroundColor Green
Read-Host 'Enter zum Schliessen'
