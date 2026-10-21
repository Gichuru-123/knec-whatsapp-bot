'use strict';
const assert = require('assert');
const test = require('node:test');
const crypto = require('crypto');
const MetaWhatsAppAdapter = require('../../src/services/messaging/metaAdapter');
const config = require('../../src/config');
const logger = require('../../src/logger');

test('MetaWhatsAppAdapter: Constructs dynamic API endpoint using configured version', () => {
  const adapter = new MetaWhatsAppAdapter();
  const endpoint = adapter.getApiEndpoint();
  assert.ok(endpoint.includes(config.metaGraphApiVersion));
});

test('MetaWhatsAppAdapter: Normalizes multi-event webhook payload with multiple messages', () => {
  const adapter = new MetaWhatsAppAdapter();
  const rawMetaPayload = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                { id: 'wamid.1', from: '254700000001', timestamp: '1728000000', type: 'text', text: { body: 'First' } },
                { id: 'wamid.2', from: '254700000002', timestamp: '1728000001', type: 'text', text: { body: 'Second' } }
              ]
            }
          }
        ]
      }
    ]
  };

  const normalized = adapter.normalizeInboundPayload(rawMetaPayload);
  assert.strictEqual(normalized.length, 2);
  assert.strictEqual(normalized[0].messageId, 'wamid.1');
  assert.strictEqual(normalized[0].textBody, 'First');
  assert.strictEqual(normalized[1].messageId, 'wamid.2');
  assert.strictEqual(normalized[1].textBody, 'Second');
});

test('MetaWhatsAppAdapter: Safely ignores delivery/status receipts without crashing', () => {
  const adapter = new MetaWhatsAppAdapter();
  const statusPayload = {
    entry: [
      {
        changes: [
          {
            value: {
              statuses: [{ id: 'wamid.1', status: 'delivered', recipient_id: '254700000000' }]
            }
          }
        ]
      }
    ]
  };

  const normalized = adapter.normalizeInboundPayload(statusPayload);
  assert.strictEqual(normalized.length, 0);
});

test('MetaWhatsAppAdapter: Validates raw body HMAC SHA-256 signature', () => {
  const adapter = new MetaWhatsAppAdapter();
  const rawBody = Buffer.from(JSON.stringify({ test: 'data' }), 'utf8');

  const hmac = crypto.createHmac('sha256', config.whatsappAppSecret);
  hmac.update(rawBody);
  const validSignature = 'sha256=' + hmac.digest('hex');

  const req = {
    headers: { 'x-hub-signature-256': validSignature },
    rawBody: rawBody
  };

  assert.strictEqual(adapter.validateSignature(req), true);
});

test('Logger: Redacts sensitive WhatsApp tokens in metadata', () => {
  const formatted = logger.formatMessage('info', 'Auth test', {
    whatsapp_access_token: 'EAAG123456SECRET',
    whatsapp_app_secret: 'app-secret-789'
  });

  assert.ok(formatted.includes('[REDACTED]'));
  assert.ok(!formatted.includes('EAAG123456SECRET'));
  assert.ok(!formatted.includes('app-secret-789'));
});

// ---------------------------------------------------------------------------------------------
// R2b: outbound sending tests. These use a fake local server on this computer and never contact Meta.
// ---------------------------------------------------------------------------------------------
const http = require('http');

const FAKE_ACCESS_TOKEN = 'test-fixture-access-token-not-a-secret';

// Starts a local HTTP server; `handler` decides how it answers. Records every request it receives.
async function startFakeGraphApi(handler) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, headers: req.headers, body });
      handler(req, res);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const stop = () => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); });
  return { requests, port: server.address().port, stop };
}

// A Meta adapter pointed at the fake local server instead of graph.facebook.com.
function adapterFor(port, overrides = {}) {
  const adapter = new MetaWhatsAppAdapter();
  adapter.accessToken = FAKE_ACCESS_TOKEN;
  adapter.phoneNumberId = '123456789';
  Object.assign(adapter, overrides);
  adapter.getApiEndpoint = () => `http://127.0.0.1:${port}/${adapter.apiVersion}/${adapter.phoneNumberId}/messages`;
  return adapter;
}

test('R2b Outbound: sends a correctly formed text message with the access token in the Authorization header', async () => {
  const fake = await startFakeGraphApi((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messaging_product: 'whatsapp', messages: [{ id: 'wamid.out1' }] }));
  });

  try {
    const result = await adapterFor(fake.port).sendTextMessage('254700000001', 'Hello from the test');

    assert.strictEqual(result.messages[0].id, 'wamid.out1');
    assert.strictEqual(fake.requests.length, 1);
    const sent = fake.requests[0];
    assert.strictEqual(sent.method, 'POST');
    assert.strictEqual(sent.url, `/${config.metaGraphApiVersion}/123456789/messages`);
    assert.strictEqual(sent.headers.authorization, `Bearer ${FAKE_ACCESS_TOKEN}`);
    assert.match(sent.headers['content-type'], /^application\/json/);
    assert.deepStrictEqual(JSON.parse(sent.body), {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '254700000001',
      type: 'text',
      text: { body: 'Hello from the test' }
    });
  } finally {
    await fake.stop();
  }
});

test('R2b Outbound: an error reply from the API is reported with its status, without exposing the access token', async () => {
  const fake = await startFakeGraphApi((req, res) => {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Invalid OAuth access token.', code: 190 } }));
  });

  try {
    await assert.rejects(
      adapterFor(fake.port).sendTextMessage('254700000001', 'Hello'),
      (err) => /Meta Cloud API HTTP Error 401/.test(err.message) && !err.message.includes(FAKE_ACCESS_TOKEN)
    );
  } finally {
    await fake.stop();
  }
});

test('R2b Outbound: a request that gets no answer is abandoned after the configured timeout', { timeout: 10000 }, async () => {
  const fake = await startFakeGraphApi(() => { /* never answers */ });
  // Safety net: if the adapter ever lost its timeout, cut the connection after 5 seconds so this test
  // fails with a clear error instead of hanging the whole test run.
  const safetyNet = setTimeout(() => { fake.stop(); }, 5000);

  try {
    const started = Date.now();
    await assert.rejects(
      adapterFor(fake.port, { timeoutMs: 300 }).sendTextMessage('254700000001', 'Hello'),
      /Timed Out after 300ms/
    );
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 3000, `should give up shortly after 300ms (took ${elapsed}ms)`);
  } finally {
    clearTimeout(safetyNet);
    await fake.stop();
  }
});

test('R2b Outbound: refuses to send, without contacting the API, when credentials are missing', async () => {
  const fake = await startFakeGraphApi((req, res) => { res.writeHead(200); res.end('{}'); });

  try {
    await assert.rejects(
      adapterFor(fake.port, { accessToken: '' }).sendTextMessage('254700000001', 'Hello'),
      /credentials missing/
    );
    await assert.rejects(
      adapterFor(fake.port, { phoneNumberId: '' }).sendTextMessage('254700000001', 'Hello'),
      /credentials missing/
    );
    assert.strictEqual(fake.requests.length, 0, 'no request may be sent without credentials');
  } finally {
    await fake.stop();
  }
});

test('Phase 4 repair: malformed messages do not discard valid text or interactive replies later in a batch', () => {
  const base = { id: 'wamid.valid', from: '254700000001', timestamp: '1728000000', type: 'text', text: { body: ' valid ' } };
  const messages = [
    { ...base, text: { body: 123 } },
    { ...base, id: { private: 'PRIVATE_MESSAGE' } },
    { ...base, from: 254700000001 },
    { ...base, timestamp: '1728junk' },
    { ...base, type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: {} } } },
    base,
    { ...base, id: 'wamid.button', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'option-1', title: 'Option 1' } } },
    { ...base, id: 'wamid.list', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'option-2' } } },
    { ...base, id: 'wamid.media', type: 'image' }
  ];
  const result = new MetaWhatsAppAdapter().normalizeInboundPayload({ entry: [null, { changes: [null, { value: { messages } }] }] });
  assert.deepStrictEqual(result.map(m => [m.messageId, m.type, m.textBody]), [
    ['wamid.valid', 'text', 'valid'], ['wamid.button', 'interactive', 'option-1'],
    ['wamid.list', 'interactive', 'option-2'], ['wamid.media', 'unsupported', '']
  ]);
});

test('Phase 4 repair: timeout stays active after headers while the response body stalls', { timeout: 10000 }, async () => {
  let headersSent = false;
  const fake = await startFakeGraphApi((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.flushHeaders();
    res.write('{"messages":');
    headersSent = true;
  });
  const safetyNet = setTimeout(() => { fake.stop(); }, 5000);
  try {
    const started = Date.now();
    await assert.rejects(adapterFor(fake.port, { timeoutMs: 300 }).sendTextMessage('254700000001', 'private text'),
      err => err.code === 'META_TIMEOUT' && /Timed Out after 300ms/.test(err.message));
    assert.ok(headersSent, 'must reach the response-body stage');
    assert.ok(Date.now() - started < 3000, 'must not wait for the safety net');
  } finally {
    clearTimeout(safetyNet);
    await fake.stop();
  }
});

test('Phase 4 repair: provider error bodies are discarded even if they contain credentials and message text', async () => {
  const marker = 'PRIVATE_PROVIDER_BODY_SENTINEL';
  const fake = await startFakeGraphApi((req, res) => {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: marker, token: FAKE_ACCESS_TOKEN, phone: '254700000001' } }));
  });
  try {
    await assert.rejects(adapterFor(fake.port).sendTextMessage('254700000001', marker), err => {
      const exposed = err.message + err.stack + JSON.stringify(err) + logger.formatMessage('error', 'Provider failed', err);
      assert.strictEqual(err.code, 'META_HTTP_ERROR');
      assert.strictEqual(err.providerStatus, 400);
      for (const value of [marker, FAKE_ACCESS_TOKEN, '254700000001']) assert.ok(!exposed.includes(value));
      assert.strictEqual(err.cause, undefined);
      return true;
    });
  } finally { await fake.stop(); }
});

test('Phase 4 repair: malformed success bodies produce a safe error with no JSON excerpt', async () => {
  const marker = 'PRIVATE';
  const fake = await startFakeGraphApi((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(marker);
  });
  try {
    await assert.rejects(adapterFor(fake.port).sendTextMessage('254700000001', marker), err => {
      assert.strictEqual(err.code, 'META_RESPONSE_ERROR');
      assert.ok(!(err.message + err.stack + JSON.stringify(err)).includes(marker));
      return true;
    });
  } finally { await fake.stop(); }
});

test('Phase 4 repair: network failures do not expose transport errors or their causes', async () => {
  const fake = await startFakeGraphApi((req) => { req.socket.destroy(); });
  try {
    await assert.rejects(adapterFor(fake.port).sendTextMessage('254700000001', 'PRIVATE_NETWORK_TEXT'), err => {
      assert.strictEqual(err.code, 'META_NETWORK_ERROR');
      assert.strictEqual(err.message, 'Meta API request failed.');
      assert.strictEqual(err.cause, undefined);
      assert.ok(!err.stack.includes('PRIVATE_NETWORK_TEXT'));
      return true;
    });
  } finally { await fake.stop(); }
});

test('Phase 4 repair: transport exceptions cannot impersonate safe provider errors', async () => {
  const savedFetch = global.fetch;
  const spoofed = Object.assign(new Error('PRIVATE_TRANSPORT_SENTINEL'), { code: 'META_HTTP_ERROR' });
  try {
    for (const failure of [spoofed, null, 'PRIVATE_TRANSPORT_SENTINEL']) {
      global.fetch = async () => { throw failure; };
      await assert.rejects(adapterFor(1).sendTextMessage('254700000001', 'private'), err => {
        assert.strictEqual(err.code, 'META_NETWORK_ERROR');
        assert.ok(!(err.message + err.stack).includes('PRIVATE_TRANSPORT_SENTINEL'));
        return true;
      });
    }
  } finally { global.fetch = savedFetch; }
});
