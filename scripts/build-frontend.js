import { mkdir, copyFile, rm, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { generateAudio } from './generate-audio.js';

const files = [
  'index.html',
  'manifest.webmanifest',
  'assets/icon.svg',
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

// Audio clips are generated deterministically so the deployed bundle is always
// playable/shareable even if the committed assets are missing or stale.
const audioDir = join('dist', 'assets', 'audio');
await generateAudio(audioDir);
const audioFiles = await readdir(audioDir);

// A tiny build manifest helps verify a deploy actually shipped the audio.
await writeFile(
  join('dist', 'build-info.json'),
  JSON.stringify({ builtAt: new Date().toISOString(), audioClips: audioFiles.length }, null, 2)
);

console.log(
  `Built static frontend with ${files.length} files and ${audioFiles.length} audio clips in dist/.`
);
