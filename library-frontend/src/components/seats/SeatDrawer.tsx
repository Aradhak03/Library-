import { X, Armchair, Clock, User, Calendar, Plus, ArrowRightLeft } from 'lucide-react';
import type { SeatMatrixEntry } from '../../types/index.ts';
import { formatTime12Hour, getBookingSegments, timeStringToMinutes } from '../../utils/time.ts';
import { useModals } from '../../context/ModalContext.tsx';

interface SeatDrawerProps {
  seat: SeatMatrixEntry | null;
  onClose: () => void;
}

export const SeatDrawer = ({ seat, onClose }: SeatDrawerProps) => {
  const { openBookingModal, openChangeSlotModal } = useModals();

  if (!seat) return null;

  const is24h = seat.bookings.some((b) => b.is_24_hour_reservation);
  const isVacant = seat.bookings.length === 0;
  const isPartial = !isVacant && !is24h;

  const getStatusBadge = () => {
    if (!seat.is_active) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
          ⚫ Out of Service
        </span>
      );
    }
    if (is24h) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          🔴 24-Hour Reserved
        </span>
      );
    }
    if (isPartial) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          🟡 Partially Booked ({seat.bookings.length} {seat.bookings.length === 1 ? 'Slot' : 'Slots'})
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        🟢 Vacant All Day
      </span>
    );
  };

  // Color generator for multi-student visual bars
  const colors = [
    { bg: 'bg-blue-500', border: 'border-blue-400', text: 'text-blue-400' },
    { bg: 'bg-amber-500', border: 'border-amber-400', text: 'text-amber-400' },
    { bg: 'bg-purple-500', border: 'border-purple-400', text: 'text-purple-400' },
    { bg: 'bg-teal-500', border: 'border-teal-400', text: 'text-teal-400' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl">
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Armchair className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Seat #{seat.number}
                </h2>
                <div className="mt-1">{getStatusBadge()}</div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 24-Hour Visual Schedule Bar */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>24-Hour Daily Schedule</span>
                <span className="text-slate-400 font-normal">
                  {is24h ? '24 Hours Booked' : isVacant ? 'All 24h Free' : 'Shared Slots'}
                </span>
              </div>

              {/* Bar track */}
              <div className="relative h-7 bg-slate-800 rounded-lg overflow-hidden border border-slate-700/50">
                {seat.bookings.map((b, idx) => {
                  const segs = getBookingSegments(
                    b.daily_start_time,
                    b.daily_end_time,
                    b.is_24_hour_reservation
                  );
                  const color = is24h
                    ? 'bg-rose-500'
                    : colors[idx % colors.length].bg;

                  return segs.map((seg, sIdx) => (
                    <div
                      key={`${b.booking_id}-${sIdx}`}
                      title={`${b.student_name || 'Student'}: ${
                        b.is_24_hour_reservation
                          ? '24 Hours'
                          : `${formatTime12Hour(b.daily_start_time)} - ${formatTime12Hour(b.daily_end_time)}`
                      }`}
                      className={`absolute top-0 bottom-0 ${color} opacity-90 transition hover:opacity-100 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden`}
                      style={{
                        left: `${seg.startPercent}%`,
                        width: `${seg.widthPercent}%`,
                      }}
                    >
                      {seg.widthPercent > 12 && (b.student_name ? b.student_name.slice(0, 8) : 'Booked')}
                    </div>
                  ));
                })}
              </div>

              {/* Time axis marks */}
              <div className="flex justify-between text-[10px] text-slate-400 font-mono px-0.5">
                <span>12 AM</span>
                <span>6 AM</span>
                <span>12 PM</span>
                <span>6 PM</span>
                <span>12 AM</span>
              </div>
            </div>

            {/* Allocated Students List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Active Occupants ({seat.bookings.length})
                </h3>
              </div>

              {seat.bookings.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-800/20 border border-slate-800 text-center">
                  <Armchair className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-white">This seat is completely free!</p>
                  <p className="text-xs text-slate-400 mt-1">
                    No active student is booked on Seat #{seat.number}. You can allocate any 24h or custom hours slot.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {seat.bookings.map((booking, idx) => {
                    const color = is24h
                      ? { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400' }
                      : colors[idx % colors.length];

                    // Duration calc
                    let durationText = '24 Hours';
                    if (!booking.is_24_hour_reservation && booking.daily_start_time && booking.daily_end_time) {
                      const s = timeStringToMinutes(booking.daily_start_time);
                      const e = timeStringToMinutes(booking.daily_end_time);
                      const diffMins = e > s ? e - s : 1440 - s + e;
                      const hrs = (diffMins / 60).toFixed(1).replace('.0', '');
                      durationText = `${hrs} Hours Daily`;
                    }

                    return (
                      <div
                        key={booking.booking_id}
                        className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white">
                                {booking.student_name || `Student #${booking.student_id}`}
                              </h4>
                              <p className="text-xs text-slate-400 font-mono">
                                Student ID #{booking.student_id}
                              </p>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${color.bg} ${color.text} border ${color.border}`}>
                            {durationText}
                          </span>
                        </div>

                        {/* Timing details */}
                        <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[11px]">Time Window</span>
                            <span className="font-medium text-slate-200 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {booking.is_24_hour_reservation
                                ? 'Full Day (24h)'
                                : `${formatTime12Hour(booking.daily_start_time)} – ${formatTime12Hour(booking.daily_end_time)}`}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 block text-[11px]">Subscribed Since</span>
                            <span className="font-medium text-slate-200 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {booking.subscription_start_date}
                            </span>
                          </div>
                        </div>

                        {/* Shift Change Button */}
                        <div className="mt-3 pt-3 border-t border-slate-800/60 flex justify-end">
                          <button
                            onClick={() => {
                              onClose();
                              openChangeSlotModal({
                                bookingId: booking.booking_id,
                                studentName: booking.student_name || `Student #${booking.student_id}`,
                                currentSeatId: seat.id,
                                currentSeatNumber: seat.number,
                                currentStartTime: booking.daily_start_time,
                                currentEndTime: booking.daily_end_time,
                                currentIs24h: booking.is_24_hour_reservation,
                              });
                            }}
                            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>Change Timing / Seat</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer Action */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/90">
            {!is24h && seat.is_active ? (
              <button
                onClick={() => {
                  onClose();
                  openBookingModal({ preselectedSeatId: seat.id });
                }}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
              >
                <Plus className="w-4 h-4" />
                <span>Book an Open Slot on Seat #{seat.number}</span>
              </button>
            ) : (
              <button
                disabled
                className="w-full py-2.5 rounded-lg bg-slate-800 text-slate-500 font-medium text-sm cursor-not-allowed text-center"
              >
                {seat.is_active ? 'Seat is Reserved 24 Hours' : 'Seat is Out of Service'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
