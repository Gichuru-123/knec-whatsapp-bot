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

test('Phase 4 repair: malformed JSON is a safe 400 without body excerpts or stack traces in any environment', async () => {
  const config = require('../../src/config');
  const savedEnv = config.nodeEnv;
  const saved = { log: console.log, warn: console.warn, error: console.error };
  let captured = '';
  const capture = (...args) => { captured += args.join(' ') + '\n'; };
  console.log = capture; console.warn = capture; console.error = capture;
  try {
    for (const env of ['production', 'development', 'test']) {
      config.nodeEnv = env;
      const response = await request(app).post('/health').set('Content-Type', 'application/json').send('PRIV123');
      assert.strictEqual(response.status, 400);
      assert.deepStrictEqual(response.body, { error: { message: 'Bad Request', code: 400 } });
    }
    assert.ok(captured.includes('HTTP request failed'), 'failure remains observable');
    assert.ok(!captured.includes('PRIV123'), 'submitted body must never reach logs');
    assert.ok(!captured.includes('SyntaxError'));
    assert.ok(!captured.includes('node_modules'));
  } finally {
    config.nodeEnv = savedEnv;
    Object.assign(console, saved);
  }
});

test('Phase 4 repair: unexpected errors preserve only safe HTTP status information', async () => {
  const express = require('express');
  const errorHandler = require('../../src/middleware/errorHandler');
  const fixtureApp = express();
  fixtureApp.get('/failure/:status', (req, res, next) => {
    const err = new Error('PRIVATE_EXCEPTION_SENTINEL');
    err.status = Number(req.params.status);
    err.cause = new Error('PRIVATE_CAUSE_SENTINEL');
    next(err);
  });
  fixtureApp.use(errorHandler);
  const saved = console.error;
  let captured = '';
  console.error = (...args) => { captured += args.join(' '); };
  try {
    for (const [input, expected, message] of [[500, 500, 'Internal Server Error'], [401, 401, 'Unauthorized'], [200, 500, 'Internal Server Error'], [999, 500, 'Internal Server Error']]) {
      const response = await request(fixtureApp).get(`/failure/${input}`);
      assert.strictEqual(response.status, expected);
      assert.deepStrictEqual(response.body, { error: { code: expected, message } });
    }
    assert.ok(!captured.includes('PRIVATE_EXCEPTION_SENTINEL'));
    assert.ok(!captured.includes('PRIVATE_CAUSE_SENTINEL'));
  } finally { console.error = saved; }
});
