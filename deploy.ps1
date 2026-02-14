param(
  [switch]$NoStart,
  [switch]$SkipInstall,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-RandomSecret([int]$bytes = 48) {
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $buf = New-Object byte[] ($bytes)
  $rng.GetBytes($buf)
  $rng.Dispose()
  return [Convert]::ToBase64String($buf).TrimEnd('=')
}

function Get-LocalIPv4() {
  try {
    $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1' -and $_.AddressState -eq 'Preferred' } |
      Select-Object -ExpandProperty IPAddress
    if ($ips -and $ips.Count -gt 0) { return $ips[0] }
  } catch {}
  try {
    $out = ipconfig 2>$null
    foreach ($line in $out) {
      if ($line -match 'IPv4') {
        $m = [regex]::Match($line, '\b(\d{1,3}\.){3}\d{1,3}\b')
        if ($m.Success -and $m.Value -ne '127.0.0.1') { return $m.Value }
      }
    }
  } catch {}
  return $null
}

function Test-IsAdmin() {
  try {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  } catch {
    return $false
  }
}

$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

Write-Host "BetterWriter one-click deploy (Windows)"
Write-Host "Path: $root"

try { node -v | Out-Null } catch { throw "Node.js not found. Please install Node.js 18+." }
try { npm -v | Out-Null } catch { throw "npm not found. Please install Node.js 18+ (includes npm)." }

$serverEnvPath = Join-Path $root 'server\.env'
if (-not (Test-Path $serverEnvPath)) {
  New-Item -ItemType File -Path $serverEnvPath -Force | Out-Null
}

$lines = @()
if (Test-Path $serverEnvPath) {
  $lines = Get-Content -Path $serverEnvPath -ErrorAction SilentlyContinue
}

$envMap = @{}
foreach ($line in $lines) {
  if (-not $line) { continue }
  if ($line.TrimStart().StartsWith('#')) { continue }
  $idx = $line.IndexOf('=')
  if ($idx -lt 1) { continue }
  $k = $line.Substring(0, $idx).Trim()
  $v = $line.Substring($idx + 1)
  if ($k) { $envMap[$k] = $v }
}

$changed = $false
if (-not $envMap.ContainsKey('JWT_SECRET') -or -not $envMap['JWT_SECRET']) {
  Add-Content -Path $serverEnvPath -Value ("JWT_SECRET=" + (Get-RandomSecret))
  $changed = $true
}
if (-not $envMap.ContainsKey('STORAGE_SECRET') -or -not $envMap['STORAGE_SECRET']) {
  Add-Content -Path $serverEnvPath -Value ("STORAGE_SECRET=" + (Get-RandomSecret))
  $changed = $true
}
if ($changed) {
  Write-Host "Updated server/.env (JWT_SECRET / STORAGE_SECRET)."
} else {
  Write-Host "server/.env already contains required secrets."
}

if (-not $SkipInstall) {
  Write-Host "Installing frontend dependencies..."
  Push-Location $root
  npm install
  Pop-Location

  Write-Host "Installing backend dependencies..."
  Push-Location (Join-Path $root 'server')
  npm install
  Pop-Location
}

if (-not $SkipBuild) {
  Write-Host "Building frontend + backend..."
  Push-Location $root
  npm run build:all
  Pop-Location
}

$ip = Get-LocalIPv4
if ($ip) {
  Write-Host "LAN URL: http://${ip}:3001/"
} else {
  Write-Host "LAN URL: http://<your-ipv4>:3001/"
}

if (Test-IsAdmin) {
  try {
    netsh advfirewall firewall add rule name=BetterWriter-3001 dir=in action=allow protocol=TCP localport=3001 profile=private,public | Out-Null
    Write-Host "Tried to allow inbound TCP 3001 in Windows Firewall."
  } catch {
    Write-Host "Failed to configure firewall automatically. Allow inbound TCP 3001 manually."
  }
} else {
  Write-Host "If LAN devices cannot access, run as Admin PowerShell:"
  Write-Host "netsh advfirewall firewall add rule name=BetterWriter-3001 dir=in action=allow protocol=TCP localport=3001 profile=private,public"
}

if ($NoStart) {
  Write-Host "Done (server not started due to -NoStart)."
  exit 0
}

Write-Host "Starting server (Ctrl+C to stop)..."
Push-Location $root
npm run start:server
Pop-Location
