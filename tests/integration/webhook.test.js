'use strict';
const assert = require('assert');
const test = require('node:test');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const config = require('../../src/config');

test('GET /api/v1/webhook/whatsapp - Returns 200 OK on valid verification token', async () => {
  const res = await request(app)
    .get('/api/v1/webhook/whatsapp')
    .query({
      'hub.mode': 'subscribe',
      'hub.verify_token': config.whatsappVerifyToken,
      'hub.challenge': 'CHALLENGE_123'
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.text, 'CHALLENGE_123');
});

test('GET /api/v1/webhook/whatsapp - Returns 403 Forbidden on invalid verification token', async () => {
  const res = await request(app)
    .get('/api/v1/webhook/whatsapp')
    .query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': 'CHALLENGE_123'
    });

  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body.error.code, 403);
});

test('POST /api/v1/webhook/whatsapp - Processes valid HMAC signature & multi-message payload', async () => {
  const payload = {
    entry: [{
      changes: [{
        value: {
          messages: [
            { id: 'wamid.101', from: '254711111111', timestamp: '1728000000', type: 'text', text: { body: '1' } },
            { id: 'wamid.102', from: '254722222222', timestamp: '1728000001', type: 'text', text: { body: '2' } }
          ]
        }
      }]
    }]
  };

  const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
  const hmac = crypto.createHmac('sha256', config.whatsappAppSecret);
  hmac.update(rawBody);
  const signature = 'sha256=' + hmac.digest('hex');

  const res = await request(app)
    .post('/api/v1/webhook/whatsapp')
    .set('Content-Type', 'application/json')
    .set('x-hub-signature-256', signature)
    .send(JSON.stringify(payload));

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'acknowledged');
  assert.strictEqual(res.body.count, 2);
});

test('POST /api/v1/webhook/whatsapp - Returns 401 Unauthorized when x-hub-signature-256 header is completely absent', async () => {
  const res = await request(app)
    .post('/api/v1/webhook/whatsapp')
    .set('Content-Type', 'application/json')
    .send({ test: 'missing_signature' });

  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.error.code, 401);
  assert.strictEqual(res.body.error.message, 'Unauthorized: Invalid or missing webhook signature.');
});

test('POST /api/v1/webhook/whatsapp - Returns 401 Unauthorized on invalid HMAC signature', async () => {
  const res = await request(app)
    .post('/api/v1/webhook/whatsapp')
    .set('Content-Type', 'application/json')
    .set('x-hub-signature-256', 'sha256=invalid_signature_hash')
    .send({ test: 'unauthorized' });

  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.error.code, 401);
});

// R2a (decision 1A): the signature is checked BEFORE the body is parsed. This replaces the earlier
// test that expected "200 acknowledged" for malformed, unsigned JSON.
test('R2a POST /api/v1/webhook/whatsapp - Rejects malformed JSON without a valid signature with 401 (signature checked first)', async () => {
  const res = await request(app)
    .post('/api/v1/webhook/whatsapp')
    .set('Content-Type', 'application/json')
    .send('{ malformed_json: bad_syntax ');

  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.error.code, 401);
});

test('R2a POST /api/v1/webhook/whatsapp - Rejects correctly signed but malformed JSON with 400', async () => {
  const rawBody = Buffer.from('{ malformed_json: bad_syntax ', 'utf8');
  const signature = 'sha256=' + crypto.createHmac('sha256', config.whatsappAppSecret).update(rawBody).digest('hex');

  const res = await request(app)
    .post('/api/v1/webhook/whatsapp')
    .set('Content-Type', 'application/json')
    .set('x-hub-signature-256', signature)
    .send(rawBody.toString('utf8'));

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error.code, 400);
});

test('R2a POST /api/v1/webhook/whatsapp - Verifies the signature on the exact bytes received, not a re-encoded copy', async () => {
  // Spacing and a \u escape make these bytes differ from JSON.stringify(JSON.parse(body)).
  const raw = Buffer.from('{ "entry" : [ { "changes": [ { "value": { "messages": [ { "id":"wamid.raw1", "from":"254700000009", "type":"text", "text": {"body":"caf\\u00e9"} } ] } } ] } ] }\n', 'utf8');
  const reEncoded = Buffer.from(JSON.stringify(JSON.parse(raw.toString('utf8'))), 'utf8');
  assert.notStrictEqual(raw.toString('utf8'), reEncoded.toString('utf8'));

  const sign = (buf) => 'sha256=' + crypto.createHmac('sha256', config.whatsappAppSecret).update(buf).digest('hex');

  const exact = await request(app)
    .post('/api/v1/webhook/whatsapp')
    .set('Content-Type', 'application/json')
    .set('x-hub-signature-256', sign(raw))
    .send(raw.toString('utf8'));
  assert.strictEqual(exact.status, 200);
  assert.strictEqual(exact.body.count, 1);

  const wrongBytes = await request(app)
    .post('/api/v1/webhook/whatsapp')
    .set('Content-Type', 'application/json')
    .set('x-hub-signature-256', sign(reEncoded))
    .send(raw.toString('utf8'));
  assert.strictEqual(wrongBytes.status, 401);
});

test('R2a POST /api/v1/webhook/whatsapp - Accepts a signed body just under the 100kb webhook limit', async () => {
  const payload = { entry: [], padding: 'x'.repeat(90 * 1024) }; // about 90KB
  const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = 'sha256=' + crypto.createHmac('sha256', config.whatsappAppSecret).update(rawBody).digest('hex');

  const res = await request(app)
    .post('/api/v1/webhook/whatsapp')
    .set('Content-Type', 'application/json')
    .set('x-hub-signature-256', signature)
    .send(rawBody.toString('utf8'));

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'acknowledged');
});

test('R2a Non-webhook routes - Reject JSON bodies over 10kb with 413', async () => {
  const res = await request(app)
    .post('/health')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({ data: 'x'.repeat(20 * 1024) })); // about 20KB

  assert.strictEqual(res.status, 413);
  assert.strictEqual(res.body.error.code, 413);
});

test('R2a GET /api/v1/webhook/whatsapp - Returns the challenge as text/plain', async () => {
  const res = await request(app)
    .get('/api/v1/webhook/whatsapp')
    .query({ 'hub.mode': 'subscribe', 'hub.verify_token': config.whatsappVerifyToken, 'hub.challenge': '<b>CHALLENGE</b>' });

  assert.strictEqual(res.status, 200);
  assert.match(res.headers['content-type'], /^text\/plain/);
  assert.strictEqual(res.text, '<b>CHALLENGE</b>');
});

test('R2a CORS - Browser preflight no longer allows POST or the Authorization header', async () => {
  const res = await request(app)
    .options('/api/v1/webhook/whatsapp')
    .set('Origin', 'http://localhost:3000')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'authorization,content-type');

  const allowedMethods = (res.headers['access-control-allow-methods'] || '').toUpperCase();
  const allowedHeaders = (res.headers['access-control-allow-headers'] || '').toLowerCase();

  assert.ok(allowedMethods.includes('GET'), 'GET must remain allowed');
  assert.ok(!allowedMethods.includes('POST'), 'POST must not be allowed for browsers');
  assert.ok(!allowedHeaders.includes('authorization'), 'Authorization header must not be allowed for browsers');
});

test('POST /api/v1/webhook/whatsapp - Returns 413 Payload Too Large on oversized body', async () => {
  const hugePayload = { data: 'x'.repeat(200 * 1024) }; // 200KB payload
  const res = await request(app)
    .post('/api/v1/webhook/whatsapp')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify(hugePayload));

  assert.strictEqual(res.status, 413);
  assert.strictEqual(res.body.error.code, 413);
});

test('R1 Regression: Rejects a message signed with the old publicly known fallback app secret', async () => {
  const payload = {
    entry: [{
      changes: [{
        value: {
          messages: [
            { id: 'wamid.forged', from: '254799999999', timestamp: '1728000000', type: 'text', text: { body: 'forged' } }
          ]
        }
      }]
    }]
  };

  const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
  const forgedSignature = 'sha256=' + crypto.createHmac('sha256', 'test-app-secret-456').update(rawBody).digest('hex');

  const res = await request(app)
    .post('/api/v1/webhook/whatsapp')
    .set('Content-Type', 'application/json')
    .set('x-hub-signature-256', forgedSignature)
    .send(rawBody.toString('utf8'));

  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.error.code, 401);
});

test('R1 Regression: Verification tokens and query strings never appear in log output', async () => {
  const wrongToken = 'attacker-guess-token-777';
  let captured = '';
  const original = { log: console.log, warn: console.warn, error: console.error };
  const capture = (...args) => { captured += args.join(' ') + '\n'; };
  console.log = capture;
  console.warn = capture;
  console.error = capture;

  try {
    const ok = await request(app)
      .get('/api/v1/webhook/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': config.whatsappVerifyToken, 'hub.challenge': 'CHALLENGE_LOG' });
    const bad = await request(app)
      .get('/api/v1/webhook/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': wrongToken, 'hub.challenge': 'CHALLENGE_LOG' });
    // The request log line is written when the response finishes; let pending events run first.
    await new Promise((resolve) => setImmediate(resolve));

    assert.strictEqual(ok.status, 200);
    assert.strictEqual(bad.status, 403);
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }

  assert.ok(captured.includes('[HTTP] GET /api/v1/webhook/whatsapp 200'), 'request log line must be captured');
  assert.ok(captured.includes('[HTTP] GET /api/v1/webhook/whatsapp 403'), 'request log line must be captured');
  assert.ok(!captured.includes(config.whatsappVerifyToken), 'configured verify token must not be logged');
  assert.ok(!captured.includes(wrongToken), 'attempted verify token must not be logged');
  assert.ok(!captured.includes('hub.verify_token'), 'query string must not be logged');
});

// R2a: the earlier 'Rate Limiter' test built its own throwaway limiter, so it never tested this app.
// The app's real limiter is now tested in tests/integration/rateLimit.test.js and trustProxy.test.js.

test('Phase 4 repair: signed mixed batch still hands off valid messages after malformed messages', async () => {
  const payload = { entry: [{ changes: [{ value: { messages: [
    { id: 'wamid.bad', from: '254700000001', type: 'text', text: { body: { private: 'PRIVATE_BATCH_SENTINEL' } } },
    { id: 'wamid.after-bad', from: '254700000001', type: 'text', text: { body: 'PRIVATE_VALID_SENTINEL' } }
  ] } }] }] };
  const raw = JSON.stringify(payload);
  const signature = 'sha256=' + crypto.createHmac('sha256', config.whatsappAppSecret).update(raw).digest('hex');
  const saved = { log: console.log, warn: console.warn, error: console.error };
  let captured = '';
  const capture = (...args) => { captured += args.join(' '); };
  console.log = capture; console.warn = capture; console.error = capture;
  try {
    const response = await request(app).post('/api/v1/webhook/whatsapp')
      .set('Content-Type', 'application/json').set('x-hub-signature-256', signature).send(raw);
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.count, 1);
    assert.ok(captured.includes('wamid.after-bad'), 'valid message must reach the handoff');
    for (const value of ['PRIVATE_BATCH_SENTINEL', 'PRIVATE_VALID_SENTINEL', '254700000001']) assert.ok(!captured.includes(value));
  } finally { Object.assign(console, saved); }
});
