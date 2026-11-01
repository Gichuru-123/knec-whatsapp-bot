'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { prepareDatabase } = require('../helpers/postgres');
const { DeliveryStore } = require('../../src/repository/deliveryStore');
const { DeliveryService } = require('../../src/services/messaging/deliveryService');
const { DeliveryWorker } = require('../../src/services/messaging/deliveryWorker');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);

test('durable service and worker preserve interrupted-send uncertainty across reconstruction', async () => {
  const fixture = await prepareDatabase();
  try {
    const store = new DeliveryStore(fixture.pool);
    const accountSid = 'AC' + '3'.repeat(32);
    const runId = randomUUID();
    const options = { store, adapter: { normalizeInboundPayload: () => [{}] }, accountSid,
      sender: 'whatsapp:+14155238886', participant: 'whatsapp:+254700000003', secret: Buffer.alloc(32, 8), version: 1, runId, maxAttempts: 2 };
    const service = new DeliveryService(options);
    await service.initialize();
    const body = { From: options.participant, MessageSid: 'SM' + '4'.repeat(32) };
    await service.inbound(body);
    const claim = await store.claim(runId, randomUUID());
    assert.ok(claim);
    await fixture.pool.query("UPDATE delivery.runs SET lease_until=clock_timestamp()-interval '1 minute',last_dispatch_at=NULL WHERE id=$1", [runId]);
    const reconstructed = new DeliveryService(options);
    await reconstructed.initialize();
    assert.equal((await reconstructed.inbound(body)).duplicate, true);
    let sends = 0;
    const worker = new DeliveryWorker({ store, runId, participant: options.participant, send: async () => { sends++; } });
    await worker.tick();
    assert.equal(sends, 0);
    const result = await fixture.pool.query('SELECT state FROM delivery.jobs');
    assert.equal(result.rows[0].state, 'uncertain');
    assert.equal(await store.owns(claim), false);
    // Independent processes compete against the same shared database, rather
    // than relying only on asynchronous calls through one pool.
    await service.inbound({ ...body, MessageSid: 'SM' + '5'.repeat(32) });
    const source = `const {createPool,DeliveryStore}=require('./src/repository/deliveryStore');
      (async()=>{const s=new DeliveryStore(createPool(process.env.TEST_DATABASE_URL));
      try{const c=await s.claim(process.env.FIXTURE_RUN,require('crypto').randomUUID());console.log(JSON.stringify(Boolean(c)));}
      finally{await s.close();}})().catch(()=>process.exitCode=1);`;
    const results = await Promise.all([1, 2].map(() => execFile(process.execPath, ['-e', source], {
      cwd: require('node:path').resolve(__dirname, '../..'),
      env: { ...process.env, FIXTURE_RUN: runId }, timeout: 15000
    })));
    assert.equal(results.filter(result => JSON.parse(result.stdout)).length, 1);
  } finally { await fixture.close(); }
});

test('signed webhook acknowledges one committed job and status persists before response', async () => {
  const fixture = await prepareDatabase();
  const previous = { ...process.env };
  try {
    Object.assign(process.env, { WHATSAPP_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC' + '6'.repeat(32),
      TWILIO_AUTH_TOKEN: 'synthetic-fixture-not-a-secret', TWILIO_WHATSAPP_FROM: 'whatsapp:+14155238886',
      TWILIO_TEST_RECIPIENT: 'whatsapp:+254700000006',
      TWILIO_INBOUND_WEBHOOK_URL: 'https://example.invalid/api/v1/webhook/twilio/whatsapp',
      TWILIO_STATUS_CALLBACK_URL: 'https://example.invalid/api/v1/webhook/twilio/status' });
    const app = require('../../src/app');
    const Adapter = require('../../src/services/messaging/twilioAdapter');
    const config = require('../../src/config');
    const request = require('supertest');
    const twilio = require('twilio');
    const service = new DeliveryService({ store: new DeliveryStore(fixture.pool), adapter: new Adapter(),
      accountSid: config.twilio.accountSid, sender: config.twilio.from, participant: config.twilio.recipient,
      secret: Buffer.alloc(32, 9), version: 1, runId: randomUUID(), maxAttempts: 1 });
    await service.initialize();
    app.locals.deliveryService = service;
    const fields = { AccountSid: config.twilio.accountSid, From: config.twilio.recipient, To: config.twilio.from,
      MessageSid: 'SM' + '6'.repeat(32), NumMedia: '0', Body: 'synthetic private text' };
    for (let i = 0; i < 2; i++) await request(app).post('/api/v1/webhook/twilio/whatsapp').type('form')
      .set('X-Twilio-Signature', twilio.getExpectedTwilioSignature(config.twilio.authToken, config.twilio.inbound.url, fields))
      .send(fields).expect(200);
    const jobs = await fixture.pool.query('SELECT count(*)::integer AS count FROM delivery.jobs');
    assert.equal(jobs.rows[0].count, 1);
    await fixture.pool.query('UPDATE delivery.runs SET receipt_count=1000');
    const rejected = { ...fields, MessageSid: 'SM' + '8'.repeat(32) };
    await request(app).post('/api/v1/webhook/twilio/whatsapp').type('form')
      .set('X-Twilio-Signature', twilio.getExpectedTwilioSignature(config.twilio.authToken, config.twilio.inbound.url, rejected))
      .send(rejected).expect(503);
    assert.equal((await fixture.pool.query('SELECT count(*)::integer AS count FROM delivery.jobs')).rows[0].count, 1);
    const callback = { AccountSid: config.twilio.accountSid, MessageSid: 'SM' + '7'.repeat(32), MessageStatus: 'delivered' };
    await request(app).post('/api/v1/webhook/twilio/status').type('form')
      .set('X-Twilio-Signature', twilio.getExpectedTwilioSignature(config.twilio.authToken, config.twilio.status.url, callback))
      .send(callback).expect(204);
    assert.equal((await fixture.pool.query('SELECT count(*)::integer AS count FROM delivery.callbacks')).rows[0].count, 1);
    delete app.locals.deliveryService;
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
    await fixture.close();
  }
});
