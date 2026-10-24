'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const request = require('supertest');
const config = require('../../src/config');
const TEST_ENV = require('../helpers/testEnv');
const handoff = require('../../src/services/messaging/conversationHandOff');
const Adapter = require('../../src/services/messaging/twilioAdapter');

const PATH = '/api/v1/webhook/twilio/whatsapp';
const STATUS = '/api/v1/webhook/twilio/status';
const TOKEN = 'public-twilio-integration-fixture';
const ENV = { ...TEST_ENV, WHATSAPP_PROVIDER: 'twilio', ENABLE_DEV_INSPECTION_ROUTES: 'false',
  WEBHOOK_RATE_LIMIT_MAX: '1000', TWILIO_ACCOUNT_SID: 'AC' + '1'.repeat(32), TWILIO_AUTH_TOKEN: TOKEN,
  TWILIO_WHATSAPP_FROM: 'whatsapp:+15005550006', TWILIO_TEST_RECIPIENT: 'whatsapp:+15005550007',
  TWILIO_INBOUND_WEBHOOK_URL: 'https://example.test' + PATH,
  TWILIO_STATUS_CALLBACK_URL: 'https://example.test' + STATUS };
const FIELDS = { AccountSid: ENV.TWILIO_ACCOUNT_SID, MessageSid: 'SM' + '2'.repeat(32),
  To: ENV.TWILIO_WHATSAPP_FROM, From: ENV.TWILIO_TEST_RECIPIENT, NumMedia: '0', Body: 'PRIVATE_TEXT + 世界' };
function sign(fields, url = ENV.TWILIO_INBOUND_WEBHOOK_URL) {
  const value = url + Object.keys(fields).sort().map(key => key + fields[key]).join('');
  return crypto.createHmac('sha1', TOKEN).update(value).digest('base64');
}
function post(app, fields = FIELDS, path = PATH, url) {
  return request(app).post(path).type('form').set('X-Twilio-Signature', sign(fields, url))
    .send(new URLSearchParams(fields).toString());
}
async function withApp(overrides, run) {
  const saved = { ...config };
  const modules = ['../../src/app', '../../src/routes/twilioWebhookRoutes', '../../src/routes/webhookRoutes',
    '../../src/middleware/twilioWebhookBody', '../../src/middleware/rateLimiter'].map(require.resolve);
  const cached = modules.map(id => require.cache[id]);
  try {
    Object.assign(config, config.validateConfig({ ...ENV, ...overrides }));
    modules.forEach(id => { delete require.cache[id]; });
    await run(require('../../src/app'));
  } finally {
    Object.assign(config, saved);
    modules.forEach((id, i) => { delete require.cache[id]; if (cached[i]) require.cache[id] = cached[i]; });
  }
}

test('Twilio routes: signed text preserves values and unknown scalar fields without automatic sends', async () => {
  const original = handoff.handleInboundBatch;
  const send = Adapter.prototype.sendTextMessage;
  const batches = [];
  let sends = 0;
  handoff.handleInboundBatch = async messages => { batches.push(messages); };
  Adapter.prototype.sendTextMessage = async () => { sends++; };
  try {
    await withApp({}, async app => {
      const fields = Object.assign(Object.create(null), FIELDS, { '__proto__': 'ordinary' });
      fields.__proto__ = 'ordinary'; fields['nested[field]'] = 'literal'; fields.NewField = 'café + & =';
      for (let i = 0; i < 2; i++) {
        const res = await post(app, fields);
        assert.equal(res.status, 200); assert.match(res.headers['content-type'], /^text\/xml/);
        assert.equal(res.text, '<Response></Response>');
      }
      assert.equal(batches.length, 2); assert.equal(batches[0][0].textBody, FIELDS.Body);
      assert.equal(batches[0][0].senderPhone, '15005550007');
      assert.equal(batches[0][0].rawProvider, 'twilio'); assert.equal(sends, 0);
      assert.equal({}.polluted, undefined);
    });
  } finally { handoff.handleInboundBatch = original; Adapter.prototype.sendTextMessage = send; }
});

test('Twilio routes: authentication, exact target binding and callback URL separation', async () => {
  await withApp({}, async app => {
    const form = new URLSearchParams(FIELDS).toString();
    for (const signature of ['', 'invalid', sign({ ...FIELDS, Body: 'changed' }), sign(FIELDS, 'https://evil.test' + PATH)]) {
      const res = await request(app).post(PATH).type('form').set('X-Twilio-Signature', signature)
        .set('Host', 'evil.test').set('X-Forwarded-Host', 'evil.test').send(form);
      assert.equal(res.status, 401);
    }
    assert.equal((await post(app, FIELDS, PATH + '?secret=PRIVATE_QUERY')).status, 401);
    assert.equal((await post(app, FIELDS, PATH + '/')).status, 404);
    const callback = { AccountSid: FIELDS.AccountSid, MessageSid: FIELDS.MessageSid, MessageStatus: 'sent' };
    assert.equal((await post(app, callback, STATUS)).status, 401);
    assert.equal((await post(app, callback, STATUS, ENV.TWILIO_STATUS_CALLBACK_URL)).status, 204);
    assert.equal((await post(app).set('X-Forwarded-Proto', 'http').set('Host', 'evil.test')).status, 200);
  });
  await withApp({ TWILIO_INBOUND_WEBHOOK_URL: ENV.TWILIO_INBOUND_WEBHOOK_URL + '?a=%2B&b=2' }, async app => {
    const url = ENV.TWILIO_INBOUND_WEBHOOK_URL + '?a=%2B&b=2';
    assert.equal((await post(app, FIELDS, PATH + '?a=%2B&b=2', url)).status, 200);
    assert.equal((await post(app, FIELDS, PATH + '?b=2&a=%2B', url)).status, 401);
    assert.equal((await post(app, FIELDS, PATH + '?a=%2b&b=2', url)).status, 401);
  });
});

test('Twilio forms: malformed encoding, duplicate decoded keys and pair limits reject safely', async () => {
  await withApp({}, async app => {
    for (const body of ['Body=%', 'Body=%FF', 'Body=%C0%AF', 'Body=a&%42ody=b', '=value', 'missingEquals', 'Body=a&',
      Array.from({ length: 101 }, (_, i) => `f${i}=v`).join('&')]) {
      const res = await request(app).post(PATH).type('form').send(body);
      assert.equal(res.status, 400, body.slice(0, 50));
      assert.equal(res.body.error.message, 'Bad Request: invalid webhook form.');
    }
    for (const contentType of ['application/json', 'text/plain', 'application/x-www-form-urlencoded; charset=iso-8859-1']) {
      assert.equal((await request(app).post(PATH).set('Content-Type', contentType).send('Body=x')).status, 415);
    }
    assert.equal((await post(app).set('Content-Encoding', 'gzip')).status, 415);
    assert.equal((await post(app).set('Content-Type', 'application/x-www-form-urlencoded; charset="UTF-8"')).status, 200);
  });
  await withApp({ WEBHOOK_BODY_LIMIT: '1kb' }, async app => {
    assert.equal((await post(app, { ...FIELDS, Body: 'x'.repeat(2048) })).status, 413);
  });
});

test('Twilio raw HTTP: invalid UTF-8 and duplicate signature headers fail closed', async () => {
  await withApp({}, async app => {
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const raw = (body, signatures) => new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port: server.address().port, path: PATH, method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length,
          'X-Twilio-Signature': signatures } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      req.on('error', reject); req.end(body);
    });
    try {
      assert.equal(await raw(Buffer.from([66, 111, 100, 121, 61, 255]), sign(FIELDS)), 400);
      assert.equal(await raw(Buffer.from(new URLSearchParams(FIELDS).toString()), [sign(FIELDS), sign(FIELDS)]), 401);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
});

test('Twilio events: authenticated invalid identities fail; media and empty text produce no fetch or send', async () => {
  const fetch = global.fetch;
  let fetches = 0;
  global.fetch = async () => { fetches++; throw new Error('Unexpected fetch'); };
  try {
    await withApp({}, async app => {
      for (const change of [{ AccountSid: 'AC' + '9'.repeat(32) }, { To: FIELDS.From }, { MessageSid: 'invalid' },
        { From: '+15005550007' }, { NumMedia: '-1' }, { NumMedia: '101' }]) {
        assert.equal((await post(app, { ...FIELDS, ...change })).status, 400);
      }
      for (const change of [{ Body: '' }, { NumMedia: '1', MediaUrl0: 'https://example.test/PRIVATE_MEDIA' }]) {
        const res = await post(app, { ...FIELDS, ...change });
        assert.equal(res.status, 200); assert.equal(res.text, '<Response></Response>');
      }
      assert.equal(fetches, 0);
    });
  } finally { global.fetch = fetch; }
});

test('Twilio callbacks: repeated and out-of-order events acknowledge; private fields never reach logs or responses', async () => {
  const saved = { log: console.log, warn: console.warn, error: console.error };
  let output = '';
  const capture = (...args) => { output += args.join(' ') + '\n'; };
  console.log = capture; console.warn = capture; console.error = capture;
  const original = handoff.handleInboundBatch;
  try {
    await withApp({}, async app => {
      const fields = { AccountSid: FIELDS.AccountSid, MessageSid: FIELDS.MessageSid,
        From: FIELDS.To, To: FIELDS.From, ErrorCode: '63000', ErrorMessage: 'PRIVATE_PROVIDER_ERROR' };
      for (const MessageStatus of ['delivered', 'sent', 'sent', 'PRIVATE_UNKNOWN_STATUS']) {
        const res = await post(app, { ...fields, MessageStatus }, STATUS, ENV.TWILIO_STATUS_CALLBACK_URL);
        assert.equal(res.status, 204); assert.equal(res.text, '');
      }
      assert.equal((await post(app, { ...fields, MessageStatus: 'sent', To: FIELDS.To }, STATUS, ENV.TWILIO_STATUS_CALLBACK_URL)).status, 400);
      assert.equal((await post(app)).status, 200);
      handoff.handleInboundBatch = async () => { throw new Error('PRIVATE_STACK ' + TOKEN + FIELDS.Body); };
      const res = await post(app);
      assert.equal(res.status, 500); assert.deepEqual(res.body, { error: { message: 'Internal Server Error', code: 500 } });
      output += JSON.stringify(res.body);
    });
  } finally { Object.assign(console, saved); handoff.handleInboundBatch = original; }
  assert.ok(output.includes('unknown'));
  for (const privateValue of [TOKEN, FIELDS.Body, '15005550007', '15005550006', 'PRIVATE_PROVIDER_ERROR', 'PRIVATE_UNKNOWN_STATUS', 'PRIVATE_STACK']) {
    assert.ok(!output.includes(privateValue), privateValue);
  }
});

test('Twilio isolation: inactive providers return fixed 404 and unsupported methods return 405', async () => {
  for (const provider of ['meta', 'mock']) {
    await withApp({ WHATSAPP_PROVIDER: provider }, async app => {
      for (const path of [PATH, STATUS]) {
        const res = await post(app, FIELDS, path + '?private=PRIVATE_QUERY');
        assert.equal(res.status, 404); assert.deepEqual(res.body, { error: { code: 404, message: 'Not Found' } });
      }
      const res = await request(app).get('/api/v1/webhook/whatsapp').query({ 'hub.mode': 'subscribe',
        'hub.verify_token': TEST_ENV.WHATSAPP_VERIFY_TOKEN, 'hub.challenge': 'challenge' });
      assert.equal(res.status, 200);
    });
  }
  await withApp({}, async app => {
    assert.equal((await request(app).post('/api/v1/webhook/whatsapp').send({})).status, 404);
    for (const method of ['get', 'put', 'patch', 'delete', 'options', 'head']) {
      const res = await request(app)[method](PATH + '?private=PRIVATE_QUERY');
      assert.equal(res.status, 405); assert.equal(res.headers.allow, 'POST');
      assert.ok(!res.text?.includes('PRIVATE_QUERY'));
    }
    const res = await request(app).get('/api/v1/webhook/twilio/PRIVATE_PATH');
    assert.equal(res.status, 404); assert.ok(!res.text.includes('PRIVATE_PATH'));
  });
});

test('Twilio rate limits apply to the real routes before body authentication', async () => {
  await withApp({ WEBHOOK_RATE_LIMIT_MAX: '1' }, async app => {
    assert.equal((await post(app)).status, 200);
    const callback = { AccountSid: FIELDS.AccountSid, MessageSid: FIELDS.MessageSid, MessageStatus: 'sent' };
    assert.equal((await post(app, callback, STATUS, ENV.TWILIO_STATUS_CALLBACK_URL)).status, 429);
  });
});
