'use strict';
// Tests the app's REAL webhook rate limiter. `npm test` runs each test file in its own process, so the
// low limit set here cannot affect any other test file. These settings must be applied before the app loads.
process.env.WEBHOOK_RATE_LIMIT_MAX = '3';
process.env.TRUST_PROXY_HOPS = '0';

const assert = require('assert');
const test = require('node:test');
const request = require('supertest');
const app = require('../../src/app');

test('R2a Real webhook rate limiter: blocks requests over the limit, before any signature check, and cannot be bypassed with a fake X-Forwarded-For header', async () => {
  // Requests 1-3 are within the limit. They reach the controller, which refuses the bad token (403).
  for (let i = 1; i <= 3; i++) {
    const res = await request(app).get('/api/v1/webhook/whatsapp').query({ 'hub.mode': 'subscribe' });
    assert.strictEqual(res.status, 403, `request ${i} should be within the limit`);
    assert.strictEqual(res.headers['ratelimit-limit'], '3');
  }

  // Request 4 is over the limit.
  const blocked = await request(app).get('/api/v1/webhook/whatsapp').query({ 'hub.mode': 'subscribe' });
  assert.strictEqual(blocked.status, 429);
  assert.strictEqual(blocked.body.error.code, 429);

  // POST shares the same limiter and is blocked before its body or signature is even read (429, not 401).
  const blockedPost = await request(app)
    .post('/api/v1/webhook/whatsapp')
    .set('Content-Type', 'application/json')
    .send('{}');
  assert.strictEqual(blockedPost.status, 429);

  // With TRUST_PROXY_HOPS=0 the app ignores X-Forwarded-For, so pretending to be another client does not help.
  const spoofed = await request(app)
    .get('/api/v1/webhook/whatsapp')
    .set('X-Forwarded-For', '203.0.113.50')
    .query({ 'hub.mode': 'subscribe' });
  assert.strictEqual(spoofed.status, 429);
});
