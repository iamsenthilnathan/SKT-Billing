import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDataDir = path.resolve(__dirname, '..', 'test-party-data');
if (fs.existsSync(testDataDir)) {
  fs.rmSync(testDataDir, { recursive: true, force: true });
}
fs.mkdirSync(testDataDir, { recursive: true });

process.env.DATA_DIR = testDataDir;
process.env.APP_USERNAME = 'test_party_user';
process.env.APP_PASSWORD = 'test_party_password';

const require = createRequire(import.meta.url);
const { server } = require('../server.cjs');
const { db } = require('../db.cjs');

describe('Party Backend API & Deletion Safety', () => {
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
    db.close();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  const validBasicAuth = 'Basic ' + Buffer.from('test_party_user:test_party_password').toString('base64');
  const validBusinessKey = 'SKT-SRIKRISHNA-2026';

  function makeRequest({ path, method = 'GET', body, headers = {} }) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const reqHeaders = {
        Authorization: validBasicAuth,
        'X-Business-Key': validBusinessKey,
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
        res.on('end', () => resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: data ? JSON.parse(data) : null,
        }));
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  it('GET /api/parties returns all parties with isArchived: false by default', async () => {
    const res = await makeRequest({ path: '/api/parties' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    for (const p of res.body) {
      expect(p.isArchived).toBe(false);
    }
  });

  it('PUT /api/parties/:id archives an active party in SQLite', async () => {
    const res = await makeRequest({
      path: '/api/parties/party_1',
      method: 'PUT',
      body: { isArchived: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isArchived).toBe(true);

    // Verify in GET /api/parties
    const listRes = await makeRequest({ path: '/api/parties' });
    const p1 = listRes.body.find(p => p.id === 'party_1');
    expect(p1.isArchived).toBe(true);
  });

  it('PUT /api/parties/:id restores an archived party to Active in SQLite', async () => {
    const res = await makeRequest({
      path: '/api/parties/party_1',
      method: 'PUT',
      body: { isArchived: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.isArchived).toBe(false);

    // Verify in GET /api/parties
    const listRes = await makeRequest({ path: '/api/parties' });
    const p1 = listRes.body.find(p => p.id === 'party_1');
    expect(p1.isArchived).toBe(false);
  });

  it('DELETE /api/parties/:id blocks deletion if party is referenced by an invoice', async () => {
    // Insert a test invoice referencing party_1
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO invoices (
        id, invoice_number, financial_year, sequence_number, invoice_date, status,
        party_id, party_name_snapshot, party_address_snapshot, party_gstin_snapshot, party_phone_snapshot,
        bank_name_snapshot, branch_snapshot, account_number_snapshot, ifsc_code_snapshot,
        dcs_json, calculations_json, payment_status, paid_amount, outstanding_amount, payments_json,
        created_at, updated_at, finalized_at
      ) VALUES (
        'inv_ref_1', 'SKT/2026-27/099', '2026-27', 99, '2026-09-30', 'finalized',
        'party_1', 'ABC Fabrics', 'Tirupur', '33ABCDE1234F1Z9', '9842111223',
        'SBI', 'Main', '1234', 'SBIN0001', '[]', '{}', 'unpaid', 0, 1000, '[]',
        ?, ?, ?
      )
    `).run(now, now, now);

    // Attempting DELETE on party_1 must fail with 400
    const delRes = await makeRequest({
      path: '/api/parties/party_1',
      method: 'DELETE',
    });
    expect(delRes.statusCode).toBe(400);
    expect(delRes.body.referenced).toBe(true);
    expect(delRes.body.error).toContain('Cannot delete customer: Referenced by invoice');

    // Confirm party_1 still exists in DB
    const checkParty = db.prepare('SELECT * FROM parties WHERE id = ?').get('party_1');
    expect(checkParty).toBeDefined();
    expect(checkParty.id).toBe('party_1');
  });

  it('DELETE /api/parties/:id allows deletion if party has never been referenced by any invoice', async () => {
    // Create an unreferenced party
    const createRes = await makeRequest({
      path: '/api/parties',
      method: 'POST',
      body: {
        id: 'party_unref_99',
        name: 'Unreferenced Customer Ltd',
        address: 'Palladam Road, Tirupur',
        gstin: '33ZZZZZ9999Z1Z9',
        phone: '9842888888',
      },
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.body.id).toBe('party_unref_99');

    // DELETE on unreferenced party must succeed with 200
    const delRes = await makeRequest({
      path: '/api/parties/party_unref_99',
      method: 'DELETE',
    });
    expect(delRes.statusCode).toBe(200);
    expect(delRes.body.success).toBe(true);

    // Confirm removed from DB
    const check = db.prepare('SELECT * FROM parties WHERE id = ?').get('party_unref_99');
    expect(check).toBeUndefined();
  });

  it('GET /api/sync/state includes isArchived status for all parties', async () => {
    const res = await makeRequest({ path: '/api/sync/state' });
    expect(res.statusCode).toBe(200);
    expect(res.body.parties).toBeDefined();
    for (const p of res.body.parties) {
      expect(typeof p.isArchived).toBe('boolean');
    }
  });
});
