'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { loadCorpus } = require('../src/services/kbValidation');
const { MENU_TREE } = require('../src/services/conversation/config/menuTree');

const SOURCE_CLASSES = new Set(['current', 'historical', 'superseded', 'conflicting', 'discovery_only']);
const READINESS = new Set(['research_needed', 'source_checked', 'review_ready', 'institutionally_approved', 'retired']);
const SENSITIVE_KINDS = new Set(['fee', 'timeline']);

function menuMappings(node, result = new Map()) {
  if (node.type === 'knowledge_hook') {
    if (!result.has(node.action.articleId)) result.set(node.action.articleId, []);
    result.get(node.action.articleId).push(node.id);
  }
  for (const child of node.children || []) menuMappings(child, result);
  return result;
}

function nonEmptyStrings(value) {
  return Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim());
}

function formatScopeDimension(scope, key) {
  if (!Object.prototype.hasOwnProperty.call(scope, key)) return 'Not recorded';
  if (scope[key] === null) return 'Unspecified';
  if (!Array.isArray(scope[key])) return 'Invalid scope value';
  if (!scope[key].length) return 'No values recorded';
  if (scope[key].length === 1 && scope[key][0] === 'all') return 'Explicitly unrestricted (all)';
  return scope[key].join(', ');
}

function validateGovernance({ articles, sources, sourceDecisions, conflicts, readiness, packages, gaps }) {
  const articlesById = new Map(articles.map(article => [article.id, article]));
  const sourcesById = new Map(sources.map(source => [source.id, source]));
  const mappings = menuMappings(MENU_TREE);

  if (sourceDecisions.version !== '1.0.0' || sourceDecisions.decisions.length !== sources.length) throw new Error('Incomplete source decisions');
  if (new Set(sourceDecisions.decisions.map(item => item.source_id)).size !== sources.length) throw new Error('Duplicate source decision');
  if (!Array.isArray(sourceDecisions.content_use_decisions) || !sourceDecisions.content_use_decisions.some(item =>
    item.authority === 'project_owner' && /QMIS/i.test(item.subject) && /not constitute KNEC institutional publication approval/i.test(item.boundaries.join(' ')))) {
    throw new Error('Missing bounded QMIS content-use decision');
  }
  for (const item of sourceDecisions.decisions) {
    const source = sourcesById.get(item.source_id);
    if (!source || !SOURCE_CLASSES.has(item.classification) || item.url !== source.url || item.title !== source.title ||
        item.document_date !== source.document_date || item.inspected_on !== source.retrieved_on || item.sha256 !== source.sha256 ||
        item.local_filename !== source.local_filename || !nonEmptyStrings(item.applicable_services) ||
        (!item.applicable_services.length && item.classification !== 'discovery_only') ||
        !item.scope || !nonEmptyStrings(item.outstanding_verification_issues) || !Array.isArray(item.supersedes)) {
      throw new Error('Invalid source decision');
    }
    if (item.classification === 'discovery_only' && (item.sha256 !== null || item.local_filename !== null)) throw new Error('Discovery source claims evidence');
    for (const id of item.applicable_services) if (!articlesById.has(id)) throw new Error('Source decision references unknown service');
    const referenced = articles.filter(article => article.claims.some(claim => claim.citations.some(citation => citation.source_id === item.source_id))).map(article => article.id).sort();
    if (JSON.stringify([...item.applicable_services].sort()) !== JSON.stringify(referenced)) throw new Error('Source applicability is stale');
    for (const id of item.supersedes) if (!sourcesById.has(id) || id === item.source_id) throw new Error('Invalid supersession relationship');
  }

  if (conflicts.version !== '1.0.0' || !Array.isArray(conflicts.conflicts) || conflicts.conflicts.length < 1) throw new Error('Missing conflict register');
  const conflictIds = new Set();
  for (const conflict of conflicts.conflicts) {
    if (!conflict.id || conflictIds.has(conflict.id) || !['open', 'resolved'].includes(conflict.status) ||
        !nonEmptyStrings(conflict.article_ids) || !Array.isArray(conflict.competing_claims) || conflict.competing_claims.length < 2 ||
        !conflict.scope || !conflict.unresolved_question || !conflict.required_reviewer || !Array.isArray(conflict.decision_history)) {
      throw new Error('Invalid conflict record');
    }
    conflictIds.add(conflict.id);
    for (const id of conflict.article_ids) if (!articlesById.has(id)) throw new Error('Conflict references unknown article');
    for (const claim of conflict.competing_claims) {
      if (!sourcesById.has(claim.source_id) || !claim.locator || !claim.claim) throw new Error('Invalid competing claim');
    }
    if (conflict.status === 'resolved' && !conflict.decision_history.length) throw new Error('Resolved conflict lacks accountable decision');
  }

  if (readiness.version !== '1.0.0' || readiness.services.length !== articles.length) throw new Error('Incomplete readiness inventory');
  if (new Set(readiness.services.map(item => item.article_id)).size !== articles.length) throw new Error('Duplicate readiness service');
  for (const item of readiness.services) {
    const article = articlesById.get(item.article_id);
    if (!article || item.service_name !== article.title || !READINESS.has(item.status) || !Array.isArray(item.menu_mapping) ||
        JSON.stringify(item.menu_mapping.sort()) !== JSON.stringify([...(mappings.get(item.article_id) || [])].sort()) ||
        JSON.stringify(item.applicable_scope) !== JSON.stringify(article.scope) || !item.evidence_coverage ||
        !nonEmptyStrings(item.missing_requirements) || !nonEmptyStrings(item.missing_procedural_steps) ||
        !nonEmptyStrings(item.missing_fees) || !nonEmptyStrings(item.missing_timelines) ||
        !nonEmptyStrings(item.missing_exceptions) || !Array.isArray(item.open_conflicts) || !item.pii_boundary ||
        !item.required_reviewer || !nonEmptyStrings(item.approval_dependencies)) throw new Error('Invalid service readiness record');
    for (const id of item.open_conflicts) if (!conflictIds.has(id)) throw new Error('Unknown readiness conflict');
    if (item.open_conflicts.length && ['review_ready', 'institutionally_approved'].includes(item.status)) throw new Error('Conflict cannot be review ready');
    if (item.status === 'institutionally_approved' && article.status !== 'approved') throw new Error('Institutional approval fabricated');
    if (item.evidence_coverage.claim_count !== article.claims.length ||
        item.evidence_coverage.supported_claims !== article.claims.filter(c => c.evidence_status === 'supported').length) throw new Error('Stale evidence coverage');
  }

  for (const [articleId] of mappings) if (!articlesById.has(articleId)) throw new Error('Menu hook has no article');
  for (const article of articles) {
    for (const claim of article.claims) {
      if (!claim.citations.length) throw new Error('Factual claim lacks evidence');
      for (const citation of claim.citations) {
        const source = sourcesById.get(citation.source_id);
        const decision = sourceDecisions.decisions.find(item => item.source_id === citation.source_id);
        if (!source || citation.source_sha256 !== source.sha256 || !decision) throw new Error('Changed evidence requires review');
        if (decision.classification === 'superseded' && !article.scope.years.some(year => year !== 'all' && source.document_date?.startsWith(year))) {
          throw new Error('Superseded source supports unscoped current claim');
        }
      }
      if (SENSITIVE_KINDS.has(claim.kind) && !article.scope) throw new Error('Sensitive claim lacks scope');
    }
    if (article.status !== 'approved' && article.approval !== null) throw new Error('Draft article carries approval');
  }

  if (packages.version !== '1.0.0' || packages.packages.length !== 8) throw new Error('Priority 1 package count mismatch');
  for (const item of packages.packages) {
    const article = articlesById.get(item.article_id);
    if (!article || !item.service_summary || !nonEmptyStrings(item.source_ids) ||
        !Array.isArray(item.supported_claims) || !nonEmptyStrings(item.review_gaps) || !item.reviewer_brief || item.publication_authorized !== false) {
      throw new Error('Invalid factual review package');
    }
    const expectedClaims = article.claims.filter(claim => claim.evidence_status === 'supported').map(claim => `${article.id}:${claim.id}`).sort();
    const expectedSources = [...new Set(article.claims.flatMap(claim => claim.citations.map(citation => citation.source_id)))].sort();
    const expectedConflicts = conflicts.conflicts.filter(conflict => conflict.article_ids.includes(article.id) && conflict.status === 'open').map(conflict => conflict.id).sort();
    if (JSON.stringify(item.applicable_scope) !== JSON.stringify(article.scope) ||
        JSON.stringify([...item.supported_claims].sort()) !== JSON.stringify(expectedClaims) ||
        JSON.stringify([...item.source_ids].sort()) !== JSON.stringify(expectedSources) ||
        JSON.stringify([...item.open_conflicts].sort()) !== JSON.stringify(expectedConflicts)) throw new Error('Stale factual review package');
    for (const id of item.source_ids) if (!sourcesById.has(id)) throw new Error('Package source missing');
  }
  if (gaps.version !== '1.0.0' || gaps.assessments.length !== 6) throw new Error('Priority 2 gap count mismatch');
  for (const item of gaps.assessments) {
    if (!articlesById.has(item.article_id) || !nonEmptyStrings(item.verified_evidence) || !nonEmptyStrings(item.missing_evidence) ||
        !nonEmptyStrings(item.scope_required) || !item.safe_current_response) throw new Error('Invalid evidence gap assessment');
  }
  return { mappings };
}

function report(data) {
  validateGovernance(data);
  const counts = Object.fromEntries([...READINESS].map(status => [status, data.readiness.services.filter(item => item.status === status).length]));
  const lines = ['# KB governance readiness report', '', 'Generated by `npm run kb:governance -- --write`. Editorial readiness does not grant runtime or institutional approval.', '',
    `Baseline: ${data.articles.length} articles, ${data.sources.length} sources, ${data.conflicts.conflicts.length} recorded conflicts.`, '',
    '## Readiness distribution', '', ...Object.entries(counts).map(([key, value]) => `- ${key}: ${value}`), '',
    '## Source decisions', '', '| Source | Classification | Services | Outstanding verification |', '| --- | --- | ---: | --- |'];
  for (const item of data.sourceDecisions.decisions) lines.push(`| ${item.source_id} | ${item.classification} | ${item.applicable_services.length} | ${item.outstanding_verification_issues.join('; ')} |`);
  lines.push('', '## Service readiness', '', '| Article | Status | Claims | Menu mappings | Open conflicts |', '| --- | --- | ---: | ---: | ---: |');
  for (const item of data.readiness.services) lines.push(`| ${item.article_id} | ${item.status} | ${item.evidence_coverage.claim_count} | ${item.menu_mapping.length} | ${item.open_conflicts.length} |`);
  lines.push('', '## Open conflicts', '');
  for (const item of data.conflicts.conflicts.filter(conflict => conflict.status === 'open')) lines.push(`- **${item.id}:** ${item.unresolved_question}`);
  lines.push('', '## Priority 1 review packages', '', ...data.packages.packages.map(item => `- ${item.article_id}: ${item.review_gaps.length} review gaps; publication remains blocked.`), '',
    '## Priority 2 evidence gaps', '', ...data.gaps.assessments.map(item => `- ${item.article_id}: ${item.missing_evidence.join('; ')}`), '',
    '## Approval boundary', '', 'No record in this report overrides article status, approval metadata, the approved-answer policy, or institutional review. No candidate personal information is required or stored by these governance records.', '');
  return lines.join('\n');
}

function reviewPackageReport(item, data) {
  const article = data.articles.find(value => value.id === item.article_id);
  const sources = new Map(data.sources.map(value => [value.id, value]));
  const conflicts = data.conflicts.conflicts.filter(value => value.article_ids.includes(item.article_id));
  const lines = [`# Factual review package: ${article.title}`, '',
    `Article ID: \`${article.id}\`. Editorial status: \`${article.status}\`. Publication authorized: **no**.`, '',
    '## Service and scope', '', item.service_summary, '', `- Examinations: ${formatScopeDimension(article.scope, 'examinations')}`, `- Audiences: ${formatScopeDimension(article.scope, 'audiences')}`,
    `- Years: ${formatScopeDimension(article.scope, 'years')}`, `- Programmes: ${formatScopeDimension(article.scope, 'programmes')}`, `- Series: ${formatScopeDimension(article.scope, 'series')}`, '',
    '## Inspected sources', ''];
  for (const id of item.source_ids) {
    const source = sources.get(id);
    lines.push(`- **${id}:** ${source.title} — ${source.url} (SHA-256: \`${source.sha256 || 'not captured; discovery only'}\`)`);
  }
  lines.push('', '## Evidence-backed and unresolved service information', '');
  for (const claim of article.claims) {
    const citations = claim.citations.map(value => `${value.source_id} (${value.locator})`).join('; ');
    lines.push(`### ${claim.kind}: ${article.id}:${claim.id}`, '', claim.text, '', `- Evidence status: \`${claim.evidence_status}\``, `- Sources: ${citations}`, '');
  }
  const procedure = data.procedures.procedures.find(value => value.id === item.article_id);
  lines.push('## Documented draft procedure', '');
  if (procedure) {
    lines.push('Clarifying questions:', '', ...procedure.clarifying_questions.map(value => `- ${value}`), '');
    for (const step of procedure.steps) lines.push(`- **${step.id}:** ${step.prompt} Evidence: ${step.claim_refs.join(', ')}${step.review_gate ? ` Review gate: ${step.review_gate}` : ''}`);
    lines.push('', `Completion boundary: ${procedure.completion}`, '');
  } else lines.push('No governed procedure plan exists; no procedure may be invented.', '');
  lines.push('', '## Open review gaps', '', ...item.review_gaps.map(value => `- ${value}`), '', '## Recorded conflicts', '');
  if (conflicts.length) for (const conflict of conflicts) lines.push(`- **${conflict.id}:** ${conflict.unresolved_question}`);
  else lines.push('- No contradiction is recorded, but current applicability and completeness still require review.');
  lines.push('', '## Reviewer decision required', '', item.reviewer_brief, '',
    'The reviewer must record their accountable role, exact accepted wording, scope, effective date, source/decision reference and any superseded wording. Project-owner permission to use a source is not KNEC institutional publication approval.', '',
    '## Safety boundary', '', 'Do not add candidate names, index numbers, identity documents, credentials or individual case records. This package is an editorial review aid and cannot activate a runtime answer.', '');
  return lines.join('\n');
}

function evidenceGapReport(data) {
  const lines = ['# Priority 2 evidence-gap register', '', 'These services remain research-only. The safe response is retained until authoritative, scoped evidence is inspected and approved.', ''];
  for (const item of data.gaps.assessments) {
    lines.push(`## ${item.article_id}`, '', '**Verified evidence currently available**', '', ...item.verified_evidence.map(value => `- ${value}`), '',
      '**Missing authoritative evidence and required official documents**', '', ...item.missing_evidence.map(value => `- ${value}`), '',
      '**Relevant or conflicting source records**', '', ...item.conflicting_source_ids.map(value => `- ${value}`), '', '**Required scope**', '',
      ...item.scope_required.map(value => `- ${value}`), '', '**KNEC confirmation required**', '',
      '- An accountable service owner must confirm the current procedure, applicable evidence, scope, fees, timelines, exceptions and controlling source version.',
      '- Any contradiction must be resolved with an effective date and supersession record; absence of evidence must not be converted into a procedure.', '',
      `**Safe current response:** ${item.safe_current_response}`, '');
  }
  return lines.join('\n');
}

function load(root = path.join(__dirname, '..')) {
  const { articles, sources } = loadCorpus(path.join(root, 'knowledge-base'));
  const read = name => JSON.parse(fs.readFileSync(path.join(root, 'evaluation/kb', name), 'utf8'));
  return { articles, sources, sourceDecisions: read('source-decisions.json'), conflicts: read('conflicts.json'),
    readiness: read('service-readiness.json'), packages: read('review-packages.json'), gaps: read('evidence-gaps.json'), procedures: read('procedures.json') };
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const data = load(root);
  const output = report(data);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(root, 'docs/kb-readiness-report.md'), output);
    const packageDir = path.join(root, 'docs/kb-review-packages');
    fs.mkdirSync(packageDir, { recursive: true });
    for (const item of data.packages.packages) fs.writeFileSync(path.join(packageDir, `${item.article_id}.md`), reviewPackageReport(item, data));
    fs.writeFileSync(path.join(root, 'docs/kb-priority2-evidence-gaps.md'), evidenceGapReport(data));
  }
  console.log(output);
}
module.exports = { evidenceGapReport, formatScopeDimension, load, menuMappings, report, reviewPackageReport, validateGovernance };
