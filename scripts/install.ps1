param([string]$CorePath)
$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path -Parent $PSScriptRoot
$herdrAppHome = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } elseif ($env:XDG_CONFIG_HOME) {
    Join-Path $env:XDG_CONFIG_HOME 'herdr-app'
} else { Join-Path $HOME '.config/herdr-app' }
$modTarget = Join-Path $herdrAppHome 'mods/ttj'
New-Item -ItemType Directory -Force -Path $modTarget, (Join-Path $herdrAppHome 'layouts') | Out-Null
Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'mods/ttj') -Force |
    Where-Object { $_.Name -in @('main.js', 'model.js', 'client.js', 'mod.json', 'icons', 'assets') } |
    Copy-Item -Destination $modTarget -Recurse -Force
Copy-Item -Path (Join-Path $sourceRoot 'layouts/ttj*.json') -Destination (Join-Path $herdrAppHome 'layouts') -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'THIRD_PARTY_NOTICES.txt') -Destination $modTarget -Force
if ($CorePath) {
    $coreFile = Get-Item -LiteralPath $CorePath
    if ($coreFile.PSIsContainer) { throw 'CorePath must name the Core executable.' }
    $bin = Join-Path $modTarget 'bin'
    New-Item -ItemType Directory -Force -Path $bin | Out-Null
    Copy-Item -LiteralPath $coreFile.FullName -Destination (Join-Path $bin 'ttjcore.exe') -Force
}
Write-Output 'Installed TTJ Mod and layouts.'
