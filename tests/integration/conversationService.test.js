'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareDatabase } = require('../helpers/postgres');
const { ConversationSessionStore } = require('../../src/repository/conversationSessionStore');
const { ConversationService } = require('../../src/services/conversation/conversationService');
const ACCOUNT = 'AC' + '5'.repeat(32);

test('conversation service persists navigation across service reconstruction', async () => {
  const fixture = await prepareDatabase();
  try {
    const id = 'v1:' + 'c'.repeat(64);
    const store = new ConversationSessionStore(fixture.pool, { ttlSeconds: 3600 });
    const first = await new ConversationService({ store }).process({ conversationId: id, eventId: '1'.repeat(64), accountSid: ACCOUNT, input: '1' });
    assert.equal(first.response.menu.nodeId, 'registration');
    const duplicate = await new ConversationService({ store }).process({ conversationId: id, eventId: '1'.repeat(64), accountSid: ACCOUNT, input: '6' });
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.response.menu.nodeId, 'registration');
    const second = await new ConversationService({ store }).process({ conversationId: id, eventId: '2'.repeat(64), accountSid: ACCOUNT, input: '6' });
    assert.equal(second.response.menu.nodeId, 'registration.business-technical');
    assert.equal(second.session.revision, 2);
    assert.equal((await store.read(id)).state.currentNodeId, 'registration.business-technical');
    const jobs = await fixture.pool.query('SELECT body,state FROM conversation.outbox ORDER BY created_at');
    assert.equal(jobs.rows.length, 2);
    assert.equal(jobs.rows[0].state, 'pending');
    assert.match(jobs.rows[0].body, /Registration/);
  } finally { await fixture.close(); }
});

test('concurrent delivery of one event produces one transition and one stored response', async () => {
  const fixture = await prepareDatabase();
  try {
    const id = 'v1:' + 'e'.repeat(64);
    const eventId = 'f'.repeat(64);
    const store = new ConversationSessionStore(fixture.pool, { ttlSeconds: 3600 });
    const service = new ConversationService({ store });
    const results = await Promise.all([
      service.process({ conversationId: id, eventId, accountSid: ACCOUNT, input: '1' }),
      service.process({ conversationId: id, eventId, accountSid: ACCOUNT, input: '2' })
    ]);
    assert.equal(results.filter(result => result.duplicate).length, 1);
    assert.deepEqual(results[0].response, results[1].response);
    assert.equal((await store.read(id)).revision, 1);
    assert.equal((await fixture.pool.query('SELECT count(*)::integer AS count FROM conversation.events')).rows[0].count, 1);
    assert.equal((await fixture.pool.query('SELECT count(*)::integer AS count FROM conversation.outbox')).rows[0].count, 1);
  } finally { await fixture.close(); }
});

test('invalid rendered output rolls back session, event and outbox together', async () => {
  const fixture = await prepareDatabase();
  try {
    const store = new ConversationSessionStore(fixture.pool, { ttlSeconds: 3600 });
    const service = new ConversationService({ store, renderer: () => 'x'.repeat(1601) });
    await assert.rejects(service.process({ conversationId: 'v1:' + '3'.repeat(64),
      eventId: '4'.repeat(64), accountSid: ACCOUNT, input: '1' }), /DATABASE_OPERATION_FAILED/);
    for (const table of ['sessions', 'events', 'outbox']) {
      const count = await fixture.pool.query(`SELECT count(*)::integer AS count FROM conversation.${table}`);
      assert.equal(count.rows[0].count, 0);
    }
  } finally { await fixture.close(); }
});
