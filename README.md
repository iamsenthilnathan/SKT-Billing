# Sri Krishna Textile — Billing System & Challan Reconciler

A specialized, full-stack B2B billing platform and delivery challan reconciliation engine custom-engineered for commercial textile job-work and fabric processing (dyeing, bleaching, compacting, heat setting, bio-wash) in Tirupur, India.

Designed with an emphasis on **high-density data entry ergonomics**, **multi-delivery challan reconciliation**, and **audit-safe financial calculations**.

---

## 🎯 The Problem & Product Design Context

In industrial textile clusters like Tirupur, fabric processing billing diverges significantly from traditional retail or wholesale invoicing:

1. **Multi-Delivery Challan (DC) Reconciliation**: A single customer dyeing lot frequently arrives in separate truckloads under different customer Delivery Challans (e.g., DC 401 on Monday, DC 405 on Wednesday). Traditional billing tools force operators into disjointed multi-invoice paperwork or unreadable flat line items.
2. **Fractional Roll Weights**: Industrial weighbridge scales record net roll weights with 3-decimal precision (e.g., `120.450 kg`, `98.250 kg`). Fast keyboard data entry often causes floating-point math errors.
3. **GST & Indian Currency Rounding**: Supports configurable CGST/SGST calculations and nearest-rupee invoice rounding, with Indian numbering words (*Rupees ... Only*).
4. **Invoice Integrity & Sequence Guarantees**: Finalized invoices are protected from silent deletion or sequence regression, with cancellation handled explicitly to preserve invoice history.

---

## ✨ Key Product Features

- **Delivery Challan Grouping**: Organizes line items into structured Delivery Challan blocks preserving *Our DC No*, *Customer DC No*, *DC Date*, and individual roll descriptions, counts, weights, and rates.
- **Precision Weight Tokenizer**: Custom parser normalizes fractional roll weights (`KG.GGG`) with zero floating-point accumulation discrepancies.
- **Dynamic Rate Memory Engine**: Caches negotiated job rates per customer and process description (`UNIQUE(party_id, description)`), automatically suggesting recent rates during entry.
- **Audit-Safe Non-Destructive Cancellation**: Finalized bills are immutable. Corrections are handled through formal cancellation with mandatory reason logging (`status = 'cancelled'`), preserving sequence numbers for audit compliance.
- **Responsive Multi-Device UX**:
  - **Desktop (>= 768px)**: High-density workspace optimized for rapid keyboard-only data entry.
  - **Mobile (< 768px)**: Streamlined overview with financial metric cards, recent invoices list, and an accessible slide-out navigation drawer.
- **Dual-Mode libSQL Database**:
  - **Local Development**: Seamless zero-config local SQLite storage (`./data/skt_billing.db`).
  - **Cloud Production**: Production data is persisted in Turso Cloud, allowing the stateless Render application to safely restart or sleep without losing billing data.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Lucide React, Framer Motion |
| **Build & Tooling** | Vite 8, Vitest, Oxlint |
| **Backend** | Node.js 22 LTS (Native `node:http`), `@libsql/client` (dual-mode libSQL / SQLite) |
| **Authentication** | Cryptographic Session Cookies (`skt_session`), HMAC-SHA256, `crypto.timingSafeEqual` |
| **Database** | Turso Cloud (libSQL in production) / Local SQLite (in development) |

---

## 🏗️ System Architecture

```text
[ Client Browser (React 19 + TypeScript + Tailwind v4) ]
                          │
               HTTPS / Session Cookie
                          ▼
[ Node.js 22 Server (Native HTTP Daemon) ]
  ├── apiHandler.cjs (REST API & Auth Session Gate)
  └── db.cjs (Async @libsql/client Dual-Mode Layer)
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
   [ Local SQLite (Dev) ]     [ Turso Cloud (Prod) ]
    ./data/skt_billing.db      Encrypted libSQL over TLS
```

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js 22 LTS or newer
- npm 10+

### Installation & Launch
```bash
# 1. Clone the repository
git clone https://github.com/iamsenthilnathan/SKT-Billing.git
cd SKT-Billing

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

> **Note on Zero Configuration**: In local development, the application automatically initializes a local SQLite database in `./data/skt_billing.db` with sample demo parties and settings. No cloud accounts, database keys, or external services are required to run the project locally.

---

## 🧪 Testing & Verification

The project includes 17 test suites with 162 automated tests covering calculations, weight parsing, storage services, navigation, and API security.

```bash
# Run unit and integration test suite
npm test

# Run production build validation
npm run build
```

---

## 🔒 Security & Privacy

- **Zero Hardcoded Secrets**: All production credentials, database URLs, and session secrets are managed exclusively through environment variables.
- **Stateless/Local Fallbacks**: Local development uses safe mock identifiers and local files. No real customer records or production credentials reside in the git tree.
- **Timing-Attack Resistance**: Session verification utilizes `crypto.timingSafeEqual` for constant-time credential comparison.

---

## 📄 License

Private commercial software created for Sri Krishna Textile. Code repository published for technical portfolio demonstration.
