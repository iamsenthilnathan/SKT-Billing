import { describe, it, expect } from 'vitest';
import type { DCGroup } from '../types';
import { calculateInvoiceFinancials, validateInvoiceForFinalization } from '../calculations';
import { validateGstin, validateIndianPhone, validateIndianMobile } from '../validation';

describe('Invoice Print Requirements & DC Date Inheritance', () => {
  it('validates Indian GSTIN format correctly', () => {
    // Valid 15-character GSTIN
    expect(validateGstin('33AAAAA0000A1Z5').isValid).toBe(true);
    expect(validateGstin('33ABCDE1234F1Z9').isValid).toBe(true);

    // Invalid GSTINs
    expect(validateGstin('12345').isValid).toBe(false);
    expect(validateGstin('33AAAAA0000A1Z').isValid).toBe(false); // 14 chars
    expect(validateGstin('33AAAAA0000A1Z55').isValid).toBe(false); // 16 chars
    expect(validateGstin('').isValid).toBe(false);
    expect(validateGstin(undefined).isValid).toBe(false);
  });

  it('validates Indian Phone Number (Mobile and Landline) format correctly', () => {
    // Required Valid Cases
    expect(validateIndianPhone('9842111223').isValid).toBe(true);
    expect(validateIndianPhone('04212262614').isValid).toBe(true);
    expect(validateIndianPhone('0421-2262614').isValid).toBe(true);
    expect(validateIndianPhone('0421 2262614').isValid).toBe(true);
    expect(validateIndianPhone('(0421) 2262614').isValid).toBe(true);
    expect(validateIndianPhone('+91 98421 11223').isValid).toBe(true);
    expect(validateIndianPhone('+91 0421 2262614').isValid).toBe(true);
    expect(validateIndianPhone('044-28345678').isValid).toBe(true);
    expect(validateIndianPhone('080-22345678').isValid).toBe(true);

    // Also verify backward compatibility alias
    expect(validateIndianMobile('04212262614').isValid).toBe(true);
    expect(validateIndianMobile('9842111223').isValid).toBe(true);

    // Required Invalid Cases
    expect(validateIndianPhone('').isValid).toBe(false);
    expect(validateIndianPhone('12345').isValid).toBe(false);
    expect(validateIndianPhone('04212262614999').isValid).toBe(false);
    expect(validateIndianPhone('042122ABC14').isValid).toBe(false);
    expect(validateIndianPhone('0000000000').isValid).toBe(false);

    // Additional edge cases
    expect(validateIndianPhone('   ').isValid).toBe(false);
    expect(validateIndianPhone(undefined).isValid).toBe(false);
    expect(validateIndianPhone(null).isValid).toBe(false);
  });

  it('verifies the multi-DC invoice scenario with inherited Party DC dates', () => {
    const dcs: DCGroup[] = [
      {
        id: 'dc_1',
        ourDcNumber: '120',
        partyDcNumber: '126',
        partyDcDate: '2026-03-20',
        sortOrder: 0,
        workEntries: [
          {
            id: 'w_1',
            description: 'Lt. Maroon',
            rolls: 2,
            weightDisplay: '210.000',
            weightKg: 210.0,
            rate: 45,
            amount: 9450,
            sortOrder: 0,
          },
          {
            id: 'w_2',
            description: 'Skin',
            rolls: 3,
            weightDisplay: '310.500',
            weightKg: 310.5,
            rate: 45,
            amount: 13972.5,
            sortOrder: 1,
          },
        ],
      },
      {
        id: 'dc_2',
        ourDcNumber: '121',
        partyDcNumber: '128',
        partyDcDate: '2026-03-26',
        sortOrder: 1,
        workEntries: [
          {
            id: 'w_3',
            description: 'White',
            rolls: 1,
            weightDisplay: '105.000',
            weightKg: 105.0,
            rate: 30,
            amount: 3150,
            sortOrder: 0,
          },
        ],
      },
    ];

    // Compute invoice rows exactly as InvoiceView does
    const formatDisplayDate = (dStr: string) => {
      const parts = dStr.split('-');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };

    const renderedRows: Array<{
      sNo: number;
      ourDc: string;
      partyDc: string;
      partyDcDate: string;
      description: string;
    }> = [];

    let counter = 1;
    dcs.forEach((dc) => {
      const inheritedDate = formatDisplayDate(dc.partyDcDate);
      dc.workEntries.forEach((entry, entryIndex) => {
        renderedRows.push({
          sNo: counter++,
          ourDc: entryIndex === 0 ? dc.ourDcNumber : '',
          partyDc: entryIndex === 0 ? dc.partyDcNumber : '',
          partyDcDate: inheritedDate, // Crucial: must repeat on continuation rows!
          description: entry.description,
        });
      });
    });

    expect(renderedRows).toHaveLength(3);

    // Row 1: DC 1, Entry 1
    expect(renderedRows[0]).toEqual({
      sNo: 1,
      ourDc: '120',
      partyDc: '126',
      partyDcDate: '20-03-2026',
      description: 'Lt. Maroon',
    });

    // Row 2: DC 1, Entry 2 (Continuation row - Date MUST NOT be blank!)
    expect(renderedRows[1]).toEqual({
      sNo: 2,
      ourDc: '',
      partyDc: '',
      partyDcDate: '20-03-2026',
      description: 'Skin',
    });

    // Row 3: DC 2, Entry 1
    expect(renderedRows[2]).toEqual({
      sNo: 3,
      ourDc: '121',
      partyDc: '128',
      partyDcDate: '26-03-2026',
      description: 'White',
    });

    // Financials verification
    const fin = calculateInvoiceFinancials(dcs, 2.5, 2.5);
    expect(fin.totalRolls).toBe(6);
    expect(fin.totalWeightKg).toBe(625.5);
    expect(fin.subtotal).toBe(26572.5);
    expect(fin.cgstAmount).toBe(664.31);
    expect(fin.sgstAmount).toBe(664.31);
    expect(fin.preRoundTotal).toBe(27901.12);
    expect(fin.totalAmount).toBe(27901);
    expect(fin.roundOff).toBe(-0.12);

    // Full Validation with Party
    const party = {
      id: 'p1',
      name: 'ABC Fabrics Private Limited',
      address: '45, Cotton Market Ring Road, Tirupur - 641 604',
      gstin: '33ABCDE1234F1Z9',
      phone: '9842111223',
      createdAt: '',
      updatedAt: '',
    };

    const val = validateInvoiceForFinalization({
      partyId: party.id,
      party,
      invoiceDate: '2026-03-28',
      dcs,
    });
    expect(val.isValid).toBe(true);
    expect(val.errors).toHaveLength(0);
  });
});
