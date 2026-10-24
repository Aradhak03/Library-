import { useState, useEffect, useMemo } from 'react';
import { X, ArrowRightLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { bookingsApi, seatsApi, getErrorMessage } from '../../api/client.ts';
import type { SeatMatrixEntry } from '../../types/index.ts';
import { checkTimesOverlap, formatTime12Hour } from '../../utils/time.ts';
import { useModals } from '../../context/ModalContext.tsx';

export const ChangeSlotModal = () => {
  const {
    isChangeSlotModalOpen,
    closeChangeSlotModal,
    changeSlotModalOptions,
    triggerRefresh,
    openPaymentModal,
  } = useModals();

  if (!isChangeSlotModalOpen || !changeSlotModalOptions) return null;

  const {
    bookingId,
    studentName,
    currentSeatId,
    currentSeatNumber,
    currentStartTime,
    currentEndTime,
    currentIs24h,
  } = changeSlotModalOptions;

  // Form State
  const [targetSeatId, setTargetSeatId] = useState<number>(currentSeatId);
  const [is24Hour, setIs24Hour] = useState<boolean>(currentIs24h);
  const [startTime, setStartTime] = useState<string>(currentStartTime || '08:00');
  const [endTime, setEndTime] = useState<string>(currentEndTime || '14:00');
  const [notes, setNotes] = useState<string>('');

  const [seats, setSeats] = useState<SeatMatrixEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSeats = async () => {
      try {
        const data = await seatsApi.getMatrix();
        setSeats(data);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    };
    loadSeats();
  }, []);

  const selectedSeat = useMemo(() => {
    return seats.find((s) => s.id === targetSeatId) || null;
  }, [seats, targetSeatId]);

  // Conflict detection excluding current student's own booking
  const conflictDetails = useMemo(() => {
    if (!selectedSeat) return null;

    if (!selectedSeat.is_active) {
      return 'The selected seat is marked Out of Service.';
    }

    // Other bookings on this seat (excluding the booking being edited!)
    const otherBookings = selectedSeat.bookings.filter((b) => b.booking_id !== bookingId);

    // If another booking is 24h
    if (otherBookings.some((b) => b.is_24_hour_reservation)) {
      return `Seat #${selectedSeat.number} already has a 24-hour reservation by another student.`;
    }

    // If new setting is 24h
    if (is24Hour && otherBookings.length > 0) {
      return `Cannot change to 24-hour reservation because Seat #${selectedSeat.number} has ${otherBookings.length} other active booking(s).`;
    }

    // If custom hours, check for overlap against others
    if (!is24Hour) {
      for (const b of otherBookings) {
        if (checkTimesOverlap(b.daily_start_time, b.daily_end_time, startTime, endTime)) {
          const occName = b.student_name || `Student #${b.student_id}`;
          const occTime = `${formatTime12Hour(b.daily_start_time)} – ${formatTime12Hour(b.daily_end_time)}`;
          return `Time conflict on Seat #${selectedSeat.number} with ${occName} (${occTime}).`;
        }
      }
    }

    return null;
  }, [selectedSeat, bookingId, is24Hour, startTime, endTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (conflictDetails) {
      setError(conflictDetails);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        seat_id: targetSeatId,
        is_24_hour_reservation: is24Hour,
        daily_start_time: is24Hour ? null : startTime,
        daily_end_time: is24Hour ? null : endTime,
        notes: notes.trim() || undefined,
      };

      await bookingsApi.changeSlot(bookingId, payload);
      triggerRefresh();
      closeChangeSlotModal();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative my-8">
        <button
          onClick={closeChangeSlotModal}
          disabled={submitting}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Change Timing or Transfer Seat
            </h3>
            <p className="text-xs text-slate-400">
              Student: <strong className="text-white">{studentName}</strong> (Booking #{bookingId})
            </p>
          </div>
        </div>

        {/* Info Banner: Billing Preservation */}
        <div className="p-3 mb-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-2">
          <span>
            ℹ️ Changing hours or seat preserves all payment records and anniversary billing dates
            without cancelling the subscription.
          </span>
        </div>

        {/* Error / Conflict Alert */}
        {error && (
          <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {conflictDetails && (
          <div className="p-3 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{conflictDetails}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current vs New Seat */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Select Seat (Current: Seat #{currentSeatNumber})
            </label>
            <select
              value={targetSeatId}
              onChange={(e) => setTargetSeatId(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
            >
              {seats.map((s) => (
                <option key={s.id} value={s.id}>
                  Seat #{s.number}{' '}
                  {s.id === currentSeatId
                    ? '(Current Seat)'
                    : s.bookings.length === 0
                    ? '(Vacant)'
                    : `(${s.bookings.length} slots booked)`}
                </option>
              ))}
            </select>
          </div>

          {/* Timing Mode Toggle */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Timing Mode
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setIs24Hour(false)}
                className={`py-2 rounded-lg font-semibold transition ${
                  !is24Hour
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Custom Daily Hours
              </button>
              <button
                type="button"
                onClick={() => setIs24Hour(true)}
                className={`py-2 rounded-lg font-semibold transition ${
                  is24Hour
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                24-Hour Full Day
              </button>
            </div>
          </div>

          {/* Start and End Times */}
          {!is24Hour && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  New Start Time
                </label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  New End Time
                </label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          )}

          {/* Reason / Admin Notes */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Admin Note / Reason (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Switched to evening slot from 24 Oct"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-between border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                closeChangeSlotModal();
                openPaymentModal({
                  bookingId,
                  studentName,
                  defaultMode: 'adjustment',
                });
              }}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium underline"
            >
              Collect upgrade difference fee?
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeChangeSlotModal}
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !!conflictDetails}
                className={`px-5 py-2 rounded-lg text-xs font-semibold text-white shadow-md transition flex items-center gap-2 ${
                  conflictDetails
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                }`}
              >
                {submitting ? (
                  <span>Updating Slot...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Shift Change</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
