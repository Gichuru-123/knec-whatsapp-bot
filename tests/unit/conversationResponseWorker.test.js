'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ConversationResponseWorker } = require('../../src/services/conversation/responseWorker');

test('Phase 5: response worker sends the claimed immutable body once', async () => {
  const finished = [];
  const claim = { id: 'job', body: 'exact stored menu' };
  const store = {
    async claimOutbox() { return claim; },
    async ownsOutbox() { return true; },
    async finishOutbox(item, result) { finished.push([item, result]); }
  };
  const sent = [];
  const worker = new ConversationResponseWorker({ store, participant: 'whatsapp:+254700000001',
    async send(to, body) { sent.push([to, body]); return { messageId: 'SM' + '1'.repeat(32), status: 'queued' }; } });
  assert.equal(await worker.tick(), true);
  assert.deepEqual(sent, [['whatsapp:+254700000001', 'exact stored menu']]);
  assert.deepEqual(finished[0][1], { kind: 'accepted', messageId: 'SM' + '1'.repeat(32), status: 'queued' });
});

test('Phase 5: response worker does not send a claim it no longer owns', async () => {
  let sends = 0;
  const store = { async claimOutbox() { return {}; }, async ownsOutbox() { return false; }, async finishOutbox() {} };
  const worker = new ConversationResponseWorker({ store, participant: 'whatsapp:+254700000001',
    async send() { sends += 1; } });
  assert.equal(await worker.tick(), false);
  assert.equal(sends, 0);
});

test('Phase 5: unknown provider acceptance becomes uncertain without retry', async () => {
  const results = [];
  const store = { async claimOutbox() { return { body: 'menu' }; }, async ownsOutbox() { return true; },
    async finishOutbox(claim, result) { results.push(result); } };
  const worker = new ConversationResponseWorker({ store, participant: 'whatsapp:+254700000001',
    async send() { throw new Error('private provider detail'); } });
  assert.equal(await worker.tick(), true);
  assert.deepEqual(results, [{ kind: 'uncertain' }]);
});
