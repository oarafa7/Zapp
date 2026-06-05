import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

// Persists user-uploaded Audio GIFs to a writable data directory. On Railway
// this directory should be a mounted Volume (see docs/railway-deploy.md) so
// clips survive restarts and redeploys; locally it defaults to ./data.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB ceiling per clip

const CONTENT_TYPE_EXTENSIONS = {
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/ogg': '.ogg',
  'audio/opus': '.ogg',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.m4a',
  'audio/webm': '.webm'
};

export function resolveDataDir(dataDirectory) {
  return resolve(dataDirectory || process.env.ZAPP_DATA_DIR || 'data');
}

export function extensionForContentType(contentType = '') {
  return CONTENT_TYPE_EXTENSIONS[contentType.split(';')[0].trim().toLowerCase()] || null;
}

function slugify(value, fallback = 'clip') {
  const slug = String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

// Best-effort clip length so previews and the send-policy size estimate stay
// truthful. WAV headers give an exact answer; other formats fall back to a
// rough bitrate estimate.
function estimateDurationMs(buffer, ext) {
  if (ext === '.wav' && buffer.length > 44 && buffer.toString('ascii', 0, 4) === 'RIFF') {
    const byteRate = buffer.readUInt32LE(28);
    if (byteRate > 0) return Math.round((buffer.length - 44) / byteRate * 1000);
  }
  const assumedBytesPerMs = 128_000 / 8 / 1000; // ~128 kbps
  return Math.round(buffer.length / assumedBytesPerMs);
}

async function readCatalog(dataDir) {
  const file = join(dataDir, 'clips.json');
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listUploadedClips(dataDirectory) {
  return readCatalog(resolveDataDir(dataDirectory));
}

export async function addUploadedClip(dataDirectory, { title, triggers, locale, icon, contentType, buffer }) {
  const dataDir = resolveDataDir(dataDirectory);
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) throw new ClipUploadError('A clip title is required.', 400);

  const ext = extensionForContentType(contentType);
  if (!ext) throw new ClipUploadError(`Unsupported audio type: ${contentType || 'unknown'}`, 415);
  if (!buffer?.length) throw new ClipUploadError('The uploaded audio file is empty.', 400);
  if (buffer.length > MAX_UPLOAD_BYTES) throw new ClipUploadError('Audio file exceeds the 5 MB limit.', 413);

  const triggerTags = String(triggers || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (!triggerTags.length) throw new ClipUploadError('At least one trigger tag is required.', 400);

  await mkdir(join(dataDir, 'audio'), { recursive: true });

  const id = `upload-${slugify(cleanTitle)}-${Date.now().toString(36)}`;
  const fileName = `${id}${ext}`;
  await writeFile(join(dataDir, 'audio', fileName), buffer);

  const clip = {
    id,
    title: cleanTitle,
    source: 'Community Upload',
    archive: 'My Library',
    locale: locale || 'en',
    durationMs: estimateDurationMs(buffer, ext),
    triggerTags,
    characterTags: ['upload'],
    icon: icon || '🔊',
    artworkCue: 'uploaded clip',
    audioUrl: `/uploads/audio/${fileName}`,
    previewUrl: `/uploads/audio/${fileName}`,
    attribution: 'Sent via Zapp',
    rightsStatus: 'user-upload',
    popularity: 80,
    seasonalBoosts: [],
    sizeBytes: buffer.length,
    uploadedAt: new Date().toISOString()
  };

  const catalog = await readCatalog(dataDir);
  catalog.push(clip);
  await writeFile(join(dataDir, 'clips.json'), JSON.stringify(catalog, null, 2));
  return clip;
}

// Resolves a public /uploads/audio/<file> request to a path inside the data
// directory, refusing anything that escapes the audio folder.
export function resolveUploadPath(dataDirectory, requestPath) {
  const fileName = basename(requestPath);
  if (!fileName || fileName !== requestPath.replace(/^\/?uploads\/audio\//, '')) return null;
  if (!extname(fileName)) return null;
  const dataDir = resolveDataDir(dataDirectory);
  const audioDir = resolve(join(dataDir, 'audio'));
  const candidate = resolve(join(audioDir, fileName));
  if (candidate !== audioDir && !candidate.startsWith(audioDir + '/')) return null;
  return candidate;
}

export class ClipUploadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ClipUploadError';
    this.status = status;
  }
}
