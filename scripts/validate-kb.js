const fs = require('fs');
const path = require('path');

const kbDir = path.join(__dirname, '..', 'knowledge-base');

function validateDirectory(dir) {
  const items = fs.readdirSync(dir);
  let totalFiles = 0;

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      totalFiles += validateDirectory(fullPath);
    } else if (item.endsWith('.json')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      try {
        JSON.parse(content);
        console.log('? Valid JSON:', path.relative(kbDir, fullPath));
        totalFiles++;
      } catch (err) {
        console.error('? Invalid JSON in file:', fullPath);
        process.exit(1);
      }
    }
  }
  return totalFiles;
}

console.log('Validating Knowledge Base JSON files...');
const validatedCount = validateDirectory(kbDir);
console.log('Validation complete: ' + validatedCount + ' JSON files verified.');
