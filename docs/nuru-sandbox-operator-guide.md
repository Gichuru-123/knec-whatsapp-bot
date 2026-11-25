# KNEC NURU Sandbox operator guide

This guide operates the private development-only Twilio WhatsApp Sandbox. It does not deploy or activate a production sender. Never paste `.env` values, Auth Tokens, passwords, full tester numbers or database URLs into chat, screenshots or Git.

## A. Open PowerShell

Press the Windows key, type `Windows PowerShell`, and open **Windows PowerShell**. PowerShell 5.1 is supported. Administrator mode is not normally required.

## B. Open the project directory

```powershell
Set-Location -LiteralPath 'C:\Users\hp\Desktop\Application Docs\Projects\KNEC_DIGITAL_ASS\knec-whatsapp-bot'
```

Confirm the location:

```powershell
Get-Location
Test-Path -LiteralPath '.\package.json'
```

The final command must print `True`.

## C. Start NURU

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\local\Start-NuruSandbox.ps1'
```

The script validates the repository, private configuration, pinned development Twilio account, official Sandbox sender, recipient allowlist, PostgreSQL 18 database, Node.js, npm and ngrok. It starts the application, its in-process response worker and the NURU ngrok tunnel. It never runs migrations.

Do not run the command twice. Use the status command if the script reports that NURU or port 3000 is already running.

## D. Verify PostgreSQL

Run:

```powershell
& 'C:\Users\hp\Desktop\Application Docs\Projects\KNEC_DIGITAL_ASS\.knec-postgresql18\distribution\pgsql\bin\pg_isready.exe' -h 127.0.0.1 -p 55418 -d knec_development
```

Expected result: `accepting connections`. The startup script starts only this dedicated PostgreSQL 18 instance when it is unavailable. It records whether it started PostgreSQL; normal shutdown leaves PostgreSQL running unless you explicitly request otherwise.

## E. Verify ngrok

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' | Select-Object -ExpandProperty tunnels | Select-Object public_url
```

The result must be one HTTPS address. Also run:

```powershell
.\scripts\local\Check-NuruSandbox.ps1
```

The public endpoint and public health check must be present and `True`.

## F. Configure the Twilio webhook

The startup script prints the exact URLs for the current session. Do not guess or reuse an old ngrok address.

1. Sign in to the approved Twilio development account.
2. Open **Messaging → Try it out → Send a WhatsApp message**.
3. Open **Sandbox settings**.
4. Under **When a message comes in**, enter the exact URL printed by the startup script. It ends with `/api/v1/webhook/twilio/whatsapp`.
5. Select HTTP method **POST**.
6. The application supplies its outbound status callback automatically. Confirm the printed callback ends with `/api/v1/webhook/twilio/status`; do not put the inbound URL in that field.
7. Save the Sandbox settings.
8. Confirm the Sandbox sender shown by Twilio is `+1 415 523 8886`. Stop if it differs.

The status script deliberately reports Twilio Console verification as manual. Local health alone does not prove that Twilio saved the current webhook.

## G. Join the Sandbox

In the same Twilio Sandbox page, locate the account-specific instruction in the form `join words-here`. The join phrase can change; obtain it from the live Console instead of this guide.

From each authorized WhatsApp phone:

1. Save or open the Sandbox number displayed by Twilio.
2. Send the exact current join phrase.
3. Wait for Twilio's confirmation that the phone joined the Sandbox.

Joining Twilio does not add a phone to NURU's allowlist. Both controls must pass.

## H. Test NURU

Send:

```text
Hi
```

NURU should introduce itself and show seven emoji-labelled categories. Use ordinary numbers, `BACK`, `MAIN MENU`, `HOME` or `HELP`. General Administration remains a Coming Soon placeholder. Draft knowledge remains blocked.

## I. Add and test an authorized friend

Every friend must first join the Twilio Sandbox. To add a third tester securely:

1. Stop NURU.
2. Open the private `.env` locally in VS Code. Never share it.
3. Find `TWILIO_TEST_RECIPIENTS`.
4. Append a comma followed by the new address in exact `whatsapp:+<countrycode><number>` format. Keep the existing entries unchanged. Do not add spaces inside a number.
5. Save, restart NURU and confirm the status reports three authorized testers.

Example shape only—do not copy these fictitious numbers:

```text
TWILIO_TEST_RECIPIENTS=whatsapp:+254700000001,whatsapp:+254700000002,whatsapp:+254700000003
```

The allowlist supports one to five unique phones. Each phone receives an independent PostgreSQL conversation identity and a separate 25-response test allowance.

## J. Check status

```powershell
.\scripts\local\Check-NuruSandbox.ps1
```

Ready for a phone test requires PostgreSQL readiness, the managed application, the in-process worker, the managed ngrok tunnel, local health, public HTTPS health and an authorized tester. You must separately confirm that Twilio Console contains the printed current incoming webhook.

## K. Shut down

```powershell
.\scripts\local\Stop-NuruSandbox.ps1
```

This stops only the application and ngrok PIDs recorded by the NURU startup script. It does not search for and kill every Node.js or ngrok process. The worker stops with the application. PostgreSQL stays available by default.

To stop PostgreSQL only when this NURU session originally started it:

```powershell
.\scripts\local\Stop-NuruSandbox.ps1 -StopPostgresIfStartedByNuru
```

## L. Restart after a computer shutdown

Open PowerShell, return to the project directory, then run the startup command from section C. The script checks and starts the dedicated database if necessary. A changed tunnel address requires updating Twilio Sandbox settings before sending `Hi`.

## M. Common errors

- **Port 3000 is already in use:** run the status command. If it is a managed NURU session, run the stop command. Do not kill unrelated Node.js processes.
- **An ngrok tunnel is already running:** stop that tunnel from its owning project or PowerShell window. The NURU script will not adopt or terminate an unrelated tunnel.
- **PostgreSQL is not accepting connections:** confirm the `.knec-postgresql18` folder exists, then rerun startup. Read `.knec-postgresql18\server.log` if startup fails; never share lines containing private configuration.
- **Wrong database:** restore the private `DATABASE_URL` to the authorized `knec_development` database on `127.0.0.1:55418`. Do not substitute the disposable test database.
- **Sender/account mismatch:** switch back to the approved Twilio development account and its official Sandbox. The script intentionally refuses other accounts or senders.
- **Missing recipient allowlist:** add authorized joined testers to `TWILIO_TEST_RECIPIENTS`; do not remove an existing tester while adding another.
- **NURU starts but WhatsApp does not reply:** run status, confirm public health, then compare the printed incoming URL character-for-character with Twilio Sandbox settings and confirm method POST. Confirm the phone received Twilio's join acknowledgement.
- **Twilio signature errors:** the public host saved in Twilio and the host configured locally must be identical. Restart and use the exact URL printed by the script.
- **The 26th message receives no reply:** the controlled policy permits 25 outbound responses per participant identity. Stop and start a newly authorized test session only under the approved operating procedure; do not bypass Twilio restrictions.
- **PowerShell execution policy blocks a script:** use the full `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...` startup command shown above. This bypass applies only to that process.

## N. Confirm shutdown

Run:

```powershell
.\scripts\local\Check-NuruSandbox.ps1
```

Application, response worker, managed ngrok and public HTTPS readiness must report false or unavailable. Also verify:

```powershell
try { Invoke-WebRequest -Uri 'http://127.0.0.1:3000/health' -UseBasicParsing -TimeoutSec 3 } catch { 'NURU is stopped' }
```

Closing the PowerShell window after startup does not reliably stop detached Windows child processes. Always use `Stop-NuruSandbox.ps1`. During a startup failure, the script performs best-effort cleanup. A forced computer shutdown, process crash or `Stop-Process` outside these scripts can leave stale state; the next status/start command will report the inconsistency rather than killing unrelated processes.
