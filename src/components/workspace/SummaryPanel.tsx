import React, { useState } from 'react';
import {
  Calculator,
  ArrowRight,
  Layers,
  Scale,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type { InvoiceCalculations } from '../../domain/types';

interface SummaryPanelProps {
  calculations: InvoiceCalculations;
  dcCount: number;
  validationErrors?: string[];
  isReadyToFinalize: boolean;
  onSaveDraft?: () => void;
  onFinalize: () => void;
  onAttemptFinalize?: () => void;
  onDiscardDraft: () => void;
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({
  calculations,
  dcCount,
  isReadyToFinalize,
  onSaveDraft: _onSaveDraft,
  onFinalize,
  onAttemptFinalize,
  onDiscardDraft,
}) => {
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  return (
    <>
      {/* DESKTOP PANEL (Sticky Right Column) */}
      <div className="hidden lg:flex flex-col bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm max-h-[calc(100vh-6rem)] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <Calculator className="w-5 h-5 text-indigo-600" />
            <span>Billing Telemetry</span>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-700">
            {dcCount} {dcCount === 1 ? 'DC' : 'DCs'}
          </span>
        </div>

        {/* Quantities summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Total Rolls</span>
            </div>
            <div className="text-lg font-bold text-slate-900 mt-1">
              {calculations.totalRolls} <span className="text-xs font-normal text-slate-500">rolls</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-slate-400" />
              <span>Total Weight</span>
            </div>
            <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
              {calculations.totalWeightKg.toFixed(3)} <span className="text-xs font-normal text-slate-500">kg</span>
            </div>
          </div>
        </div>

        {/* Financial Breakdown */}
        <div className="space-y-2.5 pt-2 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span className="font-semibold text-slate-900 font-mono">
              ₹{calculations.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-between text-slate-600 text-xs">
            <span>CGST ({calculations.cgstRate}%):</span>
            <span className="font-medium text-slate-800 font-mono">
              ₹{calculations.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-between text-slate-600 text-xs">
            <span>SGST ({calculations.sgstRate}%):</span>
            <span className="font-medium text-slate-800 font-mono">
              ₹{calculations.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-between text-slate-600 text-xs">
            <span>Round-off:</span>
            <span className="font-medium text-slate-800 font-mono">
              {calculations.roundOff >= 0 ? `+₹${calculations.roundOff.toFixed(2)}` : `-₹${Math.abs(calculations.roundOff).toFixed(2)}`}
            </span>
          </div>

          {/* Grand Total */}
          <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
            <span className="text-base font-bold text-slate-900">Final Total:</span>
            <div className="text-right">
              <div className="text-2xl font-black text-indigo-700 tracking-tight font-mono">
                ₹{calculations.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Amount in words */}
          <div className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-900 italic leading-relaxed">
            "{calculations.totalAmountInWords}"
          </div>
        </div>

        {/* Action Controls */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={isReadyToFinalize ? onFinalize : onAttemptFinalize}
            aria-disabled={!isReadyToFinalize}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all ${
              isReadyToFinalize
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white cursor-pointer shadow-indigo-200'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            <span>Review & Finalize Bill</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {!isReadyToFinalize && (
            <p className="text-[11px] text-slate-400 text-center font-medium">
              Complete required fields to finalize
            </p>
          )}

          <button
            type="button"
            onClick={onDiscardDraft}
            className="w-full py-2.5 px-3 rounded-xl border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            Discard
          </button>
        </div>
      </div>

      {/* MOBILE FLOATING DOCK (Small screen bottom bar) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-xl p-3">
        {/* Expanded Drawer on Mobile */}
        {isMobileExpanded && (
          <div className="pb-3 mb-3 border-b border-slate-100 text-xs space-y-2 max-h-60 overflow-y-auto">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold font-mono">
                ₹{calculations.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>CGST (2.5%) + SGST (2.5%):</span>
              <span className="font-mono">
                ₹{(calculations.cgstAmount + calculations.sgstAmount).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Round-off:</span>
              <span className="font-mono">{calculations.roundOff.toFixed(2)}</span>
            </div>
            <div className="p-2 rounded bg-indigo-50 text-indigo-900 italic text-[11px]">
              "{calculations.totalAmountInWords}"
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div
            className="cursor-pointer"
            onClick={() => setIsMobileExpanded(!isMobileExpanded)}
          >
            <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <span>{calculations.totalRolls} rolls</span>
              <span>•</span>
              <span className="font-mono">{calculations.totalWeightKg.toFixed(1)} kg</span>
              {isMobileExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </div>
            <div className="text-lg font-black text-indigo-700 font-mono">
              ₹{calculations.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDiscardDraft}
              className="py-2.5 px-3 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 text-xs font-medium cursor-pointer"
              title="Discard bill"
            >
              Discard
            </button>

            <button
              type="button"
              onClick={isReadyToFinalize ? onFinalize : onAttemptFinalize}
              aria-disabled={!isReadyToFinalize}
              className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md ${
                isReadyToFinalize
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>Finalize</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
