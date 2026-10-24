import { useState, useEffect, useCallback } from 'react';
import {
  IndianRupee,
  Users,
  Armchair,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Clock,
  Wallet,
  CreditCard,
  UserPlus,
  CalendarPlus,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import {
  dashboardApi,
  seatsApi,
  studentsApi,
  paymentsApi,
  getErrorMessage,
} from '../api/client.ts';
import type {
  RevenueResponse,
  PendingStudent,
  SeatMatrixEntry,
  Payment,
} from '../types/index.ts';
import { useModals } from '../context/ModalContext.tsx';

export default function Dashboard() {
  const { openStudentModal, openBookingModal, openPaymentModal, refreshKey } = useModals();

  // State
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [revenue, setRevenue] = useState<RevenueResponse>({
    month: selectedMonth,
    total_revenue: 0,
    transaction_count: 0,
  });
  const [pendingStudents, setPendingStudents] = useState<PendingStudent[]>([]);
  const [seats, setSeats] = useState<SeatMatrixEntry[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [cashTotal, setCashTotal] = useState(0);
  const [onlineTotal, setOnlineTotal] = useState(0);

  // Seeding state
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState<string | null>(null);

  // Fetch all dashboard data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Run parallel requests
      const [revData, pendingData, seatData, studentsData, paymentsData] = await Promise.all([
        dashboardApi.getRevenue(selectedMonth).catch(() => ({
          month: selectedMonth,
          total_revenue: 0,
          transaction_count: 0,
        })),
        dashboardApi.getPending().catch(() => []),
        seatsApi.getMatrix().catch(() => []),
        studentsApi.getAll().catch(() => []),
        paymentsApi.getAll().catch(() => []),
      ]);

      setRevenue(revData);
      setPendingStudents(pendingData);
      setSeats(seatData);
      setStudentCount(studentsData.length);

      // Sort payments newest first and compute breakdown for the selected month
      const sorted = [...paymentsData].sort(
        (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
      );
      setRecentPayments(sorted.slice(0, 6));

      // Calculate cash vs online for current selected month
      let cash = 0;
      let online = 0;
      paymentsData.forEach((p) => {
        if (p.payment_date.startsWith(selectedMonth)) {
          const amt = Number(p.amount) || 0;
          if (p.payment_type === 'cash') cash += amt;
          else online += amt;
        }
      });
      setCashTotal(cash);
      setOnlineTotal(online);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  // Re-fetch on month change or when a modal action triggers refreshKey
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, refreshKey]);

  // Seed 48 seats handler
  const handleSeed48 = async () => {
    setSeeding(true);
    try {
      const res = await seatsApi.seed48();
      setSeedSuccess(res.message);
      setTimeout(() => setSeedSuccess(null), 4000);
      fetchDashboardData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSeeding(false);
    }
  };

  // Calculations
  const totalSeats = seats.length > 0 ? seats.length : 48;
  const occupiedSeatsCount = seats.filter((s) => s.bookings && s.bookings.length > 0).length;
  const occupancyRate = totalSeats > 0 ? Math.round((occupiedSeatsCount / totalSeats) * 100) : 0;

  // Month navigation options
  const monthLabel = (() => {
    const [y, m] = selectedMonth.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  })();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>Executive Dashboard</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Live Overview
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time occupancy, monthly fee collections, and overdue payment alerts.
          </p>
        </div>

        {/* Month Selector & Refresh */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-sm text-slate-200 font-medium focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => fetchDashboardData()}
            disabled={loading}
            title="Refresh dashboard"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-xs underline hover:text-red-300 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Seat Seed Helper Banner (shown if 0 seats exist in DB) */}
      {seats.length === 0 && !loading && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Armchair className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Initialize 48 Library Seats</h4>
              <p className="text-xs text-slate-300">
                Your database currently has 0 seats registered. Click below to automatically seed Seats 1 to 48.
              </p>
            </div>
          </div>
          <button
            onClick={handleSeed48}
            disabled={seeding}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shrink-0 shadow-md flex items-center justify-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{seeding ? 'Generating Seats...' : 'Seed Seats 1 to 48'}</span>
          </button>
        </div>
      )}

      {seedSuccess && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{seedSuccess}</span>
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Monthly Revenue */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {monthLabel} Revenue
            </p>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-3">
            {formatCurrency(revenue.total_revenue)}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-slate-300">
              <Wallet className="w-3 h-3 text-slate-400" />
              Cash: <strong className="text-white">{formatCurrency(cashTotal)}</strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-300">
              <CreditCard className="w-3 h-3 text-slate-400" />
              UPI: <strong className="text-white">{formatCurrency(onlineTotal)}</strong>
            </span>
          </div>
        </div>

        {/* Metric 2: Seat Occupancy */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Seat Occupancy
            </p>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Armchair className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <p className="text-2xl font-bold text-white">
              {occupiedSeatsCount}
              <span className="text-sm font-normal text-slate-400"> / {totalSeats}</span>
            </p>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {occupancyRate}%
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(occupancyRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Metric 3: Active Students */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Enrolled Students
            </p>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-3">
            {studentCount}
            <span className="text-xs font-normal text-slate-400 ml-1.5">Members</span>
          </p>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            <span>{occupiedSeatsCount} with active seat allocation</span>
          </p>
        </div>

        {/* Metric 4: Pending Overdue Dues */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Pending Collections
            </p>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                pendingStudents.length > 0
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <p className="text-2xl font-bold text-white">{pendingStudents.length}</p>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                pendingStudents.length > 0
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {pendingStudents.length > 0 ? 'Action Needed' : 'All Clear'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {pendingStudents.length > 0
              ? 'Students with expired billing cycles'
              : 'Zero overdue fees today'}
          </p>
        </div>
      </div>

      {/* Main Grid: Overdue Collections Table (2/3) + Quick Activity Stream (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Urgent Overdue Collections Table */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Overdue Follow-up & Collections
                </h3>
                <p className="text-xs text-slate-400">
                  Students currently attending whose payment cycle has expired.
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md font-mono">
              {pendingStudents.length} Overdue
            </span>
          </div>

          {pendingStudents.length === 0 ? (
            <div className="py-16 text-center my-auto">
              <CheckCircle2 className="w-12 h-12 text-emerald-500/80 mx-auto mb-3" />
              <h4 className="text-base font-semibold text-white">All Dues Collected!</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Every active student has a paid-up subscription. No pending collections today.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <th className="py-3 px-3">Student</th>
                    <th className="py-3 px-3">Seat #</th>
                    <th className="py-3 px-3">Paid Until</th>
                    <th className="py-3 px-3">Overdue</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {pendingStudents.map((item) => (
                    <tr key={item.booking_id} className="hover:bg-slate-800/30 transition">
                      {/* Student Name */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-white text-sm">{item.student_name}</div>
                        <div className="text-xs text-slate-400 font-mono">ID #{item.student_id}</div>
                      </td>

                      {/* Seat Badge */}
                      <td className="py-3 px-3">
                        {item.seat_number ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Armchair className="w-3 h-3" />
                            Seat {item.seat_number}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Unassigned</span>
                        )}
                      </td>

                      {/* Paid Until Date */}
                      <td className="py-3 px-3 text-xs text-slate-300 font-mono">
                        {new Date(item.last_paid_until).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Days Overdue Badge */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-3 h-3" />
                          {item.days_overdue} {item.days_overdue === 1 ? 'day' : 'days'}
                        </span>
                      </td>

                      {/* Action: 1-Click Collect Fee */}
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() =>
                            openPaymentModal({
                              bookingId: item.booking_id,
                              studentId: item.student_id,
                              studentName: item.student_name,
                              defaultMode: 'regular',
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30 transition"
                        >
                          <IndianRupee className="w-3 h-3" />
                          <span>Collect Fee</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 1 Col: Quick Actions & Recent Transactions Stream */}
        <div className="space-y-6">
          {/* Quick Action Tiles */}
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-white tracking-tight mb-2">
              Desk Quick Actions
            </h3>
            <button
              onClick={openStudentModal}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-xs font-semibold transition group"
            >
              <span className="flex items-center gap-2.5">
                <UserPlus className="w-4 h-4 text-blue-400" />
                <span>Register New Student</span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition" />
            </button>

            <button
              onClick={() => openBookingModal()}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-xs font-semibold transition group"
            >
              <span className="flex items-center gap-2.5">
                <CalendarPlus className="w-4 h-4 text-indigo-400" />
                <span>Allocate Seat / Timing</span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition" />
            </button>

            <button
              onClick={() => openPaymentModal()}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-xs font-semibold transition group"
            >
              <span className="flex items-center gap-2.5">
                <IndianRupee className="w-4 h-4 text-emerald-400" />
                <span>Record Fee Payment</span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition" />
            </button>
          </div>

          {/* Recent Collections Feed */}
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white tracking-tight">Recent Receipts</h3>
              <span className="text-[11px] text-slate-400 font-mono">
                {recentPayments.length} logged
              </span>
            </div>

            {recentPayments.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No payments recorded yet. Click "Record Payment" to log a fee receipt.
              </p>
            ) : (
              <div className="space-y-2.5">
                {recentPayments.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-medium text-white">
                        <span>{formatCurrency(Number(p.amount))}</span>
                        {p.is_adjustment ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Upgrade
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Regular
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <span className="capitalize text-slate-400">{p.payment_type}</span>
                        <span>•</span>
                        <span>{p.payment_date}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-slate-400 font-mono text-[11px]">
                        Student #{p.student_id}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
