'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareDatabase } = require('../helpers/postgres');
const { ConversationSessionStore } = require('../../src/repository/conversationSessionStore');
const { ConversationService } = require('../../src/services/conversation/conversationService');
const { ConversationResponseWorker } = require('../../src/services/conversation/responseWorker');
const ACCOUNT = 'AC' + '7'.repeat(32);

test('durable response worker sends one committed body and preserves provider acceptance', async () => {
  const fixture = await prepareDatabase();
  try {
    const store = new ConversationSessionStore(fixture.pool, { ttlSeconds: 3600 });
    await new ConversationService({ store }).process({ conversationId: 'v1:' + '7'.repeat(64),
      eventId: '8'.repeat(64), accountSid: ACCOUNT, input: 'main menu' });
    const sent = [];
    const worker = new ConversationResponseWorker({ store, participant: 'whatsapp:+254700000007',
      async send(to, body) { sent.push([to, body]); return { messageId: 'SM' + '9'.repeat(32), status: 'queued' }; } });
    const competitor = new ConversationResponseWorker({ store, participant: 'whatsapp:+254700000007',
      async send(to, body) { sent.push([to, body]); return { messageId: 'SM' + '9'.repeat(32), status: 'queued' }; } });
    const claims = await Promise.all([worker.tick(), competitor.tick()]);
    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal(await worker.tick(), false);
    assert.equal(sent.length, 1);
    assert.match(sent[0][1], /KNEC DIGITAL ASSISTANT/);
    const row = (await fixture.pool.query('SELECT state,provider_sid,provider_status,attempts FROM conversation.outbox')).rows[0];
    assert.deepEqual(row, { state: 'accepted', provider_sid: 'SM' + '9'.repeat(32), provider_status: 'queued', attempts: 1 });
  } finally { await fixture.close(); }
});

test('expired sending lease becomes uncertain and is never resent automatically', async () => {
  const fixture = await prepareDatabase();
  try {
    const store = new ConversationSessionStore(fixture.pool, { ttlSeconds: 3600 });
    await new ConversationService({ store }).process({ conversationId: 'v1:' + 'a'.repeat(64),
      eventId: 'b'.repeat(64), accountSid: ACCOUNT, input: '1' });
    const claim = await store.claimOutbox('11111111-1111-4111-8111-111111111111');
    assert.ok(claim);
    await fixture.pool.query("UPDATE conversation.outbox SET lease_until=clock_timestamp()-interval '1 second'");
    let sends = 0;
    const worker = new ConversationResponseWorker({ store, participant: 'whatsapp:+254700000007', async send() { sends += 1; } });
    assert.equal(await worker.tick(), false);
    assert.equal(sends, 0);
    assert.equal((await fixture.pool.query('SELECT state FROM conversation.outbox')).rows[0].state, 'uncertain');
  } finally { await fixture.close(); }
});

test('early and out-of-order callbacks reconcile without regressing delivery progress', async () => {
  const fixture = await prepareDatabase();
  try {
    const store = new ConversationSessionStore(fixture.pool, { ttlSeconds: 3600 });
    await new ConversationService({ store }).process({ conversationId: 'v1:' + 'c'.repeat(64),
      eventId: 'd'.repeat(64), accountSid: ACCOUNT, input: '1' });
    const claim = await store.claimOutbox('22222222-2222-4222-8222-222222222222');
    const sid = 'SM' + 'e'.repeat(32);
    await store.recordCallback({ accountSid: ACCOUNT, messageSid: sid, status: 'delivered' });
    await store.finishOutbox(claim, { kind: 'accepted', messageId: sid, status: 'queued' });
    await store.recordCallback({ accountSid: ACCOUNT, messageSid: sid, status: 'sent' });
    await store.recordCallback({ accountSid: ACCOUNT, messageSid: sid, status: 'failed', errorCode: 63000 });
    const row = (await fixture.pool.query('SELECT provider_status,review_required FROM conversation.outbox')).rows[0];
    assert.deepEqual(row, { provider_status: 'delivered', review_required: true });
    assert.equal((await fixture.pool.query('SELECT count(*)::integer AS count FROM conversation.callbacks')).rows[0].count, 3);
    await fixture.pool.query("UPDATE conversation.callbacks SET received_at=clock_timestamp()-interval '8 days'");
    assert.equal(await store.cleanupCallbacks({ retentionSeconds: 604800 }), 3);
  } finally { await fixture.close(); }
});
