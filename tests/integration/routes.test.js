const assert = require('assert');
const test = require('node:test');
const request = require('supertest');
const app = require('../../src/app');

test('GET /health - Returns 200 OK and UP status', async () => {
  const res = await request(app).get('/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'UP');
  assert.ok(res.body.timestamp);
  assert.ok(res.headers['x-request-id']);
  assert.ok(res.headers['x-content-type-options']);
});

test('GET /api/v1/kb - Returns all articles', async () => {
  const res = await request(app).get('/api/v1/kb');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.count, 7);
  assert.ok(Array.isArray(res.body.data));
});

test('GET /api/v1/kb/:id - Returns specific article', async () => {
  const res = await request(app).get('/api/v1/kb/faq-scam-awareness');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.id, 'faq-scam-awareness');
});

test('GET /api/v1/kb/:id - Returns 400 on invalid format', async () => {
  const res = await request(app).get('/api/v1/kb/bad_id!@#');
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error.code, 400);
});

test('GET /api/v1/kb/:id - Returns 404 when article missing', async () => {
  const res = await request(app).get('/api/v1/kb/missing-article');
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.error.code, 404);
});

test('GET /non-existent-route - Returns 404 JSON', async () => {
  const res = await request(app).get('/non-existent-route');
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.error.code, 404);
});
