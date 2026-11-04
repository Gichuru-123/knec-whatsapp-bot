'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, strict: true });

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
ajv.addFormat('calendar-date', isDate);
ajv.addFormat('official-url', value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (url.hostname === 'knec.ac.ke' || url.hostname.endsWith('.knec.ac.ke'));
  } catch { return false; }
});
const validateArticle = ajv.compile(require('../../knowledge-base/schema/article.schema.json'));
const validateSources = ajv.compile(require('../../knowledge-base/schema/sources.schema.json'));

// Stable key ordering binds an approval to the entire article except approval itself.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}
function contentHash(article) {
  const copy = { ...article };
  delete copy.approval;
  return crypto.createHash('sha256').update(JSON.stringify(canonical(copy))).digest('hex');
}
function unique(items, label) {
  if (new Set(items).size !== items.length) throw new Error('Duplicate ' + label);
}
function fail(message) { throw new Error(message); }

function validateCorpus(articles, sources) {
  if (!validateSources(sources)) fail('Invalid KB source catalog structure');
  if (!Array.isArray(articles) || !articles.length) fail('Empty KB corpus');
  unique(sources.map(s => s.id), 'source ID');
  const sourceMap = new Map(sources.map(s => [s.id, s]));
  for (const source of sources) {
    if (source.review_due < source.retrieved_on) fail('Source review date precedes retrieval');
    if (source.review_status === 'inspected' && !source.sha256) fail('Inspected source requires a hash');
  }
  const ids = [];
  for (const article of articles) {
    if (!validateArticle(article)) fail('Invalid KB article structure');
    ids.push(article.id);
    for (const series of article.scope.series || []) {
      if (!article.scope.years.includes(series.slice(0, 4))) fail('Series examination year is outside article scope');
    }
    unique(article.claims.map(c => c.id), 'claim ID');
    if (article.effective_from && article.effective_to && article.effective_to < article.effective_from) fail('Invalid effective interval');
    for (const claim of article.claims) {
      for (const citation of claim.citations) {
        if (!sourceMap.has(citation.source_id)) fail('Unknown source reference');
        if (citation.source_sha256 !== sourceMap.get(citation.source_id).sha256) fail('Source revision mismatch');
      }
    }
    if (article.status === 'approved') {
      if (article.verification_status !== 'verified' || !article.approval || !article.effective_from ||
          !article.claims.length || article.unresolved_questions.length) fail('Incomplete article approval');
      if (article.approval.content_sha256 !== contentHash(article)) fail('Article changed after approval');
      if (article.review_due < article.approval.approved_on) fail('Review date precedes approval');
      for (const claim of article.claims) {
        if (claim.evidence_status !== 'supported') fail('Unresolved approved claim');
        for (const citation of claim.citations) {
          if (sourceMap.get(citation.source_id).review_status !== 'inspected') fail('Uninspected approved source');
        }
      }
    }
  }
  unique(ids, 'article ID');
  return { articles, sources };
}
function loadCorpus(directory) {
  const sources = JSON.parse(fs.readFileSync(path.join(directory, 'sources', 'catalog.json'), 'utf8'));
  const articles = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (dir === directory && ['schema', 'sources'].includes(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) fail('KB symbolic links are not supported');
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.json')) articles.push(JSON.parse(fs.readFileSync(file, 'utf8')));
    }
  }
  walk(directory);
  return validateCorpus(articles, sources);
}
module.exports = { isDate, contentHash, validateCorpus, loadCorpus };
