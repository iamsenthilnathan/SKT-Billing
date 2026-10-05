import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { HomePage, getTimeBasedGreeting } from '../HomePage';
import type { Invoice } from '../../../domain/types';

describe('getTimeBasedGreeting Unit Tests', () => {
  it('returns "Good morning" between 5:00 AM and 11:59 AM', () => {
    // 5:00 AM
    const date5am = new Date('2026-10-05T05:00:00');
    expect(getTimeBasedGreeting(date5am)).toBe('Good morning');

    // 8:30 AM
    const date830am = new Date('2026-10-05T08:30:00');
    expect(getTimeBasedGreeting(date830am)).toBe('Good morning');

    // 11:59 AM
    const date1159am = new Date('2026-10-05T11:59:59');
    expect(getTimeBasedGreeting(date1159am)).toBe('Good morning');
  });

  it('returns "Good afternoon" between 12:00 PM and 4:59 PM', () => {
    // 12:00 PM
    const date12pm = new Date('2026-10-05T12:00:00');
    expect(getTimeBasedGreeting(date12pm)).toBe('Good afternoon');

    // 2:15 PM
    const date215pm = new Date('2026-10-05T14:15:00');
    expect(getTimeBasedGreeting(date215pm)).toBe('Good afternoon');

    // 4:59 PM
    const date459pm = new Date('2026-10-05T16:59:59');
    expect(getTimeBasedGreeting(date459pm)).toBe('Good afternoon');
  });

  it('returns "Good evening" between 5:00 PM and 4:59 AM', () => {
    // 5:00 PM
    const date5pm = new Date('2026-10-05T17:00:00');
    expect(getTimeBasedGreeting(date5pm)).toBe('Good evening');

    // 10:30 PM
    const date1030pm = new Date('2026-10-05T22:30:00');
    expect(getTimeBasedGreeting(date1030pm)).toBe('Good evening');

    // 12:00 AM (Midnight)
    const date12am = new Date('2026-10-05T00:00:00');
    expect(getTimeBasedGreeting(date12am)).toBe('Good evening');

    // 4:59 AM
    const date459am = new Date('2026-10-05T04:59:59');
    expect(getTimeBasedGreeting(date459am)).toBe('Good evening');
  });
});

const mockInvoices: Invoice[] = [
  {
    id: 'inv_001',
    invoiceNumber: 'SKT/2026-27/001',
    financialYear: '2026-27',
    sequenceNumber: 1,
    invoiceDate: '2026-09-01',
    status: 'finalized',
    partyId: 'party_1',
    partyNameSnapshot: 'Alpha Textiles',
    partyAddressSnapshot: 'Tirupur',
    partyGstinSnapshot: '33AAAAA0000A1Z5',
    partyPhoneSnapshot: '9842100001',
    bankNameSnapshot: 'SBI',
    branchSnapshot: 'Main',
    accountNumberSnapshot: '111',
    ifscCodeSnapshot: 'SBIN001',
    dcs: [],
    calculations: {
      totalRolls: 5,
      totalWeightKg: 100,
      subtotal: 10000,
      cgstRate: 2.5,
      cgstAmount: 250,
      sgstRate: 2.5,
      sgstAmount: 250,
      preRoundTotal: 10500,
      roundOff: 0,
      totalAmount: 10500,
      totalAmountInWords: 'Ten Thousand Five Hundred',
    },
    paymentStatus: 'paid',
    paidAmount: 10500,
    outstandingAmount: 0,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    finalizedAt: '2026-09-01T10:00:00.000Z',
  },
  {
    id: 'inv_002',
    invoiceNumber: 'SKT/2026-27/002',
    financialYear: '2026-27',
    sequenceNumber: 2,
    invoiceDate: '2026-09-15',
    status: 'finalized',
    partyId: 'party_2',
    partyNameSnapshot: 'Beta Knits',
    partyAddressSnapshot: 'Tirupur',
    partyGstinSnapshot: '33BBBBB0000B1Z6',
    partyPhoneSnapshot: '9842100002',
    bankNameSnapshot: 'SBI',
    branchSnapshot: 'Main',
    accountNumberSnapshot: '111',
    ifscCodeSnapshot: 'SBIN001',
    dcs: [],
    calculations: {
      totalRolls: 8,
      totalWeightKg: 200,
      subtotal: 20000,
      cgstRate: 2.5,
      cgstAmount: 500,
      sgstRate: 2.5,
      sgstAmount: 500,
      preRoundTotal: 21000,
      roundOff: 0,
      totalAmount: 21000,
      totalAmountInWords: 'Twenty One Thousand',
    },
    paymentStatus: 'partially_paid',
    paidAmount: 10000,
    outstandingAmount: 11000,
    createdAt: '2026-09-15T10:00:00.000Z',
    updatedAt: '2026-09-15T10:00:00.000Z',
    finalizedAt: '2026-09-15T10:00:00.000Z',
  },
  {
    id: 'inv_003',
    invoiceNumber: 'SKT/2026-27/003',
    financialYear: '2026-27',
    sequenceNumber: 3,
    invoiceDate: '2026-09-28',
    status: 'finalized',
    partyId: 'party_3',
    partyNameSnapshot: 'Gamma Fashions',
    partyAddressSnapshot: 'Tirupur',
    partyGstinSnapshot: '33CCCCC0000C1Z7',
    partyPhoneSnapshot: '9842100003',
    bankNameSnapshot: 'SBI',
    branchSnapshot: 'Main',
    accountNumberSnapshot: '111',
    ifscCodeSnapshot: 'SBIN001',
    dcs: [],
    calculations: {
      totalRolls: 12,
      totalWeightKg: 300,
      subtotal: 30000,
      cgstRate: 2.5,
      cgstAmount: 750,
      sgstRate: 2.5,
      sgstAmount: 750,
      preRoundTotal: 31500,
      roundOff: 0,
      totalAmount: 31500,
      totalAmountInWords: 'Thirty One Thousand Five Hundred',
    },
    paymentStatus: 'unpaid',
    paidAmount: 0,
    outstandingAmount: 31500,
    createdAt: '2026-09-28T10:00:00.000Z',
    updatedAt: '2026-09-28T10:00:00.000Z',
    finalizedAt: '2026-09-28T10:00:00.000Z',
  },
];

describe('HomePage Component Unit Tests', () => {
  const defaultHandlers = {
    onNewBill: vi.fn(),
    onSelectInvoice: vi.fn(),
    onViewAllInvoices: vi.fn(),
    onViewDrafts: vi.fn(),
  };

  it('Requirement 1: renders properly with 0 invoices and 0 drafts', () => {
    const html = renderToString(
      <HomePage
        invoices={[]}
        draftsCount={0}
        {...defaultHandlers}
      />
    );

    // Header & Greeting
    expect(html).toContain(getTimeBasedGreeting());
    expect(html).toContain('Here’s what’s happening with Sri Krishna Textile today.');

    // Summary cards show zero values
    expect(html).toContain('Invoices');
    expect(html).toContain('>0<'); // Invoices count = 0
    expect(html).toContain('Total Billed');
    expect(html).toContain('Total Received');
    expect(html).toContain('Outstanding Amount');

    // Primary CTA is "+ New Bill"
    expect(html).toContain('New Bill');
    expect(html).not.toContain('New Draft');

    // Does not show drafts badge/banner when draftsCount = 0
    expect(html).not.toContain('unfinished draft');

    // Clean empty state for invoices
    expect(html).toContain('No finalized invoices yet');
    expect(html).toContain('Start Your First Bill');
  });

  it('Requirement 1 & 3: renders properly with invoices but 0 drafts', () => {
    const html = renderToString(
      <HomePage
        invoices={mockInvoices}
        draftsCount={0}
        {...defaultHandlers}
      />
    );

    // Summary cards reflect correct totals:
    // Count: 3
    // Total Billed: 10500 + 21000 + 31500 = 63,000.00
    // Total Received: 10500 + 10000 + 0 = 20,500.00
    // Outstanding: 0 + 11000 + 31500 = 42,500.00
    expect(html).toContain('>3<'); // 3 invoices
    expect(html).toContain('63,000.00');
    expect(html).toContain('20,500.00');
    expect(html).toContain('42,500.00');

    // Recent invoices rendered
    expect(html).toContain('Recent Invoices');
    expect(html).toContain('SKT/2026-27/003');
    expect(html).toContain('Gamma Fashions');
    expect(html).toContain('SKT/2026-27/002');
    expect(html).toContain('Beta Knits');
    expect(html).toContain('SKT/2026-27/001');
    expect(html).toContain('Alpha Textiles');

    // View all invoices action
    expect(html).toContain('View all invoices');

    // No drafts indicator when 0 drafts
    expect(html).not.toContain('unfinished draft');
  });

  it('Requirement 1 & 4: renders properly with invoices and existing drafts', () => {
    const html = renderToString(
      <HomePage
        invoices={mockInvoices}
        draftsCount={2}
        {...defaultHandlers}
      />
    );

    // Top-right quick access to Drafts
    expect(html).toContain('Drafts (2)');

    // Informational banner for unfinished drafts
    expect(html).toContain('2 unfinished drafts');
    expect(html).toContain('Continue Drafts');

    // Single creation CTA is "+ New Bill", NOT "+ New Draft"
    expect(html).toContain('New Bill');
    expect(html).not.toContain('New Draft');
    expect(html).not.toContain('+ New Draft');
  });

  it('Requirement 3: caps recent invoices at 5 most recent', () => {
    // Create 8 invoices
    const eightInvoices: Invoice[] = Array.from({ length: 8 }, (_, idx) => ({
      ...mockInvoices[0],
      id: `inv_test_${idx + 1}`,
      invoiceNumber: `SKT/2026-27/00${idx + 1}`,
      sequenceNumber: idx + 1,
      invoiceDate: `2026-09-${String(idx + 1).padStart(2, '0')}`,
    }));

    const html = renderToString(
      <HomePage
        invoices={eightInvoices}
        draftsCount={0}
        {...defaultHandlers}
      />
    );

    // Invoices 8, 7, 6, 5, 4 should appear (5 most recent)
    expect(html).toContain('SKT/2026-27/008');
    expect(html).toContain('SKT/2026-27/007');
    expect(html).toContain('SKT/2026-27/006');
    expect(html).toContain('SKT/2026-27/005');
    expect(html).toContain('SKT/2026-27/004');

    // Invoices 1, 2, 3 should NOT appear in recent list
    expect(html).not.toContain('SKT/2026-27/001');
    expect(html).not.toContain('SKT/2026-27/002');
    expect(html).not.toContain('SKT/2026-27/003');
  });
});
