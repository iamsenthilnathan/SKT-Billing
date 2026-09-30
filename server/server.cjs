const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handleApiRequest } = require('./apiHandler.cjs');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const distDir = path.resolve(__dirname, '..', 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function checkBasicAuth(req, res) {
  const expectedUser = process.env.APP_USERNAME;
  const expectedPass = process.env.APP_PASSWORD;

  // Enforce configuration: fail closed if credentials are not configured
  if (!expectedUser || !expectedPass) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Server configuration error: APP_USERNAME and APP_PASSWORD environment variables are required.');
    return false;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', 'Basic realm="Sri Krishna Textile Billing"');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Authentication required.');
    return false;
  }

  try {
    const b64 = authHeader.slice(6).trim();
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) {
      res.statusCode = 401;
      res.setHeader('WWW-Authenticate', 'Basic realm="Sri Krishna Textile Billing"');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Invalid authorization credentials.');
      return false;
    }

    const username = decoded.slice(0, colonIdx);
    const password = decoded.slice(colonIdx + 1);

    if (username !== expectedUser || password !== expectedPass) {
      res.statusCode = 401;
      res.setHeader('WWW-Authenticate', 'Basic realm="Sri Krishna Textile Billing"');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Invalid credentials.');
      return false;
    }

    return true;
  } catch {
    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', 'Basic realm="Sri Krishna Textile Billing"');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Invalid authorization encoding.');
    return false;
  }
}

function serveStatic(req, res, pathname) {
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(distDir, safePath);

  // Prevent path traversal
  if (!filePath.startsWith(distDir)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  // Directory resolution
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // Serve static file if it exists
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    if (filePath.includes(path.join('dist', 'assets'))) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }

    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // SPA fallback to /dist/index.html for client routes (GET requests)
  if (req.method === 'GET') {
    const indexHtmlPath = path.join(distDir, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      fs.createReadStream(indexHtmlPath).pipe(res);
      return;
    }
  }

  res.statusCode = 404;
  res.end('Not Found');
}

const server = http.createServer((req, res) => {
  // Handle CORS preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Business-Key, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.end();
    return;
  }

  // Reverse proxy header resolution (Railway / Render / Nginx)
  const forwardedProto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const urlObj = new URL(req.url, `${forwardedProto}://${forwardedHost}`);
  const pathname = decodeURIComponent(urlObj.pathname);

  // 1. Unauthenticated health check endpoint for deployment orchestrators (Railway / Render)
  // Supports both GET and HEAD requests without requiring Basic Auth.
  if ((pathname === '/api/health' || pathname === '/health') && (req.method === 'GET' || req.method === 'HEAD')) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(JSON.stringify({ status: 'ok', database: 'sqlite', timestamp: new Date().toISOString() }));
    }
    return;
  }

  // 2. Server-level HTTP Basic Authentication gate for all protected routes
  if (!checkBasicAuth(req, res)) {
    return;
  }

  // 3. API router delegation
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    handleApiRequest(req, res, (err) => {
      if (err) {
        console.error('Unhandled API error:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
        }
      }
    });
    return;
  }

  // Static files and SPA fallback
  serveStatic(req, res, pathname);
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Sri Krishna Textile billing server running on http://${HOST}:${PORT}`);
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = { server, PORT, HOST };
