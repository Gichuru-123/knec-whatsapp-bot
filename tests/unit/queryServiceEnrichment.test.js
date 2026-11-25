'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadCorpus } = require('../../src/services/kbValidation');

const { articles } = loadCorpus(path.join(__dirname, '../../knowledge-base'));
const byId = new Map(articles.map(article => [article.id, article]));
const procedures = require('../../evaluation/kb/procedures.json').procedures;
const questions = require('../../evaluation/kb/questions.json').cases;

test('query enrichment preserves seven distinct services with substantive evidence', () => {
  const expectedClaims = {
    'biodata-amendment': 8,
    'results-query': 7,
    'direct-recovery': 6,
    'photo-amendment': 4,
    'professional-payment-query': 5,
    'public-complaints': 8,
    'ver-results': 18
  };
  for (const [id, count] of Object.entries(expectedClaims)) {
    const article = byId.get(id);
    assert.ok(article, id);
    assert.equal(article.claims.length, count, id);
    assert.ok(article.claims.every(claim => claim.citations.length), id);
  }
  assert.notEqual(byId.get('results-query').service_id, byId.get('ver-results').service_id);
  assert.notEqual(byId.get('direct-recovery').service_id, byId.get('cert-replacement').service_id);
});

test('query procedures execute evidence references and preserve conflict gates', () => {
  for (const id of ['biodata-amendment', 'results-query', 'direct-recovery', 'photo-amendment', 'professional-payment-query', 'public-complaints', 'confirmation']) {
    assert.ok(procedures.find(procedure => procedure.id === id), id);
  }
  const results = procedures.find(procedure => procedure.id === 'results-query');
  assert.ok(results.steps.some(step => step.claim_refs.includes('results-query:deadline-conflict') && step.review_gate));
  const confirmation = procedures.find(procedure => procedure.id === 'confirmation');
  assert.ok(confirmation.steps.some(step => step.review_gate));
});

test('evaluation bank covers privacy, conflict, boundary and escalation behavior', () => {
  const added = questions.filter(item => [
    'biodata-scope-2026', 'biodata-qmis-privacy', 'results-query-classify',
    'results-query-deadline-conflict', 'direct-recovery-boundary',
    'direct-recovery-certificate-window', 'photo-amendment-workflow',
    'photo-amendment-status', 'professional-payment-route',
    'professional-payment-privacy', 'complaints-escalation',
    'complaints-response-boundary', 'confirmation-complete-procedure',
    'confirmation-delivery-conflict'
  ].includes(item.id));
  assert.equal(added.length, 14);
  assert.ok(added.every(item => item.required_claim_ids.length > 0));
  assert.ok(added.some(item => item.style === 'privacy'));
  assert.ok(added.some(item => item.style === 'conflict'));
});

test('confirmation fees remain destination-scoped and delivery conflict stays unresolved', () => {
  const article = byId.get('ver-results');
  assert.ok(article.claims.some(claim => claim.id === 'outside-email-courier'));
  assert.ok(article.claims.some(claim => claim.id === 'delivery-conflict'));
  assert.ok(article.unresolved_questions.some(question => question.includes('fax') && question.includes('2026 charter')));
});
