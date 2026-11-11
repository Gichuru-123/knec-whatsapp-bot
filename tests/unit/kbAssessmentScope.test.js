'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadCorpus } = require('../../src/services/kbValidation');
const { articles } = loadCorpus(path.join(__dirname, '../../knowledge-base'));
test('assessment guidance separates stage-based pathways from grade-based requirements', () => {
  assert.equal(articles.find(a => a.id === 'reg-kpsea-kjsea').visibility, 'internal');
  for (const exam of ['KPSEA', 'KJSEA', 'KILEA', 'KPLEA']) {
    const a = articles.find(a => a.id === `reg-${exam.toLowerCase()}`);
    assert.deepEqual(a.scope.examinations, [exam]);
    assert.deepEqual(a.scope.years, ['2026']);
    if (['KILEA', 'KPLEA'].includes(exam)) {
      assert.ok(a.claims.every(c => !['requirement', 'step'].includes(c.kind)));
      assert.ok(a.claims.some(c => c.id === `${exam.toLowerCase()}-pathway`));
    }
  }
});

test('TVET comparison stays internal and fee records contain one programme tariff', () => {
  assert.equal(articles.find(a => a.id === 'reg-tvet').visibility, 'internal');
  const fees = articles.filter(a => a.scope.programmes);
  assert.equal(fees.length, 10);
  for (const a of fees) {
    assert.equal(a.scope.programmes.length, 1);
    assert.equal(a.claims.filter(c => c.kind === 'fee').length, 1);
    assert.deepEqual(a.scope.series, ['2026-11', '2027-03', '2027-07']);
  }
  for (const series of ['2026-11', '2027-03', '2027-07']) {
    const a = articles.find(a => a.id === `tvet-series-${series}`);
    assert.deepEqual(a.scope.series, [series]);
    assert.deepEqual(a.scope.years, [series.slice(0, 4)]);
  }
});
