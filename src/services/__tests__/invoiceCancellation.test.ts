import { describe, it, expect, beforeEach } from 'vitest';
import { storageService } from '../storage';
import type { Invoice } from '../../domain/types';

describe('Invoice Cancellation Workflow & Sequence Preservation (Service Layer)', () => {
  beforeEach(() => {
    storageService.clearAll();
  });

  const createSampleInvoice = (overrides?: Partial<Invoice>): Invoice => ({
    id: 'inv_test_56',
    invoiceNumber: 'SKT/2026-27/056',
    financialYear: '2026-27',
    sequenceNumber: 56,
    invoiceDate: '2026-10-04',
    status: 'finalized',
    partyId: 'party_1',
    partyNameSnapshot: 'ABC Fabrics Private Limited',
    partyAddressSnapshot: '45, Cotton Market Ring Road, Tirupur',
    partyGstinSnapshot: '33ABCDE1234F1Z9',
    partyPhoneSnapshot: '9842111223',
    bankNameSnapshot: 'State Bank of India',
    branchSnapshot: 'Tirupur Main',
    accountNumberSnapshot: '12345678901234',
    ifscCodeSnapshot: 'SBIN0001234',
    dcs: [],
    calculations: {
      totalRolls: 5,
      totalWeightKg: 500,
      subtotal: 25000,
      cgstRate: 2.5,
      cgstAmount: 625,
      sgstRate: 2.5,
      sgstAmount: 625,
      preRoundTotal: 26250,
      roundOff: 0,
      totalAmount: 26250,
      totalAmountInWords: 'Rupees Twenty Six Thousand Two Hundred Fifty Only',
    },
    paymentStatus: 'unpaid',
    paidAmount: 0,
    outstandingAmount: 26250,
    createdAt: '2026-10-04T10:00:00.000Z',
    updatedAt: '2026-10-04T10:00:00.000Z',
    finalizedAt: '2026-10-04T10:00:00.000Z',
    ...overrides,
  });

  it('successfully cancels a finalized invoice and stores cancellation metadata', () => {
    const inv = createSampleInvoice();
    storageService.saveInvoices([inv]);

    const reason = 'Party requested correction in lot details';
    const cancelled = storageService.cancelInvoice('inv_test_56', reason);

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelledAt).toBeDefined();
    expect(cancelled.cancellationReason).toBe(reason);
    expect(cancelled.invoiceNumber).toBe('SKT/2026-27/056');
    expect(cancelled.sequenceNumber).toBe(56);

    // Verify persisted in storage
    const stored = storageService.getInvoice('inv_test_56');
    expect(stored?.status).toBe('cancelled');
    expect(stored?.cancelledAt).toBe(cancelled.cancelledAt);
    expect(stored?.cancellationReason).toBe(reason);
  });

  it('rejects cancellation of a non-existent invoice', () => {
    storageService.saveInvoices([]);
    expect(() => storageService.cancelInvoice('non_existent')).toThrow(/not found/i);
  });

  it('rejects cancellation of an invoice that is not finalized', () => {
    const draftInv = createSampleInvoice({ status: 'draft' as any });
    storageService.saveInvoices([draftInv]);

    expect(() => storageService.cancelInvoice('inv_test_56')).toThrow(/only finalized invoices can be cancelled/i);
  });

  it('rejects re-cancellation of an already cancelled invoice', () => {
    const inv = createSampleInvoice();
    storageService.saveInvoices([inv]);

    storageService.cancelInvoice('inv_test_56', 'Initial reason');
    expect(() => storageService.cancelInvoice('inv_test_56', 'Second reason')).toThrow(/already cancelled/i);
  });

  it('NEVER reuses the sequence number of a cancelled invoice', () => {
    const inv56 = createSampleInvoice({
      sequenceNumber: 56,
      invoiceNumber: 'SKT/2026-27/056',
    });
    storageService.saveInvoices([inv56]);

    // Before cancellation, next sequence is 57
    expect(storageService.getNextInvoiceSequence('2026-27')).toBe(57);
    expect(storageService.getNextInvoiceNumberPreview('2026-27')).toBe('SKT/2026-27/057');

    // Cancel invoice 56
    storageService.cancelInvoice('inv_test_56', 'Lot canceled');

    // After cancellation, sequence must REMAIN 57 (NEVER reset to 56)
    expect(storageService.getNextInvoiceSequence('2026-27')).toBe(57);
    expect(storageService.getNextInvoiceNumberPreview('2026-27')).toBe('SKT/2026-27/057');
  });

  it('preserves party reference for cancelled invoices, preventing permanent deletion', () => {
    const inv = createSampleInvoice({ partyId: 'party_1' });
    storageService.saveInvoices([inv]);

    storageService.cancelInvoice('inv_test_56');

    // Customer should still be recognized as referenced by the cancelled invoice
    expect(storageService.isPartyReferenced('party_1')).toBe(true);
    expect(() => storageService.deleteParty('party_1')).toThrow(/referenced by existing invoice/i);
  });
});
