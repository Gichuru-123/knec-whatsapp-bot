const fs = require('fs');
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
  constructor() {
    this.kbIndex = new Map();
    this.isLoaded = false;
  }

  loadKBData() {
    this.kbIndex.clear();
    
    const readDirectory = (dir) => {
      if (!fs.existsSync(dir)) {
        throw new Error(`Critical KB Startup Error: Knowledge base directory missing at '${dir}'`);
      }

      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          if (item === 'schema') continue;
          readDirectory(fullPath);
        } else if (item.endsWith('.json')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const parsed = JSON.parse(content);
            if (!parsed || !parsed.id || !parsed.title || !parsed.category) {
              throw new Error(`Missing required KB top-level fields (id, title, category) in '${fullPath}'`);
            }
            if (this.kbIndex.has(parsed.id)) {
              throw new Error(`Duplicate KB Article ID '${parsed.id}' detected in '${fullPath}'`);
            }
            this.kbIndex.set(parsed.id, deepFreeze(parsed));
          } catch (err) {
            logger.error(`Fail-Fast KB Startup Error: Failed to load article at '${fullPath}'`, err);
            throw new Error(`KB Integrity Failure: Could not safely load '${fullPath}'. System startup aborted.`);
          }
        }
      }
    };

    readDirectory(kbDir);
    if (this.kbIndex.size === 0) {
      throw new Error(`Fail-Fast KB Startup Error: No valid Knowledge Base articles were found in '${kbDir}'.`);
    }

    this.isLoaded = true;
    logger.info(`KBRepository successfully indexed ${this.kbIndex.size} articles.`);
    return this.kbIndex.size;
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
