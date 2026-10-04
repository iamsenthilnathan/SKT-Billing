import React, { useMemo } from 'react';
import {
  Plus,
  Layers,
  ArrowRight,
  FileCheck2,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  Eye,
  Calendar,
  FileText,
} from 'lucide-react';
import type { Invoice } from '../../domain/types';

interface HomePageProps {
  invoices: Invoice[];
  draftsCount: number;
  onNewBill: () => void;
  onSelectInvoice: (invoiceId: string) => void;
  onViewAllInvoices: () => void;
  onViewDrafts: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  invoices,
  draftsCount,
  onNewBill,
  onSelectInvoice,
  onViewAllInvoices,
  onViewDrafts,
}) => {
  // Aggregate Financial Ledger Totals (matching InvoiceList calculation)
  const ledgerSummary = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    const activeInvoices = invoices.filter((inv) => inv.status !== 'cancelled');

    activeInvoices.forEach((inv) => {
      const amt = Number(inv.calculations?.totalAmount || 0);
      const paid = Number(inv.paidAmount || 0);
      const outstanding = Number(inv.outstandingAmount ?? (amt - paid));

      totalInvoiced += amt;
      totalPaid += paid;
      totalOutstanding += outstanding;
    });

    return {
      count: activeInvoices.length,
      totalInvoiced,
      totalPaid,
      totalOutstanding,
    };
  }, [invoices]);

  // Up to 5 most recent invoices (sorted by date desc, then sequenceNumber desc)
  const recentInvoices = useMemo(() => {
    return [...invoices]
      .sort((a, b) => {
        const dateDiff = new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
        if (dateDiff !== 0) return dateDiff;
        return (b.sequenceNumber || 0) - (a.sequenceNumber || 0);
      })
      .slice(0, 5);
  }, [invoices]);

  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      {/* Header Row: Title & Top-Right Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Good afternoon
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Here’s what’s happening with Sri Krishna Textile today.
          </p>
        </div>

        {/* Top-Right Action Controls (Drafts manager style uniformity) */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          {draftsCount > 0 && (
            <button
              type="button"
              onClick={onViewDrafts}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 text-xs font-semibold border border-indigo-200 shadow-2xs transition-colors cursor-pointer"
              title="View and continue unfinished drafts"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>{`Drafts (${draftsCount})`}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onNewBill}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Bill</span>
          </button>
        </div>
      </div>

      {/* Quick Access Notification when Unfinished Drafts Exist */}
      {draftsCount > 0 && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              You have <strong className="font-semibold">{`${draftsCount} unfinished ${draftsCount === 1 ? 'draft' : 'drafts'}`}</strong> in progress.
            </span>
          </div>
          <button
            type="button"
            onClick={onViewDrafts}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Continue Drafts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary Financial Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Invoices */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Invoices</span>
            <FileCheck2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-slate-900">
            {ledgerSummary.count}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Finalized bills</div>
        </div>

        {/* Total Invoiced */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Billed</span>
            <IndianRupee className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 truncate">
            {formatCurrency(ledgerSummary.totalInvoiced)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Gross billed value</div>
        </div>

        {/* Total Received */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Received
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-600 truncate">
            {formatCurrency(ledgerSummary.totalPaid)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Payments cleared</div>
        </div>

        {/* Total Outstanding Amount */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-amber-200/80 bg-amber-50/20 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
              Outstanding Amount
            </span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-amber-700 truncate">
            {formatCurrency(ledgerSummary.totalOutstanding)}
          </div>
          <div className="text-[10px] text-amber-800/80 mt-0.5">Pending collection</div>
        </div>
      </div>

      {/* Recent Invoices Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Recent Invoices</h2>
            <p className="text-xs text-slate-500">Latest finalized billing records and customer ledger entries.</p>
          </div>
          {invoices.length > 0 && (
            <button
              type="button"
              onClick={onViewAllInvoices}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View all invoices</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recentInvoices.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-slate-200/90 shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No finalized invoices yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Invoices will appear here once you finalize your first bill.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={onNewBill}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start Your First Bill</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-3">DCs & Details</th>
                    <th className="py-3 px-4 text-right">Invoice Amount</th>
                    <th className="py-3 px-4 text-right">Outstanding Amount</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                  {recentInvoices.map((inv) => {
                    const dcs = inv.dcs || [];
                    const dcsNumbers = dcs.map((d) => d.ourDcNumber).filter(Boolean);
                    const totalRolls = inv.calculations?.totalRolls ?? 0;
                    const totalWeight = inv.calculations?.totalWeightKg ?? 0;
                    const totalAmount = inv.calculations?.totalAmount ?? 0;
                    const outstanding = inv.outstandingAmount ?? (totalAmount - (inv.paidAmount || 0));

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        onClick={() => onSelectInvoice(inv.id)}
                      >
                        {/* Invoice # */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={inv.status === 'cancelled' ? 'line-through text-slate-500' : ''}>
                              {inv.invoiceNumber || 'Draft'}
                            </span>
                            {inv.status === 'cancelled' && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                                Cancelled
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-3 whitespace-nowrap text-slate-600">
                          {new Date(inv.invoiceDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 line-clamp-1 max-w-[200px]">
                            {inv.partyNameSnapshot}
                          </div>
                          {inv.partyGstinSnapshot && (
                            <div className="font-mono text-[10px] text-slate-400">
                              {inv.partyGstinSnapshot}
                            </div>
                          )}
                        </td>

                        {/* DCs & Details */}
                        <td className="py-3.5 px-3 text-slate-500">
                          <div className="text-slate-700 font-medium">
                            {dcs.length} {dcs.length === 1 ? 'DC' : 'DCs'}
                            {dcsNumbers.length > 0 && ` (${dcsNumbers.slice(0, 2).join(', ')}${dcsNumbers.length > 2 ? '...' : ''})`}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">
                            {totalRolls} rolls • {totalWeight.toFixed(3)} kg
                          </div>
                        </td>

                        {/* Invoice Amount */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrency(totalAmount)}
                        </td>

                        {/* Outstanding Amount */}
                        <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                          {inv.status === 'cancelled' ? (
                            <span className="text-slate-400 font-normal italic text-xs">
                              Cancelled
                            </span>
                          ) : (
                            <span
                              className={`font-bold ${
                                outstanding > 0 ? 'text-amber-700' : 'text-slate-400 font-normal'
                              }`}
                            >
                              {formatCurrency(outstanding)}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          {inv.status === 'cancelled' ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                              Cancelled
                            </span>
                          ) : (
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                inv.paymentStatus === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : inv.paymentStatus === 'partially_paid'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {inv.paymentStatus ? inv.paymentStatus.replace('_', ' ') : 'unpaid'}
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectInvoice(inv.id);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-3">
              {recentInvoices.map((inv) => {
                const dcs = inv.dcs || [];
                const dcsNumbers = dcs.map((d) => d.ourDcNumber).filter(Boolean);
                const totalRolls = inv.calculations?.totalRolls ?? 0;
                const totalWeight = inv.calculations?.totalWeightKg ?? 0;
                const totalAmount = inv.calculations?.totalAmount ?? 0;
                const outstanding = inv.outstandingAmount ?? (totalAmount - (inv.paidAmount || 0));

                return (
                  <div
                    key={inv.id}
                    onClick={() => onSelectInvoice(inv.id)}
                    className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:border-slate-300 transition-all space-y-3 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-mono text-sm font-bold text-slate-900 truncate ${inv.status === 'cancelled' ? 'line-through text-slate-500' : ''}`}>
                        {inv.invoiceNumber || 'Draft'}
                      </span>
                      {inv.status === 'cancelled' ? (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                          Cancelled
                        </span>
                      ) : (
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            inv.paymentStatus === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inv.paymentStatus === 'partially_paid'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {inv.paymentStatus ? inv.paymentStatus.replace('_', ' ') : 'unpaid'}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-bold text-slate-900 line-clamp-1">
                        {inv.partyNameSnapshot}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {new Date(inv.invoiceDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg space-y-1">
                      <div className="truncate">
                        <span className="font-semibold text-slate-700">
                          {dcs.length} {dcs.length === 1 ? 'DC' : 'DCs'}:
                        </span>{' '}
                        {dcsNumbers.length > 0 ? dcsNumbers.join(', ') : 'None'}
                      </div>
                      <div className="font-mono text-slate-600">
                        {totalRolls} rolls • {totalWeight.toFixed(3)} kg
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</div>
                        <div className="font-mono text-xs font-bold text-slate-900">
                          {formatCurrency(totalAmount)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Outstanding</div>
                        <div className={`font-mono text-xs font-bold ${outstanding > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                          {inv.status === 'cancelled' ? '—' : formatCurrency(outstanding)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
