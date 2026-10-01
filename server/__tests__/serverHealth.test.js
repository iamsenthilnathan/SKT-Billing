import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDataDir = path.resolve(__dirname, '..', 'test-health-data');
if (fs.existsSync(testDataDir)) {
  fs.rmSync(testDataDir, { recursive: true, force: true });
}
fs.mkdirSync(testDataDir, { recursive: true });

process.env.DATA_DIR = testDataDir;
process.env.APP_USERNAME = 'test_railway_user';
process.env.APP_PASSWORD = 'test_railway_password';

const { server } = require('../server.cjs');
const { db } = require('../db.cjs');

describe('Server Health and Authentication Gate', () => {
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

  function makeRequest(options) {
    return new Promise((resolve, reject) => {
      const payload = options.body;
      const headers = { ...options.headers };
      if (payload && !headers['Content-Length']) {
        headers['Content-Length'] = Buffer.byteLength(payload);
      }
      const req = http.request({
        hostname: '127.0.0.1',
        port: testPort,
        ...options,
        headers,
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: data,
        }));
      });
      req.on('error', reject);
      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }

  it('allows unauthenticated GET /api/health with 200 OK for Railway/Render orchestrators', async () => {
    const res = await makeRequest({ path: '/api/health', method: 'GET' });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.status).toBe('ok');
    expect(json.database).toBe('sqlite');
    expect(json.timestamp).toBeDefined();
  });

  it('allows unauthenticated GET /health with 200 OK for alternative health check paths', async () => {
    const res = await makeRequest({ path: '/health', method: 'GET' });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.status).toBe('ok');
  });

  it('allows unauthenticated HEAD /api/health with 200 OK without content body', async () => {
    const res = await makeRequest({ path: '/api/health', method: 'HEAD' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/json');
    expect(res.body).toBe('');
  });

  it('serves SPA shell (/) without HTTP Basic Auth challenge', async () => {
    const res = await makeRequest({ path: '/', method: 'GET' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['www-authenticate']).toBeUndefined();
  });

  it('rejects unauthenticated requests to protected API routes (/api/sync/state) with 401 JSON and NO www-authenticate header', async () => {
    const res = await makeRequest({ path: '/api/sync/state', method: 'GET' });
    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBeUndefined();
    const json = JSON.parse(res.body);
    expect(json.authenticated).toBe(false);
    expect(json.error).toContain('Authentication required');
  });

  it('authenticates via POST /api/auth/login and sets HttpOnly session cookie', async () => {
    const res = await makeRequest({
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'test_railway_user',
        password: 'test_railway_password',
      }),
    });
    expect(res.statusCode).toBe(200);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(setCookie[0]).toContain('skt_session=');
    expect(setCookie[0]).toContain('HttpOnly');
    expect(setCookie[0]).toContain('SameSite=Lax');
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.user.username).toBe('test_railway_user');
  });

  it('rejects POST /api/auth/login with invalid password', async () => {
    const res = await makeRequest({
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'test_railway_user',
        password: 'wrong_password',
      }),
    });
    expect(res.statusCode).toBe(401);
    const json = JSON.parse(res.body);
    expect(json.error).toBe('Invalid username or password');
  });

  it('handles protected API routes when valid session cookie is provided without X-Business-Key', async () => {
    const loginRes = await makeRequest({
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'test_railway_user',
        password: 'test_railway_password',
      }),
    });
    const cookieHeader = loginRes.headers['set-cookie'][0].split(';')[0];

    const res = await makeRequest({
      path: '/api/sync/state',
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
      },
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.settings).toBeDefined();
    expect(json.invoices).toBeDefined();
  });

  it('does not accept legacy Basic Auth header on protected API routes', async () => {
    const legacyBasic = 'Basic ' + Buffer.from('test_railway_user:test_railway_password').toString('base64');
    const res = await makeRequest({
      path: '/api/sync/state',
      method: 'GET',
      headers: {
        'Authorization': legacyBasic,
      },
    });
    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBeUndefined();
  });

  it('correctly handles reverse-proxy requests with x-forwarded-proto: https without emitting any redirect', async () => {
    const res = await makeRequest({
      path: '/',
      method: 'GET',
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'skt-billing-production.up.railway.app',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['location']).toBeUndefined();
    expect(res.headers['content-type']).toContain('text/html');
  });
});

