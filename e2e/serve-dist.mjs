import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/pipe-scope/browser');
const port = 4300;
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const candidate = resolve(root, `.${requestPath}`);

  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    response.writeHead(403);
    response.end();
    return;
  }

  const filePath = resolveFile(candidate, requestPath);
  sendFile(response, filePath, request.method === 'HEAD');
});

server.listen(port, '127.0.0.1');

function resolveFile(candidate, requestPath) {
  try {
    if (statSync(candidate).isFile()) {
      return candidate;
    }
  } catch {
    if (extname(requestPath)) {
      return null;
    }
  }

  return extname(requestPath) ? null : resolve(root, 'index.html');
}

function sendFile(response, filePath, headOnly) {
  if (!filePath) {
    response.writeHead(404);
    response.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on('error', () => {
    if (!response.headersSent) {
      response.writeHead(404);
    }
    response.end();
  });

  response.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
  });

  if (headOnly) {
    stream.destroy();
    response.end();
    return;
  }

  stream.pipe(response);
}
