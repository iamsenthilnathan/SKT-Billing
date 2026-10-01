import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDataDir = path.resolve(__dirname, '..', 'test-empty-startup-data');
if (fs.existsSync(testDataDir)) {
  fs.rmSync(testDataDir, { recursive: true, force: true });
}
fs.mkdirSync(testDataDir, { recursive: true });

process.env.DATA_DIR = testDataDir;
process.env.APP_USERNAME = 'test_empty_user';
process.env.APP_PASSWORD = 'test_empty_password';

const require = createRequire(import.meta.url);
const { server } = require('../server.cjs');
const { db } = require('../db.cjs');

describe('Empty Database Startup & Zero-Invoice Invariant', () => {
  let testPort;
  let sessionCookie;

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

    // Authenticate via /api/auth/login to obtain session cookie
    const loginPayload = JSON.stringify({
      username: 'test_empty_user',
      password: 'test_empty_password',
    });
    sessionCookie = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: testPort,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(loginPayload),
        },
      }, (res) => {
        const rawCookie = res.headers['set-cookie']?.[0];
        if (rawCookie) {
          resolve(rawCookie.split(';')[0]);
        } else {
          reject(new Error('Failed to obtain session cookie'));
        }
      });
      req.on('error', reject);
      req.write(loginPayload);
      req.end();
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
    try {
      db.close();
    } catch {
      // Ignore if already closed
    }
    try {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    } catch {
      // Best-effort cleanup on Windows
    }
  });

  function makeRequest({ path, method = 'GET', body, headers = {} }) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const reqHeaders = {
        Cookie: sessionCookie,
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

  it('fresh database startup results in exactly 0 invoices while preserving parties, rate_memory, and settings', () => {
    const invoiceCount = db.prepare('SELECT COUNT(*) as count FROM invoices').get().count;
    expect(invoiceCount).toBe(0);

    const draftCount = db.prepare('SELECT COUNT(*) as count FROM active_draft').get().count;
    expect(draftCount).toBe(0);

    const partyCount = db.prepare('SELECT COUNT(*) as count FROM parties').get().count;
    expect(partyCount).toBe(3);

    const rateCount = db.prepare('SELECT COUNT(*) as count FROM rate_memory').get().count;
    expect(rateCount).toBe(1);

    const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;
    expect(settingsCount).toBe(1);
  });

  it('GET /api/sync/state returns empty invoices array on fresh database', async () => {
    const res = await makeRequest({ path: '/api/sync/state' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.invoices)).toBe(true);
    expect(res.body.invoices.length).toBe(0);
  });

  it('database re-initialization/restart leaves invoices count at 0', () => {
    // Re-execute db.cjs module logic to simulate process restart against existing database
    const dbPath = require.resolve('../db.cjs');
    delete require.cache[dbPath];
    const reloaded = require('../db.cjs');

    const countAfterRestart = reloaded.db.prepare('SELECT COUNT(*) as count FROM invoices').get().count;
    expect(countAfterRestart).toBe(0);
    try {
      reloaded.db.close();
    } catch {}
  });

  it('when 0 invoices exist and opening sequence is 56 for FY 2026-27, finalization allocates sequence 56 (SKT/2026-27/056)', async () => {
    // Configure opening sequence 56 for FY 2026-27
    db.prepare(`
      UPDATE settings
      SET opening_invoice_sequences = ?
      WHERE id = 'default'
    `).run(JSON.stringify({ '2026-27': 56 }));

    db.prepare(`
      INSERT INTO invoice_sequences (financial_year, next_sequence)
      VALUES ('2026-27', 56)
      ON CONFLICT(financial_year) DO UPDATE SET next_sequence = 56
    `).run();

    // Verify invoices table is still empty before finalization
    expect(db.prepare('SELECT COUNT(*) as count FROM invoices').get().count).toBe(0);

    // Finalize first invoice
    const finalizeRes = await makeRequest({
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
              { id: 'we_1', description: 'Sample Bleaching', rolls: 2, weightDisplay: '150.000', weightKg: 150, rate: 40, amount: 6000, sortOrder: 0 }
            ]
          }
        ],
        calculations: {
          subtotal: 6000,
          cgstRate: 2.5,
          sgstRate: 2.5,
          cgstAmount: 150,
          sgstAmount: 150,
          preRoundTotal: 6300,
          roundOff: 0,
          totalAmount: 6300,
          totalRolls: 2,
          totalWeightKg: 150,
          totalAmountInWords: 'Rupees Six Thousand Three Hundred Only'
        }
      }
    });

    expect(finalizeRes.statusCode).toBe(201);
    expect(finalizeRes.body.sequenceNumber).toBe(56);
    expect(finalizeRes.body.invoiceNumber).toBe('SKT/2026-27/056');

    // Invoices count is now 1
    expect(db.prepare('SELECT COUNT(*) as count FROM invoices').get().count).toBe(1);

    // Next sequence in DB is now 57
    const seqRow = db.prepare('SELECT next_sequence FROM invoice_sequences WHERE financial_year = ?').get('2026-27');
    expect(seqRow.next_sequence).toBe(57);
  });
});
