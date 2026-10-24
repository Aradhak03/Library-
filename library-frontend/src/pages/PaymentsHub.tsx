import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Receipt,
  IndianRupee,
  Wallet,
  CreditCard,
  RefreshCw,
  Search,
  Trash2,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { paymentsApi, studentsApi, getErrorMessage } from '../api/client.ts';
import type { Payment, Student } from '../types/index.ts';
import { useModals } from '../context/ModalContext.tsx';

export default function PaymentsHub() {
  const { openPaymentModal, refreshKey } = useModals();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [datePreset, setDatePreset] = useState<'month' | 'today' | 'all'>('month');
  const [filterMethod, setFilterMethod] = useState<'all' | 'cash' | 'online'>('all');
  const [filterType, setFilterType] = useState<'all' | 'regular' | 'adjustment'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Delete / Void state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [paymentsData, studentsData] = await Promise.all([
        paymentsApi.getAll(),
        studentsApi.getAll(),
      ]);

      setPayments(paymentsData);
      setStudents(studentsData);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Student Map
  const studentMap = useMemo(() => {
    const map = new Map<number, Student>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  // Today and Current Month strings
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  // Filter Payments
  const filteredPayments = useMemo(() => {
    return payments
      .filter((p) => {
        // Date preset
        if (datePreset === 'today' && p.payment_date !== todayStr) return false;
        if (datePreset === 'month' && !p.payment_date.startsWith(currentMonthStr)) return false;

        // Payment Method
        if (filterMethod !== 'all' && p.payment_type !== filterMethod) return false;

        // Regular vs Adjustment
        if (filterType === 'regular' && p.is_adjustment) return false;
        if (filterType === 'adjustment' && !p.is_adjustment) return false;

        // Search Query (Student Name or Receipt ID)
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const s = studentMap.get(p.student_id);
          const studentName = s ? s.name.toLowerCase() : '';
          const receiptId = String(p.id);
          const studentMobile = s ? s.mobile_number : '';
          if (!studentName.includes(q) && !receiptId.includes(q) && !studentMobile.includes(q)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
  }, [payments, datePreset, todayStr, currentMonthStr, filterMethod, filterType, searchQuery, studentMap]);

  // Summary Metrics for current filtered view
  const metrics = useMemo(() => {
    let total = 0;
    let cash = 0;
    let cashCount = 0;
    let online = 0;
    let onlineCount = 0;
    let adjustments = 0;
    let adjustmentCount = 0;

    filteredPayments.forEach((p) => {
      const amt = Number(p.amount) || 0;
      total += amt;
      if (p.payment_type === 'cash') {
        cash += amt;
        cashCount++;
      } else {
        online += amt;
        onlineCount++;
      }
      if (p.is_adjustment) {
        adjustments += amt;
        adjustmentCount++;
      }
    });

    return { total, cash, cashCount, online, onlineCount, adjustments, adjustmentCount };
  }, [filteredPayments]);

  const handleDeletePayment = async (paymentId: number) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete Receipt #${paymentId}? Use this only to correct entry mistakes.`
    );
    if (!confirmed) return;

    setDeletingId(paymentId);
    try {
      await paymentsApi.delete(paymentId);
      await fetchData();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>Payments & Revenue Hub</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {payments.length} Transactions Logged
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cash & UPI ledger, anniversary subscription periods, and mid-cycle adjustments.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            title="Refresh payments"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          <button
            onClick={() => openPaymentModal({ defaultMode: 'regular' })}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition"
          >
            <IndianRupee className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="underline hover:text-red-300">
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Filtered Collection
            </p>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-3">
            {formatCurrency(metrics.total)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Across {filteredPayments.length} receipt transactions
          </p>
        </div>

        {/* Cash Total */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Cash Drawer
            </p>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-3">
            {formatCurrency(metrics.cash)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {metrics.cashCount} cash payments received
          </p>
        </div>

        {/* Online / UPI Total */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Online / UPI / QR
            </p>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-3">
            {formatCurrency(metrics.online)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {metrics.onlineCount} online transactions logged
          </p>
        </div>

        {/* Adjustments */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Upgrade Top-ups
            </p>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-3">
            {formatCurrency(metrics.adjustments)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {metrics.adjustmentCount} mid-cycle adjustments
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Preset Range Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setDatePreset('month')}
            className={`px-3 py-1.5 rounded-lg transition ${
              datePreset === 'month'
                ? 'bg-slate-800 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setDatePreset('today')}
            className={`px-3 py-1.5 rounded-lg transition ${
              datePreset === 'today'
                ? 'bg-slate-800 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Today Only
          </button>
          <button
            onClick={() => setDatePreset('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              datePreset === 'all'
                ? 'bg-slate-800 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All History
          </button>

          <span className="text-slate-700 mx-1">|</span>

          {/* Method Filter */}
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value as 'all' | 'cash' | 'online')}
            className="bg-transparent text-slate-300 text-xs font-medium focus:outline-none cursor-pointer px-1 py-1"
          >
            <option value="all" className="bg-slate-900">All Payment Modes</option>
            <option value="cash" className="bg-slate-900">Cash Collections</option>
            <option value="online" className="bg-slate-900">Online / UPI</option>
          </select>

          <span className="text-slate-700 mx-1">|</span>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'regular' | 'adjustment')}
            className="bg-transparent text-slate-300 text-xs font-medium focus:outline-none cursor-pointer px-1 py-1"
          >
            <option value="all" className="bg-slate-900">All Payment Types</option>
            <option value="regular" className="bg-slate-900">Regular Subscriptions</option>
            <option value="adjustment" className="bg-slate-900">Upgrade Adjustments</option>
          </select>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search student, mobile, or receipt #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition shadow-sm"
          />
        </div>
      </div>

      {/* Transaction Ledger Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Loading payment ledger...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-12 text-center py-20">
            <Receipt className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <h4 className="text-base font-semibold text-white">No Receipts Found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {searchQuery
                ? `No transactions match your search "${searchQuery}".`
                : 'No payments have been logged for this period. Click "Record Payment" to log a fee receipt.'}
            </p>
            <button
              onClick={() => openPaymentModal({ defaultMode: 'regular' })}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
            >
              + Record Fee Payment
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 bg-slate-900/40">
                  <th className="py-3.5 px-4">Receipt #</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Method</th>
                  <th className="py-3.5 px-4">Type & Period Covered</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredPayments.map((p) => {
                  const student = studentMap.get(p.student_id);

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition group">
                      {/* Receipt ID */}
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-300">
                        #{p.id}
                      </td>

                      {/* Payment Date */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                        {p.payment_date}
                      </td>

                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white text-xs">
                          {student ? student.name : `Student #${p.student_id}`}
                        </div>
                        {student && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            {student.mobile_number}
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 font-bold text-white text-sm">
                        {formatCurrency(Number(p.amount))}
                      </td>

                      {/* Method Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium border ${
                            p.payment_type === 'cash'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}
                        >
                          {p.payment_type === 'cash' ? (
                            <Wallet className="w-3 h-3" />
                          ) : (
                            <CreditCard className="w-3 h-3" />
                          )}
                          <span className="capitalize">{p.payment_type}</span>
                        </span>
                      </td>

                      {/* Type & Period / Note */}
                      <td className="py-3.5 px-4 text-xs">
                        {p.is_adjustment ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Sparkles className="w-2.5 h-2.5" />
                              Upgrade Adjustment
                            </span>
                            <div className="text-slate-300 text-[11px] italic">
                              "{p.note || 'Adjustment payment'}"
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Regular Month
                            </span>
                            <div className="text-slate-300 font-mono text-[11px]">
                              {p.period_start} → {p.period_end}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Actions: Void / Delete */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          disabled={deletingId === p.id}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                          title="Void / Delete payment (mistake correction)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
