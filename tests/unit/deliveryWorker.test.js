'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DeliveryWorker } = require('../../src/services/messaging/deliveryWorker');

test('worker never submits a claim it no longer owns', async () => {
  let sends = 0;
  const worker = new DeliveryWorker({ store: { claim: async () => ({}), owns: async () => false },
    send: async () => { sends++; }, runId: 'fixture', participant: 'fixture' });
  await worker.tick();
  assert.equal(sends, 0);
});

test('worker records uncertainty when submission throws and never retries itself', async () => {
  const results = [];
  let sends = 0;
  const store = { claim: async () => ({}), owns: async () => true, finish: async (claim, result) => results.push(result) };
  const worker = new DeliveryWorker({ store, send: async () => { sends++; throw new Error('private'); },
    runId: 'fixture', participant: 'fixture' });
  await worker.tick();
  assert.equal(sends, 1);
  assert.deepEqual(results, [{ kind: 'uncertain' }]);
});
