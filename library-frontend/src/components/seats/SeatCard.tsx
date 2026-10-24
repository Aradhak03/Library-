import { Armchair, CheckCircle2, Clock } from 'lucide-react';
import type { SeatMatrixEntry } from '../../types/index.ts';
import { formatTime12Hour, getBookingSegments } from '../../utils/time.ts';

interface SeatCardProps {
  seat: SeatMatrixEntry;
  isFilterActive: boolean;
  isMatch: boolean;
  onClick: () => void;
}

export const SeatCard = ({ seat, isFilterActive, isMatch, onClick }: SeatCardProps) => {
  const is24h = seat.bookings.some((b) => b.is_24_hour_reservation);
  const isVacant = seat.bookings.length === 0;
  const isPartial = !isVacant && !is24h;

  // Determine border and background styling
  let borderStyle = 'border-slate-800 hover:border-slate-700';
  let statusBadge = (
    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
      Vacant
    </span>
  );

  if (!seat.is_active) {
    statusBadge = (
      <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
        Out of Service
      </span>
    );
  } else if (is24h) {
    statusBadge = (
      <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
        24h Full
      </span>
    );
  } else if (isPartial) {
    statusBadge = (
      <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
        Partial ({seat.bookings.length})
      </span>
    );
  }

  // Filter highlighting
  if (isFilterActive) {
    if (isMatch) {
      borderStyle =
        'border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/50';
    } else {
      borderStyle = 'border-slate-800/40 opacity-40 hover:opacity-80';
    }
  }

  const colors = ['bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-teal-500'];

  return (
    <div
      onClick={onClick}
      className={`p-3.5 rounded-xl bg-slate-900 border transition-all duration-200 cursor-pointer flex flex-col justify-between group hover:shadow-md ${borderStyle}`}
    >
      {/* Top Header: Seat Number + Status Tag */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Armchair className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 transition" />
            <span className="font-bold text-white text-sm">#{seat.number}</span>
          </div>
          {statusBadge}
        </div>

        {/* Mini 24-Hour Timeline Bar */}
        <div className="relative h-2 bg-slate-800/80 rounded-full overflow-hidden my-2.5 border border-slate-800">
          {seat.bookings.map((b, idx) => {
            const segs = getBookingSegments(
              b.daily_start_time,
              b.daily_end_time,
              b.is_24_hour_reservation
            );
            const color = is24h ? 'bg-rose-500' : colors[idx % colors.length];

            return segs.map((seg, sIdx) => (
              <div
                key={`${b.booking_id}-${sIdx}`}
                className={`absolute top-0 bottom-0 ${color}`}
                style={{
                  left: `${seg.startPercent}%`,
                  width: `${seg.widthPercent}%`,
                }}
              />
            ));
          })}
        </div>
      </div>

      {/* Bottom Summary: Occupants or Available Tag */}
      <div className="mt-1">
        {isFilterActive && isMatch ? (
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            <span>Fits Slot</span>
          </div>
        ) : isVacant ? (
          <div className="text-[11px] text-slate-400 font-medium">All day free</div>
        ) : is24h ? (
          <div className="text-[11px] text-slate-300 font-medium truncate">
            {seat.bookings[0]?.student_name || 'Reserved 24h'}
          </div>
        ) : (
          <div className="text-[11px] text-slate-300 font-medium truncate flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">
              {seat.bookings.length === 1
                ? `${seat.bookings[0].student_name || 'Student'} (${formatTime12Hour(
                    seat.bookings[0].daily_start_time
                  )})`
                : `${seat.bookings.length} students sharing`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
