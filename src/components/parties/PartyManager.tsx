import React, { useState } from 'react';
import {
  Plus,
  Building2,
  MapPin,
  Phone,
  Hash,
  Save,
  X,
  AlertCircle,
  Archive,
  ArchiveRestore,
  Trash2,
  CheckCircle2,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import type { Party, RateMemoryItem, Invoice } from '../../domain/types';
import { validateGstin, validateIndianMobile } from '../../domain/validation';

interface PartyManagerProps {
  parties: Party[];
  invoices?: Invoice[];
  rateMemory: RateMemoryItem[];
  onAddParty: (party: Omit<Party, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateParty: (party: Party) => void;
  onArchiveParty?: (partyId: string) => void;
  onRestoreParty?: (partyId: string) => void;
  onDeleteParty?: (partyId: string) => void;
}

export const PartyManager: React.FC<PartyManagerProps> = ({
  parties,
  invoices = [],
  rateMemory,
  onAddParty,
  onUpdateParty,
  onArchiveParty,
  onRestoreParty,
  onDeleteParty,
}) => {
  const [tabFilter, setTabFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);

  // Confirmation Modals
  const [confirmArchiveParty, setConfirmArchiveParty] = useState<Party | null>(null);
  const [confirmDeleteParty, setConfirmDeleteParty] = useState<Party | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Counts
  const activeParties = parties.filter((p) => !p.isArchived);
  const archivedParties = parties.filter((p) => Boolean(p.isArchived));

  const filteredParties =
    tabFilter === 'active'
      ? activeParties
      : tabFilter === 'archived'
      ? archivedParties
      : parties;

  const handleOpenAdd = () => {
    setName('');
    setAddress('');
    setGstin('');
    setPhone('');
    setNotes('');
    setFormError(null);
    setEditingParty(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (party: Party) => {
    setEditingParty(party);
    setName(party.name);
    setAddress(party.address);
    setGstin(party.gstin);
    setPhone(party.phone);
    setNotes(party.notes || '');
    setFormError(null);
    setShowAddModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 1. Mandatory Name and Address
    if (!name.trim()) {
      setFormError('Customer / Party Name is mandatory.');
      return;
    }
    if (!address.trim()) {
      setFormError('Customer Address is mandatory.');
      return;
    }

    // 2. Validate Indian GSTIN format (15 characters)
    const gstinCheck = validateGstin(gstin);
    if (!gstinCheck.isValid) {
      setFormError(gstinCheck.error || 'Invalid GSTIN.');
      return;
    }

    // 3. Validate Indian Mobile format (10 digits)
    const mobileCheck = validateIndianMobile(phone);
    if (!mobileCheck.isValid) {
      setFormError(mobileCheck.error || 'Invalid Indian Mobile number.');
      return;
    }

    const cleanGstin = gstin.trim().toUpperCase();
    const cleanPhone = phone.trim();

    if (editingParty) {
      onUpdateParty({
        ...editingParty,
        name: name.trim(),
        address: address.trim(),
        gstin: cleanGstin,
        phone: cleanPhone,
        notes: notes.trim() || undefined,
        updatedAt: new Date().toISOString(),
      });
    } else {
      onAddParty({
        name: name.trim(),
        address: address.trim(),
        gstin: cleanGstin,
        phone: cleanPhone,
        notes: notes.trim() || undefined,
        isArchived: false,
      });
    }

    setShowAddModal(false);
  };

  const executeArchive = (party: Party) => {
    if (onArchiveParty) {
      onArchiveParty(party.id);
    }
    setConfirmArchiveParty(null);
  };

  const executeRestore = (party: Party) => {
    if (onRestoreParty) {
      onRestoreParty(party.id);
    }
  };

  const executeDelete = async (party: Party) => {
    setActionError(null);
    try {
      if (onDeleteParty) {
        onDeleteParty(party.id);
      }
      setConfirmDeleteParty(null);
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete customer.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Customer / Party Directory</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage company profiles, GSTIN validation, and active/archived directory records
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-100 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
        <button
          type="button"
          onClick={() => setTabFilter('active')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            tabFilter === 'active'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Active</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              tabFilter === 'active' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {activeParties.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTabFilter('archived')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            tabFilter === 'archived'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Archived</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              tabFilter === 'archived' ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {archivedParties.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTabFilter('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            tabFilter === 'all'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>All Customers</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              tabFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {parties.length}
          </span>
        </button>
      </div>

      {/* Empty State */}
      {filteredParties.length === 0 && (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            {tabFilter === 'archived' ? <Archive className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            {tabFilter === 'archived' ? 'No Archived Customers' : 'No Customers Found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {tabFilter === 'archived'
              ? 'Archived customers will appear here. Archiving hides a party from new bills while preserving historical records.'
              : 'Add your first customer to get started with billing.'}
          </p>
        </div>
      )}

      {/* Parties Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredParties.map((party) => {
          const partyRates = rateMemory.filter((r) => r.partyId === party.id);
          const linkedInvoices = invoices.filter((inv) => inv.partyId === party.id);
          const isReferenced = linkedInvoices.length > 0;
          const isArchived = Boolean(party.isArchived);

          return (
            <div
              key={party.id}
              className={`bg-white rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                isArchived
                  ? 'border-amber-200/80 bg-amber-50/20 shadow-2xs'
                  : 'border-slate-200/90 shadow-2xs hover:shadow-xs'
              }`}
            >
              <div className="space-y-3">
                {/* Top Row: Icon + Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        isArchived ? 'bg-amber-100 text-amber-700' : 'bg-indigo-50 text-indigo-700'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      {isArchived ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-semibold flex items-center gap-1 border border-amber-200/80">
                          <Archive className="w-3 h-3" />
                          <span>Archived</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-semibold flex items-center gap-1 border border-emerald-200/80">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/80">
                    <FileText className="w-3 h-3 text-slate-400" />
                    <span>
                      {linkedInvoices.length} {linkedInvoices.length === 1 ? 'Bill' : 'Bills'}
                    </span>
                  </span>
                </div>

                {/* Name & Address */}
                <div>
                  <h3 className="font-bold text-sm text-slate-900 leading-snug">{party.name}</h3>
                  <div className="text-xs text-slate-600 flex items-start gap-1.5 mt-1.5 leading-relaxed">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{party.address}</span>
                  </div>
                </div>

                {/* GSTIN & Phone */}
                <div className="space-y-1.5 pt-1 text-xs">
                  <div className="text-slate-700 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-500">GSTIN: </span>
                    <span className="font-mono font-bold text-slate-800 px-2 py-0.5 rounded-md bg-slate-100">
                      {party.gstin}
                    </span>
                  </div>

                  <div className="text-slate-700 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-500">Mobile: </span>
                    <span className="font-mono font-semibold text-slate-800">{party.phone}</span>
                  </div>

                  {party.notes && (
                    <div className="text-[11px] text-slate-500 italic pt-0.5">
                      Notes: {party.notes}
                    </div>
                  )}
                </div>

                {/* Rate Memory Pills */}
                {partyRates.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Recent Process Rates:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {partyRates.map((r) => (
                        <span
                          key={r.id}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 capitalize"
                        >
                          {r.normalizedDescription}: ₹{r.suggestedRate.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(party)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 transition-colors cursor-pointer"
                >
                  Edit Details
                </button>

                <div className="flex items-center gap-1">
                  {isArchived ? (
                    <>
                      <button
                        type="button"
                        onClick={() => executeRestore(party)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Restore customer to Active status"
                      >
                        <ArchiveRestore className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                      {!isReferenced && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setConfirmDeleteParty(party);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Permanently delete unused customer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {isReferenced ? (
                        <button
                          type="button"
                          onClick={() => setConfirmArchiveParty(party)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-700 hover:bg-amber-50 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Archive customer (referenced by invoices)"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>Archive</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setConfirmDeleteParty(party);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Delete customer (never billed)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal: Archive Customer */}
      {confirmArchiveParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xl w-full max-w-md space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-slate-900">Archive Customer?</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Archive <strong className="text-slate-900">{confirmArchiveParty.name}</strong>?
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900 space-y-1.5 leading-relaxed">
              <div className="font-semibold flex items-center gap-1.5 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Historical Protection Guarantee</span>
              </div>
              <p>
                This customer is referenced by existing invoices. Archiving will hide them from new bill selection, but{' '}
                <strong>all past invoices, prints, and ledgers remain 100% intact</strong>.
              </p>
              <p className="text-[11px] text-amber-700">You can restore this customer to Active at any time.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmArchiveParty(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeArchive(confirmArchiveParty)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archive Customer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Unreferenced Customer */}
      {confirmDeleteParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xl w-full max-w-md space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-slate-900">Permanently Delete Customer?</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Delete <strong className="text-slate-900">{confirmDeleteParty.name}</strong> from directory?
                </p>
              </div>
            </div>

            {actionError ? (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5 leading-relaxed">
                <p>
                  This customer has <strong>never been referenced by any invoice</strong>. Permanent deletion will remove their record and associated process rate memory.
                </p>
                <p className="text-rose-600 font-medium text-[11px]">This action cannot be undone.</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteParty(null);
                  setActionError(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeDelete(confirmDeleteParty)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Party Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xl w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                {editingParty ? 'Edit Customer Information' : 'Add New Customer'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer / Party Name: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. ABC Fabrics Private Limited"
                  className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Complete Address: <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, Area, Tirupur - Pincode"
                  rows={2}
                  className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GSTIN (15 characters): <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="33ABCDE1234F1Z9"
                    className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 font-mono text-slate-900"
                    required
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">e.g. 33ABCDE1234F1Z9</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Number (10 digits): <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    maxLength={15}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9842111223"
                    className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 font-mono text-slate-900"
                    required
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">e.g. 9842111223</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes (Optional):
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions or preferences"
                  className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingParty ? 'Save Changes' : 'Save Customer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
