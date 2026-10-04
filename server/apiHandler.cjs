const { db } = require('./db.cjs');
const {
  validateCredentials,
  createSessionToken,
  getSessionFromRequest,
  createSetCookieHeader,
  createClearCookieHeader,
} = require('./auth.cjs');

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

async function handleApiRequest(req, res, next) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    return res.end();
  }

  // Parse path relative to /api
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname.replace(/^\/api/, '') || '/';

  // Health endpoint does not require auth
  if (pathname === '/health' && req.method === 'GET') {
    return sendJson(res, 200, { status: 'healthy', database: 'sqlite', timestamp: new Date().toISOString() });
  }

  // ------------------------------------------------------------------------
  // AUTHENTICATION ENDPOINTS (Public)
  // ------------------------------------------------------------------------
  if (pathname === '/auth/login' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const { username, password } = body;
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return sendJson(res, 400, { error: 'Username and password are required' });
    }
    if (!validateCredentials(username.trim(), password)) {
      return sendJson(res, 401, { error: 'Invalid username or password' });
    }
    const token = createSessionToken(username.trim());
    res.setHeader('Set-Cookie', createSetCookieHeader(token, req));
    return sendJson(res, 200, { success: true, user: { username: username.trim() } });
  }

  if (pathname === '/auth/logout' && req.method === 'POST') {
    res.setHeader('Set-Cookie', createClearCookieHeader(req));
    return sendJson(res, 200, { success: true });
  }

  if (pathname === '/auth/me' && req.method === 'GET') {
    const session = getSessionFromRequest(req);
    if (!session) {
      return sendJson(res, 401, { authenticated: false, error: 'Not authenticated' });
    }
    return sendJson(res, 200, { authenticated: true, user: { username: session.username } });
  }

  // Session verification gate for all protected API endpoints
  const session = getSessionFromRequest(req);
  if (!session) {
    return sendJson(res, 401, { error: 'Authentication required', authenticated: false });
  }

  try {
    // ------------------------------------------------------------------------
    // 1. FULL SYNC STATE (GET /sync/state)
    // ------------------------------------------------------------------------
    if (pathname === '/sync/state' && req.method === 'GET') {
      const rawSettings = await db.get('SELECT * FROM settings WHERE id = ?', ['default']);
      const settings = rawSettings ? {
        id: rawSettings.id,
        businessName: rawSettings.business_name,
        address: rawSettings.address,
        gstin: rawSettings.gstin,
        phone: rawSettings.phone,
        email: rawSettings.email,
        bankName: rawSettings.bank_name,
        accountNumber: rawSettings.account_number,
        ifscCode: rawSettings.ifsc_code,
        branch: rawSettings.branch,
        defaultCgstRate: rawSettings.default_cgst_rate,
        defaultSgstRate: rawSettings.default_sgst_rate,
        invoicePrefix: rawSettings.invoice_prefix,
        financialYearOverride: rawSettings.financial_year_override || '',
        openingInvoiceSequences: rawSettings.opening_invoice_sequences ? JSON.parse(rawSettings.opening_invoice_sequences) : {},
      } : null;

      const rawParties = await db.all('SELECT * FROM parties ORDER BY created_at ASC');
      const parties = rawParties.map(p => ({
        id: p.id,
        name: p.name,
        address: p.address,
        gstin: p.gstin,
        phone: p.phone,
        notes: p.notes,
        isArchived: Boolean(p.is_archived),
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));

      const rawRates = await db.all('SELECT * FROM rate_memory ORDER BY updated_at DESC');
      const rateMemory = rawRates.map(r => ({
        id: r.id,
        partyId: r.party_id,
        normalizedDescription: r.normalized_description,
        suggestedRate: r.suggested_rate,
        lastUsedDate: r.last_used_date,
        lastUsedInvoiceNumber: r.last_used_invoice_number,
      }));

      const rawInvoices = await db.all('SELECT * FROM invoices ORDER BY sequence_number DESC');
      const invoices = rawInvoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        financialYear: inv.financial_year,
        sequenceNumber: inv.sequence_number,
        invoiceDate: inv.invoice_date,
        status: inv.status,
        partyId: inv.party_id,
        partyNameSnapshot: inv.party_name_snapshot,
        partyAddressSnapshot: inv.party_address_snapshot,
        partyGstinSnapshot: inv.party_gstin_snapshot,
        partyPhoneSnapshot: inv.party_phone_snapshot,
        bankNameSnapshot: inv.bank_name_snapshot,
        branchSnapshot: inv.branch_snapshot,
        accountNumberSnapshot: inv.account_number_snapshot,
        ifscCodeSnapshot: inv.ifsc_code_snapshot,
        dcs: JSON.parse(inv.dcs_json),
        calculations: JSON.parse(inv.calculations_json),
        paymentStatus: inv.payment_status,
        paidAmount: inv.paid_amount,
        outstandingAmount: inv.outstanding_amount,
        payments: JSON.parse(inv.payments_json || '[]'),
        createdAt: inv.created_at,
        updatedAt: inv.updated_at,
        finalizedAt: inv.finalized_at,
        cancelledAt: inv.cancelled_at || undefined,
        cancellationReason: inv.cancellation_reason || undefined,
      }));

      const rawDrafts = await db.all('SELECT * FROM active_draft ORDER BY updated_at DESC');
      const drafts = rawDrafts.map(r => ({
        id: r.id,
        partyId: r.party_id,
        invoiceDate: r.invoice_date,
        dcs: JSON.parse(r.dcs_json),
        calculations: JSON.parse(r.calculations_json),
        updatedAt: r.updated_at,
      }));
      const activeDraft = drafts.length > 0 ? drafts[0] : null;

      return sendJson(res, 200, {
        serverTime: new Date().toISOString(),
        settings,
        parties,
        rateMemory,
        invoices,
        drafts,
        activeDraft,
      });
    }

    // ------------------------------------------------------------------------
    // 2. ACTIVE DRAFT SYNC (GET, PUT, DELETE /draft, /drafts)
    // ------------------------------------------------------------------------
    if (pathname === '/draft' || pathname === '/drafts' || pathname.startsWith('/drafts/')) {
      if (req.method === 'GET') {
        if (pathname === '/drafts') {
          const rawDrafts = await db.all('SELECT * FROM active_draft ORDER BY updated_at DESC');
          return sendJson(res, 200, rawDrafts.map(r => ({
            id: r.id,
            partyId: r.party_id,
            invoiceDate: r.invoice_date,
            dcs: JSON.parse(r.dcs_json),
            calculations: JSON.parse(r.calculations_json),
            updatedAt: r.updated_at,
          })));
        }

        const draftId = urlObj.searchParams.get('id') || (pathname.startsWith('/drafts/') ? pathname.replace('/drafts/', '') : null);
        let rawDraft;
        if (draftId) {
          rawDraft = await db.get('SELECT * FROM active_draft WHERE id = ?', [draftId]);
        } else {
          rawDraft = await db.get('SELECT * FROM active_draft ORDER BY updated_at DESC LIMIT 1');
        }

        if (!rawDraft) return sendJson(res, 200, null);
        return sendJson(res, 200, {
          id: rawDraft.id,
          partyId: rawDraft.party_id,
          invoiceDate: rawDraft.invoice_date,
          dcs: JSON.parse(rawDraft.dcs_json),
          calculations: JSON.parse(rawDraft.calculations_json),
          updatedAt: rawDraft.updated_at,
        });
      }

      if (req.method === 'PUT' || req.method === 'POST') {
        const data = await parseJsonBody(req);
        if (!data || !data.id) {
          return sendJson(res, 400, { error: 'Draft id is required' });
        }

        const now = data.updatedAt || new Date().toISOString();
        await db.run(`
          INSERT INTO active_draft (id, party_id, invoice_date, dcs_json, calculations_json, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            party_id = excluded.party_id,
            invoice_date = excluded.invoice_date,
            dcs_json = excluded.dcs_json,
            calculations_json = excluded.calculations_json,
            updated_at = excluded.updated_at
        `, [
          data.id,
          data.partyId || null,
          data.invoiceDate || null,
          JSON.stringify(data.dcs || []),
          JSON.stringify(data.calculations || {}),
          now
        ]);

        return sendJson(res, 200, { success: true, id: data.id, updatedAt: now });
      }

      if (req.method === 'DELETE') {
        const draftId = urlObj.searchParams.get('id') || (pathname.startsWith('/drafts/') ? pathname.replace('/drafts/', '') : null);
        if (draftId) {
          await db.run('DELETE FROM active_draft WHERE id = ?', [draftId]);
        } else {
          await db.run('DELETE FROM active_draft');
        }
        return sendJson(res, 200, { success: true, deletedId: draftId || 'all' });
      }
    }

    // ------------------------------------------------------------------------
    // 3. PARTIES CRUD (/parties)
    // ------------------------------------------------------------------------
    if (pathname === '/parties') {
      if (req.method === 'GET') {
        const rows = await db.all('SELECT * FROM parties ORDER BY name ASC');
        return sendJson(res, 200, rows.map(p => ({
          id: p.id,
          name: p.name,
          address: p.address,
          gstin: p.gstin,
          phone: p.phone,
          notes: p.notes,
          isArchived: Boolean(p.is_archived),
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        })));
      }

      if (req.method === 'POST') {
        const p = await parseJsonBody(req);
        if (!p.name || !p.address || !p.gstin || !p.phone) {
          return sendJson(res, 400, { error: 'Name, address, GSTIN, and phone are mandatory' });
        }

        const partyId = p.id || `party_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const now = new Date().toISOString();
        const isArchived = p.isArchived ? 1 : 0;

        await db.run(`
          INSERT INTO parties (id, name, address, gstin, phone, notes, is_archived, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [partyId, p.name.trim(), p.address.trim(), p.gstin.trim().toUpperCase(), p.phone.trim(), p.notes || null, isArchived, now, now]);

        return sendJson(res, 201, {
          id: partyId,
          name: p.name.trim(),
          address: p.address.trim(),
          gstin: p.gstin.trim().toUpperCase(),
          phone: p.phone.trim(),
          notes: p.notes || undefined,
          isArchived: Boolean(isArchived),
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (pathname.startsWith('/parties/')) {
      const partyId = pathname.replace('/parties/', '');
      if (req.method === 'PUT') {
        const p = await parseJsonBody(req);
        const existing = await db.get('SELECT * FROM parties WHERE id = ?', [partyId]);
        if (!existing) {
          return sendJson(res, 404, { error: 'Party not found' });
        }

        const name = p.name !== undefined ? p.name.trim() : existing.name;
        const address = p.address !== undefined ? p.address.trim() : existing.address;
        const gstin = p.gstin !== undefined ? p.gstin.trim().toUpperCase() : existing.gstin;
        const phone = p.phone !== undefined ? p.phone.trim() : existing.phone;
        const notes = p.notes !== undefined ? (p.notes ? p.notes.trim() : null) : existing.notes;
        const isArchived = p.isArchived !== undefined ? (p.isArchived ? 1 : 0) : existing.is_archived;
        const now = new Date().toISOString();

        await db.run(`
          UPDATE parties SET
            name = ?, address = ?, gstin = ?, phone = ?, notes = ?, is_archived = ?, updated_at = ?
          WHERE id = ?
        `, [name, address, gstin, phone, notes, isArchived, now, partyId]);
        return sendJson(res, 200, {
          success: true,
          id: partyId,
          name,
          address,
          gstin,
          phone,
          notes: notes || undefined,
          isArchived: Boolean(isArchived),
          updatedAt: now,
        });
      }

      if (req.method === 'DELETE') {
        const refInvoice = await db.get('SELECT id, invoice_number FROM invoices WHERE party_id = ? LIMIT 1', [partyId]);
        if (refInvoice) {
          return sendJson(res, 400, {
            error: `Cannot delete customer: Referenced by invoice ${refInvoice.invoice_number || refInvoice.id}. Archive this customer instead.`,
            referenced: true,
            invoiceNumber: refInvoice.invoice_number,
          });
        }
        await db.run('DELETE FROM parties WHERE id = ?', [partyId]);
        await db.run('DELETE FROM rate_memory WHERE party_id = ?', [partyId]);
        return sendJson(res, 200, { success: true, deletedId: partyId });
      }
    }

    // ------------------------------------------------------------------------
    // 4. ATOMIC INVOICE FINALIZATION (/invoices/finalize)
    // ------------------------------------------------------------------------
    if (pathname === '/invoices/finalize' && req.method === 'POST') {
      const data = await parseJsonBody(req);
      const { financialYear, partyId, invoiceDate, dcs, calculations, draftId } = data;

      if (!financialYear || !partyId || !dcs || !calculations) {
        return sendJson(res, 400, { error: 'Missing required invoice payload' });
      }

      // Execute within an IMMEDIATE transaction for concurrency lock
      try {
        const finalizedInvoice = await db.transaction('immediate', async (tx) => {
          // 1. Get next atomic sequence number for this financial year
          const rawSettings = await tx.get('SELECT * FROM settings WHERE id = ?', ['default']);
          const openingSequences = (rawSettings && rawSettings.opening_invoice_sequences)
            ? JSON.parse(rawSettings.opening_invoice_sequences)
            : {};
          const configuredOpening = openingSequences[financialYear] ? Number(openingSequences[financialYear]) : 1;

          const maxRow = await tx.get('SELECT MAX(sequence_number) as max_seq FROM invoices WHERE financial_year = ?', [financialYear]);
          const maxFinalized = (maxRow && maxRow.max_seq) ? maxRow.max_seq : 0;

          const seqRow = await tx.get('SELECT next_sequence FROM invoice_sequences WHERE financial_year = ?', [financialYear]);
          const currentNextSeq = seqRow ? seqRow.next_sequence : 1;

          // Sequence must respect configured opening sequence and max finalized sequence
          const sequenceNumber = Math.max(configuredOpening, maxFinalized + 1, currentNextSeq);

          // Update sequence for next bill
          await tx.run(`
            INSERT INTO invoice_sequences (financial_year, next_sequence)
            VALUES (?, ?)
            ON CONFLICT(financial_year) DO UPDATE SET next_sequence = ?
          `, [financialYear, sequenceNumber + 1, sequenceNumber + 1]);

          // 2. Fetch current settings snapshot
          const prefix = rawSettings ? rawSettings.invoice_prefix : 'SKT';
          const invoiceNumber = `${prefix}/${financialYear}/${String(sequenceNumber).padStart(3, '0')}`;

          // 3. Fetch party snapshot
          const party = await tx.get('SELECT * FROM parties WHERE id = ? OR name = ?', [partyId, partyId]);
          if (!party) {
            throw new Error(`Party with id or name "${partyId}" not found`);
          }

          const now = new Date().toISOString();
          const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const finalTotalAmount = Number(calculations?.totalAmount ?? calculations?.grandTotal ?? 0);

          // 4. Insert finalized invoice with immutable bank & party snapshots
          await tx.run(`
            INSERT INTO invoices (
              id, invoice_number, financial_year, sequence_number, invoice_date, status,
              party_id, party_name_snapshot, party_address_snapshot, party_gstin_snapshot, party_phone_snapshot,
              bank_name_snapshot, branch_snapshot, account_number_snapshot, ifsc_code_snapshot,
              dcs_json, calculations_json, payment_status, paid_amount, outstanding_amount, payments_json,
              created_at, updated_at, finalized_at
            ) VALUES (
              ?, ?, ?, ?, ?, 'finalized',
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, 'unpaid', 0, ?, '[]',
              ?, ?, ?
            )
          `, [
            invoiceId,
            invoiceNumber,
            financialYear,
            sequenceNumber,
            invoiceDate || now.split('T')[0],
            party.id,
            party.name,
            party.address,
            party.gstin,
            party.phone,
            rawSettings ? rawSettings.bank_name : '',
            rawSettings ? rawSettings.branch : '',
            rawSettings ? rawSettings.account_number : '',
            rawSettings ? rawSettings.ifsc_code : '',
            JSON.stringify(dcs || []),
            JSON.stringify(calculations || {}),
            finalTotalAmount,
            now,
            now,
            now
          ]);

          // 5. Record rate memory
          for (const dc of dcs) {
            for (const entry of (dc.workEntries || [])) {
              if (entry.description && entry.description.trim() && entry.rate > 0) {
                const norm = entry.description.trim().toLowerCase();
                const rmId = `rm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                await tx.run(`
                  INSERT INTO rate_memory (id, party_id, normalized_description, suggested_rate, last_used_date, last_used_invoice_number, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(party_id, normalized_description) DO UPDATE SET
                    suggested_rate = excluded.suggested_rate,
                    last_used_date = excluded.last_used_date,
                    last_used_invoice_number = excluded.last_used_invoice_number,
                    updated_at = excluded.updated_at
                `, [rmId, party.id, norm, entry.rate, invoiceDate || now.split('T')[0], invoiceNumber, now]);
              }
            }
          }

          // 6. Clear finalized draft (or all if draftId not specified)
          if (draftId) {
            await tx.run('DELETE FROM active_draft WHERE id = ?', [draftId]);
          } else {
            await tx.run('DELETE FROM active_draft');
          }

          return {
            id: invoiceId,
            invoiceNumber,
            financialYear,
            sequenceNumber,
            invoiceDate,
            status: 'finalized',
            partyId: party.id,
            partyNameSnapshot: party.name,
            partyAddressSnapshot: party.address,
            partyGstinSnapshot: party.gstin,
            partyPhoneSnapshot: party.phone,
            bankNameSnapshot: rawSettings ? rawSettings.bank_name : '',
            branchSnapshot: rawSettings ? rawSettings.branch : '',
            accountNumberSnapshot: rawSettings ? rawSettings.account_number : '',
            ifscCodeSnapshot: rawSettings ? rawSettings.ifsc_code : '',
            dcs,
            calculations,
            paymentStatus: 'unpaid',
            paidAmount: 0,
            outstandingAmount: finalTotalAmount,
            payments: [],
            createdAt: now,
            updatedAt: now,
            finalizedAt: now,
          };
        });

        return sendJson(res, 201, finalizedInvoice);
      } catch (err) {
        console.error('Finalization transaction error:', err);
        return sendJson(res, 500, { error: err.message });
      }
    }

    // ------------------------------------------------------------------------
    // 5. INVOICE PAYMENT RECORDING (/invoices/:id/payment)
    // ------------------------------------------------------------------------
    if (pathname.includes('/invoices/') && pathname.endsWith('/payment') && req.method === 'POST') {
      const parts = pathname.split('/');
      const invoiceId = parts[2];
      const { amount, date, notes } = await parseJsonBody(req);

      if (!amount || amount <= 0) {
        return sendJson(res, 400, { error: 'Valid payment amount is required' });
      }

      try {
        const result = await db.transaction('immediate', async (tx) => {
          const inv = await tx.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
          if (!inv) {
            const err = new Error('Invoice not found');
            err.statusCode = 404;
            throw err;
          }

          if (inv.status === 'cancelled') {
            const err = new Error('Cannot record payment on a cancelled invoice');
            err.statusCode = 400;
            throw err;
          }

          const currentPaid = inv.paid_amount || 0;
          const currentOutstanding = inv.outstanding_amount || 0;
          const newPaid = currentPaid + amount;
          const newOutstanding = Math.max(0, currentOutstanding - amount);
          const newStatus = newOutstanding === 0 ? 'paid' : 'partially_paid';

          const payments = JSON.parse(inv.payments_json || '[]');
          payments.push({
            id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            amount,
            date: date || new Date().toISOString().split('T')[0],
            notes: notes || '',
            recordedAt: new Date().toISOString(),
          });

          const now = new Date().toISOString();
          await tx.run(`
            UPDATE invoices SET
              paid_amount = ?,
              outstanding_amount = ?,
              payment_status = ?,
              payments_json = ?,
              updated_at = ?
            WHERE id = ?
          `, [newPaid, newOutstanding, newStatus, JSON.stringify(payments), now, invoiceId]);

          return { success: true, paidAmount: newPaid, outstandingAmount: newOutstanding, paymentStatus: newStatus };
        });

        return sendJson(res, 200, result);
      } catch (err) {
        const status = err.statusCode || 500;
        return sendJson(res, status, { error: err.message });
      }
    }

    // ------------------------------------------------------------------------
    // 5b. INVOICE CANCELLATION (/invoices/:id/cancel)
    // ------------------------------------------------------------------------
    if (pathname.includes('/invoices/') && pathname.endsWith('/cancel') && req.method === 'POST') {
      const parts = pathname.split('/');
      const invoiceId = parts[2];
      const { reason } = await parseJsonBody(req);

      try {
        const result = await db.transaction('immediate', async (tx) => {
          const inv = await tx.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
          if (!inv) {
            const err = new Error('Invoice not found');
            err.statusCode = 404;
            throw err;
          }

          if (inv.status === 'cancelled') {
            const err = new Error('Invoice is already cancelled');
            err.statusCode = 400;
            throw err;
          }

          if (inv.status !== 'finalized') {
            const err = new Error(`Cannot cancel invoice with status "${inv.status}". Only finalized invoices can be cancelled.`);
            err.statusCode = 400;
            throw err;
          }

          const now = new Date().toISOString();
          const cancellationReason = reason && typeof reason === 'string' && reason.trim() ? reason.trim() : null;

          await tx.run(`
            UPDATE invoices SET
              status = 'cancelled',
              cancelled_at = ?,
              cancellation_reason = ?,
              updated_at = ?
            WHERE id = ?
          `, [now, cancellationReason, now, invoiceId]);

          return {
            success: true,
            id: invoiceId,
            status: 'cancelled',
            cancelledAt: now,
            cancellationReason: cancellationReason || undefined,
            updatedAt: now,
          };
        });

        return sendJson(res, 200, result);
      } catch (err) {
        const status = err.statusCode || 500;
        return sendJson(res, status, { error: err.message });
      }
    }

    // ------------------------------------------------------------------------
    // 6. SETTINGS UPDATE (/settings)
    // ------------------------------------------------------------------------
    if (pathname === '/settings') {
      if (req.method === 'GET') {
        const rawSettings = await db.get('SELECT * FROM settings WHERE id = ?', ['default']);
        return sendJson(res, 200, rawSettings ? {
          id: rawSettings.id,
          businessName: rawSettings.business_name,
          address: rawSettings.address,
          gstin: rawSettings.gstin,
          phone: rawSettings.phone,
          email: rawSettings.email,
          bankName: rawSettings.bank_name,
          accountNumber: rawSettings.account_number,
          ifscCode: rawSettings.ifsc_code,
          branch: rawSettings.branch,
          defaultCgstRate: rawSettings.default_cgst_rate,
          defaultSgstRate: rawSettings.default_sgst_rate,
          invoicePrefix: rawSettings.invoice_prefix,
          financialYearOverride: rawSettings.financial_year_override || '',
          openingInvoiceSequences: rawSettings.opening_invoice_sequences ? JSON.parse(rawSettings.opening_invoice_sequences) : {},
        } : null);
      }

      if (req.method === 'PUT') {
        const s = await parseJsonBody(req);
        const now = new Date().toISOString();
        const openingJson = JSON.stringify(s.openingInvoiceSequences || {});

        // Validation: Ensure opening sequence cannot create duplicates with finalized invoices
        if (s.openingInvoiceSequences && typeof s.openingInvoiceSequences === 'object') {
          for (const [fy, seqVal] of Object.entries(s.openingInvoiceSequences)) {
            const seqNum = Number(seqVal);
            if (seqNum > 0) {
              const maxRow = await db.get('SELECT MAX(sequence_number) as max_seq FROM invoices WHERE financial_year = ?', [fy]);
              if (maxRow && maxRow.max_seq && seqNum <= maxRow.max_seq) {
                return sendJson(res, 400, {
                  error: `Cannot set sequence for FY ${fy} to ${seqNum}. Invoices up to sequence ${maxRow.max_seq} are already finalized. Next sequence must be at least ${maxRow.max_seq + 1} to prevent duplicate invoice numbers.`
                });
              }
            }
          }
        }

        await db.run(`
          UPDATE settings SET
            business_name = ?, address = ?, gstin = ?, phone = ?, email = ?,
            bank_name = ?, account_number = ?, ifsc_code = ?, branch = ?,
            default_cgst_rate = ?, default_sgst_rate = ?, invoice_prefix = ?,
            financial_year_override = ?, opening_invoice_sequences = ?,
            updated_at = ?
          WHERE id = 'default'
        `, [
          s.businessName, s.address, s.gstin, s.phone, s.email,
          s.bankName, s.accountNumber, s.ifscCode, s.branch,
          s.defaultCgstRate, s.defaultSgstRate, s.invoicePrefix,
          s.financialYearOverride || '',
          openingJson,
          now
        ]);

        // Update invoice_sequences next_sequence if configured
        if (s.openingInvoiceSequences && typeof s.openingInvoiceSequences === 'object') {
          for (const [fy, seqVal] of Object.entries(s.openingInvoiceSequences)) {
            const seqNum = Number(seqVal);
            if (seqNum > 0) {
              const maxRow = await db.get('SELECT MAX(sequence_number) as max_seq FROM invoices WHERE financial_year = ?', [fy]);
              const maxFinalized = (maxRow && maxRow.max_seq) ? maxRow.max_seq : 0;
              const targetNext = Math.max(seqNum, maxFinalized + 1);
              await db.run(`
                INSERT INTO invoice_sequences (financial_year, next_sequence)
                VALUES (?, ?)
                ON CONFLICT(financial_year) DO UPDATE SET next_sequence = ?
              `, [fy, targetNext, targetNext]);
            }
          }
        }

        return sendJson(res, 200, { success: true, updatedAt: now });
      }
    }

    // ------------------------------------------------------------------------
    // 7. MIGRATION FROM LOCALSTORAGE (/sync/migrate)
    // ------------------------------------------------------------------------
    if (pathname === '/sync/migrate' && req.method === 'POST') {
      const data = await parseJsonBody(req);
      const { parties, invoices, rateMemory, draft } = data;

      try {
        const migratedCount = await db.transaction('immediate', async (tx) => {
          let count = 0;
          if (Array.isArray(parties)) {
            for (const p of parties) {
              await tx.run(`
                INSERT OR IGNORE INTO parties (id, name, address, gstin, phone, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `, [p.id, p.name, p.address, p.gstin, p.phone, p.notes || null, p.createdAt || new Date().toISOString(), p.updatedAt || new Date().toISOString()]);
            }
          }

          if (Array.isArray(invoices)) {
            for (const inv of invoices) {
              const res = await tx.run(`
                INSERT OR IGNORE INTO invoices (
                  id, invoice_number, financial_year, sequence_number, invoice_date, status,
                  party_id, party_name_snapshot, party_address_snapshot, party_gstin_snapshot, party_phone_snapshot,
                  bank_name_snapshot, branch_snapshot, account_number_snapshot, ifsc_code_snapshot,
                  dcs_json, calculations_json, payment_status, paid_amount, outstanding_amount, payments_json,
                  created_at, updated_at, finalized_at, cancelled_at, cancellation_reason
                ) VALUES (
                  ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?, ?,
                  ?, ?, ?, ?,
                  ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?, ?
                )
              `, [
                inv.id, inv.invoiceNumber, inv.financialYear, inv.sequenceNumber, inv.invoiceDate, inv.status,
                inv.partyId, inv.partyNameSnapshot, inv.partyAddressSnapshot, inv.partyGstinSnapshot, inv.partyPhoneSnapshot,
                inv.bankNameSnapshot, inv.branchSnapshot, inv.accountNumberSnapshot, inv.ifscCodeSnapshot,
                JSON.stringify(inv.dcs), JSON.stringify(inv.calculations), inv.paymentStatus || 'unpaid',
                inv.paidAmount || 0, inv.outstandingAmount || inv.calculations.totalAmount, JSON.stringify(inv.payments || []),
                inv.createdAt || new Date().toISOString(), inv.updatedAt || new Date().toISOString(), inv.finalizedAt || new Date().toISOString(),
                inv.cancelledAt || null, inv.cancellationReason || null
              ]);
              if (res.changes > 0) count++;
            }
          }

          if (Array.isArray(rateMemory)) {
            for (const rm of rateMemory) {
              await tx.run(`
                INSERT OR IGNORE INTO rate_memory (id, party_id, normalized_description, suggested_rate, last_used_date, last_used_invoice_number, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
              `, [rm.id, rm.partyId, rm.normalizedDescription, rm.suggestedRate, rm.lastUsedDate || '2026-03-25', rm.lastUsedInvoiceNumber || null]);
            }
          }

          if (draft && draft.id && draft.dcs && draft.dcs.length > 0) {
            const existingDraft = await tx.get('SELECT COUNT(*) as count FROM active_draft');
            if (existingDraft && existingDraft.count === 0) {
              await tx.run(`
                INSERT OR IGNORE INTO active_draft (id, party_id, invoice_date, dcs_json, calculations_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [draft.id, draft.partyId || null, draft.invoiceDate || null, JSON.stringify(draft.dcs), JSON.stringify(draft.calculations || {}), draft.updatedAt || new Date().toISOString()]);
            }
          }

          return count;
        });

        return sendJson(res, 200, { success: true, migratedInvoices: migratedCount });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    // 404 for unknown endpoints
    if (next) return next();
    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('API Error:', err);
    return sendJson(res, 500, { error: err.message });
  }
}

module.exports = { handleApiRequest };
