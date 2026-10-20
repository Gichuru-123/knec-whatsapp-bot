'use strict';
// Simulates the app running behind exactly one tunnel/proxy (TRUST_PROXY_HOPS=1). `npm test` runs each
// test file in its own process, so these settings cannot affect other test files. They must be applied
// before the app loads.
process.env.WEBHOOK_RATE_LIMIT_MAX = '2';
process.env.TRUST_PROXY_HOPS = '1';

const assert = require('assert');
const test = require('node:test');
const request = require('supertest');
const app = require('../../src/app');

test('R2a TRUST_PROXY_HOPS=1: each client forwarded by the tunnel gets its own rate-limit allowance', async () => {
  assert.strictEqual(app.get('trust proxy'), 1);

  const fromClient = (ip) => request(app)
    .get('/api/v1/webhook/whatsapp')
    .set('X-Forwarded-For', ip)
    .query({ 'hub.mode': 'subscribe' });

  // Client A uses up its allowance of 2 requests; its third request is blocked.
  assert.strictEqual((await fromClient('198.51.100.1')).status, 403);
  assert.strictEqual((await fromClient('198.51.100.1')).status, 403);
  assert.strictEqual((await fromClient('198.51.100.1')).status, 429);

  // Client B is a different visitor behind the same tunnel and is not blocked by client A.
  assert.strictEqual((await fromClient('198.51.100.2')).status, 403);
});
