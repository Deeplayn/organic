const http = require('http');
const fs = require('fs/promises');
const path = require('path');

require('../api/_env');

const rootDir = path.resolve(__dirname, '..');
const port = Number.parseInt(process.env.PORT || '8080', 10) || 8080;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp'
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `localhost:${port}`}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith('/api/')) {
      await handleApiRequest(req, res, pathname);
      return;
    }

    await handleStaticRequest(req, res, pathname);
  } catch (error) {
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(error.message || 'Internal server error.');
    }
  }
});

server.listen(port, () => {
  const groqConfigured = String(process.env.GROQ_API_KEY || '').trim() ? 'loaded' : 'missing';
  console.log(`OrganoChem dev server running at http://localhost:${port}`);
  console.log(`GROQ_API_KEY: ${groqConfigured}`);
});

async function handleApiRequest(req, res, pathname) {
  const routePath = pathname === '/api'
    ? path.join(rootDir, 'api', 'index.js')
    : path.join(rootDir, `${pathname}.js`);

  if (!isInsideRoot(routePath) || !(await fileExists(routePath))) {
    sendPlain(res, 404, 'API route not found.');
    return;
  }

  delete require.cache[require.resolve(routePath)];
  const handler = require(routePath);
  const body = await readRequestBody(req);
  req.body = body;

  const response = createResponseAdapter(res);
  await handler(req, response);

  if (!res.writableEnded) {
    response.end();
  }
}

async function handleStaticRequest(req, res, pathname) {
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    sendPlain(res, 405, 'Method not allowed.');
    return;
  }

  const relativePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(rootDir, relativePath);

  if (!isInsideRoot(filePath) || !(await fileExists(filePath))) {
    sendPlain(res, 404, 'Not found.');
    return;
  }

  const stat = await fs.stat(filePath);
  if (!stat.isFile()) {
    sendPlain(res, 404, 'Not found.');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const content = await fs.readFile(filePath);
  res.end(content);
}

function createResponseAdapter(res) {
  let statusCode = 200;
  const pendingHeaders = new Map();

  return {
    setHeader(name, value) {
      pendingHeaders.set(name, value);
    },
    getHeader(name) {
      return pendingHeaders.get(name);
    },
    status(code) {
      statusCode = code;
      return this;
    },
    writeHead(code, headers = {}) {
      statusCode = code;
      for (const [name, value] of Object.entries(headers)) {
        pendingHeaders.set(name, value);
      }
      return this;
    },
    send(body) {
      this.end(body);
      return this;
    },
    end(body = '') {
      if (res.writableEnded) return this;
      res.statusCode = statusCode;
      for (const [name, value] of pendingHeaders.entries()) {
        res.setHeader(name, value);
      }
      res.end(body);
      return this;
    }
  };
}

async function readRequestBody(req) {
  if (['GET', 'HEAD'].includes(req.method || 'GET')) {
    return undefined;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isInsideRoot(targetPath) {
  const relative = path.relative(rootDir, targetPath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) || targetPath === rootDir;
}

function sendPlain(res, statusCode, message) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(message);
}
