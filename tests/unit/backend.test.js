'use strict';
const assert = require('assert');
const test = require('node:test');
const kbRepository = require('../../src/repository/kbRepository');
const kbService = require('../../src/services/kbService');
const logger = require('../../src/logger');

test('KBRepository: Loads all 7 KB articles into memory', () => {
  const count = kbRepository.loadKBData();
  assert.strictEqual(count, 7);
});

test('KBRepository: Enforces object immutability (deep freeze)', () => {
  const article = kbRepository.findById('reg-kcse');
  assert.ok(article);
  assert.throws(() => {
    article.title = 'Mutated Title';
  }, TypeError);
});

test('KBService: Retrieves article by ID', () => {
  const article = kbService.getArticleById('reg-kpsea-kjsea');
  assert.ok(article);
  assert.strictEqual(article.title, 'KPSEA and KJSEA Assessment Registration');
});

test('KBService: Filters articles by category', () => {
  const regArticles = kbService.getArticlesByCategory('registration');
  assert.strictEqual(regArticles.length, 3);
  assert.ok(regArticles.every(a => a.category === 'registration'));
});

test('KBService: Returns null for invalid ID or type', () => {
  assert.strictEqual(kbService.getArticleById(12345), null);
  assert.strictEqual(kbService.getArticleById('non-existent-id'), null);
});

test('Logger: Redacts sensitive keys in metadata', () => {
  const childLogger = logger.child({ component: 'TestComponent' });
  const formatted = childLogger.formatMessage('info', 'Test message', {
    token: 'secret-token-123',
    user: 'john_doe'
  });
  assert.ok(formatted.includes('[REDACTED]'));
  assert.ok(!formatted.includes('secret-token-123'));
  assert.ok(formatted.includes('john_doe'));
});
