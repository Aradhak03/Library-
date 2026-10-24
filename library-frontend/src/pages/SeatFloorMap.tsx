import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Armchair,
  RefreshCw,
  Search,
  Sparkles,
  CheckCircle2,
  Clock,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { seatsApi, getErrorMessage } from '../api/client.ts';
import type { SeatMatrixEntry } from '../types/index.ts';
import { SeatCard } from '../components/seats/SeatCard.tsx';
import { SeatDrawer } from '../components/seats/SeatDrawer.tsx';
import { checkTimesOverlap, formatTime12Hour } from '../utils/time.ts';
import { useModals } from '../context/ModalContext.tsx';

export default function SeatFloorMap() {
  const { refreshKey } = useModals();

  // Seats state
  const [seats, setSeats] = useState<SeatMatrixEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected seat for detail drawer
  const [selectedSeat, setSelectedSeat] = useState<SeatMatrixEntry | null>(null);

  // Status Filter: 'all' | 'vacant' | 'partial' | 'full'
  const [statusFilter, setStatusFilter] = useState<'all' | 'vacant' | 'partial' | 'full'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Slot Availability Finder State
  const [isFinderOpen, setIsFinderOpen] = useState(false);
  const [filterIs24h, setFilterIs24h] = useState(false);
  const [filterStartTime, setFilterStartTime] = useState('08:00');
  const [filterEndTime, setFilterEndTime] = useState('14:00');
  const [finderActive, setFinderActive] = useState(false);

  // Seeding state
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState<string | null>(null);

  // Fetch all 48 seats + schedules in single call
  const fetchSeats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await seatsApi.getMatrix();
      setSeats(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeats();
  }, [fetchSeats, refreshKey]);

  // Handle seed
  const handleSeed48 = async () => {
    setSeeding(true);
    try {
      const res = await seatsApi.seed48();
      setSeedSuccess(res.message);
      setTimeout(() => setSeedSuccess(null), 4000);
      fetchSeats();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSeeding(false);
    }
  };

  // Helper to determine if a seat is available for the requested finder slot
  const isSeatAvailableForSlot = useCallback(
    (seat: SeatMatrixEntry): boolean => {
      if (!seat.is_active) return false;

      // If seat has a 24-hr booking, it is never available
      if (seat.bookings.some((b) => b.is_24_hour_reservation)) return false;

      // If user wants 24-hour reservation, seat must have ZERO bookings
      if (filterIs24h) {
        return seat.bookings.length === 0;
      }

      // Check for overlap against each booking on the seat
      for (const b of seat.bookings) {
        if (b.is_24_hour_reservation) return false;
        if (checkTimesOverlap(b.daily_start_time, b.daily_end_time, filterStartTime, filterEndTime)) {
          return false;
        }
      }

      return true;
    },
    [filterIs24h, filterStartTime, filterEndTime]
  );

  // Metrics
  const vacantCount = useMemo(
    () => seats.filter((s) => s.bookings.length === 0 && s.is_active).length,
    [seats]
  );
  const fullCount = useMemo(
    () => seats.filter((s) => s.bookings.some((b) => b.is_24_hour_reservation)).length,
    [seats]
  );
  const partialCount = useMemo(
    () =>
      seats.filter(
        (s) => s.bookings.length > 0 && !s.bookings.some((b) => b.is_24_hour_reservation)
      ).length,
    [seats]
  );

  const availableCountForFinder = useMemo(() => {
    if (!finderActive) return 0;
    return seats.filter((s) => isSeatAvailableForSlot(s)).length;
  }, [finderActive, seats, isSeatAvailableForSlot]);

  // Filtered Seats
  const filteredSeats = useMemo(() => {
    return seats.filter((seat) => {
      // Search query (number)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesNumber = String(seat.number).includes(query);
        const matchesStudent = seat.bookings.some((b) =>
          b.student_name ? b.student_name.toLowerCase().includes(query) : false
        );
        if (!matchesNumber && !matchesStudent) return false;
      }

      // Status pill filter
      if (statusFilter === 'vacant') {
        if (seat.bookings.length > 0) return false;
      } else if (statusFilter === 'full') {
        if (!seat.bookings.some((b) => b.is_24_hour_reservation)) return false;
      } else if (statusFilter === 'partial') {
        if (
          seat.bookings.length === 0 ||
          seat.bookings.some((b) => b.is_24_hour_reservation)
        )
          return false;
      }

      return true;
    });
  }, [seats, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>48-Seat Floor Map</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              48 Total Seats
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Visual room layout with 24-hr timeline bars and conflict-free slot finder.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Toggle Slot Finder */}
          <button
            onClick={() => {
              setIsFinderOpen(!isFinderOpen);
              if (!isFinderOpen) setFinderActive(true);
            }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
              finderActive
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-600/30'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{finderActive ? 'Slot Finder Active' : 'Slot Availability Finder'}</span>
          </button>

          {/* Refresh button */}
          <button
            onClick={() => fetchSeats()}
            disabled={loading}
            title="Refresh floor map"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error or Success Alerts */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="underline hover:text-red-300">
            Dismiss
          </button>
        </div>
      )}

      {/* Seed Helper if 0 seats */}
      {seats.length === 0 && !loading && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/30 to-slate-900 border border-blue-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Armchair className="w-8 h-8 text-blue-400 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-white">Database has 0 seats</h4>
              <p className="text-xs text-slate-400">Initialize Seats 1 through 48 in one click.</p>
            </div>
          </div>
          <button
            onClick={handleSeed48}
            disabled={seeding}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shrink-0"
          >
            {seeding ? 'Seeding...' : 'Seed Seats 1 to 48'}
          </button>
        </div>
      )}

      {seedSuccess && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{seedSuccess}</span>
        </div>
      )}

      {/* Slot Availability Finder Expandable Card */}
      {isFinderOpen && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-emerald-500/30 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Slot Availability Finder
                </h3>
                <p className="text-xs text-slate-400">
                  Enter student's desired hours to see which of the 48 seats are 100% free with zero conflicts.
                </p>
              </div>
            </div>

            {finderActive && (
              <button
                onClick={() => setFinderActive(false)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Finder</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
            {/* Timing Type Toggle */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Reservation Mode
              </label>
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setFilterIs24h(false);
                    setFinderActive(true);
                  }}
                  className={`py-1.5 rounded font-medium transition ${
                    !filterIs24h ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Custom Hours
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterIs24h(true);
                    setFinderActive(true);
                  }}
                  className={`py-1.5 rounded font-medium transition ${
                    filterIs24h ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  24 Hours
                </button>
              </div>
            </div>

            {/* Start Time */}
            {!filterIs24h && (
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Desired Start Time
                </label>
                <input
                  type="time"
                  value={filterStartTime}
                  onChange={(e) => {
                    setFilterStartTime(e.target.value);
                    setFinderActive(true);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            )}

            {/* End Time */}
            {!filterIs24h && (
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Desired End Time
                </label>
                <input
                  type="time"
                  value={filterEndTime}
                  onChange={(e) => {
                    setFilterEndTime(e.target.value);
                    setFinderActive(true);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            )}

            {/* Results Pill */}
            <div className="flex items-end">
              <div className="w-full p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center justify-between">
                <span>Matching Seats:</span>
                <strong className="text-sm font-bold">
                  {availableCountForFinder} of {seats.length} Free
                </strong>
              </div>
            </div>
          </div>

          {/* Results feedback text */}
          {finderActive && (
            <div className="text-xs text-slate-300 pt-1 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Highlighting seats available for{' '}
                <strong className="text-white">
                  {filterIs24h
                    ? '24-Hour Full Day'
                    : `${formatTime12Hour(filterStartTime)} to ${formatTime12Hour(filterEndTime)}`}
                </strong>
                . Available seats glow in green below!
              </span>
            </div>
          )}
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({seats.length})
          </button>
          <button
            onClick={() => setStatusFilter('vacant')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              statusFilter === 'vacant'
                ? 'bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Vacant ({vacantCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('partial')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              statusFilter === 'partial'
                ? 'bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Partial ({partialCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('full')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              statusFilter === 'full'
                ? 'bg-rose-500/10 text-rose-400 font-semibold border border-rose-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>24h Full ({fullCount})</span>
          </button>
        </div>

        {/* Search by Seat # or Student Name */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search seat # or student..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition shadow-sm"
          />
        </div>
      </div>

      {/* 48-Seat Visual Grid */}
      {loading ? (
        <div className="py-24 text-center">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading 48-seat floor layout...</p>
        </div>
      ) : filteredSeats.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center py-20">
          <Armchair className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <h4 className="text-base font-semibold text-white">No Seats Match Filters</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Try resetting your status filter or clearing your search term to see all 48 seats.
          </p>
          <button
            onClick={() => {
              setStatusFilter('all');
              setSearchQuery('');
            }}
            className="mt-4 px-4 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {filteredSeats.map((seat) => {
            const isMatch = finderActive ? isSeatAvailableForSlot(seat) : false;

            return (
              <SeatCard
                key={seat.id}
                seat={seat}
                isFilterActive={finderActive}
                isMatch={isMatch}
                onClick={() => setSelectedSeat(seat)}
              />
            );
          })}
        </div>
      )}

      {/* Seat Schedule Slide-over Drawer */}
      <SeatDrawer
        seat={selectedSeat}
        onClose={() => {
          setSelectedSeat(null);
          fetchSeats(); // Refresh schedule on drawer close
        }}
      />
    </div>
  );
}
