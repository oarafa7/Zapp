import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import {
  addUploadedClip,
  addClipFromUrl,
  listUploadedClips,
  resolveDataDir,
  resolveUploadPath,
  ClipUploadError,
  MAX_UPLOAD_BYTES
} from './clipStore.js';

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
  '.m4a': 'audio/mp4',
  '.webm': 'audio/webm'
};

function isInsideRoot(rootDirectory, filePath) {
  const relative = filePath.slice(rootDirectory.length);
  return filePath === rootDirectory || relative.startsWith(sep);
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function readBody(request, maxBytes) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new ClipUploadError('Audio file exceeds the 5 MB limit.', 413));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolveBody(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function readJsonBody(request, maxBytes = 64 * 1024) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new ClipUploadError('Request body too large.', 413));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new ClipUploadError('Invalid JSON body.', 400));
      }
    });
    request.on('error', reject);
  });
}

// Uploads are open by default for a quick MVP. Set ZAPP_ADMIN_TOKEN to require
// an `x-zapp-admin` header before anyone can add clips on a public deployment.
function isAuthorized(request) {
  const token = process.env.ZAPP_ADMIN_TOKEN;
  if (!token) return true;
  return request.headers['x-zapp-admin'] === token;
}

async function handleClipFromUrl(request, response, dataDirectory) {
  if (!isAuthorized(request)) {
    sendJson(response, 401, { error: 'Admin token required to import clips.' });
    return;
  }
  try {
    const body = await readJsonBody(request);
    const clip = await addClipFromUrl(dataDirectory, {
      title: body.title,
      triggers: body.triggers,
      locale: body.locale,
      icon: body.icon,
      sourceUrl: body.sourceUrl
    });
    sendJson(response, 201, { clip });
  } catch (error) {
    const status = error instanceof ClipUploadError ? error.status : 500;
    if (status === 500) console.error('Clip import failed:', error);
    sendJson(response, status, { error: error.message || 'Import failed.' });
  }
}

async function handleClipUpload(request, response, url, dataDirectory) {
  if (!isAuthorized(request)) {
    sendJson(response, 401, { error: 'Admin token required to upload clips.' });
    return;
  }
  try {
    const buffer = await readBody(request, MAX_UPLOAD_BYTES);
    const clip = await addUploadedClip(dataDirectory, {
      title: url.searchParams.get('title'),
      triggers: url.searchParams.get('triggers'),
      locale: url.searchParams.get('locale'),
      icon: url.searchParams.get('icon'),
      contentType: request.headers['content-type'],
      fileName: url.searchParams.get('filename'),
      buffer
    });
    sendJson(response, 201, { clip });
  } catch (error) {
    const status = error instanceof ClipUploadError ? error.status : 500;
    if (status === 500) console.error('Clip upload failed:', error);
    sendJson(response, status, { error: error.message || 'Upload failed.' });
  }
}

export function createRequestHandler({ rootDirectory = process.cwd(), dataDirectory } = {}) {
  const resolvedRoot = resolve(rootDirectory);
  const resolvedData = resolveDataDir(dataDirectory);

  return async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const { pathname } = url;

    if (pathname === '/health') {
      sendJson(response, 200, { ok: true, service: 'zapp-audio-gifs' });
      return;
    }

    // Import a clip from a direct audio link.
    if (pathname === '/api/clips/from-url') {
      if (request.method === 'POST') {
        await handleClipFromUrl(request, response, resolvedData);
        return;
      }
      response.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', allow: 'POST' });
      response.end('Method not allowed');
      return;
    }

    // Catalog API for user-uploaded clips.
    if (pathname === '/api/clips') {
      if (request.method === 'GET') {
        sendJson(response, 200, { clips: await listUploadedClips(resolvedData) });
        return;
      }
      if (request.method === 'POST') {
        await handleClipUpload(request, response, url, resolvedData);
        return;
      }
      response.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', allow: 'GET, POST' });
      response.end('Method not allowed');
      return;
    }

    // Serve uploaded audio from the (persistent) data directory.
    if (pathname.startsWith('/uploads/audio/')) {
      const uploadPath = resolveUploadPath(resolvedData, pathname);
      if (!uploadPath || !existsSync(uploadPath)) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }
      response.writeHead(200, { 'content-type': mimeTypes[extname(uploadPath)] || 'application/octet-stream' });
      createReadStream(uploadPath).pipe(response);
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

export function startStaticServer({ port = Number(process.env.PORT || 5173), rootDirectory = process.cwd(), dataDirectory } = {}) {
  const server = createServer(createRequestHandler({ rootDirectory, dataDirectory }));
  server.listen(port, '0.0.0.0', () => {
    console.log(`Zapp frontend running at http://localhost:${port}`);
    console.log(`Uploaded clips persist in ${resolveDataDir(dataDirectory)}`);
  });
  return server;
}
