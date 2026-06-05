import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequestHandler } from '../scripts/static-server.js';

test('static server exposes health check and serves frontend files', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'zapp-static-'));
  await mkdir(join(rootDirectory, 'src', 'frontend'), { recursive: true });
  await writeFile(join(rootDirectory, 'index.html'), '<h1>Zapp</h1>');
  await writeFile(join(rootDirectory, 'src', 'frontend', 'main.js'), 'console.log("zapp")');

  const server = createServer(createRequestHandler({ rootDirectory }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();

  const health = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).service, 'zapp-audio-gifs');

  const index = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(index.status, 200);
  assert.match(await index.text(), /Zapp/);

  const javascript = await fetch(`http://127.0.0.1:${port}/src/frontend/main.js`);
  assert.equal(javascript.headers.get('content-type'), 'text/javascript; charset=utf-8');

  await mkdir(join(rootDirectory, 'assets', 'audio'), { recursive: true });
  await writeFile(join(rootDirectory, 'assets', 'audio', 'clip.wav'), Buffer.from('RIFF'));
  const audio = await fetch(`http://127.0.0.1:${port}/assets/audio/clip.wav`);
  assert.equal(audio.status, 200);
  assert.equal(audio.headers.get('content-type'), 'audio/wav');

  server.close();
  await once(server, 'close');
});
