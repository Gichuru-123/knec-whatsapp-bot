'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '../..');
const scripts = Object.fromEntries(['Start-NuruSandbox.ps1', 'Stop-NuruSandbox.ps1', 'Check-NuruSandbox.ps1',
  'NuruSandbox.Common.ps1'].map(name => [name, path.join(root, 'scripts/local', name)]));

test('NURU operator scripts exist and parse in Windows PowerShell 5.1', { skip: process.platform !== 'win32' }, () => {
  for (const file of Object.values(scripts)) {
    assert.equal(fs.existsSync(file), true);
    const command = `$errors=$null;[void][Management.Automation.Language.Parser]::ParseFile('${file.replaceAll("'", "''")}',[ref]$null,[ref]$errors);if($errors.Count){$errors|% Message;exit 1}`;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command],
      { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
});

test('startup fails closed around account, sender, database, dependencies, duplicates and Sandbox activation', () => {
  const common = fs.readFileSync(scripts['NuruSandbox.Common.ps1'], 'utf8');
  const start = fs.readFileSync(scripts['Start-NuruSandbox.ps1'], 'utf8');
  assert.match(common, /verified Twilio Sandbox sender/);
  assert.match(common, /approved development account/);
  assert.match(common, /authorized local development database/);
  assert.match(start, /PostgreSQL 18 tools are missing/);
  assert.match(start, /approved ngrok executable is missing/);
  assert.match(start, /Port 3000 is already in use/);
  assert.match(start, /ngrok tunnel is already running but is not owned/);
  for (const setting of ['TWILIO_MODE', 'TWILIO_DELIVERY_ENABLED', 'TWILIO_CONVERSATION_ENABLED',
    'TWILIO_LIVE_SEND_ENABLED', 'TWILIO_SANDBOX_MESSAGES_PER_PARTICIPANT']) assert.match(start, new RegExp(setting));
  assert.doesNotMatch(start, /db:migrate|migrate-db/);
});

test('shutdown targets recorded PIDs and status distinguishes local readiness from Twilio Console verification', () => {
  const stop = fs.readFileSync(scripts['Stop-NuruSandbox.ps1'], 'utf8');
  const check = fs.readFileSync(scripts['Check-NuruSandbox.ps1'], 'utf8');
  assert.match(stop, /state\.AppPid/);
  assert.match(stop, /state\.NgrokPid/);
  assert.doesNotMatch(stop, /Get-Process\s+(node|ngrok)|taskkill/i);
  assert.match(check, /Twilio Console webhook verified/);
  assert.match(check, /Local Sandbox readiness/);
  assert.match(check, /manual Console check required/);
});

test('50-response policy is per participant and duplicate safety remains covered by executable integration tests', () => {
  const config = fs.readFileSync(path.join(root, 'src/config/index.js'), 'utf8');
  const worker = fs.readFileSync(path.join(root, 'src/services/conversation/responseWorker.js'), 'utf8');
  const integration = fs.readFileSync(path.join(root, 'tests/integration/conversationMultiRecipient.test.js'), 'utf8');
  assert.match(config, /TWILIO_SANDBOX_MESSAGES_PER_PARTICIPANT/);
  assert.match(worker, /messagesPerParticipant/);
  assert.match(integration, /allows 50 responses per participant, blocks the 51st/);
  assert.match(integration, /duplicate\.duplicate, true/);
});
