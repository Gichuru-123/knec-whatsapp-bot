const fs = require('fs');
const path = require('path');

const kbDir = path.join(__dirname, '..', 'knowledge-base');

const REQUIRED_FIELDS = [
  'id',
  'category',
  'title',
  'source_url',
  'source_date',
  'status',
  'verification_status',
  'version'
];

function validateDirectory(dir) {
  const items = fs.readdirSync(dir);
  let totalFiles = 0;

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (item === 'schema') continue;
      totalFiles += validateDirectory(fullPath);
    } else if (item.endsWith('.json')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      try {
        const parsed = JSON.parse(content);
        
        for (const field of REQUIRED_FIELDS) {
          if (!parsed[field]) {
            console.error('? Schema Error in ' + path.relative(kbDir, fullPath) + ': Missing field "' + field + '"');
            process.exit(1);
          }
        }

        console.log('? Schema Verified:', path.relative(kbDir, fullPath));
        totalFiles++;
      } catch (err) {
        console.error('? Invalid JSON in file:', fullPath, err.message);
        process.exit(1);
      }
    }
  }
  return totalFiles;
}

console.log('Validating Knowledge Base JSON files against Schema requirements...');
const validatedCount = validateDirectory(kbDir);
console.log('Validation complete: ' + validatedCount + ' JSON files fully verified.');
