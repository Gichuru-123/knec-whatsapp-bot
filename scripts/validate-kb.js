'use strict';
const path = require('node:path');
const { loadCorpus } = require('../src/services/kbValidation');
try {
  const { articles, sources } = loadCorpus(path.join(__dirname, '..', 'knowledge-base'));
  console.log('KB structure and references passed: ' + articles.length + ' articles, ' + sources.length + ' sources.');
  console.log('Structural validation does not establish factual accuracy or institutional approval.');
} catch {
  console.error('KB validation failed. Check schemas, IDs, source references, dates and approval records.');
  process.exitCode = 1;
}
