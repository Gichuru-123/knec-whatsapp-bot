'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createConversationIdentity, createConversationEventIdentity } = require('../../src/services/messaging/conversationIdentity');
const { connectionOptions, DeliveryStore } = require('../../src/repository/deliveryStore');

test('conversation identity is stable and separates account, sender, participant and key', () => {
  const input = { secret: Buffer.alloc(32, 7), version: 1, accountSid: 'AC' + '1'.repeat(32),
    sender: 'whatsapp:+14155238886', participant: 'whatsapp:+254700000001' };
  const original = createConversationIdentity(input);
  assert.equal(createConversationIdentity(input), original);
  for (const change of [{ accountSid: 'AC' + '2'.repeat(32) }, { sender: 'whatsapp:+14155238887' },
    { participant: 'whatsapp:+254700000002' }, { secret: Buffer.alloc(32, 8) }, { version: 2 }]) {
    assert.notEqual(createConversationIdentity({ ...input, ...change }), original);
  }
  assert.match(original, /^v1:[a-f0-9]{64}$/);
  assert.throws(() => createConversationIdentity({ ...input, secret: Buffer.alloc(8) }));
});

test('conversation event identity is private, stable and provider-message scoped', () => {
  const input = { secret: Buffer.alloc(32, 7), accountSid: 'AC' + '1'.repeat(32), messageSid: 'SM' + '3'.repeat(32) };
  const original = createConversationEventIdentity(input);
  assert.match(original, /^[a-f0-9]{64}$/);
  assert.equal(createConversationEventIdentity(input), original);
  assert.notEqual(createConversationEventIdentity({ ...input, messageSid: 'SM' + '4'.repeat(32) }), original);
  assert.notEqual(createConversationEventIdentity({ ...input, secret: Buffer.alloc(32, 8) }), original);
  assert.ok(!original.includes(input.messageSid));
  assert.throws(() => createConversationEventIdentity({ ...input, messageSid: 'invalid' }));
});

test('database connection policy rejects URL overrides and verifies remote TLS', () => {
  const options = connectionOptions('postgresql://fixture:fixture@127.0.0.1:55418/knec_test');
  assert.equal(options.ssl, false);
  assert.equal(options.max, 4);
  assert.equal(connectionOptions('postgresql://fixture:fixture@db.example.invalid/knec_test').ssl.rejectUnauthorized, true);
  for (const input of ['', 'postgresql://127.0.0.1/knec_test',
    'postgresql://fixture:fixture@db.example.invalid/knec_test?sslmode=disable']) {
    assert.throws(() => connectionOptions(input), /INVALID_DATABASE_CONFIGURATION/);
  }
});

test('transaction rolls back and sanitizes driver errors, releasing its client', async () => {
  const calls = [];
  const client = { query: async sql => { calls.push(sql); }, release: broken => calls.push(broken) };
  const store = new DeliveryStore({ connect: async () => client });
  await assert.rejects(store.transaction(async () => { throw new Error('private driver detail'); }),
    error => error.message === 'DATABASE_OPERATION_FAILED' && !error.cause);
  assert.deepEqual(calls, ['BEGIN', 'ROLLBACK', false]);
});
