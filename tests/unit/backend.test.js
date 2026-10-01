'use strict';
const assert = require('assert');
const test = require('node:test');
const kbRepository = require('../../src/repository/kbRepository');
const kbService = require('../../src/services/kbService');
const config = require('../../src/config');

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

test('KBService: Returns null for invalid ID or type', () => {
  assert.strictEqual(kbService.getArticleById(12345), null);
  assert.strictEqual(kbService.getArticleById('non-existent-id'), null);
});

test('Config: Default variables load correctly', () => {
  assert.strictEqual(typeof config.port, 'number');
  assert.ok(Array.isArray(config.allowedOrigins));
});
