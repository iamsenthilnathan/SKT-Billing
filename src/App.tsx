import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';

const CLOUD_SYNC_DEBOUNCE_MS = 10000;
import { PartySelector } from './components/workspace/PartySelector';
import { DCBlock } from './components/workspace/DCBlock';
import { SummaryPanel } from './components/workspace/SummaryPanel';
import { DraftsManager } from './components/workspace/DraftsManager';
import { InvoiceView } from './components/invoice/InvoiceView';
import { InvoiceList } from './components/invoice/InvoiceList';
import { PartyManager } from './components/parties/PartyManager';
import { SettingsManager } from './components/settings/SettingsManager';
import { Plus } from 'lucide-react';
import type {
  BusinessSettings,
  Party,
  RateMemoryItem,
  Invoice,
  DCGroup,
  PaymentStatus,
  BillDraft,
} from './domain/types';
import { storageService } from './services/storage';
import { syncService, type SyncStatus } from './services/syncService';
import {
  calculateInvoiceFinancials,
  getFinancialYear,
  validateInvoiceForFinalization,
} from './domain/calculations';
import {
  type NavTab,
  parseNavigationHash,
  formatNavigationHash,
  resolveInitialNavigation,
  syncBrowserUrl,
} from './services/navigation';

const createInitialDc = (dateStr: string): DCGroup => ({
  id: `dc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  ourDcNumber: '',
  partyDcNumber: '',
  partyDcDate: dateStr,
  sortOrder: 0,
  workEntries: [
    {
      id: `w_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      description: '',
      rolls: 0,
      weightDisplay: '',
      weightKg: 0,
      rate: 0,
      amount: 0,
      sortOrder: 0,
    },
  ],
});

export function App() {
  // Navigation State with URL Hash & LocalStorage Refresh Persistence
  const initialNav = useMemo(() => {
    const rawHash = typeof window !== 'undefined' ? window.location.hash : '';
    const stored = storageService.getNavigationState();
    const allInvoices = storageService.getInvoices();
    return resolveInitialNavigation(rawHash, stored, allInvoices);
  }, []);

  const [activeTab, setActiveTab] = useState<NavTab>(() => initialNav.tab);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(() => initialNav.viewingInvoice);
  const pendingInvoiceIdRef = useRef<string | null>(
    typeof window !== 'undefined' ? parseNavigationHash(window.location.hash)?.invoiceId || null : null
  );

  // App Master Data State
  const [settings, setSettings] = useState<BusinessSettings>(() => storageService.getSettings());
  const [parties, setParties] = useState<Party[]>(() => storageService.getParties());
  const [rateMemory, setRateMemory] = useState<RateMemoryItem[]>(() => storageService.getRateMemory());
  const [invoices, setInvoices] = useState<Invoice[]>(() => storageService.getInvoices());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => syncService.getStatus());

  // Multi-Drafts State Management
  const [drafts, setDrafts] = useState<BillDraft[]>(() => storageService.getDrafts());
  const [draftId, setDraftId] = useState<string>(() => {
    const active = storageService.getActiveDraft();
    return active?.id || `draft_${Date.now()}`;
  });
  const [selectedPartyId, setSelectedPartyId] = useState<string>(() => {
    const active = storageService.getActiveDraft();
    return active?.partyId || '';
  });
  const [invoiceDate, setInvoiceDate] = useState<string>(() => {
    const active = storageService.getActiveDraft();
    return active?.invoiceDate || new Date().toISOString().split('T')[0];
  });
  const [dcs, setDcs] = useState<DCGroup[]>(() => {
    const active = storageService.getActiveDraft();
    if (active && active.dcs && active.dcs.length > 0) {
      return active.dcs;
    }
    const today = new Date().toISOString().split('T')[0];
    return [createInitialDc(today)];
  });

  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [hasAttemptedFinalize, setHasAttemptedFinalize] = useState<boolean>(false);

  // Derive Financial Year dynamically from the selected invoice date (or manual override from Settings if configured)
  const financialYear = useMemo(() => {
    if (settings.financialYearOverride && settings.financialYearOverride.trim()) {
      return settings.financialYearOverride.trim();
    }
    return getFinancialYear(invoiceDate);
  }, [invoiceDate, settings.financialYearOverride]);

  // Compute Provisional Invoice Number preview
  const provisionalInvoiceNumber = useMemo(() => {
    return storageService.getNextInvoiceNumberPreview(
      financialYear,
      settings.invoicePrefix,
      settings.openingInvoiceSequences?.[financialYear],
      invoices
    );
  }, [financialYear, settings.invoicePrefix, settings.openingInvoiceSequences, invoices]);

  // Live Calculations Engine
  const calculations = useMemo(() => {
    return calculateInvoiceFinancials(dcs, settings.defaultCgstRate, settings.defaultSgstRate);
  }, [dcs, settings.defaultCgstRate, settings.defaultSgstRate]);

  // Validation Checks
  const currentParty = parties.find((p) => p.id === selectedPartyId);
  const validation = useMemo(() => {
    return validateInvoiceForFinalization({
      partyId: selectedPartyId,
      party: currentParty,
      invoiceDate,
      dcs,
    });
  }, [selectedPartyId, currentParty, invoiceDate, dcs]);

  // Cloud sync debounce & pending state refs
  const cloudSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDraftRef = useRef<BillDraft | null>(null);
  const hasPendingCloudSyncRef = useRef<boolean>(false);
  const lastSyncedHashRef = useRef<string>(
    JSON.stringify({ id: draftId, partyId: selectedPartyId, invoiceDate, dcs })
  );

  // Flush pending draft changes to cloud immediately
  const flushCloudSync = useCallback(async () => {
    if (cloudSyncTimeoutRef.current) {
      clearTimeout(cloudSyncTimeoutRef.current);
      cloudSyncTimeoutRef.current = null;
    }

    if (!hasPendingCloudSyncRef.current && !pendingDraftRef.current) {
      return;
    }

    const toSync: BillDraft = pendingDraftRef.current || {
      id: draftId,
      partyId: selectedPartyId,
      invoiceDate,
      dcs,
      calculations,
      updatedAt: new Date().toISOString(),
    };

    // Immediate local persistence guarantee
    storageService.saveDraft(toSync);
    setDrafts(storageService.getDrafts());
    hasPendingCloudSyncRef.current = false;

    setAutosaveStatus('saving');
    try {
      const success = await syncService.pushDraft(toSync);
      if (success) {
        lastSyncedHashRef.current = JSON.stringify({
          id: toSync.id,
          partyId: toSync.partyId,
          invoiceDate: toSync.invoiceDate,
          dcs: toSync.dcs,
        });
        setLastSavedTime(
          new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        );
      }
    } catch (err) {
      console.error('Failed to flush cloud sync', err);
    } finally {
      setAutosaveStatus('saved');
    }
  }, [draftId, selectedPartyId, invoiceDate, dcs, calculations]);

  // Initialize Cloud Sync Service & Subscription
  useEffect(() => {
    syncService.startSync(2000);
    const unsubscribe = syncService.subscribe((state, status) => {
      setSyncStatus(status);
      if (state.settings) {
        setSettings((prev) => (JSON.stringify(prev) === JSON.stringify(state.settings) ? prev : state.settings!));
      }
      if (state.parties && state.parties.length > 0) {
        setParties((prev) => (JSON.stringify(prev) === JSON.stringify(state.parties) ? prev : state.parties!));
      }
      if (state.rateMemory) {
        setRateMemory((prev) => (JSON.stringify(prev) === JSON.stringify(state.rateMemory) ? prev : state.rateMemory!));
      }
      if (state.invoices) {
        setInvoices((prev) => (JSON.stringify(prev) === JSON.stringify(state.invoices) ? prev : state.invoices!));
      }
      if (state.drafts) {
        setDrafts(state.drafts);
      }
    });

    return () => {
      unsubscribe();
      syncService.stopSync();
    };
  }, []);

  // Immediate Local Persistence & 10-Second Debounced Cloud Sync (Per Draft)
  useEffect(() => {
    if (!selectedPartyId && dcs.length === 0) return;

    const currentHash = JSON.stringify({ id: draftId, partyId: selectedPartyId, invoiceDate, dcs });
    if (currentHash === lastSyncedHashRef.current) {
      setAutosaveStatus('saved');
      return;
    }

    const draftPayload: BillDraft = {
      id: draftId,
      partyId: selectedPartyId,
      invoiceDate,
      dcs,
      calculations,
      updatedAt: new Date().toISOString(),
    };

    // 1. Immediate Local State Persistence
    storageService.saveDraft(draftPayload);
    setDrafts(storageService.getDrafts());
    pendingDraftRef.current = draftPayload;
    hasPendingCloudSyncRef.current = true;

    // 2. Debounce Cloud Sync by ~10 seconds of inactivity
    if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);

    cloudSyncTimeoutRef.current = setTimeout(async () => {
      if (!hasPendingCloudSyncRef.current || !pendingDraftRef.current) return;
      const toSync = pendingDraftRef.current;
      hasPendingCloudSyncRef.current = false;
      setAutosaveStatus('saving');
      try {
        const success = await syncService.pushDraft(toSync);
        if (success) {
          lastSyncedHashRef.current = JSON.stringify({
            id: toSync.id,
            partyId: toSync.partyId,
            invoiceDate: toSync.invoiceDate,
            dcs: toSync.dcs,
          });
          setLastSavedTime(
            new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          );
        }
      } catch (err) {
        console.error('Debounced cloud sync failed', err);
      } finally {
        setAutosaveStatus('saved');
      }
    }, CLOUD_SYNC_DEBOUNCE_MS);

    return () => {
      if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);
    };
  }, [draftId, selectedPartyId, invoiceDate, dcs, calculations]);

  // Flush pending changes on tab hidden or browser unload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasPendingCloudSyncRef.current) {
        flushCloudSync();
      }
    };

    const handleBeforeUnload = () => {
      if (hasPendingCloudSyncRef.current && pendingDraftRef.current) {
        storageService.saveDraft(pendingDraftRef.current);
        syncService.pushDraft(pendingDraftRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [flushCloudSync]);

  // Resolve deferred invoice ID if opened directly via URL before sync/storage finalized
  useEffect(() => {
    if (pendingInvoiceIdRef.current && !viewingInvoice && invoices.length > 0) {
      const match = invoices.find((inv) => inv.id === pendingInvoiceIdRef.current);
      if (match) {
        setViewingInvoice(match);
        pendingInvoiceIdRef.current = null;
      }
    }
  }, [invoices, viewingInvoice]);

  // Synchronize state changes to URL hash and localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const invoiceId = viewingInvoice?.id || null;
    const targetHash = formatNavigationHash({ tab: activeTab, invoiceId });

    // 1. Save minimal navigation state to localStorage (no sensitive info)
    storageService.saveNavigationState({ tab: activeTab, invoiceId });

    // 2. Synchronize browser URL hash
    if (window.location.hash !== targetHash) {
      const currentParsed = parseNavigationHash(window.location.hash);
      const isInitialOrEmpty = !window.location.hash || window.location.hash === '#' || !currentParsed;
      syncBrowserUrl(targetHash, isInitialOrEmpty);
    }
  }, [activeTab, viewingInvoice]);

  // Handle browser Back / Forward history transitions
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleLocationChange = () => {
      const hash = window.location.hash;
      const parsed = parseNavigationHash(hash);
      if (!parsed) {
        if (activeTab !== 'workspace') {
          if (hasPendingCloudSyncRef.current) {
            flushCloudSync();
          }
          setActiveTab('workspace');
          setViewingInvoice(null);
        }
        return;
      }

      if (parsed.tab === 'invoices' && parsed.invoiceId) {
        const target = invoices.find((inv) => inv.id === parsed.invoiceId);
        if (target) {
          if (activeTab === 'workspace' && hasPendingCloudSyncRef.current) {
            flushCloudSync();
          }
          setViewingInvoice(target);
          setActiveTab('invoices');
          return;
        }
      }

      if (activeTab === 'workspace' && parsed.tab !== 'workspace' && hasPendingCloudSyncRef.current) {
        flushCloudSync();
      }
      setViewingInvoice(null);
      setActiveTab(parsed.tab);
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, [activeTab, invoices, flushCloudSync]);

  // Handler: Start New Clean Bill (Creates new independent draft)
  const handleStartNewBill = async () => {
    if (hasPendingCloudSyncRef.current) {
      await flushCloudSync();
    }
    if (cloudSyncTimeoutRef.current) {
      clearTimeout(cloudSyncTimeoutRef.current);
      cloudSyncTimeoutRef.current = null;
    }
    hasPendingCloudSyncRef.current = false;
    pendingDraftRef.current = null;

    const newDraftId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const initialPartyId = parties[0]?.id || '';
    const initialDate = new Date().toISOString().split('T')[0];
    const initialDc = createInitialDc(initialDate);

    const newDraft: BillDraft = {
      id: newDraftId,
      partyId: initialPartyId,
      invoiceDate: initialDate,
      dcs: [initialDc],
      calculations: calculateInvoiceFinancials([initialDc], settings.defaultCgstRate, settings.defaultSgstRate),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storageService.saveDraft(newDraft);
    storageService.setActiveDraftId(newDraftId);
    const updatedDrafts = storageService.getDrafts();
    setDrafts(updatedDrafts);

    setDraftId(newDraftId);
    setSelectedPartyId(initialPartyId);
    setInvoiceDate(initialDate);
    setDcs([initialDc]);
    setViewingInvoice(null);
    setHasAttemptedFinalize(false);
    lastSyncedHashRef.current = JSON.stringify({
      id: newDraftId,
      partyId: initialPartyId,
      invoiceDate: initialDate,
      dcs: [initialDc],
    });

    // Push new draft to cloud
    syncService.pushDraft(newDraft);
  };

  // Handler: Switch/Resume specific Draft
  const handleSelectDraft = async (targetDraftId: string) => {
    if (targetDraftId === draftId) return;

    if (hasPendingCloudSyncRef.current) {
      await flushCloudSync();
    }
    if (cloudSyncTimeoutRef.current) {
      clearTimeout(cloudSyncTimeoutRef.current);
      cloudSyncTimeoutRef.current = null;
    }
    hasPendingCloudSyncRef.current = false;
    pendingDraftRef.current = null;

    const target = storageService.getDraft(targetDraftId);
    if (!target) return;

    storageService.setActiveDraftId(target.id);
    setDraftId(target.id);
    setSelectedPartyId(target.partyId || '');
    setInvoiceDate(target.invoiceDate || new Date().toISOString().split('T')[0]);
    setDcs(
      target.dcs && target.dcs.length > 0
        ? target.dcs
        : [createInitialDc(target.invoiceDate || new Date().toISOString().split('T')[0])]
    );
    setHasAttemptedFinalize(false);
    lastSyncedHashRef.current = JSON.stringify({
      id: target.id,
      partyId: target.partyId || '',
      invoiceDate: target.invoiceDate || '',
      dcs: target.dcs || [],
    });
    setDrafts(storageService.getDrafts());
  };

  // Handler: Delete/Discard specific Draft
  const handleDeleteDraft = async (draftIdToDelete: string) => {
    if (cloudSyncTimeoutRef.current) {
      clearTimeout(cloudSyncTimeoutRef.current);
      cloudSyncTimeoutRef.current = null;
    }
    hasPendingCloudSyncRef.current = false;
    pendingDraftRef.current = null;

    await syncService.deleteDraft(draftIdToDelete);
    const remainingDrafts = storageService.getDrafts();
    setDrafts(remainingDrafts);

    if (draftIdToDelete === draftId) {
      if (remainingDrafts.length > 0) {
        await handleSelectDraft(remainingDrafts[0].id);
      } else {
        await handleStartNewBill();
      }
    }
  };

  // Handler: Discard current Draft from Summary Panel
  const handleDiscardCurrentDraft = () => {
    if (window.confirm('Are you sure you want to discard this draft bill? This cannot be undone.')) {
      handleDeleteDraft(draftId);
    }
  };

  // DC Management Handlers
  const handleAddDC = () => {
    const newDc: DCGroup = {
      id: `dc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ourDcNumber: '',
      partyDcNumber: '',
      partyDcDate: invoiceDate,
      sortOrder: dcs.length,
      workEntries: [
        {
          id: `w_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          description: '',
          rolls: 0,
          weightDisplay: '',
          weightKg: 0,
          rate: 0,
          amount: 0,
          sortOrder: 0,
        },
      ],
    };
    setDcs((prev) => [...prev, newDc]);
  };

  const handleUpdateDC = (index: number, updated: DCGroup) => {
    setDcs((prev) => {
      const copy = [...prev];
      copy[index] = updated;
      return copy;
    });
  };

  const handleRemoveDC = (index: number) => {
    setDcs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDuplicateDC = (index: number) => {
    const target = dcs[index];
    const duplicated: DCGroup = {
      ...target,
      id: `dc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sortOrder: dcs.length,
      workEntries: target.workEntries.map((w) => ({
        ...w,
        id: `w_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      })),
    };
    setDcs((prev) => {
      const copy = [...prev];
      copy.splice(index + 1, 0, duplicated);
      return copy;
    });
  };

  const switchToRemainingDraftOrNew = () => {
    const remaining = storageService.getDrafts();
    if (remaining.length > 0) {
      const nextDraft = remaining[0];
      setDraftId(nextDraft.id);
      setSelectedPartyId(nextDraft.partyId || '');
      setInvoiceDate(nextDraft.invoiceDate || new Date().toISOString().split('T')[0]);
      setDcs(
        nextDraft.dcs && nextDraft.dcs.length > 0
          ? nextDraft.dcs
          : [createInitialDc(nextDraft.invoiceDate || new Date().toISOString().split('T')[0])]
      );
      storageService.setActiveDraftId(nextDraft.id);
      lastSyncedHashRef.current = JSON.stringify({
        id: nextDraft.id,
        partyId: nextDraft.partyId || '',
        invoiceDate: nextDraft.invoiceDate || '',
        dcs: nextDraft.dcs || [],
      });
    } else {
      const initId = `draft_${Date.now()}`;
      const initDate = new Date().toISOString().split('T')[0];
      const initDc = createInitialDc(initDate);
      const initParty = parties[0]?.id || '';
      const initDraft: BillDraft = {
        id: initId,
        partyId: initParty,
        invoiceDate: initDate,
        dcs: [initDc],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      storageService.saveDraft(initDraft);
      storageService.setActiveDraftId(initId);
      setDrafts([initDraft]);
      setDraftId(initId);
      setSelectedPartyId(initParty);
      setInvoiceDate(initDate);
      setDcs([initDc]);
      lastSyncedHashRef.current = JSON.stringify({
        id: initId,
        partyId: initParty,
        invoiceDate: initDate,
        dcs: [initDc],
      });
    }
  };

  // Finalize & Lock Bill (Atomic Sequence Allocation via Shared Backend)
  const handleFinalizeBill = async () => {
    setHasAttemptedFinalize(true);
    if (!validation.isValid) {
      alert(`Please fix the following issues before finalizing:\n\n• ${validation.errors.join('\n• ')}`);
      return;
    }

    const party = parties.find((p) => p.id === selectedPartyId);
    if (!party) return;

    if (cloudSyncTimeoutRef.current) {
      clearTimeout(cloudSyncTimeoutRef.current);
      cloudSyncTimeoutRef.current = null;
    }
    hasPendingCloudSyncRef.current = false;
    pendingDraftRef.current = null;

    try {
      // 1. Try atomic finalization on shared backend (pass draftId so only this draft is removed)
      const finalized = await syncService.finalizeInvoice({
        financialYear,
        partyId: party.id,
        invoiceDate,
        dcs,
        calculations,
        draftId,
      });

      setInvoices(storageService.getInvoices());
      setRateMemory(storageService.getRateMemory());
      setDrafts(storageService.getDrafts());
      switchToRemainingDraftOrNew();
      setViewingInvoice(finalized);
    } catch (err: any) {
      console.warn('Backend finalization offline, executing local sequence allocation', err);
      // Offline fallback: allocate local sequence number
      const sequenceNumber = storageService.getNextInvoiceSequence(
        financialYear,
        settings.openingInvoiceSequences?.[financialYear],
        invoices
      );
      const invoiceNumber = `${settings.invoicePrefix}/${financialYear}/${String(sequenceNumber).padStart(3, '0')}`;

      dcs.forEach((dc) => {
        dc.workEntries.forEach((entry) => {
          if (entry.description.trim() && entry.rate > 0) {
            storageService.recordRateUsage(selectedPartyId, entry.description, entry.rate, invoiceNumber);
          }
        });
      });

      const finalizedInvoice: Invoice = {
        id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        invoiceNumber,
        financialYear,
        sequenceNumber,
        invoiceDate,
        status: 'finalized',
        partyId: party.id,
        partyNameSnapshot: party.name,
        partyAddressSnapshot: party.address,
        partyGstinSnapshot: party.gstin,
        partyPhoneSnapshot: party.phone,
        bankNameSnapshot: settings.bankName,
        branchSnapshot: settings.branch,
        accountNumberSnapshot: settings.accountNumber,
        ifscCodeSnapshot: settings.ifscCode,
        dcs,
        calculations,
        paymentStatus: 'unpaid',
        paidAmount: 0,
        outstandingAmount: calculations.totalAmount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        finalizedAt: new Date().toISOString(),
      };

      const existing = storageService.getInvoices();
      const updatedInvoices = [finalizedInvoice, ...existing];
      storageService.saveInvoices(updatedInvoices);
      setInvoices(updatedInvoices);
      setRateMemory(storageService.getRateMemory());
      storageService.deleteDraft(draftId);
      setDrafts(storageService.getDrafts());
      switchToRemainingDraftOrNew();
      setViewingInvoice(finalizedInvoice);
    }
  };

  // Internal Payment Recording
  const handleRecordPayment = async (amount: number, date: string, notes?: string) => {
    if (!viewingInvoice) return;

    const newPaidAmount = Math.round((viewingInvoice.paidAmount + amount) * 100) / 100;
    const newOutstanding = Math.max(0, Math.round((viewingInvoice.calculations.totalAmount - newPaidAmount) * 100) / 100);
    const newPaymentStatus: PaymentStatus =
      newOutstanding <= 0 ? 'paid' : newPaidAmount > 0 ? 'partially_paid' : 'unpaid';

    const updatedInvoice: Invoice = {
      ...viewingInvoice,
      paidAmount: newPaidAmount,
      outstandingAmount: newOutstanding,
      paymentStatus: newPaymentStatus,
      updatedAt: new Date().toISOString(),
    };

    const updatedList = invoices.map((inv) =>
      inv.id === viewingInvoice.id ? updatedInvoice : inv
    );

    storageService.saveInvoices(updatedList);
    setInvoices(updatedList);
    setViewingInvoice(updatedInvoice);

    // Sync to backend
    await syncService.recordPayment(viewingInvoice.id, amount, date, notes);
  };

  // Party Management Handlers
  const handleAddParty = async (partyData: Omit<Party, 'id' | 'createdAt' | 'updatedAt'>) => {
    const saved = await syncService.saveParty(partyData);
    if (saved) {
      setParties(storageService.getParties());
      setSelectedPartyId(saved.id);
    }
  };

  const handleUpdateParty = async (partyData: Party) => {
    await syncService.saveParty(partyData);
    setParties(storageService.getParties());
  };

  const handleArchiveParty = async (partyId: string) => {
    await syncService.archiveParty(partyId);
    setParties(storageService.getParties());
  };

  const handleRestoreParty = async (partyId: string) => {
    await syncService.restoreParty(partyId);
    setParties(storageService.getParties());
  };

  const handleDeleteParty = async (partyId: string) => {
    await syncService.deleteParty(partyId);
    setParties(storageService.getParties());
    setRateMemory(storageService.getRateMemory());
  };

  // Settings Handlers
  const handleSaveSettings = async (newSettings: BusinessSettings) => {
    setSettings(newSettings);
    await syncService.saveSettings(newSettings);
  };

  const handleReloadAllData = () => {
    setSettings(storageService.getSettings());
    setParties(storageService.getParties());
    setRateMemory(storageService.getRateMemory());
    setInvoices(storageService.getInvoices());
    setDrafts(storageService.getDrafts());
    syncService.pullLatest();
  };

  // Ensure there is at least one draft on first run
  useEffect(() => {
    const currentDrafts = storageService.getDrafts();
    if (currentDrafts.length === 0) {
      const initId = `draft_${Date.now()}`;
      const initDate = new Date().toISOString().split('T')[0];
      const initDc = createInitialDc(initDate);
      const initParty = parties[0]?.id || '';
      const initDraft: BillDraft = {
        id: initId,
        partyId: initParty,
        invoiceDate: initDate,
        dcs: [initDc],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      storageService.saveDraft(initDraft);
      storageService.setActiveDraftId(initId);
      setDrafts([initDraft]);
      setDraftId(initId);
      setSelectedPartyId(initParty);
      setInvoiceDate(initDate);
      setDcs([initDc]);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Global Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (activeTab === 'workspace' && tab !== 'workspace' && hasPendingCloudSyncRef.current) {
            flushCloudSync();
          }
          if (viewingInvoice && tab === 'workspace') {
            switchToRemainingDraftOrNew();
          }
          setViewingInvoice(null);
          setActiveTab(tab);
        }}
        autosaveStatus={autosaveStatus}
        lastSavedTime={lastSavedTime}
        syncStatus={syncStatus}
      />

      <main className="flex-1 pb-16">
        {/* VIEW: FINALIZED INVOICE PREVIEW & PRINT HUB */}
        {viewingInvoice ? (
          <InvoiceView
            invoice={viewingInvoice}
            settings={settings}
            onBackToWorkspace={() => {
              setViewingInvoice(null);
              switchToRemainingDraftOrNew();
            }}
            onRecordPayment={handleRecordPayment}
          />
        ) : activeTab === 'workspace' ? (
          /* VIEW: PRIMARY SUNDAY BILLING WORKSPACE */
          <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-4 sm:py-6">
            {/* Desktop Two-Panel Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT COLUMN: Active Assembly Workbench (8 Cols) */}
              <div className="lg:col-span-8 space-y-6 min-w-0">
                {/* 1. Select Party & Bill Date */}
                <PartySelector
                  parties={parties}
                  selectedPartyId={selectedPartyId}
                  onSelectParty={(id) => setSelectedPartyId(id)}
                  invoiceDate={invoiceDate}
                  onDateChange={(date) => setInvoiceDate(date)}
                  financialYear={financialYear}
                  provisionalInvoiceNumber={provisionalInvoiceNumber}
                  hasAttemptedFinalize={hasAttemptedFinalize}
                />

                {/* 2. Delivery Challan Blocks */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">
                      Delivery Challans & Work Entries
                    </h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {dcs.length} {dcs.length === 1 ? 'Challan' : 'Challans'}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {dcs.map((dc, index) => (
                      <DCBlock
                        key={dc.id}
                        dc={dc}
                        index={index}
                        selectedPartyId={selectedPartyId}
                        rateMemory={rateMemory}
                        hasAttemptedFinalize={hasAttemptedFinalize}
                        onUpdate={(updated) => handleUpdateDC(index, updated)}
                        onRemove={() => handleRemoveDC(index)}
                        onDuplicate={() => handleDuplicateDC(index)}
                      />
                    ))}
                  </div>

                  {/* Add DC Button */}
                  <button
                    type="button"
                    onClick={handleAddDC}
                    className="w-full py-3.5 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 rounded-2xl text-slate-600 hover:text-indigo-600 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Delivery Challan Block</span>
                  </button>
                </div>
              </div>

              {/* RIGHT COLUMN: Live Financial Telemetry & Action Controls (4 Cols) - Fixed Sticky */}
              <div className="lg:col-span-4 sticky top-20 self-start min-w-0">
                <SummaryPanel
                  calculations={calculations}
                  dcCount={dcs.length}
                  validationErrors={validation.errors}
                  isReadyToFinalize={validation.isValid}
                  onSaveDraft={async () => {
                    await flushCloudSync();
                    alert('Draft successfully saved! You can resume it anytime.');
                  }}
                  onFinalize={handleFinalizeBill}
                  onAttemptFinalize={() => setHasAttemptedFinalize(true)}
                  onDiscardDraft={handleDiscardCurrentDraft}
                />
              </div>
            </div>
          </div>
        ) : activeTab === 'drafts' ? (
          /* VIEW: DEDICATED DRAFTS TAB */
          <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-4 sm:py-6">
            <DraftsManager
              drafts={drafts}
              activeDraftId={draftId}
              parties={parties}
              onSelectDraft={async (id) => {
                await handleSelectDraft(id);
                setActiveTab('workspace');
              }}
              onNewDraft={async () => {
                await handleStartNewBill();
                setActiveTab('workspace');
              }}
              onDeleteDraft={handleDeleteDraft}
            />
          </div>
        ) : activeTab === 'invoices' ? (
          /* VIEW: INVOICES ARCHIVE & SEARCH */
          <InvoiceList
            invoices={invoices}
            onSelectInvoice={(id) => {
              if (hasPendingCloudSyncRef.current) {
                flushCloudSync();
              }
              const target = invoices.find((inv) => inv.id === id);
              if (target) setViewingInvoice(target);
            }}
            onNewBillClick={() => {
              handleStartNewBill();
              setActiveTab('workspace');
            }}
          />
        ) : activeTab === 'parties' ? (
          /* VIEW: PARTIES DIRECTORY */
          <PartyManager
            parties={parties}
            invoices={invoices}
            rateMemory={rateMemory}
            onAddParty={handleAddParty}
            onUpdateParty={handleUpdateParty}
            onArchiveParty={handleArchiveParty}
            onRestoreParty={handleRestoreParty}
            onDeleteParty={handleDeleteParty}
          />
        ) : (
          /* VIEW: SETTINGS & BACKUP */
          <SettingsManager
            settings={settings}
            invoices={invoices}
            onSaveSettings={handleSaveSettings}
            onReloadAllData={handleReloadAllData}
          />
        )}
      </main>
    </div>
  );
}
export default App;
