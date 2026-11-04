const { loadCorpus } = require('../services/kbValidation');
const path = require('path');
const logger = require('../logger');

const kbDir = path.join(__dirname, '..', '..', 'knowledge-base');

function deepFreeze(obj) {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach(prop => {
    if (
      obj[prop] !== null &&
      (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') &&
      !Object.isFrozen(obj[prop])
    ) {
      deepFreeze(obj[prop]);
    }
  });
  return obj;
}

class KBRepository {
  constructor(directory = kbDir) {
    this.directory = directory;
    this.sources = [];
    this.kbIndex = new Map();
    this.isLoaded = false;
  }

  loadKBData() {
    this.isLoaded = false;
    this.kbIndex.clear();
    this.sources = [];
    try {
      const corpus = loadCorpus(this.directory);
      for (const article of corpus.articles) this.kbIndex.set(article.id, deepFreeze(article));
      this.sources = deepFreeze(corpus.sources);
    } catch {
      throw new Error('KB integrity failure: schema, references or approval records are invalid.');
    }

    this.isLoaded = true;
    logger.info(`KBRepository successfully indexed ${this.kbIndex.size} articles.`);
    return this.kbIndex.size;
  }

  getSources() {
    if (!this.isLoaded) this.loadKBData();
    return this.sources;
  }

  findAll() {
    if (!this.isLoaded) this.loadKBData();
    return Array.from(this.kbIndex.values());
  }

  findById(id) {
    if (!this.isLoaded) this.loadKBData();
    return this.kbIndex.get(id) || null;
  }

  findByCategory(category) {
    if (!this.isLoaded) this.loadKBData();
    return Array.from(this.kbIndex.values()).filter(item => item.category === category);
  }
}

module.exports = new KBRepository();

module.exports.KBRepository = KBRepository;
