import React, { useState } from 'react';
import { Truck, Plus, Trash2, ChevronDown, ChevronUp, Copy, Calendar } from 'lucide-react';
import type { DCGroup, WorkEntry, RateMemoryItem } from '../../domain/types';
import { WorkEntryRow } from './WorkEntryRow';

interface DCBlockProps {
  dc: DCGroup;
  index: number;
  rateMemory: RateMemoryItem[];
  selectedPartyId: string;
  onUpdate: (updated: DCGroup) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  hasAttemptedFinalize?: boolean;
}

export const DCBlock: React.FC<DCBlockProps> = ({
  dc,
  index,
  rateMemory,
  selectedPartyId,
  onUpdate,
  onRemove,
  onDuplicate,
  hasAttemptedFinalize = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [dcTouched, setDcTouched] = useState(false);

  const handleOurDcChange = (val: string) => {
    onUpdate({ ...dc, ourDcNumber: val });
  };

  const handlePartyDcChange = (val: string) => {
    onUpdate({ ...dc, partyDcNumber: val });
  };

  const handleDateChange = (val: string) => {
    onUpdate({ ...dc, partyDcDate: val });
  };

  const handleAddWorkEntry = () => {
    const newEntry: WorkEntry = {
      id: `w_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      description: '',
      rolls: 0,
      weightDisplay: '',
      weightKg: 0,
      rate: 0,
      amount: 0,
      sortOrder: dc.workEntries.length,
    };
    onUpdate({
      ...dc,
      workEntries: [...dc.workEntries, newEntry],
    });
  };

  const handleUpdateWorkEntry = (entryIndex: number, updatedEntry: WorkEntry) => {
    const nextEntries = [...dc.workEntries];
    nextEntries[entryIndex] = updatedEntry;
    onUpdate({
      ...dc,
      workEntries: nextEntries,
    });
  };

  const handleRemoveWorkEntry = (entryIndex: number) => {
    const nextEntries = dc.workEntries.filter((_, i) => i !== entryIndex);
    onUpdate({
      ...dc,
      workEntries: nextEntries,
    });
  };

  const handleDuplicateWorkEntry = (entryIndex: number) => {
    const target = dc.workEntries[entryIndex];
    const duplicated: WorkEntry = {
      ...target,
      id: `w_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sortOrder: dc.workEntries.length,
    };
    const nextEntries = [...dc.workEntries];
    nextEntries.splice(entryIndex + 1, 0, duplicated);
    onUpdate({
      ...dc,
      workEntries: nextEntries,
    });
  };

  // Compute DC summary metrics
  const dcTotalRolls = dc.workEntries.reduce((sum, e) => sum + (e.rolls || 0), 0);
  const dcTotalWeight = dc.workEntries.reduce((sum, e) => sum + (e.weightKg || 0), 0);
  const dcTotalAmount = dc.workEntries.reduce((sum, e) => sum + (e.amount || 0), 0);

  const isDcMissing = !dc.ourDcNumber?.trim() && !dc.partyDcNumber?.trim();
  const showDcError = (dcTouched || hasAttemptedFinalize) && isDcMissing;

  return (
    <div className="bg-slate-100/80 rounded-2xl p-5 border border-slate-200 shadow-xs mb-6 transition-all">
      {/* DC Card Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
            #{index + 1}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-600" />
              <span>Delivery Challan Block #{index + 1}</span>
            </h3>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>{dc.workEntries.length} process entries</span>
              <span>•</span>
              <span>{dcTotalRolls} rolls</span>
              <span>•</span>
              <span>{dcTotalWeight.toFixed(3)} kg</span>
              <span>•</span>
              <span className="font-semibold text-slate-800">
                ₹{dcTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls for DC */}
        <div className="flex items-center gap-2 self-end lg:self-center">
          <button
            type="button"
            onClick={onDuplicate}
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors text-xs flex items-center gap-1 font-medium px-2.5 py-1.5 bg-white/70 border border-slate-200"
            title="Duplicate this DC"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Duplicate DC</span>
          </button>

          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-xs flex items-center gap-1 font-medium px-2.5 py-1.5 bg-white/70 border border-slate-200"
            title="Delete this DC"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete DC</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition-colors text-xs flex items-center gap-1 font-medium px-2.5 py-1.5 bg-white/70 border border-slate-200"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* DC Details Inputs: Our DC, Party DC, Date */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Our DC Number: <span className="text-slate-400 font-normal">(Text, e.g. 138/139)</span>
          </label>
          <input
            type="text"
            value={dc.ourDcNumber}
            onChange={(e) => handleOurDcChange(e.target.value)}
            onBlur={() => setDcTouched(true)}
            placeholder="e.g. 138/139"
            className={`w-full text-sm font-medium px-3 py-2 rounded-lg transition-all outline-hidden text-slate-900 font-mono ${
              showDcError
                ? 'bg-rose-50/20 border border-rose-300 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                : 'bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
            }`}
          />
          {showDcError && (
            <p className="text-[11px] text-rose-600 font-medium mt-1">
              Required (Enter Our DC or Party DC)
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Customer / Party DC No: <span className="text-slate-400 font-normal">(Customer's DC)</span>
          </label>
          <input
            type="text"
            value={dc.partyDcNumber}
            onChange={(e) => handlePartyDcChange(e.target.value)}
            onBlur={() => setDcTouched(true)}
            placeholder="e.g. 8421 or DC-A"
            className={`w-full text-sm font-medium px-3 py-2 rounded-lg transition-all outline-hidden text-slate-900 font-mono ${
              showDcError
                ? 'bg-rose-50/20 border border-rose-300 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                : 'bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
            }`}
          />
          {showDcError && (
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              Optional if Our DC is provided
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Party DC Date:
          </label>
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-300">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="date"
              value={dc.partyDcDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full text-sm font-medium bg-transparent focus:outline-none text-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Expanded Work Entries Container */}
      {isExpanded && (
        <div className="space-y-3 mt-4 pt-2">
          {dc.workEntries.length === 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 text-center font-medium">
              No work entries added yet. Please add at least one process to this DC.
            </div>
          )}
          {dc.workEntries.map((entry, entryIndex) => {
            const normalizedDesc = entry.description.trim().toLowerCase();
            const suggestion = rateMemory.find(
              (r) => r.partyId === selectedPartyId && r.normalizedDescription === normalizedDesc
            );

            return (
              <WorkEntryRow
                key={entry.id}
                entry={entry}
                index={entryIndex}
                rateSuggestion={suggestion}
                onUpdate={(updated) => handleUpdateWorkEntry(entryIndex, updated)}
                onRemove={() => handleRemoveWorkEntry(entryIndex)}
                onDuplicate={() => handleDuplicateWorkEntry(entryIndex)}
                hasAttemptedFinalize={hasAttemptedFinalize}
              />
            );
          })}

          {/* Add Work Entry Button */}
          <button
            type="button"
            onClick={handleAddWorkEntry}
            className="w-full py-2.5 px-4 rounded-xl border border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Work / Dyeing Process to this DC</span>
          </button>
        </div>
      )}
    </div>
  );
};
