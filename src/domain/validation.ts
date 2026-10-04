/**
 * Strict Indian GSTIN and Phone Validation utilities
 */

// Official Indian 15-character GSTIN format:
// 2 digits (State Code) + 5 letters (PAN) + 4 digits (PAN) + 1 letter (PAN) + 1 entity code + 'Z' + 1 checksum char
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

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

/**
 * Validates an Indian phone number (Mobile or Landline with STD code).
 * Accepts common formatting: spaces, hyphens, parentheses, and optional +91/91/0 prefix.
 * Preserves user entered formatting while rejecting obviously malformed or invalid inputs.
 */
export function validateIndianPhone(phone: string | undefined | null): { isValid: boolean; error?: string } {
  if (!phone || !phone.trim()) {
    return { isValid: false, error: 'Phone number is mandatory.' };
  }
  const raw = phone.trim();
  // Reject letters and illegal symbols
  if (!/^[+]?[\d\s\-().]+$/.test(raw)) {
    return { isValid: false, error: 'Phone number must only contain digits, spaces, hyphens, and STD code.' };
  }
  const digits = raw.replace(/\D/g, '');
  // Reject all zeros
  if (/^0+$/.test(digits)) {
    return { isValid: false, error: 'Phone number cannot be all zeros.' };
  }

  // Handle +91 or 91 country code prefix
  let core = digits;
  if (raw.startsWith('+91')) {
    core = digits.slice(2);
  } else if (digits.startsWith('91') && (digits.length === 12 || (digits.length === 13 && digits[2] === '0'))) {
    core = digits.slice(2);
  }

  if (core.length < 10) {
    return { isValid: false, error: 'Phone number is too short. Must be a valid 10-digit mobile or landline number with STD code.' };
  }
  if (core.length > 11) {
    return { isValid: false, error: 'Phone number is too long. Please enter a valid Indian mobile (10 digits) or landline with STD code.' };
  }
  if (core.length === 10 && core.startsWith('0')) {
    return { isValid: false, error: 'Landline numbers with STD code starting with 0 must be 11 digits (e.g. 0421-2262614).' };
  }
  if (core.length === 11 && !core.startsWith('0')) {
    return { isValid: false, error: '11-digit phone numbers must start with 0 (e.g. 0421-2262614).' };
  }

  return { isValid: true };
}

// Backwards-compatibility alias
export const validateIndianMobile = validateIndianPhone;
