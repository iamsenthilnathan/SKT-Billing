import type { BusinessSettings, Party, RateMemoryItem, Invoice, BillDraft } from '../domain/types';
import { NAV_STORAGE_KEY, type NavigationState, type NavTab, normalizeTab } from './navigation';

const SETTINGS_KEY = 'skt_business_settings_v1';
const PARTIES_KEY = 'skt_parties_v1';
const RATE_MEMORY_KEY = 'skt_rate_memory_v1';
const INVOICES_KEY = 'skt_invoices_v1';
const ACTIVE_DRAFT_KEY = 'skt_active_draft_v1';
const DRAFTS_KEY = 'skt_drafts_v1';
const ACTIVE_DRAFT_ID_KEY = 'skt_active_draft_id_v1';

class SafeStorage {
  private mem = new Map<string, string>();

  getItem(key: string): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return this.mem.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    } else {
      this.mem.set(key, value);
    }
  }

  removeItem(key: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    } else {
      this.mem.delete(key);
    }
  }

  clear(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    } else {
      this.mem.clear();
    }
  }
}

const safeStorage = new SafeStorage();

// Ensure obsolete runaway counter from previous versions is completely wiped out
safeStorage.removeItem('skt_draft_numbers_v1');

export const DEFAULT_SETTINGS: BusinessSettings = {
  id: 'default',
  businessName: 'SRI KRISHNA TEXTILE',
  businessDescriptor: '(SoftFlow Fabric Dyeing)',
  address: '12, Mill Road, Tirupur - 641 602, Tamil Nadu',
  gstin: '33AAAAA0000A1Z5',
  phone: '9876543210',
  email: 'srikrishnatextile@example.com',
  bankName: 'State Bank of India',
  accountNumber: '12345678901234',
  ifscCode: 'SBIN0001234',
  branch: 'Tirupur Main',
  defaultCgstRate: 2.5,
  defaultSgstRate: 2.5,
  invoicePrefix: 'SKT',
  financialYearOverride: '',
  openingInvoiceSequences: {},
};

export const INITIAL_PARTIES: Party[] = [
  {
    id: 'party_1',
    name: 'ABC Fabrics Private Limited',
    address: '45, Cotton Market Ring Road, Tirupur - 641 604, Tamil Nadu',
    gstin: '33ABCDE1234F1Z9',
    phone: '9842111223',
    notes: 'Regular customer for cotton and bio-wash lots',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'party_2',
    name: 'Sree Amman Knits',
    address: '88, Avinashi Road, Tirupur - 641 652, Tamil Nadu',
    gstin: '33BCDEF2345G2Z0',
    phone: '9842233445',
    notes: 'Heat setting and dark shade dyeing',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'party_3',
    name: 'Lotus Garments & Processors',
    address: '102, Angeripalayam Main Road, Tirupur - 641 603, Tamil Nadu',
    gstin: '33CDEFG3456H3Z1',
    phone: '9842355667',
    notes: 'Single jersey and interlock fabrics',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const INITIAL_RATE_MEMORY: RateMemoryItem[] = [
  {
    id: 'rm_1',
    partyId: 'party_1',
    normalizedDescription: 'navy blue dyeing',
    suggestedRate: 45.0,
    lastUsedDate: '2026-09-12',
  },
  {
    id: 'rm_2',
    partyId: 'party_1',
    normalizedDescription: 'bio wash & stenter',
    suggestedRate: 18.0,
    lastUsedDate: '2026-09-12',
  },
  {
    id: 'rm_3',
    partyId: 'party_2',
    normalizedDescription: 'black dyeing & heat setting',
    suggestedRate: 42.0,
    lastUsedDate: '2026-09-19',
  },
];

export const INITIAL_INVOICES: Invoice[] = [];

class StorageService {
  clearAll(): void {
    safeStorage.clear();
  }

  getSettings(): BusinessSettings {
    try {
      const data = safeStorage.getItem(SETTINGS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          businessDescriptor:
            parsed.businessDescriptor !== undefined && parsed.businessDescriptor !== null && parsed.businessDescriptor !== ''
              ? parsed.businessDescriptor
              : DEFAULT_SETTINGS.businessDescriptor,
        };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings: BusinessSettings): void {
    safeStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  getParties(): Party[] {
    try {
      const data = safeStorage.getItem(PARTIES_KEY);
      if (data) {
        const parsed: Party[] = JSON.parse(data);
        return parsed.map((p) => ({
          ...p,
          isArchived: Boolean(p.isArchived),
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  getActiveParties(): Party[] {
    return this.getParties().filter((p) => !p.isArchived);
  }

  saveParties(parties: Party[]): void {
    safeStorage.setItem(PARTIES_KEY, JSON.stringify(parties));
  }

  addParty(party: Omit<Party, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Party {
    const parties = this.getParties();
    const newParty: Party = {
      ...party,
      id: party.id || `party_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      isArchived: Boolean(party.isArchived),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    parties.unshift(newParty);
    this.saveParties(parties);
    return newParty;
  }

  updateParty(party: Party): void {
    const parties = this.getParties();
    const idx = parties.findIndex((p) => p.id === party.id);
    if (idx >= 0) {
      parties[idx] = {
        ...parties[idx],
        ...party,
        isArchived: Boolean(party.isArchived),
        updatedAt: new Date().toISOString(),
      };
      this.saveParties(parties);
    }
  }

  archiveParty(partyId: string): void {
    const parties = this.getParties();
    const target = parties.find((p) => p.id === partyId);
    if (target) {
      target.isArchived = true;
      target.updatedAt = new Date().toISOString();
      this.saveParties(parties);
    }
  }

  restoreParty(partyId: string): void {
    const parties = this.getParties();
    const target = parties.find((p) => p.id === partyId);
    if (target) {
      target.isArchived = false;
      target.updatedAt = new Date().toISOString();
      this.saveParties(parties);
    }
  }

  isPartyReferenced(partyId: string): boolean {
    return this.getInvoices().some((inv) => inv.partyId === partyId);
  }

  deleteParty(partyId: string): void {
    if (this.isPartyReferenced(partyId)) {
      throw new Error('Cannot delete customer: Referenced by existing invoice. Archive the customer instead.');
    }
    const parties = this.getParties().filter((p) => p.id !== partyId);
    this.saveParties(parties);
    const rates = this.getRateMemory().filter((r) => r.partyId !== partyId);
    this.saveRateMemory(rates);
  }

  getRateMemory(): RateMemoryItem[] {
    try {
      const data = safeStorage.getItem(RATE_MEMORY_KEY);
      if (data) return JSON.parse(data);
      this.saveRateMemory(INITIAL_RATE_MEMORY);
      return INITIAL_RATE_MEMORY;
    } catch {
      return INITIAL_RATE_MEMORY;
    }
  }

  saveRateMemory(items: RateMemoryItem[]): void {
    safeStorage.setItem(RATE_MEMORY_KEY, JSON.stringify(items));
  }

  recordRateUsage(partyId: string, description: string, rate: number, invoiceNumber?: string): void {
    const normalized = description.trim().toLowerCase();
    if (!normalized || rate <= 0) return;

    const list = this.getRateMemory();
    const index = list.findIndex(
      (item) => item.partyId === partyId && item.normalizedDescription === normalized
    );

    const now = new Date().toISOString().split('T')[0];
    if (index >= 0) {
      list[index].suggestedRate = rate;
      list[index].lastUsedDate = now;
      if (invoiceNumber) list[index].lastUsedInvoiceNumber = invoiceNumber;
    } else {
      list.push({
        id: `rm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        partyId,
        normalizedDescription: normalized,
        suggestedRate: rate,
        lastUsedDate: now,
        lastUsedInvoiceNumber: invoiceNumber,
      });
    }
    this.saveRateMemory(list);
  }

  getSuggestedRate(partyId: string, description: string): RateMemoryItem | undefined {
    const normalized = description.trim().toLowerCase();
    if (!normalized) return undefined;
    const list = this.getRateMemory();
    return list.find(
      (item) => item.partyId === partyId && item.normalizedDescription === normalized
    );
  }

  getInvoices(): Invoice[] {
    try {
      const data = safeStorage.getItem(INVOICES_KEY);
      if (data) return JSON.parse(data);
      return [];
    } catch {
      return [];
    }
  }

  saveInvoices(invoices: Invoice[]): void {
    safeStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
  }

  getInvoice(id: string): Invoice | undefined {
    return this.getInvoices().find((inv) => inv.id === id);
  }

  cancelInvoice(invoiceId: string, reason?: string): Invoice {
    const invoices = this.getInvoices();
    const idx = invoices.findIndex((inv) => inv.id === invoiceId);
    if (idx === -1) {
      throw new Error(`Invoice with id "${invoiceId}" not found`);
    }
    const inv = invoices[idx];
    if (inv.status === 'cancelled') {
      throw new Error('Invoice is already cancelled');
    }
    if (inv.status !== 'finalized') {
      throw new Error(`Cannot cancel invoice with status "${inv.status}". Only finalized invoices can be cancelled.`);
    }

    const now = new Date().toISOString();
    const updatedInvoice: Invoice = {
      ...inv,
      status: 'cancelled',
      cancelledAt: now,
      cancellationReason: reason?.trim() || undefined,
      updatedAt: now,
    };

    invoices[idx] = updatedInvoice;
    this.saveInvoices(invoices);
    return updatedInvoice;
  }

  getNextInvoiceSequence(financialYear: string, openingOverride?: number, invoicesList?: Invoice[]): number {
    const allInvoices = invoicesList || this.getInvoices();
    const invoices = allInvoices.filter(
      (inv) => inv.financialYear === financialYear && (inv.status === 'finalized' || inv.status === 'cancelled') && inv.sequenceNumber
    );
    const settings = this.getSettings();
    const opening = openingOverride !== undefined ? openingOverride : settings.openingInvoiceSequences?.[financialYear];
    const configuredOpening = opening && Number(opening) > 0 ? Number(opening) : 1;

    if (invoices.length === 0) return configuredOpening;
    const maxSeq = Math.max(...invoices.map((inv) => inv.sequenceNumber || 0));
    return Math.max(configuredOpening, maxSeq + 1);
  }

  getNextInvoiceNumberPreview(
    financialYear: string,
    prefix: string = 'SKT',
    openingOverride?: number,
    invoicesList?: Invoice[]
  ): string {
    const seq = this.getNextInvoiceSequence(financialYear, openingOverride, invoicesList);
    return `${prefix}/${financialYear}/${String(seq).padStart(3, '0')}`;
  }

  getDrafts(): BillDraft[] {
    try {
      const data = safeStorage.getItem(DRAFTS_KEY);
      if (data) {
        return JSON.parse(data);
      }
      // Check legacy single-draft storage for smooth migration
      const legacyData = safeStorage.getItem(ACTIVE_DRAFT_KEY);
      if (legacyData) {
        const legacy = JSON.parse(legacyData);
        if (legacy && (legacy.id || (legacy.dcs && legacy.dcs.length > 0))) {
          const draft: BillDraft = {
            id: legacy.id || `draft_${Date.now()}`,
            partyId: legacy.partyId || '',
            invoiceDate: legacy.invoiceDate || new Date().toISOString().split('T')[0],
            dcs: legacy.dcs || [],
            calculations: legacy.calculations,
            createdAt: legacy.createdAt || new Date().toISOString(),
            updatedAt: legacy.updatedAt || new Date().toISOString(),
          };
          this.saveDrafts([draft]);
          this.setActiveDraftId(draft.id);
          safeStorage.removeItem(ACTIVE_DRAFT_KEY);
          return [draft];
        }
      }
      return [];
    } catch {
      return [];
    }
  }

  saveDrafts(drafts: BillDraft[]): void {
    safeStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  }

  getDraft(id: string): BillDraft | null {
    const drafts = this.getDrafts();
    return drafts.find((d) => d.id === id) || null;
  }

  saveDraft(draft: BillDraft): void {
    const drafts = this.getDrafts();
    const idx = drafts.findIndex((d) => d.id === draft.id);
    const now = new Date().toISOString();
    if (idx >= 0) {
      drafts[idx] = {
        ...drafts[idx],
        ...draft,
        updatedAt: draft.updatedAt || now,
      };
    } else {
      drafts.unshift({
        ...draft,
        createdAt: draft.createdAt || now,
        updatedAt: draft.updatedAt || now,
      });
    }
    this.saveDrafts(drafts);
  }

  deleteDraft(id: string): void {
    const drafts = this.getDrafts().filter((d) => d.id !== id);
    this.saveDrafts(drafts);
    if (this.getActiveDraftId() === id) {
      this.setActiveDraftId(drafts.length > 0 ? drafts[0].id : '');
    }
  }

  getActiveDraftId(): string | null {
    const val = safeStorage.getItem(ACTIVE_DRAFT_ID_KEY);
    return val && val.trim() ? val.trim() : null;
  }

  setActiveDraftId(id: string): void {
    if (id && id.trim()) {
      safeStorage.setItem(ACTIVE_DRAFT_ID_KEY, id.trim());
    } else {
      safeStorage.removeItem(ACTIVE_DRAFT_ID_KEY);
    }
  }

  getActiveDraft(): BillDraft | null {
    const drafts = this.getDrafts();
    if (drafts.length === 0) return null;
    const activeId = this.getActiveDraftId();
    if (activeId) {
      const found = drafts.find((d) => d.id === activeId);
      if (found) return found;
    }
    return drafts[0] || null;
  }

  saveActiveDraft(draft: Partial<Invoice> | BillDraft): void {
    const id = draft.id || this.getActiveDraftId() || `draft_${Date.now()}`;
    const now = new Date().toISOString();
    const bDraft: BillDraft = {
      id,
      partyId: draft.partyId || '',
      invoiceDate: draft.invoiceDate || now.split('T')[0],
      dcs: (draft.dcs as any) || [],
      calculations: draft.calculations,
      createdAt: (draft as any).createdAt || now,
      updatedAt: draft.updatedAt || now,
    };
    this.saveDraft(bDraft);
    this.setActiveDraftId(id);
  }

  clearActiveDraft(): void {
    const activeId = this.getActiveDraftId();
    if (activeId) {
      this.deleteDraft(activeId);
    }
    this.setActiveDraftId('');
  }

  mergeDrafts(serverDrafts: BillDraft[]): BillDraft[] {
    const local = this.getDrafts();
    const map = new Map<string, BillDraft>();

    // Add server drafts (server is authoritative for persisted drafts)
    for (const sd of serverDrafts) {
      map.set(sd.id, sd);
    }

    // Check for any uncommitted offline drafts that have never been synced to the server
    const offlineDraftIds = new Set<string>();
    try {
      const raw = safeStorage.getItem('skt_offline_queue_v1');
      if (raw) {
        const queue = JSON.parse(raw);
        if (Array.isArray(queue)) {
          for (const item of queue) {
            if (item.type === 'save_draft' && item.payload?.id) {
              offlineDraftIds.add(item.payload.id);
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // Merge or prioritize newer local drafts ONLY if they exist on the server
    // or are legitimately queued uncommitted offline drafts.
    for (const ld of local) {
      const sd = map.get(ld.id);
      if (sd) {
        const sTime = new Date(sd.updatedAt || 0).getTime();
        const lTime = new Date(ld.updatedAt || 0).getTime();
        if (lTime > sTime) {
          map.set(ld.id, ld);
        }
      } else if (offlineDraftIds.has(ld.id)) {
        // Legitimate offline-created draft not yet synced to server
        map.set(ld.id, ld);
      }
      // If not on server and not in offline queue, it was deleted on the server.
      // Do NOT resurrect it!
    }

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    this.saveDrafts(merged);

    // If activeDraftId is no longer present in merged drafts, reset activeDraftId
    const activeId = this.getActiveDraftId();
    if (activeId && !merged.some((d) => d.id === activeId)) {
      this.setActiveDraftId(merged.length > 0 ? merged[0].id : '');
    }

    return merged;
  }

  getNavigationState(): NavigationState | null {
    try {
      const data = safeStorage.getItem(NAV_STORAGE_KEY);
      if (!data) return null;
      const parsed = JSON.parse(data);
      const tab = normalizeTab(parsed?.tab);
      if (!tab) return null;
      const invoiceId =
        typeof parsed?.invoiceId === 'string' && parsed.invoiceId.trim()
          ? parsed.invoiceId.trim()
          : null;
      return { tab, invoiceId };
    } catch {
      return null;
    }
  }

  saveNavigationState(state: { tab: NavTab; invoiceId?: string | null }): void {
    try {
      const tab = normalizeTab(state.tab) || 'workspace';
      const invoiceId =
        tab === 'invoices' && typeof state.invoiceId === 'string' && state.invoiceId.trim()
          ? state.invoiceId.trim()
          : null;
      safeStorage.setItem(
        NAV_STORAGE_KEY,
        JSON.stringify({ tab, invoiceId })
      );
    } catch {
      // Ignore write errors
    }
  }

  clearNavigationState(): void {
    safeStorage.removeItem(NAV_STORAGE_KEY);
  }

  exportFullBackup(): string {
    const backupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      businessSettings: this.getSettings(),
      parties: this.getParties(),
      rateMemory: this.getRateMemory(),
      invoices: this.getInvoices(),
      drafts: this.getDrafts(),
      activeDraftId: this.getActiveDraftId(),
    };
    return JSON.stringify(backupData, null, 2);
  }

  importFullBackup(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (!data.businessSettings || !Array.isArray(data.parties) || !Array.isArray(data.invoices)) {
        throw new Error('Invalid backup file structure');
      }
      this.saveSettings(data.businessSettings);
      this.saveParties(data.parties);
      if (Array.isArray(data.rateMemory)) this.saveRateMemory(data.rateMemory);
      this.saveInvoices(data.invoices);
      if (Array.isArray(data.drafts)) this.saveDrafts(data.drafts);
      if (data.activeDraftId) this.setActiveDraftId(data.activeDraftId);
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  }
}

export const storageService = new StorageService();
