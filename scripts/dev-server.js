import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.PORT || 5173);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

createServer((request, response) => {
  const rawPath = new URL(request.url, `http://${request.headers.host}`).pathname;
  const safePath = normalize(rawPath === '/' ? '/index.html' : rawPath).replace(/^\.\.(\/|\\|$)/, '');
  const filePath = join(process.cwd(), safePath);

  if (!existsSync(filePath)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
}).listen(port, '0.0.0.0', () => {
  console.log(`Zapp frontend running at http://localhost:${port}`);
});
