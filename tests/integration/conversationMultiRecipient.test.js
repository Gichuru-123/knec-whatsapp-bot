'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareDatabase } = require('../helpers/postgres');
const { ConversationSessionStore } = require('../../src/repository/conversationSessionStore');
const { ConversationService } = require('../../src/services/conversation/conversationService');
const { ConversationResponseWorker } = require('../../src/services/conversation/responseWorker');
const { ConversationRuntime } = require('../../src/services/conversation/conversationRuntime');
const { createConversationIdentity } = require('../../src/services/messaging/conversationIdentity');

test('joined Sandbox participants retain isolated sessions and correctly routed replies', async () => {
  const fixture = await prepareDatabase();
  try {
    const accountSid = 'AC' + '7'.repeat(32);
    const sender = 'whatsapp:+15005550006';
    const participants = ['whatsapp:+254700000001', 'whatsapp:+254700000002', 'whatsapp:+254700000003'];
    const secret = Buffer.alloc(32, 7);
    const version = 1;
    const store = new ConversationSessionStore(fixture.pool, { ttlSeconds: 3600 });
    const service = new ConversationService({ store });
    const destinations = new Map();
    const sends = [];
    let sequence = 1;
    const worker = new ConversationResponseWorker({ store,
      recipientForConversation: conversationId => destinations.get(conversationId),
      async send(to, body) {
        sends.push({ to, body });
        return { kind: 'accepted', messageId: 'SM' + (sequence++).toString(16).padStart(32, '0'), status: 'queued' };
      } });
    const runtime = new ConversationRuntime({ service, store, worker, accountSid, sender,
      participants, recipientByConversation: destinations, openParticipants: true, secret, version });
    const adapter = { normalizeInboundPayload(body) { return [{ messageId: body.MessageSid, type: 'text', textBody: body.Body }]; } };
    const body = (participant, suffix, text) => ({ From: participant, To: sender,
      AccountSid: accountSid, MessageSid: 'SM' + suffix.repeat(32), Body: text });

    for (let i = 0; i < participants.length; i += 1) {
      await runtime.inbound(body(participants[i], String(i + 1), 'Hi'), adapter);
    }
    await runtime.inbound(body(participants[0], '4', '1'), adapter);
    await runtime.inbound(body(participants[1], '5', '2'), adapter);
    await runtime.inbound(body(participants[2], '6', '3'), adapter);

    const sessions = await fixture.pool.query('SELECT conversation_id,state FROM conversation.sessions ORDER BY conversation_id');
    assert.equal(sessions.rows.length, 3);
    const stateByParticipant = new Map(participants.map(participant => {
      const id = createConversationIdentity({ secret, version, accountSid, sender, participant });
      return [participant, sessions.rows.find(row => row.conversation_id === id).state.currentNodeId];
    }));
    assert.deepEqual(Object.fromEntries(stateByParticipant), {
      [participants[0]]: 'registration', [participants[1]]: 'certificates', [participants[2]]: 'verification'
    });

    const duplicate = await runtime.inbound(body(participants[0], '1', 'Hi'), adapter);
    assert.equal(duplicate.duplicate, true);
    const additional = 'whatsapp:+254700000004';
    await runtime.inbound(body(additional, '7', 'Hi'), adapter);
    assert.equal((await fixture.pool.query('SELECT count(*)::integer count FROM conversation.outbox')).rows[0].count, 7);

    while (await runtime.dispatchOne()) { /* drain one-attempt outbox */ }
    assert.equal(sends.length, 7);
    for (const participant of participants) {
      assert.equal(sends.filter(item => item.to === participant).length, 2);
    }
    assert.equal(sends.filter(item => item.to === additional).length, 1);
    assert.match(sends[0].body, /Welcome! I'm NURU/);
  } finally {
    await fixture.close();
  }
});

test('Sandbox allows 50 responses per participant, blocks the 51st and does not count duplicates twice', async () => {
  const fixture = await prepareDatabase();
  try {
    const accountSid = 'AC' + '8'.repeat(32);
    const sender = 'whatsapp:+15005550006';
    const participants = ['whatsapp:+254700000001', 'whatsapp:+254700000002', 'whatsapp:+254700000003'];
    const secret = Buffer.alloc(32, 8);
    const version = 1;
    const store = new ConversationSessionStore(fixture.pool, { ttlSeconds: 3600 });
    const service = new ConversationService({ store });
    const destinations = new Map();
    const sends = [];
    let sequence = 1;
    const worker = new ConversationResponseWorker({ store, messagesPerParticipant: 50,
      recipientForConversation: id => destinations.get(id),
      async send(to) {
        sends.push(to);
        return { kind: 'accepted', messageId: 'SM' + (sequence++).toString(16).padStart(32, '0'), status: 'queued' };
      } });
    const runtime = new ConversationRuntime({ service, store, worker, accountSid, sender, participants,
      recipientByConversation: destinations, openParticipants: true, secret, version });
    const adapter = { normalizeInboundPayload(body) { return [{ messageId: body.MessageSid, type: 'text', textBody: body.Body }]; } };
    const message = (participant, number) => ({ From: participant, To: sender, AccountSid: accountSid,
      MessageSid: 'SM' + number.toString(16).padStart(32, '0'), Body: number % 2 ? 'Hi' : 'MAIN MENU' });

    for (let number = 1; number <= 51; number += 1) await runtime.inbound(message(participants[0], number), adapter);
    const duplicate = await runtime.inbound(message(participants[0], 1), adapter);
    assert.equal(duplicate.duplicate, true);
    await runtime.inbound(message(participants[1], 100), adapter);
    while (await runtime.dispatchOne()) { /* drain */ }

    assert.equal(sends.filter(to => to === participants[0]).length, 50);
    assert.equal(sends.filter(to => to === participants[1]).length, 1);
    assert.equal(sends.filter(to => to === participants[2]).length, 0);
    const states = await fixture.pool.query(`SELECT conversation_id,state,count(*)::integer count
      FROM conversation.outbox GROUP BY conversation_id,state`);
    const firstId = createConversationIdentity({ secret, version, accountSid, sender, participant: participants[0] });
    const secondId = createConversationIdentity({ secret, version, accountSid, sender, participant: participants[1] });
    assert.ok(states.rows.some(row => row.conversation_id === firstId && row.state === 'accepted' && row.count === 50));
    assert.ok(states.rows.some(row => row.conversation_id === firstId && row.state === 'failed' && row.count === 1));
    assert.ok(states.rows.some(row => row.conversation_id === secondId && row.state === 'accepted' && row.count === 1));
  } finally {
    await fixture.close();
  }
});
