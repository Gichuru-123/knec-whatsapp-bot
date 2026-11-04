'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadCorpus } = require('../../src/services/kbValidation');
const { validateProcedures } = require('../../scripts/kb-procedures');
const bank = require('../../evaluation/kb/procedures.json');
const { articles } = loadCorpus(path.join(__dirname, '../../knowledge-base'));
test('draft procedures have traceable steps and explicit conflict gates', () => {
  assert.doesNotThrow(() => validateProcedures(bank, articles));
});
test('procedure review rejects lost evidence and unguarded conflicts', () => {
  for (const change of [
    b => { b.procedures[0].steps[0].claim_refs = ['missing:claim']; },
    b => { b.procedures[0].steps[0].claim_refs = []; },
    b => { b.procedures[0].steps.find(s => s.id === 'processing').review_gate = null; },
    b => { b.procedures[0].steps[1].id = b.procedures[0].steps[0].id; },
    b => { b.procedures[0].status = 'approved'; }
  ]) {
    const copy = structuredClone(bank); change(copy);
    assert.throws(() => validateProcedures(copy, articles));
  }
});
