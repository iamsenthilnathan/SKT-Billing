import React, { useState } from 'react';
import { Trash2, Copy, Sparkles, Scale, Layers, IndianRupee } from 'lucide-react';
import type { WorkEntry, RateMemoryItem } from '../../domain/types';
import { parseTextileWeight } from '../../domain/weightParser';
import { calculateLineAmount } from '../../domain/calculations';

interface WorkEntryRowProps {
  entry: WorkEntry;
  index: number;
  rateSuggestion?: RateMemoryItem;
  onUpdate: (updated: WorkEntry) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  hasAttemptedFinalize?: boolean;
}

export const WorkEntryRow: React.FC<WorkEntryRowProps> = ({
  entry,
  index,
  rateSuggestion,
  onUpdate,
  onRemove,
  onDuplicate,
  hasAttemptedFinalize = false,
}) => {
  const handleDescriptionChange = (desc: string) => {
    onUpdate({
      ...entry,
      description: desc,
    });
  };

  const handleRollsChange = (val: string) => {
    const rolls = parseInt(val, 10) || 0;
    onUpdate({
      ...entry,
      rolls,
    });
  };

  const handleWeightChange = (raw: string) => {
    const parsed = parseTextileWeight(raw);
    const amount = calculateLineAmount(parsed.kg, entry.rate);
    onUpdate({
      ...entry,
      weightDisplay: raw,
      weightKg: parsed.kg,
      amount,
    });
  };

  const handleRateChange = (rateStr: string) => {
    const rate = parseFloat(rateStr) || 0;
    const amount = calculateLineAmount(entry.weightKg, rate);
    onUpdate({
      ...entry,
      rate,
      amount,
    });
  };

  const applyRateSuggestion = (sugRate: number) => {
    const amount = calculateLineAmount(entry.weightKg, sugRate);
    onUpdate({
      ...entry,
      rate: sugRate,
      amount,
    });
  };

  const [touched, setTouched] = useState<{
    description: boolean;
    weight: boolean;
    rate: boolean;
  }>({
    description: false,
    weight: false,
    rate: false,
  });

  const isDescriptionMissing = !entry.description || entry.description.trim() === '';
  const isWeightInvalid = entry.weightKg <= 0;
  const isRateInvalid = entry.rate <= 0;

  const showDescriptionError = (touched.description || hasAttemptedFinalize) && isDescriptionMissing;
  const showWeightError = (touched.weight || hasAttemptedFinalize) && isWeightInvalid;
  const showRateError = (touched.rate || hasAttemptedFinalize) && isRateInvalid;

  return (
    <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all space-y-3">
      {/* Top Header of Entry */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Process #{index + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDuplicate}
            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 transition-colors"
            title="Duplicate this entry"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
            title="Remove entry"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Description input */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Description / Color / Process Notes:
        </label>
        <input
          type="text"
          value={entry.description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          onBlur={() => setTouched((prev) => ({ ...prev, description: true }))}
          placeholder="e.g. Navy Blue Dyeing, Bio Wash & Stenter, Heat Setting..."
          className={`w-full text-sm font-medium px-3 py-2 rounded-lg transition-all outline-hidden text-slate-900 ${
            showDescriptionError
              ? 'bg-rose-50/20 border border-rose-300 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
              : 'bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
          }`}
        />
        {showDescriptionError && (
          <p className="text-[11px] text-rose-600 font-medium mt-1">
            Description is required
          </p>
        )}

        {/* Rate suggestion pill */}
        {rateSuggestion && rateSuggestion.suggestedRate !== entry.rate && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span>Last rate: ₹{rateSuggestion.suggestedRate.toFixed(2)}/kg ({rateSuggestion.lastUsedDate})</span>
            </span>
            <button
              type="button"
              onClick={() => applyRateSuggestion(rateSuggestion.suggestedRate)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline"
            >
              Use ₹{rateSuggestion.suggestedRate.toFixed(2)}
            </button>
          </div>
        )}
      </div>

      {/* Numerical Metrics Grid: Rolls, Weight, Rate, Amount */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-1">
        {/* Rolls */}
        <div>
          <label className="text-xs font-medium text-slate-600 flex items-center gap-1 mb-1">
            <Layers className="w-3 h-3 text-slate-400" />
            <span>Rolls</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={entry.rolls === 0 ? '' : entry.rolls}
            onChange={(e) => handleRollsChange(e.target.value)}
            placeholder="0"
            className="w-full text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-hidden text-slate-900"
          />
        </div>

        {/* Weight */}
        <div>
          <label className="text-xs font-medium text-slate-600 flex items-center gap-1 mb-1">
            <Scale className="w-3 h-3 text-slate-400" />
            <span>Weight</span>
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={entry.weightDisplay}
            onChange={(e) => handleWeightChange(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, weight: true }))}
            placeholder="e.g. 650.400"
            className={`w-full text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1.5 rounded-lg font-mono transition-all outline-hidden text-slate-900 ${
              showWeightError
                ? 'bg-rose-50/20 border border-rose-300 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                : 'bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
            }`}
          />
          {showWeightError ? (
            <p className="text-[11px] text-rose-600 font-medium mt-1">
              Weight must be greater than 0
            </p>
          ) : (
            entry.weightKg > 0 && Boolean(entry.weightDisplay && entry.weightDisplay.toLowerCase().includes('gm')) && (
              <span className="text-[10px] text-slate-500 font-mono">(= {entry.weightKg} kg)</span>
            )
          )}
        </div>

        {/* Rate */}
        <div>
          <label className="text-xs font-medium text-slate-600 flex items-center gap-1 mb-1">
            <IndianRupee className="w-3 h-3 text-slate-400" />
            <span>Rate (₹/kg)</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={entry.rate === 0 ? '' : entry.rate}
            onChange={(e) => handleRateChange(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, rate: true }))}
            placeholder="0.00"
            className={`w-full text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1.5 rounded-lg transition-all outline-hidden text-slate-900 ${
              showRateError
                ? 'bg-rose-50/20 border border-rose-300 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                : 'bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
            }`}
          />
          {showRateError && (
            <p className="text-[11px] text-rose-600 font-medium mt-1">
              Rate must be greater than 0
            </p>
          )}
        </div>

        {/* Computed Amount */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">
            Amount (₹)
          </label>
          <div className="w-full h-8.5 px-2 sm:px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-end font-semibold text-slate-900 text-xs sm:text-sm font-mono truncate">
            ₹{entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
};
