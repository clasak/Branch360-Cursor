import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const SRC_DIR = path.join(__dirname, '..', 'src');
const INDEX_TEMPLATE = createIndexTemplate();

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function findCaseInsensitiveMatch(relativePath) {
  if (!relativePath) return null;
  const segments = relativePath.split(path.sep);
  let current = SRC_DIR;

  for (const segment of segments) {
    if (!segment) continue;
    let entries;
    try {
      entries = fs.readdirSync(current);
    } catch (err) {
      return null;
    }
    const match = entries.find((entry) => entry.toLowerCase() === segment.toLowerCase());
    if (!match) {
      return null;
    }
    current = path.join(current, match);
  }

  return current;
}

function createIndexTemplate() {
  const entries = fs.readdirSync(path.join(__dirname, '..', 'src'))
    .filter((file) => file.endsWith('.html'))
    .sort((a, b) => a.localeCompare(b));

  const listItems = entries
    .map((file) => `<li><a href="/${file}">${file}</a></li>`)
    .join('\n');

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Branch360 Local Preview</title>
      <style>
        body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 2rem; }
        h1 { margin-bottom: 1rem; }
        ul { list-style: none; padding: 0; }
        li { margin: 0.25rem 0; }
        a { color: #2563eb; text-decoration: none; font-weight: 600; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>Branch360 Local Preview</h1>
      <p>Select a dashboard to preview:</p>
      <ul>${listItems}</ul>
      <p>Default: <a href="/dashboard.html">Unified Dashboard</a></p>
    </body>
  </html>`;
}

function resolveFilePath(urlPath) {
  let relativePath = decodeURIComponent(urlPath);
  if (relativePath === '/' || relativePath === '') {
    return null; // serve index template
  }

  const requestedPath = path.normalize(relativePath).replace(/^\/+/, '');
  const target = path.join(SRC_DIR, requestedPath);

  if (!target.startsWith(SRC_DIR)) {
    return undefined; // outside src
  }

  return target;
}

function sendIndex(res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
  res.end(INDEX_TEMPLATE);
}

function sendNotFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
  res.end('Not found');
}

function sendError(res, message) {
  res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
  res.end(message);
}

function serveFile(res, filePath) {
  fs.stat(filePath, (statErr, stats) => {
    if (statErr) {
      if (statErr.code === 'ENOENT') {
        const fallback = findCaseInsensitiveMatch(path.relative(SRC_DIR, filePath));
        if (fallback) {
          return serveFile(res, fallback);
        }
        return sendNotFound(res);
      }
      return sendError(res, statErr.message);
    }

    let finalPath = filePath;
    if (stats.isDirectory()) {
      finalPath = path.join(filePath, 'index.html');
    }

    fs.readFile(finalPath, (readErr, data) => {
      if (readErr) {
        if (readErr.code === 'ENOENT') {
          return sendNotFound(res);
        }
        return sendError(res, readErr.message);
      }

      const ext = path.extname(finalPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const filePath = resolveFilePath(url.pathname);

  if (filePath === null) {
    return sendIndex(res);
  }

  if (filePath === undefined) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=UTF-8' });
    return res.end('Forbidden');
  }

  return serveFile(res, filePath);
});

server.listen(PORT, HOST, () => {
  console.log(`Branch360 preview server running at http://${HOST}:${PORT}`);
  console.log('Default dashboard: http://' + HOST + ':' + PORT + '/dashboard.html');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`   Please either:`);
    console.error(`   1. Kill the process using port ${PORT}: lsof -ti:${PORT} | xargs kill -9`);
    console.error(`   2. Use a different port: PORT=3001 npm run dev`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});
