import type { DCGroup, InvoiceCalculations, Party } from './types';
import { numberToIndianWords } from './numberToWords';
import { validateGstin, validateIndianPhone } from './validation';

/**
 * Standard rounding to 2 decimal places (paise precision)
 * Uses Number.EPSILON to prevent floating-point representation glitches
 */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates line item amount from numeric weight and rate
 */
export function calculateLineAmount(weightKg: number, rate: number): number {
  if (weightKg <= 0 || rate <= 0 || isNaN(weightKg) || isNaN(rate)) {
    return 0;
  }
  return round2(weightKg * rate);
}

/**
 * Computes all invoice financials according to Indian commercial billing rules.
 * Default CGST: 2.5%, SGST: 2.5%.
 */
export function calculateInvoiceFinancials(
  dcs: DCGroup[],
  cgstRate: number = 2.5,
  sgstRate: number = 2.5
): InvoiceCalculations {
  let totalRolls = 0;
  let totalWeightKg = 0;
  let subtotal = 0;

  for (const dc of dcs) {
    for (const entry of dc.workEntries) {
      totalRolls += entry.rolls || 0;
      totalWeightKg += entry.weightKg || 0;
      subtotal += entry.amount || 0;
    }
  }

  // Exact subtotal with 2 decimal places
  subtotal = round2(subtotal);
  totalWeightKg = Math.round((totalWeightKg + Number.EPSILON) * 1000) / 1000;

  // CGST and SGST calculated independently on the subtotal
  const cgstAmount = round2(subtotal * (cgstRate / 100));
  const sgstAmount = round2(subtotal * (sgstRate / 100));

  // Pre-round total
  const preRoundTotal = round2(subtotal + cgstAmount + sgstAmount);

  // Commercial round-off to nearest whole rupee:
  // >= 0.50 rounds up, < 0.50 rounds down
  const totalAmount = Math.round(preRoundTotal);
  const roundOff = round2(totalAmount - preRoundTotal);

  const totalAmountInWords = numberToIndianWords(totalAmount);

  return {
    totalRolls,
    totalWeightKg,
    subtotal,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    preRoundTotal,
    roundOff,
    totalAmount,
    totalAmountInWords,
  };
}

/**
 * Derives the Indian Financial Year string from an ISO date string (YYYY-MM-DD),
 * Indian date format (DD-MM-YYYY), or Date object.
 * Indian FY starts on April 1 and ends on March 31.
 * Does NOT change on January 1.
 *
 * Examples:
 * 31-03-2027 -> "2026-27"
 * 01-01-2027 -> "2026-27"
 * 01-04-2027 -> "2027-28"
 * 2026-09-28 -> "2026-27"
 */
export function getFinancialYear(dateInput?: string | Date): string {
  let year: number;
  let month: number; // 1 to 12

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // 1. Check DD-MM-YYYY or DD/MM/YYYY (e.g. 31-03-2027, 01/04/2027)
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      year = parseInt(dmyMatch[3], 10);
      month = parseInt(dmyMatch[2], 10);
    } else {
      // 2. Check YYYY-MM-DD or YYYY/MM/DD (e.g. 2027-03-31, 2027-04-01)
      const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (ymdMatch) {
        year = parseInt(ymdMatch[1], 10);
        month = parseInt(ymdMatch[2], 10);
      } else {
        const d = new Date(trimmed);
        if (isNaN(d.getTime())) {
          return getFinancialYear(new Date());
        }
        year = d.getFullYear();
        month = d.getMonth() + 1;
      }
    }
  } else if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    year = dateInput.getFullYear();
    month = dateInput.getMonth() + 1;
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  // Indian Financial Year: April 1 to March 31
  // April (month 4) to December (month 12): year to year+1
  // January (month 1) to March (month 3): year-1 to year (Do NOT change on January 1!)
  if (month >= 4) {
    const nextYearShort = (year + 1) % 100;
    return `${year}-${nextYearShort.toString().padStart(2, '0')}`;
  } else {
    const prevYear = year - 1;
    const currentYearShort = year % 100;
    return `${prevYear}-${currentYearShort.toString().padStart(2, '0')}`;
  }
}

/**
 * Validates an invoice before allowing finalization.
 * Requires complete customer information (Name, Address, valid GSTIN, valid Phone Number)
 */
export function validateInvoiceForFinalization(data: {
  partyId?: string;
  party?: Party;
  invoiceDate?: string;
  dcs?: DCGroup[];
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.partyId || data.partyId.trim() === '') {
    errors.push('Please select a customer / party.');
  }

  if (data.party) {
    if (!data.party.address || !data.party.address.trim()) {
      errors.push('Customer address is mandatory.');
    }
    const gstinCheck = validateGstin(data.party.gstin);
    if (!gstinCheck.isValid) {
      errors.push(`Customer GSTIN error: ${gstinCheck.error}`);
    }
    const phoneCheck = validateIndianPhone(data.party.phone);
    if (!phoneCheck.isValid) {
      errors.push(`Customer Phone error: ${phoneCheck.error}`);
    }
  }

  if (!data.invoiceDate || data.invoiceDate.trim() === '') {
    errors.push('Please specify an invoice date.');
  }

  if (!data.dcs || data.dcs.length === 0) {
    errors.push('At least one Delivery Challan (DC) is required.');
  } else {
    let totalWorkEntries = 0;
    data.dcs.forEach((dc, dcIndex) => {
      if (!dc.ourDcNumber && !dc.partyDcNumber) {
        errors.push(`DC #${dcIndex + 1} has neither Our DC nor Party DC entered.`);
      }
      if (!dc.workEntries || dc.workEntries.length === 0) {
        errors.push(`DC #${dcIndex + 1} has no work entries.`);
      } else {
        totalWorkEntries += dc.workEntries.length;
        dc.workEntries.forEach((entry, entryIndex) => {
          if (!entry.description || entry.description.trim() === '') {
            errors.push(`DC #${dcIndex + 1}, Item #${entryIndex + 1}: Description is required.`);
          }
          if (entry.weightKg <= 0) {
            errors.push(`DC #${dcIndex + 1}, Item #${entryIndex + 1} (${entry.description || 'Item'}): Weight must be greater than 0.`);
          }
          if (entry.rate <= 0) {
            errors.push(`DC #${dcIndex + 1}, Item #${entryIndex + 1} (${entry.description || 'Item'}): Rate must be greater than 0.`);
          }
        });
      }
    });

    if (totalWorkEntries === 0) {
      errors.push('At least one valid work entry is required to finalize.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Detects whether a temporary in-progress bill has meaningful user data entered.
 * Used to guard against phantom/empty draft creation until deliberate bill input occurs.
 */
export function hasMeaningfulBillContent(partyId: string, dcs: DCGroup[]): boolean {
  if (partyId && partyId.trim() !== '') {
    return true;
  }
  if (!dcs || dcs.length === 0) {
    return false;
  }
  if (dcs.length > 1) {
    return true;
  }
  const firstDc = dcs[0];
  if (firstDc.ourDcNumber && firstDc.ourDcNumber.trim() !== '') {
    return true;
  }
  if (firstDc.partyDcNumber && firstDc.partyDcNumber.trim() !== '') {
    return true;
  }
  if (!firstDc.workEntries || firstDc.workEntries.length === 0) {
    return false;
  }
  if (firstDc.workEntries.length > 1) {
    return true;
  }
  const firstEntry = firstDc.workEntries[0];
  if (firstEntry.description && firstEntry.description.trim() !== '') {
    return true;
  }
  if (Number(firstEntry.rolls) > 0) {
    return true;
  }
  if (Number(firstEntry.weightKg) > 0 || (firstEntry.weightDisplay && firstEntry.weightDisplay.trim() !== '')) {
    return true;
  }
  if (Number(firstEntry.rate) > 0) {
    return true;
  }
  return false;
}
