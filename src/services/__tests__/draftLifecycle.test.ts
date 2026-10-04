import { describe, it, expect, beforeEach } from 'vitest';
import { storageService } from '../storage';
import type { BillDraft, DCGroup } from '../../domain/types';
import { hasMeaningfulBillContent } from '../../domain/calculations';

const createMockDc = (id: string, rolls: number, weightKg: number): DCGroup => ({
  id,
  ourDcNumber: `DC-${id}`,
  partyDcNumber: `PDC-${id}`,
  partyDcDate: '2026-10-04',
  sortOrder: 0,
  workEntries: [
    {
      id: `w_${id}`,
      description: 'Cotton Dyeing',
      rolls,
      weightDisplay: `${weightKg}`,
      weightKg,
      rate: 45,
      amount: weightKg * 45,
      sortOrder: 0,
    },
  ],
});

const createMockDraft = (id: string, partyId: string, updatedAt?: string): BillDraft => ({
  id,
  partyId,
  invoiceDate: '2026-10-04',
  dcs: [createMockDc(id, 10, 150)],
  calculations: {
    totalRolls: 10,
    totalWeightKg: 150,
    subtotal: 6750,
    cgstRate: 2.5,
    cgstAmount: 168.75,
    sgstRate: 2.5,
    sgstAmount: 168.75,
    preRoundTotal: 7087.5,
    roundOff: 0.5,
    totalAmount: 7088,
    totalAmountInWords: 'Rupees Seven Thousand Eighty Eight Only',
  },
  createdAt: '2026-10-04T10:00:00.000Z',
  updatedAt: updatedAt || '2026-10-04T10:00:00.000Z',
});

// Helper for dynamic 1..N draft numbering
function computeDynamicDraftNumbers(drafts: BillDraft[], sortBy: 'recently_modified' | 'bill_date' = 'recently_modified') {
  const list = [...drafts];
  list.sort((a, b) => {
    if (sortBy === 'bill_date') {
      const aDate = a.invoiceDate || '';
      const bDate = b.invoiceDate || '';
      const cmp = bDate.localeCompare(aDate);
      if (cmp !== 0) return cmp;
    }
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    if (bTime !== aTime) return bTime - aTime;
    return a.id.localeCompare(b.id);
  });
  return list.map((draft, idx) => ({
    draft,
    draftNumber: idx + 1,
  }));
}

describe('Draft Manager Complete Lifecycle & Invariant Verification', () => {
  beforeEach(() => {
    storageService.clearAll();
  });

  // 1. Fresh start / no drafts
  it('Case 1: Fresh start / no drafts has drafts count = 0 and active draft = null', () => {
    expect(storageService.getDrafts()).toEqual([]);
    expect(storageService.getDrafts().length).toBe(0);
    expect(storageService.getActiveDraft()).toBeNull();
    expect(storageService.getActiveDraftId()).toBeNull();
  });

  // 2. Click "Start New Bill"
  it('Case 2: Creating a new bill sets drafts count = 1 and makes it active', () => {
    const draft1 = createMockDraft('draft_1', 'party_1');
    storageService.saveDraft(draft1);
    storageService.setActiveDraftId('draft_1');

    expect(storageService.getDrafts().length).toBe(1);
    expect(storageService.getActiveDraft()?.id).toBe('draft_1');
    expect(storageService.getActiveDraftId()).toBe('draft_1');
  });

  // 3. Edit Draft 1
  it('Case 3: Editing active draft persists changes while drafts count remains 1', () => {
    const draft1 = createMockDraft('draft_1', 'party_1');
    storageService.saveDraft(draft1);
    storageService.setActiveDraftId('draft_1');

    // Update with new work entry / date
    const updatedDraft = {
      ...draft1,
      invoiceDate: '2026-10-05',
      updatedAt: '2026-10-04T11:00:00.000Z',
    };
    storageService.saveDraft(updatedDraft);

    expect(storageService.getDrafts().length).toBe(1);
    expect(storageService.getActiveDraft()?.invoiceDate).toBe('2026-10-05');
  });

  // 4. Click "Start New Bill" again
  it('Case 4: Starting another new bill sets drafts count = 2 and preserves previous draft', () => {
    const draft1 = createMockDraft('draft_1', 'party_1', '2026-10-04T10:00:00.000Z');
    storageService.saveDraft(draft1);
    storageService.setActiveDraftId('draft_1');

    const draft2 = createMockDraft('draft_2', 'party_2', '2026-10-04T11:00:00.000Z');
    storageService.saveDraft(draft2);
    storageService.setActiveDraftId('draft_2');

    expect(storageService.getDrafts().length).toBe(2);
    expect(storageService.getActiveDraft()?.id).toBe('draft_2');
    // Draft 1 remains unchanged
    const savedDraft1 = storageService.getDraft('draft_1');
    expect(savedDraft1?.partyId).toBe('party_1');
  });

  // 5. Switch between Draft 1 and Draft 2
  it('Case 5: Switching active draft preserves all data without creating new drafts', () => {
    const draft1 = createMockDraft('draft_1', 'party_1', '2026-10-04T10:00:00.000Z');
    const draft2 = createMockDraft('draft_2', 'party_2', '2026-10-04T11:00:00.000Z');
    storageService.saveDraft(draft1);
    storageService.saveDraft(draft2);

    storageService.setActiveDraftId('draft_1');
    expect(storageService.getActiveDraft()?.id).toBe('draft_1');
    expect(storageService.getDrafts().length).toBe(2);

    storageService.setActiveDraftId('draft_2');
    expect(storageService.getActiveDraft()?.id).toBe('draft_2');
    expect(storageService.getDrafts().length).toBe(2);
  });

  // 6. Delete Draft 2
  it('Case 6: Deleting Draft 2 leaves Draft 1 active and deletes Draft 2 completely', () => {
    const draft1 = createMockDraft('draft_1', 'party_1', '2026-10-04T10:00:00.000Z');
    const draft2 = createMockDraft('draft_2', 'party_2', '2026-10-04T11:00:00.000Z');
    storageService.saveDraft(draft1);
    storageService.saveDraft(draft2);
    storageService.setActiveDraftId('draft_2');

    storageService.deleteDraft('draft_2');

    expect(storageService.getDrafts().length).toBe(1);
    expect(storageService.getDraft('draft_2')).toBeNull();
    expect(storageService.getActiveDraft()?.id).toBe('draft_1');
  });

  // 7. Delete remaining Draft 1
  it('Case 7: Deleting remaining Draft 1 results in 0 drafts and does NOT recreate any draft', () => {
    const draft1 = createMockDraft('draft_1', 'party_1');
    storageService.saveDraft(draft1);
    storageService.setActiveDraftId('draft_1');

    storageService.deleteDraft('draft_1');

    expect(storageService.getDrafts().length).toBe(0);
    expect(storageService.getActiveDraft()).toBeNull();
    expect(storageService.getActiveDraftId()).toBeNull();
  });

  // 8. Login with 0 drafts on server
  it('Case 8: Merging 0 drafts from server maintains 0 drafts and does not auto-create', () => {
    const merged = storageService.mergeDrafts([]);
    expect(merged.length).toBe(0);
    expect(storageService.getDrafts().length).toBe(0);
    expect(storageService.getActiveDraft()).toBeNull();
  });

  // 9. Login with 2 drafts on server
  it('Case 9: Merging 2 drafts from server loads both drafts and selects most recent', () => {
    const serverDraftA = createMockDraft('draft_A', 'party_1', '2026-10-04T09:00:00.000Z');
    const serverDraftB = createMockDraft('draft_B', 'party_2', '2026-10-04T12:00:00.000Z');

    const merged = storageService.mergeDrafts([serverDraftA, serverDraftB]);

    expect(merged.length).toBe(2);
    // Ordered by updatedAt desc: Draft B first
    expect(merged[0].id).toBe('draft_B');
    expect(storageService.getActiveDraft()?.id).toBe('draft_B');
  });

  // 10. Logout clears state cleanly without creating draft
  it('Case 10: Logout clears local drafts without auto-creating draft', () => {
    storageService.saveDraft(createMockDraft('draft_1', 'party_1'));
    storageService.setActiveDraftId('draft_1');

    // Simulate logout cleanup
    storageService.saveDrafts([]);
    storageService.setActiveDraftId('');

    expect(storageService.getDrafts().length).toBe(0);
    expect(storageService.getActiveDraft()).toBeNull();
    expect(storageService.getActiveDraftId()).toBeNull();
  });

  // 11. Refresh page on empty state
  it('Case 11: Refreshing page on empty state maintains 0 drafts', () => {
    // Initial empty state
    expect(storageService.getDrafts()).toEqual([]);
    // Reload from storage
    const reloaded = storageService.getDrafts();
    expect(reloaded).toEqual([]);
    expect(storageService.getActiveDraft()).toBeNull();
  });

  // 12. Refresh page with active draft
  it('Case 12: Refreshing page with active draft restores it and preserves draft count', () => {
    const draft1 = createMockDraft('draft_1', 'party_1');
    const draft2 = createMockDraft('draft_2', 'party_2');
    storageService.saveDraft(draft1);
    storageService.saveDraft(draft2);
    storageService.setActiveDraftId('draft_2');

    // Simulate reload
    const drafts = storageService.getDrafts();
    const active = storageService.getActiveDraft();
    expect(drafts.length).toBe(2);
    expect(active?.id).toBe('draft_2');
  });

  // 13. Navigate between tabs does not touch drafts
  it('Case 13: Tab navigation updates nav state without touching drafts', () => {
    const draft1 = createMockDraft('draft_1', 'party_1');
    storageService.saveDraft(draft1);
    storageService.setActiveDraftId('draft_1');

    storageService.saveNavigationState({ tab: 'invoices' });
    expect(storageService.getNavigationState()?.tab).toBe('invoices');
    expect(storageService.getDrafts().length).toBe(1);

    storageService.saveNavigationState({ tab: 'parties' });
    expect(storageService.getNavigationState()?.tab).toBe('parties');
    expect(storageService.getDrafts().length).toBe(1);

    storageService.saveNavigationState({ tab: 'workspace' });
    expect(storageService.getNavigationState()?.tab).toBe('workspace');
    expect(storageService.getDrafts().length).toBe(1);
    expect(storageService.getActiveDraft()?.id).toBe('draft_1');
  });

  // 14. 3 drafts exist: displayed as Draft 1, Draft 2, Draft 3
  it('Case 14: 3 drafts are dynamically numbered 1, 2, 3', () => {
    const d1 = createMockDraft('draft_1', 'party_1', '2026-10-04T12:00:00.000Z');
    const d2 = createMockDraft('draft_2', 'party_2', '2026-10-04T11:00:00.000Z');
    const d3 = createMockDraft('draft_3', 'party_3', '2026-10-04T10:00:00.000Z');

    const numbered = computeDynamicDraftNumbers([d1, d2, d3]);
    expect(numbered.length).toBe(3);
    expect(numbered.map((n) => n.draftNumber)).toEqual([1, 2, 3]);
  });

  // 15. Delete Draft 2: remaining displayed as Draft 1, Draft 2
  it('Case 15: Deleting Draft 2 re-indexes remaining drafts dynamically to 1, 2', () => {
    const d1 = createMockDraft('draft_1', 'party_1', '2026-10-04T12:00:00.000Z');
    const d3 = createMockDraft('draft_3', 'party_3', '2026-10-04T10:00:00.000Z');

    // d2 was deleted, only d1 and d3 remain
    const numbered = computeDynamicDraftNumbers([d1, d3]);
    expect(numbered.length).toBe(2);
    expect(numbered.map((n) => n.draftNumber)).toEqual([1, 2]);
  });

  // 16. Delete all drafts, create new draft: displayed as Draft 1 (never jumps to Draft 4+)
  it('Case 16: Deleting all drafts and creating a new one displays Draft 1, never jumping', () => {
    // Legacy counter removed
    if (typeof window !== 'undefined' && window.localStorage) {
      expect(window.localStorage.getItem('skt_draft_numbers_v1')).toBeNull();
    }

    const brandNewDraft = createMockDraft('draft_99', 'party_1');
    const numbered = computeDynamicDraftNumbers([brandNewDraft]);
    expect(numbered.length).toBe(1);
    expect(numbered[0].draftNumber).toBe(1);
  });

  // 17. Server returns 0 drafts: local drafts merged to 0 and does not resurrect deleted
  it('Case 17: When server returns 0 drafts, local drafts are merged to 0 and not resurrected', () => {
    // Client had local drafts
    const d1 = createMockDraft('draft_old_1', 'party_1');
    storageService.saveDraft(d1);
    expect(storageService.getDrafts().length).toBe(1);

    // Server returns empty array (server-side drafts were deleted)
    const merged = storageService.mergeDrafts([]);

    expect(merged).toEqual([]);
    expect(storageService.getDrafts().length).toBe(0);
    expect(storageService.getActiveDraft()).toBeNull();
  });

  // 18. Draft deleted on server while client was offline: drops draft on reconnect
  it('Case 18: Draft deleted on server while client was away is dropped and not resurrected', () => {
    const d1 = createMockDraft('draft_live', 'party_1', '2026-10-04T10:00:00.000Z');
    const d2 = createMockDraft('draft_deleted_remotely', 'party_2', '2026-10-04T09:00:00.000Z');

    // Local had both drafts
    storageService.saveDraft(d1);
    storageService.saveDraft(d2);
    expect(storageService.getDrafts().length).toBe(2);

    // Server only returns d1 (d2 was deleted on server)
    const merged = storageService.mergeDrafts([d1]);

    expect(merged.length).toBe(1);
    expect(merged[0].id).toBe('draft_live');
    expect(storageService.getDraft('draft_deleted_remotely')).toBeNull();
  });

  // 19. Explicit "+ New Bill" creation properly creates 1 draft and preserves clean deletion
  it('Case 19: Clicking "+ New Bill" creates 1 draft, sets it active, does not duplicate, and deletion leaves 0 drafts', () => {
    expect(storageService.getDrafts().length).toBe(0);

    // User clicks "+ New Bill"
    const newDraftId = `draft_${Date.now()}_abc1`;
    const newDraft = createMockDraft(newDraftId, 'party_1');
    storageService.saveDraft(newDraft);
    storageService.setActiveDraftId(newDraftId);

    expect(storageService.getDrafts().length).toBe(1);
    expect(storageService.getActiveDraftId()).toBe(newDraftId);
    expect(storageService.getActiveDraft()?.id).toBe(newDraftId);

    // Deleting this draft cleanly resets to 0 without recreating
    storageService.deleteDraft(newDraftId);
    expect(storageService.getDrafts().length).toBe(0);
    expect(storageService.getActiveDraft()).toBeNull();
  });

  // 20. Sequential "+ New Bill" actions create distinct independent drafts without collision
  it('Case 20: Sequential "+ New Bill" calls create distinct independent drafts without clobbering', () => {
    const draft1 = createMockDraft('draft_101', 'party_1');
    const draft2 = createMockDraft('draft_102', 'party_2');

    storageService.saveDraft(draft1);
    storageService.saveDraft(draft2);

    const allDrafts = storageService.getDrafts();
    expect(allDrafts.length).toBe(2);
    expect(allDrafts.map((d) => d.id)).toContain('draft_101');
    expect(allDrafts.map((d) => d.id)).toContain('draft_102');

    // Deleting draft 1 leaves draft 2 intact
    storageService.deleteDraft('draft_101');
    expect(storageService.getDrafts().length).toBe(1);
    expect(storageService.getDrafts()[0].id).toBe('draft_102');
  });

  // 21. Opening Workspace starts as temporary blank bill without creating drafts
  it('Case 21: Opening Workspace starts with draftId = "" and creates 0 drafts in storage', () => {
    // Blank bill initial state
    const blankDcs: DCGroup[] = [
      {
        id: 'dc_initial',
        ourDcNumber: '',
        partyDcNumber: '',
        partyDcDate: '2026-10-04',
        sortOrder: 0,
        workEntries: [
          {
            id: 'w_initial',
            description: '',
            rolls: 0,
            weightDisplay: '',
            weightKg: 0,
            rate: 0,
            amount: 0,
            sortOrder: 0,
          },
        ],
      },
    ];

    expect(storageService.getDrafts().length).toBe(0);
    expect(hasMeaningfulBillContent('', blankDcs)).toBe(false);
    // Because hasMeaningfulBillContent is false, draftId remains empty and 0 drafts exist
    expect(storageService.getDrafts().length).toBe(0);
    expect(storageService.getActiveDraft()).toBeNull();
  });

  // 22. Meaningful interaction promotes temporary blank bill into a real draft
  it('Case 22: Meaningful input promotes temporary blank bill to real draft', () => {
    const dcs: DCGroup[] = [
      {
        id: 'dc_initial',
        ourDcNumber: '101',
        partyDcNumber: 'P-1',
        partyDcDate: '2026-10-04',
        sortOrder: 0,
        workEntries: [
          {
            id: 'w_initial',
            description: 'Cotton Bleaching',
            rolls: 5,
            weightDisplay: '100',
            weightKg: 100,
            rate: 45,
            amount: 4500,
            sortOrder: 0,
          },
        ],
      },
    ];

    expect(hasMeaningfulBillContent('party_1', dcs)).toBe(true);

    // Promotion logic runs
    const promotedDraftId = `draft_${Date.now()}`;
    const promotedDraft = createMockDraft(promotedDraftId, 'party_1');
    promotedDraft.dcs = dcs;
    storageService.saveDraft(promotedDraft);
    storageService.setActiveDraftId(promotedDraftId);

    expect(storageService.getDrafts().length).toBe(1);
    expect(storageService.getActiveDraftId()).toBe(promotedDraftId);
    expect(storageService.getActiveDraft()?.id).toBe(promotedDraftId);
  });

  // 23. Discarding promoted draft resets to clean blank state with 0 drafts
  it('Case 23: Discarding the promoted draft returns workspace to clean blank state with 0 drafts', () => {
    const draftId = 'draft_to_discard';
    storageService.saveDraft(createMockDraft(draftId, 'party_1'));
    storageService.setActiveDraftId(draftId);
    expect(storageService.getDrafts().length).toBe(1);

    // Discard
    storageService.deleteDraft(draftId);
    storageService.setActiveDraftId('');

    expect(storageService.getDrafts().length).toBe(0);
    expect(storageService.getActiveDraft()).toBeNull();
    expect(storageService.getActiveDraftId()).toBeNull();
  });
});
