'use strict';
const path = require('node:path');
const { loadCorpus } = require('../src/services/kbValidation');

function validateProcedures(bank, articles) {
  if (!Array.isArray(bank.procedures) || !bank.procedures.length) throw new Error('Missing procedures');
  const claims = new Map(articles.flatMap(a => a.claims.map(c => [`${a.id}:${c.id}`, c])));
  const ids = new Set();
  for (const p of bank.procedures) {
    if (!p.id || ids.has(p.id) || p.status !== 'draft' || p.language !== 'en') throw new Error('Invalid procedure');
    ids.add(p.id);
    if (!p.title || !p.completion || !Array.isArray(p.clarifying_questions) || !p.clarifying_questions.length || !Array.isArray(p.steps) || !p.steps.length) throw new Error('Incomplete procedure');
    const steps = new Set();
    for (const s of p.steps) {
      if (!s.id || steps.has(s.id) || !s.prompt || !s.applies_when || !Array.isArray(s.claim_refs) || !s.claim_refs.length) throw new Error('Invalid step');
      steps.add(s.id);
      if (s.review_gate !== null && (typeof s.review_gate !== 'string' || !s.review_gate.trim())) throw new Error('Invalid review gate');
      for (const ref of s.claim_refs) {
        if (!claims.has(ref)) throw new Error('Unknown evidence reference');
        if (claims.get(ref).evidence_status !== 'supported' && !s.review_gate) throw new Error('Unresolved evidence needs a review gate');
      }
    }
  }
}
if (require.main === module) {
  const { articles } = loadCorpus(path.join(__dirname, '../knowledge-base'));
  const bank = require('../evaluation/kb/procedures.json');
  validateProcedures(bank, articles);
  console.log(`Validated ${bank.procedures.length} draft procedure plans and their evidence references. No public workflow activated.`);
}
module.exports = { validateProcedures };
