'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateCorpus, contentHash } = require('../../src/services/kbValidation');
const { selectApprovedAnswer } = require('../../src/services/kbAnswerPolicy');
const { KBRepository } = require('../../src/repository/kbRepository');
const service = require('../../src/services/kbService');

const context = { examination: 'KCSE', audience: 'candidate', year: '2026', language: 'en' };
function fixture() {
  const source = { id: 'synthetic-source', title: 'Synthetic policy fixture', publisher: 'KNEC',
    url: 'https://www.knec.ac.ke/synthetic-fixture', document_date: '2026-01-01',
    retrieved_on: '2026-01-02', review_due: '2026-12-31', review_status: 'inspected',
    sha256: 'a'.repeat(64), local_filename: null, notes: 'Synthetic test data, not real policy.' };
  const article = { schema_version: 2, id: 'synthetic-article', service_id: 'synthetic-service',
    category: 'faqs', title: 'Synthetic article', description: 'Never a real answer.', language: 'en',
    version: '1.0.0', status: 'approved', verification_status: 'verified', visibility: 'public',
    scope: { examinations: ['KCSE'], audiences: ['candidate'], years: ['2026'] },
    intents: ['synthetic'], clarifying_questions: [], claims: [{ id: 'synthetic-claim', kind: 'orientation',
      text: 'Synthetic answer.', evidence_status: 'supported', citations: [{ source_id: source.id,
        source_sha256: source.sha256, locator: 'p1 synthetic section' }] }],
    unresolved_questions: [], effective_from: '2026-01-03', effective_to: null,
    review_due: '2026-12-31', approval: null };
  sign(article);
  return { article, sources: [source] };
}
function sign(article) {
  article.approval = { reviewer: 'Synthetic reviewer', role: 'Test only', approved_on: '2026-01-03',
    content_sha256: contentHash(article) };
}

test('KB programme and series scope requires exact context and examination year', () => {
  const { article, sources } = fixture();
  article.scope.programmes = ['technical-diploma'];
  article.scope.series = ['2026-11'];
  sign(article);
  const scoped = { ...context, programme: 'technical-diploma', series: '2026-11' };
  assert.ok(selectApprovedAnswer(article, sources, scoped, '2026-11-03'));
  for (const change of [
    { programme: undefined }, { programme: 'business-tep-diploma' },
    { series: undefined }, { series: '2026-07' }, { year: '2027' }, { series: 202611 }
  ]) assert.equal(selectApprovedAnswer(article, sources, { ...scoped, ...change }, '2026-11-03'), null);
  article.scope.series = ['2027-03']; sign(article);
  assert.throws(() => validateCorpus([article], sources), /examination year/);
  article.scope.series = ['2026-13']; sign(article);
  assert.throws(() => validateCorpus([article], sources));
});

test('KB approval policy returns only reviewed claims with exact citations', () => {
  const { article, sources } = fixture();
  const result = selectApprovedAnswer(article, sources, context, '2026-11-03');
  assert.equal(result.claims[0].citations[0].sha256, sources[0].sha256);
  assert.equal(result.claims[0].citations[0].locator, 'p1 synthetic section');
  assert.ok(!('description' in result));
  assert.ok(!('approval' in result));
});

test('KB schema rejects invalid dates, types, undeclared fields, URLs and duplicate IDs', () => {
  const changes = [
    a => { a.review_due = '2026-02-30'; },
    a => { a.schema_version = '2'; },
    a => { a.status = 'active'; },
    a => { a.arbitrary = true; },
    a => { a.claims[0].citations[0].source_id = 'missing'; },
    a => { a.claims.push(structuredClone(a.claims[0])); }
  ];
  for (const change of changes) {
    const { article, sources } = fixture(); change(article); sign(article);
    assert.throws(() => validateCorpus([article], sources));
  }
  for (const url of ['http://knec.ac.ke', 'https://knec.ac.ke.evil.example', 'https://user:password@knec.ac.ke']) {
    const { article, sources } = fixture(); sources[0].url = url;
    assert.throws(() => validateCorpus([article], sources));
  }
  const { article, sources } = fixture();
  assert.throws(() => validateCorpus([article, article], sources));
  assert.throws(() => validateCorpus([article], [sources[0], sources[0]]));
});

test('KB edits and source revision changes invalidate old approvals', () => {
  const { article, sources } = fixture();
  article.claims[0].text = 'Unreviewed new fee';
  assert.equal(selectApprovedAnswer(article, sources, context, '2026-11-03'), null);
  sign(article);
  sources[0].sha256 = 'b'.repeat(64);
  assert.equal(selectApprovedAnswer(article, sources, context, '2026-11-03'), null);
});

test('KB policy blocks drafts, internal content, conflicts, expired and future evidence', () => {
  const cases = [
    a => { a.status = 'draft'; },
    a => { a.status = 'retired'; },
    a => { a.visibility = 'internal'; },
    a => { a.verification_status = 'source_checked'; },
    a => { a.unresolved_questions.push('Conflicting fee'); },
    a => { a.claims[0].evidence_status = 'unresolved'; },
    a => { a.review_due = '2026-11-02'; },
    a => { a.effective_from = '2026-11-04'; },
    a => { a.effective_to = '2026-11-02'; },
    (a, s) => { s[0].review_due = '2026-11-02'; },
    (a, s) => { s[0].review_status = 'superseded'; },
    (a, s) => { s[0].retrieved_on = '2026-11-04'; },
    (a, s) => { s[0].document_date = '2026-11-04'; }
  ];
  for (const change of cases) {
    const { article, sources } = fixture(); change(article, sources); sign(article);
    assert.equal(selectApprovedAnswer(article, sources, context, '2026-11-03'), null);
  }
  const { article, sources } = fixture(); article.approval = null;
  assert.equal(selectApprovedAnswer(article, sources, context, '2026-11-03'), null);
});

test('KB policy requires applicable language, examination, audience, year and a valid clock', () => {
  const { article, sources } = fixture();
  for (const altered of [{ ...context, year: '2027' }, { ...context, audience: 'school' },
    { ...context, examination: 'KPSEA' }, { ...context, language: 'sw' }, {}, null]) {
    assert.equal(selectApprovedAnswer(article, sources, altered, '2026-11-03'), null);
  }
  assert.equal(selectApprovedAnswer(article, sources, context, 'invalid'), null);
  assert.ok(selectApprovedAnswer(article, sources, context, '2026-12-31'));
  assert.equal(selectApprovedAnswer(article, sources, context, '2027-01-01'), null);
});

test('KB repository refuses partial corpus on failed reload', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knec-kb-fixture-'));
  t.after(() => {
    const target = path.resolve(directory);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert.ok(path.basename(target).startsWith('knec-kb-fixture-'));
    fs.rmSync(target, { recursive: true, force: true });
  });
  const { article, sources } = fixture();
  fs.mkdirSync(path.join(directory, 'sources'));
  fs.writeFileSync(path.join(directory, 'sources/catalog.json'), JSON.stringify(sources));
  fs.writeFileSync(path.join(directory, 'article.json'), JSON.stringify(article));
  const repo = new KBRepository(directory);
  assert.equal(repo.loadKBData(), 1);
  fs.writeFileSync(path.join(directory, 'broken.json'), '{}');
  assert.throws(() => repo.loadKBData(), /KB integrity failure/);
  assert.equal(repo.isLoaded, false);
  assert.equal(repo.kbIndex.size, 0);
  assert.throws(() => repo.findAll());
});

test('Real draft corpus is inspectable but exposes no approved public answers', () => {
  const articles = service.getAllArticles();
  assert.equal(articles.length, 33);
  for (const article of articles) assert.equal(service.getApprovedAnswer(article.id, context), null);
});
