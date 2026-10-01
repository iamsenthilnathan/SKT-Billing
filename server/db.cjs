const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'skt_billing.db');
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for high concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables
db.exec(`
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

// Safe migration for financial_year_override and opening_invoice_sequences if existing DB
try {
  db.exec('ALTER TABLE settings ADD COLUMN financial_year_override TEXT;');
} catch (_) {
  // Column already exists
}
try {
  db.exec('ALTER TABLE settings ADD COLUMN opening_invoice_sequences TEXT;');
} catch (_) {
  // Column already exists
}
try {
  db.exec('ALTER TABLE parties ADD COLUMN is_archived INTEGER DEFAULT 0;');
} catch (_) {
  // Column already exists
}
try {
  db.exec('ALTER TABLE invoices ADD COLUMN cancelled_at TEXT;');
} catch (_) {
  // Column already exists
}
try {
  db.exec('ALTER TABLE invoices ADD COLUMN cancellation_reason TEXT;');
} catch (_) {
  // Column already exists
}

// Seed default settings if empty
const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;
if (settingsCount === 0) {
  const insertSettings = db.prepare(`
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
  `);
  insertSettings.run();
}

// Seed initial parties if empty
const partiesCount = db.prepare('SELECT COUNT(*) as count FROM parties').get().count;
if (partiesCount === 0) {
  const insertParty = db.prepare(`
    INSERT INTO parties (id, name, address, gstin, phone, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  insertParty.run('party_1', 'ABC Fabrics Private Limited', '45, Cotton Market Ring Road, Tirupur - 641 604, Tamil Nadu', '33ABCDE1234F1Z9', '9842111223', 'Regular customer for cotton and bio-wash lots');
  insertParty.run('party_2', 'Sree Amman Knits', '88, Avinashi Road, Tirupur - 641 652, Tamil Nadu', '33BCDEF2345G2Z0', '9842233445', 'Heat setting and dark shade dyeing');
  insertParty.run('party_3', 'Lotus Garments & Processors', '102, Angeripalayam Main Road, Tirupur - 641 603, Tamil Nadu', '33CDEFG3456H3Z1', '9842355667', 'Single jersey and interlock fabrics');
}

// Seed initial rate memory if empty
const rateCount = db.prepare('SELECT COUNT(*) as count FROM rate_memory').get().count;
if (rateCount === 0) {
  const insertRate = db.prepare(`
    INSERT INTO rate_memory (id, party_id, normalized_description, suggested_rate, last_used_date, last_used_invoice_number, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  insertRate.run('rm_1', 'party_1', 'navy blue dyeing', 45.0, '2026-03-25', 'SKT/2025-26/001');
}

module.exports = { db };

