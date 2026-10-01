import type { BusinessSettings, Party, RateMemoryItem, Invoice, BillDraft } from '../domain/types';
import { storageService } from './storage';

export type SyncStatus = 'synced' | 'syncing' | 'offline';

export interface SyncState {
  serverTime: string;
  settings: BusinessSettings | null;
  parties: Party[];
  rateMemory: RateMemoryItem[];
  invoices: Invoice[];
  drafts?: BillDraft[];
  activeDraft: Partial<Invoice> | null;
}

interface QueuedAction {
  id: string;
  type: 'save_draft' | 'save_party' | 'save_settings' | 'record_payment' | 'delete_party';
  payload: any;
  queuedAt: string;
}

const OFFLINE_QUEUE_KEY = 'skt_offline_queue_v1';
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...options,
  });
  if (res.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('skt:auth-error'));
  }
  return res;
}

type SyncListener = (state: Partial<SyncState>, status: SyncStatus) => void;

class SyncService {
  private syncStatus: SyncStatus = 'synced';
  private listeners: Set<SyncListener> = new Set();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private lastServerTimestamp: string = '';

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.setStatus('syncing');
        this.drainQueue().then(() => this.pullLatest());
      });
      window.addEventListener('offline', () => {
        this.setStatus('offline');
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.pullLatest();
        }
      });
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener({}, this.syncStatus);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: SyncStatus) {
    if (this.syncStatus !== status) {
      this.syncStatus = status;
      this.notifyListeners({}, status);
    }
  }

  private notifyListeners(partialState: Partial<SyncState>, status: SyncStatus) {
    this.listeners.forEach((fn) => fn(partialState, status));
  }

  public startSync(intervalMs = 2500): void {
    this.stopSync();
    // Initial fetch
    this.pullLatest();
    this.pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        this.pullLatest();
      }
    }, intervalMs);
  }

  public stopSync(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  public getStatus(): SyncStatus {
    return this.syncStatus;
  }

  public getLastServerTimestamp(): string {
    return this.lastServerTimestamp;
  }

  // --------------------------------------------------------------------------
  // PULL LATEST FROM SHARED DATABASE
  // --------------------------------------------------------------------------
  public async pullLatest(): Promise<SyncState | null> {
    if (this.isSyncing) return null;
    this.isSyncing = true;

    try {
      const res = await authFetch('/api/sync/state');

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data: SyncState = await res.json();
      this.lastServerTimestamp = data.serverTime;
      this.setStatus('synced');

      // Update local storage cache to keep it in sync with database
      if (data.settings) storageService.saveSettings(data.settings);
      if (data.parties) storageService.saveParties(data.parties);
      if (data.rateMemory) storageService.saveRateMemory(data.rateMemory);
      if (data.invoices) storageService.saveInvoices(data.invoices);

      // Check draft updates
      if (data.drafts && Array.isArray(data.drafts)) {
        storageService.mergeDrafts(data.drafts);
      } else if (data.activeDraft) {
        const localDraft = storageService.getActiveDraft();
        const serverDraftTime = new Date(data.activeDraft.updatedAt || 0).getTime();
        const localDraftTime = new Date(localDraft?.updatedAt || 0).getTime();
        // Server draft is newer or local has none
        if (!localDraft || serverDraftTime > localDraftTime) {
          storageService.saveActiveDraft(data.activeDraft);
        }
      }

      this.notifyListeners(data, 'synced');
      return data;
    } catch {
      this.setStatus('offline');
      return null;
    } finally {
      this.isSyncing = false;
    }
  }

  // --------------------------------------------------------------------------
  // DRAFT SYNCHRONIZATION
  // --------------------------------------------------------------------------
  public async pushDraft(draft: Partial<Invoice> | BillDraft): Promise<boolean> {
    if (draft.id) {
      storageService.saveDraft(draft as BillDraft);
    } else {
      storageService.saveActiveDraft(draft);
    }

    try {
      this.setStatus('syncing');
      const res = await authFetch('/api/draft', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draft),
        keepalive: true,
      });

      if (!res.ok) throw new Error('Failed to sync draft');
      this.setStatus('synced');
      this.notifyListeners({ drafts: storageService.getDrafts() }, 'synced');
      return true;
    } catch {
      this.queueAction('save_draft', draft);
      this.setStatus('offline');
      return false;
    }
  }

  public async deleteDraft(draftId: string): Promise<boolean> {
    storageService.deleteDraft(draftId);
    try {
      await authFetch(`/api/drafts/${draftId}`, {
        method: 'DELETE',
      });
      this.notifyListeners({ drafts: storageService.getDrafts() }, 'synced');
      return true;
    } catch {
      return false;
    }
  }

  public async clearDraft(): Promise<boolean> {
    const activeDraft = storageService.getActiveDraft();
    if (activeDraft && activeDraft.id) {
      return this.deleteDraft(activeDraft.id);
    }
    storageService.clearActiveDraft();
    try {
      await authFetch('/api/draft', {
        method: 'DELETE',
      });
      return true;
    } catch {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // PARTIES SYNCHRONIZATION
  // --------------------------------------------------------------------------
  public async saveParty(party: Partial<Party>): Promise<Party | null> {
    try {
      this.setStatus('syncing');
      const isEdit = Boolean(party.id && !party.id.startsWith('party_temp_'));
      const url = isEdit ? `/api/parties/${party.id}` : '/api/parties';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(party),
      });

      if (!res.ok) throw new Error('Party sync failed');
      const savedParty = await res.json();

      // Update local cache
      const parties = storageService.getParties();
      const existingIdx = parties.findIndex((p) => p.id === (isEdit ? party.id : savedParty.id));
      if (existingIdx >= 0) {
        parties[existingIdx] = { ...parties[existingIdx], ...savedParty };
      } else {
        parties.push(savedParty);
      }
      storageService.saveParties(parties);

      this.setStatus('synced');
      this.notifyListeners({ parties }, 'synced');
      return savedParty;
    } catch {
      // Local fallback & queue
      const parties = storageService.getParties();
      const tempParty: Party = {
        id: party.id || `party_${Date.now()}`,
        name: party.name || '',
        address: party.address || '',
        gstin: party.gstin || '',
        phone: party.phone || '',
        notes: party.notes,
        isArchived: Boolean(party.isArchived),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      parties.push(tempParty);
      storageService.saveParties(parties);
      this.queueAction('save_party', tempParty);
      this.setStatus('offline');
      return tempParty;
    }
  }

  public async archiveParty(partyId: string): Promise<boolean> {
    storageService.archiveParty(partyId);
    try {
      this.setStatus('syncing');
      const res = await authFetch(`/api/parties/${partyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isArchived: true }),
      });
      if (!res.ok) throw new Error('Archive sync failed');
      const updated = await res.json();
      const parties = storageService.getParties();
      const idx = parties.findIndex((p) => p.id === partyId);
      if (idx >= 0) {
        parties[idx] = { ...parties[idx], isArchived: true, updatedAt: updated.updatedAt || new Date().toISOString() };
        storageService.saveParties(parties);
      }
      this.setStatus('synced');
      this.notifyListeners({ parties }, 'synced');
      return true;
    } catch {
      this.queueAction('save_party', { id: partyId, isArchived: true });
      this.setStatus('offline');
      return true;
    }
  }

  public async restoreParty(partyId: string): Promise<boolean> {
    storageService.restoreParty(partyId);
    try {
      this.setStatus('syncing');
      const res = await authFetch(`/api/parties/${partyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isArchived: false }),
      });
      if (!res.ok) throw new Error('Restore sync failed');
      const updated = await res.json();
      const parties = storageService.getParties();
      const idx = parties.findIndex((p) => p.id === partyId);
      if (idx >= 0) {
        parties[idx] = { ...parties[idx], isArchived: false, updatedAt: updated.updatedAt || new Date().toISOString() };
        storageService.saveParties(parties);
      }
      this.setStatus('synced');
      this.notifyListeners({ parties }, 'synced');
      return true;
    } catch {
      this.queueAction('save_party', { id: partyId, isArchived: false });
      this.setStatus('offline');
      return true;
    }
  }

  public async deleteParty(partyId: string): Promise<boolean> {
    if (storageService.isPartyReferenced(partyId)) {
      throw new Error('Cannot delete customer: Referenced by existing invoice. Archive the customer instead.');
    }

    try {
      this.setStatus('syncing');
      const res = await authFetch(`/api/parties/${partyId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Customer deletion failed');
      }

      storageService.deleteParty(partyId);
      this.setStatus('synced');
      this.notifyListeners({ parties: storageService.getParties(), rateMemory: storageService.getRateMemory() }, 'synced');
      return true;
    } catch (err: any) {
      if (err.message && err.message.includes('Referenced by invoice')) {
        throw err;
      }
      storageService.deleteParty(partyId);
      this.queueAction('delete_party', { id: partyId });
      this.setStatus('offline');
      this.notifyListeners({ parties: storageService.getParties(), rateMemory: storageService.getRateMemory() }, 'offline');
      return true;
    }
  }

  // --------------------------------------------------------------------------
  // ATOMIC INVOICE FINALIZATION (Directly to SQLite with Immediate Concurrency Lock)
  // --------------------------------------------------------------------------
  public async finalizeInvoice(payload: {
    financialYear: string;
    partyId: string;
    invoiceDate: string;
    dcs: any[];
    calculations: any;
    draftId?: string;
  }): Promise<Invoice> {
    this.setStatus('syncing');
    const res = await authFetch('/api/invoices/finalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown server error' }));
      throw new Error(err.error || 'Invoice finalization failed');
    }

    const finalizedInvoice: Invoice = await res.json();

    // Update local cache
    const existing = storageService.getInvoices();
    existing.unshift(finalizedInvoice);
    storageService.saveInvoices(existing);
    if (payload.draftId) {
      storageService.deleteDraft(payload.draftId);
    } else {
      storageService.clearActiveDraft();
    }

    this.setStatus('synced');
    this.notifyListeners({ invoices: existing, drafts: storageService.getDrafts(), activeDraft: null }, 'synced');
    return finalizedInvoice;
  }

  // --------------------------------------------------------------------------
  // INVOICE PAYMENT RECORDING
  // --------------------------------------------------------------------------
  public async recordPayment(invoiceId: string, amount: number, date: string, notes?: string): Promise<boolean> {
    try {
      this.setStatus('syncing');
      const res = await authFetch(`/api/invoices/${invoiceId}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount, date, notes }),
      });

      if (!res.ok) throw new Error('Payment sync failed');
      await this.pullLatest();
      return true;
    } catch {
      this.queueAction('record_payment', { invoiceId, amount, date, notes });
      this.setStatus('offline');
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // INVOICE CANCELLATION (Protected backend operation)
  // --------------------------------------------------------------------------
  public async cancelInvoice(invoiceId: string, reason?: string): Promise<Invoice> {
    this.setStatus('syncing');
    try {
      const res = await authFetch(`/api/invoices/${invoiceId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Cancellation failed with status ${res.status}`);
      }

      const result = await res.json();
      const updated = storageService.cancelInvoice(invoiceId, reason);
      if (result.cancelledAt) {
        updated.cancelledAt = result.cancelledAt;
      }
      if (result.cancellationReason !== undefined) {
        updated.cancellationReason = result.cancellationReason;
      }
      const invoices = storageService.getInvoices();
      const idx = invoices.findIndex((i) => i.id === invoiceId);
      if (idx >= 0) {
        invoices[idx] = updated;
        storageService.saveInvoices(invoices);
      }

      this.setStatus('synced');
      this.notifyListeners({ invoices }, 'synced');
      return updated;
    } catch (err: any) {
      if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
        this.setStatus('synced');
        throw err;
      }
      console.warn('Network offline during cancellation, applying local cancellation', err);
      const updated = storageService.cancelInvoice(invoiceId, reason);
      const invoices = storageService.getInvoices();
      this.setStatus('offline');
      this.notifyListeners({ invoices }, 'offline');
      return updated;
    }
  }

  // --------------------------------------------------------------------------
  // SETTINGS SYNC
  // --------------------------------------------------------------------------
  public async saveSettings(settings: BusinessSettings): Promise<boolean> {
    storageService.saveSettings(settings);
    try {
      this.setStatus('syncing');
      const res = await authFetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error('Settings sync failed');
      this.setStatus('synced');
      this.notifyListeners({ settings }, 'synced');
      return true;
    } catch {
      this.queueAction('save_settings', settings);
      this.setStatus('offline');
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // OFFLINE QUEUE DRAIN
  // --------------------------------------------------------------------------
  private queueAction(type: QueuedAction['type'], payload: any) {
    if (typeof window === 'undefined') return;
    try {
      const queue: QueuedAction[] = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
      queue.push({
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type,
        payload,
        queuedAt: new Date().toISOString(),
      });
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to queue offline action', e);
    }
  }

  public async drainQueue(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!raw) return;
      const queue: QueuedAction[] = JSON.parse(raw);
      if (queue.length === 0) return;

      const remaining: QueuedAction[] = [];
      for (const item of queue) {
        try {
          if (item.type === 'save_draft') {
            await authFetch('/api/draft', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.payload),
            });
          } else if (item.type === 'save_party') {
            const isEdit = Boolean(item.payload.id && !item.payload.id.startsWith('party_temp_'));
            const url = isEdit ? `/api/parties/${item.payload.id}` : '/api/parties';
            const method = isEdit ? 'PUT' : 'POST';
            await authFetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.payload),
            });
          } else if (item.type === 'delete_party') {
            await authFetch(`/api/parties/${item.payload.id}`, {
              method: 'DELETE',
            });
          } else if (item.type === 'save_settings') {
            await authFetch('/api/settings', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.payload),
            });
          } else if (item.type === 'record_payment') {
            await authFetch(`/api/invoices/${item.payload.invoiceId}/payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.payload),
            });
          }
        } catch {
          remaining.push(item);
        }
      }

      if (remaining.length > 0) {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
      } else {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
      }
    } catch (e) {
      console.error('Error draining offline queue', e);
    }
  }

  // --------------------------------------------------------------------------
  // MIGRATION FROM LOCALSTORAGE (Phase 5)
  // --------------------------------------------------------------------------
  public async migrateFromLocalStorage(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const parties = storageService.getParties();
      const invoices = storageService.getInvoices();
      const rateMemory = storageService.getRateMemory();
      const draft = storageService.getActiveDraft();

      await authFetch('/api/sync/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ parties, invoices, rateMemory, draft }),
      });
    } catch (e) {
      console.error('Migration failed or offline', e);
    }
  }
}

export const syncService = new SyncService();
