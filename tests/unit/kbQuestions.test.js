'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadCorpus } = require('../../src/services/kbValidation');
const { validateQuestions } = require('../../scripts/kb-coverage');
const bank = require('../../evaluation/kb/questions.json');
const { articles } = loadCorpus(path.join(__dirname, '../../knowledge-base'));
test('question inventory references real services and claims', () => {
  assert.doesNotThrow(() => validateQuestions(bank, articles));
});
test('question inventory rejects stale references, duplicates and invalid labels', () => {
  for (const mutate of [
    b => { b.cases[0].target_article_ids = ['missing']; },
    b => { b.cases[0].target_article_ids = ['reg-tvet']; },
    b => { b.cases[0].required_claim_ids = ['cert-replacement:missing']; },
    b => { b.cases[0].required_claim_ids = []; },
    b => { b.cases[0].required_claim_ids = ['cert-replacement:timeline-conflict']; },
    b => { b.cases[1].id = b.cases[0].id; },
    b => { b.cases[0].split = 'training-and-test'; },
    b => { b.cases = b.cases.filter(c => !c.target_article_ids.includes('faq-general')); }
  ]) {
    const copy = structuredClone(bank); mutate(copy);
    assert.throws(() => validateQuestions(copy, articles));
  }
});
