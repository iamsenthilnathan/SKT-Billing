/**
 * Strict Indian GSTIN and Mobile Validation utilities
 */

// Official Indian 15-character GSTIN format:
// 2 digits (State Code) + 5 letters (PAN) + 4 digits (PAN) + 1 letter (PAN) + 1 entity code + 'Z' + 1 checksum char
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// 10-digit Indian Mobile number with optional +91, 91, or 0 prefix
export const INDIAN_MOBILE_REGEX = /^(?:(?:\+91|91|0)[\s-]?)?[6-9]\d{9}$/;

export function validateGstin(gstin: string | undefined | null): { isValid: boolean; error?: string } {
  if (!gstin || !gstin.trim()) {
    return { isValid: false, error: 'GSTIN is mandatory.' };
  }
  const clean = gstin.trim().toUpperCase();
  if (clean.length !== 15) {
    return { isValid: false, error: 'GSTIN must be exactly 15 characters (e.g. 33AAAAA0000A1Z5).' };
  }
  if (!GSTIN_REGEX.test(clean)) {
    return { isValid: false, error: 'Invalid GSTIN format. Follows 2-digit state code, 10-char PAN, 1 entity, Z, and checksum.' };
  }
  return { isValid: true };
}

export function validateIndianMobile(phone: string | undefined | null): { isValid: boolean; error?: string } {
  if (!phone || !phone.trim()) {
    return { isValid: false, error: 'Mobile number is mandatory.' };
  }
  const clean = phone.trim().replace(/[\s-]/g, '');
  if (!INDIAN_MOBILE_REGEX.test(clean)) {
    return { isValid: false, error: 'Invalid Indian mobile number. Must be a valid 10-digit number starting with 6, 7, 8, or 9.' };
  }
  return { isValid: true };
}
