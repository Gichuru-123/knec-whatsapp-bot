. (Join-Path $PSScriptRoot 'NuruSandbox.Common.ps1')
$paths = Get-NuruPaths
$values = Read-NuruEnv $paths.Env
$state = Get-NuruState $paths
$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
& $paths.PgReady -h 127.0.0.1 -p 55418 -d knec_development 2>$null | Out-Null
$pgReady = $LASTEXITCODE -eq 0
$appRunning = $false; $ngrokRunning = $false
if ($state) {
    $appRunning = Test-NuruProcess ([int]$state.AppPid) $node 'src[\\/]index\.js'
    $ngrokRunning = Test-NuruProcess ([int]$state.NgrokPid) $paths.Ngrok 'ngrok'
}
$local = $false; $public = $false; $tunnel = Get-NgrokTunnel
if ($appRunning) { $local = Wait-NuruHttp 'http://127.0.0.1:3000/health' 2 }
if ($tunnel) { $public = Wait-NuruHttp ($tunnel.public_url + '/health') 4 }
$recipientCount = if ($values.ContainsKey('TWILIO_TEST_RECIPIENTS')) { @($values['TWILIO_TEST_RECIPIENTS'].Split(',')).Count } else { 0 }

Write-Host 'KNEC NURU SANDBOX STATUS'
Write-Host ('PostgreSQL 18 ready:            {0}' -f $pgReady)
Write-Host ('Application running:            {0}' -f $appRunning)
Write-Host ('Response worker running:        {0}' -f $appRunning)
Write-Host ('Managed ngrok running:          {0}' -f $ngrokRunning)
Write-Host ('Local health verified:          {0}' -f $local)
Write-Host ('Public HTTPS verified:          {0}' -f $public)
Write-Host ('Public endpoint:                {0}' -f $(if($tunnel){$tunnel.public_url}else{'<none>'}))
Write-Host ('Sandbox mode:                   {0}' -f ($values['TWILIO_MODE'] -eq 'sandbox'))
Write-Host ('Authorized tester count:        {0}' -f $recipientCount)
Write-Host ('Per-participant response allowance:  50')
Write-Host ('Conversation gate (process):    {0}' -f $appRunning)
Write-Host ('Live delivery gate (process):   {0}' -f $appRunning)
Write-Host ('Twilio Console webhook verified:{0}' -f $(if($state -and $state.TwilioConsoleWebhookVerified){' True'}else{' False (manual Console check required)'}))
$ready = $pgReady -and $appRunning -and $ngrokRunning -and $local -and $public -and $recipientCount -gt 0
Write-Host ('Local Sandbox readiness:         {0}' -f $ready) -ForegroundColor $(if($ready){'Green'}else{'Yellow'})
if ($ready) { Write-Host 'Send Hi only after confirming the same incoming webhook URL is saved in Twilio Console.' }
