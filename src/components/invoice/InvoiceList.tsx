import React, { useState, useMemo } from 'react';
import {
  Search,
  Eye,
  Calendar,
  Clock,
  ArrowUpDown,
  IndianRupee,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import type { Invoice } from '../../domain/types';

interface InvoiceListProps {
  invoices: Invoice[];
  onSelectInvoice: (invoiceId: string) => void;
  onResumeDraft?: (draftId: string) => void;
  onNewBillClick: () => void;
}

type SortField =
  | 'recently_modified'
  | 'invoice_date_desc'
  | 'invoice_date_asc'
  | 'invoice_number_desc'
  | 'invoice_number_asc'
  | 'customer_name_asc'
  | 'amount_desc'
  | 'amount_asc'
  | 'outstanding_desc';

type DateFilterPreset = 'all' | 'today' | 'this_week' | 'this_month' | 'this_fy' | 'custom';

export const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  onSelectInvoice,
  onNewBillClick,
}) => {
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('recently_modified');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('finalized');
  const [dateFilterPreset, setDateFilterPreset] = useState<DateFilterPreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');

  // Compute unique customers for dropdown
  const uniqueCustomers = useMemo(() => {
    const map = new Map<string, string>();
    invoices.forEach((inv) => {
      if (inv.partyNameSnapshot) {
        map.set(inv.partyNameSnapshot, inv.partyNameSnapshot);
      }
    });
    return Array.from(map.values()).sort();
  }, [invoices]);

  // Compute date ranges
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Current Week (Monday - Sunday)
    const day = now.getDay();
    const diffToMon = (day === 0 ? -6 : 1) - day;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const weekStart = mon.toISOString().split('T')[0];
    const weekEnd = sun.toISOString().split('T')[0];

    // Current Month (1st to last day)
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    // Current Indian Financial Year (April 1 to March 31)
    const currentMonth = now.getMonth(); // 0-indexed: April = 3
    const fyStartYear = currentMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyEndYear = fyStartYear + 1;
    const fyStart = `${fyStartYear}-04-01`;
    const fyEnd = `${fyEndYear}-03-31`;

    return {
      today: { start: todayStr, end: todayStr },
      this_week: { start: weekStart, end: weekEnd },
      this_month: { start: monthStart, end: monthEnd },
      this_fy: { start: fyStart, end: fyEnd },
    };
  }, []);

  // Filter & Sort Invoices
  const processedInvoices = useMemo(() => {
    // 1. Filter
    const filtered = invoices.filter((inv) => {
      // Invoice Status filter (strict separation: drafts are kept in workspace)
      if (invoiceStatusFilter !== 'all' && inv.status !== invoiceStatusFilter) {
        return false;
      }

      // Payment Status filter
      if (paymentStatusFilter !== 'all' && inv.paymentStatus !== paymentStatusFilter) {
        return false;
      }

      // Customer filter
      if (selectedCustomer !== 'all' && inv.partyNameSnapshot !== selectedCustomer) {
        return false;
      }

      // Date Range filter
      const invDate = inv.invoiceDate;
      if (dateFilterPreset === 'today') {
        if (invDate !== dateRangeBounds.today.start) return false;
      } else if (dateFilterPreset === 'this_week') {
        if (invDate < dateRangeBounds.this_week.start || invDate > dateRangeBounds.this_week.end) return false;
      } else if (dateFilterPreset === 'this_month') {
        if (invDate < dateRangeBounds.this_month.start || invDate > dateRangeBounds.this_month.end) return false;
      } else if (dateFilterPreset === 'this_fy') {
        if (invDate < dateRangeBounds.this_fy.start || invDate > dateRangeBounds.this_fy.end) return false;
      } else if (dateFilterPreset === 'custom') {
        if (customStartDate && invDate < customStartDate) return false;
        if (customEndDate && invDate > customEndDate) return false;
      }

      // Search term matching: Invoice #, Customer, DC #, Item descriptions
      const term = searchTerm.trim().toLowerCase();
      if (term) {
        const invNum = (inv.invoiceNumber || '').toLowerCase();
        const customer = (inv.partyNameSnapshot || '').toLowerCase();
        const matchesDc = (inv.dcs || []).some(
          (dc) =>
            (dc.ourDcNumber || '').toLowerCase().includes(term) ||
            (dc.partyDcNumber || '').toLowerCase().includes(term) ||
            (dc.workEntries || []).some((w) => (w.description || '').toLowerCase().includes(term))
        );
        if (!invNum.includes(term) && !customer.includes(term) && !matchesDc) {
          return false;
        }
      }

      return true;
    });

    // 2. Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recently_modified': {
          const aTime = new Date(a.updatedAt || a.finalizedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.updatedAt || b.finalizedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        }
        case 'invoice_date_desc':
          return (b.invoiceDate || '').localeCompare(a.invoiceDate || '');
        case 'invoice_date_asc':
          return (a.invoiceDate || '').localeCompare(b.invoiceDate || '');
        case 'invoice_number_desc':
          return (b.sequenceNumber || 0) - (a.sequenceNumber || 0);
        case 'invoice_number_asc':
          return (a.sequenceNumber || 0) - (b.sequenceNumber || 0);
        case 'customer_name_asc':
          return (a.partyNameSnapshot || '').localeCompare(b.partyNameSnapshot || '');
        case 'amount_desc':
          return (b.calculations?.totalAmount || 0) - (a.calculations?.totalAmount || 0);
        case 'amount_asc':
          return (a.calculations?.totalAmount || 0) - (b.calculations?.totalAmount || 0);
        case 'outstanding_desc':
          return (b.outstandingAmount || 0) - (a.outstandingAmount || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [
    invoices,
    invoiceStatusFilter,
    paymentStatusFilter,
    selectedCustomer,
    dateFilterPreset,
    customStartDate,
    customEndDate,
    dateRangeBounds,
    searchTerm,
    sortBy,
  ]);

  // Aggregate Ledger Totals
  const ledgerSummary = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    processedInvoices.forEach((inv) => {
      const amt = Number(inv.calculations?.totalAmount || 0);
      const paid = Number(inv.paidAmount || 0);
      const outstanding = Number(inv.outstandingAmount ?? (amt - paid));

      totalInvoiced += amt;
      totalPaid += paid;
      totalOutstanding += outstanding;
    });

    return {
      count: processedInvoices.length,
      totalInvoiced,
      totalPaid,
      totalOutstanding,
    };
  }, [processedInvoices]);

  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5">
      {/* Page Title & Top CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Invoice Archive & Ledger</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete repository of finalized business bills, payment records, and customer ledger balances.
          </p>
        </div>

        <button
          type="button"
          onClick={onNewBillClick}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs shadow-xs transition-colors self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Bill</span>
        </button>
      </div>

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
          <div className="text-[10px] text-slate-400 mt-0.5">Matching current filters</div>
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

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        {/* Row 1: Search + Sort Dropdown */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search box (7 cols) */}
          <div className="md:col-span-7 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by invoice #, customer name, DC #, or item description..."
              className="w-full text-xs font-medium pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-hidden text-slate-900"
            />
          </div>

          {/* Sort Dropdown (5 cols) */}
          <div className="md:col-span-5 flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort:</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-hidden text-slate-800"
            >
              <option value="recently_modified">Recently Modified (Default)</option>
              <option value="invoice_date_desc">Invoice Date (Newest first)</option>
              <option value="invoice_date_asc">Invoice Date (Oldest first)</option>
              <option value="invoice_number_desc">Invoice Number (Highest first)</option>
              <option value="invoice_number_asc">Invoice Number (Lowest first)</option>
              <option value="customer_name_asc">Customer Name (A to Z)</option>
              <option value="amount_desc">Invoice Amount (Highest first)</option>
              <option value="amount_asc">Invoice Amount (Lowest first)</option>
              <option value="outstanding_desc">Outstanding Amount (Highest first)</option>
            </select>
          </div>
        </div>

        {/* Row 2: Filters (Payment Status, Invoice Status, Date Preset, Customer) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          {/* Payment Status Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Payment Status
            </label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="w-full text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white text-slate-800 outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="unpaid">Unpaid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid in Full</option>
            </select>
          </div>

          {/* Invoice Status Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Invoice Status
            </label>
            <select
              value={invoiceStatusFilter}
              onChange={(e) => setInvoiceStatusFilter(e.target.value)}
              className="w-full text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white text-slate-800 outline-hidden"
            >
              <option value="finalized">Finalized (Default)</option>
              <option value="all">All Invoices</option>
            </select>
          </div>

          {/* Date Range Preset Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Date Period
            </label>
            <select
              value={dateFilterPreset}
              onChange={(e) => setDateFilterPreset(e.target.value as DateFilterPreset)}
              className="w-full text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white text-slate-800 outline-hidden"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="this_fy">This Financial Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Customer Dropdown */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Customer
            </label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white text-slate-800 outline-hidden truncate"
            >
              <option value="all">All Customers</option>
              {uniqueCustomers.map((cust) => (
                <option key={cust} value={cust}>
                  {cust}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Optional Custom Date Range Inputs */}
        {dateFilterPreset === 'custom' && (
          <div className="pt-2 flex flex-wrap items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Range:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 outline-hidden"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 outline-hidden"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                type="button"
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-xs text-slate-500 hover:text-slate-800 underline ml-auto"
              >
                Clear Range
              </button>
            )}
          </div>
        )}
      </div>

      {/* Invoices List Display */}
      {processedInvoices.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/90 shadow-2xs space-y-3">
          <Clock className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-800">No invoices match your search or filter</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try resetting filters, or create a new invoice for this billing session.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setPaymentStatusFilter('all');
                setInvoiceStatusFilter('finalized');
                setDateFilterPreset('all');
                setSelectedCustomer('all');
                setSortBy('recently_modified');
              }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 underline"
            >
              Reset All Filters
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE VIEW (Visible on md and up) */}
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
                {processedInvoices.map((inv) => {
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
                        {inv.invoiceNumber || 'Draft'}
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
                        <span
                          className={`font-bold ${
                            outstanding > 0 ? 'text-amber-700' : 'text-slate-400 font-normal'
                          }`}
                        >
                          {formatCurrency(outstanding)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
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
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectInvoice(inv.id);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>View & Print</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS VIEW (Visible below md, fully responsive at 390px) */}
          <div className="md:hidden space-y-3">
            {processedInvoices.map((inv) => {
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
                  {/* Top Bar: Invoice # + Date + Payment Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-sm font-bold text-slate-900 truncate">
                        {inv.invoiceNumber || 'Draft'}
                      </span>
                    </div>

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
                  </div>

                  {/* Customer + Date */}
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

                  {/* DCs & Production info */}
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

                  {/* Financial Amounts & Action Button */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Invoice Amount
                      </div>
                      <div className="text-sm font-bold font-mono text-slate-900">
                        {formatCurrency(totalAmount)}
                      </div>
                      {outstanding > 0 && (
                        <div className="text-[11px] font-mono text-amber-700 font-semibold mt-0.5">
                          Outstanding: {formatCurrency(outstanding)}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectInvoice(inv.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold shadow-2xs transition-colors shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>View & Print</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
