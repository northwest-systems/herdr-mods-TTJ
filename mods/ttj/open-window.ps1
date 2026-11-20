param([Parameter(Mandatory=$true)][string]$AppHome, [Parameter(Mandatory=$true)][string]$SharedJson)
$ErrorActionPreference = 'Stop'
$windowHome = Join-Path $AppHome 'ttj-window'
$modTarget = Join-Path $windowHome 'mods/ttj'
New-Item -ItemType Directory -Force -Path $modTarget, (Join-Path $windowHome 'layouts') | Out-Null
foreach ($entry in @('main.js', 'model.js', 'placement.js', 'client.js', 'mod.json', 'open-window.ps1', 'open-window.sh', 'icons', 'assets', 'bin', 'THIRD_PARTY_NOTICES.txt')) {
    $source = Join-Path $PSScriptRoot $entry
    if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination $modTarget -Recurse -Force }
}
Get-ChildItem -LiteralPath (Join-Path $AppHome 'layouts') -Filter 'ttj*.json' |
    Copy-Item -Destination (Join-Path $windowHome 'layouts') -Force
$sharedFile = Join-Path $windowHome 'shared.json'
if (-not (Test-Path -LiteralPath $sharedFile)) {
    $null = $SharedJson | ConvertFrom-Json
    [IO.File]::WriteAllText($sharedFile, $SharedJson, [Text.UTF8Encoding]::new($false))
}
$settingsFile = Join-Path $AppHome 'settings.json'
if ((Test-Path -LiteralPath $settingsFile) -and -not (Test-Path -LiteralPath (Join-Path $windowHome 'settings.json'))) {
    Copy-Item -LiteralPath $settingsFile -Destination $windowHome
}
$env:HERDR_APP_HOME = $windowHome
Start-Process -FilePath (Get-Command herdr-app -ErrorAction Stop).Source | Out-Null
Write-Output 'Opened TTJ window.'
