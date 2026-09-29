export interface BusinessSettings {
  id: string;
  businessName: string;
  address: string;
  gstin: string;
  phone: string;
  email?: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  defaultCgstRate: number; // e.g. 2.5
  defaultSgstRate: number; // e.g. 2.5
  invoicePrefix: string; // e.g. "SKT"
  financialYearOverride?: string; // Optional manual override for exceptional administrative cases (e.g. "2026-27"). Default empty (Auto-derived from invoice date).
  openingInvoiceSequences?: Record<string, number>; // Maps FY (e.g. "2026-27") to configured opening/next sequence number (e.g. 101)
}

export interface Party {
  id: string;
  name: string;
  address: string;
  gstin: string; // Mandatory 15-char Indian GSTIN
  phone: string; // Mandatory 10-digit Indian Mobile Number
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RateMemoryItem {
  id: string;
  partyId: string;
  normalizedDescription: string;
  suggestedRate: number;
  lastUsedDate: string;
  lastUsedInvoiceNumber?: string;
}

export interface WorkEntry {
  id: string;
  description: string;
  rolls: number;
  weightDisplay: string; // Raw input: "125 KG 500 GMS", "103.000", "994.4"
  weightKg: number; // High-precision normalized decimal value for math
  rate: number;
  amount: number; // weightKg * rate (rounded to 2 decimals)
  sortOrder: number;
}

export interface DCGroup {
  id: string;
  ourDcNumber: string; // Text: "138/139", "DC-44", etc.
  partyDcNumber: string; // Customer's DC number text: "8421", "REC/01"
  partyDcDate: string; // YYYY-MM-DD
  workEntries: WorkEntry[];
  sortOrder: number;
}

export interface InvoiceCalculations {
  totalRolls: number;
  totalWeightKg: number;
  subtotal: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  preRoundTotal: number;
  roundOff: number; // e.g. -0.43, +0.50, +0.00
  totalAmount: number; // Final whole rounded rupee amount
  totalAmountInWords: string; // Indian numbering format
}

export type InvoiceStatus = 'draft' | 'finalized' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

export interface Invoice {
  id: string;
  invoiceNumber?: string; // e.g. "SKT/2026-27/001" (null while draft)
  financialYear: string; // e.g. "2026-27"
  sequenceNumber?: number; // Sequential int within financialYear
  invoiceDate: string; // YYYY-MM-DD
  status: InvoiceStatus;
  
  partyId: string;
  partyNameSnapshot: string;
  partyAddressSnapshot: string;
  partyGstinSnapshot: string;
  partyPhoneSnapshot: string;

  // Bank Snapshot at the exact moment of invoice finalization
  bankNameSnapshot: string;
  branchSnapshot: string;
  accountNumberSnapshot: string;
  ifscCodeSnapshot: string;

  dcs: DCGroup[];
  calculations: InvoiceCalculations;

  // Internal Payment Tracking (V1 - strictly internal, never printed)
  paymentStatus: PaymentStatus;
  paidAmount: number;
  outstandingAmount: number;

  notes?: string;
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  notes?: string;
  createdAt: string;
}

export interface BillDraft {
  id: string;
  partyId: string;
  invoiceDate: string;
  dcs: DCGroup[];
  calculations?: InvoiceCalculations;
  createdAt?: string;
  updatedAt: string;
}

