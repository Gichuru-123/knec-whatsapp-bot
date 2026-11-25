'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareDatabase } = require('../helpers/postgres');
const { ConversationSessionStore } = require('../../src/repository/conversationSessionStore');
const { ConversationService } = require('../../src/services/conversation/conversationService');
const ACCOUNT = 'AC' + '5'.repeat(32);

function syntheticKnowledge() {
  return {
    getApprovedRequirements(id) {
      return id === 'reg-kcse' ? { articleId: id, language: 'en', fields: [
        { field: 'examination', question: 'Which examination?', allowedValues: ['KCSE'] },
        { field: 'year', question: 'Which year?', allowedValues: ['2026'] },
        { field: 'audience', question: 'Which user type?', allowedValues: ['candidate'] }
      ] } : null;
    },
    getApprovedAnswer(id, context) {
      if (id !== 'reg-kcse' || context.examination !== 'KCSE' || context.year !== '2026' ||
          context.audience !== 'candidate') return null;
      return { id, title: 'Synthetic guidance', claims: [{ text: 'Synthetic answer.', citations: [{
        title: 'Synthetic source', locator: 'Test section', url: 'https://www.knec.ac.ke/synthetic-test'
      }] }] };
    }
  };
}

test('conversation service persists navigation across service reconstruction', async () => {
  const fixture = await prepareDatabase();
  try {
    const id = 'v1:' + 'c'.repeat(64);
    const store = new ConversationSessionStore(fixture.pool, { ttlSeconds: 3600 });
    await new ConversationService({ store }).process({ conversationId: id, eventId: '0'.repeat(64), accountSid: ACCOUNT, input: 'anything' });
    const first = await new ConversationService({ store }).process({ conversationId: id, eventId: '1'.repeat(64), accountSid: ACCOUNT, input: '1' });
    assert.equal(first.response.menu.nodeId, 'registration');
    const duplicate = await new ConversationService({ store }).process({ conversationId: id, eventId: '1'.repeat(64), accountSid: ACCOUNT, input: '6' });
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.response.menu.nodeId, 'registration');
    const second = await new ConversationService({ store }).process({ conversationId: id, eventId: '2'.repeat(64), accountSid: ACCOUNT, input: '6' });
    assert.equal(second.response.menu.nodeId, 'registration.business-technical');
    assert.equal(second.session.revision, 3);
    assert.equal((await store.read(id)).state.currentNodeId, 'registration.business-technical');
    const jobs = await fixture.pool.query('SELECT body,state FROM conversation.outbox ORDER BY created_at');
    assert.equal(jobs.rows.length, 3);
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

test('knowledge clarification survives reconstruction and duplicate events remain idempotent', async () => {
  const fixture = await prepareDatabase();
  try {
    const id = 'v1:' + '7'.repeat(64);
    const store = new ConversationSessionStore(fixture.pool, { ttlSeconds: 3600 });
    let service = new ConversationService({ store, knowledge: syntheticKnowledge() });
    await service.process({ conversationId: id, eventId: '7'.repeat(64), accountSid: ACCOUNT, input: 'anything' });
    await service.process({ conversationId: id, eventId: '8'.repeat(64), accountSid: ACCOUNT, input: '1' });
    const selected = await service.process({ conversationId: id, eventId: '9'.repeat(64), accountSid: ACCOUNT, input: '1' });
    assert.equal(selected.response.type, 'knowledge_clarification');
    assert.equal((await store.read(id)).state.workflow.pendingField, 'examination');

    service = new ConversationService({ store, knowledge: syntheticKnowledge() });
    const answered = await service.process({ conversationId: id, eventId: 'a'.repeat(64), accountSid: ACCOUNT, input: 'KCSE' });
    assert.equal(answered.response.type, 'knowledge_clarification');
    assert.equal((await store.read(id)).state.workflow.pendingField, 'year');
    const duplicate = await service.process({ conversationId: id, eventId: 'a'.repeat(64), accountSid: ACCOUNT, input: '2026' });
    assert.equal(duplicate.duplicate, true);
    assert.equal((await store.read(id)).state.workflow.pendingField, 'year');
    assert.equal((await fixture.pool.query('SELECT count(*)::integer AS count FROM conversation.outbox')).rows[0].count, 4);
  } finally { await fixture.close(); }
});
