import { useState, useEffect, useMemo } from 'react';
import {
  X,
  IndianRupee,
  Wallet,
  CreditCard,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Info,
} from 'lucide-react';
import { paymentsApi, bookingsApi, studentsApi, getErrorMessage } from '../../api/client.ts';
import type { Booking, Student } from '../../types/index.ts';
import { useModals } from '../../context/ModalContext.tsx';

export const PaymentModal = () => {
  const { isPaymentModalOpen, closePaymentModal, paymentModalOptions, triggerRefresh } = useModals();

  // Mode: 'regular' | 'adjustment'
  const [mode, setMode] = useState<'regular' | 'adjustment'>('regular');

  // Form Fields
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [amount, setAmount] = useState<string>('800');
  const [paymentDate, setPaymentDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [paymentType, setPaymentType] = useState<'cash' | 'online'>('cash');

  // Regular Mode fields
  const [periodDuration, setPeriodDuration] = useState<number>(1);
  const [periodUnit, setPeriodUnit] = useState<'months' | 'days'>('months');

  // Adjustment Mode fields
  const [note, setNote] = useState<string>('');

  // Active bookings & students data
  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize options when modal opens
  useEffect(() => {
    if (!isPaymentModalOpen) return;

    if (paymentModalOptions.defaultMode) {
      setMode(paymentModalOptions.defaultMode);
    } else {
      setMode('regular');
    }

    if (paymentModalOptions.bookingId) {
      setBookingId(paymentModalOptions.bookingId);
    }

    // Load active bookings & students
    const loadData = async () => {
      setLoading(true);
      try {
        const [bookingsData, studentsData] = await Promise.all([
          bookingsApi.getAll(),
          studentsApi.getAll(),
        ]);
        setActiveBookings(bookingsData);
        setStudents(studentsData);

        if (!paymentModalOptions.bookingId && bookingsData.length > 0) {
          setBookingId(bookingsData[0].id);
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isPaymentModalOpen, paymentModalOptions]);

  // Student Map
  const studentMap = useMemo(() => {
    const map = new Map<number, Student>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  // Selected Booking Details
  const selectedBooking = useMemo(() => {
    return activeBookings.find((b) => b.id === bookingId) || null;
  }, [activeBookings, bookingId]);

  const selectedStudent = useMemo(() => {
    if (!selectedBooking) return null;
    return studentMap.get(selectedBooking.student_id) || null;
  }, [selectedBooking, studentMap]);

  if (!isPaymentModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!bookingId) {
      setError('Please select an active booking');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive payment amount');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'regular') {
        await paymentsApi.createRegular({
          booking_id: bookingId,
          amount: numAmount,
          payment_date: paymentDate,
          payment_type: paymentType,
          period_duration: periodDuration,
          period_unit: periodUnit,
        });
      } else {
        if (!note.trim()) {
          setError('Please provide a reason or note for this adjustment payment');
          setSubmitting(false);
          return;
        }

        await paymentsApi.createAdjustment({
          booking_id: bookingId,
          amount: numAmount,
          payment_date: paymentDate,
          payment_type: paymentType,
          note: note.trim(),
        });
      }

      triggerRefresh();
      closePaymentModal();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative my-8">
        {/* Close Button */}
        <button
          onClick={closePaymentModal}
          disabled={submitting}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <IndianRupee className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Record Fee Payment</h3>
            <p className="text-xs text-slate-400">
              Collect monthly subscription fee or mid-cycle adjustment
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 mb-5 text-xs">
          <button
            type="button"
            onClick={() => setMode('regular')}
            className={`py-2 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 ${
              mode === 'regular'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Regular Monthly Fee</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('adjustment')}
            className={`py-2 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 ${
              mode === 'adjustment'
                ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Adjustment / Upgrade Fee</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Student & Booking */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Select Student & Seat Allocation *
            </label>
            {loading ? (
              <div className="text-xs text-slate-500 py-2">Loading active allocations...</div>
            ) : activeBookings.length === 0 ? (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                No active bookings exist. Allocate a seat to a student first before recording payment.
              </div>
            ) : (
              <select
                required
                value={bookingId || ''}
                onChange={(e) => setBookingId(Number(e.target.value) || null)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
              >
                {activeBookings.map((b) => {
                  const s = studentMap.get(b.student_id);
                  const name = s ? s.name : `Student #${b.student_id}`;
                  const phone = s ? `(${s.mobile_number})` : '';
                  return (
                    <option key={b.id} value={b.id}>
                      {name} {phone} — Seat #{b.seat_id}
                    </option>
                  );
                })}
              </select>
            )}

            {selectedStudent && (
              <p className="text-[11px] text-slate-400 mt-1">
                Linked to {selectedStudent.name} (Seat #{selectedBooking?.seat_id})
              </p>
            )}
          </div>

          {/* Amount & Payment Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Amount (₹) *
              </label>
              <div className="relative">
                <span className="text-slate-500 font-bold absolute left-3 top-2.5 text-sm">₹</span>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="800"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Payment Date *
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Payment Method Toggle: Cash vs Online */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Payment Method *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentType('cash')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                  paymentType === 'cash'
                    ? 'bg-slate-800 border-emerald-500 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Cash Collection</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('online')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                  paymentType === 'online'
                    ? 'bg-slate-800 border-blue-500 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4 text-blue-400" />
                <span>Online / UPI / QR</span>
              </button>
            </div>
          </div>

          {/* MODE A: Regular Billing Duration */}
          {mode === 'regular' ? (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Billing Cycle Duration
                </label>
                <span className="text-[11px] text-slate-400">Continuous anniversary dates</span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: '1 Month', dur: 1, unit: 'months' },
                  { label: '2 Months', dur: 2, unit: 'months' },
                  { label: '3 Months', dur: 3, unit: 'months' },
                  { label: '15 Days', dur: 15, unit: 'days' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setPeriodDuration(preset.dur);
                      setPeriodUnit(preset.unit as 'months' | 'days');
                    }}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition border ${
                      periodDuration === preset.dur && periodUnit === preset.unit
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Explanatory preview */}
              <div className="text-xs text-slate-300 flex items-start gap-2 pt-1 border-t border-slate-800">
                <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  The backend automatically connects this payment to the previous cycle's end date with zero gaps or overlaps.
                </span>
              </div>
            </div>
          ) : (
            /* MODE B: Adjustment Note */
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Mid-Cycle Adjustment Details</span>
              </div>
              <p className="text-[11px] text-slate-300">
                This charge will count towards your revenue totals without altering the student's monthly billing anniversary.
              </p>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Reason / Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Upgrade from 4hrs to 6hrs for remaining 15 days"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-800">
            <button
              type="button"
              onClick={closePaymentModal}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || activeBookings.length === 0}
              className={`px-5 py-2 rounded-lg text-xs font-semibold text-white shadow-md transition flex items-center gap-2 ${
                mode === 'regular'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                  : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
              }`}
            >
              {submitting ? (
                <span>Recording Receipt...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {mode === 'regular'
                      ? `Confirm ₹${amount} Payment`
                      : `Log ₹${amount} Adjustment`}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
