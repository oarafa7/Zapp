import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addClipFromUrl, isPrivateIp, listUploadedClips } from '../scripts/clipStore.js';

test('isPrivateIp flags loopback, private, and metadata addresses', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.5', '172.16.9.9', '169.254.169.254', '::1', 'fe80::1']) {
    assert.equal(isPrivateIp(ip), true, `${ip} should be private`);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34']) {
    assert.equal(isPrivateIp(ip), false, `${ip} should be public`);
  }
});

test('addClipFromUrl rejects non-http and private URLs', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'zapp-url-'));
  try {
    await assert.rejects(
      addClipFromUrl(dataDir, { title: 'x', triggers: 'y', sourceUrl: 'ftp://example.com/a.mp3' }),
      /http\(s\)/
    );
    await assert.rejects(
      addClipFromUrl(dataDir, { title: 'x', triggers: 'y', sourceUrl: 'not a url' }),
      /valid URL/
    );
    // Private address blocked by the SSRF guard (no ZAPP_ALLOW_PRIVATE_FETCH).
    await assert.rejects(
      addClipFromUrl(dataDir, { title: 'x', triggers: 'y', sourceUrl: 'http://127.0.0.1/a.mp3' }),
      /not allowed/
    );
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('addClipFromUrl imports audio via injected fetch', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'zapp-url-'));
  process.env.ZAPP_ALLOW_PRIVATE_FETCH = '1';
  const fakeFetch = async () => ({
    ok: true,
    headers: { get: (k) => ({ 'content-type': 'audio/mpeg', 'content-length': '12' })[k.toLowerCase()] },
    arrayBuffer: async () => Buffer.from('fake-mp3-data').buffer
  });
  try {
    const clip = await addClipFromUrl(
      dataDir,
      { title: 'Imported Horn', triggers: 'win', sourceUrl: 'https://cdn.example.com/horn.mp3' },
      { fetchImpl: fakeFetch }
    );
    assert.equal(clip.source, 'Imported link');
    assert.match(clip.audioUrl, /\.mp3$/);
    assert.equal((await listUploadedClips(dataDir)).length, 1);

    // A non-audio content-type / extension is refused.
    const htmlFetch = async () => ({
      ok: true,
      headers: { get: () => 'text/html' },
      arrayBuffer: async () => Buffer.from('<html>').buffer
    });
    await assert.rejects(
      addClipFromUrl(dataDir, { title: 'x', triggers: 'y', sourceUrl: 'https://example.com/page' }, { fetchImpl: htmlFetch }),
      /not a direct audio file/
    );
  } finally {
    delete process.env.ZAPP_ALLOW_PRIVATE_FETCH;
    await rm(dataDir, { recursive: true, force: true });
  }
});
