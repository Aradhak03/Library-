import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Phone,
  Armchair,
  Clock,
  RefreshCw,
  Plus,
  IndianRupee,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { studentsApi, bookingsApi, dashboardApi, getErrorMessage } from '../api/client.ts';
import type { Student, Booking, PendingStudent } from '../types/index.ts';
import { StudentDrawer } from '../components/students/StudentDrawer.tsx';
import { formatTime12Hour } from '../utils/time.ts';
import { useModals } from '../context/ModalContext.tsx';

export default function StudentsDirectory() {
  const { openStudentModal, openBookingModal, openPaymentModal, refreshKey } = useModals();

  const [students, setStudents] = useState<Student[]>([]);
  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [pendingStudents, setPendingStudents] = useState<PendingStudent[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected student for detail slide-over
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'unassigned' | 'overdue'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentsData, bookingsData, pendingData] = await Promise.all([
        studentsApi.getAll(),
        bookingsApi.getAll(),
        dashboardApi.getPending().catch(() => []),
      ]);

      setStudents(studentsData);
      setActiveBookings(bookingsData);
      setPendingStudents(pendingData);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Map student_id -> active Booking
  const studentBookingMap = useMemo(() => {
    const map = new Map<number, Booking>();
    activeBookings.forEach((b) => {
      if (b.is_active) {
        map.set(b.student_id, b);
      }
    });
    return map;
  }, [activeBookings]);

  // Set of overdue student IDs
  const overdueStudentIds = useMemo(() => {
    return new Set(pendingStudents.map((p) => p.student_id));
  }, [pendingStudents]);

  // Filtered students list
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // 1. Search Query (name or mobile)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = student.name.toLowerCase().includes(q);
        const matchesMobile = student.mobile_number.includes(q);
        if (!matchesName && !matchesMobile) return false;
      }

      // 2. Tab filters
      const hasBooking = studentBookingMap.has(student.id);
      const isOverdue = overdueStudentIds.has(student.id);

      if (filterTab === 'active' && !hasBooking) return false;
      if (filterTab === 'unassigned' && hasBooking) return false;
      if (filterTab === 'overdue' && !isOverdue) return false;

      return true;
    });
  }, [students, searchQuery, filterTab, studentBookingMap, overdueStudentIds]);

  const activeCount = useMemo(
    () => students.filter((s) => studentBookingMap.has(s.id)).length,
    [students, studentBookingMap]
  );
  const unassignedCount = students.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>Students Directory</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {students.length} Registered
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Search members, view active seat allocations, and inspect payment ledgers.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            title="Refresh list"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          <button
            onClick={openStudentModal}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register New Student</span>
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

      {/* Search and Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filterTab === 'all'
                ? 'bg-slate-800 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Members ({students.length})
          </button>

          <button
            onClick={() => setFilterTab('active')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              filterTab === 'active'
                ? 'bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>Active Seats ({activeCount})</span>
          </button>

          <button
            onClick={() => setFilterTab('unassigned')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              filterTab === 'unassigned'
                ? 'bg-slate-800 text-slate-200 font-semibold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>Unassigned ({unassignedCount})</span>
          </button>

          <button
            onClick={() => setFilterTab('overdue')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              filterTab === 'overdue'
                ? 'bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Overdue ({pendingStudents.length})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name or 10-digit mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition shadow-sm"
          />
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Loading students directory...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center py-20">
            <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <h4 className="text-base font-semibold text-white">No Students Found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {searchQuery
                ? `No student matching "${searchQuery}".`
                : 'No students have been registered yet. Click "Register New Student" to add members.'}
            </p>
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 text-xs text-blue-400 hover:underline"
              >
                Clear search
              </button>
            ) : (
              <button
                onClick={openStudentModal}
                className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
              >
                + Register First Student
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 bg-slate-900/40">
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Mobile Number</th>
                  <th className="py-3.5 px-4">Allocated Seat</th>
                  <th className="py-3.5 px-4">Daily Timing</th>
                  <th className="py-3.5 px-4">Subscription Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredStudents.map((student) => {
                  const booking = studentBookingMap.get(student.id);
                  const isOverdue = overdueStudentIds.has(student.id);

                  return (
                    <tr
                      key={student.id}
                      onClick={() => setSelectedStudentId(student.id)}
                      className="hover:bg-slate-800/40 transition cursor-pointer group"
                    >
                      {/* Name & ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center">
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white group-hover:text-blue-400 transition">
                              {student.name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              ID #{student.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Mobile */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-slate-300 text-xs flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-500" />
                          {student.mobile_number}
                        </span>
                      </td>

                      {/* Seat Allocation */}
                      <td className="py-3.5 px-4">
                        {booking ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Armchair className="w-3.5 h-3.5" />
                            Seat #{booking.seat_id}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium italic">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Daily Timing */}
                      <td className="py-3.5 px-4">
                        {booking ? (
                          <span className="text-xs text-slate-200 font-medium flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {booking.is_24_hour_reservation
                              ? '24-Hour Pass'
                              : `${formatTime12Hour(booking.daily_start_time)} – ${formatTime12Hour(
                                  booking.daily_end_time
                                )}`}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            ⚠️ Overdue Dues
                          </span>
                        ) : booking ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active Member
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            No Seat Assigned
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div
                          className="flex items-center justify-end gap-2"
                          onClick={(e) => e.stopPropagation()} // Prevent row click
                        >
                          {booking ? (
                            <button
                              onClick={() =>
                                openPaymentModal({
                                  bookingId: booking.id,
                                  studentId: student.id,
                                  studentName: student.name,
                                  defaultMode: 'regular',
                                })
                              }
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition flex items-center gap-1"
                              title="Record fee payment"
                            >
                              <IndianRupee className="w-3 h-3" />
                              <span>Fee</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => openBookingModal({ preselectedStudentId: student.id })}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition flex items-center gap-1"
                              title="Allocate seat"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Seat</span>
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedStudentId(student.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            title="View student ledger & profile"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Profile Drawer */}
      <StudentDrawer
        studentId={selectedStudentId}
        onClose={() => {
          setSelectedStudentId(null);
          fetchData();
        }}
      />
    </div>
  );
}
