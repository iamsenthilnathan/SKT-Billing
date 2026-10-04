import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  normalizeTab,
  parseNavigationHash,
  formatNavigationHash,
  resolveInitialNavigation,
  clearBrowserHash,
  NAV_STORAGE_KEY,
  DEFAULT_NAV_STATE,
} from '../navigation';
import { storageService } from '../storage';
import type { Invoice } from '../../domain/types';

const mockInvoices: Invoice[] = [
  {
    id: 'inv_test_001',
    invoiceNumber: 'SKT/2026-27/001',
    financialYear: '2026-27',
    sequenceNumber: 1,
    invoiceDate: '2026-09-28',
    status: 'finalized',
    partyId: 'party_1',
    partyNameSnapshot: 'ABC Fabrics Private Limited',
    partyAddressSnapshot: 'Tirupur',
    partyGstinSnapshot: '33ABCDE1234F1Z9',
    partyPhoneSnapshot: '9842111223',
    bankNameSnapshot: 'State Bank of India',
    branchSnapshot: 'Tirupur Main',
    accountNumberSnapshot: '12345678901234',
    ifscCodeSnapshot: 'SBIN0001234',
    dcs: [],
    calculations: {
      totalRolls: 0,
      totalWeightKg: 0,
      subtotal: 0,
      cgstRate: 2.5,
      cgstAmount: 0,
      sgstRate: 2.5,
      sgstAmount: 0,
      preRoundTotal: 0,
      roundOff: 0,
      totalAmount: 0,
      totalAmountInWords: 'Rupees Zero Only',
    },
    paymentStatus: 'unpaid',
    paidAmount: 0,
    outstandingAmount: 0,
    createdAt: '2026-09-28T10:00:00.000Z',
    updatedAt: '2026-09-28T10:00:00.000Z',
    finalizedAt: '2026-09-28T10:00:00.000Z',
  },
  {
    id: 'inv_test_002',
    invoiceNumber: 'SKT/2026-27/002',
    financialYear: '2026-27',
    sequenceNumber: 2,
    invoiceDate: '2026-09-29',
    status: 'finalized',
    partyId: 'party_2',
    partyNameSnapshot: 'Sree Amman Knits',
    partyAddressSnapshot: 'Tirupur',
    partyGstinSnapshot: '33BCDEF2345G2Z0',
    partyPhoneSnapshot: '9842233445',
    bankNameSnapshot: 'State Bank of India',
    branchSnapshot: 'Tirupur Main',
    accountNumberSnapshot: '12345678901234',
    ifscCodeSnapshot: 'SBIN0001234',
    dcs: [],
    calculations: {
      totalRolls: 0,
      totalWeightKg: 0,
      subtotal: 0,
      cgstRate: 2.5,
      cgstAmount: 0,
      sgstRate: 2.5,
      sgstAmount: 0,
      preRoundTotal: 0,
      roundOff: 0,
      totalAmount: 0,
      totalAmountInWords: 'Rupees Zero Only',
    },
    paymentStatus: 'paid',
    paidAmount: 5000,
    outstandingAmount: 0,
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-09-29T10:00:00.000Z',
    finalizedAt: '2026-09-29T10:00:00.000Z',
  },
];

describe('Navigation State Persistence Engine', () => {
  beforeEach(() => {
    storageService.clearAll();
  });

  describe('Tab Normalization', () => {
    it('normalizes primary nav tabs', () => {
      expect(normalizeTab('home')).toBe('home');
      expect(normalizeTab('workspace')).toBe('workspace');
      expect(normalizeTab('drafts')).toBe('drafts');
      expect(normalizeTab('invoices')).toBe('invoices');
      expect(normalizeTab('parties')).toBe('parties');
      expect(normalizeTab('settings')).toBe('settings');
    });

    it('normalizes common synonyms and aliases', () => {
      expect(normalizeTab('overview')).toBe('home');
      expect(normalizeTab('history')).toBe('invoices');
      expect(normalizeTab('invoice')).toBe('invoices');
      expect(normalizeTab('customers')).toBe('parties');
      expect(normalizeTab('customer')).toBe('parties');
      expect(normalizeTab('party')).toBe('parties');
      expect(normalizeTab('draft')).toBe('drafts');
      expect(normalizeTab('setting')).toBe('settings');
    });

    it('is case-insensitive and trims whitespace', () => {
      expect(normalizeTab('  HISTORY  ')).toBe('invoices');
      expect(normalizeTab('Parties')).toBe('parties');
      expect(normalizeTab('WORKSpace')).toBe('workspace');
      expect(normalizeTab('  HOME  ')).toBe('home');
    });

    it('returns null for unrecognized or invalid strings', () => {
      expect(normalizeTab('')).toBeNull();
      expect(normalizeTab(null)).toBeNull();
      expect(normalizeTab(undefined)).toBeNull();
      expect(normalizeTab('admin')).toBeNull();
      expect(normalizeTab('dashboard')).toBeNull();
      expect(normalizeTab('random_unknown')).toBeNull();
    });
  });

  describe('Hash Parsing', () => {
    it('returns null for empty or bare root hashes (allowing localStorage fallback)', () => {
      expect(parseNavigationHash('')).toBeNull();
      expect(parseNavigationHash('#')).toBeNull();
      expect(parseNavigationHash('#/')).toBeNull();
      expect(parseNavigationHash('   ')).toBeNull();
    });

    it('parses valid top-level section hashes', () => {
      expect(parseNavigationHash('#home')).toEqual({ tab: 'home', invoiceId: null });
      expect(parseNavigationHash('#/home')).toEqual({ tab: 'home', invoiceId: null });
      expect(parseNavigationHash('#workspace')).toEqual({ tab: 'workspace', invoiceId: null });
      expect(parseNavigationHash('#/workspace')).toEqual({ tab: 'workspace', invoiceId: null });
      expect(parseNavigationHash('#drafts')).toEqual({ tab: 'drafts', invoiceId: null });
      expect(parseNavigationHash('#invoices')).toEqual({ tab: 'invoices', invoiceId: null });
      expect(parseNavigationHash('#history')).toEqual({ tab: 'invoices', invoiceId: null });
      expect(parseNavigationHash('#parties')).toEqual({ tab: 'parties', invoiceId: null });
      expect(parseNavigationHash('#customers')).toEqual({ tab: 'parties', invoiceId: null });
      expect(parseNavigationHash('#settings')).toEqual({ tab: 'settings', invoiceId: null });
    });

    it('parses deep invoice navigation hashes with query parameters', () => {
      expect(parseNavigationHash('#invoices?id=inv_test_001')).toEqual({
        tab: 'invoices',
        invoiceId: 'inv_test_001',
      });
      expect(parseNavigationHash('#/invoices?id=inv_test_001')).toEqual({
        tab: 'invoices',
        invoiceId: 'inv_test_001',
      });
      expect(parseNavigationHash('#invoices?invoiceId=inv_test_001')).toEqual({
        tab: 'invoices',
        invoiceId: 'inv_test_001',
      });
      expect(parseNavigationHash('#history?id=inv_test_001')).toEqual({
        tab: 'invoices',
        invoiceId: 'inv_test_001',
      });
    });

    it('parses deep invoice navigation hashes with path segment', () => {
      expect(parseNavigationHash('#invoices/inv_test_001')).toEqual({
        tab: 'invoices',
        invoiceId: 'inv_test_001',
      });
      expect(parseNavigationHash('#/invoices/inv_test_001')).toEqual({
        tab: 'invoices',
        invoiceId: 'inv_test_001',
      });
    });

    it('safely falls back to default workspace for invalid or corrupt hashes', () => {
      expect(parseNavigationHash('#unknown_section')).toEqual(DEFAULT_NAV_STATE);
      expect(parseNavigationHash('#malicious<script>alert(1)</script>')).toEqual(DEFAULT_NAV_STATE);
      expect(parseNavigationHash('#12345')).toEqual(DEFAULT_NAV_STATE);
    });

    it('ignores invoice IDs on non-invoice tabs', () => {
      expect(parseNavigationHash('#drafts?id=inv_123')).toEqual({ tab: 'drafts', invoiceId: null });
      expect(parseNavigationHash('#parties?id=inv_123')).toEqual({ tab: 'parties', invoiceId: null });
    });
  });

  describe('Hash Formatting', () => {
    it('formats top-level section hashes cleanly', () => {
      expect(formatNavigationHash({ tab: 'home' })).toBe('#home');
      expect(formatNavigationHash({ tab: 'workspace' })).toBe('#workspace');
      expect(formatNavigationHash({ tab: 'drafts' })).toBe('#drafts');
      expect(formatNavigationHash({ tab: 'invoices' })).toBe('#invoices');
      expect(formatNavigationHash({ tab: 'parties' })).toBe('#parties');
      expect(formatNavigationHash({ tab: 'settings' })).toBe('#settings');
    });

    it('formats deep invoice navigation hash when invoiceId is present', () => {
      expect(formatNavigationHash({ tab: 'invoices', invoiceId: 'inv_test_001' })).toBe(
        '#invoices?id=inv_test_001'
      );
    });

    it('encodes special characters in invoice IDs', () => {
      expect(formatNavigationHash({ tab: 'invoices', invoiceId: 'inv/2026/001' })).toBe(
        '#invoices?id=inv%2F2026%2F001'
      );
    });
  });

  describe('LocalStorage Persistence (via storageService)', () => {
    it('persists and restores navigation state without business or sensitive data', () => {
      expect(storageService.getNavigationState()).toBeNull();

      storageService.saveNavigationState({ tab: 'parties', invoiceId: null });
      expect(storageService.getNavigationState()).toEqual({ tab: 'parties', invoiceId: null });

      storageService.saveNavigationState({ tab: 'invoices', invoiceId: 'inv_test_001' });
      expect(storageService.getNavigationState()).toEqual({
        tab: 'invoices',
        invoiceId: 'inv_test_001',
      });
    });

    it('handles corrupted JSON in storage gracefully', () => {
      // Intentionally insert corrupted JSON string
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(NAV_STORAGE_KEY, '{corrupted_json');
      }
      expect(storageService.getNavigationState()).toBeNull();
    });

    it('handles invalid stored tab gracefully', () => {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify({ tab: 'unknown_tab_123' }));
      }
      expect(storageService.getNavigationState()).toBeNull();
    });
  });

  describe('Browser Refresh Resolution (resolveInitialNavigation)', () => {
    it('preserves Workspace across browser refresh: Workspace → refresh → Workspace', () => {
      const result = resolveInitialNavigation('#workspace', null, mockInvoices);
      expect(result.tab).toBe('workspace');
      expect(result.viewingInvoice).toBeNull();
      expect(result.effectiveHash).toBe('#workspace');
    });

    it('preserves History across browser refresh: History → refresh → History', () => {
      const result = resolveInitialNavigation('#invoices', null, mockInvoices);
      expect(result.tab).toBe('invoices');
      expect(result.viewingInvoice).toBeNull();
      expect(result.effectiveHash).toBe('#invoices');
    });

    it('preserves Parties across browser refresh: Parties → refresh → Parties', () => {
      const result = resolveInitialNavigation('#parties', null, mockInvoices);
      expect(result.tab).toBe('parties');
      expect(result.viewingInvoice).toBeNull();
      expect(result.effectiveHash).toBe('#parties');
    });

    it('preserves Drafts across browser refresh: Drafts → refresh → Drafts', () => {
      const result = resolveInitialNavigation('#drafts', null, mockInvoices);
      expect(result.tab).toBe('drafts');
      expect(result.viewingInvoice).toBeNull();
      expect(result.effectiveHash).toBe('#drafts');
    });

    it('preserves Settings across browser refresh: Settings → refresh → Settings', () => {
      const result = resolveInitialNavigation('#settings', null, mockInvoices);
      expect(result.tab).toBe('settings');
      expect(result.viewingInvoice).toBeNull();
      expect(result.effectiveHash).toBe('#settings');
    });

    it('preserves specific invoice view across refresh if invoice exists', () => {
      const result = resolveInitialNavigation('#invoices?id=inv_test_001', null, mockInvoices);
      expect(result.tab).toBe('invoices');
      expect(result.viewingInvoice).not.toBeNull();
      expect(result.viewingInvoice?.id).toBe('inv_test_001');
      expect(result.effectiveHash).toBe('#invoices?id=inv_test_001');
    });

    it('safely falls back to History list if requested invoice does not exist or is stale', () => {
      const result = resolveInitialNavigation(
        '#invoices?id=non_existent_invoice_id',
        null,
        mockInvoices
      );
      expect(result.tab).toBe('invoices');
      expect(result.viewingInvoice).toBeNull();
      expect(result.effectiveHash).toBe('#invoices');
    });

    it('safely falls back to Workspace when URL hash is invalid', () => {
      const result = resolveInitialNavigation('#invalid_random_tab', null, mockInvoices);
      expect(result.tab).toBe('workspace');
      expect(result.viewingInvoice).toBeNull();
      expect(result.effectiveHash).toBe('#workspace');
    });

    it('restores section from localStorage if URL has no hash', () => {
      const stored = { tab: 'parties' as const, invoiceId: null };
      const result = resolveInitialNavigation('', stored, mockInvoices);
      expect(result.tab).toBe('parties');
      expect(result.viewingInvoice).toBeNull();
      expect(result.effectiveHash).toBe('#parties');
    });

    it('restores invoice view from localStorage if URL has no hash', () => {
      const stored = { tab: 'invoices' as const, invoiceId: 'inv_test_002' };
      const result = resolveInitialNavigation('', stored, mockInvoices);
      expect(result.tab).toBe('invoices');
      expect(result.viewingInvoice?.id).toBe('inv_test_002');
      expect(result.effectiveHash).toBe('#invoices?id=inv_test_002');
    });

    it('falls back to Workspace if both URL hash and localStorage are invalid or absent', () => {
      const result = resolveInitialNavigation('', null, mockInvoices);
      expect(result.tab).toBe('workspace');
      expect(result.viewingInvoice).toBeNull();
      expect(result.effectiveHash).toBe('#workspace');
    });
  });

  describe('Logout URL Hash Clearing (clearBrowserHash)', () => {
    const originalWindow = globalThis.window;

    function setupMockWindow(initialHash: string) {
      let _hash = initialHash;
      let _pathname = '/';
      let _search = '';
      const mockWin = {
        location: {
          get hash() {
            return _hash;
          },
          set hash(val: string) {
            _hash = val ? (val.startsWith('#') ? val : '#' + val) : '';
          },
          get pathname() {
            return _pathname;
          },
          get search() {
            return _search;
          },
        },
        history: {
          replaceState(_state: any, _title: string, url: string) {
            if (url.includes('#')) {
              _hash = '#' + url.split('#')[1];
            } else {
              _hash = '';
            }
          },
          pushState(_state: any, _title: string, url: string) {
            if (url.includes('#')) {
              _hash = '#' + url.split('#')[1];
            } else {
              _hash = '';
            }
          },
        },
      };
      (globalThis as any).window = mockWin;
      return mockWin;
    }

    afterEach(() => {
      (globalThis as any).window = originalWindow;
    });

    it('clears URL hash to clean root / when logging out from #workspace', () => {
      const win = setupMockWindow('#workspace');
      expect(win.location.hash).toBe('#workspace');
      clearBrowserHash();
      expect(win.location.hash).toBe('');
    });

    it('clears URL hash to clean root / when logging out from #parties', () => {
      const win = setupMockWindow('#parties');
      expect(win.location.hash).toBe('#parties');
      clearBrowserHash();
      expect(win.location.hash).toBe('');
    });

    it('clears URL hash to clean root / when logging out from #invoices', () => {
      const win = setupMockWindow('#invoices');
      expect(win.location.hash).toBe('#invoices');
      clearBrowserHash();
      expect(win.location.hash).toBe('');
    });

    it('clears URL hash to clean root / when logging out from #drafts', () => {
      const win = setupMockWindow('#drafts');
      expect(win.location.hash).toBe('#drafts');
      clearBrowserHash();
      expect(win.location.hash).toBe('');
    });

    it('clears URL hash to clean root / when logging out from #settings', () => {
      const win = setupMockWindow('#settings');
      expect(win.location.hash).toBe('#settings');
      clearBrowserHash();
      expect(win.location.hash).toBe('');
    });

    it('clears URL hash to clean root / when logging out from deep invoice view #invoices?id=inv_123', () => {
      const win = setupMockWindow('#invoices?id=inv_123');
      expect(win.location.hash).toBe('#invoices?id=inv_123');
      clearBrowserHash();
      expect(win.location.hash).toBe('');
    });
  });
});
