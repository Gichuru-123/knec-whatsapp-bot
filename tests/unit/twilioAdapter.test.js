'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { validateConfig } = require('../../src/config');
const config = require('../../src/config');
const TEST_ENV = require('../helpers/testEnv');
const Adapter = require('../../src/services/messaging/twilioAdapter');
const Factory = require('../../src/services/messaging/adapterFactory');

const env = {
  ...TEST_ENV, WHATSAPP_PROVIDER: 'twilio', ENABLE_DEV_INSPECTION_ROUTES: 'false',
  TWILIO_ACCOUNT_SID: 'AC' + '1'.repeat(32), TWILIO_AUTH_TOKEN: 'test-fixture-twilio-not-a-secret',
  TWILIO_WHATSAPP_FROM: 'whatsapp:+15005550006', TWILIO_TEST_RECIPIENT: 'whatsapp:+15005550007',
  TWILIO_INBOUND_WEBHOOK_URL: 'https://example.test/api/v1/webhook/twilio/whatsapp',
  TWILIO_STATUS_CALLBACK_URL: 'https://example.test/api/v1/webhook/twilio/status', TWILIO_REQUEST_TIMEOUT_MS: '100'
};
const settings = validateConfig(env);
const SID = 'SM' + '2'.repeat(32);
const fields = overrides => ({ AccountSid: env.TWILIO_ACCOUNT_SID, MessageSid: SID, From: env.TWILIO_TEST_RECIPIENT,
  To: env.TWILIO_WHATSAPP_FROM, Body: ' Hello + 世界 ', NumMedia: '0', ...overrides });

// Independent reference calculation for scalar forms; production uses the official SDK.
function signature(url, params, token = env.TWILIO_AUTH_TOKEN) {
  const material = Object.keys(params).sort().reduce((result, key) => result + key + params[key], url);
  return crypto.createHmac('sha1', token).update(material, 'utf8').digest('base64');
}
function request(params, url = settings.twilio.inbound.url) {
  const signed = signature(url, params);
  return { method: 'POST', originalUrl: settings.twilio.inbound.target, body: params,
    headers: { 'x-twilio-signature': signed }, rawHeaders: ['X-Twilio-Signature', signed] };
}
function transport(reply = { statusCode: 201, body: JSON.stringify({ sid: SID, status: 'queued' }) }) {
  const calls = [];
  return { calls, request: async options => { calls.push(options); return reply; } };
}

test('Twilio factory is explicit; default adapter blocks sending and non-test construction', async () => {
  const saved = { ...config };
  try {
    for (const provider of ['meta', 'mock']) {
      config.whatsappProvider = provider;
      assert.equal(Factory.getAdapter().constructor.name, provider === 'meta' ? 'MetaWhatsAppAdapter' : 'MockWhatsAppAdapter');
    }
    config.whatsappProvider = 'unknown';
    assert.throws(() => Factory.getAdapter(), /Unsupported messaging provider/);
    Object.assign(config, settings);
    const adapter = Factory.getAdapter();
    assert.ok(adapter instanceof Adapter);
    assert.deepEqual(adapter.verifyWebhook(), { isValid: false, challenge: null });
    await assert.rejects(adapter.sendTextMessage(env.TWILIO_TEST_RECIPIENT, 'Hello'), { code: 'TWILIO_SEND_DISABLED' });
    assert.throws(() => new Adapter({ settings: { ...settings, nodeEnv: 'production' } }), { code: 'TWILIO_OFFLINE_ONLY' });
    assert.throws(() => new Adapter({ settings, httpClient: {} }), { code: 'TWILIO_INVALID_TEST_TRANSPORT' });
  } finally { Object.assign(config, saved); }
});

test('Twilio independent signed forms include Unicode, plus, whitespace, unknown and prototype-like fields', () => {
  const adapter = new Adapter({ settings });
  const body = Object.assign(Object.create(null), fields(), { FutureField: 'new field' });
  body.__proto__ = 'signed scalar';
  assert.equal(adapter.validateSignature(request(body)), true);
  const changed = request(body);
  changed.body = { ...body, Body: 'changed' };
  assert.equal(adapter.validateSignature(changed), false);
  assert.equal({}.polluted, undefined);
});

test('Twilio rejects invalid signature/header/account URL combinations without trusting headers', () => {
  const adapter = new Adapter({ settings });
  for (const value of [undefined, '', 'bad', 'a'.repeat(100), ['duplicate']]) {
    const req = request(fields()); req.headers['x-twilio-signature'] = value;
    assert.equal(adapter.validateSignature(req), false);
  }
  const duplicate = request(fields()); duplicate.rawHeaders.push(...duplicate.rawHeaders);
  assert.equal(adapter.validateSignature(duplicate), false);
  for (const url of [settings.twilio.inbound.url.replace('https:', 'http:'), settings.twilio.inbound.url.replace('example.test', 'evil.test')]) {
    const req = request(fields(), url);
    Object.assign(req.headers, { host: 'evil.test', 'x-forwarded-host': 'evil.test', 'x-forwarded-proto': 'http' });
    assert.equal(adapter.validateSignature(req), false);
  }
  const valid = request(fields()); valid.headers.host = 'ignored-host.test';
  assert.equal(adapter.validateSignature(valid), true);
  for (const target of [settings.twilio.inbound.target + '/', settings.twilio.inbound.target + '?x=1', '/wrong']) {
    assert.equal(adapter.validateSignature({ ...request(fields()), originalUrl: target }), false);
  }
  const wrongToken = request(fields()); wrongToken.headers['x-twilio-signature'] = signature(settings.twilio.inbound.url, fields(), 'wrong');
  assert.equal(adapter.validateSignature(wrongToken), false);
  assert.equal(adapter.validateSignature({ ...request(fields()), method: 'GET' }), false);
});

test('Twilio SDK 6.2.0 port and encoding compatibility is characterised while raw target stays strict', () => {
  const adapter = new Adapter({ settings });
  assert.equal(adapter.validateSignature(request(fields(), settings.twilio.inbound.url.replace('example.test', 'example.test:443'))), true);
  const url = settings.twilio.inbound.url + "?note='hello'";
  const custom = validateConfig({ ...env, TWILIO_INBOUND_WEBHOOK_URL: url });
  const req = request(fields(), new URL(url).toString());
  req.originalUrl = custom.twilio.inbound.target;
  const other = new Adapter({ settings: custom });
  assert.equal(other.validateSignature(req), true);
  req.originalUrl = new URL(url).pathname + new URL(url).search;
  assert.equal(other.validateSignature(req), false);
});

test('Twilio normalizes text with receipt seconds and discards media, empty content and extra data', () => {
  const adapter = new Adapter({ settings, now: () => 1700000000123 });
  assert.deepEqual(adapter.normalizeInboundPayload(fields({ ProfileName: 'PRIVATE_PROFILE' })), [{ messageId: SID, senderPhone: '15005550007',
    timestamp: 1700000000, type: 'text', textBody: ' Hello + 世界 ', rawProvider: 'twilio' }]);
  assert.deepEqual(adapter.normalizeInboundPayload(fields({ Body: '' })), []);
  assert.deepEqual(adapter.normalizeInboundPayload(fields({ NumMedia: '1', MediaUrl0: 'https://never-contact.example.test/file' })), []);
  for (const overrides of [{ AccountSid: 'wrong' }, { MessageSid: 'wrong' }, { To: env.TWILIO_TEST_RECIPIENT }, { From: '+123' },
    { NumMedia: '-1' }, { NumMedia: '101' }, { NumMedia: '1x' }, { NumMedia: '9007199254740992' }, { Body: undefined }]) {
    assert.throws(() => adapter.normalizeInboundPayload(fields(overrides)), { code: 'TWILIO_INVALID_EVENT', statusCode: 400 });
  }
});

test('Twilio callback identity is direction-aware, unknown labels are discarded, errors are numeric', () => {
  const adapter = new Adapter({ settings, now: () => 1700000000123 });
  const callback = { AccountSid: env.TWILIO_ACCOUNT_SID, MessageSid: SID, From: env.TWILIO_WHATSAPP_FROM, To: env.TWILIO_TEST_RECIPIENT, MessageStatus: 'delivered' };
  assert.deepEqual(adapter.normalizeStatusCallback(callback), { messageId: SID, status: 'delivered', timestamp: 1700000000 });
  assert.equal(adapter.normalizeStatusCallback({ ...callback, MessageStatus: 'PRIVATE_UNKNOWN_STATUS' }).status, 'unknown');
  assert.equal(adapter.normalizeStatusCallback({ ...callback, ErrorCode: '63016' }).errorCode, 63016);
  for (const overrides of [{ To: env.TWILIO_WHATSAPP_FROM }, { From: env.TWILIO_TEST_RECIPIENT }, { AccountSid: 'wrong' },
    { MessageStatus: ' ' }, { MessageStatus: 'x'.repeat(65) }, { ErrorCode: '-1' }, { ErrorCode: '9007199254740992' }, { ErrorCode: 'oops' }]) {
    assert.throws(() => adapter.normalizeStatusCallback({ ...callback, ...overrides }), { code: 'TWILIO_INVALID_EVENT' });
  }
});

test('Twilio fake SDK transport receives only the approved outbound request and returns a minimal result', async () => {
  const fake = transport();
  const adapter = new Adapter({ settings, httpClient: fake });
  assert.deepEqual(await adapter.sendTextMessage(env.TWILIO_TEST_RECIPIENT, 'Synthetic reply'), { messageId: SID, status: 'queued' });
  assert.equal(fake.calls.length, 1);
  const sent = fake.calls[0];
  assert.equal(sent.method.toLowerCase(), 'post');
  assert.match(sent.uri, /^https:\/\/api\.twilio\.com\/2010-04-01\/Accounts\/AC[\da-f]{32}\/Messages.json$/);
  assert.deepEqual(sent.data, { To: env.TWILIO_TEST_RECIPIENT, From: env.TWILIO_WHATSAPP_FROM, Body: 'Synthetic reply', StatusCallback: env.TWILIO_STATUS_CALLBACK_URL });
  assert.equal(sent.logLevel, 'silent');
  for (const [to, text] of [['whatsapp:+15005550008', 'Hello'], [env.TWILIO_TEST_RECIPIENT, ''], [env.TWILIO_TEST_RECIPIENT, 'x'.repeat(1601)]]) {
    await assert.rejects(adapter.sendTextMessage(to, text), { code: 'TWILIO_INVALID_OUTBOUND' });
  }
  assert.equal(fake.calls.length, 1);
});

test('Twilio fake HTTP/JSON/transport failures are sanitized and are not retried', async () => {
  const privateData = 'PRIVATE_PROVIDER_DATA_' + env.TWILIO_AUTH_TOKEN;
  for (const statusCode of [400, 401, 429, 500]) {
    const fake = transport({ statusCode, body: JSON.stringify({ code: 20003, message: privateData, more_info: privateData }) });
    await assert.rejects(new Adapter({ settings, httpClient: fake }).sendTextMessage(env.TWILIO_TEST_RECIPIENT, 'Synthetic'), error => {
      assert.equal(error.code, 'TWILIO_HTTP_FAILURE'); assert.equal(error.providerStatus, statusCode);
      assert.equal(error.cause, undefined); assert.ok(!error.stack.includes(privateData)); return true;
    });
    assert.equal(fake.calls.length, 1);
  }
  for (const body of ['{PRIVATE_BAD_JSON', JSON.stringify({ sid: 'bad', status: 'queued' }), JSON.stringify({ sid: SID, status: 'PRIVATE_STATUS' })]) {
    const fake = transport({ statusCode: 201, body });
    await assert.rejects(new Adapter({ settings, httpClient: fake }).sendTextMessage(env.TWILIO_TEST_RECIPIENT, 'Synthetic'), error => {
      assert.equal(error.cause, undefined); assert.ok(!JSON.stringify(error).includes('PRIVATE')); assert.ok(!error.stack.includes('PRIVATE')); return true;
    });
    assert.equal(fake.calls.length, 1);
  }
  let calls = 0;
  const fake = { request: () => { calls++; throw Object.assign(new Error(privateData), { code: 'TWILIO_INVALID_RESPONSE' }); } };
  await assert.rejects(new Adapter({ settings, httpClient: fake }).sendTextMessage(env.TWILIO_TEST_RECIPIENT, 'Synthetic'), { code: 'TWILIO_TRANSPORT_FAILURE' });
  assert.equal(calls, 1);
});

test('Twilio fake transport deadline is bounded, reports unknown acceptance and never resends', async () => {
  let calls = 0;
  const fake = { request: () => { calls++; return new Promise(() => {}); } };
  const start = Date.now();
  await assert.rejects(new Adapter({ settings, httpClient: fake }).sendTextMessage(env.TWILIO_TEST_RECIPIENT, 'Synthetic'), { code: 'TWILIO_ACCEPTANCE_UNKNOWN' });
  assert.ok(Date.now() - start < 2000);
  assert.equal(calls, 1);
});
