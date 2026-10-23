'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const realRoot = fs.realpathSync(root);

function main() {
  // Include tracked files even if ignored, plus new files eligible for Git.
  // NUL separators preserve spaces and unusual characters in filenames.
  const inventory = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true
  });
  if (inventory.error || inventory.status !== 0) {
    throw new Error('Cannot enumerate repository files. Run this check in a Git checkout with Git installed.');
  }

  const files = [];
  for (const file of new Set(inventory.stdout.split('\0').filter(Boolean))) {
    const absolute = path.resolve(root, file);
    const relative = path.relative(root, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('The Git inventory contains a path outside this repository.');
    }
    // Do not let private environment files become accepted by a pattern-only scanner.
    const name = path.basename(file);
    if (name === '.env' || (name.startsWith('.env.') && name !== '.env.example')) {
      throw new Error('A private environment filename is tracked. Remove it from the proposed commit and assess credential exposure.');
    }
    if (file.split('/').some(part => part === 'node_modules' || part === '.git')) {
      throw new Error('Generated dependencies or Git internals are tracked. Review the repository inventory.');
    }
    let stat;
    try {
      stat = fs.lstatSync(absolute);
    } catch (error) {
      if (error.code === 'ENOENT') continue; // Deleted working-tree file; see the documented index limitation.
      // eslint-disable-next-line preserve-caught-error -- File-system details are not needed in shared scanner logs.
      throw new Error('Cannot read a repository file for secret scanning.');
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error('Secret scanning requires regular files; review symlinks or submodules before proceeding.');
    }
    const realRelative = path.relative(realRoot, fs.realpathSync(absolute));
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      throw new Error('A repository path resolves outside this checkout.');
    }
    files.push(file);
  }
  if (files.length === 0) throw new Error('No repository files were selected; refusing an empty scan.');

  const cli = path.join(root, 'node_modules', 'secretlint', 'bin', 'secretlint.js');
  if (!fs.existsSync(cli)) throw new Error('Secretlint is missing. Install the locked development dependencies with npm ci.');

  // Secretlint's file walker excludes its own configuration. Scan those files through stdin too.
  const configurationFiles = files.filter(file => /^\.secretlint(?:rc|ignore)/.test(path.basename(file)));
  const regularFiles = files.filter(file => !configurationFiles.includes(file));
  for (const file of configurationFiles) {
    const result = spawnSync(process.execPath, [
      cli, '--secretlintrc', path.join(root, '.secretlintrc.json'),
      '--stdinFileName', file, '--no-color', '--no-terminalLink'
    ], {
      cwd: root,
      input: fs.readFileSync(path.join(root, file)),
      stdio: ['pipe', 'inherit', 'inherit'],
      windowsHide: true
    });
    if (result.error || result.status === null) throw new Error('Secretlint could not finish scanning its configuration.');
    if (result.status !== 0) return result.status;
  }

  // Small batches stay below Windows command-line limits. No shell expansion or npx downloads.
  for (let offset = 0; offset < regularFiles.length; offset += 20) {
    const result = spawnSync(process.execPath, [
      cli, '--secretlintrc', path.join(root, '.secretlintrc.json'),
      '--no-gitignore', '--no-glob', '--no-color', '--no-terminalLink',
      ...regularFiles.slice(offset, offset + 20).map(file => `./${file}`)
    ], { cwd: root, stdio: 'inherit', windowsHide: true });
    if (result.error || result.status === null) throw new Error('Secretlint could not finish scanning.');
    if (result.status !== 0) return result.status;
  }
  console.log(`Secret scan passed for ${files.length} selected working-tree files (not Git history or staged snapshots).`);
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
