'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareDatabase } = require('../helpers/postgres');
const { ConversationSessionStore } = require('../../src/repository/conversationSessionStore');
const { createInitialState, handleInput } = require('../../src/services/conversation/navigation');

test('sessions survive reconstruction, reject stale writes and restart after expiry', async () => {
  const fixture = await prepareDatabase();
  try {
    const id = 'v1:' + 'a'.repeat(64);
    const store = new ConversationSessionStore(fixture.pool, { ttlSeconds: 3600 });
    assert.equal(await store.read(id), null);
    assert.deepEqual(await store.save(id, { ...createInitialState(), privateText: 'discard' }, 0), { revision: 1 });
    const restored = await new ConversationSessionStore(fixture.pool, { ttlSeconds: 3600 }).read(id);
    assert.equal(restored.state.privateText, undefined);
    const next = handleInput('1', restored.state).state;
    const writes = await Promise.all([store.save(id, next, 1), store.save(id, next, 1)]);
    assert.equal(writes.filter(Boolean).length, 1);
    await fixture.pool.query("UPDATE conversation.sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE conversation_id=$1", [id]);
    const expired = await store.read(id);
    assert.equal(expired.expired, true);
    assert.equal(expired.state, null);
    assert.equal(await store.save(id, next, expired.revision), null);
    assert.deepEqual(await store.save(id, createInitialState(), expired.revision, { resetExpired: true }), { revision: 3 });
    assert.equal(await store.save(id, next, 1), null);
    assert.equal((await store.read(id)).state.currentNodeId, 'root');
    await fixture.pool.query("UPDATE conversation.sessions SET expires_at=clock_timestamp()-interval '8 days' WHERE conversation_id=$1", [id]);
    assert.equal(await store.cleanupExpired({ retentionSeconds: 604800 }), 1);
    assert.equal(await store.read(id), null);
  } finally { await fixture.close(); }
});

test('session cleanup preserves unresolved delivery evidence', async () => {
  const fixture = await prepareDatabase();
  try {
    const id = 'v1:' + 'b'.repeat(64);
    const eventId = 'c'.repeat(64);
    const accountSid = 'AC' + 'd'.repeat(32);
    const store = new ConversationSessionStore(fixture.pool, { ttlSeconds: 3600 });
    await store.applyEvent(id, eventId, accountSid, async () => ({
      state: createInitialState(),
      response: { kind: 'menu' },
      outboundBody: 'Menu'
    }));
    await fixture.pool.query("UPDATE conversation.sessions SET expires_at=clock_timestamp()-interval '8 days' WHERE conversation_id=$1", [id]);

    assert.equal(await store.cleanupExpired({ retentionSeconds: 604800 }), 0);
    assert.equal((await fixture.pool.query('SELECT state FROM conversation.outbox WHERE conversation_id=$1', [id])).rows[0].state, 'pending');

    await fixture.pool.query("UPDATE conversation.outbox SET state='failed',outcome='failed' WHERE conversation_id=$1", [id]);
    assert.equal(await store.cleanupExpired({ retentionSeconds: 604800 }), 1);
    assert.equal((await fixture.pool.query('SELECT count(*)::integer AS count FROM conversation.outbox WHERE conversation_id=$1', [id])).rows[0].count, 0);
  } finally { await fixture.close(); }
});
