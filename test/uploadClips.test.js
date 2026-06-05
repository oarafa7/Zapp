import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequestHandler } from '../scripts/static-server.js';
import { addUploadedClip, listUploadedClips, resolveUploadPath, extensionForFileName } from '../scripts/clipStore.js';

test('detects audio type from filename when content-type is missing (iOS)', async () => {
  assert.equal(extensionForFileName('song.mp3'), '.mp3');
  assert.equal(extensionForFileName('clip.AAC'), '.m4a');
  assert.equal(extensionForFileName(null), null);
  assert.equal(extensionForFileName('notes.txt'), null);

  const dataDir = await mkdtemp(join(tmpdir(), 'zapp-data-'));
  try {
    const clip = await addUploadedClip(dataDir, {
      title: 'iPhone Clip',
      triggers: 'hype',
      contentType: 'application/octet-stream', // iOS often sends this or empty
      fileName: 'whatsapp-voice.mp3',
      buffer: Buffer.from('fake-mp3-bytes')
    });
    assert.match(clip.audioUrl, /\.mp3$/);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('clip store persists uploaded clips and rejects bad input', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'zapp-data-'));
  try {
    const clip = await addUploadedClip(dataDir, {
      title: 'My Victory Horn',
      triggers: 'win, hype',
      locale: 'en',
      contentType: 'audio/wav',
      buffer: Buffer.from('RIFFsome-fake-wav-bytes')
    });
    assert.match(clip.id, /^upload-my-victory-horn-/);
    assert.deepEqual(clip.triggerTags, ['win', 'hype']);
    assert.equal(clip.attribution, 'Sent via Zapp');
    assert.match(clip.audioUrl, /^\/uploads\/audio\//);

    const stored = await listUploadedClips(dataDir);
    assert.equal(stored.length, 1);
    assert.equal(stored[0].title, 'My Victory Horn');

    await assert.rejects(
      addUploadedClip(dataDir, { title: '', triggers: 'x', contentType: 'audio/wav', buffer: Buffer.from('x') }),
      /title is required/
    );
    await assert.rejects(
      addUploadedClip(dataDir, { title: 'No type', triggers: 'x', contentType: 'text/plain', buffer: Buffer.from('x') }),
      /Unsupported audio type/
    );
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('upload path resolver blocks traversal', () => {
  const dataDir = '/tmp/zapp-data';
  assert.ok(resolveUploadPath(dataDir, '/uploads/audio/clip.wav'));
  assert.equal(resolveUploadPath(dataDir, '/uploads/audio/../../etc/passwd'), null);
  assert.equal(resolveUploadPath(dataDir, '/uploads/audio/'), null);
});

test('upload API round-trips a clip through HTTP', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'zapp-data-'));
  const rootDir = await mkdtemp(join(tmpdir(), 'zapp-root-'));
  const server = createServer(createRequestHandler({ rootDirectory: rootDir, dataDirectory: dataDir }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    const empty = await (await fetch(`${base}/api/clips`)).json();
    assert.deepEqual(empty.clips, []);

    const upload = await fetch(`${base}/api/clips?title=Losing+Horn&triggers=cringe,fail`, {
      method: 'POST',
      headers: { 'content-type': 'audio/wav' },
      body: Buffer.from('RIFFaudio-bytes-here')
    });
    assert.equal(upload.status, 201);
    const { clip } = await upload.json();
    assert.equal(clip.title, 'Losing Horn');

    const listed = await (await fetch(`${base}/api/clips`)).json();
    assert.equal(listed.clips.length, 1);

    const audio = await fetch(`${base}${clip.audioUrl}`);
    assert.equal(audio.status, 200);
    assert.equal(audio.headers.get('content-type'), 'audio/wav');

    const rejected = await fetch(`${base}/api/clips?title=Bad`, {
      method: 'POST',
      headers: { 'content-type': 'audio/wav' },
      body: Buffer.from('x')
    });
    assert.equal(rejected.status, 400); // missing trigger tags
  } finally {
    server.close();
    await once(server, 'close');
    await rm(dataDir, { recursive: true, force: true });
    await rm(rootDir, { recursive: true, force: true });
  }
});
