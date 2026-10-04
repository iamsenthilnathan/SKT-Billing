import type { NavTab } from '../components/Navbar';
import type { Invoice } from '../domain/types';

export type { NavTab };

export interface NavigationState {
  tab: NavTab;
  invoiceId: string | null;
}

export const NAV_STORAGE_KEY = 'skt_nav_state_v1';

export const VALID_NAV_TABS: readonly NavTab[] = [
  'home',
  'workspace',
  'drafts',
  'invoices',
  'parties',
  'settings',
] as const;

export const DEFAULT_NAV_STATE: NavigationState = {
  tab: 'workspace',
  invoiceId: null,
};

/**
 * Normalizes user/URL strings to canonical NavTab identifiers.
 * Recognizes common synonyms (history -> invoices, customers -> parties).
 */
export function normalizeTab(rawTab?: string | null): NavTab | null {
  if (!rawTab || typeof rawTab !== 'string') return null;
  const cleaned = rawTab.trim().toLowerCase();
  if (cleaned === 'home' || cleaned === 'overview') return 'home';
  if (cleaned === 'workspace') return 'workspace';
  if (cleaned === 'drafts' || cleaned === 'draft') return 'drafts';
  if (cleaned === 'invoices' || cleaned === 'invoice' || cleaned === 'history') return 'invoices';
  if (cleaned === 'parties' || cleaned === 'party' || cleaned === 'customers' || cleaned === 'customer') return 'parties';
  if (cleaned === 'settings' || cleaned === 'setting') return 'settings';
  return null;
}

/**
 * Parses URL hash into a structured navigation state.
 * Supports:
 *   #workspace, #drafts, #invoices, #history, #parties, #settings
 *   #/invoices?id=inv_123, #invoices?id=inv_123, #invoices/inv_123
 *
 * Returns null if the hash is empty or absent (allows fallback to localStorage).
 * Returns default workspace state if the hash is unrecognized/invalid.
 */
export function parseNavigationHash(rawHash: string): NavigationState | null {
  if (!rawHash || typeof rawHash !== 'string') return null;
  const cleaned = rawHash.replace(/^[#\s/]+/, '');
  if (!cleaned) return null;

  const [pathPart, queryPart] = cleaned.split('?');
  const pathSegments = pathPart.split('/').filter(Boolean);
  const primarySegment = pathSegments[0] || '';
  const secondarySegment = pathSegments[1] || null;

  let invoiceId: string | null = null;
  if (queryPart) {
    try {
      const params = new URLSearchParams(queryPart);
      invoiceId = params.get('id') || params.get('invoiceId') || null;
    } catch {
      invoiceId = null;
    }
  }
  if (!invoiceId && secondarySegment) {
    try {
      invoiceId = decodeURIComponent(secondarySegment);
    } catch {
      invoiceId = secondarySegment;
    }
  }

  const tab = normalizeTab(primarySegment);
  if (!tab) {
    // Unrecognized hash - safe fallback to default workspace
    return { ...DEFAULT_NAV_STATE };
  }

  return {
    tab,
    invoiceId: tab === 'invoices' && invoiceId ? invoiceId.trim() : null,
  };
}

/**
 * Formats a navigation state into a clean URL hash string.
 */
export function formatNavigationHash(state: { tab: NavTab; invoiceId?: string | null }): string {
  const normalized = normalizeTab(state.tab) || 'workspace';
  if (normalized === 'invoices' && state.invoiceId && state.invoiceId.trim()) {
    return `#invoices?id=${encodeURIComponent(state.invoiceId.trim())}`;
  }
  return `#${normalized}`;
}

/**
 * Resolves the initial navigation state upon application startup or browser refresh.
 * Priority:
 *   1. Explicit URL hash
 *   2. Saved localStorage navigation state
 *   3. Default workspace
 *
 * Validates invoice existence if an invoice ID is requested.
 */
export function resolveInitialNavigation(
  rawHash: string,
  storedState: NavigationState | null,
  invoices: Invoice[] = []
): { tab: NavTab; viewingInvoice: Invoice | null; effectiveHash: string } {
  // 1. Check URL hash
  let state: NavigationState | null = parseNavigationHash(rawHash);

  // 2. If no hash present, check stored state
  if (!state && storedState) {
    const validTab = normalizeTab(storedState.tab);
    if (validTab) {
      state = {
        tab: validTab,
        invoiceId: validTab === 'invoices' && storedState.invoiceId ? storedState.invoiceId : null,
      };
    }
  }

  // 3. Fallback to default if null or tab invalid
  if (!state || !normalizeTab(state.tab)) {
    state = { ...DEFAULT_NAV_STATE };
  }

  // Guarantee canonical tab name
  const canonicalTab = normalizeTab(state.tab) || 'workspace';
  state = {
    tab: canonicalTab,
    invoiceId: canonicalTab === 'invoices' ? state.invoiceId : null,
  };

  // 4. Resolve viewingInvoice if requested
  let viewingInvoice: Invoice | null = null;
  const targetInvoiceId = state.invoiceId;
  if (state.tab === 'invoices' && targetInvoiceId) {
    const found = invoices.find((inv) => inv.id === targetInvoiceId);
    if (found) {
      viewingInvoice = found;
    } else {
      // Stale or invalid invoice ID: fall back safely to invoice list
      state = { tab: 'invoices', invoiceId: null };
    }
  }

  return {
    tab: state.tab,
    viewingInvoice,
    effectiveHash: formatNavigationHash(state),
  };
}

/**
 * Safely synchronizes the browser address bar with the target hash
 * without triggering redundant page reloads or loops.
 */
export function syncBrowserUrl(targetHash: string, replace = false): void {
  if (typeof window === 'undefined') return;
  if (window.location.hash === targetHash) return;

  try {
    if (replace) {
      window.history.replaceState(null, '', targetHash);
    } else {
      window.history.pushState(null, '', targetHash);
    }
  } catch {
    window.location.hash = targetHash;
  }
}

/**
 * Clears the URL hash and returns the address bar to the clean root path ('/')
 * without triggering a page reload.
 */
export function clearBrowserHash(): void {
  if (typeof window === 'undefined') return;
  try {
    const cleanUrl = window.location.pathname || '/';
    const search = window.location.search || '';
    window.history.replaceState(null, '', `${cleanUrl}${search}`);
    if (window.location.hash) {
      window.location.hash = '';
    }
  } catch {
    window.location.hash = '';
  }
}
