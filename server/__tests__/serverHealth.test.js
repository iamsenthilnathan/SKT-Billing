import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
process.env.APP_USERNAME = 'test_railway_user';
process.env.APP_PASSWORD = 'test_railway_password';

const { server } = require('../server.cjs');

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
  });

  function makeRequest(options) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: testPort,
        ...options,
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
      req.end();
    });
  }

  const validBasicAuth = 'Basic ' + Buffer.from('test_railway_user:test_railway_password').toString('base64');
  const invalidBasicAuth = 'Basic ' + Buffer.from('wrong:wrong').toString('base64');
  const validBusinessKey = 'SKT-SRIKRISHNA-2026';

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

  it('rejects unauthenticated requests to normal application routes (/) with 401 and Basic Auth challenge', async () => {
    const res = await makeRequest({ path: '/', method: 'GET' });
    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toContain('Basic realm="Sri Krishna Textile Billing"');
  });

  it('rejects unauthenticated requests to normal API routes (/api/sync/state) with 401', async () => {
    const res = await makeRequest({ path: '/api/sync/state', method: 'GET' });
    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBeDefined();
  });

  it('rejects requests with incorrect Basic Auth credentials with 401', async () => {
    const res = await makeRequest({
      path: '/api/sync/state',
      method: 'GET',
      headers: { 'Authorization': invalidBasicAuth },
    });
    expect(res.statusCode).toBe(401);
  });

  it('serves normal application routes when valid Basic Auth credentials are provided', async () => {
    const res = await makeRequest({
      path: '/',
      method: 'GET',
      headers: { 'Authorization': validBasicAuth },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });

  it('handles protected API routes when valid Basic Auth and Business Key are provided', async () => {
    const res = await makeRequest({
      path: '/api/sync/state',
      method: 'GET',
      headers: {
        'Authorization': validBasicAuth,
        'X-Business-Key': validBusinessKey,
      },
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.settings).toBeDefined();
    expect(json.invoices).toBeDefined();
  });

  it('enforces Business Key on protected API routes even when Basic Auth is valid', async () => {
    const res = await makeRequest({
      path: '/api/sync/state',
      method: 'GET',
      headers: {
        'Authorization': validBasicAuth,
      },
    });
    expect(res.statusCode).toBe(401);
    const json = JSON.parse(res.body);
    expect(json.error).toContain('Unauthorized: Invalid business key');
  });
});
