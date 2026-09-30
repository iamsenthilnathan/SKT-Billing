import React from 'react';
import { Building2, Calendar, Hash, Sparkles } from 'lucide-react';
import type { Party } from '../../domain/types';

interface PartySelectorProps {
  parties: Party[];
  selectedPartyId: string;
  onSelectParty: (partyId: string) => void;
  invoiceDate: string;
  onDateChange: (date: string) => void;
  financialYear: string;
  provisionalInvoiceNumber: string;
  hasAttemptedFinalize?: boolean;
}

export const PartySelector: React.FC<PartySelectorProps> = ({
  parties,
  selectedPartyId,
  onSelectParty,
  invoiceDate,
  onDateChange,
  financialYear,
  provisionalInvoiceNumber,
  hasAttemptedFinalize = false,
}) => {
  // Only active parties appear in the selection chips for new bills
  const activeParties = parties.filter((p) => !p.isArchived);
  const selectedParty = parties.find((p) => p.id === selectedPartyId);

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <span>Select Customer / Party</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Choose the textile company for this dyeing billing batch
          </p>
        </div>

        {/* Date and Financial Year Badge */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-500" />
            <label className="text-xs font-medium text-slate-600">Bill Date:</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="text-xs font-semibold text-slate-900 bg-transparent focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-800 font-medium">
            <Hash className="w-3.5 h-3.5 text-indigo-600" />
            <span>FY: {financialYear}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Next: {provisionalInvoiceNumber}</span>
          </div>
        </div>
      </div>

      {/* Quick Customer Chips */}
      <div className="mt-4">
        <label className="block text-xs font-medium text-slate-500 mb-2">Frequent Customers:</label>
        <div className="flex flex-wrap gap-2">
          {activeParties.map((party) => {
            const isSelected = party.id === selectedPartyId;
            return (
              <button
                key={party.id}
                type="button"
                onClick={() => onSelectParty(party.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/30'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {party.name}
              </button>
            );
          })}
        </div>
        {hasAttemptedFinalize && !selectedPartyId && (
          <p className="text-xs text-rose-600 font-medium mt-2">
            Required: Please select a customer for this bill
          </p>
        )}
      </div>

      {/* Active Selected Party Card Details */}
      {selectedParty && (
        <div className="mt-4 p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-sm text-slate-900">{selectedParty.name}</div>
              {selectedParty.isArchived && (
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-200">
                  Archived Customer
                </span>
              )}
            </div>
            <div className="text-xs text-slate-600 max-w-xl">{selectedParty.address}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
            {selectedParty.gstin && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500">GSTIN:</span>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800">
                  {selectedParty.gstin}
                </span>
              </div>
            )}
            {selectedParty.phone && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500">Mobile:</span>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800">
                  {selectedParty.phone}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
