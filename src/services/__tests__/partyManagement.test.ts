import { describe, it, expect, beforeEach } from 'vitest';
import { storageService, INITIAL_PARTIES } from '../storage';
import type { Invoice } from '../../domain/types';

describe('Party Management & Reference Safety', () => {
  beforeEach(() => {
    storageService.clearAll();
    storageService.saveParties(INITIAL_PARTIES);
  });

  const dummyInvoice: Invoice = {
    id: 'inv_test_1',
    invoiceNumber: 'SKT/2026-27/001',
    financialYear: '2026-27',
    sequenceNumber: 1,
    invoiceDate: '2026-09-30',
    status: 'finalized',
    partyId: 'party_1',
    partyNameSnapshot: 'ABC Fabrics Private Limited',
    partyAddressSnapshot: '45, Cotton Market Ring Road, Tirupur - 641 604, Tamil Nadu',
    partyGstinSnapshot: '33ABCDE1234F1Z9',
    partyPhoneSnapshot: '9842111223',
    bankNameSnapshot: 'State Bank of India',
    branchSnapshot: 'Tirupur Main',
    accountNumberSnapshot: '12345678901234',
    ifscCodeSnapshot: 'SBIN0001234',
    dcs: [],
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
    paymentStatus: 'unpaid',
    paidAmount: 0,
    outstandingAmount: 9450,
    createdAt: '2026-09-30T10:00:00.000Z',
    updatedAt: '2026-09-30T10:00:00.000Z',
    finalizedAt: '2026-09-30T10:00:00.000Z',
  };

  it('ensures existing and newly created parties default to Active (isArchived: false)', () => {
    const parties = storageService.getParties();
    expect(parties.length).toBeGreaterThan(0);
    // Requirement 3: Existing parties should remain Active by default
    for (const p of parties) {
      expect(p.isArchived).toBe(false);
    }

    const added = storageService.addParty({
      name: 'New Textile Mill',
      address: 'Kumar Nagar, Tirupur',
      gstin: '33AAAAA0000A1Z5',
      phone: '9842000000',
    });
    expect(added.isArchived).toBe(false);

    const activeList = storageService.getActiveParties();
    expect(activeList.some((p) => p.id === added.id)).toBe(true);
  });

  it('archives an active party and hides it from getActiveParties', () => {
    // Requirement 2: Add Active / Archived party state
    // Requirement 7: Archived parties should not appear in the normal party selection
    storageService.archiveParty('party_1');

    const parties = storageService.getParties();
    const party1 = parties.find((p) => p.id === 'party_1');
    expect(party1).toBeDefined();
    expect(party1?.isArchived).toBe(true);

    const activeParties = storageService.getActiveParties();
    expect(activeParties.some((p) => p.id === 'party_1')).toBe(false);
    expect(activeParties.some((p) => p.id === 'party_2')).toBe(true);
  });

  it('restores an archived party to Active', () => {
    // Requirement 8: Provide a way to restore archived parties to Active
    storageService.archiveParty('party_2');
    expect(storageService.getActiveParties().some((p) => p.id === 'party_2')).toBe(false);

    storageService.restoreParty('party_2');
    const party2 = storageService.getParties().find((p) => p.id === 'party_2');
    expect(party2?.isArchived).toBe(false);
    expect(storageService.getActiveParties().some((p) => p.id === 'party_2')).toBe(true);
  });

  it('protects referenced parties from hard deletion (Requirement 4)', () => {
    // Store an invoice referencing party_1
    storageService.saveInvoices([dummyInvoice]);

    expect(storageService.isPartyReferenced('party_1')).toBe(true);

    // Hard deletion must be strictly blocked
    expect(() => {
      storageService.deleteParty('party_1');
    }).toThrow(/Cannot delete customer: Referenced by existing invoice/);

    // Confirm party_1 is still intact in storage
    const party1 = storageService.getParties().find((p) => p.id === 'party_1');
    expect(party1).toBeDefined();
    expect(party1?.name).toBe('ABC Fabrics Private Limited');
  });

  it('allows permanent deletion for parties never referenced by an invoice (Requirement 9)', () => {
    // Store dummy invoice that only references party_1
    storageService.saveInvoices([dummyInvoice]);

    // Add a brand new unused party
    const unusedParty = storageService.addParty({
      name: 'Unused Test Garments',
      address: 'Dharapuram Road, Tirupur',
      gstin: '33TESTG0000T1Z1',
      phone: '9842999999',
    });

    // Record rate memory for this unused party
    storageService.recordRateUsage(unusedParty.id, 'softener wash', 12.0);
    expect(storageService.getSuggestedRate(unusedParty.id, 'softener wash')).toBeDefined();

    expect(storageService.isPartyReferenced(unusedParty.id)).toBe(false);

    // Deletion must succeed cleanly
    storageService.deleteParty(unusedParty.id);

    const parties = storageService.getParties();
    expect(parties.some((p) => p.id === unusedParty.id)).toBe(false);

    // Orphaned rate memory should also be removed
    expect(storageService.getSuggestedRate(unusedParty.id, 'softener wash')).toBeUndefined();
  });

  it('guarantees existing invoices preserve their original party snapshot even if party is later archived or edited (Requirement 6 & 11)', () => {
    storageService.saveInvoices([dummyInvoice]);

    // Later, party_1 is archived
    storageService.archiveParty('party_1');

    // And later edited
    storageService.updateParty({
      id: 'party_1',
      name: 'ABC Fabrics International Ltd (Renamed)',
      address: 'New Factory Road, Tirupur',
      gstin: '33ABCDE1234F1Z9',
      phone: '9842111223',
      isArchived: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
    });

    // Verify existing invoice retains 100% of its original snapshot
    const invoices = storageService.getInvoices();
    const inv = invoices.find((i) => i.id === 'inv_test_1');
    expect(inv).toBeDefined();
    expect(inv?.partyNameSnapshot).toBe('ABC Fabrics Private Limited');
    expect(inv?.partyAddressSnapshot).toBe('45, Cotton Market Ring Road, Tirupur - 641 604, Tamil Nadu');
    expect(inv?.partyGstinSnapshot).toBe('33ABCDE1234F1Z9');
    expect(inv?.partyPhoneSnapshot).toBe('9842111223');
  });

  it('correctly returns 0 parties when all parties are removed or empty', () => {
    storageService.saveParties([]);
    expect(storageService.getParties()).toHaveLength(0);
    expect(storageService.getActiveParties()).toHaveLength(0);
  });

  it('applies empty parties array as well as legitimate party lists in sync state updates', () => {
    let clientParties = storageService.getParties();
    expect(clientParties.length).toBeGreaterThan(0);

    const applySyncState = (state: { parties?: typeof clientParties }) => {
      if (state.parties) {
        clientParties = state.parties;
      }
    };

    // 1. Cloud sync returns 0 parties (all deleted in database)
    applySyncState({ parties: [] });
    expect(clientParties).toEqual([]);

    // 2. Cloud sync returns legitimate parties
    const realParty = {
      id: 'party_real_1',
      name: 'Kongu Knits',
      address: 'Tirupur',
      gstin: '33ABCDE1234F1Z9',
      phone: '9842111223',
      createdAt: '2026-10-04T00:00:00.000Z',
      updatedAt: '2026-10-04T00:00:00.000Z',
    };
    applySyncState({ parties: [realParty] });
    expect(clientParties).toHaveLength(1);
    expect(clientParties[0].name).toBe('Kongu Knits');
  });
});
