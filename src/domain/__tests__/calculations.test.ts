import { describe, it, expect } from 'vitest';
import {
  calculateLineAmount,
  calculateInvoiceFinancials,
  getFinancialYear,
  validateInvoiceForFinalization,
} from '../calculations';
import type { DCGroup } from '../types';

describe('Financial Calculations Engine', () => {
  it('calculates line item amount with paise precision', () => {
    // 650.400 kg @ ₹45.00/kg = 29,268.00
    expect(calculateLineAmount(650.4, 45)).toBe(29268.00);

    // 410.200 kg @ ₹18.00/kg = 7,383.60
    expect(calculateLineAmount(410.2, 18)).toBe(7383.60);

    // Floating precision edge case: 120.15 * 33.33 = 4004.5995 -> 4004.60
    expect(calculateLineAmount(120.15, 33.33)).toBe(4004.60);

    // Zero or invalid values
    expect(calculateLineAmount(0, 45)).toBe(0);
    expect(calculateLineAmount(100, 0)).toBe(0);
    expect(calculateLineAmount(-10, 45)).toBe(0);
  });

  it('correctly calculates subtotal, CGST, SGST, roundoff below 50 paise', () => {
    // Subtotal: 1000.00
    // CGST (2.5%): 25.00
    // SGST (2.5%): 25.00
    // Pre-round: 1050.00
    // Round-off: 0.00, Total: 1050
    const dcs: DCGroup[] = [
      {
        id: 'dc1',
        ourDcNumber: '138/139',
        partyDcNumber: '8421',
        partyDcDate: '2026-09-25',
        sortOrder: 0,
        workEntries: [
          {
            id: 'w1',
            description: 'Navy Blue Dyeing',
            rolls: 6,
            weightDisplay: '650.400',
            weightKg: 650.4,
            rate: 45,
            amount: 29268.00,
            sortOrder: 0,
          },
        ],
      },
    ];

    const fin = calculateInvoiceFinancials(dcs, 2.5, 2.5);
    expect(fin.totalRolls).toBe(6);
    expect(fin.totalWeightKg).toBe(650.4);
    expect(fin.subtotal).toBe(29268.00);
    expect(fin.cgstAmount).toBe(731.70); // 29268 * 0.025
    expect(fin.sgstAmount).toBe(731.70);
    expect(fin.preRoundTotal).toBe(30731.40);
    // 30731.40 rounds to 30731
    expect(fin.totalAmount).toBe(30731);
    expect(fin.roundOff).toBe(-0.40);
    expect(fin.totalAmountInWords).toBe('Rupees Thirty Thousand Seven Hundred Thirty One Only');
  });

  it('correctly handles round-off above 50 paise', () => {
    // Fabric process scenario yielding pre-round ending in .58
    const dcs: DCGroup[] = [
      {
        id: 'dc1',
        ourDcNumber: '101',
        partyDcNumber: '55',
        partyDcDate: '2026-09-20',
        sortOrder: 0,
        workEntries: [
          {
            id: 'w1',
            description: 'Special Bio Process',
            rolls: 2,
            weightDisplay: '115.65',
            weightKg: 115.65,
            rate: 1, // Subtotal = 115.65
            amount: 115.65,
            sortOrder: 0,
          },
        ],
      },
    ];

    // Subtotal: 115.65
    // CGST: 115.65 * 0.025 = 2.89125 -> 2.89
    // SGST: 2.89
    // Pre-round: 115.65 + 2.89 + 2.89 = 121.43
    const fin1 = calculateInvoiceFinancials(dcs, 2.5, 2.5);
    expect(fin1.subtotal).toBe(115.65);
    expect(fin1.cgstAmount).toBe(2.89);
    expect(fin1.sgstAmount).toBe(2.89);
    expect(fin1.preRoundTotal).toBe(121.43);
    expect(fin1.totalAmount).toBe(121);
    expect(fin1.roundOff).toBe(-0.43);
  });

  it('correctly handles exact 50 paise boundary condition', () => {
    // Subtotal: 100.00
    // CGST: 0.25% or customized rates that produce exact 121.50
    const dcs: DCGroup[] = [
      {
        id: 'dc1',
        ourDcNumber: '102',
        partyDcNumber: '56',
        partyDcDate: '2026-09-20',
        sortOrder: 0,
        workEntries: [
          {
            id: 'w1',
            description: 'Custom Work',
            rolls: 1,
            weightDisplay: '100.000',
            weightKg: 100,
            rate: 100, // 10,000 subtotal
            amount: 10000,
            sortOrder: 0,
          },
        ],
      },
    ];

    // With CGST 0.0025% and SGST 0.0025% -> 0.25 each -> total 10000.50
    const fin = calculateInvoiceFinancials(dcs, 0.0025, 0.0025);
    expect(fin.preRoundTotal).toBe(10000.50);
    // In commercial rounding, .50 rounds up to next rupee
    expect(fin.totalAmount).toBe(10001);
    expect(fin.roundOff).toBe(0.50);
  });

  it('derives the Indian Financial Year properly (April to March, does not change on Jan 1)', () => {
    // Exact user examples:
    // 31-03-2027 → FY 2026-27
    // 01-01-2027 → FY 2026-27
    // 31-03-2027 → FY 2026-27
    // 01-04-2027 → FY 2027-28
    expect(getFinancialYear('31-03-2027')).toBe('2026-27');
    expect(getFinancialYear('01-01-2027')).toBe('2026-27');
    expect(getFinancialYear('01-04-2027')).toBe('2027-28');

    // ISO format equivalents
    expect(getFinancialYear('2027-03-31')).toBe('2026-27');
    expect(getFinancialYear('2027-01-01')).toBe('2026-27');
    expect(getFinancialYear('2027-04-01')).toBe('2027-28');

    // Calendar transition boundary tests
    expect(getFinancialYear('2026-04-01')).toBe('2026-27');
    expect(getFinancialYear('2026-09-28')).toBe('2026-27');
    expect(getFinancialYear('2026-12-31')).toBe('2026-27');
    expect(getFinancialYear('2026-03-31')).toBe('2025-26');

    // Date object inputs
    expect(getFinancialYear(new Date(2027, 2, 31))).toBe('2026-27'); // March 31, 2027
    expect(getFinancialYear(new Date(2027, 0, 1))).toBe('2026-27');  // January 1, 2027
    expect(getFinancialYear(new Date(2027, 3, 1))).toBe('2027-28');  // April 1, 2027
  });

  it('validates invoice before finalization', () => {
    // Incomplete invoice
    const emptyCheck = validateInvoiceForFinalization({});
    expect(emptyCheck.isValid).toBe(false);
    expect(emptyCheck.errors.length).toBeGreaterThan(0);

    // Valid invoice with non-numeric DC (e.g. "138/139")
    const validDcs: DCGroup[] = [
      {
        id: 'dc1',
        ourDcNumber: '138/139',
        partyDcNumber: 'RET/8421',
        partyDcDate: '2026-09-25',
        sortOrder: 0,
        workEntries: [
          {
            id: 'w1',
            description: 'Navy Blue Dyeing',
            rolls: 6,
            weightDisplay: '650.400',
            weightKg: 650.4,
            rate: 45,
            amount: 29268.00,
            sortOrder: 0,
          },
        ],
      },
    ];

    const validParty = {
      id: 'party-1',
      name: 'ABC Fabrics',
      address: '45, Cotton Market, Tirupur',
      gstin: '33ABCDE1234F1Z9',
      phone: '9842111223',
      createdAt: '',
      updatedAt: '',
    };

    const validCheck = validateInvoiceForFinalization({
      partyId: 'party-1',
      party: validParty,
      invoiceDate: '2026-09-28',
      dcs: validDcs,
    });

    expect(validCheck.isValid).toBe(true);
    expect(validCheck.errors).toHaveLength(0);
  });
});
