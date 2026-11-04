'use strict';
const path = require('node:path');
const { loadCorpus } = require('../src/services/kbValidation');
try {
  const { articles, sources } = loadCorpus(path.join(__dirname, '..', 'knowledge-base'));
  console.log('KB editorial inventory; status is not a claim of factual completeness.');
  console.table(articles.map(a => ({ id: a.id, status: a.status, claims: a.claims.length,
    review_questions: a.unresolved_questions.length, review_due: a.review_due })));
  console.log(`${sources.length} sources; ${sources.filter(s => s.review_status === 'inspected').length} inspected.`);
  console.log(`${articles.filter(a => a.status === 'approved').length} articles carry approval records; answer eligibility also depends on scope and date.`);
} catch {
  console.error('KB report unavailable: corpus validation failed.');
  process.exitCode = 1;
}
