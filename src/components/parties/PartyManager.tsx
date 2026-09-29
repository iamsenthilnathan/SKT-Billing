import React, { useState } from 'react';
import { Plus, Building2, MapPin, Phone, Hash, Save, X, AlertCircle } from 'lucide-react';
import type { Party, RateMemoryItem } from '../../domain/types';
import { validateGstin, validateIndianMobile } from '../../domain/validation';

interface PartyManagerProps {
  parties: Party[];
  rateMemory: RateMemoryItem[];
  onAddParty: (party: Omit<Party, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateParty: (party: Party) => void;
}

export const PartyManager: React.FC<PartyManagerProps> = ({
  parties,
  rateMemory,
  onAddParty,
  onUpdateParty,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

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
      });
    }

    setShowAddModal(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Customer / Party Directory</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage company profiles with verified GSTIN and mobile contact records
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

      {/* Parties Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {parties.map((party) => {
          const partyRates = rateMemory.filter((r) => r.partyId === party.id);

          return (
            <div
              key={party.id}
              className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(party)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    Edit
                  </button>
                </div>

                <div>
                  <h3 className="font-bold text-sm text-slate-900 leading-snug">{party.name}</h3>
                  <div className="text-xs text-slate-600 flex items-start gap-1.5 mt-1.5 leading-relaxed">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{party.address}</span>
                  </div>
                </div>

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
            </div>
          );
        })}
      </div>

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
