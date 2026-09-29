import { describe, it, expect } from 'vitest';
import type { Invoice } from '../types';

describe('Invoice Archive & Ledger Filtering and Sorting', () => {
  const sampleInvoices: Invoice[] = [
    {
      id: 'inv_001',
      invoiceNumber: 'SKT/2026-27/001',
      financialYear: '2026-27',
      sequenceNumber: 1,
      invoiceDate: '2026-09-20',
      status: 'finalized',
      partyId: 'party_1',
      partyNameSnapshot: 'ABC Fabrics Private Limited',
      partyAddressSnapshot: 'Tirupur',
      partyGstinSnapshot: '33ABCDE1234F1Z9',
      partyPhoneSnapshot: '9842111223',
      bankNameSnapshot: 'SBI',
      branchSnapshot: 'Main',
      accountNumberSnapshot: '123',
      ifscCodeSnapshot: 'SBIN001',
      dcs: [
        {
          id: 'dc_1',
          ourDcNumber: '138',
          partyDcNumber: '8421',
          partyDcDate: '2026-09-20',
          sortOrder: 0,
          workEntries: [
            {
              id: 'w_1',
              description: 'Navy Blue Dyeing',
              rolls: 10,
              weightDisplay: '200.000',
              weightKg: 200,
              rate: 45,
              amount: 9000,
              sortOrder: 0,
            },
          ],
        },
      ],
      calculations: {
        totalRolls: 10,
        totalWeightKg: 200,
        subtotal: 9000,
        cgstRate: 2.5,
        cgstAmount: 225,
        sgstRate: 2.5,
        sgstAmount: 225,
        preRoundTotal: 9450,
        roundOff: 0,
        totalAmount: 9450,
        totalAmountInWords: 'Rupees Nine Thousand Four Hundred Fifty Only',
      },
      paymentStatus: 'paid',
      paidAmount: 9450,
      outstandingAmount: 0,
      createdAt: '2026-09-20T10:00:00.000Z',
      updatedAt: '2026-09-20T10:00:00.000Z',
      finalizedAt: '2026-09-20T10:00:00.000Z',
    },
    {
      id: 'inv_002',
      invoiceNumber: 'SKT/2026-27/002',
      financialYear: '2026-27',
      sequenceNumber: 2,
      invoiceDate: '2026-09-28',
      status: 'finalized',
      partyId: 'party_2',
      partyNameSnapshot: 'Sree Amman Knits',
      partyAddressSnapshot: 'Tirupur',
      partyGstinSnapshot: '33BCDEF2345G2Z0',
      partyPhoneSnapshot: '9842233445',
      bankNameSnapshot: 'SBI',
      branchSnapshot: 'Main',
      accountNumberSnapshot: '123',
      ifscCodeSnapshot: 'SBIN001',
      dcs: [
        {
          id: 'dc_2',
          ourDcNumber: '145',
          partyDcNumber: '9002',
          partyDcDate: '2026-09-28',
          sortOrder: 0,
          workEntries: [
            {
              id: 'w_2',
              description: 'Black Dyeing & Heat Setting',
              rolls: 20,
              weightDisplay: '500.000',
              weightKg: 500,
              rate: 42,
              amount: 21000,
              sortOrder: 0,
            },
          ],
        },
      ],
      calculations: {
        totalRolls: 20,
        totalWeightKg: 500,
        subtotal: 21000,
        cgstRate: 2.5,
        cgstAmount: 525,
        sgstRate: 2.5,
        sgstAmount: 525,
        preRoundTotal: 22050,
        roundOff: 0,
        totalAmount: 22050,
        totalAmountInWords: 'Rupees Twenty Two Thousand Fifty Only',
      },
      paymentStatus: 'partially_paid',
      paidAmount: 10000,
      outstandingAmount: 12050,
      createdAt: '2026-09-28T11:00:00.000Z',
      updatedAt: '2026-09-29T08:00:00.000Z', // Modified later
      finalizedAt: '2026-09-28T11:00:00.000Z',
    },
    {
      id: 'inv_003',
      invoiceNumber: 'SKT/2026-27/003',
      financialYear: '2026-27',
      sequenceNumber: 3,
      invoiceDate: '2026-09-29',
      status: 'finalized',
      partyId: 'party_3',
      partyNameSnapshot: 'Lotus Garments & Processors',
      partyAddressSnapshot: 'Tirupur',
      partyGstinSnapshot: '33CDEFG3456H3Z1',
      partyPhoneSnapshot: '9842355667',
      bankNameSnapshot: 'SBI',
      branchSnapshot: 'Main',
      accountNumberSnapshot: '123',
      ifscCodeSnapshot: 'SBIN001',
      dcs: [
        {
          id: 'dc_3',
          ourDcNumber: '150',
          partyDcNumber: 'L-77',
          partyDcDate: '2026-09-29',
          sortOrder: 0,
          workEntries: [
            {
              id: 'w_3',
              description: 'Bio Wash & Stenter',
              rolls: 15,
              weightDisplay: '300.000',
              weightKg: 300,
              rate: 18,
              amount: 5400,
              sortOrder: 0,
            },
          ],
        },
      ],
      calculations: {
        totalRolls: 15,
        totalWeightKg: 300,
        subtotal: 5400,
        cgstRate: 2.5,
        cgstAmount: 135,
        sgstRate: 2.5,
        sgstAmount: 135,
        preRoundTotal: 5670,
        roundOff: 0,
        totalAmount: 5670,
        totalAmountInWords: 'Rupees Five Thousand Six Hundred Seventy Only',
      },
      paymentStatus: 'unpaid',
      paidAmount: 0,
      outstandingAmount: 5670,
      createdAt: '2026-09-29T09:00:00.000Z',
      updatedAt: '2026-09-29T09:00:00.000Z',
      finalizedAt: '2026-09-29T09:00:00.000Z',
    },
  ];

  it('sorts by Recently Modified descending as default sort', () => {
    const sorted = [...sampleInvoices].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.finalizedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.finalizedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    // inv_003 was updated at 09:00, inv_002 was updated at 08:00, inv_001 was updated on 2026-09-20
    expect(sorted[0].id).toBe('inv_003');
    expect(sorted[1].id).toBe('inv_002');
    expect(sorted[2].id).toBe('inv_001');
  });

  it('sorts by Outstanding Amount descending', () => {
    const sorted = [...sampleInvoices].sort((a, b) => b.outstandingAmount - a.outstandingAmount);
    expect(sorted[0].id).toBe('inv_002'); // 12050
    expect(sorted[1].id).toBe('inv_003'); // 5670
    expect(sorted[2].id).toBe('inv_001'); // 0
  });

  it('filters by Payment Status correctly', () => {
    const unpaidOnly = sampleInvoices.filter((inv) => inv.paymentStatus === 'unpaid');
    expect(unpaidOnly.length).toBe(1);
    expect(unpaidOnly[0].id).toBe('inv_003');

    const partiallyPaid = sampleInvoices.filter((inv) => inv.paymentStatus === 'partially_paid');
    expect(partiallyPaid.length).toBe(1);
    expect(partiallyPaid[0].id).toBe('inv_002');

    const paidOnly = sampleInvoices.filter((inv) => inv.paymentStatus === 'paid');
    expect(paidOnly.length).toBe(1);
    expect(paidOnly[0].id).toBe('inv_001');
  });

  it('searches across Invoice Number, Customer Name, and DC Number', () => {
    const search = (term: string) => {
      const q = term.toLowerCase();
      return sampleInvoices.filter((inv) => {
        const invNum = (inv.invoiceNumber || '').toLowerCase();
        const customer = (inv.partyNameSnapshot || '').toLowerCase();
        const matchesDc = inv.dcs.some(
          (dc) =>
            dc.ourDcNumber.toLowerCase().includes(q) ||
            dc.partyDcNumber.toLowerCase().includes(q) ||
            dc.workEntries.some((w) => w.description.toLowerCase().includes(q))
        );
        return invNum.includes(q) || customer.includes(q) || matchesDc;
      });
    };

    // By Invoice #
    expect(search('001').length).toBe(1);
    expect(search('001')[0].id).toBe('inv_001');

    // By Customer
    expect(search('Amman').length).toBe(1);
    expect(search('Amman')[0].id).toBe('inv_002');

    // By Our DC
    expect(search('150').length).toBe(1);
    expect(search('150')[0].id).toBe('inv_003');

    // By Party DC
    expect(search('8421').length).toBe(1);
    expect(search('8421')[0].id).toBe('inv_001');

    // By Work Description
    expect(search('bio wash').length).toBe(1);
    expect(search('bio wash')[0].id).toBe('inv_003');
  });

  it('calculates aggregate ledger summary metrics accurately', () => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    sampleInvoices.forEach((inv) => {
      totalInvoiced += inv.calculations.totalAmount;
      totalPaid += inv.paidAmount;
      totalOutstanding += inv.outstandingAmount;
    });

    expect(totalInvoiced).toBe(9450 + 22050 + 5670); // 37170
    expect(totalPaid).toBe(9450 + 10000 + 0); // 19450
    expect(totalOutstanding).toBe(0 + 12050 + 5670); // 17720
    expect(totalInvoiced - totalPaid).toBe(totalOutstanding);
  });
});
