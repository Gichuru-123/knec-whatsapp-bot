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
            if (parsed && parsed.id) {
              this.kbIndex.set(parsed.id, deepFreeze(parsed));
            }
          } catch (err) {
            logger.error(`Failed to load KB file: ${fullPath}`, err);
          }
        }
      }
    };

    readDirectory(kbDir);
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
