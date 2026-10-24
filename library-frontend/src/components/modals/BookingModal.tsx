import { useState, useEffect, useMemo } from 'react';
import {
  X,
  CalendarPlus,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { bookingsApi, seatsApi, studentsApi, getErrorMessage } from '../../api/client.ts';
import type { Student, SeatMatrixEntry } from '../../types/index.ts';
import { checkTimesOverlap, formatTime12Hour } from '../../utils/time.ts';
import { useModals } from '../../context/ModalContext.tsx';

export const BookingModal = () => {
  const {
    isBookingModalOpen,
    closeBookingModal,
    bookingModalOptions,
    triggerRefresh,
    openPaymentModal,
    openStudentModal,
  } = useModals();

  // Form State
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedSeatId, setSelectedSeatId] = useState<number | null>(null);
  const [is24Hour, setIs24Hour] = useState(false);
  const [dailyStartTime, setDailyStartTime] = useState('08:00');
  const [dailyEndTime, setDailyEndTime] = useState('14:00');
  const [subscriptionStartDate, setSubscriptionStartDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');

  // Data fetching state
  const [students, setStudents] = useState<Student[]>([]);
  const [seats, setSeats] = useState<SeatMatrixEntry[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize preselected options when modal opens
  useEffect(() => {
    if (!isBookingModalOpen) return;

    if (bookingModalOptions.preselectedSeatId) {
      setSelectedSeatId(bookingModalOptions.preselectedSeatId);
    }
    if (bookingModalOptions.preselectedStudentId) {
      setSelectedStudentId(bookingModalOptions.preselectedStudentId);
    }

    // Load students & seat matrix
    const loadData = async () => {
      setLoading(true);
      try {
        const [studentsData, seatData] = await Promise.all([
          studentsApi.getAll(),
          seatsApi.getMatrix(),
        ]);
        setStudents(studentsData);
        setSeats(seatData);

        // If no seat selected yet, pre-select the first available vacant seat
        if (!bookingModalOptions.preselectedSeatId && seatData.length > 0) {
          const firstVacant = seatData.find((s) => s.bookings.length === 0 && s.is_active);
          if (firstVacant) setSelectedSeatId(firstVacant.id);
          else setSelectedSeatId(seatData[0].id);
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isBookingModalOpen, bookingModalOptions]);

  // Filter students based on search input
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.toLowerCase();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.mobile_number.includes(q)
    );
  }, [students, studentSearch]);

  // Current selected seat details
  const selectedSeat = useMemo(() => {
    return seats.find((s) => s.id === selectedSeatId) || null;
  }, [seats, selectedSeatId]);

  // Conflict detection
  const conflictDetails = useMemo(() => {
    if (!selectedSeat) return null;

    if (!selectedSeat.is_active) {
      return 'This seat is marked Out of Service and cannot be booked.';
    }

    // If existing booking is 24h
    if (selectedSeat.bookings.some((b) => b.is_24_hour_reservation)) {
      return `Seat #${selectedSeat.number} is already reserved for 24 hours.`;
    }

    // If new booking is 24h, it conflicts with any existing booking
    if (is24Hour && selectedSeat.bookings.length > 0) {
      return `Cannot make a 24-hour reservation on Seat #${selectedSeat.number} because it already has ${selectedSeat.bookings.length} active time slot(s).`;
    }

    // If custom hours, check for overlap
    if (!is24Hour) {
      for (const b of selectedSeat.bookings) {
        if (b.is_24_hour_reservation) {
          return `Conflict with 24-hour booking on Seat #${selectedSeat.number}.`;
        }
        if (checkTimesOverlap(b.daily_start_time, b.daily_end_time, dailyStartTime, dailyEndTime)) {
          const occName = b.student_name || `Student #${b.student_id}`;
          const occTime = `${formatTime12Hour(b.daily_start_time)} – ${formatTime12Hour(b.daily_end_time)}`;
          return `Time conflict on Seat #${selectedSeat.number}! Occupied by ${occName} (${occTime}).`;
        }
      }
    }

    return null;
  }, [selectedSeat, is24Hour, dailyStartTime, dailyEndTime]);

  if (!isBookingModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedStudentId) {
      setError('Please select a student');
      return;
    }
    if (!selectedSeatId) {
      setError('Please select a seat');
      return;
    }
    if (conflictDetails) {
      setError(conflictDetails);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        student_id: selectedStudentId,
        seat_id: selectedSeatId,
        subscription_start_date: subscriptionStartDate,
        is_24_hour_reservation: is24Hour,
        daily_start_time: is24Hour ? null : dailyStartTime,
        daily_end_time: is24Hour ? null : dailyEndTime,
        notes: notes.trim() || null,
      };

      const newBooking = await bookingsApi.create(payload);
      triggerRefresh();
      closeBookingModal();

      // Open payment modal immediately to collect first fee
      const selectedStudentObj = students.find((s) => s.id === selectedStudentId);
      openPaymentModal({
        bookingId: newBooking.id,
        studentId: selectedStudentId,
        studentName: selectedStudentObj?.name,
        defaultMode: 'regular',
      });
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
          onClick={closeBookingModal}
          disabled={submitting}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <CalendarPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Allocate Seat & Timing</h3>
            <p className="text-xs text-slate-400">
              Assign a student to a 24-hr or custom daily time slot
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Conflict Warning Alert */}
        {conflictDetails && (
          <div className="p-3 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{conflictDetails}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Select Student */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                1. Select Student *
              </label>
              <button
                type="button"
                onClick={() => {
                  closeBookingModal();
                  openStudentModal();
                }}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium"
              >
                + Register New Student
              </button>
            </div>

            {loading ? (
              <div className="text-xs text-slate-500 py-2">Loading students...</div>
            ) : (
              <div className="space-y-2">
                {/* Search input for students */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search student by name or phone..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Dropdown selector */}
                <select
                  required
                  value={selectedStudentId || ''}
                  onChange={(e) => setSelectedStudentId(Number(e.target.value) || null)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 shadow-sm"
                >
                  <option value="">-- Choose Student --</option>
                  {filteredStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.mobile_number})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Step 2: Select Seat */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              2. Select Seat (1 to 48) *
            </label>
            <select
              required
              value={selectedSeatId || ''}
              onChange={(e) => setSelectedSeatId(Number(e.target.value) || null)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 shadow-sm font-medium"
            >
              <option value="">-- Choose Seat --</option>
              {seats.map((s) => {
                const isOccupied = s.bookings.length > 0;
                const isFull24 = s.bookings.some((b) => b.is_24_hour_reservation);
                const tag = isFull24
                  ? '🔴 24h Full'
                  : isOccupied
                  ? `🟡 Partial (${s.bookings.length} slots)`
                  : '🟢 Vacant';
                return (
                  <option key={s.id} value={s.id}>
                    Seat #{s.number} — {tag}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Step 3: Choose Timing Mode */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              3. Timing Mode
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setIs24Hour(false)}
                className={`py-2 rounded-lg font-semibold transition ${
                  !is24Hour
                    ? 'bg-blue-600 text-white shadow-sm'
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
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                24-Hour Full Day
              </button>
            </div>
          </div>

          {/* Start and End Times (if not 24h) */}
          {!is24Hour && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Daily Start Time *
                </label>
                <input
                  type="time"
                  required
                  value={dailyStartTime}
                  onChange={(e) => setDailyStartTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Daily End Time *
                </label>
                <input
                  type="time"
                  required
                  value={dailyEndTime}
                  onChange={(e) => setDailyEndTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 col-span-2">
                Tip: Overnight slots like 10:00 PM to 06:00 AM are fully supported.
              </p>
            </div>
          )}

          {/* Step 4: Subscription Start Date */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              4. Subscription Start Date *
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="date"
                required
                value={subscriptionStartDate}
                onChange={(e) => setSubscriptionStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Step 5: Optional Notes */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. UPSC aspirant, morning slot preferred"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-800">
            <button
              type="button"
              onClick={closeBookingModal}
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
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
              }`}
            >
              {submitting ? (
                <span>Confirming Booking...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Booking & Proceed to Payment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
