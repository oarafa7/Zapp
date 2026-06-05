import { clipCatalog } from '../src/data/clips.js';
import { isSendableUnderPolicy } from '../src/audio/formatPolicy.js';

const ids = new Set();
const errors = [];

for (const clip of clipCatalog) {
  if (ids.has(clip.id)) errors.push(`duplicate clip id: ${clip.id}`);
  ids.add(clip.id);
  if (!clip.attribution?.includes('Zapp')) errors.push(`${clip.id} is missing Zapp attribution`);
  if (!clip.triggerTags?.length) errors.push(`${clip.id} is missing trigger tags`);
  if (!clip.characterTags?.length) errors.push(`${clip.id} is missing character/source tags`);
  if (!isSendableUnderPolicy(clip)) errors.push(`${clip.id} exceeds audio send policy`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Validated ${clipCatalog.length} Audio GIF catalog entries.`);
