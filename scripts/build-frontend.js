import { mkdir, copyFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const files = [
  'index.html',
  'src/frontend/main.js',
  'src/frontend/styles.css',
  'src/frontend/viewModel.js',
  'src/data/clips.js',
  'src/search/searchEngine.js',
  'src/audio/formatPolicy.js'
];

await rm('dist', { recursive: true, force: true });
for (const file of files) {
  const target = join('dist', file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(file, target);
}

console.log(`Built static frontend with ${files.length} files in dist/.`);
