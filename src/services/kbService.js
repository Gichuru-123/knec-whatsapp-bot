const fs = require('fs');
const path = require('path');

const kbDir = path.join(__dirname, '..', '..', 'knowledge-base');

function loadAllKBData() {
  const data = [];

  function readDirectory(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        readDirectory(fullPath);
      } else if (item.endsWith('.json')) {
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        data.push(JSON.parse(fileContent));
      }
    }
  }

  readDirectory(kbDir);
  return data;
}

function getServiceById(id) {
  const allData = loadAllKBData();
  return allData.find(item => item.id === id) || null;
}

module.exports = {
  loadAllKBData,
  getServiceById
};
