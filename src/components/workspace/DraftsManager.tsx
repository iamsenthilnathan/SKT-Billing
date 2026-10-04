import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Clock, Calendar, FileText, CheckCircle2, Layers } from 'lucide-react';
import type { BillDraft, Party } from '../../domain/types';

export type DraftSortOption = 'recently_modified' | 'bill_date';

interface DraftsManagerProps {
  drafts: BillDraft[];
  activeDraftId: string;
  parties: Party[];
  onSelectDraft: (draftId: string) => void;
  onNewDraft: () => void;
  onDeleteDraft: (draftId: string) => void;
}

export const DraftsManager: React.FC<DraftsManagerProps> = ({
  drafts,
  activeDraftId,
  parties,
  onSelectDraft,
  onNewDraft,
  onDeleteDraft,
}) => {
  const [sortBy, setSortBy] = useState<DraftSortOption>('recently_modified');

  // Purge obsolete runaway counter from previous versions
  useEffect(() => {
    try {
      localStorage.removeItem('skt_draft_numbers_v1');
    } catch {}
  }, []);

  const getPartyName = (partyId?: string) => {
    if (!partyId) return 'No Customer Selected';
    const party = parties.find((p) => p.id === partyId);
    return party ? party.name : 'Unknown Customer';
  };

  const formatDraftTime = (isoString?: string) => {
    if (!isoString) return 'Recently';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recently';
    }
  };

  // Sort drafts deterministically and dynamically assign sequential display numbers (1..N)
  const sortedDrafts = useMemo(() => {
    const list = [...drafts];

    list.sort((a, b) => {
      if (sortBy === 'bill_date') {
        const aDate = a.invoiceDate || '';
        const bDate = b.invoiceDate || '';
        const cmp = bDate.localeCompare(aDate);
        if (cmp !== 0) return cmp;
      }

      // Default: Recently modified descending (newest first)
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return a.id.localeCompare(b.id);
    });

    return list.map((draft, idx) => ({
      draft,
      draftNumber: idx + 1,
    }));
  }, [drafts, sortBy]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-6 space-y-5">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Drafts ({drafts.length})
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Switch between concurrent drafts without losing work. Drafts never consume invoice numbers.
            </p>
          </div>
        </div>

        {/* Header Actions: Compact Sort Control & New Bill */}
        <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <label htmlFor="drafts-sort" className="font-semibold text-slate-500 whitespace-nowrap">
              Sort:
            </label>
            <select
              id="drafts-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as DraftSortOption)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-hidden text-slate-800 cursor-pointer"
            >
              <option value="recently_modified">Recently Modified</option>
              <option value="bill_date">Bill Date</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onNewDraft}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Bill</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {drafts.length === 0 ? (
        <div className="py-12 text-center text-slate-500 space-y-3">
          <Layers className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-800">No drafts yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Click "+ New Bill" above to create an independent billing draft.
          </p>
        </div>
      ) : (
        /* Drafts Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedDrafts.map(({ draft, draftNumber }) => {
            const isActive = draft.id === activeDraftId;
            const totalRolls =
              draft.calculations?.totalRolls ??
              draft.dcs.reduce(
                (acc, dc) => acc + (dc.workEntries || []).reduce((sum, w) => sum + (Number(w.rolls) || 0), 0),
                0
              );
            const totalWeight =
              draft.calculations?.totalWeightKg ??
              draft.dcs.reduce(
                (acc, dc) => acc + (dc.workEntries || []).reduce((sum, w) => sum + (Number(w.weightKg) || 0), 0),
                0
              );
            const totalAmount = draft.calculations?.totalAmount ?? 0;
            const dcsList = draft.dcs.map((d) => d.ourDcNumber).filter(Boolean);

            return (
              <div
                key={draft.id}
                className={`relative rounded-xl p-4 border transition-all text-left flex flex-col justify-between gap-3.5 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
                }`}
                onClick={() => onSelectDraft(draft.id)}
              >
                <div className="space-y-2">
                  {/* Top Row: Draft label + Active Badge + Date */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-slate-700 truncate">
                        Draft {draftNumber}
                      </span>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white uppercase tracking-wider shrink-0">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Active
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 shrink-0">
                      <Calendar className="w-3 h-3" />
                      {draft.invoiceDate || 'No date'}
                    </span>
                  </div>

                  {/* Customer Name */}
                  <div className="text-sm font-bold text-slate-900 line-clamp-1">
                    {getPartyName(draft.partyId)}
                  </div>

                  {/* Details Summary */}
                  <div className="text-xs text-slate-500 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {draft.dcs.length} {draft.dcs.length === 1 ? 'DC' : 'DCs'}
                        {dcsList.length > 0 && ` (${dcsList.join(', ')})`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs text-slate-600">
                      <span>{totalRolls} rolls</span>
                      <span>•</span>
                      <span>{totalWeight.toFixed(3)} kg</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Amount + Actions */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Est. Total
                    </div>
                    <div className="text-sm font-bold font-mono text-slate-900">
                      ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (window.confirm('Are you sure you want to discard this draft? This cannot be undone.')) {
                          onDeleteDraft(draft.id);
                        }
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      title="Discard Draft"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 pointer-events-none" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDraft(draft.id);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      Resume
                    </button>
                  </div>
                </div>

                {/* Last Updated Timestamp */}
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  <span>Updated at {formatDraftTime(draft.updatedAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
