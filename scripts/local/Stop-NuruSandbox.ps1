[CmdletBinding()]
param([switch]$StopPostgresIfStartedByNuru)
. (Join-Path $PSScriptRoot 'NuruSandbox.Common.ps1')
$paths = Get-NuruPaths
$state = Get-NuruState $paths
if (-not $state) { Write-Host 'No managed NURU Sandbox session is recorded.'; exit 0 }

$failures = @(); $node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (Test-NuruProcess ([int]$state.AppPid) $node 'src[\\/]index\.js') {
    Stop-Process -Id ([int]$state.AppPid) -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    if (Test-NuruProcess ([int]$state.AppPid) $node 'src[\\/]index\.js') { $failures += 'application' }
}
if (Test-NuruProcess ([int]$state.NgrokPid) $paths.Ngrok 'ngrok') {
    Stop-Process -Id ([int]$state.NgrokPid) -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    if (Test-NuruProcess ([int]$state.NgrokPid) $paths.Ngrok 'ngrok') { $failures += 'ngrok' }
}
if ($StopPostgresIfStartedByNuru -and $state.PostgresStartedByScript) {
    & $paths.PgCtl stop -D $paths.PgData -m fast -w | Out-Null
    if ($LASTEXITCODE -ne 0) { $failures += 'PostgreSQL' }
}
if (-not (Test-NuruPort 3000) -and -not (Get-NgrokTunnel)) { Remove-Item -LiteralPath $paths.State -Force -ErrorAction SilentlyContinue }
if ($failures.Count) { throw ('Could not stop: ' + ($failures -join ', ')) }
Write-Host 'NURU application, in-process response worker and managed ngrok tunnel are stopped.' -ForegroundColor Green
if ($state.PostgresStartedByScript -and -not $StopPostgresIfStartedByNuru) { Write-Host 'PostgreSQL remains running. Use -StopPostgresIfStartedByNuru only when you want to stop the instance NURU started.' }
