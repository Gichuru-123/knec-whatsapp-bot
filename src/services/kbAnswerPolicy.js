'use strict';
const { isDate, validateCorpus } = require('./kbValidation');

// Internal boundary for future menu/retrieval callers, not a public HTTP route.
function selectApprovedAnswer(article, sources, context, today = new Date().toISOString().slice(0, 10)) {
  if (!article || !context || !isDate(today)) return null;
  try { validateCorpus([article], sources); } catch { return null; }
  if (article.status !== 'approved' || article.visibility !== 'public' ||
      article.approval.approved_on > today || article.effective_from > today ||
      (article.effective_to && article.effective_to < today) || article.review_due < today) return null;
  if (context.language !== article.language) return null;
  if (article.scope.programmes && !article.scope.programmes.includes(context.programme)) return null;
  if (article.scope.series && (!article.scope.series.includes(context.series) ||
      context.year !== context.series.slice(0, 4))) return null;
  for (const [field, input] of [['examinations', 'examination'], ['audiences', 'audience'], ['years', 'year']]) {
    if (typeof context[input] !== 'string' || !context[input].trim()) return null;
    if (!article.scope[field].includes('all') && !article.scope[field].includes(context[input])) return null;
  }
  const sourceMap = new Map(sources.map(source => [source.id, source]));
  const claims = [];
  for (const claim of article.claims) {
    const citations = [];
    for (const reference of claim.citations) {
      const source = sourceMap.get(reference.source_id);
      if (source.review_due < today || source.retrieved_on > today ||
          (source.document_date && source.document_date > today)) return null;
      citations.push({ source_id: source.id, title: source.title, url: source.url,
        locator: reference.locator, sha256: source.sha256 });
    }
    claims.push({ id: claim.id, kind: claim.kind, text: claim.text, citations });
  }
  return { id: article.id, service_id: article.service_id, title: article.title,
    language: article.language, version: article.version, claims };
}
module.exports = { selectApprovedAnswer };
