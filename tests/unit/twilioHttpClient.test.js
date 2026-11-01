'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createSender } = require('../../src/services/messaging/twilioHttpClient');
const { DIAGNOSTIC_REPLY } = require('../../src/services/messaging/deliveryService');

test('restricted SDK transport classifies local responses and never follows redirects', async () => {
  const settings = { accountSid: 'AC' + '1'.repeat(32), authToken: 'synthetic-fixture-not-a-secret',
    from: 'whatsapp:+14155238886', recipient: 'whatsapp:+254700000001',
    status: { url: 'https://example.invalid/api/v1/webhook/twilio/status' }, timeoutMs: 200 };
  let response = { status: 201, body: { account_sid: settings.accountSid, sid: 'SM' + '1'.repeat(32), status: 'queued' } };
  let calls = 0;
  const server = http.createServer((req, res) => {
    calls++;
    req.resume();
    if (response.status === 0) return;
    res.writeHead(response.status, { Location: 'http://127.0.0.1:1/private' });
    res.end(JSON.stringify(response.body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const send = createSender(settings, { testTarget: `http://127.0.0.1:${server.address().port}` });
    assert.equal((await send(settings.recipient, DIAGNOSTIC_REPLY)).kind, 'accepted');
    response = { status: 429, body: { code: 20429 } };
    assert.equal((await send(settings.recipient, DIAGNOSTIC_REPLY)).kind, 'retry');
    for (const status of [302, 500, 0]) {
      response = { status, body: {} };
      assert.equal((await send(settings.recipient, DIAGNOSTIC_REPLY)).kind, 'uncertain');
    }
    assert.equal(calls, 5);
    for (const body of [{ data: 'x'.repeat(70000) }, { account_sid: 'wrong', sid: 'SM' + '1'.repeat(32), status: 'queued' },
      { account_sid: settings.accountSid, sid: 'invalid', status: 'queued' }]) {
      response = { status: 201, body };
      assert.equal((await send(settings.recipient, DIAGNOSTIC_REPLY)).kind, 'uncertain');
    }
    await assert.rejects(send(settings.recipient, 'unapproved text'));
    assert.equal(calls, 8);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
