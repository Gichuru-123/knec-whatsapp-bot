'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { prepareDatabase } = require('../helpers/postgres');
const { DeliveryStore } = require('../../src/repository/deliveryStore');

test('PostgreSQL atomically accepts duplicate receipts and preserves run bindings', async () => {
  const fixture = await prepareDatabase();
  try {
    const store = new DeliveryStore(fixture.pool);
    const run = { id: randomUUID(), accountSid: 'AC' + '1'.repeat(32), binding: 'a'.repeat(64), maxAttempts: 1 };
    await store.openRun(run);
    await store.openRun(run);
    await assert.rejects(store.openRun({ ...run, binding: 'b'.repeat(64) }));
    const receipt = { runId: run.id, accountSid: run.accountSid, messageSid: 'SM' + '1'.repeat(32),
      conversationId: 'v1:' + 'c'.repeat(64), supported: true };
    const accepted = await Promise.all(Array.from({ length: 8 }, () => store.accept(receipt)));
    assert.equal(accepted.filter(result => !result.duplicate).length, 1);
    const jobs = await fixture.pool.query('SELECT count(*)::integer AS count FROM delivery.jobs');
    assert.equal(jobs.rows[0].count, 1);
    await assert.rejects(store.accept({ ...receipt, supported: false }));
    await assert.rejects(store.transaction(async client => {
      await client.query('UPDATE delivery.runs SET receipt_count=20 WHERE id=$1', [run.id]);
      throw new Error('synthetic rollback');
    }));
    const count = await fixture.pool.query('SELECT receipt_count FROM delivery.runs WHERE id=$1', [run.id]);
    assert.equal(count.rows[0].receipt_count, 1);
    const claims = await Promise.all([store.claim(run.id, randomUUID()), store.claim(run.id, randomUUID())]);
    const claim = claims.find(Boolean);
    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal(await store.owns(claim), true);
    const providerSid = 'SM' + '2'.repeat(32);
    await store.callback({ runId: run.id, accountSid: run.accountSid, messageSid: providerSid, status: 'delivered' });
    await store.finish(claim, { kind: 'accepted', messageId: providerSid, status: 'queued' });
    await store.callback({ runId: run.id, accountSid: run.accountSid, messageSid: providerSid, status: 'sent' });
    const delivered = await fixture.pool.query('SELECT state,delivery_status FROM delivery.jobs');
    assert.deepEqual(delivered.rows[0], { state: 'accepted', delivery_status: 'delivered' });
    assert.equal(await store.owns(claim), false);
    await assert.rejects(store.accept({ ...receipt, messageSid: 'SM' + '3'.repeat(32) }));
    await store.callback({ runId: run.id, accountSid: run.accountSid, messageSid: providerSid, status: 'failed', errorCode: 63016 });
    const conflict = await fixture.pool.query('SELECT delivery_status,review_required FROM delivery.jobs');
    assert.deepEqual(conflict.rows[0], { delivery_status: 'delivered', review_required: true });
    await store.closeRun(run.id);
    assert.equal(await store.cleanup(run.id), false);
    await fixture.pool.query("UPDATE delivery.runs SET closed_at=clock_timestamp()-interval '8 days' WHERE id=$1", [run.id]);
    assert.equal(await store.cleanup(run.id), true);
    assert.equal((await fixture.pool.query('SELECT count(*)::integer AS count FROM delivery.jobs')).rows[0].count, 0);
    await assert.rejects(store.openRun(run));
  } finally { await fixture.close(); }
});

test('retry scheduling and attempt budget persist across store reconstruction', async () => {
  const fixture = await prepareDatabase();
  try {
    const store = new DeliveryStore(fixture.pool);
    const run = { id: randomUUID(), accountSid: 'AC' + '9'.repeat(32), binding: 'e'.repeat(64), maxAttempts: 2 };
    await store.openRun(run);
    await store.accept({ runId: run.id, accountSid: run.accountSid, messageSid: 'SM' + '9'.repeat(32), conversationId: 'v1:' + 'f'.repeat(64), supported: true });
    const first = await store.claim(run.id, randomUUID());
    await store.finish(first, { kind: 'retry', retryAfterMs: 15000 });
    const restarted = new DeliveryStore(fixture.pool);
    assert.equal(await restarted.claim(run.id, randomUUID()), null);
    await fixture.pool.query("UPDATE delivery.jobs SET eligible_at=clock_timestamp()-interval '1 second'");
    await fixture.pool.query('UPDATE delivery.runs SET last_dispatch_at=NULL WHERE id=$1', [run.id]);
    const second = await restarted.claim(run.id, randomUUID());
    assert.equal(second.attempt, 2);
    await restarted.finish(second, { kind: 'retry', retryAfterMs: 15000 });
    assert.equal((await fixture.pool.query('SELECT state FROM delivery.jobs')).rows[0].state, 'failed');
    assert.equal((await fixture.pool.query('SELECT used_attempts FROM delivery.runs')).rows[0].used_attempts, 2);
    await assert.rejects(store.transaction(client => client.query('SELECT * FROM delivery.missing_relation')), /DATABASE_OPERATION_FAILED/);
  } finally { await fixture.close(); }
});
