const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@libsql/client');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ----------------------------------------------------------------------------
// DUAL-MODE CONNECTION:
// 1. If TURSO_DATABASE_URL is set: connects to Turso cloud over libsql:// or https://
// 2. If TURSO_DATABASE_URL is not set: uses local SQLite through file: protocol
// ----------------------------------------------------------------------------
const DB_PATH = path.join(DATA_DIR, 'skt_billing.db');
const dbUrl = process.env.TURSO_DATABASE_URL || `file:${path.resolve(DB_PATH)}`;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const client = createClient({
  url: dbUrl,
  authToken,
});

// ----------------------------------------------------------------------------
// ASYNC DATABASE ABSTRACTION:
// Exposes db.get, db.all, db.run, db.exec, and db.transaction('immediate', ...)
// ----------------------------------------------------------------------------
const db = {
  client,

  /**
   * Fetch a single row as an object, or null if no row found.
   */
  async get(sql, args = []) {
    const res = await client.execute({ sql, args });
    return res.rows.length > 0 ? res.rows[0] : null;
  },

  /**
   * Fetch all rows matching the query as an array of objects.
   */
  async all(sql, args = []) {
    const res = await client.execute({ sql, args });
    return res.rows;
  },

  /**
   * Execute an INSERT/UPDATE/DELETE statement.
   * Returns { changes: number, lastInsertRowid: bigint | undefined }.
   */
  async run(sql, args = []) {
    const res = await client.execute({ sql, args });
    return {
      changes: res.rowsAffected,
      lastInsertRowid: res.lastInsertRowid,
    };
  },

  /**
   * Execute multiple raw SQL statements separated by semicolons.
   */
  async exec(sql) {
    return await client.executeMultiple(sql);
  },

  /**
   * Execute operations within an interactive transaction with immediate locking.
   * mode: 'immediate' (mapped to libSQL 'write') | 'read' | 'deferred'
   */
  async transaction(mode = 'immediate', callback) {
    const libMode = mode === 'immediate' ? 'write' : mode;
    const tx = await client.transaction(libMode);
    try {
      const wrappedTx = {
        get: async (sql, args = []) => {
          const res = await tx.execute({ sql, args });
          return res.rows.length > 0 ? res.rows[0] : null;
        },
        all: async (sql, args = []) => {
          const res = await tx.execute({ sql, args });
          return res.rows;
        },
        run: async (sql, args = []) => {
          const res = await tx.execute({ sql, args });
          return {
            changes: res.rowsAffected,
            lastInsertRowid: res.lastInsertRowid,
          };
        },
        execute: (params) => tx.execute(params),
      };
      const result = await callback(wrappedTx);
      await tx.commit();
      return result;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  },

  close() {
    client.close();
  },
};

// ----------------------------------------------------------------------------
// EXACT SCHEMA INITIALIZATION & MIGRATIONS
// Preserves all existing tables, column types, constraints, and initial seeds
// ----------------------------------------------------------------------------
async function initDb() {
  // Pragmas
  try {
    await client.execute('PRAGMA foreign_keys = ON;');
  } catch (_) {}

  // Initialize tables (exact existing schema)
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      business_name TEXT NOT NULL,
      address TEXT NOT NULL,
      gstin TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      ifsc_code TEXT NOT NULL,
      branch TEXT NOT NULL,
      default_cgst_rate REAL NOT NULL,
      default_sgst_rate REAL NOT NULL,
      invoice_prefix TEXT NOT NULL,
      financial_year_override TEXT,
      opening_invoice_sequences TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parties (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      gstin TEXT NOT NULL,
      phone TEXT NOT NULL,
      notes TEXT,
      is_archived INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_memory (
      id TEXT PRIMARY KEY,
      party_id TEXT NOT NULL,
      normalized_description TEXT NOT NULL,
      suggested_rate REAL NOT NULL,
      last_used_date TEXT NOT NULL,
      last_used_invoice_number TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE(party_id, normalized_description)
    );

    CREATE TABLE IF NOT EXISTS active_draft (
      id TEXT PRIMARY KEY,
      party_id TEXT,
      invoice_date TEXT,
      dcs_json TEXT NOT NULL,
      calculations_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      financial_year TEXT NOT NULL,
      sequence_number INTEGER NOT NULL,
      invoice_date TEXT NOT NULL,
      status TEXT NOT NULL,
      party_id TEXT NOT NULL,
      party_name_snapshot TEXT NOT NULL,
      party_address_snapshot TEXT NOT NULL,
      party_gstin_snapshot TEXT NOT NULL,
      party_phone_snapshot TEXT NOT NULL,
      bank_name_snapshot TEXT NOT NULL,
      branch_snapshot TEXT NOT NULL,
      account_number_snapshot TEXT NOT NULL,
      ifsc_code_snapshot TEXT NOT NULL,
      dcs_json TEXT NOT NULL,
      calculations_json TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      paid_amount REAL NOT NULL,
      outstanding_amount REAL NOT NULL,
      payments_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      finalized_at TEXT NOT NULL,
      cancelled_at TEXT,
      cancellation_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS invoice_sequences (
      financial_year TEXT PRIMARY KEY,
      next_sequence INTEGER NOT NULL
    );
  `);

  // Safe migrations for financial_year_override and opening_invoice_sequences if existing DB
  try {
    await client.execute('ALTER TABLE settings ADD COLUMN financial_year_override TEXT;');
  } catch (_) {}
  try {
    await client.execute('ALTER TABLE settings ADD COLUMN opening_invoice_sequences TEXT;');
  } catch (_) {}
  try {
    await client.execute('ALTER TABLE parties ADD COLUMN is_archived INTEGER DEFAULT 0;');
  } catch (_) {}
  try {
    await client.execute('ALTER TABLE invoices ADD COLUMN cancelled_at TEXT;');
  } catch (_) {}
  try {
    await client.execute('ALTER TABLE invoices ADD COLUMN cancellation_reason TEXT;');
  } catch (_) {}

  // Seed default settings if empty
  const settingsRes = await client.execute('SELECT COUNT(*) as count FROM settings');
  const settingsCount = settingsRes.rows[0]?.count || 0;
  if (settingsCount === 0) {
    await client.execute({
      sql: `
        INSERT INTO settings (
          id, business_name, address, gstin, phone, email,
          bank_name, account_number, ifsc_code, branch,
          default_cgst_rate, default_sgst_rate, invoice_prefix, updated_at
        ) VALUES (
          'default', 'SRI KRISHNA TEXTILE', '12, Mill Road, Tirupur - 641 602, Tamil Nadu',
          '33AAAAA0000A1Z5', '9876543210', 'srikrishnatextile@example.com',
          'State Bank of India', '12345678901234', 'SBIN0001234', 'Tirupur Main',
          2.5, 2.5, 'SKT', datetime('now')
        )
      `,
      args: [],
    });
  }

  // Seed initial parties if empty
  const partiesRes = await client.execute('SELECT COUNT(*) as count FROM parties');
  const partiesCount = partiesRes.rows[0]?.count || 0;
  if (partiesCount === 0) {
    await client.execute({
      sql: 'INSERT INTO parties (id, name, address, gstin, phone, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))',
      args: ['party_1', 'ABC Fabrics Private Limited', '45, Cotton Market Ring Road, Tirupur - 641 604, Tamil Nadu', '33ABCDE1234F1Z9', '9842111223', 'Regular customer for cotton and bio-wash lots'],
    });
    await client.execute({
      sql: 'INSERT INTO parties (id, name, address, gstin, phone, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))',
      args: ['party_2', 'Sree Amman Knits', '88, Avinashi Road, Tirupur - 641 652, Tamil Nadu', '33BCDEF2345G2Z0', '9842233445', 'Heat setting and dark shade dyeing'],
    });
    await client.execute({
      sql: 'INSERT INTO parties (id, name, address, gstin, phone, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))',
      args: ['party_3', 'Lotus Garments & Processors', '102, Angeripalayam Main Road, Tirupur - 641 603, Tamil Nadu', '33CDEFG3456H3Z1', '9842355667', 'Single jersey and interlock fabrics'],
    });
  }

  // Seed initial rate memory if empty
  const rateRes = await client.execute('SELECT COUNT(*) as count FROM rate_memory');
  const rateCount = rateRes.rows[0]?.count || 0;
  if (rateCount === 0) {
    await client.execute({
      sql: 'INSERT INTO rate_memory (id, party_id, normalized_description, suggested_rate, last_used_date, last_used_invoice_number, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))',
      args: ['rm_1', 'party_1', 'navy blue dyeing', 45.0, '2026-03-25', 'SKT/2025-26/001'],
    });
  }
}

// Automatically initiate schema creation on module load
const initPromise = initDb().catch((err) => {
  console.error('[db] Error initializing database schema:', err);
});

module.exports = {
  db,
  client,
  initDb,
  initPromise,
  DATA_DIR,
  DB_PATH,
};
