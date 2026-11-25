'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ConversationResponseWorker } = require('../../src/services/conversation/responseWorker');

const PARTICIPANT = 'whatsapp:+254700000001';
const VALID_SID = 'SM' + '1'.repeat(32);

async function exerciseSender(senderResult, expectedResult, { throws = false } = {}) {
  const claim = { id: 'job', body: 'exact stored menu' };
  const completions = [];
  const sent = [];
  let claims = 0;
  const store = {
    async claimOutbox() { claims += 1; return claims === 1 ? claim : null; },
    async ownsOutbox() { return true; },
    async isWithinOutboxLimit() { return true; },
    async finishOutbox(item, result) { completions.push([item, result]); }
  };
  const worker = new ConversationResponseWorker({ store, participant: PARTICIPANT,
    async send(to, body) {
      sent.push([to, body]);
      if (throws) throw new Error('private provider detail');
      return senderResult;
    } });

  assert.equal(await worker.tick(), true);
  assert.deepEqual(sent, [[PARTICIPANT, claim.body]]);
  assert.deepEqual(completions, [[claim, expectedResult]]);
  assert.equal(await worker.tick(), false);
  assert.equal(sent.length, 1);
}

test('Phase 5: response worker sends the claimed immutable body once', async () => {
  await exerciseSender({ kind: 'accepted', messageId: VALID_SID, status: 'queued' },
    { kind: 'accepted', messageId: VALID_SID, status: 'queued' });
});

for (const [name, senderResult, expectedResult] of [
  ['explicit failed result', { kind: 'failed' }, { kind: 'failed' }],
  ['retry result becomes failed', { kind: 'retry', retryAfterMs: 15000 }, { kind: 'failed' }],
  ['explicit uncertain result', { kind: 'uncertain' }, { kind: 'uncertain' }],
  ['unknown result', { kind: 'unknown-provider-result' }, { kind: 'uncertain' }],
  ['null result', null, { kind: 'uncertain' }],
  ['accepted result missing message ID', { kind: 'accepted', status: 'queued' }, { kind: 'uncertain' }],
  ['accepted result with invalid message ID', { kind: 'accepted', messageId: 'invalid', status: 'queued' }, { kind: 'uncertain' }],
  ['accepted result missing status', { kind: 'accepted', messageId: VALID_SID }, { kind: 'uncertain' }],
  ['accepted result with unsupported status', { kind: 'accepted', messageId: VALID_SID, status: 'scheduled' }, { kind: 'uncertain' }]
]) {
  test(`Phase 5: ${name}`, async () => exerciseSender(senderResult, expectedResult));
}

test('Phase 5: sender exception becomes uncertain without retry', async () => {
  await exerciseSender(undefined, { kind: 'uncertain' }, { throws: true });
});

test('Phase 5: response worker does not send a claim it no longer owns', async () => {
  let sends = 0;
  let completions = 0;
  const store = { async claimOutbox() { return {}; }, async ownsOutbox() { return false; },
    async isWithinOutboxLimit() { return true; },
    async finishOutbox() { completions += 1; } };
  const worker = new ConversationResponseWorker({ store, participant: PARTICIPANT,
    async send() { sends += 1; } });
  assert.equal(await worker.tick(), false);
  assert.equal(sends, 0);
  assert.equal(completions, 0);
});

test('Sandbox participant limit blocks an over-limit claim before provider contact', async () => {
  const claim = { id: 'job', conversation_id: 'v1:' + '1'.repeat(64), body: 'not sent' };
  const completions = [];
  let sends = 0;
  const store = {
    async claimOutbox() { return claim; },
    async ownsOutbox() { return true; },
    async isWithinOutboxLimit(item, limit) { assert.equal(item, claim); assert.equal(limit, 50); return false; },
    async finishOutbox(item, result) { completions.push([item, result]); }
  };
  const worker = new ConversationResponseWorker({ store, participant: PARTICIPANT,
    messagesPerParticipant: 50, async send() { sends += 1; } });
  assert.equal(await worker.tick(), true);
  assert.equal(sends, 0);
  assert.deepEqual(completions, [[claim, { kind: 'failed' }]]);
});
