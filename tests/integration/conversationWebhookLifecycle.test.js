'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const twilio = require('twilio');
const { prepareDatabase } = require('../helpers/postgres');
const { ConversationSessionStore } = require('../../src/repository/conversationSessionStore');
const { ConversationService } = require('../../src/services/conversation/conversationService');
const { ConversationResponseWorker } = require('../../src/services/conversation/responseWorker');
const { ConversationRuntime } = require('../../src/services/conversation/conversationRuntime');
const { databaseError } = require('../../src/repository/deliveryStore');

test('signed webhook commits one menu response, fake-sends once and reconciles callback', async () => {
  const fixture = await prepareDatabase();
  const previous = { ...process.env };
  const modules = ['../../src/config', '../../src/app', '../../src/services/messaging/adapterFactory',
    '../../src/middleware/twilioWebhookAuth'].map(require.resolve);
  const cached = modules.map(id => require.cache[id]);
  try {
    const accountSid = 'AC' + 'a'.repeat(32);
    const authToken = 'public-phase5-webhook-fixture';
    const from = 'whatsapp:+15005550006';
    const participant = 'whatsapp:+15005550007';
    const inboundUrl = 'https://example.test/api/v1/webhook/twilio/whatsapp';
    const statusUrl = 'https://example.test/api/v1/webhook/twilio/status';
    Object.assign(process.env, { NODE_ENV: 'test', WHATSAPP_PROVIDER: 'twilio', ENABLE_DEV_INSPECTION_ROUTES: 'false',
      WEBHOOK_RATE_LIMIT_MAX: '1000', TWILIO_MODE: 'offline', TWILIO_ACCOUNT_SID: accountSid,
      TWILIO_AUTH_TOKEN: authToken, TWILIO_WHATSAPP_FROM: from, TWILIO_TEST_RECIPIENT: participant,
      TWILIO_INBOUND_WEBHOOK_URL: inboundUrl, TWILIO_STATUS_CALLBACK_URL: statusUrl,
      TWILIO_LIVE_SEND_ENABLED: 'false' });
    modules.forEach(id => { delete require.cache[id]; });
    const app = require('../../src/app');
    const config = require('../../src/config');
    const store = new ConversationSessionStore(fixture.pool, { ttlSeconds: 3600 });
    const service = new ConversationService({ store });
    const sends = [];
    const worker = new ConversationResponseWorker({ store, participant,
      async send(to, body) { sends.push([to, body]); return { messageId: 'SM' + 'b'.repeat(32), status: 'queued' }; } });
    app.locals.conversationRuntime = new ConversationRuntime({ service, store, worker, accountSid,
      sender: from, participant, secret: Buffer.alloc(32, 6), version: 1 });
    const fields = { AccountSid: accountSid, From: participant, To: from,
      MessageSid: 'SM' + 'c'.repeat(32), NumMedia: '0', Body: 'main menu' };
    const inboundSignature = twilio.getExpectedTwilioSignature(authToken, inboundUrl, fields);
    for (let i = 0; i < 2; i += 1) {
      await request(app).post(config.twilio.inbound.target).type('form')
        .set('X-Twilio-Signature', inboundSignature).send(fields).expect(200, '<Response></Response>');
    }
    assert.equal((await fixture.pool.query('SELECT count(*)::integer AS count FROM conversation.events')).rows[0].count, 1);
    assert.equal((await fixture.pool.query('SELECT count(*)::integer AS count FROM conversation.outbox')).rows[0].count, 1);
    const media = { ...fields, MessageSid: 'MM' + 'd'.repeat(32), NumMedia: '1' };
    await request(app).post(config.twilio.inbound.target).type('form')
      .set('X-Twilio-Signature', twilio.getExpectedTwilioSignature(authToken, inboundUrl, media)).send(media).expect(200);
    assert.equal((await fixture.pool.query('SELECT count(*)::integer AS count FROM conversation.events')).rows[0].count, 1);
    const applyEvent = store.applyEvent.bind(store);
    store.applyEvent = async () => { throw databaseError(); };
    const failed = { ...fields, MessageSid: 'SM' + 'e'.repeat(32), Body: '1' };
    await request(app).post(config.twilio.inbound.target).type('form')
      .set('X-Twilio-Signature', twilio.getExpectedTwilioSignature(authToken, inboundUrl, failed)).send(failed).expect(503);
    store.applyEvent = applyEvent;
    assert.equal((await fixture.pool.query('SELECT count(*)::integer AS count FROM conversation.outbox')).rows[0].count, 1);
    assert.equal(await app.locals.conversationRuntime.dispatchOne(), true);
    assert.equal(await app.locals.conversationRuntime.dispatchOne(), false);
    assert.equal(sends.length, 1);
    assert.match(sends[0][1], /KNEC DIGITAL ASSISTANT/);
    const callback = { AccountSid: accountSid, MessageSid: 'SM' + 'b'.repeat(32), MessageStatus: 'delivered' };
    await request(app).post(config.twilio.status.target).type('form')
      .set('X-Twilio-Signature', twilio.getExpectedTwilioSignature(authToken, statusUrl, callback))
      .send(callback).expect(204);
    const outbox = (await fixture.pool.query('SELECT state,provider_status FROM conversation.outbox')).rows[0];
    assert.deepEqual(outbox, { state: 'accepted', provider_status: 'delivered' });
    delete app.locals.conversationRuntime;
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
    modules.forEach((id, i) => { delete require.cache[id]; if (cached[i]) require.cache[id] = cached[i]; });
    await fixture.close();
  }
});
