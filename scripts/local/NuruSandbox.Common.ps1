Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Get-NuruPaths {
    $repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
    $projectRoot = [IO.Path]::GetFullPath((Join-Path $repo '..'))
    $runtime = Join-Path $repo '.nuru-sandbox'
    [pscustomobject]@{
        Repo = $repo
        ProjectRoot = $projectRoot
        Runtime = $runtime
        State = Join-Path $runtime 'runtime.json'
        AppOut = Join-Path $runtime 'app.out.log'
        AppErr = Join-Path $runtime 'app.err.log'
        NgrokOut = Join-Path $runtime 'ngrok.out.log'
        NgrokErr = Join-Path $runtime 'ngrok.err.log'
        Env = Join-Path $repo '.env'
        PgRoot = Join-Path $projectRoot '.knec-postgresql18'
        PgData = Join-Path $projectRoot '.knec-postgresql18\data'
        PgCtl = Join-Path $projectRoot '.knec-postgresql18\distribution\pgsql\bin\pg_ctl.exe'
        PgReady = Join-Path $projectRoot '.knec-postgresql18\distribution\pgsql\bin\pg_isready.exe'
        PgLog = Join-Path $projectRoot '.knec-postgresql18\server.log'
        Ngrok = Join-Path $env:USERPROFILE 'Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe'
    }
}

function Read-NuruEnv([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw 'Private .env file is missing.' }
    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }
        if ($line -notmatch '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { throw 'The private .env file contains an invalid line.' }
        $values[$matches[1]] = $matches[2]
    }
    return $values
}

function Get-Sha256([string]$Value) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value))) -replace '-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Test-NuruProcess([int]$Id, [string]$ExpectedExecutable, [string]$CommandPattern) {
    if ($Id -le 0) { return $false }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$Id" -ErrorAction SilentlyContinue
    if (-not $process) { return $false }
    if ($ExpectedExecutable -and [IO.Path]::GetFullPath($process.ExecutablePath) -ne [IO.Path]::GetFullPath($ExpectedExecutable)) { return $false }
    return (-not $CommandPattern -or $process.CommandLine -match $CommandPattern)
}

function Get-NuruState($Paths) {
    if (-not (Test-Path -LiteralPath $Paths.State -PathType Leaf)) { return $null }
    try { return Get-Content -LiteralPath $Paths.State -Raw | ConvertFrom-Json }
    catch { throw 'NURU runtime state is unreadable. Do not delete it while managed processes may still be running.' }
}

function Save-NuruState($Paths, $State) {
    New-Item -ItemType Directory -Force -Path $Paths.Runtime | Out-Null
    $State | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $Paths.State -Encoding UTF8
}

function Test-NuruPort([int]$Port) {
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Wait-NuruHttp([string]$Url, [int]$Seconds = 20) {
    $until = (Get-Date).AddSeconds($Seconds)
    do {
        try { if ((Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { return $true } } catch {}
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $until)
    return $false
}

function Get-NgrokTunnel {
    try {
        $response = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 3
        return @($response.tunnels | Where-Object { $_.public_url -match '^https://' }) | Select-Object -First 1
    } catch { return $null }
}

function Mask-NuruPhone([string]$Value) {
    $digits = $Value -replace '\D', ''
    if ($digits.Length -lt 3) { return '<configured>' }
    return ('*' * ($digits.Length - 3)) + $digits.Substring($digits.Length - 3)
}

function Assert-NuruConfiguration($Paths, $Values) {
    $required = @('TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_WHATSAPP_FROM','TWILIO_INBOUND_WEBHOOK_URL',
        'TWILIO_STATUS_CALLBACK_URL','TWILIO_TEST_RECIPIENTS','DATABASE_URL','TWILIO_CONVERSATION_SECRET')
    foreach ($key in $required) { if (-not $Values.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($Values[$key])) { throw "Required private setting $key is missing." } }
    if ($Values['TWILIO_MODE'] -ne 'sandbox' -or $Values['WHATSAPP_PROVIDER'] -ne 'twilio') { throw 'Only the Twilio Sandbox provider is permitted.' }
    if ($Values['TWILIO_WHATSAPP_FROM'] -ne 'whatsapp:+14155238886') { throw 'The configured sender is not the verified Twilio Sandbox sender.' }
    if ((Get-Sha256 $Values['TWILIO_ACCOUNT_SID']) -ne 'c5a1a4f746da2fe7bb4be8ab0bef5b71852d5a9e46c1a103b44b2d529c582f08') { throw 'The configured Twilio account does not match the approved development account.' }
    $recipients = @($Values['TWILIO_TEST_RECIPIENTS'].Split(',') | ForEach-Object { $_.Trim() })
    if ($recipients.Count -lt 1 -or $recipients.Count -gt 5 -or (@($recipients | Select-Object -Unique).Count -ne $recipients.Count)) { throw 'The Sandbox recipient allowlist must contain 1 to 5 unique recipients.' }
    foreach ($recipient in $recipients) { if ($recipient -notmatch '^whatsapp:\+[1-9][0-9]{0,14}$') { throw 'The Sandbox recipient allowlist contains an invalid address.' } }
    $database = [Uri]$Values['DATABASE_URL']
    if ($database.Host -ne '127.0.0.1' -or $database.Port -ne 55418 -or $database.AbsolutePath -ne '/knec_development') { throw 'DATABASE_URL is not the authorized local development database.' }
    $inbound = [Uri]$Values['TWILIO_INBOUND_WEBHOOK_URL']; $status = [Uri]$Values['TWILIO_STATUS_CALLBACK_URL']
    if ($inbound.Scheme -ne 'https' -or $status.Scheme -ne 'https' -or $inbound.Host -ne $status.Host -or
        $inbound.AbsolutePath -ne '/api/v1/webhook/twilio/whatsapp' -or $status.AbsolutePath -ne '/api/v1/webhook/twilio/status') {
        throw 'Twilio webhook URLs are unsafe or do not match the application routes.'
    }
    return $recipients
}

function Test-NuruDatabase($Paths, $Values) {
    $old = $env:DATABASE_URL
    try {
        $env:DATABASE_URL = $Values['DATABASE_URL']
        $code = @'
const { createPool } = require('./src/repository/deliveryStore');
(async () => {
  const pool = createPool(process.env.DATABASE_URL);
  const result = await pool.query("select current_database() db,current_user role,current_setting('server_version_num')::int version");
  const value = result.rows[0];
  if (value.db !== 'knec_development' || value.role !== 'knec_runtime' || value.version < 180000) process.exitCode = 2;
  await pool.end();
})().catch(() => { process.exitCode = 1; });
'@
        $code | & (Get-Command node.exe -ErrorAction Stop).Source -
        return ($LASTEXITCODE -eq 0)
    } finally { $env:DATABASE_URL = $old }
}
