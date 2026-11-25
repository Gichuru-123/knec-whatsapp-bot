[CmdletBinding()]
param([switch]$PreflightOnly)
. (Join-Path $PSScriptRoot 'NuruSandbox.Common.ps1')

$paths = Get-NuruPaths
if (-not (Test-Path -LiteralPath (Join-Path $paths.Repo 'package.json'))) { throw 'Run the script from the KNEC NURU repository.' }
Set-Location -LiteralPath $paths.Repo
$values = Read-NuruEnv $paths.Env
$recipients = Assert-NuruConfiguration $paths $values

$node = (Get-Command node.exe -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath $paths.PgCtl) -or -not (Test-Path -LiteralPath $paths.PgReady)) { throw 'The dedicated PostgreSQL 18 tools are missing.' }
if (-not (Test-Path -LiteralPath $paths.Ngrok)) { throw 'The approved ngrok executable is missing.' }

$existing = Get-NuruState $paths
if ($existing -and ((Test-NuruProcess ([int]$existing.AppPid) $node 'src[\\/]index\.js') -or
    (Test-NuruProcess ([int]$existing.NgrokPid) $paths.Ngrok 'ngrok'))) { throw 'NURU is already running. Use Check-NuruSandbox.ps1.' }
if (Test-NuruPort 3000) { throw 'Port 3000 is already in use. Refusing to start a duplicate or unrelated application.' }
if (Get-NgrokTunnel) { throw 'An ngrok tunnel is already running but is not owned by this startup session.' }

& $paths.PgReady -h 127.0.0.1 -p 55418 -d knec_development 2>$null | Out-Null
$pgWasReady = $LASTEXITCODE -eq 0
$pgStarted = $false; $app = $null; $ngrok = $null
try {
    if (-not $pgWasReady) {
        & $paths.PgCtl start -D $paths.PgData -l $paths.PgLog -w | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'The dedicated PostgreSQL 18 instance did not start.' }
        $pgStarted = $true
    }
    if (-not (Test-NuruDatabase $paths $values)) { throw 'The authorized knec_development database is not reachable with the runtime role.' }

    Write-Host ('Preflight passed: PostgreSQL 18 ready; {0} authorized tester(s); 25 responses per tester.' -f $recipients.Count)
    if ($PreflightOnly) { return }

    New-Item -ItemType Directory -Force -Path $paths.Runtime | Out-Null
    $overrides = @{
        NODE_ENV='development'; WHATSAPP_PROVIDER='twilio'; TWILIO_MODE='sandbox';
        TWILIO_DELIVERY_ENABLED='true'; TWILIO_CONVERSATION_ENABLED='true'; TWILIO_LIVE_SEND_ENABLED='true';
        TWILIO_SANDBOX_MESSAGES_PER_PARTICIPANT='25'; ENABLE_DEV_INSPECTION_ROUTES='false'; TRUST_PROXY_HOPS='1'
    }
    $saved = @{}
    foreach ($key in $overrides.Keys) { $saved[$key] = [Environment]::GetEnvironmentVariable($key,'Process'); [Environment]::SetEnvironmentVariable($key,$overrides[$key],'Process') }
    try {
        $app = Start-Process -FilePath $node -ArgumentList 'src/index.js' -WorkingDirectory $paths.Repo -WindowStyle Hidden `
            -RedirectStandardOutput $paths.AppOut -RedirectStandardError $paths.AppErr -PassThru
    } finally { foreach ($key in $overrides.Keys) { [Environment]::SetEnvironmentVariable($key,$saved[$key],'Process') } }
    if (-not (Wait-NuruHttp 'http://127.0.0.1:3000/health' 25)) { throw 'NURU did not become healthy on loopback.' }

    $hostName = ([Uri]$values['TWILIO_INBOUND_WEBHOOK_URL']).Host
    $ngrok = Start-Process -FilePath $paths.Ngrok -ArgumentList @('http','--url',$hostName,'3000') -WorkingDirectory $paths.Repo -WindowStyle Hidden `
        -RedirectStandardOutput $paths.NgrokOut -RedirectStandardError $paths.NgrokErr -PassThru
    $until = (Get-Date).AddSeconds(25); $tunnel = $null
    do { Start-Sleep -Milliseconds 500; $tunnel = Get-NgrokTunnel } while (-not $tunnel -and (Get-Date) -lt $until)
    if (-not $tunnel -or $tunnel.public_url -ne ('https://' + $hostName)) { throw 'ngrok did not expose the exact URL required for Twilio signature validation.' }
    if (-not (Wait-NuruHttp ($tunnel.public_url + '/health') 15)) { throw 'The public HTTPS tunnel is not reachable.' }

    $state = [ordered]@{ AppPid=$app.Id; NgrokPid=$ngrok.Id; PostgresStartedByScript=$pgStarted;
        PublicUrl=$tunnel.public_url; StartedAt=(Get-Date).ToUniversalTime().ToString('o'); TesterCount=$recipients.Count;
        MessageLimitPerParticipant=25; TwilioConsoleWebhookVerified=$false }
    Save-NuruState $paths $state
    Write-Host ''
    Write-Host 'NURU SANDBOX STARTED' -ForegroundColor Green
    Write-Host ('Authorized testers: {0}; allowance: 25 responses per tester.' -f $recipients.Count)
    Write-Host ('Incoming webhook (POST): {0}/api/v1/webhook/twilio/whatsapp' -f $tunnel.public_url)
    Write-Host ('Status callback:         {0}/api/v1/webhook/twilio/status' -f $tunnel.public_url)
    Write-Host 'Save the incoming webhook in Twilio Console > Messaging > Try it out > Send a WhatsApp message > Sandbox settings.'
    Write-Host 'The Twilio Console setting is not automatically verified. Run Check-NuruSandbox.ps1 after saving it.'
} catch {
    if ($ngrok -and -not $ngrok.HasExited) { Stop-Process -Id $ngrok.Id -Force -ErrorAction SilentlyContinue }
    if ($app -and -not $app.HasExited) { Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue }
    if ($pgStarted) { & $paths.PgCtl stop -D $paths.PgData -m fast -w | Out-Null }
    throw
}
