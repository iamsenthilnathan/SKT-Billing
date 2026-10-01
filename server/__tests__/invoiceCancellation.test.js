import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDataDir = path.resolve(__dirname, '..', 'test-cancel-data');
if (fs.existsSync(testDataDir)) {
  fs.rmSync(testDataDir, { recursive: true, force: true });
}
fs.mkdirSync(testDataDir, { recursive: true });

process.env.DATA_DIR = testDataDir;
process.env.APP_USERNAME = 'test_cancel_user';
process.env.APP_PASSWORD = 'test_cancel_password';

const require = createRequire(import.meta.url);
const { server } = require('../server.cjs');
const { db } = require('../db.cjs');

describe('Invoice Cancellation Backend API & Safeguards', () => {
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

  const validBasicAuth = 'Basic ' + Buffer.from('test_cancel_user:test_cancel_password').toString('base64');
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
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch {
            parsed = data;
          }
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: parsed,
          });
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  it('POST /api/invoices/:id/cancel requires business key authentication', async () => {
    const res = await makeRequest({
      path: '/api/invoices/inv_sample_1/cancel',
      method: 'POST',
      body: { reason: 'Test unauthorized' },
      headers: { 'X-Business-Key': 'INVALID-KEY' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/invoices/:id/cancel returns 404 for non-existent invoice', async () => {
    const res = await makeRequest({
      path: '/api/invoices/inv_non_existent/cancel',
      method: 'POST',
      body: { reason: 'Does not exist' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('POST /api/invoices/:id/cancel marks a finalized invoice as cancelled with metadata', async () => {
    // inv_sample_1 was created by default seeds in testDataDir
    const res = await makeRequest({
      path: '/api/invoices/inv_sample_1/cancel',
      method: 'POST',
      body: { reason: 'Customer requested change of lot numbers' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('cancelled');
    expect(res.body.cancelledAt).toBeDefined();
    expect(res.body.cancellationReason).toBe('Customer requested change of lot numbers');

    // Verify directly in SQLite DB
    const row = db.prepare('SELECT status, cancelled_at, cancellation_reason FROM invoices WHERE id = ?').get('inv_sample_1');
    expect(row.status).toBe('cancelled');
    expect(row.cancelled_at).toBe(res.body.cancelledAt);
    expect(row.cancellation_reason).toBe('Customer requested change of lot numbers');
  });

  it('POST /api/invoices/:id/cancel rejects re-cancellation of an already cancelled invoice', async () => {
    const res = await makeRequest({
      path: '/api/invoices/inv_sample_1/cancel',
      method: 'POST',
      body: { reason: 'Second cancellation attempt' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/already cancelled/i);
  });

  it('POST /api/invoices/:id/payment rejects recording payment on a cancelled invoice', async () => {
    const res = await makeRequest({
      path: '/api/invoices/inv_sample_1/payment',
      method: 'POST',
      body: { amount: 5000, date: '2026-10-01', notes: 'Should fail' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/cannot record payment on a cancelled invoice/i);
  });

  it('GET /api/sync/state returns cancelled invoice with cancellation details', async () => {
    const res = await makeRequest({ path: '/api/sync/state' });
    expect(res.statusCode).toBe(200);
    const inv = res.body.invoices.find(i => i.id === 'inv_sample_1');
    expect(inv).toBeDefined();
    expect(inv.status).toBe('cancelled');
    expect(inv.cancelledAt).toBeDefined();
    expect(inv.cancellationReason).toBe('Customer requested change of lot numbers');
  });

  it('Finalizing an invoice NEVER reuses the sequence number of a cancelled invoice', async () => {
    // Set opening sequence to 56 for 2026-27
    db.prepare(`
      INSERT INTO invoice_sequences (financial_year, next_sequence)
      VALUES ('2026-27', 56)
      ON CONFLICT(financial_year) DO UPDATE SET next_sequence = 56
    `).run();

    // Finalize invoice 56
    const finalizeRes1 = await makeRequest({
      path: '/api/invoices/finalize',
      method: 'POST',
      body: {
        financialYear: '2026-27',
        partyId: 'party_1',
        invoiceDate: '2026-10-04',
        dcs: [
          {
            id: 'dc_1',
            ourDcNumber: '101',
            partyDcNumber: '201',
            partyDcDate: '2026-10-04',
            sortOrder: 0,
            workEntries: [
              { id: 'we_1', description: 'Cotton Dyeing', rolls: 1, weightDisplay: '100', weightKg: 100, rate: 50, amount: 5000, sortOrder: 0 }
            ]
          }
        ],
        calculations: {
          subtotal: 5000,
          cgstRate: 2.5,
          sgstRate: 2.5,
          cgstAmount: 125,
          sgstAmount: 125,
          preRoundTotal: 5250,
          roundOff: 0,
          totalAmount: 5250,
          totalRolls: 1,
          totalWeightKg: 100,
          totalAmountInWords: 'Rupees Five Thousand Two Hundred Fifty Only'
        }
      }
    });

    expect(finalizeRes1.statusCode).toBe(201);
    expect(finalizeRes1.body.sequenceNumber).toBe(56);
    expect(finalizeRes1.body.invoiceNumber).toBe('SKT/2026-27/056');

    // Cancel invoice 56
    const cancelRes = await makeRequest({
      path: `/api/invoices/${finalizeRes1.body.id}/cancel`,
      method: 'POST',
      body: { reason: 'Wrong quantity billed' }
    });
    expect(cancelRes.statusCode).toBe(200);

    // Finalize another invoice for 2026-27: It MUST be allocated sequence 57, NEVER 56
    const finalizeRes2 = await makeRequest({
      path: '/api/invoices/finalize',
      method: 'POST',
      body: {
        financialYear: '2026-27',
        partyId: 'party_1',
        invoiceDate: '2026-10-04',
        dcs: [
          {
            id: 'dc_2',
            ourDcNumber: '102',
            partyDcNumber: '202',
            partyDcDate: '2026-10-04',
            sortOrder: 0,
            workEntries: [
              { id: 'we_2', description: 'Cotton Dyeing', rolls: 2, weightDisplay: '200', weightKg: 200, rate: 50, amount: 10000, sortOrder: 0 }
            ]
          }
        ],
        calculations: {
          subtotal: 10000,
          cgstRate: 2.5,
          sgstRate: 2.5,
          cgstAmount: 250,
          sgstAmount: 250,
          preRoundTotal: 10500,
          roundOff: 0,
          totalAmount: 10500,
          totalRolls: 2,
          totalWeightKg: 200,
          totalAmountInWords: 'Rupees Ten Thousand Five Hundred Only'
        }
      }
    });

    expect(finalizeRes2.statusCode).toBe(201);
    expect(finalizeRes2.body.sequenceNumber).toBe(57);
    expect(finalizeRes2.body.invoiceNumber).toBe('SKT/2026-27/057');
  });

  it('DELETE /api/parties/:id prevents deleting customer referenced by cancelled invoice', async () => {
    // party_1 is referenced by inv_sample_1 (which is cancelled)
    const res = await makeRequest({
      path: '/api/parties/party_1',
      method: 'DELETE',
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.referenced).toBe(true);
    expect(res.body.error).toMatch(/referenced by invoice/i);
  });
});
