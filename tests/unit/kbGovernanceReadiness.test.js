'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { formatScopeDimension, load, validateGovernance } = require('../../scripts/kb-governance');

test('scope rendering distinguishes missing, null, empty, unrestricted and populated dimensions', () => {
  assert.equal(formatScopeDimension({}, 'programmes'), 'Not recorded');
  assert.equal(formatScopeDimension({ programmes: null }, 'programmes'), 'Unspecified');
  assert.equal(formatScopeDimension({ programmes: [] }, 'programmes'), 'No values recorded');
  assert.equal(formatScopeDimension({ programmes: ['all'] }, 'programmes'), 'Explicitly unrestricted (all)');
  assert.equal(formatScopeDimension({ programmes: ['technical', 'business'] }, 'programmes'), 'technical, business');
});

test('governance inventory classifies every article, source and active menu hook', () => {
  const data = load();
  const result = validateGovernance(data);
  assert.equal(data.articles.length, 33);
  assert.equal(data.sources.length, 17);
  assert.equal(data.readiness.services.length, 33);
  assert.equal(data.sourceDecisions.decisions.length, 17);
  assert.equal([...result.mappings.values()].flat().length, 32);
});

test('governance keeps conflicts and editorial readiness outside runtime approval', () => {
  const data = load();
  validateGovernance(data);
  assert.ok(data.conflicts.conflicts.every(item => item.status === 'open'));
  assert.ok(data.readiness.services.every(item => item.status !== 'institutionally_approved'));
  assert.ok(data.articles.every(item => item.status !== 'approved' && item.approval === null));
  assert.ok(data.packages.packages.every(item => item.publication_authorized === false));
});

test('governance records no candidate personal information', () => {
  const data = load();
  const encoded = JSON.stringify({ sourceDecisions: data.sourceDecisions, conflicts: data.conflicts,
    readiness: data.readiness, packages: data.packages, gaps: data.gaps });
  assert.doesNotMatch(encoded, /passport number\s*[:=]\s*\w|index number\s*[:=]\s*\d|candidate name\s*[:=]\s*\w|password\s*[:=]\s*\S+/i);
  assert.ok(data.readiness.services.every(item => /not collect|no candidate|must not store/i.test(item.pii_boundary)));
});

test('governance rejects changed evidence hashes', () => {
  const data = structuredClone(load());
  const citation = data.articles.flatMap(item => item.claims).flatMap(item => item.citations).find(item => item.source_sha256);
  citation.source_sha256 = '0'.repeat(64);
  assert.throws(() => validateGovernance(data), /Changed evidence requires review/);
});

test('governance rejects fabricated approval and unresolved review readiness', () => {
  const approved = structuredClone(load());
  approved.readiness.services[0].status = 'institutionally_approved';
  assert.throws(() => validateGovernance(approved), /Conflict cannot be review ready|Institutional approval fabricated/);
  const reviewReady = structuredClone(load());
  const conflicted = reviewReady.readiness.services.find(item => item.open_conflicts.length);
  conflicted.status = 'review_ready';
  assert.throws(() => validateGovernance(reviewReady), /Conflict cannot be review ready/);
});

test('governance rejects an unscoped current claim backed by a superseded source', () => {
  const data = structuredClone(load());
  data.sourceDecisions.decisions.find(item => item.source_id === 'certification-2024').classification = 'superseded';
  assert.throws(() => validateGovernance(data), /Superseded source supports unscoped current claim/);
});

test('year-bound registration circulars remain historical and isolated from future years', () => {
  const data = load();
  for (const id of ['kcse-2026', 'kpsea-2026', 'kjsea-2026']) {
    assert.equal(data.sourceDecisions.decisions.find(item => item.source_id === id).classification, 'historical');
  }
  const bank = require('../../evaluation/kb/questions.json');
  assert.ok(bank.cases.some(item => item.id === 'governance-kcse-year-boundary' && item.expected_action === 'clarify'));
  assert.ok(bank.cases.some(item => item.id === 'governance-expired-registration-evidence' && item.expected_action === 'clarify'));
});

test('certification range remains an open project-owner proposal with both source estimates', () => {
  const data = load();
  const conflict = data.conflicts.conflicts.find(item => item.id === 'certification-processing-time');
  assert.equal(conflict.status, 'open');
  assert.deepEqual(conflict.competing_claims.map(item => item.source_id).sort(), ['certification-2024', 'charter-2026']);
  assert.match(conflict.decision_history[0].proposal, /estimated range of 10–15 working days/i);
  assert.match(conflict.decision_history[0].institutional_status, /pending KNEC reviewer/i);
  assert.match(conflict.unresolved_question, /starts that estimate/i);
});

test('QMIS guide evidence is distinct from live applicability and account access', () => {
  const data = load();
  const article = data.articles.find(item => item.id === 'qmis-navigation');
  assert.equal(article.claims.length, 17);
  assert.ok(article.claims.every(claim => claim.evidence_status === 'supported' && claim.citations.length));
  assert.ok(article.claims.some(claim => claim.id === 'status-tracking' && /do not provide a complete glossary/i.test(claim.text)));
  assert.ok(article.unresolved_questions.some(item => /live QMIS portal/i.test(item)));
  assert.ok(article.unresolved_questions.some(item => /cannot access/i.test(item)));
  assert.ok(!data.conflicts.conflicts.some(item => item.id === 'qmis-current-workflow'));
  assert.equal(data.readiness.services.find(item => item.article_id === 'qmis-navigation').status, 'source_checked');
  assert.equal(data.sourceDecisions.content_use_decisions[0].authority, 'project_owner');
});

test('menu integrity remains 32 mappings with the comparison article internal and unmapped', () => {
  const data = load();
  const mappings = validateGovernance(data).mappings;
  assert.equal([...mappings.values()].flat().length, 32);
  assert.equal(mappings.has('reg-kpsea-kjsea'), false);
  assert.equal(data.articles.find(item => item.id === 'reg-kpsea-kjsea').visibility, 'internal');
  assert.equal(mappings.get('qmis-navigation').length, 1);
});
