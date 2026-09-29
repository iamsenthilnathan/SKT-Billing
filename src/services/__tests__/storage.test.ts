import { describe, it, expect, beforeEach } from 'vitest';
import { storageService } from '../storage';
import type { Invoice } from '../../domain/types';

describe('Storage Service & Sequence Engine', () => {
  beforeEach(() => {
    storageService.clearAll();
  });

  it('loads default settings and saves modifications', () => {
    const settings = storageService.getSettings();
    expect(settings.businessName).toBe('SRI KRISHNA TEXTILE');
    expect(settings.invoicePrefix).toBe('SKT');

    storageService.saveSettings({
      ...settings,
      businessName: 'SRI KRISHNA DYEING PROCESS',
    });

    expect(storageService.getSettings().businessName).toBe('SRI KRISHNA DYEING PROCESS');
  });

  it('correctly increments invoice sequence per financial year and resets on new year', () => {
    expect(storageService.getNextInvoiceSequence('2026-27')).toBe(1);
    expect(storageService.getNextInvoiceNumberPreview('2026-27')).toBe('SKT/2026-27/001');

    const dummyInvoice: Invoice = {
      id: 'inv_1',
      invoiceNumber: 'SKT/2026-27/001',
      financialYear: '2026-27',
      sequenceNumber: 1,
      invoiceDate: '2026-09-28',
      status: 'finalized',
      partyId: 'party_1',
      partyNameSnapshot: 'ABC Fabrics',
      partyAddressSnapshot: 'Tirupur',
      partyGstinSnapshot: '33ABCDE1234F1Z9',
      partyPhoneSnapshot: '9842111223',
      bankNameSnapshot: 'State Bank of India',
      branchSnapshot: 'Tirupur Main',
      accountNumberSnapshot: '12345678901234',
      ifscCodeSnapshot: 'SBIN0001234',
      dcs: [],
      calculations: {
        totalRolls: 0,
        totalWeightKg: 0,
        subtotal: 0,
        cgstRate: 2.5,
        cgstAmount: 0,
        sgstRate: 2.5,
        sgstAmount: 0,
        preRoundTotal: 0,
        roundOff: 0,
        totalAmount: 0,
        totalAmountInWords: 'Rupees Zero Only',
      },
      paymentStatus: 'unpaid',
      paidAmount: 0,
      outstandingAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
    };

    storageService.saveInvoices([dummyInvoice]);

    // Next sequence in 2026-27 is 2
    expect(storageService.getNextInvoiceSequence('2026-27')).toBe(2);
    expect(storageService.getNextInvoiceNumberPreview('2026-27')).toBe('SKT/2026-27/002');

    // Rule: Drafts must NOT consume official invoice numbers
    storageService.saveActiveDraft({
      id: 'draft_999',
      partyId: 'party_1',
      invoiceDate: '2026-09-28',
      dcs: [],
    });
    // Sequence in 2026-27 remains 2 despite active draft
    expect(storageService.getNextInvoiceSequence('2026-27')).toBe(2);
    expect(storageService.getNextInvoiceNumberPreview('2026-27')).toBe('SKT/2026-27/002');

    // Rule: In a new financial year (e.g. 2027-28), invoice numbering resets to 001
    expect(storageService.getNextInvoiceSequence('2027-28')).toBe(1);
    expect(storageService.getNextInvoiceNumberPreview('2027-28')).toBe('SKT/2027-28/001');

    // Rule: Retain all previous financial years and their invoice sequences
    const dummyInvoice2027: Invoice = {
      ...dummyInvoice,
      id: 'inv_2',
      invoiceNumber: 'SKT/2027-28/001',
      financialYear: '2027-28',
      sequenceNumber: 1,
      invoiceDate: '2027-04-05',
    };
    storageService.saveInvoices([dummyInvoice, dummyInvoice2027]);

    // 2027-28 next is now 2
    expect(storageService.getNextInvoiceSequence('2027-28')).toBe(2);
    expect(storageService.getNextInvoiceNumberPreview('2027-28')).toBe('SKT/2027-28/002');

    // Previous year 2026-27 sequence is retained completely independently (still 2)
    expect(storageService.getNextInvoiceSequence('2026-27')).toBe(2);
    expect(storageService.getNextInvoiceNumberPreview('2026-27')).toBe('SKT/2026-27/002');
  });

  it('records and suggests contextual rates without forcing them', () => {
    storageService.recordRateUsage('party_1', 'Royal Navy Blue Dyeing', 48.50);

    const suggestion = storageService.getSuggestedRate('party_1', 'royal navy blue dyeing');
    expect(suggestion).toBeDefined();
    expect(suggestion?.suggestedRate).toBe(48.50);

    // Unrelated description returns undefined
    expect(storageService.getSuggestedRate('party_1', 'Bleaching Only')).toBeUndefined();
  });

  it('supports administrative opening sequence configuration and prevents duplicates', () => {
    // 1. Initial handover: Configure opening sequence 101 for FY 2026-27
    const settings = storageService.getSettings();
    storageService.saveSettings({
      ...settings,
      openingInvoiceSequences: {
        '2026-27': 101,
      },
    });

    // Before any invoices in 2026-27, next sequence is 101
    expect(storageService.getNextInvoiceSequence('2026-27')).toBe(101);
    expect(storageService.getNextInvoiceNumberPreview('2026-27')).toBe('SKT/2026-27/101');

    // 2. Finalize first invoice with sequence 101
    const invoice101: Invoice = {
      id: 'inv_101',
      invoiceNumber: 'SKT/2026-27/101',
      financialYear: '2026-27',
      sequenceNumber: 101,
      invoiceDate: '2026-09-28',
      status: 'finalized',
      partyId: 'party_1',
      partyNameSnapshot: 'ABC Fabrics',
      partyAddressSnapshot: 'Tirupur',
      partyGstinSnapshot: '33ABCDE1234F1Z9',
      partyPhoneSnapshot: '9842111223',
      bankNameSnapshot: 'State Bank of India',
      branchSnapshot: 'Tirupur Main',
      accountNumberSnapshot: '12345678901234',
      ifscCodeSnapshot: 'SBIN0001234',
      dcs: [],
      calculations: {
        totalRolls: 0,
        totalWeightKg: 0,
        subtotal: 0,
        cgstRate: 2.5,
        cgstAmount: 0,
        sgstRate: 2.5,
        sgstAmount: 0,
        preRoundTotal: 0,
        roundOff: 0,
        totalAmount: 0,
        totalAmountInWords: 'Rupees Zero Only',
      },
      paymentStatus: 'unpaid',
      paidAmount: 0,
      outstandingAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
    };
    storageService.saveInvoices([invoice101]);

    // Normal billing auto-increments to 102
    expect(storageService.getNextInvoiceSequence('2026-27')).toBe(102);
    expect(storageService.getNextInvoiceNumberPreview('2026-27')).toBe('SKT/2026-27/102');

    // Finalize invoice 102
    const invoice102: Invoice = {
      ...invoice101,
      id: 'inv_102',
      invoiceNumber: 'SKT/2026-27/102',
      sequenceNumber: 102,
    };
    storageService.saveInvoices([invoice101, invoice102]);

    // Next is 103
    expect(storageService.getNextInvoiceSequence('2026-27')).toBe(103);
    expect(storageService.getNextInvoiceNumberPreview('2026-27')).toBe('SKT/2026-27/103');

    // 3. Duplicate protection: Even if opening sequence is changed to <= 102 (e.g. 50 or 101),
    // next sequence never regresses or creates a duplicate (remains 103)
    storageService.saveSettings({
      ...settings,
      openingInvoiceSequences: {
        '2026-27': 50,
      },
    });
    expect(storageService.getNextInvoiceSequence('2026-27')).toBe(103);
    expect(storageService.getNextInvoiceNumberPreview('2026-27')).toBe('SKT/2026-27/103');

    // 4. Genuinely new financial year starts at 001 unless configured
    expect(storageService.getNextInvoiceSequence('2027-28')).toBe(1);
    expect(storageService.getNextInvoiceNumberPreview('2027-28')).toBe('SKT/2027-28/001');

    // 5. If new financial year has configured opening sequence (e.g. 201), it starts at 201
    storageService.saveSettings({
      ...settings,
      openingInvoiceSequences: {
        '2026-27': 101,
        '2027-28': 201,
      },
    });
    expect(storageService.getNextInvoiceSequence('2027-28')).toBe(201);
    expect(storageService.getNextInvoiceNumberPreview('2027-28')).toBe('SKT/2027-28/201');
  });

  it('exports and imports full business backups accurately', () => {
    const backupJson = storageService.exportFullBackup();
    expect(backupJson).toContain('SRI KRISHNA TEXTILE');

    const imported = storageService.importFullBackup(backupJson);
    expect(imported).toBe(true);
  });

  it('supports multiple independent drafts simultaneously without data collision', () => {
    // 1. Create Draft A
    const draftA = {
      id: 'draft_A',
      partyId: 'party_1',
      invoiceDate: '2026-09-29',
      dcs: [
        {
          id: 'dc_A1',
          ourDcNumber: 'DC-A1',
          partyDcNumber: 'P-101',
          partyDcDate: '2026-09-29',
          sortOrder: 0,
          workEntries: [
            {
              id: 'w_A1',
              description: 'Navy Blue Dyeing',
              rolls: 5,
              weightDisplay: '120.500',
              weightKg: 120.5,
              rate: 45,
              amount: 5422.5,
              sortOrder: 0,
            },
          ],
        },
      ],
      createdAt: '2026-09-29T10:00:00.000Z',
      updatedAt: '2026-09-29T10:00:00.000Z',
    };

    // 2. Create Draft B
    const draftB = {
      id: 'draft_B',
      partyId: 'party_2',
      invoiceDate: '2026-09-30',
      dcs: [
        {
          id: 'dc_B1',
          ourDcNumber: 'DC-B1',
          partyDcNumber: 'P-202',
          partyDcDate: '2026-09-30',
          sortOrder: 0,
          workEntries: [
            {
              id: 'w_B1',
              description: 'Black Dyeing & Heat Setting',
              rolls: 10,
              weightDisplay: '250.000',
              weightKg: 250,
              rate: 42,
              amount: 10500,
              sortOrder: 0,
            },
          ],
        },
      ],
      createdAt: '2026-09-29T10:05:00.000Z',
      updatedAt: '2026-09-29T10:05:00.000Z',
    };

    storageService.saveDraft(draftA);
    storageService.saveDraft(draftB);
    storageService.setActiveDraftId('draft_B');

    // Both drafts exist independently
    const drafts = storageService.getDrafts();
    expect(drafts.length).toBe(2);

    // Verify Draft A data integrity
    const retrievedA = storageService.getDraft('draft_A');
    expect(retrievedA).toBeDefined();
    expect(retrievedA?.partyId).toBe('party_1');
    expect(retrievedA?.invoiceDate).toBe('2026-09-29');
    expect(retrievedA?.dcs[0].ourDcNumber).toBe('DC-A1');
    expect(retrievedA?.dcs[0].workEntries[0].description).toBe('Navy Blue Dyeing');

    // Verify Draft B data integrity
    const retrievedB = storageService.getDraft('draft_B');
    expect(retrievedB).toBeDefined();
    expect(retrievedB?.partyId).toBe('party_2');
    expect(retrievedB?.invoiceDate).toBe('2026-09-30');
    expect(retrievedB?.dcs[0].ourDcNumber).toBe('DC-B1');
    expect(retrievedB?.dcs[0].workEntries[0].description).toBe('Black Dyeing & Heat Setting');

    // Active draft is B
    expect(storageService.getActiveDraft()?.id).toBe('draft_B');

    // Switching active draft
    storageService.setActiveDraftId('draft_A');
    expect(storageService.getActiveDraft()?.id).toBe('draft_A');

    // Deleting Draft A deletes only Draft A; Draft B remains intact
    storageService.deleteDraft('draft_A');
    const remainingDrafts = storageService.getDrafts();
    expect(remainingDrafts.length).toBe(1);
    expect(remainingDrafts[0].id).toBe('draft_B');
    expect(storageService.getDraft('draft_A')).toBeNull();
    expect(storageService.getDraft('draft_B')).toBeDefined();
  });
});
