import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.m4a': 'audio/mp4'
};

function isInsideRoot(rootDirectory, filePath) {
  const relative = filePath.slice(rootDirectory.length);
  return filePath === rootDirectory || relative.startsWith(sep);
}

export function createRequestHandler({ rootDirectory = process.cwd() } = {}) {
  const resolvedRoot = resolve(rootDirectory);

  return (request, response) => {
    const { pathname } = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (pathname === '/health') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true, service: 'zapp-audio-gifs' }));
      return;
    }

    const normalizedPath = normalize(pathname === '/' ? '/index.html' : pathname);
    const relativePath = normalizedPath.replace(/^(\.\.(\/|\\|$))+/, '').replace(/^[/\\]/, '');
    const filePath = resolve(join(resolvedRoot, relativePath));

    if (!isInsideRoot(resolvedRoot, filePath) || !existsSync(filePath)) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  };
}

export function startStaticServer({ port = Number(process.env.PORT || 5173), rootDirectory = process.cwd() } = {}) {
  const server = createServer(createRequestHandler({ rootDirectory }));
  server.listen(port, '0.0.0.0', () => {
    console.log(`Zapp frontend running at http://localhost:${port}`);
  });
  return server;
}
