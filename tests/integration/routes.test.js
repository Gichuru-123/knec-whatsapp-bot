'use strict';
const assert = require('assert');
const test = require('node:test');
const request = require('supertest');
const app = require('../../src/app');

test('GET /health - Returns 200 OK and UP status', async () => {
  const res = await request(app).get('/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'UP');
  assert.ok(res.body.timestamp);
});

test('Security Headers: Helmet policies present on response', async () => {
  const res = await request(app).get('/health');
  assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
  assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN');
});

test('Request Correlation ID: Auto-generates x-request-id if omitted', async () => {
  const res = await request(app).get('/health');
  assert.ok(res.headers['x-request-id']);
});

test('Request Correlation ID: Preserves client-supplied x-request-id', async () => {
  const customId = 'custom-client-id-999';
  const res = await request(app)
    .get('/health')
    .set('x-request-id', customId);
  assert.strictEqual(res.headers['x-request-id'], customId);
});

test('GET /api/v1/kb - Returns all articles when enabled', async () => {
  const res = await request(app).get('/api/v1/kb');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.count, 7);
  assert.ok(Array.isArray(res.body.data));
});

test('GET /api/v1/kb?category=registration - Returns filtered category results', async () => {
  const res = await request(app).get('/api/v1/kb?category=registration');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.count, 3);
});

test('GET /api/v1/kb/:id - Returns specific article', async () => {
  const res = await request(app).get('/api/v1/kb/faq-scam-awareness');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.id, 'faq-scam-awareness');
});

test('GET /api/v1/kb/:id - Returns 400 on invalid ID format', async () => {
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

test('Inspection Boundary: Returns 403 when dev inspection routes disabled', async () => {
  const config = require('../../src/config');
  const originalFlag = config.enableDevInspectionRoutes;
  config.enableDevInspectionRoutes = false;

  const res = await request(app).get('/api/v1/kb');
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body.error.code, 403);

  config.enableDevInspectionRoutes = originalFlag;
});
