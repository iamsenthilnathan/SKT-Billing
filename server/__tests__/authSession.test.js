import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDataDir = path.resolve(__dirname, '..', 'test-auth-session-data');
if (fs.existsSync(testDataDir)) {
  fs.rmSync(testDataDir, { recursive: true, force: true });
}
fs.mkdirSync(testDataDir, { recursive: true });

process.env.DATA_DIR = testDataDir;
process.env.APP_USERNAME = 'test_session_user';
process.env.APP_PASSWORD = 'test_session_password';
process.env.SESSION_SECRET = 'test_secret_for_signing_sessions_12345';

const { server } = require('../server.cjs');
const { db } = require('../db.cjs');
const { createSessionToken } = require('../auth.cjs');

describe('Full-Stack Application Session Authentication System', () => {
  let testPort;

  beforeAll(async () => {
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          testPort = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
    try {
      db.close();
    } catch {
      // ignore
    }
    try {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  function makeRequest({ path, method = 'GET', body, headers = {} }) {
    return new Promise((resolve, reject) => {
      const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
      const reqHeaders = {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      };

      const req = http.request({
        hostname: '127.0.0.1',
        port: testPort,
        path,
        method,
        headers: reqHeaders,
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: parsed,
            rawBody: data,
          });
        });
      });
      req.on('error', reject);
      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }

  describe('POST /api/auth/login', () => {
    it('returns 400 when username or password is missing', async () => {
      const res1 = await makeRequest({
        path: '/api/auth/login',
        method: 'POST',
        body: { username: '' },
      });
      expect(res1.statusCode).toBe(400);
      expect(res1.body.error).toContain('Username and password are required');

      const res2 = await makeRequest({
        path: '/api/auth/login',
        method: 'POST',
        body: { username: 'test_session_user' },
      });
      expect(res2.statusCode).toBe(400);
    });

    it('returns 401 when username is incorrect', async () => {
      const res = await makeRequest({
        path: '/api/auth/login',
        method: 'POST',
        body: {
          username: 'wrong_user',
          password: 'test_session_password',
        },
      });
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('Invalid username or password');
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('returns 401 when password is incorrect', async () => {
      const res = await makeRequest({
        path: '/api/auth/login',
        method: 'POST',
        body: {
          username: 'test_session_user',
          password: 'wrong_password',
        },
      });
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('Invalid username or password');
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('returns 200 and sets HttpOnly session cookie on valid credentials', async () => {
      const res = await makeRequest({
        path: '/api/auth/login',
        method: 'POST',
        body: {
          username: 'test_session_user',
          password: 'test_session_password',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.username).toBe('test_session_user');

      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieStr = setCookie[0];
      expect(cookieStr).toContain('skt_session=');
      expect(cookieStr).toContain('HttpOnly');
      expect(cookieStr).toContain('SameSite=Lax');
      expect(cookieStr).toContain('Max-Age=604800');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 when no session cookie is provided', async () => {
      const res = await makeRequest({
        path: '/api/auth/me',
        method: 'GET',
      });
      expect(res.statusCode).toBe(401);
      expect(res.body.authenticated).toBe(false);
    });

    it('returns 200 with user data when valid session cookie is provided', async () => {
      // Login first
      const loginRes = await makeRequest({
        path: '/api/auth/login',
        method: 'POST',
        body: {
          username: 'test_session_user',
          password: 'test_session_password',
        },
      });
      const cookie = loginRes.headers['set-cookie'][0].split(';')[0];

      const res = await makeRequest({
        path: '/api/auth/me',
        method: 'GET',
        headers: { Cookie: cookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user.username).toBe('test_session_user');
    });

    it('returns 401 when session cookie has tampered signature', async () => {
      const loginRes = await makeRequest({
        path: '/api/auth/login',
        method: 'POST',
        body: {
          username: 'test_session_user',
          password: 'test_session_password',
        },
      });
      const cookieVal = loginRes.headers['set-cookie'][0].split(';')[0].replace('skt_session=', '');
      const [payload, sig] = cookieVal.split('.');
      const tamperedCookie = `skt_session=${payload}.${sig.slice(0, -4)}xxxx`;

      const res = await makeRequest({
        path: '/api/auth/me',
        method: 'GET',
        headers: { Cookie: tamperedCookie },
      });
      expect(res.statusCode).toBe(401);
      expect(res.body.authenticated).toBe(false);
    });

    it('returns 401 when session cookie is expired', async () => {
      // Create an expired token (expired 1 hour ago)
      const token = createSessionToken('test_session_user', -3600);

      const res = await makeRequest({
        path: '/api/auth/me',
        method: 'GET',
        headers: { Cookie: `skt_session=${token}` },
      });
      expect(res.statusCode).toBe(401);
      expect(res.body.authenticated).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('returns 200 and clears the session cookie', async () => {
      const res = await makeRequest({
        path: '/api/auth/logout',
        method: 'POST',
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(setCookie[0]).toContain('skt_session=;');
      expect(setCookie[0]).toContain('Max-Age=0');
    });
  });

  describe('Production Gating: Protected API vs Public Routes', () => {
    it('allows unauthenticated GET /api/health with 200 OK', async () => {
      const res = await makeRequest({ path: '/api/health', method: 'GET' });
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('allows unauthenticated GET /health with 200 OK', async () => {
      const res = await makeRequest({ path: '/health', method: 'GET' });
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('allows unauthenticated GET / to serve the SPA shell with 200 OK', async () => {
      const res = await makeRequest({ path: '/', method: 'GET' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      // Must NOT contain Basic Auth challenge
      expect(res.headers['www-authenticate']).toBeUndefined();
    });

    it('rejects unauthenticated GET /api/sync/state with 401 JSON and NO www-authenticate', async () => {
      const res = await makeRequest({ path: '/api/sync/state', method: 'GET' });
      expect(res.statusCode).toBe(401);
      expect(res.headers['www-authenticate']).toBeUndefined();
      expect(res.body.authenticated).toBe(false);
      expect(res.body.error).toContain('Authentication required');
    });

    it('rejects protected API requests using legacy HTTP Basic Auth', async () => {
      const basicAuth = 'Basic ' + Buffer.from('test_session_user:test_session_password').toString('base64');
      const res = await makeRequest({
        path: '/api/sync/state',
        method: 'GET',
        headers: {
          Authorization: basicAuth,
        },
      });
      expect(res.statusCode).toBe(401);
      expect(res.headers['www-authenticate']).toBeUndefined();
      expect(res.body.authenticated).toBe(false);
    });

    it('allows protected API requests using ONLY the authenticated session cookie without any X-Business-Key header', async () => {
      const loginRes = await makeRequest({
        path: '/api/auth/login',
        method: 'POST',
        body: {
          username: 'test_session_user',
          password: 'test_session_password',
        },
      });
      const cookie = loginRes.headers['set-cookie'][0].split(';')[0];

      // Make protected request with NO X-Business-Key header
      const res = await makeRequest({
        path: '/api/sync/state',
        method: 'GET',
        headers: {
          Cookie: cookie,
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.settings).toBeDefined();
      expect(res.body.invoices).toBeDefined();
    });
  });
});
