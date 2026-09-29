import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Download,
  Upload,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Plus,
} from 'lucide-react';
import type { BusinessSettings, Invoice } from '../../domain/types';
import { storageService } from '../../services/storage';
import { getFinancialYear } from '../../domain/calculations';

interface SettingsManagerProps {
  settings: BusinessSettings;
  invoices?: Invoice[];
  onSaveSettings: (settings: BusinessSettings) => void;
  onReloadAllData: () => void;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({
  settings,
  invoices,
  onSaveSettings,
  onReloadAllData,
}) => {
  const [formData, setFormData] = useState<BusinessSettings>(settings);
  const [savedToast, setSavedToast] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [newFyInput, setNewFyInput] = useState('');
  const [showAddFy, setShowAddFy] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const allInvoices = invoices && invoices.length > 0 ? invoices : storageService.getInvoices();
  const currentFY = useMemo(() => getFinancialYear(), []);

  // Collect financial years to display in the administrative sequence section
  const financialYears = useMemo(() => {
    const fws = new Set<string>();
    fws.add(currentFY);
    if (formData.financialYearOverride) {
      fws.add(formData.financialYearOverride);
    }
    if (formData.openingInvoiceSequences) {
      Object.keys(formData.openingInvoiceSequences).forEach((fy) => fws.add(fy));
    }
    allInvoices.forEach((inv) => {
      if (inv.financialYear) fws.add(inv.financialYear);
    });
    return Array.from(fws).sort().reverse();
  }, [currentFY, formData.financialYearOverride, formData.openingInvoiceSequences, allInvoices]);

  // Check if any configured opening sequence produces a duplicate conflict
  const hasAnyDuplicateError = useMemo(() => {
    for (const fy of financialYears) {
      const invoicesInFY = allInvoices.filter(
        (inv) => inv.financialYear === fy && inv.status === 'finalized' && inv.sequenceNumber
      );
      const maxFinalizedSeq =
        invoicesInFY.length > 0 ? Math.max(...invoicesInFY.map((i) => i.sequenceNumber || 0)) : 0;
      const configuredSeq = formData.openingInvoiceSequences?.[fy];
      if (
        configuredSeq !== undefined &&
        configuredSeq !== null &&
        Number(configuredSeq) > 0 &&
        maxFinalizedSeq > 0 &&
        Number(configuredSeq) <= maxFinalizedSeq
      ) {
        return true;
      }
    }
    return false;
  }, [financialYears, allInvoices, formData.openingInvoiceSequences]);

  const handleSequenceChange = (fy: string, val: string) => {
    const num = val === '' ? undefined : parseInt(val, 10);
    setFormData((prev) => {
      const updated = { ...(prev.openingInvoiceSequences || {}) };
      if (num === undefined || isNaN(num) || num <= 0) {
        delete updated[fy];
      } else {
        updated[fy] = num;
      }
      return {
        ...prev,
        openingInvoiceSequences: updated,
      };
    });
  };

  const handleAddCustomFy = () => {
    const trimmed = newFyInput.trim();
    if (!trimmed) return;
    setFormData((prev) => ({
      ...prev,
      openingInvoiceSequences: {
        ...(prev.openingInvoiceSequences || {}),
        [trimmed]: 1,
      },
    }));
    setNewFyInput('');
    setShowAddFy(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasAnyDuplicateError) {
      alert(
        'Cannot save settings: A configured next sequence number would create a duplicate invoice with an already finalized invoice. Please fix the sequence number.'
      );
      return;
    }
    onSaveSettings(formData);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  const handleExportBackup = () => {
    const json = storageService.exportFullBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `skt_billing_backup_${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = storageService.importFullBackup(content);
      if (success) {
        setImportStatus('Backup successfully restored! Refreshing data...');
        setTimeout(() => {
          setImportStatus(null);
          onReloadAllData();
        }, 1500);
      } else {
        setImportStatus('Error: The selected file is not a valid SKT backup.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-indigo-600" />
          <span>Business Settings & Configurations</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure Sri Krishna Textile details, default GST tax percentages, invoice sequence handover, bank accounts, and backups
        </p>
      </div>

      {savedToast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Business settings saved successfully! Future invoices will use these parameters.</span>
        </div>
      )}

      {importStatus && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            importStatus.startsWith('Error')
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{importStatus}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
        {/* Section 1: Business Identity */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">
            1. Business Profile & Identification
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business Name (Printed on Invoices):
              </label>
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                GSTIN:
              </label>
              <input
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                className="w-full text-xs font-mono font-semibold px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Mill / Factory Address:
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone / Mobile:
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address:
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Invoice Prefix:
              </label>
              <input
                type="text"
                value={formData.invoicePrefix}
                onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value.toUpperCase() })}
                className="w-full text-xs font-mono font-semibold px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                required
              />
            </div>

            <div className="sm:col-span-2 pt-1 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Financial Year Assignment (Administrative Override):
              </label>
              <input
                type="text"
                value={formData.financialYearOverride || ''}
                onChange={(e) => setFormData({ ...formData, financialYearOverride: e.target.value.trim() })}
                placeholder="Auto (Leave empty to derive automatically from invoice date)"
                className="w-full text-xs font-mono font-medium px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Normal billing automatically derives the financial year from the invoice date (April 1 to March 31). Leave blank for normal automatic billing. Use only for exceptional administrative or audit adjustments (e.g. &quot;2026-27&quot;).
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Opening / Next Invoice Sequence (Handover & Migration Setup) */}
        <div>
          <div className="border-b border-slate-100 pb-2 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>2. Opening / Next Invoice Sequence</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  Handover &amp; Migration Setup
                </span>
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                Initial Excel migration &amp; audit sequence configuration
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Configure the opening invoice sequence when transitioning from an existing billing system (e.g. if Excel had 001–100, set next to 101). Subsequent bills auto-increment automatically. When a new financial year begins, it automatically starts at 001 unless explicitly configured here.
            </p>
          </div>

          <div className="space-y-3">
            {financialYears.map((fy) => {
              const invoicesInFY = allInvoices.filter(
                (inv) => inv.financialYear === fy && inv.status === 'finalized' && inv.sequenceNumber
              );
              const maxFinalizedSeq =
                invoicesInFY.length > 0 ? Math.max(...invoicesInFY.map((i) => i.sequenceNumber || 0)) : 0;
              const highestInvoice = invoicesInFY.find((i) => i.sequenceNumber === maxFinalizedSeq);
              const configuredSeq = formData.openingInvoiceSequences?.[fy];
              const isConfigured = configuredSeq !== undefined && configuredSeq !== null && configuredSeq > 0;

              const effectiveNextSeq = isConfigured
                ? Math.max(Number(configuredSeq), maxFinalizedSeq + 1)
                : maxFinalizedSeq > 0
                ? maxFinalizedSeq + 1
                : 1;

              const hasDuplicateError = Boolean(
                isConfigured && maxFinalizedSeq > 0 && Number(configuredSeq) <= maxFinalizedSeq
              );

              return (
                <div
                  key={fy}
                  className={`p-4 rounded-xl border transition-all ${
                    hasDuplicateError
                      ? 'bg-rose-50/40 border-rose-300'
                      : 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">
                        Financial Year: <span className="font-mono font-extrabold text-indigo-700">{fy}</span>
                      </span>
                      {fy === currentFY && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Current Active FY
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      <span className="text-slate-400">Highest Finalized: </span>
                      <span className="font-mono font-semibold text-slate-700">
                        {maxFinalizedSeq > 0
                          ? `${highestInvoice?.invoiceNumber || `#${maxFinalizedSeq}`} (Seq #${maxFinalizedSeq})`
                          : 'None (0 finalized)'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Next / Opening Sequence Number:
                      </label>
                      <input
                        id={`opening-seq-${fy}`}
                        type="number"
                        min={maxFinalizedSeq > 0 ? maxFinalizedSeq + 1 : 1}
                        value={configuredSeq ?? ''}
                        placeholder={String(maxFinalizedSeq > 0 ? maxFinalizedSeq + 1 : 1)}
                        onChange={(e) => handleSequenceChange(fy, e.target.value)}
                        className={`w-full text-xs font-mono font-bold px-3 py-2 rounded-lg bg-white border text-slate-900 outline-hidden transition-all ${
                          hasDuplicateError
                            ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20'
                            : 'border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                        }`}
                      />
                    </div>

                    <div className="self-end sm:self-center">
                      <span className="block text-xs font-semibold text-slate-700 mb-1">
                        Preview Next Bill:
                      </span>
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono font-bold text-indigo-900 shadow-2xs">
                        <span>
                          {formData.invoicePrefix || 'SKT'}/{fy}/{String(effectiveNextSeq).padStart(3, '0')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {hasDuplicateError ? (
                    <p className="text-xs text-rose-600 font-semibold flex items-center gap-1.5 mt-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Cannot set next sequence to {configuredSeq}. Invoice{' '}
                        {highestInvoice?.invoiceNumber || `#${maxFinalizedSeq}`} is already finalized. Next sequence must be at least {maxFinalizedSeq + 1} to prevent duplicate invoice numbers.
                      </span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 mt-2">
                      {isConfigured
                        ? `Custom opening sequence configured: ${configuredSeq}. Subsequent bills will auto-increment from here.`
                        : maxFinalizedSeq > 0
                        ? `Auto-incrementing from latest finalized invoice (${maxFinalizedSeq}). Next will be ${maxFinalizedSeq + 1}.`
                        : 'Default sequence: Next finalized invoice will start at 001.'}
                    </p>
                  )}
                </div>
              );
            })}

            {/* Add Custom FY Control */}
            <div className="pt-1">
              {showAddFy ? (
                <div className="p-3 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 flex flex-col sm:flex-row items-center gap-2">
                  <span className="text-xs font-semibold text-indigo-900">
                    Configure Financial Year:
                  </span>
                  <input
                    type="text"
                    value={newFyInput}
                    onChange={(e) => setNewFyInput(e.target.value.trim())}
                    placeholder="e.g. 2027-28"
                    className="text-xs font-mono font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 w-32"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddCustomFy}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Add FY
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddFy(false)}
                      className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddFy(true)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 py-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Configure Another Financial Year</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Bank Account Details for Customer Payment */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">
            3. Bank Account Details (Printed on Customer Invoice)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bank Name:
              </label>
              <input
                type="text"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Branch:
              </label>
              <input
                type="text"
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Number:
              </label>
              <input
                type="text"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                className="w-full text-xs font-mono font-semibold px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                IFSC Code:
              </label>
              <input
                type="text"
                value={formData.ifscCode}
                onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                className="w-full text-xs font-mono font-semibold px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                required
              />
            </div>
          </div>
        </div>

        {/* Section 4: Tax Rates */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">
            4. Default GST Rates
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default CGST Rate (%):
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.defaultCgstRate}
                onChange={(e) => setFormData({ ...formData, defaultCgstRate: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default SGST Rate (%):
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.defaultSgstRate}
                onChange={(e) => setFormData({ ...formData, defaultSgstRate: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                required
              />
            </div>
          </div>
        </div>

        {hasAnyDuplicateError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Please resolve sequence conflicts before saving. Configured next sequences cannot be less than or equal to already finalized invoices.
            </span>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="submit"
            disabled={hasAnyDuplicateError}
            className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-100 transition-all ${
              hasAnyDuplicateError
                ? 'bg-slate-400 cursor-not-allowed opacity-60'
                : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>

      {/* Section 5: Backup & Data Safety */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Data Safety &amp; Business Backups</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Download complete backups of all invoices, parties, and settings to store safely on your Windows PC or USB drive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleExportBackup}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Download Full Business Backup (.JSON)</span>
          </button>

          <label className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer">
            <Upload className="w-4 h-4 text-indigo-600" />
            <span>Restore from Backup File</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
