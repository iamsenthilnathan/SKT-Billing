import React, { useState } from 'react';
import { Printer, ArrowLeft, CreditCard, CheckCircle, FileText, Check } from 'lucide-react';
import type { Invoice, BusinessSettings } from '../../domain/types';

interface InvoiceViewProps {
  invoice: Invoice;
  settings: BusinessSettings;
  onBackToWorkspace: () => void;
  onRecordPayment?: (amount: number, date: string, notes?: string) => void;
}

export const InvoiceView: React.FC<InvoiceViewProps> = ({
  invoice,
  settings,
  onBackToWorkspace,
  onRecordPayment,
}) => {
  const [activeView, setActiveView] = useState<'invoice' | 'payment'>('invoice');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentRecordedToast, setPaymentRecordedToast] = useState(false);
  const [printCopiesCount, setPrintCopiesCount] = useState<number>(1);

  // Trigger browser print with exact number of identical copies (no copy-type labels!)
  const handlePrint = (copies: number) => {
    setPrintCopiesCount(copies);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0 || !onRecordPayment) return;

    onRecordPayment(amt, paymentDate, paymentNotes);
    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentRecordedToast(true);
    setTimeout(() => setPaymentRecordedToast(false), 3000);
  };

  // Helper to format ISO date to DD-MM-YYYY
  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '';
    try {
      const parts = dStr.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dStr;
    } catch {
      return dStr;
    }
  };

  // Flatten work entries for invoice table rendering.
  // Rule 4: Inherited Party DC Date repeats on every row under the DC.
  const allRows: Array<{
    sNo: number;
    ourDc: string;
    partyDc: string;
    partyDcDate: string;
    description: string;
    rolls: number;
    weightDisplay: string;
    rate: number;
    amount: number;
  }> = [];

  let counter = 1;
  invoice.dcs.forEach((dc) => {
    const inheritedDate = formatDisplayDate(dc.partyDcDate);
    dc.workEntries.forEach((entry, entryIndex) => {
      allRows.push({
        sNo: counter++,
        ourDc: entryIndex === 0 ? dc.ourDcNumber : '',
        partyDc: entryIndex === 0 ? dc.partyDcNumber : '',
        partyDcDate: inheritedDate, // Always displayed for every row under this DC
        description: entry.description,
        rolls: entry.rolls,
        weightDisplay: entry.weightDisplay,
        rate: entry.rate,
        amount: entry.amount,
      });
    });
  });

  // Effective bank details (snapshot if available, otherwise fallback to current settings)
  const bankName = invoice.bankNameSnapshot || settings.bankName;
  const branch = invoice.branchSnapshot || settings.branch;
  const accountNumber = invoice.accountNumberSnapshot || settings.accountNumber;
  const ifscCode = invoice.ifscCodeSnapshot || settings.ifscCode;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Action Toolbar (Hidden during print) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-4 mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToWorkspace}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Workspace</span>
          </button>

          <div className="h-4 w-px bg-slate-200" />

          <div className="flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveView('invoice')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeView === 'invoice'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Invoice Preview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('payment')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeView === 'payment'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
              <span>Internal Payment Ledger</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                  invoice.paymentStatus === 'paid'
                    ? 'bg-emerald-100 text-emerald-800'
                    : invoice.paymentStatus === 'partially_paid'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {invoice.paymentStatus.replace('_', ' ')}
              </span>
            </button>
          </div>
        </div>

        {/* Print Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handlePrint(1)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print 1 Copy</span>
          </button>

          <button
            type="button"
            onClick={() => handlePrint(3)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-100 transition-all cursor-pointer"
            title="Spools 3 identical copies directly to your desktop printer"
          >
            <Printer className="w-4 h-4" />
            <span>Print 3 Copies</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: INTERNAL PAYMENT LEDGER (Strictly Internal, Never Printed) */}
      {activeView === 'payment' && (
        <div className="print:hidden bg-white rounded-2xl p-6 border border-slate-200 shadow-xs mb-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <span>Internal Payment Tracking</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Internal accounting ledger for Sri Krishna Textile (Never appears on printed customer bills)
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Invoice Number:</span>
              <span className="font-mono text-sm font-bold text-slate-800">{invoice.invoiceNumber}</span>
            </div>
          </div>

          {/* Metric Cards: Total, Paid, Outstanding */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs text-slate-500 block">Total Bill Amount</span>
              <span className="text-xl font-bold text-slate-900 font-mono mt-1 block">
                ₹{invoice.calculations.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-xs text-emerald-700 block">Total Paid So Far</span>
              <span className="text-xl font-bold text-emerald-800 font-mono mt-1 block">
                ₹{invoice.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
              <span className="text-xs text-rose-700 block">Outstanding Balance</span>
              <span className="text-xl font-bold text-rose-800 font-mono mt-1 block">
                ₹{invoice.outstandingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Record Payment Form */}
          {invoice.outstandingAmount > 0 ? (
            <form onSubmit={handleAddPayment} className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <h4 className="text-sm font-semibold text-slate-800">Record Received Payment</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount (₹):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={invoice.outstandingAmount}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder={`Max ₹${invoice.outstandingAmount}`}
                    className="w-full text-sm font-medium px-3 py-2 rounded-lg bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Payment Date:</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full text-sm font-medium px-3 py-2 rounded-lg bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes (Optional):</label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="e.g. Bank Transfer / GPay"
                    className="w-full text-sm font-medium px-3 py-2 rounded-lg bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>Update Payment Record</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span>This invoice is fully paid! Outstanding balance is ₹0.00.</span>
            </div>
          )}

          {paymentRecordedToast && (
            <div className="p-3 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-700" />
              <span>Payment successfully recorded! Ledger updated.</span>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: FORMAL PRINT-READY A4 INVOICE */}
      <div
        id="invoice-print-area"
        className={`space-y-8 ${activeView === 'payment' ? 'hidden' : 'block'}`}
      >
        {Array.from({ length: printCopiesCount }).map((_, copyIndex) => (
          <div
            key={copyIndex}
            className="invoice-page bg-white p-6 sm:p-9 shadow-sm w-full max-w-[210mm] mx-auto text-slate-900 font-sans min-h-[268mm] flex flex-col justify-between box-border rounded-none"
          >
            {/* TOP CONTAINER: Business Header, Party Info, Itemized Table */}
            <div>
              {/* 1. BUSINESS HEADER */}
              <div className="border-b-2 border-slate-900 pb-4 text-center">
                <h1 className="text-2xl sm:text-[26px] font-black tracking-wider uppercase text-slate-900 leading-tight">
                  {settings.businessName}
                </h1>
                <p className="text-xs sm:text-[13px] font-bold text-slate-700 uppercase tracking-[0.22em] mt-1.5">
                  Cloth Dyeing & Processing Job Work
                </p>
                <p className="text-xs text-slate-600 mt-1.5 max-w-xl mx-auto leading-relaxed">
                  {settings.address}
                </p>
                <div className="flex justify-center items-center gap-6 text-xs text-slate-700 font-medium mt-1.5">
                  <span>
                    <strong className="text-slate-900 font-semibold">GSTIN:</strong>{' '}
                    <span className="font-mono font-bold text-slate-900">{settings.gstin}</span>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    <strong className="text-slate-900 font-semibold">Phone:</strong>{' '}
                    <span className="font-mono text-slate-800">{settings.phone}</span>
                  </span>
                </div>
              </div>

              {/* 2. PARTY + INVOICE METADATA */}
              <div className="grid grid-cols-12 gap-6 py-4 sm:py-5 border-b border-slate-300 items-start">
                {/* Left: Billed To Customer */}
                <div className="col-span-7 sm:col-span-8 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                    Billed To
                  </span>
                  <div className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight leading-snug">
                    {invoice.partyNameSnapshot}
                  </div>
                  <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line max-w-md pt-0.5">
                    {invoice.partyAddressSnapshot}
                  </div>
                  <div className="pt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-700">
                    {invoice.partyGstinSnapshot && (
                      <div>
                        <span className="text-slate-500 font-medium">GSTIN: </span>
                        <span className="font-mono font-bold text-slate-900">{invoice.partyGstinSnapshot}</span>
                      </div>
                    )}
                    {invoice.partyPhoneSnapshot && (
                      <div>
                        <span className="text-slate-500 font-medium">Mobile: </span>
                        <span className="font-mono font-medium text-slate-800">{invoice.partyPhoneSnapshot}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Invoice Details */}
                <div className="col-span-5 sm:col-span-4 text-right flex flex-col justify-start space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                      Tax Invoice No
                    </span>
                    <span className="font-mono font-black text-lg sm:text-xl text-slate-900 tracking-tight block mt-0.5">
                      {invoice.invoiceNumber || 'PROVISIONAL'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                      Invoice Date
                    </span>
                    <span className="font-mono font-bold text-xs sm:text-sm text-slate-800 block mt-0.5">
                      {formatDisplayDate(invoice.invoiceDate)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. ITEMIZED WORK TABLE */}
              <div className="mt-4 sm:mt-5 overflow-x-auto print:overflow-visible">
                <table className="w-full text-xs border-collapse border border-slate-300 min-w-[650px] print:min-w-full">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-400 text-slate-800 font-bold text-[11px] tracking-wider uppercase">
                      <th className="border-r border-slate-300 py-2.5 px-1.5 text-center w-10">S.No</th>
                      <th className="border-r border-slate-300 py-2.5 px-2 text-center w-20">Our DC</th>
                      <th className="border-r border-slate-300 py-2.5 px-2 text-center w-20">Party DC</th>
                      <th className="border-r border-slate-300 py-2.5 px-2 text-center w-24">Party DC Date</th>
                      <th className="border-r border-slate-300 py-2.5 px-3 text-left">Description of Process / Work</th>
                      <th className="border-r border-slate-300 py-2.5 px-2 text-center w-14">Rolls</th>
                      <th className="border-r border-slate-300 py-2.5 px-2.5 text-right w-24">Weight (kg)</th>
                      <th className="border-r border-slate-300 py-2.5 px-2.5 text-right w-20">Rate (₹)</th>
                      <th className="py-2.5 px-2.5 text-right w-28">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRows.map((row) => (
                      <tr key={row.sNo} className="border-b border-slate-200/90 hover:bg-slate-50/50">
                        <td className="border-r border-slate-300 py-2.5 px-1.5 text-center font-mono text-slate-700">
                          {row.sNo}
                        </td>
                        <td className="border-r border-slate-300 py-2.5 px-2 text-center font-mono font-medium text-slate-800">
                          {row.ourDc}
                        </td>
                        <td className="border-r border-slate-300 py-2.5 px-2 text-center font-mono font-medium text-slate-800">
                          {row.partyDc}
                        </td>
                        {/* Inherited Party DC Date: explicitly repeated on every row */}
                        <td className="border-r border-slate-300 py-2.5 px-2 text-center font-mono text-xs text-slate-700">
                          {row.partyDcDate}
                        </td>
                        <td className="border-r border-slate-300 py-2.5 px-3 font-semibold text-slate-900">
                          {row.description}
                        </td>
                        <td className="border-r border-slate-300 py-2.5 px-2 text-center font-mono text-slate-800">
                          {row.rolls || ''}
                        </td>
                        <td className="border-r border-slate-300 py-2.5 px-2.5 text-right font-mono font-semibold text-slate-900">
                          {row.weightDisplay}
                        </td>
                        <td className="border-r border-slate-300 py-2.5 px-2.5 text-right font-mono text-slate-700">
                          {row.rate.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900">
                          {row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}

                    {/* 4. TOTAL QUANTITIES ROW */}
                    <tr className="bg-slate-100/90 font-bold border-t-2 border-b-2 border-slate-400 text-slate-900">
                      <td colSpan={5} className="border-r border-slate-300 py-3 px-3 text-right uppercase tracking-wider text-[11px] font-black">
                        Total Quantities:
                      </td>
                      <td className="border-r border-slate-300 py-3 px-2 text-center font-mono font-bold">
                        {invoice.calculations.totalRolls}
                      </td>
                      <td className="border-r border-slate-300 py-3 px-2.5 text-right font-mono font-bold">
                        {invoice.calculations.totalWeightKg.toFixed(3)} kg
                      </td>
                      <td className="border-r border-slate-300 py-3 px-2.5 text-right text-[11px] uppercase tracking-wider text-slate-700 font-bold">
                        Subtotal:
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono font-black text-slate-900">
                        ₹{invoice.calculations.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* BOTTOM CONTAINER: Full-Width Amount in Words, Bank Details + Financial Summary, and Footer */}
            <div className="mt-4 pt-1 space-y-4">
              {/* 4. FULL-WIDTH AMOUNT IN WORDS (Clean Document Section without Card Box) */}
              <div className="py-3 border-b border-slate-300">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                  Amount in Words
                </span>
                <div className="text-xs sm:text-[13px] font-semibold text-slate-900 leading-relaxed">
                  {invoice.calculations.totalAmountInWords}
                </div>
              </div>

              {/* 5. BANK DETAILS + FINANCIAL SUMMARY (TWO COLUMNS, NO ROUNDED CARDS) */}
              <div className="grid grid-cols-12 gap-6 items-start pt-1">
                {/* Left Column: Bank Details for Payment */}
                <div className="col-span-7 pr-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2.5">
                    Bank Details for Payment
                  </span>
                  <div className="space-y-1.5 text-xs text-slate-700">
                    <div className="grid grid-cols-12 gap-1 items-baseline">
                      <span className="col-span-4 text-slate-500 font-medium">Bank Name:</span>
                      <span className="col-span-8 font-semibold text-slate-900">{bankName}, {branch}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-1 items-baseline">
                      <span className="col-span-4 text-slate-500 font-medium">Account No:</span>
                      <span className="col-span-8 font-mono font-bold text-slate-900 text-xs sm:text-[13px]">{accountNumber}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-1 items-baseline">
                      <span className="col-span-4 text-slate-500 font-medium">IFSC Code:</span>
                      <span className="col-span-8 font-mono font-bold text-slate-900 text-xs sm:text-[13px]">{ifscCode}</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Tax Breakdown and Dominant Final Amount */}
                <div className="col-span-5 pl-4 border-l border-slate-200 space-y-2">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        ₹{invoice.calculations.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600">
                      <span>CGST ({invoice.calculations.cgstRate}%):</span>
                      <span className="font-mono font-semibold text-slate-800">
                        ₹{invoice.calculations.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600">
                      <span>SGST ({invoice.calculations.sgstRate}%):</span>
                      <span className="font-mono font-semibold text-slate-800">
                        ₹{invoice.calculations.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600 border-t border-slate-200 pt-1.5">
                      <span>Round-off:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {invoice.calculations.roundOff >= 0
                          ? `+₹${invoice.calculations.roundOff.toFixed(2)}`
                          : `-₹${Math.abs(invoice.calculations.roundOff).toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  {/* Dominant Final Amount Box (Clean Horizontal Rule) */}
                  <div className="border-t-2 border-slate-900 pt-2.5 mt-2 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                        Final Amount
                      </span>
                      <span className="text-xs font-bold text-slate-900 uppercase">
                        Net Payable
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        ₹{invoice.calculations.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. BOTTOM SIGN-OFF FOOTER */}
              <div className="pt-3 border-t border-slate-300 flex justify-end items-center">
                <div className="text-right">
                  <span className="font-normal italic text-slate-800 text-xs sm:text-[13px] tracking-wide">
                    For SRI KRISHNA TEXTILE
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
